# 11 — Security Hardening (Marketplace-grade)

Tujuan: membuat Rewear Works **sangat aman**. Terapkan `security-and-hardening` (baca
`~/.claude/skills/security-and-hardening/references/security-checklist.md`) dan
`doubt-driven-development` (setiap kontrol keamanan diverifikasi dengan uji negatif).

> **Prinsip:** Defense in depth. Tiga lapis: (1) `proxy.js` optimistik, (2) Server Action/Route
> Handler cek sesi+peran+validasi, (3) **RLS Postgres** sebagai sumber kebenaran terakhir. Jangan
> pernah mengandalkan UI/client untuk keamanan.

> **Cara kerja fase ini:** untuk setiap kontrol, tulis **uji negatif** (percobaan jahat yang harus
> GAGAL) sebagai bukti. Daftar uji ada di akhir (§S-12).

---

## FASE S-1 — Model ancaman (baca dulu, 10 menit)

Aset & ancaman utama marketplace ini:

| Aset | Ancaman | Mitigasi (fase) |
|------|---------|------------------|
| Akun & sesi user | Pencurian sesi, brute force, user-enumeration, escalation ke admin | S-5 (auth), S-3 (headers), trigger `prevent_role_escalation` (v1) |
| Data order/PII (alamat, telp) | IDOR (lihat order orang lain), kebocoran via API | RLS (S-2), uji IDOR (S-12) |
| Uang/pembayaran | Manipulasi harga/jumlah, webhook palsu, double-spend | RPC harga-dari-DB (v1), webhook verifikasi (v1+S-6), idempoten |
| Stok barang unik | Double-sell, penimbunan via order spam | `FOR UPDATE` (v1), rate limit (S-4), expiry (H-5) |
| Storage gambar | Upload berbahaya (SVG/script), abuse kuota | Validasi (v1) + re-encode (S-7) |
| Endpoint admin/aksi | Akses tanpa izin, CSRF, langsung POST ke Server Action | requireAdmin (v1), origin check (S-3), RLS |
| Secret | Kebocoran service-role/API key ke client | S-8 |

---

## FASE S-2 — Re-audit RLS (pertahanan terakhir)

**Langkah:**
1. **Pastikan RLS aktif di SEMUA tabel** (termasuk tabel baru v2: wishlists, reviews, addresses,
   audit_logs, vouchers). Jalankan:
   ```sql
   select tablename, rowsecurity from pg_tables
   where schemaname='public';
   ```
   Setiap tabel publik HARUS `rowsecurity = true`. Tabel tanpa RLS = bug keamanan kritis.
2. **Tinjau setiap policy** terhadap matriks v1 (`docs/plan/02-database-and-rls.md` §C). Pastikan:
   - `products/categories/product_images`: SELECT publik; tulis admin.
   - `profiles`: select diri/admin; update diri/admin (role dijaga trigger); delete admin.
   - `orders/order_items`: select pemilik/admin; insert via RPC/own; update/delete admin.
3. **`grant execute` fungsi:** verifikasi hanya `authenticated` yang punya EXECUTE untuk
   `create_order`, `set_user_role`, `cancel_order`; `expire_unpaid_orders` **tidak** untuk siapa
   pun (hanya cron/service-role).
   ```sql
   select p.proname, array_agg(a.rolname) filter (where a.rolname is not null) as can_execute
   from pg_proc p
   left join lateral aclexplode(p.proacl) ax on true
   left join pg_roles a on a.oid = ax.grantee
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('create_order','set_user_role','cancel_order','expire_unpaid_orders')
   group by p.proname;
   ```
4. **SECURITY DEFINER hygiene:** semua fungsi DEFINER WAJIB `set search_path = public` (cegah
   search_path hijacking). Verifikasi `is_admin`, `handle_new_user`, `create_order`, `set_user_role`,
   `cancel_order`, `expire_unpaid_orders`, `prevent_role_escalation`.
