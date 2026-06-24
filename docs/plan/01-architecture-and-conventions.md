# 01 — Arsitektur Target & Konvensi

Baca dokumen ini sampai paham **sebelum** menyentuh kode. Ini menjelaskan "bentuk akhir" sistem.

---

## A. Arsitektur target (gambaran besar)

```
                    Browser (Client Components)
   ┌───────────────────────────────────────────────────────────┐
   │  UI yang sudah ada (CSS & layout dipertahankan)             │
   │  - CartContext  → TETAP client (localStorage) utk UX cepat  │
   │  - AuthContext  → DIGANTI provider tipis yang membaca sesi  │
   │                   Supabase (read-only di client)            │
   │  - ProductContext → DIBONGKAR. Data dibaca via Server       │
   │                   Components; mutasi via Server Actions.     │
   └───────────────▲───────────────────────────┬────────────────┘
                   │ render HTML/RSC            │ panggil Server Action / Route Handler
                   │                            ▼
                    Next.js 16 di Vercel (Server)
   ┌───────────────────────────────────────────────────────────┐
   │  Server Components  → fetch data (Supabase server client)   │
   │  Server Actions     → mutasi (auth + RLS), 'use server'     │
   │  Route Handlers     → webhook/operasi khusus (mis. admin)   │
   │  proxy.js           → refresh sesi + redirect optimistik    │
   │  Data Access Layer  → src/lib/data/* (semua query terpusat) │
   └───────────────────────────────┬───────────────────────────┘
                                    │ HTTP (service ke service), cookies sesi
                                    ▼
                    Supabase
   ┌───────────────────────────────────────────────────────────┐
   │  Postgres (tabel + RLS)  │  Auth (users)  │  Storage (foto) │
   └───────────────────────────────────────────────────────────┘
```

**Prinsip:**
- **Baca data** → di Server Component (default, tanpa `'use client'`) memakai **server client**
  Supabase. Lebih cepat, aman, SEO-friendly.
- **Tulis data** → **Server Action** (`'use server'`) yang selalu cek sesi & peran. Tidak ada
  mutasi langsung dari client ke Supabase untuk hal sensitif.
- **Keamanan berlapis:** (1) `proxy.js` redirect optimistik, (2) cek `verifySession()` di Server
  Action/Component, (3) **RLS** di Postgres = sumber kebenaran terakhir.

---

## B. Pemetaan: dari Context lama ke arsitektur baru

| Lama (client/localStorage) | Baru | Catatan |
|----------------------------|------|---------|
| `AuthContext` (users, login, register, logout, addAdmin, deleteUser, updateProfile) | **Supabase Auth** + Server Actions di `src/lib/actions/auth.js` + provider tipis `src/context/AuthContext.js` (hanya expose `user`/`profile` dari sesi) | Password TIDAK lagi disimpan app. Login/Register = `supabase.auth.signInWithPassword` / `signUp`. |
| `ProductContext.products` | Server fetch `getProducts()` di `src/lib/data/products.js` | Home/Shop/Detail jadi Server Component (atau fetch di server lalu pass ke client). |
| `ProductContext.categories` | `getCategories()` di `src/lib/data/categories.js` | |
| `ProductContext.orders` + addOrder + updateOrderStatus | tabel `orders`/`order_items`; Server Actions `createOrder`, `updateOrderStatus` di `src/lib/actions/orders.js` | Checkout & admin orders. |
| add/update/deleteProduct, add/update/deleteCategory | Server Actions `src/lib/actions/products.js`, `categories.js` | Hanya admin. |
| `CartContext` | **TETAP** client (`localStorage`) | Hanya state UI. Divalidasi server saat checkout. |

> **Strategi migrasi aman:** kerjakan **fitur demi fitur**. Saat sebuah halaman sudah pindah ke
> server-fetch, hapus ketergantungannya pada `ProductContext`. Jangan hapus `ProductContext`
> sampai **semua** konsumennya dipindah (lihat fase 4–7). Di fase terakhir, hapus
> `ProductProvider` dari `layout.js` dan file context-nya.

---

## C. Struktur folder target (yang akan dibuat)

