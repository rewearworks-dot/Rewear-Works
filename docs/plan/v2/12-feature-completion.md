# 12 — Kelengkapan Fitur Marketplace

Tujuan: melengkapi SEMUA fitur agar Rewear Works menjadi marketplace utuh. Tiap fitur = satu fase
dengan: **Tujuan → Migrasi DB (bila perlu) → File → Pola kode → RLS → Acceptance → Pitfall**.
Kerjakan berurutan; fitur "Inti" dulu, "Tambahan/Opsional" belakangan. Terapkan
`spec-driven-development`, `frontend-ui-engineering`, `api-and-interface-design`,
`incremental-implementation`.

> **Aturan tabel baru:** setiap tabel baru WAJIB `enable row level security` + policy (lihat
> `11-...` S-2). Setiap aksi baru WAJIB `requireAuth/requireAdmin` + Zod. Migrasi di
> `docs/plan/v2/sql/` bernomor & idempoten.

Peta prioritas:
- **Inti (wajib):** F-1 reset password, F-2 account & address, F-3 order detail+tracking,
  F-4 search & filter, F-5 SEO, F-6 halaman statis + footer, F-7 notifikasi pesanan, F-8 a11y.
- **Penting:** F-9 wishlist, F-10 review & rating, F-11 inventori admin.
- **Opsional/Tambahan:** F-12 voucher, F-13 banner/CMS ringan, F-14 performa, F-15 PWA.

---

## FASE F-1 — Lupa & Reset Password + Ganti Password

**Tujuan:** user bisa reset password via email & mengganti password dari profil.

**File & kode:**
1. Aksi di `src/lib/actions/auth.js`:
   ```js
   export async function requestPasswordReset(prevState, formData) {
     const email = String(formData.get('email') || '');
     if (!z.string().email().safeParse(email).success) return { error: 'Email tidak valid' };
     const supabase = await createClient();
     const site = process.env.NEXT_PUBLIC_SITE_URL || '';
     await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${site}/reset-password` });
     // Pesan generik (anti-enumeration): selalu sukses dari sisi UI
     return { ok: true, message: 'Jika email terdaftar, kami telah mengirim instruksi reset.' };
   }
   export async function updatePassword(prevState, formData) {
     const password = String(formData.get('password') || '');
     if (password.length < 8) return { error: 'Password minimal 8 karakter' };
     const supabase = await createClient();   // sesi recovery sudah aktif via link email
     const { error } = await supabase.auth.updateUser({ password });
     if (error) return { error: 'Gagal memperbarui password' };
     return { ok: true };
   }
   ```
2. Halaman `src/app/forgot-password/page.js` (Client): form email → `requestPasswordReset`
   (`useActionState`), tampilkan pesan generik. Link dari halaman login ("Lupa password?").
3. Halaman `src/app/reset-password/page.js` (Client): form password baru → `updatePassword`.
   Link email reset Supabase membawa user ke `/auth/callback` (type=recovery) lalu redirect ke
   `/reset-password` dengan sesi recovery aktif. Pastikan `auth/callback` menangani `type=recovery`
   (verifyOtp) — sudah ada.
4. **Ganti password dari profil:** di `ProfileClient`, tambah form "Ganti Password" → `updatePassword`
   (user sudah login). Opsional minta password lama (Supabase tidak memverifikasi password lama di
   updateUser; untuk keamanan ekstra, minta re-auth).
5. Link "Lupa password?" di `src/app/login/page.js`.

**Acceptance F-1:**
- [ ] `/forgot-password` mengirim email reset; pesan generik.
- [ ] Klik link email → `/reset-password` → set password baru → bisa login dgn password baru.
- [ ] Ganti password dari profil bekerja.
- [ ] Password < 8 ditolak.

**Pitfall:** Supabase Auth harus punya **Site URL & Redirect URLs** yang benar (lokal & produksi),
jika tidak link reset gagal. Email template Supabase mengarah ke `redirectTo`.

---

## FASE F-2 — Manajemen Akun & Buku Alamat

**Tujuan:** profil lengkap + alamat tersimpan (dipakai otomatis di checkout).

**Migrasi `v2_0004_addresses.sql`:**
```sql
create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text,                       -- 'Rumah', 'Kantor'
  recipient_name text not null,
  phone text not null,
  address text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists addresses_user_idx on public.addresses(user_id);
