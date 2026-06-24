# 15 — Edge Cases & Gotchas (baca sebelum & selama coding)

Daftar jebakan konkret yang paling sering menyebabkan bug/celah di project ini. Format: **❌ Jangan
→ ✅ Lakukan**. Gunakan sebagai checklist mental saat menulis tiap fitur.

---

## A. Next.js 16 (versi ini BEDA dari yang kamu hafal)

- ❌ `cookies()` / `headers()` sinkron → ✅ **`await cookies()` / `await headers()`**.
- ❌ `params.id` / `searchParams.x` langsung → ✅ server: **`const { id } = await params`**,
  **`const sp = await searchParams`**; client: `use(params)`.
- ❌ Membuat `middleware.js` → ✅ **`src/proxy.js`**, export `proxy`, runtime nodejs.
- ❌ `images.domains` → ✅ **`images.remotePatterns`** (host Supabase).
- ❌ `revalidateTag('x')` → ✅ `revalidateTag('x', 'max')` (atau `updateTag`/`revalidatePath`).
- ❌ `refresh()` (next/cache) di Client Component → ✅ `refresh()` hanya di Server Action; di client
  pakai `router.refresh()`.
- ❌ `next lint` → ✅ `npm run lint` (eslint langsung).
- ❌ Menjalankan `useSearchParams()` tanpa `<Suspense>` → ✅ bungkus Suspense (atau baca
  `searchParams` di Server Component).
- ✅ Parallel route slot butuh `default.js` (kalau dipakai). Turbopack default — jangan tambah flag.

## B. Supabase client & sesi

- ❌ Memakai `createBrowserClient` di Server Component / `createServerClient` di Client → ✅
  `@/lib/supabase/server` (server), `@/lib/supabase/client` (client), `@/lib/supabase/admin`
  (service-role, server-only).
- ❌ Menaruh logika di antara `createServerClient` dan `getUser()` di `session.js` → ✅ panggil
  `getUser()` langsung (menyegarkan token). Jangan ubah urutan.
- ❌ `getSession()` untuk otorisasi di server → ✅ **`getUser()`** (memverifikasi ke Auth server;
  `getSession` membaca cookie yang bisa basi/dipalsu di beberapa konteks).
- ❌ `.single()` pada query yang bisa kosong → ✅ `.maybeSingle()` lalu tangani null.
- ❌ Mengandalkan `auth.uid()` saat memakai **service-role** (akan NULL) → ✅ untuk operasi yang
  butuh identitas/role pakai **session client**; service-role hanya untuk operasi sistem (webhook,
  cron, createUser). (Ingat kasus `set_user_role` v1.)

## C. RLS & otorisasi (paling rawan kebocoran)

- ❌ Membuat tabel baru tanpa `enable row level security` → ✅ **selalu** aktifkan + policy.
- ❌ Mengira "sudah dicek di Server Action, jadi aman" → ✅ RLS tetap WAJIB (Server Action bisa
  di-bypass via direct POST; RLS pertahanan terakhir).
- ❌ Policy `using` saja tanpa `with check` pada INSERT/UPDATE → ✅ sediakan keduanya agar baris
  baru/diubah juga tervalidasi.
- ❌ Fungsi SECURITY DEFINER tanpa `set search_path = public` → ✅ selalu set (cegah hijack).
- ❌ Memberi `grant execute` fungsi sensitif ke `anon`/`public` → ✅ batasi ke `authenticated`;
  fungsi sistem (`expire_unpaid_orders`) tidak ke siapa pun.
- ✅ Setelah menulis policy, **uji IDOR** sebagai user lain (lihat `11-...` S-12).

## D. Pembayaran & Pakasir

- ❌ Menandai order `paid` hanya dari body webhook → ✅ **verifikasi ulang** ke Transaction Detail
  API + cocokkan `amount` == `order.total` (sudah di v1; pertahankan).
- ❌ Menghitung total/diskon/ongkir di client lalu menyimpannya → ✅ hitung di RPC `create_order`
  dari harga DB. Client tidak pernah menentukan uang.
- ❌ `amount` ke Pakasir dari nilai client → ✅ dari `order.total` (DB).
- ⚠️ Pakasir menambah `fee` di atas `amount` untuk pembeli, tetapi webhook/`transactiondetail`
  mengembalikan `amount` dasar → cocokkan dengan `order.total`, bukan `total_payment`.
- ❌ Webhook tidak idempoten → ✅ kalau `payment_status='paid'` sudah, langsung return ok.
- ❌ Endpoint webhook tanpa proteksi → ✅ token rahasia di URL + rate limit (S-6) + verifikasi API.
- ❌ Order `unpaid` menahan stok selamanya → ✅ `expires_at` + `expire_unpaid_orders` (H-5/T-6).
- ⚠️ Jangan kosongkan keranjang sebelum order DB sukses dibuat (urutan: createOrder ok → clearCart
  → redirect).

## E. Stok & konkurensi (barang unik)

- ❌ Mengurangi stok di webhook saat lunas → ✅ stok di-**reserve saat order dibuat** (RPC), agar
  dua pembeli tak bisa membeli barang yang sama; lepas via `cancel_order`/expiry bila gagal.
- ❌ Mengurangi stok tanpa `FOR UPDATE` → ✅ lock baris produk (sudah di `create_order`).
- ❌ Mengizinkan qty keranjang > stok → ✅ clamp di `CartContext` + RPC menolak.
- ⚠️ Cart localStorage bisa basi → re-sync ke DB saat buka cart/checkout (H-4).

## F. Auth, password, enumeration