```
src/
  proxy.js                      # (Fase 3) refresh sesi + redirect optimistik (BUKAN middleware.js)
  app/
    layout.js                   # (Fase 3) provider auth tipis menggantikan AuthProvider lama
    loading.js                  # (Fase 4) skeleton global opsional
    not-found.js                # (Fase 4) 404 global
    (rute yang sudah ada ...)
    auth/
      callback/route.js         # (Fase 3) tukar code OAuth/verifikasi → sesi (Route Handler)
    api/
      webhooks/pakasir/route.js # (Fase 6B) terima webhook Pakasir + verifikasi (service-role)
    checkout/
      success/page.js           # (Fase 6B) halaman hasil pembayaran (cek Transaction Detail API)
    forgot-password/page.js     # (Fase 3, opsional) minta reset
    reset-password/page.js      # (Fase 3, opsional) set password baru
    admin/
      orders/page.js            # (Fase 7) kelola pesanan
  lib/
    supabase/
      client.js                 # (Fase 2) createBrowserClient — utk Client Components
      server.js                 # (Fase 2) createServerClient — utk Server Comp/Action (await cookies)
      admin.js                  # (Fase 2) service-role client — SERVER ONLY, jangan diimport client
    session.js                  # (Fase 3) updateSession() dipakai proxy.js
    dal.js                      # (Fase 3) verifySession(), getCurrentUser(), requireAdmin()
    data/
      products.js               # (Fase 4) getProducts, getProductById, getFeatured, getRelated
      categories.js             # (Fase 4) getCategories
      orders.js                 # (Fase 7) getOrders, getOrderById, getMyOrders
      profiles.js               # (Fase 7) getProfiles (admin)
    actions/
      auth.js                   # (Fase 3) login, register, logout, (reset)
      products.js               # (Fase 5) createProduct, updateProduct, deleteProduct
      categories.js             # (Fase 5) create/update/deleteCategory
      orders.js                 # (Fase 6/7) createOrder, updateOrderStatus
      accounts.js               # (Fase 7) createAdmin, deleteUser (service-role)
    payments/
      pakasir.js                # (Fase 6B) helper Pakasir: buildPayUrl, getTransactionDetail (server-only)
    validation.js               # (Fase 3+) skema validasi (Zod) untuk input form
  context/
    AuthContext.js              # (Fase 3) DIGANTI: provider tipis dari sesi server
    CartContext.js              # TETAP (sedikit ubah: cap qty ≤ stok)
    ProductContext.js           # DIHAPUS di fase akhir
  data/                         # JSON seed lama → dipakai untuk membuat seed.sql, lalu boleh diarsip
  utils/helpers.js              # TETAP (formatCurrency, formatDate, dst). Perbaiki calculateDiscount (B8).
```

> **Catatan:** Plan ini memakai `src/lib/` sebagai lokasi kode server (DAL, actions, supabase
> clients). Alias `@/lib/...` → `./src/lib/...` otomatis berlaku karena `jsconfig.json` memetakan
> `@/*` ke `./src/*`.

---

## D. Model data (entitas & relasi) — ringkas

Detail kolom & SQL ada di `02-database-and-rls.md`. Ringkasnya:

- **profiles** (1–1 dengan `auth.users`): `id (uuid, = auth.users.id)`, `full_name`, `phone`,
  `role ('admin'|'customer')`, `created_at`. Diisi otomatis via trigger saat user baru daftar.
- **categories**: `id`, `name`, `slug (unik)`, `description`, `image_url`, `created_at`.
- **products**: `id`, `name`, `price`, `original_price`, `category_id (fk)`, `size`,
  `available_sizes (text[])`, `measurements (jsonb)`, `condition`, `brand`, `color`, `material`,
  `weight`, `description`, `video_url`, `stock (default 1)`, `status ('available'|'sold')`,
  `featured (bool)`, `created_at`. (Nama kategori TIDAK didenormalisasi — join ke categories.)
- **product_images**: `id`, `product_id (fk)`, `url`, `position (int)`, `created_at`.
  (Gambar disimpan terpisah agar multi-foto rapi; foto utama = `position = 0`.)