alter table public.addresses enable row level security;
drop policy if exists "addresses_own" on public.addresses;
create policy "addresses_own" on public.addresses
  for all using ( user_id = auth.uid() ) with check ( user_id = auth.uid() );
```

**File & kode:**
1. DAL `src/lib/data/addresses.js`: `getMyAddresses()` (scope `eq('user_id', uid)`).
2. Aksi `src/lib/actions/addresses.js`: `createAddress`, `updateAddress`, `deleteAddress`,
   `setDefaultAddress` — semua `requireAuth()` + Zod + scope `user_id = uid`. `setDefaultAddress`:
   set semua `is_default=false` lalu satu `true` (dalam satu transaksi/urutan).
3. UI di Profil: bagian "Alamat Tersimpan" (daftar + tambah/edit/hapus + jadikan default).
4. **Checkout pakai alamat:** di `checkout/page.js`, dropdown pilih alamat tersimpan → isi otomatis
   form; tetap boleh edit manual. Default address terpilih otomatis.

**Acceptance F-2:**
- [ ] CRUD alamat bekerja; hanya pemilik bisa lihat/ubah (RLS).
- [ ] Checkout menawarkan alamat tersimpan & mengisi otomatis.
- [ ] Satu alamat default; mengubah default konsisten.

---

## FASE F-3 — Detail Pesanan & Pelacakan Status (customer + admin)

**Tujuan:** customer & admin bisa membuka detail satu pesanan, melihat item, status, pembayaran,
timeline.

**Migrasi (opsional, untuk timeline) `v2_00xx_order_events.sql`:**
```sql
create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  note text,
  created_at timestamptz not null default now()
);
alter table public.order_events enable row level security;
create policy "order_events_read" on public.order_events
  for select using (exists (select 1 from public.orders o where o.id = order_events.order_id
                            and (o.user_id = auth.uid() or public.is_admin())));
