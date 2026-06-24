# 00 — Audit UI/UX & Keputusan Scope

Audit ini hasil membaca seluruh `src/`. Tujuannya: tahu apa yang **kurang/salah** sebelum
membangun backend, supaya backend dibangun untuk UI yang benar (bukan melanggengkan bug).

Format: **[Severity]** Temuan → Dampak → Tindakan (fase mana).
Severity: 🔴 Kritis (blokir), 🟠 Penting, 🟡 Sebaiknya, ⚪ Nice-to-have.

---

## A. Masalah GAMBAR (paling kritis — katalog terlihat kosong)

- 🔴 **A1. Kartu produk tidak pernah menampilkan gambar produk.**
  `src/components/ProductCard.js` selalu render SVG placeholder berdasarkan kategori
  (`product.categoryName === 'Pria' ? <svg/> : <svg/>`). Tidak ada `<img>`/`next/image`.
  → Semua grid (Home, Shop, Related) tampak tanpa foto.
  → **Tindakan: Fase 4** — render gambar nyata dari Supabase Storage via `next/image`.

- 🔴 **A2. Halaman detail hanya menampilkan gambar base64.**
  `src/app/product/[id]/page.js`:
  `const allImages = (product.images || []).filter(img => img && img.startsWith('data:'))`.
  Produk seed memakai path file (`/images/products/...`) → difilter habis → tampil placeholder.
  → **Tindakan: Fase 4** — render dari URL Storage (https), buang filter `data:`.

- 🔴 **A3. Folder `public/images/` tidak ada.** `products.json` & `categories.json` menunjuk
  `/images/products/*.jpg` dan `/images/category-*.jpg` yang tidak pernah ada.
  → Sumber kekosongan gambar. → **Tindakan: Fase 1/4** — pindah ke Storage; seed memakai URL nyata
  atau gambar placeholder yang benar-benar ada.

- 🟠 **A4. Upload gambar admin disimpan sebagai base64 di localStorage.**
  `src/app/admin/products/page.js` `handleImageUpload` → `reader.readAsDataURL` → string base64
  masuk state lalu localStorage. Akan **menjebol kuota localStorage (~5MB)** dengan cepat dan tidak
  pernah terlihat user lain. → **Tindakan: Fase 5** — upload file ke Supabase Storage, simpan URL.

- 🟡 **A5. `videoUrl` produk ditangkap tapi tak pernah dirender** di halaman detail.
  → **Tindakan: Fase 4 (opsional)** — render embed video bila ada.

---

## B. Masalah LOGIKA / DATA (akan jadi bug uang/stok kalau dibawa ke produksi)

- 🔴 **B1. Stepper kuantitas keranjang melebihi stok.**
  `src/app/cart/page.js` tombol `+` memanggil `updateQuantity(item.id, item.quantity + 1)` tanpa
  batas. Produk preloved `stock: 1`. → User bisa beli 5 unit barang yang cuma ada 1 →
  **overselling**. → **Tindakan: Fase 6** — batasi qty ≤ stok, nonaktifkan `+` di stok maks,
  validasi ulang di server saat checkout.

- 🔴 **B2. "Add to cart" tidak cek stok/sold.**
  `product/[id]/page.js` `handleAdd` tidak melihat `stock`. Item habis tetap bisa masuk keranjang.
  → **Tindakan: Fase 4/6** — sembunyikan/nonaktifkan tombol bila `stock <= 0` atau `status = sold`,
  tampilkan badge "Terjual".

- 🔴 **B3. Model "ukuran" bertentangan dengan sifat barang unik.**
  Produk punya `availableSizes: ["M","L","XL"]` seolah multi-ukuran, padahal barang preloved itu
  **satu fisik, satu ukuran**. UI detail memaksa "Pilih Ukuran" untuk satu barang.
  → **Keputusan scope (lihat §E):** perlakukan tiap produk sebagai **satu item dengan satu
  ukuran** (`size`). `availableSizes` hanya disimpan sebagai info opsional, **tidak** dipakai
  sebagai pilihan beli. UI detail menampilkan ukuran sebagai badge, bukan selector wajib.
  Pertahankan kolom agar tak merusak data lama, tapi alur beli pakai `size`.