5. **Storage policies:** bucket `product-images` → SELECT publik, tulis admin (`is_admin()`),
   tolak SVG di app (S-7). Verifikasi tidak ada policy yang mengizinkan `authenticated` umum menulis.

**Acceptance S-2:**
- [ ] Semua tabel publik (v1+v2) `rowsecurity=true` dengan policy yang benar.
- [ ] Hak EXECUTE fungsi sesuai (lihat §3).
- [ ] Semua fungsi DEFINER ber-`search_path=public`.
- [ ] Uji negatif RLS (S-12) lulus.

---

## FASE S-3 — HTTP Security Headers + CSP

**Tujuan:** lindungi dari clickjacking, MIME sniffing, kebocoran referrer, XSS.

**Langkah:** tambahkan header di `next.config.mjs` via `headers()`. Baca dulu
`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md` dan
`.../05-config/01-next-config-js/headers.md`.
```js
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // CSP: mulai report-only, lalu enforce setelah bersih dari pelanggaran.
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "img-src 'self' data: https://<PROJECT-REF>.supabase.co",
      "script-src 'self' 'unsafe-inline'",            // Next butuh inline; perketat dgn nonce bila bisa
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' https://<PROJECT-REF>.supabase.co https://app.pakasir.com",
      "frame-ancestors 'none'",
      "form-action 'self' https://app.pakasir.com",
      "base-uri 'self'",
    ].join('; '),
  },
];
const nextConfig = {
  images: { remotePatterns: [/* ...sudah ada... */] },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};
```
> **Catatan CSP:** Next.js menyuntik beberapa inline script. Idealnya gunakan **nonce via
> `proxy.js`** (lihat docs CSP) untuk menghapus `'unsafe-inline'` pada `script-src`. Tahap awal:
> deploy CSP sebagai `Content-Security-Policy-Report-Only`, periksa console untuk pelanggaran,
> baru jadikan enforce. `img-src`/`connect-src` harus memuat host Supabase; `form-action`/
> `connect-src` memuat `app.pakasir.com` (redirect bayar). Sesuaikan domain.

**Acceptance S-3:**
- [ ] Response header memuat semua header di atas (cek via DevTools/curl `-I`).
- [ ] Situs tidak bisa di-iframe (X-Frame-Options/frame-ancestors).
- [ ] CSP tidak memblok fungsi (gambar Supabase tampil, redirect Pakasir jalan). Mulai report-only.

---

## FASE S-4 — Rate limiting & anti-abuse

**Tujuan:** cegah brute-force login, spam register, order spam (penimbunan stok), webhook flooding.

**Pilihan implementasi (pilih satu, dokumentasikan):**

### Opsi A — Upstash Redis (disarankan untuk Vercel; serverless-friendly)
```bash
npm install @upstash/ratelimit @upstash/redis
```
Env: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (server only). Buat
`src/lib/ratelimit.js`:
```js
import 'server-only';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
const redis = Redis.fromEnv();
export const authLimiter   = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '10 m') });
export const orderLimiter  = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 h') });
export const webhookLimiter= new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '1 m') });
export async function limit(limiter, key) {
  const { success } = await limiter.limit(key);
  return success;
}
```

### Opsi B — Tabel Postgres (tanpa layanan eksternal)
Migrasi `v2_00xx_rate_limit.sql`: tabel `rate_limits(key text, window_start timestamptz, count int)`
+ fungsi `check_rate_limit(p_key text, p_max int, p_window interval) returns boolean` (SECURITY
DEFINER, atomik upsert). Panggil dari Server Action via service-role.

**Penerapan:**
- **Login/Register:** kunci = IP (`headers()` `x-forwarded-for`) + email. Lebih dari 5 gagal /10
  menit → tolak sementara ("Terlalu banyak percobaan, coba lagi nanti").
