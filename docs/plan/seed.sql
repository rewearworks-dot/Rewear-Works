-- ============================================================================
-- Rewear Works — Seed Data
-- Jalankan SETELAH schema.sql berhasil.
-- ============================================================================

-- 1) KATEGORI ---------------------------------------------------------------
-- PENTING: slug 'pria' & 'wanita' dipakai langsung oleh UI (Navbar, Home,
-- Shop ?category=pria/wanita). JANGAN ubah slug ini.
insert into public.categories (name, slug, description) values
  ('Pria',   'pria',   'Koleksi fashion preloved untuk pria'),
  ('Wanita', 'wanita', 'Koleksi fashion preloved untuk wanita')
on conflict (slug) do nothing;

-- 2) PRODUK (12 produk dari src/data/products.json) -------------------------
-- Pemetaan kolom: originalPrice->original_price, availableSizes->available_sizes,
-- measurements->jsonb, category (cat-1/cat-2)->category_id via slug 'pria'/'wanita'.
-- Gambar TIDAK dimasukkan di sini (foto diupload ke Storage + product_images di Fase 4/5).
-- Catatan: apostrof dalam teks ditulis ganda ('') — lihat Levi''s.
insert into public.products
  (name, price, original_price, category_id, size, available_sizes, measurements,
   condition, brand, color, material, description, stock, status, featured)
values
('Jaket Denim Vintage', 185000, 350000, (select id from public.categories where slug='pria'),
 'L', array['M','L','XL'],
 '{"lingkarDada":"108 cm","panjangBaju":"68 cm","lebarBahu":"48 cm","panjangLengan":"63 cm"}'::jsonb,
 'Sangat Baik','Levi''s','Blue Wash','100% Cotton Denim',
 'Jaket denim vintage Levi''s original dalam kondisi sangat baik. Warna blue wash classic, cocok untuk gaya casual maupun semi-formal.',
 1,'available',true),

('Kemeja Flannel Kotak', 95000, 200000, (select id from public.categories where slug='pria'),
 'M', array['S','M','L'],
 '{"lingkarDada":"104 cm","panjangBaju":"72 cm","lebarBahu":"46 cm","panjangLengan":"60 cm"}'::jsonb,
 'Baik','Uniqlo','Merah-Hitam','100% Cotton Flannel',
 'Kemeja flannel motif kotak-kotak dari Uniqlo. Bahan tebal dan nyaman, cocok untuk musim hujan atau hangout.',
 1,'available',false),

('Hoodie Champion Classic', 225000, 500000, (select id from public.categories where slug='pria'),
 'XL', array['L','XL','XXL'],
 '{"lingkarDada":"118 cm","panjangBaju":"74 cm","lebarBahu":"54 cm","panjangLengan":"66 cm"}'::jsonb,
 'Sangat Baik','Champion','Heather Grey','80% Cotton, 20% Polyester Fleece',
 'Hoodie Champion original dengan logo bordir di dada. Bahan fleece tebal, sangat nyaman dan hangat.',
 1,'available',true),

('Celana Chino Slim Fit', 120000, 280000, (select id from public.categories where slug='pria'),
 '32', array['30','32','34'],
 '{"lingkarPinggang":"82 cm","lingkarPinggul":"100 cm","panjangCelana":"102 cm","lebarKaki":"17 cm"}'::jsonb,
 'Baik','H&M','Khaki','98% Cotton, 2% Elastane',
 'Celana chino slim fit dari H&M warna khaki. Cocok untuk ke kantor atau acara semi-formal.',
 2,'available',false),

('Kaos Graphic Stussy', 150000, 350000, (select id from public.categories where slug='pria'),
 'M', array['S','M','L','XL'],
 '{"lingkarDada":"104 cm","panjangBaju":"70 cm","lebarBahu":"46 cm","panjangLengan":"21 cm"}'::jsonb,
 'Sangat Baik','Stussy','Hitam','100% Cotton',
 'Kaos graphic tee Stussy original dengan print logo classic di depan. Bahan cotton 100% sangat nyaman.',
 1,'available',true),

('Sneakers Nike Air Force 1', 450000, 1200000, (select id from public.categories where slug='pria'),
 '42', array['40','41','42','43','44'],
 '{"panjangInsole":"27 cm","lebarInsole":"10 cm"}'::jsonb,
 'Baik','Nike','Triple White','Leather, Rubber Sole',
 'Nike Air Force 1 Low white original. Kondisi baik, sole masih tebal. Termasuk box original.',
 1,'available',true),