-- insert via service-role / RPC saat status berubah.
```
Dan ubah `updateOrderStatus` agar juga `insert into order_events` (status + note). Bisa lewat
trigger `after update on orders` yang mencatat perubahan status.

**File & kode:**
1. DAL: `getOrderById(id)` (sudah ada di `lib/data/orders.js` — verifikasi scope: pemilik/admin via
   RLS). Tambah ambil `order_events` untuk timeline.
2. Customer: `src/app/profile/orders/[id]/page.js` (Server Component, `requireAuth`) → tampil
   detail order milik user (RLS memastikan kepemilikan). Tampilkan item (snapshot), alamat, status,
   `payment_status`, timeline, tombol "Bayar Sekarang" bila masih `unpaid` (bangun ulang pay URL),
   tombol "Batalkan" (`cancelOrder`) bila `unpaid`.
3. Admin: `src/app/admin/orders/[id]/page.js` (`requireAdmin`) → detail + ubah status + catatan.
4. Tautkan dari daftar pesanan (Profil & Admin Orders) ke halaman detail.

**Acceptance F-3:**
- [ ] Customer membuka detail pesanannya; tidak bisa membuka milik orang lain (RLS, uji IDOR).
- [ ] Admin membuka detail apa pun + ubah status; timeline tercatat.
- [ ] Order `unpaid` punya tombol Bayar (regenerasi pay URL) & Batalkan (lepas stok).

**Pitfall:** regenerasi pay URL harus pakai `order.total` dari DB; jangan dari client.

---

## FASE F-4 — Pencarian Global & Filter Shop Lanjutan

**Tujuan:** pencarian cepat + filter ukuran/kondisi/brand/rentang harga di Shop, plus kotak cari
di Navbar.

**Migrasi `v2_0007_product_search.sql`:**
```sql
create extension if not exists pg_trgm;
-- index untuk pencarian nama/brand cepat (ILIKE)
create index if not exists products_name_trgm on public.products using gin (name gin_trgm_ops);
create index if not exists products_brand_trgm on public.products using gin (brand gin_trgm_ops);
-- (Opsional full-text: kolom tsvector + index GIN. Untuk katalog kecil, ILIKE+trgm cukup.)
```

**File & kode:**
1. Perluas `getProducts()` (atau buat `searchProducts(filters)`) di `lib/data/products.js` menerima
   filter server-side: `q` (ILIKE name/brand), `categorySlug`, `condition`, `brand`, `minPrice`,
   `maxPrice`, `sizes` (overlap `available_sizes`), `sort`, `page`. Bangun query Supabase
   bertingkat (`.ilike`, `.eq`, `.gte`, `.lte`, `.overlaps`, `.order`, `.range`).
   ```js
   let query = supabase.from('products').select(SELECT, { count: 'exact' }).eq('status','available');
   if (q) query = query.or(`name.ilike.%${q}%,brand.ilike.%${q}%`);
   if (condition) query = query.eq('condition', condition);
   if (minPrice != null) query = query.gte('price', minPrice);
   // ...sizes: query.overlaps('available_sizes', sizesArray)
   query = query.order(sortColumn, { ascending }).range(from, to);
   ```
   > **Penting (anti-injeksi ILIKE):** sanitasi `q` (escape `%` `_`) atau gunakan `.ilike` dengan
   > parameter; jangan rangkai mentah ke `.or()` tanpa escaping. Lebih aman pakai `.textSearch` /
   > `.filter` aman, atau bersihkan input.
2. **Shop:** pindahkan filter ke server (Server Component membaca `searchParams` → `await
   searchParams` di Next 16) atau pertahankan client `ShopClient` tapi panggil `searchProducts`
   via Server Action. Tambah panel filter (kondisi, brand dropdown dari daftar brand distinct,
   slider/inputs harga, chip ukuran). Pertahankan pagination.
3. **Navbar search:** kotak cari → arahkan ke `/shop?q=...`.
4. **Brand list:** query distinct brand untuk dropdown filter (atau tabel brand bila ingin rapi).

**Acceptance F-4:**
- [ ] Cari "Levi" menemukan produk Levi's; filter kondisi/brand/harga/ukuran mempersempit hasil.
- [ ] Hanya produk `available` tampil di katalog publik (terjual tidak muncul di hasil default).
- [ ] Input pencarian aman (tidak bisa meledakkan query / injeksi).
- [ ] Pagination tetap bekerja dengan filter.

**Pitfall:** `searchParams` Promise di Next 16 (server) → `await`. Escape input ILIKE.

---

## FASE F-5 — SEO (metadata, sitemap, robots, OG, JSON-LD)

**Tujuan:** marketplace terindeks & tampil baik saat dibagikan. Baca docs:
`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md`,
`.../03-file-conventions/01-metadata/{sitemap,robots,opengraph-image}.md`.

**File & kode:**
1. **Per produk** `src/app/product/[id]/page.js` (Server Component) — `generateMetadata`:
   ```js
   export async function generateMetadata({ params }) {
     const { id } = await params;                 // Next 16: await
     const product = await getProductById(id);
     if (!product) return { title: 'Produk tidak ditemukan' };
     return {
       title: `${product.name} — Rewear Works`,
       description: product.description?.slice(0, 160),
       openGraph: { title: product.name, images: product.image ? [product.image] : [] },
     };
   }
   ```
2. **`src/app/sitemap.js`** — daftar URL statis + semua produk (`getProducts`) + kategori.
   ```js
   export default async function sitemap() {
     const base = process.env.NEXT_PUBLIC_SITE_URL;
     const products = await getProducts();
     return [
       { url: `${base}/`, priority: 1 },
       { url: `${base}/shop`, priority: 0.8 },
       ...products.map(p => ({ url: `${base}/product/${p.id}`, lastModified: p.createdAt })),
     ];
   }
   ```
3. **`src/app/robots.js`** — izinkan publik, blok `/admin`, `/checkout`, `/profile`, `/api`.
4. **OG image** — default `opengraph-image` (statis) + opsional dinamis per produk via
   `opengraph-image.js` (ImageResponse). (Opsional.)
5. **JSON-LD Product** di halaman detail (`<script type="application/ld+json">` dengan data Product/
   Offer; aman karena data milik kita, bukan input user mentah — tetap escape).
6. **Metadata global** di `layout.js` sudah ada; tambah `metadataBase`, `keywords`, favicon (ada).

**Acceptance F-5:**
- [ ] `/sitemap.xml` & `/robots.txt` valid; admin/checkout/profile diblok robots.
- [ ] Bagikan link produk → judul/desk/gambar muncul (OG).
- [ ] JSON-LD Product valid (uji Rich Results).

---

## FASE F-6 — Halaman Statis + Perbaikan Footer

**Tujuan:** isi link Footer yang mati (Cara Belanja, Pengembalian, FAQ, Kontak) + Privasi & S&K
(wajib untuk produksi/keamanan).

**File:** buat Server Components statis:
- `src/app/cara-belanja/page.js`
- `src/app/pengembalian/page.js`
- `src/app/faq/page.js`
- `src/app/kontak/page.js` (info kontak + opsional form kontak → email)
- `src/app/kebijakan-privasi/page.js`
- `src/app/syarat-ketentuan/page.js`

Konten ringkas berbahasa Indonesia, pakai layout/komponen yang ada (`section`, `container`, `card`).
Tambah `generateMetadata` per halaman. **Update `src/components/Footer.js`**: ganti `href="#"`
menjadi `Link` ke halaman-halaman ini.

**Acceptance F-6:**
- [ ] Semua link Footer mengarah ke halaman nyata (tidak ada `#`).
- [ ] Privasi & S&K tersedia (rujukan dari `11-...` S-11).

