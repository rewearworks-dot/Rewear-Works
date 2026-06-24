# 13 — Testing, CI & Launch

Tujuan: bukti bahwa semuanya bekerja & aman, otomatisasi mutu, lalu rilis terkendali. Terapkan
`test-driven-development`, `ci-cd-and-automation`, `shipping-and-launch`,
`observability-and-instrumentation`.

---

## FASE T-1 — Strategi & setup testing

**Tingkatan uji (piramida):**
1. **Unit** (Vitest) — logika murni & util. Cepat, banyak.
2. **Integration** — Server Actions & DAL terhadap Supabase (gunakan project Supabase **staging**
   terpisah atau Supabase lokal via CLI). Sedang.
3. **E2E** (Playwright) — alur user kritis di browser. Sedikit, mahal.
4. **DB/RLS** — uji policy & RPC langsung di Postgres (SQL).

**Setup:**
```bash
npm install -D vitest @testing-library/react @testing-library/dom jsdom @vitejs/plugin-react
npm install -D @playwright/test
```
Tambah script `package.json`:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:e2e": "playwright test"
```
Buat `vitest.config.js` (environment jsdom untuk komponen, node untuk util/logika).

---

## FASE T-2 — Unit test (WAJIB untuk logika kritis)

Tulis test untuk:
1. `src/utils/helpers.test.js`:
   - `calculateDiscount`: normal, `originalPrice=0` → 0, `price>=originalPrice` → 0 (guard B8).
   - `formatCurrency`: format Rupiah benar (tanpa desimal).
2. `src/context/cartReducer.test.js` (ekstrak reducer agar dapat diuji murni):
   - `ADD_ITEM` tidak melebihi `stock` (preloved stok 1 → qty tetap 1).
   - `UPDATE_QUANTITY` clamp `[1, stock]`.
   - `REMOVE_ITEM`, `CLEAR_CART` benar.
3. `validation.test.js`:
   - `OrderSchema` menolak `quantity < 1`, `product_id` non-uuid, items kosong.
   - `ProductSchema` koersi harga, menolak harga negatif, `category_id` wajib uuid.
   - `RegisterSchema`/`LoginSchema` menolak email/pw tidak valid; password ≥ 8 (setelah S-5).

**Acceptance T-2:** `npm test` hijau; cabang logika kritis (stok, diskon, validasi) tercakup.

---

## FASE T-3 — Uji DB/RLS & RPC (SQL, di staging)

Jalankan skenario sebagai role berbeda (gunakan `set local role` / sesi anon vs authenticated, atau
Supabase test users). Verifikasi:
- `create_order`: harga dari DB; stok berkurang; `sold` saat habis; **dua eksekusi paralel atas
  stok-1 → satu sukses, satu gagal** (FOR UPDATE).
- `cancel_order`: kembalikan stok; tolak bila sudah `paid`; idempoten.
- `expire_unpaid_orders`: hanya unpaid kedaluwarsa; stok kembali; tidak menyentuh paid.
- `set_user_role`: hanya admin (is_admin) berhasil; non-admin gagal.
- RLS matrix (lihat `11-...` S-12): customer tak bisa lihat order orang lain; tak bisa CRUD produk;
  tak bisa ubah role; admin bisa semua; review hanya pembeli.

**Acceptance T-3:** semua skenario DB lulus, terdokumentasi (mis. di `docs/plan/v2/sql/tests.sql`).

---

## FASE T-4 — E2E (Playwright) untuk alur kritis

Skenario minimum (jalankan di dev + preview):
1. **Belanja → checkout → bayar (sandbox) → lunas:** register/login, tambah ke keranjang, checkout,
   redirect Pakasir (sandbox), simulasi pembayaran (API simulation), kembali ke success, order
   `paid`, produk jadi "Terjual".
2. **Auth:** register, logout, login, lupa password (cek email terkirim — mock/log), reset.
3. **Admin:** login admin, tambah produk + upload foto, muncul di Shop, ubah status order.
4. **Otorisasi:** customer akses `/admin` → ditolak; akses order orang lain → ditolak.
5. **Wishlist & review:** favoritkan; tulis ulasan sebagai pembeli; non-pembeli tidak bisa.

**Acceptance T-4:** semua skenario hijau di CI (headless).

---

## FASE T-5 — CI/CD (GitHub Actions)

Buat `.github/workflows/ci.yml`:
- Trigger: push & PR ke `main`.
- Steps: `npm ci` → `npm run lint` → `npm test` → `npm run build` → (opsional) `npm audit
  --audit-level=high` → (opsional) Playwright e2e dengan Supabase staging.
- Gunakan secrets GitHub untuk env staging (jangan secret produksi di CI publik).
- **Branch protection:** merge ke `main` hanya bila CI hijau.

Deploy: Vercel auto-deploy dari `main` (produksi) & PR (preview). Pastikan env Vercel lengkap.

**Acceptance T-5:** PR menjalankan lint+test+build; merge diblok bila merah; deploy preview/produksi
otomatis.

---

## FASE T-6 — Cron auto-cancel (sambungan H-5)

Bila memakai **Vercel Cron** (alih-alih pg_cron):
1. `src/app/api/cron/expire-orders/route.js` (GET):
   ```js
   import { NextResponse } from 'next/server';
   import { createAdminClient } from '@/lib/supabase/admin';
   export async function GET(request) {
     const auth = request.headers.get('authorization');
     if (auth !== `Bearer ${process.env.CRON_SECRET}`) return new NextResponse('Unauthorized', { status: 401 });
     const supabase = createAdminClient();
     const { data, error } = await supabase.rpc('expire_unpaid_orders');
     if (error) return NextResponse.json({ ok: false }, { status: 500 });
     return NextResponse.json({ ok: true, expired: data });
   }
   ```
2. `vercel.json`:
   ```json
   { "crons": [{ "path": "/api/cron/expire-orders", "schedule": "*/15 * * * *" }] }
   ```
3. Env `CRON_SECRET` (server only). Vercel mengirim header authorization otomatis untuk cron;
   verifikasi `CRON_SECRET`.

**Acceptance T-6:** cron berjalan terjadwal; hanya bisa dipicu dengan secret; order kedaluwarsa
terbatalkan & stok kembali.

---

## FASE T-7 — Pre-launch checklist (gerbang produksi)

**Konfigurasi**
- [ ] Env produksi lengkap di Vercel (Supabase, Pakasir, email, Upstash/CRON, SITE_URL) — secret
      ditandai Sensitive.
- [ ] Supabase: Site URL & Redirect URLs = domain produksi; email confirm ON; SMTP/email siap.
- [ ] Pakasir: mode produksi; Webhook URL produksi (bertoken, S-6); domain redirect benar.
- [ ] `images.remotePatterns` memuat host Supabase produksi.

**Keamanan** (dari `11-...`)
- [ ] RLS semua tabel; uji negatif S-12 lulus; headers/CSP enforce; rate limit aktif; audit log;
      `npm audit` bersih; Privasi & S&K live.

**Fungsi** (dari `10-` & `12-`)
- [ ] Build & lint hijau; tidak ada kode mati (ProductContext dihapus).
- [ ] Alur belanja→bayar→lunas; reset password; order detail; search/filter; wishlist; review;
      notifikasi; SEO (sitemap/robots/OG); halaman statis; a11y ≥ 90.

**Operasional**
- [ ] Monitoring (Vercel Analytics + Supabase logs + opsional Sentry) aktif.
- [ ] Backup DB: pastikan Supabase backup aktif (paket terkait). Dokumentasikan restore.
- [ ] Akun admin produksi dibuat (password kuat, MFA bila ada). Hapus akun/seed dummy.

**Acceptance T-7:** seluruh checklist tercentang.

---

## FASE T-8 — Launch & rollback

1. **Staging dulu:** deploy ke preview/staging, jalankan smoke test (T-4) + uji pembayaran sandbox.
2. **Go-live:** promote ke produksi (merge `main`). Pantau Functions logs & error 30–60 menit
   pertama.
3. **Smoke test produksi:** 1 transaksi nyata kecil (atau sandbox bila Pakasir mendukung) end-to-end.
4. **Rollback:** bila ada masalah serius, gunakan **Vercel Instant Rollback** ke deployment
   sebelumnya. Untuk perubahan DB, simpan migrasi reversibel/catatan rollback (jangan drop kolom
   berisi data tanpa backup). Komunikasikan downtime bila ada.
5. **Post-launch:** pantau metrik (error rate, pembayaran gagal, Web Vitals) hari pertama; siapkan
   hotfix branch bila perlu.

**Acceptance T-8:** rilis sukses, smoke test produksi lulus, prosedur rollback terdokumentasi &
teruji (minimal di staging).

---

## CHECKLIST MASTER v2 (untuk PR/issue penutup)

**Hardening (10-)**
- [ ] ProductContext & data JSON yatim dihapus; bug posisi gambar fix; login Zod; cart re-sync;
      auto-expire order; error/loading states; lint & build hijau; regresi smoke lulus.

**Keamanan (11-)**
- [ ] RLS re-audit; headers+CSP; rate limit; auth hardening (verify email, reset, pw≥8, MFA admin);
      webhook bertoken; upload magic-bytes+re-encode; secret server-only; validasi & anti-XSS/redirect;
      audit log; npm audit; uji negatif S-12 lulus.

**Fitur (12-)**
- [ ] Reset/ganti password; akun & address book; order detail+tracking; search & filter;
      SEO (sitemap/robots/OG/JSON-LD); halaman statis + footer; notifikasi email/WA; a11y ≥ 90;
      wishlist; review (pembeli); inventori admin; (opsional) voucher, banner, performa, PWA.

**Testing & Launch (13-)**
- [ ] Unit + DB/RLS + E2E hijau; CI aktif & memblok merah; cron expiry; pre-launch checklist;
      launch + rollback teruji.

Selesai — Rewear Works menjadi marketplace lengkap, stabil, dan aman.
