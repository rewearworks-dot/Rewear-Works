# v2 — Follow-up Fixes & Hardening (Putaran 3)

Status: **rencana** (belum diimplementasikan). Dokumen ini eksplisit & berurutan agar
bisa dikerjakan satu-per-satu (termasuk oleh worker agent). Setiap langkah punya:
**Masalah → Akar masalah → Perubahan (file) → Uji terima**.

Konvensi yang dipakai repo ini (ikuti, jangan menyimpang):
- Server Action: `'use server'`, kembalikan `{ ok: true }` atau `{ error: '...' }`.
- Akses DB elevated (lewati RLS): `createAdminClient()` dari `@/lib/supabase/admin` (server-only).
- Verifikasi pembayaran otoritatif: `getTransactionDetail({ amount, orderId })` dari `@/lib/payments/pakasir`.
- Setelah mutasi data: `revalidatePath(...)` path yang relevan.

Urutan pengerjaan yang disarankan: **Fase 0 → 1 → 2 → 3**. Fase 1 wajib sebelum produksi
(menyangkut stok & uang). Dalam satu fase, langkah boleh dikerjakan independen kecuali
disebut "tergantung".

---

## Fase 0 — Prasyarat database (lakukan dulu, sekali)

### 0.1 Pastikan migrasi v2_0010 sudah dijalankan
- **Masalah:** Plan mengandalkan kolom `orders.expires_at` & fungsi `expire_unpaid_orders()`.
- **Aksi:** Di Supabase SQL Editor, jalankan `docs/plan/v2/sql/v2_0010_order_size_and_expiry.sql`
  (idempoten). Verifikasi:
  ```sql
  select column_name from information_schema.columns
  where table_schema='public' and table_name='orders'
    and column_name in ('expires_at','customer_email');
  -- harus mengembalikan 2 baris
  ```

### 0.2 Migrasi baru: kolom penanda tinjauan manual
- **Masalah:** Saat pembayaran masuk untuk order yang sudah dibatalkan/kadaluwarsa (lihat 1.2),
  kita perlu menandainya untuk refund manual TANPA melanggar CHECK `payment_status`
  (`'unpaid'|'paid'|'failed'|'expired'`).
- **Perubahan (file baru):** `docs/plan/v2/sql/v2_0011_needs_review.sql`
  ```sql
  alter table public.orders
    add column if not exists needs_review boolean not null default false;
  comment on column public.orders.needs_review is
    'true bila pembayaran masuk untuk order batal/expired — perlu refund/tinjauan manual';
  ```
- **Uji terima:** kolom `needs_review` ada; default `false`.

---

## Fase 1 — WAJIB sebelum produksi (stok & uang)

### 1.1 Aktifkan auto-expiry order belum dibayar (jadwalkan `expire_unpaid_orders`)
- **Masalah:** Fungsi `expire_unpaid_orders()` ada tapi **tidak pernah dipanggil** → stok order
  yang tak dibayar tidak pernah kembali. Fix "stok nyangkut" (A2) jadi mati suri.
- **Akar masalah:** Tidak ada cron/route pemicu (baris `cron.schedule` di migrasi masih komentar).
- **Perubahan (pilih SATU):**

  **Opsi A (disarankan jika deploy di Vercel): route + Vercel Cron.**
  - File baru `src/app/api/cron/expire/route.js`:
    ```js
    import { NextResponse } from 'next/server';
    import { createAdminClient } from '@/lib/supabase/admin';

    export async function GET(request) {
      // Proteksi: hanya boleh dipanggil cron dengan secret.
      const auth = request.headers.get('authorization');
      if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ ok: false }, { status: 401 });
      }
      const supabase = createAdminClient();
      const { data, error } = await supabase.rpc('expire_unpaid_orders');
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, expired: data ?? 0 });
    }
    ```
  - File baru `vercel.json` (root):
    ```json
    { "crons": [{ "path": "/api/cron/expire", "schedule": "*/15 * * * *" }] }
    ```
  - Tambah env `CRON_SECRET` (lihat 3.1). Catatan: Vercel Cron otomatis mengirim header
    `Authorization: Bearer <CRON_SECRET>` bila env tsb. di-set di project.

  **Opsi B (tanpa kode, jika pakai Supabase pg_cron):** jalankan sekali di SQL Editor:
  ```sql
  select cron.schedule('expire-unpaid-orders','*/15 * * * *',
    $$ select public.expire_unpaid_orders(); $$);
  ```