---

## FASE F-7 — Notifikasi Pesanan (email + WhatsApp)

**Tujuan:** customer & admin diberi tahu saat order dibuat/berubah status/lunas.

**Pilihan email (pilih satu):**
- **Resend** (mudah di Vercel): `npm install resend`; env `RESEND_API_KEY` (server only). Atau
- **Supabase + SMTP** kustom, atau layanan lain.

**File & kode:**
1. `src/lib/notify/email.js` (`server-only`): `sendOrderEmail({ to, subject, html })` via Resend.
2. Panggil saat:
   - Order lunas (di **webhook** setelah set `paid`): email konfirmasi ke customer + notifikasi
     admin. Ambil email customer via service-role (`auth.admin.getUserById` atau join profiles→
     simpan email di order saat create — pertimbangkan menyimpan `email` snapshot di order).
   - Status berubah (`updateOrderStatus`): email "Pesanan diproses/dikirim".
3. **WhatsApp (manual, tanpa API berbayar):** di halaman sukses & detail order, tombol "Hubungi via
   WhatsApp" → `https://wa.me/<nomor-admin>?text=<order_id>` (link `wa.me`). Cocok untuk toko thrift.
4. Jangan blok alur utama bila email gagal (try/catch, log; pembayaran tetap sukses).

**Catatan data:** untuk mengirim email butuh email customer. Opsi: simpan `email` snapshot di tabel
`orders` saat `create_order` (tambah kolom `customer_email`), diisi dari `auth.email()` dalam RPC.
Migrasi kecil + ubah RPC. Ini juga membantu admin melihat email pemesan.

**Acceptance F-7:**
- [ ] Saat order lunas → email konfirmasi terkirim ke customer + admin (uji sandbox).
- [ ] Perubahan status mengirim email update.
- [ ] Kegagalan email tidak menggagalkan pembayaran/aksi.
- [ ] Tombol WhatsApp berfungsi.

**Pitfall:** API key email server-only; jangan kirim PII berlebih; rate-limit pengiriman.

---

## FASE F-8 — Aksesibilitas (a11y) menyeluruh

**Tujuan:** WCAG dasar terpenuhi. Terapkan `frontend-ui-engineering`.

**Langkah:**
1. **Modal** (admin products/categories/accounts): `role="dialog"`, `aria-modal="true"`,
   `aria-labelledby`, fokus ke elemen pertama saat buka, **Escape menutup**, kembalikan fokus ke
   pemicu saat tutup, klik overlay menutup (sudah). Trap fokus dalam modal.
2. **Tombol ikon** (qty +/−, hapus, tutup ✕, dropdown user): tambah `aria-label` deskriptif.
3. **Form:** setiap `input` punya `label`/`htmlFor` atau `aria-label`; error diumumkan
   (`aria-live="polite"`); urutan fokus logis.
4. **Kontras & fokus terlihat:** pastikan `:focus-visible` ada untuk navigasi keyboard; cek kontras
   teks (gunakan token warna yang ada; perbaiki bila < 4.5:1).
5. **Gambar:** semua `next/image` punya `alt` bermakna (nama produk); ikon dekoratif `aria-hidden`.
6. **Navigasi keyboard:** dropdown user, menu mobile, filter chip dapat dioperasikan via keyboard.
7. **Heading order** & landmark (`<main>` sudah ada; tambah `<nav aria-label>`).

**Acceptance F-8:**
- [ ] Lighthouse a11y ≥ 90 di halaman utama (Home/Shop/Detail/Checkout).
- [ ] Modal dapat dibuka/ditutup & dioperasikan penuh via keyboard.
- [ ] Semua tombol ikon punya label; semua gambar punya alt.

---

## FASE F-9 — Wishlist / Favorit

