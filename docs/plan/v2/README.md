# Rewear Works — Plan v2 (Penyempurnaan: Hardening, Keamanan, Kelengkapan Fitur)

> **Untuk worker agent.** Backend v1 (Supabase + Vercel + Pakasir) sudah diimplementasikan.
> Plan v2 ini menyempurnakan: (1) **stabilisasi kode** (perbaiki bug & inkonsistensi yang akan
> meledak di produksi), (2) **keamanan tingkat marketplace** (sangat aman), (3) **melengkapi
> SEMUA fitur** marketplace, lalu (4) **testing & launch**.
>
> Kerjakan **berurutan**, **fase demi fase**, **jangan melompat**. Tiap fase punya Acceptance
> Criteria — jangan lanjut sebelum tercentang & `npm run build` hijau.

---

## 0. Cara baca & urutan kerja (WAJIB)

| Urutan | File | Fokus |
|--------|------|-------|
| 1 | `README.md` (ini) | Aturan, audit kondisi saat ini, golden rules v2 |
| 2 | `10-code-hardening.md` | Perbaiki bug nyata, hapus kode mati, konsistensi, error/empty/loading state |
| 3 | `11-security-hardening.md` | RLS re-audit, headers/CSP, rate limit, webhook, auth, upload, abuse, audit log |
| 4 | `12-feature-completion.md` | Reset password, akun, order detail+tracking, wishlist, review, filter, search, SEO, notifikasi, voucher, dst |
| 5 | `13-testing-and-launch.md` | Unit/integration/e2e test, CI, QA matrix, launch & rollback |

> Dokumen v1 (`docs/plan/00..04`, `schema.sql`, `seed.sql`) tetap jadi rujukan dasar arsitektur.
> v2 **menambah** di atasnya. Bila ada konflik, v2 yang berlaku.

---

## 1. AUDIT KONDISI SAAT INI (hasil membaca `src/` setelah worker selesai)

### 1.1 Yang SUDAH benar (jangan diubah tanpa alasan)
- `src/lib/supabase/{client,server,admin}.js` — pola `@supabase/ssr` benar, `await cookies()`,
  service-role `server-only`.
- `src/proxy.js` + `src/lib/session.js` — refresh sesi + redirect optimistik benar (Next.js 16
  `proxy`, runtime nodejs).
- `src/lib/dal.js` — `getCurrentUser` (cache + `maybeSingle` + try/catch), `requireAuth`,
  `requireAdmin`. Benar.
- Semua Server Action (`auth/orders/products/categories/accounts`) memanggil
  `requireAuth`/`requireAdmin` dan memvalidasi input dengan Zod (`validation.js`). Benar.
- Checkout → `createOrder` (RPC `create_order`) → redirect ke Pakasir; webhook
  `/api/webhooks/pakasir` **verifikasi ulang** via Transaction Detail API + cek `amount` + idempoten.
  `cancelOrder`/`cancel_order` mengembalikan stok. `createAdmin` pakai `set_user_role` (trigger
  anti-escalation tidak dilemahkan). `deleteUser` guard diri sendiri + admin utama. Benar.
- `CartContext` sudah membatasi qty ≤ stok (fix B1).

### 1.2 ISU NYATA yang ditemukan (harus diperbaiki — detail di `10-code-hardening.md`)

| ID | Severity | Lokasi | Masalah |
|----|----------|--------|---------|
| H1 | 🔴 | `src/app/layout.js` + `src/context/ProductContext.js` | **Kode mati**: `ProductProvider` masih membungkus seluruh app; `useProducts` sudah TIDAK dipakai di mana pun. ProductContext masih membaca/menulis `localStorage('rewear-store')` dari `products.json` tiap halaman → boros, membingungkan, sumber bug "data lama". Cleanup Fase 7 v1 belum tuntas. |
| H2 | 🔴 | `src/lib/actions/products.js` → `uploadImages` | **Bug posisi gambar**: `position` selalu mulai dari `0`. Saat **edit** produk lalu menambah foto, foto baru dapat `position 0,1,...` yang **bentrok** dengan foto lama → foto utama/urutan kacau. Harus lanjut dari `max(position)+1`. |
| H3 | 🟠 | `src/lib/actions/auth.js` → `login` | `login()` tidak memvalidasi input dengan `LoginSchema` (skema ada tapi tak dipakai). Inkonsistensi & input tak tervalidasi. |
| H4 | 🟠 | `src/context/CartContext.js` | Item keranjang menyimpan snapshot `price`/`name`/`stock` di localStorage. Bila admin ubah harga/stok, keranjang menampilkan data lama (checkout tetap aman karena harga dari DB via RPC, tapi UI menyesatkan). Perlu re-sync saat buka cart/checkout. |
| H5 | 🟠 | webhook & checkout | Order `unpaid` yang ditinggalkan **menahan stok selamanya** (barang unik jadi "hilang"). Belum ada auto-cancel kedaluwarsa. |
| H6 | 🟡 | global | Belum ada `error.js` per segmen yang fetch (kegagalan Supabase → error mentah). Cek cakupan `loading.js`/`not-found.js`. |
| H7 | 🟡 | `src/data/*.json` | `products.json`/`categories.json` masih diimport oleh `ProductContext` (terkait H1). Setelah H1 beres, file ini yatim. |