('Dress Floral Vintage', 135000, 300000, (select id from public.categories where slug='wanita'),
 'S', array['XS','S','M'],
 '{"lingkarDada":"86 cm","lingkarPinggang":"68 cm","panjangBaju":"98 cm","lebarBahu":"36 cm"}'::jsonb,
 'Sangat Baik','Zara','Floral Pink','100% Viscose',
 'Dress floral vintage dari Zara dengan motif bunga-bunga cantik. Bahan ringan dan jatuh, cocok untuk acara casual.',
 1,'available',true),

('Blazer Oversized', 195000, 450000, (select id from public.categories where slug='wanita'),
 'M', array['S','M','L'],
 '{"lingkarDada":"100 cm","panjangBaju":"76 cm","lebarBahu":"44 cm","panjangLengan":"60 cm"}'::jsonb,
 'Sangat Baik','Mango','Beige','65% Polyester, 35% Viscose',
 'Blazer oversized dari Mango warna beige. Potongan modern dan elegan, bisa dipakai formal maupun casual.',
 1,'available',true),

('Cardigan Rajut Korea', 110000, 250000, (select id from public.categories where slug='wanita'),
 'Free Size', array['Free Size'],
 '{"lingkarDada":"110 cm","panjangBaju":"62 cm","panjangLengan":"56 cm"}'::jsonb,
 'Baik','Cotton On','Pastel Lilac','70% Acrylic, 30% Nylon',
 'Cardigan rajut style Korea dari Cotton On. Warna pastel, bahan lembut dan tidak gatal.',
 2,'available',false),

('Rok Mini Plaid', 85000, 180000, (select id from public.categories where slug='wanita'),
 'S', array['XS','S','M'],
 '{"lingkarPinggang":"66 cm","lingkarPinggul":"90 cm","panjangRok":"42 cm"}'::jsonb,
 'Baik','Pull & Bear','Red Plaid','80% Polyester, 20% Wool',
 'Rok mini motif plaid dari Pull & Bear. Gaya preppy yang timeless, cocok dipadukan dengan sweater atau kaos.',
 1,'available',false),

('Tas Tote Bag Canvas', 175000, 400000, (select id from public.categories where slug='wanita'),
 'One Size', array['One Size'],
 '{"panjang":"38 cm","tinggi":"30 cm","lebar":"12 cm","panjangTali":"55 cm"}'::jsonb,
 'Sangat Baik','Coach','Brown Canvas','Canvas, Leather Strap',
 'Tote bag canvas Coach original. Ukuran besar, muat laptop 14 inch. Tali kulit asli.',
 1,'available',true),

('Sepatu Heels Vintage', 165000, 380000, (select id from public.categories where slug='wanita'),
 '38', array['36','37','38','39'],
 '{"panjangInsole":"24.5 cm","tinggiHeel":"5 cm"}'::jsonb,
 'Baik','Charles & Keith','Nude','Faux Leather, Rubber Sole',
 'Sepatu heels vintage dari Charles & Keith. Tinggi 5cm, nyaman dipakai seharian. Warna nude classic.',
 1,'available',false);

-- 3) JADIKAN ADMIN (bootstrap admin pertama) --------------------------------
-- User auth TIDAK bisa dibuat lewat SQL biasa. Langkah:
--   1. Supabase Dashboard → Authentication → Users → "Add user".
--      Email: admin@rewearworks.com  | Password: (pilih kuat) | "Auto Confirm User": ON.
--   2. Trigger handle_new_user otomatis membuat baris profiles (role 'customer').
--   3. Jalankan blok di bawah untuk menaikkan ke admin.
--
-- CATATAN PENTING: di SQL Editor `auth.uid()` = NULL, sehingga trigger prevent_role_escalation
-- akan MENOLAK UPDATE role biasa. Untuk bootstrap admin PERTAMA, matikan trigger sesaat:
alter table public.profiles disable trigger trg_prevent_role_escalation;

update public.profiles
set role = 'admin', full_name = coalesce(nullif(full_name,''), 'Admin Rewear')
where id = (select id from auth.users where email = 'admin@rewearworks.com');

alter table public.profiles enable trigger trg_prevent_role_escalation;

-- Verifikasi (harus: admin | admin@rewearworks.com):
-- select p.role, u.email from public.profiles p join auth.users u on u.id = p.id
-- where u.email = 'admin@rewearworks.com';
--
-- Admin BERIKUTNYA dibuat lewat UI (Fase 7.5) yang memakai RPC set_user_role dari sesi admin —
-- tidak perlu menyentuh trigger lagi.