**Migrasi `v2_0002_wishlist.sql`:**
```sql
create table if not exists public.wishlists (
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
alter table public.wishlists enable row level security;
create policy "wishlist_own" on public.wishlists
  for all using ( user_id = auth.uid() ) with check ( user_id = auth.uid() );
```

**File & kode:**
1. Aksi `src/lib/actions/wishlist.js`: `toggleWishlist(productId)` (`requireAuth`, upsert/delete),
   `getMyWishlist` di DAL.
2. UI: tombol ❤ di `ProductCard` & detail (toggle; butuh login → kalau belum, arahkan login).
   Karena ProductCard server-rendered, tombol favorit jadi komponen client kecil yang tahu status.
3. Halaman `src/app/wishlist/page.js` (`requireAuth`) → daftar produk favorit (join products).
4. Tautkan di menu user/Navbar.

**Acceptance F-9:**
- [ ] Login → favoritkan/unfavorit produk; status tersimpan & terlihat lintas device.
- [ ] Halaman Wishlist menampilkan produk favorit; produk terjual ditandai.
- [ ] Anonim klik favorit → diminta login.

---

## FASE F-10 — Ulasan & Rating Produk

**Migrasi `v2_0003_reviews.sql`:**
```sql
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  unique (product_id, user_id)         -- 1 ulasan per user per produk
);
create index if not exists reviews_product_idx on public.reviews(product_id);
alter table public.reviews enable row level security;
-- Baca publik (tampil di halaman produk)
create policy "reviews_read_all" on public.reviews for select using ( true );
-- Tulis: hanya user yang LOGIN dan PERNAH MEMBELI produk itu (order paid)
create policy "reviews_insert_buyer" on public.reviews for insert with check (
  user_id = auth.uid() and exists (
    select 1 from public.orders o join public.order_items oi on oi.order_id = o.id
    where o.user_id = auth.uid() and oi.product_id = reviews.product_id
      and o.payment_status = 'paid'
  )
);
create policy "reviews_update_own" on public.reviews for update using ( user_id = auth.uid() ) with check ( user_id = auth.uid() );
create policy "reviews_delete_own_or_admin" on public.reviews for delete using ( user_id = auth.uid() or public.is_admin() );
```

**File & kode:**
1. DAL `src/lib/data/reviews.js`: `getProductReviews(productId)`, `getProductRating(productId)`
   (avg + count). Tampilkan agregat di kartu/detail (bintang).
2. Aksi `src/lib/actions/reviews.js`: `createReview`/`updateReview`/`deleteReview` (`requireAuth`,
   Zod rating 1–5, comment ≤ 1000). RLS sudah membatasi hanya pembeli — tapi tetap validasi & beri
   pesan ramah bila bukan pembeli.
3. UI di halaman produk: daftar ulasan + form "Tulis Ulasan" (muncul hanya bila user pembeli &
   belum ulas). Rating bintang interaktif.
4. **Anti-XSS:** komentar dirender sebagai teks (jangan `dangerouslySetInnerHTML`).
5. (Opsional) admin moderasi: hapus ulasan tidak pantas (RLS sudah izinkan admin delete).

**Acceptance F-10:**
- [ ] Hanya pembeli (order paid) yang bisa menulis ulasan; 1 ulasan/produk/user.
- [ ] Rating rata-rata & jumlah tampil di kartu/detail.
- [ ] Komentar berisi `<script>` tampil sebagai teks (tidak tereksekusi).
- [ ] Non-pembeli tidak bisa menulis (uji RLS).

---

## FASE F-11 — Manajemen Inventori & Admin Enhancements

**Tujuan:** admin lebih kuat mengelola toko.

**Fitur:**
1. **Set foto utama & urutkan foto** di form edit produk (drag/▲▼ untuk ubah `position`; foto
   `position 0` = utama). Aksi `setMainImage(productId, imageId)` & `reorderImages`.
2. **Indikator stok rendah/terjual** di tabel produk admin (badge). Filter "Tersedia/Terjual".
3. **Bulk actions** (opsional): tandai featured, hapus terpilih.
4. **Dashboard diperkaya:** grafik penjualan sederhana (per minggu), produk terlaris (dari
   `order_items`), pendapatan vs target. (Data dari DB; render ringan tanpa lib berat, atau lib
   chart kecil.)
5. **Ekspor laporan CSV** di halaman Laporan (selain cetak): tombol unduh CSV dari data terfilter.
6. **Audit log viewer** (dari `11-...` S-10): halaman admin lihat audit_logs (read-only).

