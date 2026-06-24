# 04 — Deployment (Vercel), Keamanan & Testing

---

## FASE 8 — Keamanan & Deployment ke Vercel

Skill: `security-and-hardening` (baca `references/security-checklist.md`), `shipping-and-launch`,
`observability-and-instrumentation`.

### 8.1 Checklist keamanan (lakukan sebelum deploy)
- [ ] **Tidak ada secret di client.** Cari di seluruh `src/`: pastikan `SUPABASE_SERVICE_ROLE_KEY`
      dan `PAKASIR_API_KEY` tidak pernah diimport di file `'use client'`/Client Component. Hanya
      `admin.js` & `payments/pakasir.js` (server-only) yang memakainya.
- [ ] **Webhook Pakasir tidak dipercaya mentah.** `/api/webhooks/pakasir` SELALU verifikasi ulang
      via Transaction Detail API + cocokkan `amount` dengan `order.total`; idempoten; pakai service-role.
- [ ] **Setiap Server Action sensitif** memanggil `requireAuth()`/`requireAdmin()` di baris awal.
      Ingat: Server Action bisa dipanggil via POST langsung, bukan cuma dari UI.
- [ ] **RLS aktif** di semua tabel (sudah, Fase 1). Jangan pakai service-role untuk operasi yang
      seharusnya tunduk RLS.
- [ ] **Validasi input** (Zod) di semua action; jangan percaya `FormData`.
- [ ] **Tidak membocorkan error internal** ke user (pesan generik; log detail di server).
- [ ] **Cookie sesi httpOnly/secure** ditangani `@supabase/ssr` — jangan menyimpan token di
      localStorage.
- [ ] **`.env.local` tidak ter-commit.** Cek `.gitignore`.
- [ ] (Opsional) tambah **Content-Security-Policy** header (lihat
      `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`).

### 8.2 Persiapan deploy
- Pastikan `package.json` scripts: `dev`/`build`/`start` tanpa flag `--turbopack` (default v16).
- `npm run build` lokal **harus sukses**.
- Jalankan `npm run lint` (ESLint langsung; `next lint` sudah dihapus di v16) dan bersihkan warning
  penting.

### 8.3 Deploy ke Vercel
1. Push repo ke GitHub (init git bila belum: minta izin pemilik sebelum commit).
2. Vercel → **New Project** → import repo. Framework auto-detect **Next.js**. Build command default
   (`next build`) sudah benar.
3. **Environment Variables** di Vercel (Project Settings → Environment Variables), set untuk
   Production **dan** Preview:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (Sensitive)
   - `NEXT_PUBLIC_SITE_URL` = URL produksi Vercel/domain kustom
   - `PAKASIR_SLUG`
   - `PAKASIR_API_KEY` (Sensitive)
4. **Supabase Auth config:** tambahkan domain Vercel ke **Site URL** & **Redirect URLs**
   (Authentication → URL Configuration). Tanpa ini, redirect/email auth gagal di produksi.
4b. **Pakasir config:** di Proyek Pakasir, isi **Webhook URL** = `https://<domain>/api/webhooks/pakasir`.
   Saat sudah live & teruji, ubah proyek dari Sandbox ke mode produksi. Pastikan `NEXT_PUBLIC_SITE_URL`
   benar agar `redirect` ke `/checkout/success` berfungsi.
5. **`next.config.mjs` `images.remotePatterns`** sudah memuat host Supabase (Fase 2) — tetap valid
   di produksi.
6. Deploy. Setelah live, jalankan **smoke test** (§9.3) di URL produksi.

### 8.4 Pasca-deploy
- Aktifkan **Vercel Analytics** (opsional) untuk Core Web Vitals.
- Pantau log Server Action/Route Handler di Vercel → Functions logs.
- Cek **Supabase → Logs** untuk error RLS/SQL.

**Acceptance Fase 8:**
- [ ] Build Vercel sukses; situs live.
- [ ] Login/register/checkout berfungsi di URL produksi.
- [ ] Gambar produk tampil (remotePatterns benar).
- [ ] Checklist keamanan §8.1 tercentang.

---

## FASE 9 — Testing & Verifikasi

Skill: `test-driven-development`. Docs Next.js testing:
`node_modules/next/dist/docs/01-app/02-guides/testing/` (vitest/jest/playwright).

