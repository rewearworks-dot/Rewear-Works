# 10 — Stabilisasi & Hardening Kode

Tujuan: hilangkan bug nyata, kode mati, dan inkonsistensi yang akan menyebabkan masalah di
produksi. Kerjakan **berurutan**. Terapkan `debugging-and-error-recovery` (cari akar masalah) dan
`test-driven-development` (tulis test gagal dulu untuk tiap bug) dan `code-simplification`.

> **Aturan emas fase ini:** untuk SETIAP perbaikan bug — (1) reproduksi/identifikasi, (2) tulis
> test atau langkah verifikasi manual, (3) perbaiki, (4) `npm run build` hijau, (5) centang
> acceptance. Jangan menumpuk banyak perbaikan tanpa verifikasi.

---

## FASE H-1 — Hapus kode mati: `ProductContext` & data JSON (isu H1, H7)

**Masalah:** `src/context/ProductContext.js` + `ProductProvider` di `src/app/layout.js` masih
membungkus seluruh aplikasi, tetapi `useProducts` **tidak dipakai lagi** di mana pun (sudah
diverifikasi). Provider ini membaca/menulis `localStorage('rewear-store')` (seed dari
`products.json`) pada setiap kunjungan → boros, dan berisiko menampilkan/menyimpan "data hantu"
yang membingungkan debugging.

**Langkah:**
1. Konfirmasi sekali lagi tidak ada pemakaian:
   ```bash
   grep -rn "useProducts\|ProductProvider\|ProductContext" src
   ```
   Hasil harus hanya menunjuk ke `layout.js` (import + pemakaian) dan file `ProductContext.js`
   itu sendiri. Jika ada konsumen lain, **migrasikan dulu** ke server-fetch (`@/lib/data/*`)
   sebelum menghapus.
2. Di `src/app/layout.js`:
   - Hapus `import { ProductProvider } from '@/context/ProductContext';`
   - Hapus wrapper `<ProductProvider> ... </ProductProvider>` (sisakan `AuthProvider` + `CartProvider`).
3. Hapus file `src/context/ProductContext.js`.
4. Tangani `src/data/products.json` & `categories.json`:
   - Cek pemakaian: `grep -rn "data/products\|data/categories" src`. Setelah ProductContext hilang,
     seharusnya **nol** pemakaian.
   - Pindahkan kedua file ke `docs/plan/seed-data/` (arsip sumber seed) atau hapus. **Jangan**
     biarkan diimport kode runtime.
5. Bersihkan `localStorage('rewear-store')` lama (opsional): tidak perlu kode; kunci itu akan
   berhenti ditulis. Boleh tambahkan pembersihan satu kali di `CartProvider` mount bila ingin rapi
   (opsional, jangan menghapus cart).

**Acceptance H-1:**
- [ ] `grep -rn "useProducts\|ProductProvider\|ProductContext" src` → **nol** hasil.
- [ ] `grep -rn "data/products\|data/categories" src` → **nol** hasil.
- [ ] `layout.js` hanya membungkus `AuthProvider` + `CartProvider`.
- [ ] App tetap berfungsi (Home/Shop/Detail tampil dari Supabase), `npm run build` hijau.

**Pitfall:** jangan menghapus `CartContext` atau `AuthContext` — keduanya masih dipakai.

---

## FASE H-2 — Perbaiki bug posisi gambar produk (isu H2)

**Masalah:** `uploadImages()` di `src/lib/actions/products.js` memulai `position` dari `0` setiap
kali. Saat `updateProduct` menambah foto ke produk yang sudah punya foto, foto baru memakai
`position` 0,1,... yang **bentrok** dengan foto lama → "foto utama" (position 0) ganda dan urutan
galeri kacau.