**Acceptance F-11:**
- [ ] Admin bisa set foto utama & mengurutkan foto; tercermin di katalog.
- [ ] Tabel produk menampilkan status stok; filter tersedia/terjual.
- [ ] Dashboard menampilkan metrik dari DB; ekspor CSV berfungsi.
- [ ] Halaman audit log (admin) menampilkan aksi sensitif.

---

## FASE F-12 — Voucher / Diskon (Opsional)

**Migrasi `v2_0006_vouchers.sql`:**
```sql
create table if not exists public.vouchers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null check (type in ('percent','fixed')),
  value int not null check (value >= 0),
  min_subtotal int not null default 0,
  max_uses int,                       -- null = unlimited
  used_count int not null default 0,
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.vouchers enable row level security;
create policy "vouchers_read_active" on public.vouchers for select using ( active = true );
create policy "vouchers_write_admin" on public.vouchers for all using ( public.is_admin() ) with check ( public.is_admin() );
```
**Integrasi (PENTING — di server, bukan client):** validasi & terapkan voucher **di dalam RPC
`create_order`** (tambah param `p_voucher_code`): cek aktif, belum expired, `subtotal >=
min_subtotal`, `used_count < max_uses`; hitung diskon dari subtotal DB; kurangi total; `used_count
+= 1` (atomik, dalam transaksi yang sama, dengan `FOR UPDATE` pada baris voucher). **Jangan** pernah
menghitung diskon di client. Admin CRUD voucher.

**Acceptance F-12:**
- [ ] Voucher valid mengurangi total (dihitung di RPC dari DB).
- [ ] Voucher kedaluwarsa/limit habis/min tidak terpenuhi → ditolak.
- [ ] `used_count` bertambah atomik (tidak bisa dipakai melebihi `max_uses` saat race).

---

## FASE F-13 — Banner/CMS Ringan Beranda (Opsional)

**Tujuan:** admin mengatur hero/banner & produk unggulan tanpa ubah kode.
- Migrasi `site_settings`/`banners` (key-value jsonb atau tabel banner sederhana) + RLS (baca
  publik, tulis admin). UI admin "Tampilan Beranda". Home membaca dari DB (fallback ke default
  bila kosong). Jaga agar tidak merusak desain.

**Acceptance F-13:** admin mengubah teks/banner hero → Home ikut berubah; fallback aman bila kosong.

---

## FASE F-14 — Performa

Terapkan `performance-optimization`. Baca docs caching Next 16
(`01-getting-started/08-caching.md`, `09-revalidating.md`).
- **Caching data publik:** katalog/kategori jarang berubah → gunakan caching + tag, `revalidateTag`
  saat admin mengubah (ingat argumen kedua `'max'`), atau `revalidatePath` (sudah dipakai).
  Pertimbangkan `unstable_cache`/`use cache` untuk `getProducts` publik.
- **`next/image`:** ukuran `sizes` tepat; foto Storage di-resize (S-7) agar ringan.
- **Pagination/infinite scroll** Shop agar tidak fetch semua.
- **Bundle:** hindari lib berat; chart pakai yang ringan; dynamic import untuk modal admin besar.
- **Core Web Vitals:** ukur via Lighthouse/Vercel Analytics; target LCP < 2.5s.

**Acceptance F-14:** Lighthouse Performance ≥ 85 di Home/Shop; gambar teroptimasi; tidak fetch
seluruh katalog sekaligus.

---

## FASE F-15 — PWA (Opsional)

- `manifest` (`src/app/manifest.js`) + ikon (sudah ada `icon.png`) + nama/short_name + warna tema.
- (Opsional) service worker untuk offline ringan (hati-hati dengan caching auth — jangan cache
  halaman ber-sesi). Baca `02-guides/progressive-web-apps.md`.

**Acceptance F-15:** situs installable (manifest valid); tidak meng-cache data sensitif.

---

## Ringkasan migrasi DB yang dibuat di fase ini
`v2_0002_wishlist.sql`, `v2_0003_reviews.sql`, `v2_0004_addresses.sql`, `v2_0006_vouchers.sql`,
`v2_0007_product_search.sql`, (+ `order_events`, `customer_email` di orders, `banners`/`site_settings`
bila dipakai). **Semua tabel baru: RLS aktif + policy.** Lihat `11-...` S-2 untuk verifikasi.

Lanjut ke **`13-testing-and-launch.md`**.