- **createOrder:** kunci = user id. Maks 10 order/jam (cegah penimbunan).
- **Webhook Pakasir:** kunci = IP. Batasi mis. 60/menit.
- **Upload gambar admin:** batasi jumlah/ukuran per request (sudah ada MAX_BYTES; tambah maks 5
  file/produk).

> Ambil IP di Server Action via `import { headers } from 'next/headers'; const ip = (await
> headers()).get('x-forwarded-for')?.split(',')[0] ?? 'unknown';`. Di Vercel header ini tepercaya.

**Bonus — CAPTCHA:** aktifkan **Supabase Auth CAPTCHA** (hCaptcha/Turnstile) di Dashboard untuk
login/register guna meredam bot (Authentication → Settings → Bot and Abuse Protection). Tambahkan
widget Turnstile di form login/register dan kirim token.

**Acceptance S-4:**
- [ ] >5 login gagal beruntun dari satu IP → diblok sementara.
- [ ] >10 createOrder/jam per user → ditolak.
- [ ] Webhook flooding → di-throttle.
- [ ] (Opsional) CAPTCHA aktif di login/register.

---

## FASE S-5 — Auth hardening

**Langkah:**
1. **Email verification ON di produksi.** (v1 mematikannya untuk dev.) Aktifkan "Confirm email"
   di Supabase. Pastikan `/auth/callback` menangani `code` dan `token_hash`/`verifyOtp` (cek
   `src/app/auth/callback/route.js` — sudah ada) dan `register` mengarahkan ke "cek email" saat
   `data.session` null (sudah ada). Tambah halaman info `/register?check-email=1`.
2. **Reset password** (lihat juga `12-...` fitur): aksi `requestPasswordReset(email)` →
   `supabase.auth.resetPasswordForEmail(email, { redirectTo: SITE/reset-password })`; halaman
   `/reset-password` memanggil `supabase.auth.updateUser({ password })`. Pesan generik (jangan
   bocorkan apakah email terdaftar).
3. **Kebijakan password:** minimal 8 karakter (naikkan dari 6) + cek "password lemah". Set juga di
   Supabase Auth (Password requirements) bila tersedia, dan di Zod (`min(8)`).
4. **Anti user-enumeration:** semua pesan auth generik (login gagal, reset password, register email
   sudah ada → pertimbangkan pesan netral "Jika email terdaftar, kami kirim instruksi").
5. **Session & cookie:** `@supabase/ssr` sudah httpOnly/secure. Pastikan `Secure` aktif di
   produksi (HTTPS Vercel). Set durasi sesi & refresh wajar di Supabase (JWT expiry).
6. **MFA untuk admin (disarankan):** aktifkan Supabase MFA (TOTP) dan wajibkan untuk akun admin.
   Minimal: dokumentasikan langkah enroll; idealnya cek `aal2` untuk rute `/admin` di `requireAdmin`.
7. **Logout menyeluruh:** `signOut({ scope: 'global' })` opsional untuk keluar dari semua device.
8. **Proteksi `set_user_role`:** hanya admin (sudah, via is_admin di RPC). Tidak ada jalur lain
   menaikkan role.

**Acceptance S-5:**
- [ ] Email verification jalan di produksi (callback + cek-email page).
- [ ] Reset password end-to-end berfungsi; pesan generik.
- [ ] Password minimal 8 karakter ditegakkan (Zod + Supabase).
- [ ] (Disarankan) MFA admin aktif/terdokumentasi.

---

## FASE S-6 — Hardening webhook Pakasir

**Kondisi v1:** webhook memverifikasi ulang via Transaction Detail API + cek `amount` + idempoten.
Bagus. Tambahan hardening:
1. **Rahasia di URL webhook:** isi Webhook URL di Pakasir dengan path bertoken, mis.
   `/api/webhooks/pakasir?token=<RANDOM_SECRET>` atau path tebak-sulit
   `/api/webhooks/pakasir/<RANDOM>`. Di handler, tolak bila token ≠ `process.env.PAKASIR_WEBHOOK_SECRET`.
   (Lapisan tambahan; verifikasi API tetap utama.)