**Perbaikan:** mulai `position` dari `max(position)+1` yang sudah ada untuk produk itu.
```js
async function uploadImages(supabase, productId, files) {
  const urls = [];
  // Mulai dari posisi setelah foto yang sudah ada (penting untuk updateProduct)
  const { data: existing } = await supabase
    .from('product_images').select('position').eq('product_id', productId)
    .order('position', { ascending: false }).limit(1);
  let position = existing && existing.length ? existing[0].position + 1 : 0;

  for (const file of files) {
    if (!(file instanceof File) || file.size === 0) continue;
    const ext = ALLOWED[file.type];
    if (!ext) return { error: 'Format gambar harus JPG, PNG, atau WebP' };
    if (file.size > MAX_BYTES) return { error: 'Ukuran gambar maksimal 5 MB' };
    const base = (file.name || 'foto').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 40);
    const safeName = `${base.replace(/\.[^.]*$/, '')}.${ext}`;
    const path = `${productId}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await supabase.storage.from('product-images')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) return { error: 'Gagal mengunggah gambar' };
    const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path);
    await supabase.from('product_images').insert({ product_id: productId, url: publicUrl, position });
    urls.push(publicUrl);
    position++;
  }
  return { urls };
}
```
**Bonus (disarankan):** setelah menghapus gambar (deleteIds) atau menambah, **normalisasi ulang**
posisi 0..n agar selalu rapat (tidak ada lubang) dan foto utama selalu `position 0`. Buat helper:
```js
async function renumberImages(supabase, productId) {
  const { data } = await supabase.from('product_images')
    .select('id').eq('product_id', productId).order('position', { ascending: true });
  let i = 0;
  for (const img of data ?? []) { await supabase.from('product_images').update({ position: i++ }).eq('id', img.id); }
}
```
Panggil `renumberImages` di akhir `updateProduct` (setelah tambah/hapus). Tambahkan juga UI admin
untuk **set foto utama** (opsional; lihat `12-...` admin enhancements).

**Acceptance H-2:**
- [ ] Tambah produk dgn 3 foto → posisi 0,1,2; foto[0] jadi utama di kartu/detail.
- [ ] Edit produk, tambah 2 foto lagi → posisi lanjut 3,4 (tidak bentrok); foto utama tetap.
- [ ] Hapus satu foto → posisi dirapikan 0..n (tidak ada lubang), foto utama tetap valid.
- [ ] `npm run build` hijau.

---

## FASE H-3 — Validasi input `login()` (isu H3) + konsistensi auth

**Masalah:** `login()` tak memakai `LoginSchema` (skema ada di `validation.js` tapi menganggur).

**Perbaikan** di `src/lib/actions/auth.js`:
```js
import { LoginSchema, RegisterSchema } from '@/lib/validation';

export async function login(prevState, formData) {
  const parsed = LoginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, password } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: 'Email atau password salah' };  // pesan generik (anti user-enumeration)
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  revalidatePath('/', 'layout');
  redirect(profile?.role === 'admin' ? '/admin' : '/');
}
```
> Pesan error login & register harus **generik** ("Email atau password salah") agar tidak
> membocorkan apakah suatu email terdaftar (anti user-enumeration). Lihat `11-...` Auth Hardening.

**Acceptance H-3:**
- [ ] Login dengan email kosong/format salah → ditolak dengan pesan validasi sebelum hit Supabase.
- [ ] Pesan gagal login generik (tidak membedakan "email tidak ada" vs "password salah").
- [ ] `npm run build` hijau.

---

## FASE H-4 — Re-sync keranjang dengan DB (isu H4)

**Masalah:** Keranjang menyimpan snapshot `price`/`name`/`stock`/`image` di localStorage. Jika
admin mengubah/menghapus produk atau produk **terjual** (oleh orang lain), keranjang menampilkan
data basi. Checkout tetap aman (harga dari DB via RPC; RPC menolak item tak tersedia), tetapi UI
menyesatkan dan user bisa kaget saat checkout gagal.

**Perbaikan — validasi keranjang saat dibuka (Cart & Checkout):**
1. Tambah Server Action `validateCart` di `src/lib/actions/orders.js` (atau `cart.js` baru):
   ```js
   export async function validateCart(itemIds) {
     // itemIds: array uuid produk di keranjang
     const ids = z.array(z.string().uuid()).safeParse(itemIds);
     if (!ids.success) return { items: [] };
     const supabase = await createClient();
     const { data } = await supabase.from('products')
       .select('id, name, price, stock, status, product_images(url, position)')
       .in('id', ids.data);
     // kembalikan status terkini tiap produk untuk dipakai UI
     return { items: (data ?? []).map(p => ({
       id: p.id, name: p.name, price: p.price, stock: p.stock,
       available: p.status === 'available' && p.stock > 0,
       image: (p.product_images ?? []).sort((a,b)=>a.position-b.position)[0]?.url ?? null,
     })) };
   }
   ```
2. Di `cart/page.js` & `checkout/page.js` (client): saat mount, panggil `validateCart(items.map(i=>i.id))`,
   lalu:
   - Perbarui harga/nama/stok item agar sesuai DB (dispatch `UPDATE` ke CartContext, atau tampilkan
     harga terbaru).
   - Tandai/disable item yang `available === false` ("Barang sudah terjual") dan beri tombol "Hapus".
   - Nonaktifkan tombol Checkout bila ada item tak tersedia; minta user membersihkan dulu.
3. Tambahkan reducer `SYNC_ITEMS` di `CartContext` untuk memperbarui field item dari hasil validasi
   (tanpa mengubah `quantity` yang masih valid, clamp ke `stock` baru).

**Acceptance H-4:**
- [ ] Buka keranjang setelah produk di-update harga di admin → harga di keranjang ikut terbaru.
- [ ] Produk yang terjual orang lain → di keranjang tampil "Terjual" & checkout diblok sampai dihapus.
- [ ] Checkout tidak pernah "gagal misterius" karena UI sudah mencegah item tak tersedia.
- [ ] `npm run build` hijau.

---

## FASE H-5 — Auto-cancel order kedaluwarsa (isu H5) + lepas stok

**Masalah:** Order `unpaid` yang ditinggalkan menahan stok (barang unik jadi tak terbeli selamanya).

**Perbaikan (DB + cron):** buat migrasi `docs/plan/v2/sql/v2_0001_orders_expiry.sql`:
```sql
-- Tambah batas waktu bayar
alter table public.orders add column if not exists expires_at timestamptz;