### 1.3 FITUR yang BELUM ADA (untuk "marketplace lengkap" — detail di `12-feature-completion.md`)
- Reset/lupa password & ganti password (Supabase Auth) — **tidak ada** halaman terkait.
- Halaman/d etail pesanan lengkap + lacak status (customer).
- Wishlist/favorit. Ulasan & rating produk.
- Filter Shop lanjutan (ukuran, kondisi, brand, rentang harga) + pencarian global.
- SEO: `generateMetadata` per produk, `sitemap`, `robots`, OG image, JSON-LD.
- Halaman statis (FAQ, Cara Belanja, Pengembalian, Kontak, Kebijakan Privasi, S&K) untuk link Footer.
- Notifikasi pesanan (email/WhatsApp), alamat tersimpan (address book).
- Manajemen inventori admin (stok rendah, riwayat), voucher/diskon (opsional), banner/CMS ringan.
- Auto-cancel order kedaluwarsa (cron), audit log admin.
- A11y pass menyeluruh, optimasi performa, PWA (opsional).

---

## 2. GOLDEN RULES v2 (tambahan atas v1)

1. **Jangan regresi.** Sebelum mengubah file, baca file itu utuh. Jangan menghapus fungsi yang
   masih dipakai. Setelah perubahan, `npm run build` HARUS hijau.
2. **Keamanan = server + RLS + validasi, bukan UI.** Setiap endpoint/aksi baru WAJIB:
   `requireAuth/requireAdmin` (sesuai peran) + validasi Zod + scope query ke pemilik. RLS adalah
   pertahanan terakhir dan diuji (lihat `11-...`).
2b. **Setiap fitur baru yang menyentuh tabel WAJIB punya kebijakan RLS** sebelum dianggap selesai.
   Tabel tanpa RLS = kebocoran data. Tidak ada pengecualian.
3. **Secret server-only.** `SUPABASE_SERVICE_ROLE_KEY`, `PAKASIR_API_KEY`, dan secret baru apa pun
   tidak boleh ada di Client Component / `NEXT_PUBLIC_`.
4. **Migrasi DB additif & idempoten.** Tulis perubahan skema sebagai file SQL baru di
   `docs/plan/v2/sql/` (mis. `v2_0001_xxx.sql`) dengan `if not exists` / `create or replace`.
   Jangan mengedit `schema.sql` v1 yang sudah dijalankan; tambahkan migrasi baru.
5. **Pertahankan desain visual.** Perbaikan ini soal fungsi/keamanan/kelengkapan. Komponen UI baru
   harus memakai token & className `globals.css` yang ada (lihat `frontend-ui-engineering`).
6. **JavaScript, bukan TypeScript.** Alias `@/*`. Format Rupiah/tanggal id-ID dipertahankan.
7. **Idempoten & aman-ulang.** Webhook, pembuatan order, pembayaran: aman bila dipanggil berkali-kali.
8. **Tulis test untuk logika kritis** (stok, pembayaran, otorisasi) — lihat `13-...`. Terapkan
   `test-driven-development` untuk perbaikan bug (tulis test yang gagal dulu, lalu perbaiki).

---

## 3. Pemetaan skill per area

| Area | Skill utama |
|------|-------------|
| Stabilisasi bug | `debugging-and-error-recovery`, `test-driven-development`, `code-simplification` |
| Hapus kode mati | `code-simplification`, `deprecation-and-migration` |
| Keamanan | `security-and-hardening` (+ `references/security-checklist.md`), `doubt-driven-development` |
| Desain API/aksi baru | `api-and-interface-design`, `source-driven-development` |
| Fitur UI | `frontend-ui-engineering`, `spec-driven-development` |
| Pemecahan tugas | `planning-and-task-breakdown`, `incremental-implementation` |
| Observability | `observability-and-instrumentation` |
| Rilis | `shipping-and-launch`, `ci-cd-and-automation` |
| Review akhir | `code-review-and-quality` |

---

## 4. Konvensi migrasi SQL v2

Buat folder `docs/plan/v2/sql/` dan tulis migrasi bernomor. Jalankan berurutan di Supabase SQL
Editor. Semua idempoten. Daftar migrasi (dibuat saat fase terkait):

- `v2_0001_orders_expiry.sql` — kolom `expires_at` + fungsi `expire_unpaid_orders()` (H5).
- `v2_0002_wishlist.sql` — tabel `wishlists` + RLS.
- `v2_0003_reviews.sql` — tabel `reviews` + RLS + agregat rating.
- `v2_0004_addresses.sql` — tabel `addresses` + RLS.
- `v2_0005_audit_log.sql` — tabel `audit_logs` + fungsi log.
- `v2_0006_vouchers.sql` — (opsional) tabel `vouchers` + validasi di RPC order.
- `v2_0007_product_search.sql` — index pencarian (pg_trgm / tsvector) untuk Shop.
- (tambah sesuai kebutuhan; selalu nomor urut & idempoten.)

Lanjut ke **`10-code-hardening.md`**.
