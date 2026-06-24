# 02 — Database, RLS & Storage

Dokumen ini menjelaskan **mengapa** skema dibentuk begini dan **cara menerapkannya**. SQL ada di
file terpisah: **`schema.sql`** (struktur) dan **`seed.sql`** (data awal).

---

## A. Cara menerapkan (langkah konkret)

1. Buat project di **supabase.com** → catat **Project URL**, **anon key**, **service_role key**.
2. Buka **Dashboard → SQL Editor → New query** → tempel isi **`schema.sql`** → **Run**.
   - Harus selesai tanpa error. Bila error, baca pesannya, perbaiki, jalankan ulang (idempotent).
3. Buka SQL Editor lagi → tempel **`seed.sql`** → **Run** (setelah melengkapi produk prod-3..12).
4. Buat user admin lewat **Authentication → Users → Add user** (Auto Confirm ON), lalu jalankan
   bagian `UPDATE ... role = 'admin'` di `seed.sql`.
5. Pastikan bucket **`product-images`** ada (Storage tab). `schema.sql` sudah membuatnya; bila
   tidak muncul, buat manual: Storage → New bucket → nama `product-images` → **Public**.

> Disarankan menyimpan `schema.sql` sebagai migration bila memakai Supabase CLI
> (`supabase/migrations/0001_init.sql`). Tidak wajib untuk v1.

---

## B. Keputusan desain penting (jangan diubah tanpa alasan)

1. **Tidak mendenormalisasi `categoryName` ke products.** UI lama menyimpan `categoryName` di tiap
   produk. Di DB kita **join** ke `categories`. Saat fetch, sediakan `category_name` &
   `category_slug` lewat join (lihat fase 4) supaya UI tetap dapat field yang dibutuhkannya.
2. **Gambar di tabel terpisah `product_images`.** Mendukung multi-foto rapi, `position = 0` =
   foto utama. UI ProductCard memakai foto utama; detail memakai semua.
3. **Order menyimpan snapshot** (`name_snapshot`, `price_snapshot`, `size_snapshot`). Bila produk
   nanti dihapus/berubah harga, riwayat order tetap akurat. `product_id` `on delete set null`.
4. **Checkout lewat RPC `create_order` (SECURITY DEFINER).** Alasan:
   - **Harga dihitung dari DB**, bukan dari client → tidak bisa dimanipulasi.
   - **Atomik + row lock (`FOR UPDATE`)** → dua pembeli tidak bisa membeli 1 barang yang sama.
   - Stok dikurangi & status `sold` di-set dalam transaksi yang sama.
   - Karena DEFINER, insert ke `order_items` tidak butuh policy insert terpisah.
5. **`is_admin()` SECURITY DEFINER** memutus rekursi RLS: policy `profiles` butuh cek admin yang
   sendirinya membaca `profiles`. Fungsi DEFINER membaca tanpa memicu policy → aman.
6. **`prevent_role_escalation` trigger:** customer bisa update profil sendiri TAPI tidak bisa
   mengubah `role` jadi admin. Hanya admin yang boleh mengubah role.
7. **`set_user_role(p_user, p_role)` RPC (SECURITY DEFINER):** satu-satunya cara mengubah peran
   dari aplikasi. Mengecek `is_admin()` di dalamnya, jadi **harus dipanggil dari sesi admin**
   (client sesi, BUKAN service-role — karena service-role membuat `auth.uid()` NULL sehingga
   `is_admin()` false). Dipakai oleh fitur "Tambah Admin" (Fase 7.5). Fungsi ini di-`grant` hanya
   ke `authenticated`. Inilah alasan trigger di poin 6 **tidak perlu dilemahkan**.

---

## C. Ringkasan kebijakan RLS (apa yang boleh siapa)

| Tabel | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| profiles | diri sendiri / admin | (trigger) | diri sendiri / admin* | admin |
| categories | semua (publik) | admin | admin | admin |
| products | semua (publik) | admin | admin | admin |
| product_images | semua (publik) | admin | admin | admin |
| orders | pemilik / admin | user (utk dirinya) | admin | admin |
| order_items | via order induk | (RPC) | – | – |
| storage `product-images` | publik (baca) | admin | admin | admin |

\* role dijaga trigger.

---

## D. Verifikasi RLS (WAJIB diuji sebelum lanjut — Fase 1 acceptance)

Jalankan di SQL Editor sebagai cek logika. Lalu uji nyata dari app di fase berikutnya.

```sql
-- 1) RLS aktif di semua tabel publik (harus mengembalikan 6 baris, semuanya rowsecurity = true)
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('profiles','categories','products','product_images','orders','order_items');

-- 2) Fungsi ada
select proname from pg_proc where proname in ('is_admin','create_order','handle_new_user');

-- 3) Kategori ter-seed
select slug from public.categories order by slug;   -- harus: pria, wanita

-- 4) Bucket storage ada & public
select id, public from storage.buckets where id = 'product-images';
```

**Uji RLS nyata (lakukan di Fase 3–6 setelah app jalan):**
- [ ] User anonim bisa GET daftar produk (katalog publik).
- [ ] User customer TIDAK bisa SELECT order milik orang lain.
- [ ] User customer TIDAK bisa INSERT/UPDATE/DELETE produk (ditolak RLS).
- [ ] User customer TIDAK bisa mengubah `profiles.role` dirinya jadi admin (ditolak trigger).
- [ ] Admin bisa CRUD produk/kategori, melihat semua order & profiles.
- [ ] Dua checkout paralel atas produk stok-1 → hanya satu sukses (yang lain error "Stok habis").

---

## E. Acceptance Criteria — Fase 1 (Database)

- [ ] `schema.sql` dijalankan tanpa error; 6 tabel + 3 fungsi + trigger + policy + bucket ada.
- [ ] `seed.sql` dijalankan; kategori `pria` & `wanita` ada; **ke-12 produk** ter-seed
      (`select count(*) from public.products` = 12).
- [ ] Akun admin dibuat & `profiles.role='admin'` terverifikasi.
- [ ] Query verifikasi §D bagian 1–4 lulus.

Lanjut ke **`03-implementation-phases.md`**.