- 🔴 **B4. Tidak ada halaman kelola Pesanan untuk admin.**
  `ProductContext` punya `updateOrderStatus`, tapi **tidak ada UI** yang memanggilnya. Admin hanya
  melihat order read-only di Dashboard & Laporan. Tidak bisa ubah status (Baru → Diproses →
  Dikirim → Selesai). → **Tindakan: Fase 7** — buat `src/app/admin/orders/page.js` + ubah status
  via Server Action; tambahkan ke menu sidebar admin.

- 🟠 **B5. `setMainImage` dipanggil saat render.**
  `product/[id]/page.js`: `if (hasImages && !mainImage) setMainImage(allImages[0])` di body render
  = anti-pattern React (potensi loop / warning). → **Tindakan: Fase 4** — inisialisasi via
  `useState(() => ...)` atau `useEffect`.

- 🟠 **B6. Daftar "Pelanggan" admin menyesatkan di model localStorage.**
  `admin/accounts` menampilkan customer dari `localStorage` browser admin → tidak pernah berisi
  user yang daftar di perangkat lain. → **Tindakan: Fase 3/7** — baca dari tabel `profiles`
  (semua user terlihat oleh admin via RLS).

- 🟠 **B7. `useSearchParams` di `/shop` tanpa `<Suspense>`.**
  `src/app/shop/page.js` memakai `useSearchParams()` di page client tanpa Suspense boundary →
  Next.js men-deopt / memberi warning bprerender. → **Tindakan: Fase 4** — bungkus konten yang
  pakai search params dengan `<Suspense>`.

- 🟡 **B8. Diskon bisa NaN/aneh.** `calculateDiscount` di `helpers.js` membagi dengan
  `originalPrice`; bila `originalPrice` 0/undefined → `NaN%`. → **Tindakan: Fase 4** — guard:
  tampilkan diskon hanya bila `originalPrice > price > 0`.

---

## C. FITUR yang HILANG (alur toko belum lengkap)

- 🟠 **C1. Tidak ada halaman detail pesanan** (customer & admin). Profil hanya tampilkan ringkasan.
  → **Fase 7** (minimal: modal/halaman detail order).
- 🟠 **C2. Tidak ada lupa password / verifikasi email / ganti password.**
  → **Fase 3** (gunakan Supabase Auth: reset password via email; minimal sediakan halaman
  `/forgot-password`). Boleh ditandai opsional bila waktu terbatas, tapi rancang skemanya.
- 🟠 **C3. Checkout tidak punya metode pembayaran & ongkir nyata.** "Ongkir Gratis" hardcoded,
  tidak ada payment. → **Keputusan scope (§E):** pembayaran kini **dalam scope v1 via payment
  gateway Pakasir** (QRIS/VA) — lihat **Fase 6B**. Ongkir tetap flat/gratis (dikonfigurasi);
  integrasi ongkir nyata (RajaOngkir/Biteship) = backlog.
- 🟡 **C4. Tidak ada wishlist/favorit.** → backlog (⚪), rancang tabel opsional di §schema (komentar).
- 🟡 **C5. Tidak ada ulasan/rating produk.** → backlog (⚪).
- 🟡 **C6. Filter Shop minim** (hanya kategori + teks + sort). Tidak ada filter ukuran/kondisi/
  brand/rentang harga. → **Fase 4 (opsional)** — tambah filter kondisi & brand bila mudah.
- 🟡 **C7. Link Footer mati** (`href="#"`: Cara Belanja, Pengembalian, FAQ, Kontak).
  → **Fase 4/8** — buatkan halaman statis sederhana atau hapus link yang tak ada.

---

## D. AKSESIBILITAS & QUALITY (penting untuk produksi)

- 🟠 **D1. Modal tanpa accessibility.** Modal di `admin/products`, `admin/categories`,
  `admin/accounts` tidak ada `role="dialog"`/`aria-modal`, tidak ada focus trap, tidak ada tutup
  via tombol Escape. → **Fase 5** (saat menyentuh modal) — tambahkan minimal `aria-modal`,
  Escape-to-close, fokus awal.