- **orders**: `id`, `user_id (fk profiles)`, `recipient_name`, `phone`, `address`, `notes`,
  `subtotal`, `shipping_cost`, `total`, `status`, `created_at`.
- **order_items**: `id`, `order_id (fk)`, `product_id (fk, nullable on delete set null)`,
  `name_snapshot`, `price_snapshot`, `size_snapshot`, `quantity (default 1)`.

**Relasi:** category 1—N product; product 1—N product_images; profile 1—N orders;
order 1—N order_items; product 1—N order_items (snapshot melindungi data bila produk dihapus).

---

## E. Konvensi kode (ikuti persis)

1. **Bahasa:** JavaScript (`.js`/`.jsx` bila JSX). Tidak ada TypeScript.
2. **Import alias:** `@/lib/...`, `@/components/...`, dst. (jangan path relatif panjang).
3. **Server vs Client:**
   - Default = **Server Component** (tidak ada `'use client'`). Pakai untuk fetch data.
   - Tambahkan `'use client'` **hanya** bila butuh hook/interaktivitas (state, event, context).
   - File Server Action diawali `'use server'` di baris paling atas file.
4. **Penamaan prop Server Action yang dikirim ke Client Component:** akhiri dengan `Action`
   (mis. `createProductAction`) bila dilewatkan sebagai prop — konvensi Next.js.
5. **Validasi input:** setiap Server Action memvalidasi `FormData`/argumen dengan **Zod**
   (`src/lib/validation.js`). Jangan percaya input client.
6. **Auth check di setiap mutasi:** baris pertama Server Action sensitif:
   `const { user, profile } = await requireAuth()` (atau `requireAdmin()`), import dari `@/lib/dal`.
7. **Revalidasi setelah mutasi (Next.js 16):**
   - Gunakan `revalidatePath('/path')` untuk halaman yang menampilkan data berubah, **atau**
   - `revalidateTag('products', 'max')` (INGAT argumen kedua!) bila pakai tag, **atau**
   - `updateTag('products')` di Server Action untuk read-your-writes instan.
   - `refresh()` dari `next/cache` **hanya bisa dipanggil di dalam Server Action** dan memicu
     refresh router client sebagai bagian respons action itu. Untuk refresh yang diinisiasi dari
     Client Component, pakai `router.refresh()` dari `useRouter` (`next/navigation`).
8. **Jangan pernah** import `@/lib/supabase/admin.js` (service-role) di file ber-`'use client'`
   atau di Client Component. Itu khusus server.
9. **Format uang/tanggal:** pakai helper di `@/utils/helpers.js` (sudah ada).
10. **Penanganan error:** Server Action mengembalikan objek `{ error: '...' }` untuk error yang
    bisa ditampilkan ke user (dipakai dengan `useActionState`), dan `throw` hanya untuk error tak
    terduga. Jangan bocorkan detail internal ke pesan user.

---

## F. Variabel lingkungan (env)

Buat `.env.local` (lokal) & set juga di Vercel. **Jangan commit `.env.local`** (sudah di
`.gitignore`? pastikan).

```bash
# Client-safe (boleh terbaca browser)
NEXT_PUBLIC_SUPABASE_URL="https://<PROJECT-REF>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon-key>"

# SERVER ONLY — JANGAN beri prefix NEXT_PUBLIC_, jangan import di client
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"

# Opsional konfigurasi toko
NEXT_PUBLIC_SITE_URL="https://<domain-vercel-atau-kustom>"   # utk redirect auth/email

# Payment gateway Pakasir (lihat Fase 6B)
PAKASIR_SLUG="<slug-proyek-pakasir>"        # server only (boleh juga tampil di URL bayar)
PAKASIR_API_KEY="<api-key-pakasir>"         # SERVER ONLY — JANGAN NEXT_PUBLIC_
```

> Supabase menyediakan juga "publishable" / "secret" key generasi baru. Bila dashboard project
> memakai penamaan baru, peta: `anon` ≈ publishable (client), `service_role` ≈ secret (server).
> Gunakan yang ada di dashboard project; nama variabel di atas tetap dipakai di kode.

Lanjut ke **`02-database-and-rls.md`**.