2. **Rate limit** (S-4) pada endpoint webhook.
3. **Validasi bentuk body** dengan Zod sebelum proses; tolak yang tidak sesuai (sudah cek
   `order_id`/`amount`; tambah `status`, `project` opsional).
4. **Hanya proses transisi unpaid→paid.** Jangan pernah menurunkan status dari paid. (Sudah
   idempoten; pertahankan.)
5. **Log setiap webhook** (lihat S-10 audit/log) untuk forensik: order_id, amount, hasil verifikasi.
6. **Jangan bocorkan** info di response (200/202 ringkas). Jangan kembalikan data order.
7. **Timeout & retry aman:** verifikasi API pakai `cache: 'no-store'` (sudah). Pastikan kegagalan
   jaringan → 202 (Pakasir akan retry), bukan menandai paid.

**Acceptance S-6:**
- [ ] Webhook tanpa token rahasia yang benar → ditolak.
- [ ] Webhook dgn amount tidak cocok / status bukan completed → tidak menandai paid.
- [ ] Webhook ganda → idempoten (tidak ada efek dobel).
- [ ] Setiap webhook tercatat di log.

---

## FASE S-7 — Keamanan upload & konten

**Kondisi v1:** MIME allowlist (jpeg/png/webp), tolak SVG, max 5MB, nama disanitasi, path UUID.
Tambahan:
1. **Validasi MIME sebenarnya (magic bytes), bukan hanya `file.type`.** `file.type` dari client
   bisa dipalsukan. Baca beberapa byte awal dan cek signature (JPEG `FF D8 FF`, PNG `89 50 4E 47`,
   WebP `RIFF....WEBP`). Tolak bila tidak cocok.
2. **Re-encode/strip metadata (disarankan):** proses gambar server-side (mis. `sharp`) untuk
   me-resize maksimum (mis. 1600px), strip EXIF (privasi/geotag), dan menormalkan ke webp/jpeg.
   Ini juga menetralkan payload tersembunyi.
   ```bash
   npm install sharp
   ```
   > Catatan Vercel: `sharp` didukung di runtime Node. Pastikan action berjalan di Node runtime.
3. **Batasi jumlah foto/produk** (mis. ≤ 5) dan total ukuran request.
4. **Content-Disposition & tipe penyajian:** bucket publik menyajikan apa adanya; karena SVG sudah
   ditolak dan file di-re-encode, risiko XSS via gambar minim. Jangan pernah mengizinkan
   `text/html`/`image/svg+xml`.
5. **Nama path:** sudah `productId/uuid-namafile.ext`. Pastikan `productId` adalah UUID milik
   produk yang sedang diedit (cek kepemilikan via requireAdmin + produk ada).

**Acceptance S-7:**
- [ ] File `.png` yang isinya HTML/script (MIME dipalsu) → ditolak (cek magic bytes).
- [ ] Gambar besar di-resize/normalisasi; EXIF dihapus.
- [ ] SVG & tipe non-allowlist ditolak.
- [ ] Maks 5 foto/produk ditegakkan.

---

## FASE S-8 — Manajemen secret & konfigurasi

**Langkah:**
1. **Audit kebocoran secret ke client:**
   ```bash
   grep -rn "SERVICE_ROLE\|PAKASIR_API_KEY\|service_role\|UPSTASH" src/app src/components src/context
   ```
   Hasil harus **nol** di file client. Service-role & API key hanya di `src/lib/supabase/admin.js`,
   `src/lib/payments/pakasir.js`, route webhook/cron, `src/lib/ratelimit.js`.
2. **`server-only` guard:** pastikan `admin.js`, `pakasir.js`, `dal.js`, `ratelimit.js` mengimport
   `server-only` (admin.js & pakasir.js sudah).