- ❌ Pesan "email tidak terdaftar" vs "password salah" → ✅ pesan **generik** ("Email atau password
  salah"); reset password "jika email terdaftar, kami kirim instruksi".
- ❌ Password minimal 6 → ✅ minimal **8** (Zod + Supabase) di S-5.
- ❌ Lupa konfigurasi Site URL / Redirect URLs Supabase → ✅ set untuk lokal & produksi, jika tidak
  email verifikasi/reset gagal.
- ⚠️ Email confirm OFF hanya untuk dev; **ON di produksi** + tangani callback `type=recovery`/
  `signup` (verifyOtp) & halaman cek-email.

## G. Upload & konten

- ❌ Percaya `file.type` dari client → ✅ cek **magic bytes** + allowlist; tolak SVG; re-encode
  (sharp) + strip EXIF (S-7).
- ❌ Posisi gambar mulai 0 saat edit → ✅ lanjut `max(position)+1` + renumber (H-2).
- ❌ `dangerouslySetInnerHTML` untuk deskripsi/komentar user → ✅ render teks; jika rich text,
  sanitasi allowlist.
- ❌ Render `<iframe>` dari `video_url` sembarang → ✅ allowlist host (YouTube/TikTok).

## H. Search & filter

- ❌ Merangkai input ke `.or("name.ilike.%"+q+"%")` mentah → ✅ escape `%` `_` / sanitasi `q`
  sebelum dipakai; batasi panjang.
- ❌ Menampilkan produk `sold` di hasil default → ✅ filter `status='available'` untuk katalog
  publik (tetap bisa lihat detail produk terjual via link langsung dengan badge "Terjual").
- ⚠️ Pagination + filter: hitung `count` agar nomor halaman benar.

## I. Caching & revalidasi

- ❌ Lupa `revalidatePath` setelah mutasi → ✅ revalidasi semua halaman yang menampilkan data
  tersebut (produk → `/`, `/shop`, `/product/[id]`, `/admin/products`; kategori → `/`, `/shop`,
  `/admin/categories`; order → `/profile`, `/admin/orders`).
- ⚠️ Halaman ber-sesi (profile/admin/checkout) jangan di-cache statis; biarkan dinamis.
- ⚠️ Jika memakai `use cache`/tag untuk katalog, panggil `revalidateTag(tag,'max')` saat admin ubah.

## J. SEO

- ❌ `generateMetadata` membaca `params.id` sinkron → ✅ `await params`.
- ❌ Sitemap memuat produk `sold`/admin/checkout → ✅ hanya URL publik relevan; robots blok
  `/admin`,`/checkout`,`/profile`,`/api`.
- ✅ JSON-LD: data milik kita, tetap escape; jangan masukkan input user mentah.

## K. Deployment (Vercel) & env

- ❌ Secret tanpa prefix benar / di client → ✅ `NEXT_PUBLIC_*` hanya untuk yang aman publik;
  service-role/API key/webhook secret/cron secret tanpa `NEXT_PUBLIC_`, ditandai Sensitive.
- ❌ Lupa update domain di Supabase/Pakasir saat go-live → ✅ Site URL, Redirect URLs, Webhook URL,
  remotePatterns semua pakai domain produksi.
- ⚠️ Cron Vercel butuh `CRON_SECRET` check; pg_cron butuh extension aktif.
- ⚠️ `sharp` & operasi berat → pastikan berjalan di Node runtime (bukan edge).

## L. Testing

- ✅ TDD untuk perbaikan bug: tulis test gagal dulu (mis. cart melebihi stok), lalu perbaiki.
- ✅ Uji DB/RLS pakai project **staging** terpisah, bukan produksi.
- ✅ Uji negatif keamanan (S-12) = bagian dari "selesai", bukan opsional.
- ⚠️ E2E pembayaran pakai **Sandbox** Pakasir + Payment Simulation API.

---

## DEFINISI "SELESAI" per fitur (template — tempel di tiap PR fitur)

```
[ ] Migrasi DB dijalankan; tabel baru RLS aktif + policy + diuji (positif & negatif).
[ ] Server Action/Route: requireAuth/requireAdmin sesuai peran + validasi Zod + scope ke pemilik.
[ ] Tidak ada secret di client; modul server ber-server-only.
[ ] UI memakai token/komponen desain yang ada; a11y (label, keyboard, alt) terpenuhi.
[ ] revalidatePath untuk semua halaman terdampak.
[ ] Unit/integration/E2E test untuk logika & alur kritis hijau.
[ ] npm run lint & npm run build hijau.
[ ] Uji negatif keamanan relevan (IDOR/escalation/injection/XSS) lulus.
[ ] Pesan error generik (tak bocorkan internal/PII).
```

---

## Urutan eksekusi keseluruhan v2 (peta cepat untuk agen)

1. **`10-` Hardening** H-1 → H-8 (stabil dulu; gerbang H-8).
2. **`11-` Security** S-1 → S-12 (aman; gerbang S-12).
3. **`12-` Fitur** F-1 → F-15 (inti dulu: F-1..F-8, lalu F-9..F-11, opsional F-12..F-15).
4. **`14-` Migrasi SQL** dijalankan saat fitur terkait (urut v2_0001..0009).
5. **`13-` Testing & Launch** T-1 → T-8 (gerbang pre-launch T-7, launch T-8).
6. **`15-` (file ini)** dibaca terus-menerus sebagai checklist.

Setiap gerbang (H-8, S-12, T-7): **jangan lewat** sebelum lulus. `npm run build` hijau di akhir
setiap fase tanpa kecuali.