- **Uji terima:** Buat order, jangan bayar, set `expires_at` ke masa lampau
  (`update orders set expires_at = now() - interval '1 minute' where id = '...'`),
  panggil route/cron → order jadi `Dibatalkan`/`payment_status='expired'` dan **stok produk kembali**,
  `status` produk kembali `available`.

### 1.2 Pusatkan + amankan konfirmasi pembayaran (perbaiki bug RLS + guard race)
- **Masalah ganda:**
  1. **Bug RLS:** `checkout/success/page.js` menandai `paid` pakai sesi pelanggan, tapi RLS
     `orders_update_admin` hanya izinkan admin → update **gagal diam-diam**; UI bilang "Berhasil",
     DB tetap `unpaid`.
  2. **Race resume-pay:** webhook & success page hanya berhenti bila `payment_status==='paid'`.
     Bila pembeli **membatalkan** (atau order **kadaluwarsa**) lalu tetap menyelesaikan invoice
     Pakasir → order batal berubah jadi `paid`, padahal stok sudah dikembalikan/mungkin terjual lagi.
- **Perubahan:**
  - File baru `src/lib/payments/confirm.js` (server-only, pakai admin client → bypass RLS,
    sumber kebenaran tunggal):
    ```js
    import 'server-only';
    import { createAdminClient } from '@/lib/supabase/admin';
    import { getTransactionDetail } from '@/lib/payments/pakasir';

    // Verifikasi otoritatif ke Pakasir lalu tandai lunas. Idempoten.
    // Dipakai webhook (service-role) DAN success page (server component).
    export async function confirmPaymentByOrderId(orderId) {
      const supabase = createAdminClient();
      const { data: order } = await supabase
        .from('orders').select('id, total, status, payment_status, needs_review')
        .eq('id', orderId).maybeSingle();
      if (!order) return { status: 'not_found' };
      if (order.payment_status === 'paid') return { status: 'paid' };       // idempoten

      // Guard race: order batal/kadaluwarsa tetapi pembayaran masuk → JANGAN tandai lunas.
      if (order.status === 'Dibatalkan' ||
          order.payment_status === 'expired' || order.payment_status === 'failed') {
        if (!order.needs_review) {
          await supabase.from('orders').update({ needs_review: true }).eq('id', order.id);
        }
        return { status: 'needs_manual' };
      }

      const tx = await getTransactionDetail({ amount: order.total, orderId: order.id });
      if (!tx || tx.status !== 'completed' || Number(tx.amount) !== Number(order.total)) {
        return { status: 'unverified' };
      }
      await supabase.from('orders').update({
        payment_status: 'paid',
        payment_method: tx.payment_method ?? null,
        paid_at: tx.completed_at ?? new Date().toISOString(),
      }).eq('id', order.id);
      return { status: 'paid' };
    }
    ```
  - Edit `src/app/api/webhooks/pakasir/route.js`: setelah cek secret + parse body, ganti blok
    load-order + verifikasi + update jadi:
    ```js
    import { confirmPaymentByOrderId } from '@/lib/payments/confirm';
    // ...
    const result = await confirmPaymentByOrderId(order_id);
    if (result.status === 'not_found') return NextResponse.json({ ok: false }, { status: 404 });
    revalidatePath('/profile'); revalidatePath('/admin/orders'); revalidatePath('/admin');
    if (result.status === 'paid' || result.status === 'needs_manual')
      return NextResponse.json({ ok: true, note: result.status });
    return NextResponse.json({ ok: false, reason: result.status }, { status: 202 });
    ```
  - Edit `src/app/checkout/success/page.js`: ganti blok "Cek status pembayaran" jadi panggilan
    fungsi terpusat + tambahkan SELECT kolom `needs_review` dan render 3 keadaan
    (lunas / menunggu / **perlu ditinjau**):
    ```js
    import { confirmPaymentByOrderId } from '@/lib/payments/confirm';
    // SELECT tambah: 'needs_review'
    let paymentCompleted = order.payment_status === 'paid';
    let needsReview = order.needs_review || order.status === 'Dibatalkan';
    if (!paymentCompleted && !needsReview) {
      const r = await confirmPaymentByOrderId(order.id);
      paymentCompleted = r.status === 'paid';
      needsReview = r.status === 'needs_manual';
    }
    ```
    Tambahkan blok UI ketiga: jika `needsReview && !paymentCompleted` → tampilkan
    "Pembayaran sedang ditinjau / hubungi admin" (jangan tampilkan "Berhasil").