3. **Env di Vercel:** semua secret ditandai **Sensitive**. `.env.local` di `.gitignore`.
4. **Rotasi:** dokumentasikan cara rotasi service-role/API key bila bocor. Jangan commit `.env*`.
5. **Tidak ada secret di log/error** yang sampai ke client.

**Acceptance S-8:**
- [ ] grep di atas → nol di kode client.
- [ ] Semua modul secret ber-`server-only`.
- [ ] Tidak ada `.env*` ter-commit.

---

## FASE S-9 — Validasi input & proteksi injeksi/XSS/redirect

**Langkah:**
1. **Validasi server di SEMUA aksi/route** (sebagian besar sudah pakai Zod). Audit setiap Server
   Action & Route Handler baru → harus ada `safeParse`. Termasuk webhook & cron.
2. **SQL injection:** Supabase query builder & RPC param sudah parameterized. **Jangan** pernah
   merangkai string SQL dari input. RPC menerima argumen terikat — pertahankan.
3. **XSS:** React meng-escape default. **Larang `dangerouslySetInnerHTML`** untuk konten user
   (deskripsi produk, review, catatan). Bila perlu rich text → sanitasi dengan allowlist (mis.
   `DOMPurify` server-side) sebelum render. Cari:
   ```bash
   grep -rn "dangerouslySetInnerHTML" src
   ```
   Harus nol untuk konten user.
4. **Open redirect:** `/auth/callback` mensanitasi `next` (hanya path internal, tolak `//`).
   Verifikasi. Cek juga redirect Pakasir hanya ke `NEXT_PUBLIC_SITE_URL` kita.
5. **Mass assignment:** Server Action membentuk objek insert/update **secara eksplisit** (whitelist
   kolom), tidak menyebar `...formData`. Verifikasi `createProduct/updateProduct` (sudah eksplisit).
   Pastikan kolom sensitif (`role`, `payment_status`, `status`, `id`) tidak pernah diambil dari
   input form mentah.
6. **Validasi `video_url`:** hanya host tepercaya (YouTube/TikTok) bila ditampilkan sebagai embed;
   jangan render iframe dari URL sembarang (anti-XSS/clickjacking). Allowlist host.

**Acceptance S-9:**
- [ ] Semua aksi/route memvalidasi input (audit lulus).
- [ ] `dangerouslySetInnerHTML` tidak dipakai untuk konten user.
- [ ] Open redirect tidak mungkin via callback.
- [ ] Embed video hanya dari host allowlist.

---

## FASE S-10 — Audit log & observability

**Tujuan:** jejak audit aksi sensitif + visibilitas produksi. Terapkan
`observability-and-instrumentation`.

**Langkah:**
1. Migrasi `v2_0005_audit_log.sql`: tabel
   `audit_logs(id uuid pk, actor uuid, action text, entity text, entity_id text, meta jsonb, ip text, created_at timestamptz default now())`.
   RLS: hanya admin yang SELECT; INSERT via fungsi `log_audit(...)` SECURITY DEFINER (dipanggil
   Server Action) atau via service-role.
2. Catat aksi sensitif: login admin, createAdmin/deleteUser, ubah role, CRUD produk/kategori,
   ubah status order, pembayaran (webhook), pembatalan. Sertakan `actor`, `ip`, ringkasan.
3. **Logging error server:** `console.error` terstruktur (pesan + konteks, tanpa PII/secret). Di
   Vercel terlihat di Functions logs.
4. **Monitoring:** aktifkan Vercel Analytics & Supabase logs. (Opsional) integrasi Sentry untuk
   error tracking.
5. **Alert:** (opsional) notifikasi bila lonjakan error/pembayaran gagal.

**Acceptance S-10:**
- [ ] Aksi admin & pembayaran tercatat di `audit_logs` (hanya admin bisa baca).
- [ ] Error server ter-log tanpa membocorkan secret/PII.

---

## FASE S-11 — Dependency, supply chain & privasi (PII/Hukum)