-- Set default expiry saat order dibuat: ubah create_order agar mengisi expires_at = now() + interval.
-- (Edit fungsi create_order: pada INSERT orders, tambahkan kolom expires_at = now() + interval '2 hours'.)

-- Fungsi: batalkan semua order unpaid yang lewat waktu, kembalikan stok.
create or replace function public.expire_unpaid_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_count integer := 0;
begin
  for v_order in
    select id from public.orders
    where payment_status = 'unpaid' and status <> 'Dibatalkan'
      and expires_at is not null and expires_at < now()
  loop
    -- pakai logika cancel_order tapi tanpa cek auth (ini dipanggil sistem/cron)
    update public.products p
      set stock = stock + oi.quantity, status = 'available'
      from public.order_items oi
      where oi.order_id = v_order.id and oi.product_id = p.id;
    update public.orders set status = 'Dibatalkan', payment_status = 'expired' where id = v_order.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function public.expire_unpaid_orders() from public, anon, authenticated;
```
**Pemicu cron (pilih satu):**
- **Supabase pg_cron** (disarankan, paling sederhana): di SQL Editor jalankan sekali:
  ```sql
  select cron.schedule('expire-unpaid-orders', '*/15 * * * *', $$ select public.expire_unpaid_orders(); $$);
  ```
  (Aktifkan extension `pg_cron` di Database → Extensions bila belum.)
- **ATAU Vercel Cron** → Route Handler `src/app/api/cron/expire-orders/route.js` yang dilindungi
  header rahasia `CRON_SECRET` dan memanggil RPC via service-role. (Lihat `13-...` untuk pola cron.)

Juga: ubah `create_order` (di migrasi ini, `create or replace function`) agar INSERT order
menyertakan `expires_at = now() + interval '2 hours'` (atau durasi yang diinginkan).

**Acceptance H-5:**
- [ ] Order `unpaid` punya `expires_at`.
- [ ] Setelah lewat waktu + cron berjalan → order jadi `Dibatalkan`/`expired`, stok produk kembali
      `available`.
- [ ] Order yang sudah `paid` tidak pernah di-expire.

---

## FASE H-6 — State error/loading/empty yang konsisten (isu H6)

**Langkah:**
1. Tambah `error.js` (Client Component, butuh `'use client'`) di segmen yang fetch dari Supabase:
   minimal `src/app/error.js` (global) dan `src/app/shop/error.js`, `src/app/product/[id]/error.js`,
   `src/app/admin/error.js`. Pola:
   ```js
   'use client';
   export default function Error({ error, reset }) {
     return (
       <div className="container section"><div className="empty-state">
         <h3>Terjadi kesalahan</h3>
         <p className="text-muted">Coba muat ulang halaman.</p>
         <button className="btn btn-primary" onClick={() => reset()}>Coba Lagi</button>
       </div></div>
     );
   }
   ```
2. Pastikan `loading.js` ada untuk rute yang fetch (Home/Shop/Detail/Admin) → skeleton sederhana
   (cek file `src/app/loading.js` yang sudah ada; tambah per-segmen bila perlu).
3. DAL (`@/lib/data/*`): saat ini melempar `throw error`. Di Server Component, error akan tertangkap
   `error.js`. Pastikan pesan tidak membocorkan detail internal ke user (log detail ke server via
   `console.error`, tampilkan pesan generik).
4. Empty states: pastikan daftar kosong (produk/pesanan/kategori) menampilkan `empty-state` yang
   ada, bukan layar kosong.

**Acceptance H-6:**
- [ ] Mematikan/mis-config Supabase sementara → halaman menampilkan UI error (bukan crash putih).
- [ ] Navigasi ke produk yang tidak ada → `not-found` (sudah ada) tampil.
- [ ] Rute yang fetch punya `loading` skeleton.

---

## FASE H-7 — Konsistensi & pembersihan menyeluruh

**Langkah (checklist quality, terapkan `code-review-and-quality` + `code-simplification`):**
1. **Konsistensi `maybeSingle` vs `single`:** cari `.single()` pada query yang bisa kosong:
   ```bash
   grep -rn "\.single()" src/lib
   ```
   - `createOrder` memakai `.select('total').eq('id', orderId).single()` — aman (baris pasti ada
     setelah insert), boleh tetap.
   - Untuk query lain yang bisa 0 baris → ganti `maybeSingle()`.
2. **Pesan error generik & tidak bocor:** semua Server Action mengembalikan `{ error: '<pesan
   ramah>' }`; detail teknis hanya `console.error` di server. Audit string error agar tidak
   membocorkan SQL/Supabase internals (mis. `categories` "duplicate" sudah ditangani).
3. **Hapus `console.log` debug** yang tersisa; sisakan `console.error` yang berarti.
4. **Lint bersih:** `npm run lint` → perbaiki error & warning penting (unused imports, dep arrays
   `useEffect`).
5. **Aksesibilitas cepat (lengkap di `12-...`):** pastikan tombol ikon punya `aria-label`; modal
   admin punya `role="dialog"`/`aria-modal`/Escape. (Bila belum, tandai untuk fase a11y.)
6. **`next/image` di semua gambar produk** (kartu, detail, thumbnail admin) — bukan `<img>` mentah.
   Cek host Supabase ada di `next.config.mjs > images.remotePatterns`.
7. **Cek dependency array & `revalidatePath`:** tiap mutasi memanggil `revalidatePath` untuk semua
   halaman yang menampilkan data tersebut (sebagian sudah; verifikasi kategori → Home/Shop, produk
   → Home/Shop/detail/admin, order → profile/admin).

**Acceptance H-7:**
- [ ] `npm run lint` bersih (atau hanya warning yang disepakati).
- [ ] Tidak ada `.single()` pada query yang bisa kosong.
- [ ] Tidak ada `console.log` debug tersisa.
- [ ] Semua gambar produk via `next/image`.
- [ ] `npm run build` hijau.

---

## FASE H-8 — Verifikasi regresi menyeluruh (gerbang sebelum lanjut)

Jalankan smoke test manual (atau Playwright bila sudah ada — `13-...`):
- [ ] Anonim: Home/Shop/Detail tampil dengan gambar; filter & sort Shop bekerja.
- [ ] Register → login → Navbar menampilkan nama; logout.
- [ ] Tambah ke keranjang (cap stok jalan) → checkout → redirect Pakasir (sandbox) → webhook →
      order `paid`; produk jadi "Terjual".
- [ ] Admin: CRUD produk (upload foto, posisi benar) + kategori + ubah status order + kelola akun.
- [ ] Customer akses `/admin` → ditolak.
- [ ] Order unpaid → setelah expiry+cron → stok kembali.

**Acceptance H-8 (GERBANG):** semua di atas lulus + `npm run build` hijau. Baru lanjut ke
`11-security-hardening.md`.