- **Uji terima:**
  1. Pelanggan bayar normal → success page menandai `paid` di DB (cek tabel), bukan cuma di layar.
  2. Pelanggan klik **Batalkan**, lalu paksa konfirmasi (panggil webhook/success untuk order itu)
     → order **tidak** jadi `paid`; `needs_review=true`; admin bisa lihat penanda.
  3. Webhook untuk order belum-bayar yang valid → `paid` (idempoten saat dipanggil 2x).

### 1.3 Cegah admin mem-fulfil order yang belum lunas
- **Masalah:** Admin bisa set status `Diproses/Dikirim/Selesai` pada order `unpaid` → risiko kirim
  barang belum dibayar.
- **Perubahan:**
  - Edit `src/lib/actions/orders.js` → `updateOrderStatus`: sebelum update non-cancel, cek lunas.
    ```js
    const FULFILLMENT = ['Diproses', 'Dikirim', 'Selesai'];
    if (FULFILLMENT.includes(status)) {
      const { data: o } = await supabase.from('orders')
        .select('payment_status').eq('id', orderId).single();
      if (o?.payment_status !== 'paid')
        return { error: 'Pesanan belum dibayar — tidak bisa diproses/dikirim.' };
    }
    ```
    (Pastikan `supabase` sudah dibuat sebelum cek; rapikan agar tak dibuat dua kali.)
  - Edit `src/app/admin/orders/OrdersManager.js`: pada `<select>`, nonaktifkan opsi fulfilment
    bila `order.paymentStatus !== 'paid'` (biarkan `Baru` & `Dibatalkan` aktif). Contoh:
    `<option value={s} disabled={['Diproses','Dikirim','Selesai'].includes(s) && order.paymentStatus !== 'paid'}>`.
- **Uji terima:** Order `unpaid` → memilih "Dikirim" ditolak (server) & opsinya disabled (UI);
  order `paid` → normal.

---

## Fase 2 — UX & konsistensi

### 2.1 Keranjang tamu hilang saat login → adopsi saat login
- **Masalah:** Tamu menambah barang (storage `rewear-cart:guest`), setelah login storage pindah ke
  `rewear-cart:<uid>` → keranjang tampak kosong.
- **Perubahan:** Edit `src/context/CartContext.js`, di `useEffect` pemuatan (yang bergantung
  `storageKey`): bila user login & keranjang user kosong, adopsi keranjang tamu lalu hapus tamu.
  ```js
  if (currentUser?.id && items.length === 0) {
    const guest = localStorage.getItem('rewear-cart:guest');
    if (guest) {
      const gItems = withCartId(JSON.parse(guest));
      if (gItems.length) { items = gItems; localStorage.removeItem('rewear-cart:guest'); }
    }
  }
  ```
  (Hanya guest→user; jangan sebaliknya.)
- **Uji terima:** Logout → tambah 2 barang → login → 2 barang itu muncul di keranjang user;
  `rewear-cart:guest` terhapus.

### 2.2 Nama di Navbar ikut ter-refresh setelah edit profil
- **Masalah:** `AuthContext` hanya re-fetch profil saat `user.id` berubah; setelah edit nama,
  Navbar/avatar tetap nama lama sampai reload.