**Langkah:**
1. **`npm audit`** → perbaiki kerentanan high/critical. Jalankan rutin (CI — lihat `13-...`).
2. **Lockfile** (`package-lock.json`) ter-commit; jangan pakai versi liar.
3. **Minimalkan dependency**; tinjau paket baru (Upstash, sharp, DOMPurify) dari sumber resmi.
4. **PII minimization:** simpan hanya yang perlu (nama, telp, alamat untuk pengiriman). Jangan
   menyimpan data kartu (Pakasir yang menangani pembayaran).
5. **Hak hapus data (GDPR-like):** `deleteUser` menghapus auth+profile (cascade). Pertimbangkan
   anonimisasi order lama (snapshot tetap, tapi tautan user bisa di-null-kan) bila diminta hapus.
6. **Kebijakan Privasi & S&K** (halaman statis — `12-...`) wajib ada sebelum produksi.
7. **Cookie/consent:** karena hanya cookie esensial (sesi), banner consent minimal; tetap sediakan
   kebijakan.

**Acceptance S-11:**
- [ ] `npm audit` tanpa high/critical (atau ada rencana mitigasi).
- [ ] Halaman Privasi & S&K ada.
- [ ] Tidak menyimpan data pembayaran sensitif.

---

## FASE S-12 — Uji penetrasi ringan (uji negatif WAJIB)

Jalankan semua; semua harus **GAGAL untuk penyerang** (artinya kontrol bekerja):
- [ ] **IDOR order:** sebagai customer A, coba `GET` order milik B (via Supabase client di console
      / ubah id di URL order detail) → kosong/ditolak.
- [ ] **Privilege escalation:** customer coba `update profiles set role='admin'` → gagal (trigger).
- [ ] **Akses admin:** customer membuka `/admin/*` → redirect; memanggil Server Action admin
      (replay POST) → ditolak (requireAdmin).
- [ ] **Manipulasi harga checkout:** kirim `createOrder` dengan harga/total palsu → diabaikan
      (harga dari DB; total dihitung RPC). Coba `quantity` > stok → ditolak.
- [ ] **Webhook palsu:** POST webhook dengan amount/status palsu → tidak menandai paid; tanpa token
      rahasia → ditolak.
- [ ] **Upload jahat:** unggah SVG / file HTML berekstensi .png (MIME palsu) → ditolak.
- [ ] **Brute force:** 10 login gagal cepat → diblok (rate limit).
- [ ] **XSS:** masukkan `<script>` di nama/deskripsi/review → tampil sebagai teks, bukan tereksekusi.
- [ ] **Open redirect:** `/auth/callback?next=https://evil.com` → tidak redirect keluar.
- [ ] **CSRF:** Server Action hanya via POST + Next origin check; coba submit dari origin lain →
      ditolak.
- [ ] **Secret leak:** lihat bundle client (`.next`) & network → tidak ada service-role/API key.

**Acceptance S-12 (GERBANG keamanan):** seluruh uji negatif lulus, terdokumentasi. Baru lanjut.

---

## Lampiran: Checklist keamanan ringkas (untuk PR penutup)
- [ ] RLS aktif & teruji di semua tabel (v1+v2).
- [ ] Security headers + CSP terpasang (enforce setelah report-only bersih).
- [ ] Rate limiting di login/register/order/webhook.
- [ ] Email verification + reset password + password ≥ 8 + (MFA admin).
- [ ] Webhook bertoken + verifikasi API + idempoten + ter-log.
- [ ] Upload: magic-bytes + re-encode + allowlist + batas jumlah/ukuran.
- [ ] Tidak ada secret di client; `server-only` terpasang.
- [ ] Validasi Zod di semua aksi/route; tidak ada `dangerouslySetInnerHTML` konten user.
- [ ] Audit log aksi sensitif; monitoring aktif.
- [ ] `npm audit` bersih; Privasi & S&K ada.
- [ ] Semua uji negatif S-12 lulus.

Lanjut ke **`12-feature-completion.md`**.