### 9.1 Unit test (logika murni) — prioritas tertinggi
Pakai **Vitest** (ringan untuk Next 16). Install:
```bash
npm install -D vitest @testing-library/react @testing-library/dom jsdom
```
Test yang WAJIB ada (tulis test-first sesuai TDD untuk logika kritis):
- `helpers.test.js`: `calculateDiscount` (termasuk guard B8: originalPrice 0/≤price → 0),
  `formatCurrency`.
- `cart-reducer.test.js`: qty tidak melebihi stok; clamp min 1; preloved stok-1 tetap 1 (B1).

### 9.2 Test logika DB (checkout) — di Supabase
Karena `create_order` adalah RPC, uji di SQL Editor / skrip:
- Buat order untuk produk available → sukses, stok berkurang, status `sold` saat habis.
- Order ulang produk yang sudah `sold` → **error** (tidak membuat order).
- (Manual) dua sesi paralel atas stok-1 → satu sukses satu gagal (FOR UPDATE).

### 9.3 Smoke test end-to-end (manual atau Playwright)
Checklist alur (jalankan di dev & produksi):
- [ ] Anonim: buka Home, Shop, Detail → gambar & data tampil.
- [ ] Register user baru → otomatis login → muncul di Navbar.
- [ ] Tambah ke keranjang → checkout → order dibuat → redirect ke Pakasir.
- [ ] (Sandbox) simulasikan pembayaran → webhook → order jadi `paid` → /checkout/success "berhasil".
- [ ] Webhook palsu dgn amount berbeda → DITOLAK (order tetap `unpaid`).
- [ ] Produk yang dibeli jadi "Terjual" & tak bisa dibeli lagi; order batal → stok kembali.
- [ ] Login admin → tambah produk + upload foto → muncul di Shop.
- [ ] Admin ubah status pesanan → customer lihat status baru.
- [ ] Customer mencoba buka `/admin` → ditolak/redirect.
- [ ] Logout → sesi hilang.

### 9.4 Verifikasi keamanan (uji negatif)
- [ ] Logout, lalu coba panggil Server Action admin (mis. via memanggil dari konsol/replay POST) →
      ditolak.
- [ ] Customer query order milik orang lain (via Supabase client di konsol) → kosong (RLS).
- [ ] Customer coba `update profiles set role='admin'` → gagal (trigger).

---

## CHECKLIST AKHIR PROYEK (master)

Salin ini ke PR/issue penutup dan centang semuanya:

**Data & Auth**
- [ ] Semua produk/kategori/order/akun di Postgres; tidak ada localStorage utk entitas ini.
- [ ] Supabase Auth: login/register/logout/sesi cookie; admin di-seed; role via `profiles`.
- [ ] RLS aktif & teruji (uji positif + negatif).

**Fitur**
- [ ] Katalog menampilkan gambar nyata (kartu + detail).
- [ ] Admin CRUD produk/kategori + upload Storage.
- [ ] Checkout atomik aman (stok, snapshot harga, anti double-sell).
- [ ] Pembayaran Pakasir: redirect bayar, webhook terverifikasi (Transaction Detail API), order
      `paid`, stok dilepas saat batal/expired. Secret `PAKASIR_API_KEY` server-only.
- [ ] Admin kelola pesanan (ubah status); customer lihat riwayat & status.
- [ ] Akun: admin melihat semua user; tambah/hapus admin (service-role, server-only).

**Kualitas & Next.js 16**
- [ ] `proxy.js` (bukan middleware), `await cookies()`, `await params` di server.
- [ ] `images.remotePatterns` (bukan `domains`).
- [ ] `useSearchParams` dibungkus Suspense; tidak ada setState-saat-render.
- [ ] A11y modal/tombol diperbaiki; `loading`/`not-found` ada.
- [ ] Unit test (helpers, cart reducer) hijau; smoke test lulus.
- [ ] `npm run build` & deploy Vercel sukses.

**Backlog v2 (dicatat, TIDAK dikerjakan di v1)**
- Ongkir nyata (RajaOngkir/Biteship), wishlist, ulasan/rating, alur jual/konsinyasi user,
  notifikasi email/WhatsApp pesanan, cron auto-cancel order `unpaid` kedaluwarsa, filter Shop
  lanjutan, halaman statis (FAQ/Cara Belanja/Pengembalian/Kontak) untuk link Footer.
  (Payment gateway sudah masuk v1 via **Pakasir**, Fase 6B.)

---

Selesai. Mulai dari `README.md` → kerjakan Fase 1 → 9 berurutan. Jangan lewati acceptance criteria.