- **Perubahan:**
  - Edit `src/context/AuthContext.js`: ekstrak logika fetch profil jadi `refreshProfile()` dan
    expose lewat context value.
    ```js
    const refreshProfile = useCallback(async () => {
      if (!user?.id) return;
      const supabase = createClient();
      const { data } = await supabase.from('profiles')
        .select('id, full_name, phone, role, created_at').eq('id', user.id).maybeSingle();
      setProfile(data ?? null);
    }, [user?.id]);
    // tambahkan refreshProfile ke object value
    ```
  - Edit `src/app/profile/ProfileClient.js`: ambil `refreshProfile` dari `useAuth()`, panggil saat
    `state?.ok` (di blok adjust-state-during-render yang sudah ada).
- **Uji terima:** Edit nama → simpan → nama di dropdown Navbar berubah tanpa reload.

### 2.3 Warna badge status konsisten (Dashboard & Laporan)
- **Masalah:** Di `admin/page.js` & `ReportsClient.js`, semua status selain `'Baru'` diberi hijau
  (termasuk **"Dibatalkan"** → tampil hijau, menyesatkan).
- **Perubahan:**
  - Edit `src/utils/helpers.js`, tambah helper:
    ```js
    export function orderStatusBadge(status) {
      return ({ Baru:'badge-warning', Diproses:'badge-warning', Dikirim:'badge-info',
        Selesai:'badge-success', Dibatalkan:'badge-danger' })[status] || 'badge-secondary';
    }
    ```
  - Pakai di `src/app/admin/page.js` (tabel Pesanan Terbaru) & `src/app/admin/reports/ReportsClient.js`
    (tabel Laporan) menggantikan ternary `=== 'Baru' ? ... : 'badge-success'`.
- **Uji terima:** Order `Dibatalkan` tampil badge merah di Dashboard & Laporan.

### 2.4 (Opsional) Tampilkan penanda "Perlu Tinjau" di admin
- Tergantung 0.2 + 1.2. Di `OrdersManager.js`, bila `order.needsReview` true (map dari
  `needs_review` di `src/lib/data/orders.js` `shapeOrder`), tampilkan badge "⚠ Perlu Tinjau".
- **Uji terima:** Order hasil kasus 1.2-(2) tampil penanda di panel admin.

---

## Fase 3 — Konfigurasi & catatan skala

### 3.1 Lengkapi environment variables
- Tambah ke `.env.local` (dan dokumentasikan di template):
  ```
  PAKASIR_WEBHOOK_SECRET=""   # aktifkan verifikasi secret webhook (Fase 1.2/E4)
  CRON_SECRET=""              # proteksi route cron (Fase 1.1 Opsi A)
  ```
- Set juga di environment Vercel/produksi.

### 3.2 (Catatan, belum perlu diubah) Pagination server-side
- Shop & Home memuat SEMUA produk ke client. Aman untuk katalog kecil. Saat produk >100,
  pindahkan filter/sort/pagination ke server (`getProducts({ page, category, q, sort })` + `range()`).

### 3.3 (Future) Email notifikasi order
- Kolom `customer_email` sudah diisi di `create_order`. Belum ada pengiriman email konfirmasi/
  pembayaran. Pertimbangkan integrasi email saat status `paid`.

---

## Checklist eksekusi (untuk worker agent)

- [ ] 0.1 migrasi v2_0010 terverifikasi
- [ ] 0.2 buat & jalankan v2_0011 (needs_review)
- [ ] 1.1 route cron + vercel.json (atau pg_cron) + uji expiry
- [ ] 1.2 `confirm.js` + ubah webhook + ubah success page + uji 3 kasus
- [ ] 1.3 guard updateOrderStatus + disable opsi UI
- [ ] 2.1 adopsi keranjang tamu saat login
- [ ] 2.2 refreshProfile di AuthContext + panggil di ProfileClient
- [ ] 2.3 helper orderStatusBadge + pakai di Dashboard & Laporan
- [ ] 2.4 (opsional) penanda Perlu Tinjau di admin
- [ ] 3.1 env PAKASIR_WEBHOOK_SECRET + CRON_SECRET

> Setelah semua: `npm run build` harus sukses; uji alur beli→bayar, beli→batal→coba bayar,
> beli→biarkan kadaluwarsa→cron, dan edit profil.