- 🟠 **D2. Tombol ikon tanpa label.** Banyak tombol hanya ikon SVG tanpa `aria-label`
  (mis. tombol qty `+`/`−`, tutup modal `✕`). → tambah `aria-label` saat menyentuh komponen terkait.
- 🟡 **D3. `<img>` mentah, bukan `next/image`.** Logo & (nanti) gambar produk. → **Fase 4** untuk
  gambar produk pakai `next/image`. Logo kecil boleh tetap `<img>` tapi pastikan `alt`.
- 🟡 **D4. Tidak ada `loading.js` / `error.js` / `not-found.js`.** Tidak ada skeleton saat fetch,
  tidak ada UI error global. → **Fase 4** — tambah `loading.js` untuk rute yang fetch data &
  `not-found.js` global, `error.js` di segmen yang fetch.
- 🟡 **D5. SEO minim.** Tidak ada `generateMetadata` per produk, `sitemap`, `robots`, OG image.
  → **Fase 4/8 (opsional)** — `generateMetadata` di product detail; `sitemap.js` & `robots.js`.

---

## E. KEPUTUSAN SCOPE (dipakai sebagai aturan di seluruh plan)

Keputusan ini **final untuk v1** agar agen tidak bimbang. Penyimpangan harus disetujui pemilik
proyek.

1. **Model bisnis = admin-curated inventory.** Admin yang menambah/mengelola produk; customer
   membeli. CTA "jual baju lama" di Home hanyalah marketing — **tidak** ada alur jual/konsinyasi
   user di v1. (Backlog bila diinginkan.)
2. **Barang unik, stok satuan.** Tiap produk = 1 fisik. `stock` default 1. Setelah terbeli →
   `status = 'sold'` / `stock = 0`. Tidak ada multi-ukuran sebagai pilihan beli (lihat B3).
3. **Checkout v1 = buat pesanan + bayar via Pakasir (QRIS/VA).** Status pesanan:
   `Baru → Diproses → Dikirim → Selesai` (+ `Dibatalkan`); status pembayaran terpisah
   (`unpaid/paid/failed/expired`). Stok di-reserve saat order dibuat; dilepas via `cancel_order`
   bila pembayaran gagal. Ongkir: kolom konfigurasi (default 0 / gratis). Detail di **Fase 6B**.
4. **Peran:** `admin` dan `customer` (disimpan di `profiles.role`). Admin pertama di-seed.
5. **Keranjang tetap di client (localStorage) untuk UX cepat**, TAPI **divalidasi ulang di server
   saat checkout** (stok, harga). Harga & nama di order adalah **snapshot** saat beli.
6. **Bahasa & format Indonesia dipertahankan** (Rupiah, tanggal id-ID). Jangan diubah.
7. **Desain visual dipertahankan.** Audit ini memperbaiki *fungsi/data/aksesibilitas*, bukan
   tampilan. Perbaikan gambar = memunculkan gambar di slot yang sudah ada, bukan merombak layout.

---

## F. Ringkasan tindakan per fase (peta cepat)

| Temuan | Fase |
|--------|------|
| A1, A2, A3, A5, B5, B7, B8, C6, C7, D3, D4, D5 | **Fase 4** (read path + gambar + polish FE) |
| A4 (upload Storage) | **Fase 5** (admin CRUD) |
| B1, B2 (stok/qty), checkout server, snapshot | **Fase 6** (cart & checkout) |
| C3 (pembayaran Pakasir) | **Fase 6B** (payment gateway) |
| B4 (admin orders), B6 (profiles), C1 (detail order) | **Fase 7** (orders & dashboard) |
| C2 (reset password) | **Fase 3** (auth) |
| D1, D2 (a11y modal/tombol) | menyertai **Fase 5** |
| C4 (wishlist), C5 (review) | **Backlog v2** (dicatat, tidak dikerjakan v1) |

Lanjut ke **`01-architecture-and-conventions.md`**.
