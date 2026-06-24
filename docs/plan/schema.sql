-- ============================================================================
-- Rewear Works — Skema Database Supabase (Postgres)
-- Jalankan SEKALI di Supabase Dashboard → SQL Editor (atau via migration).
-- Urutan penting: extension → tabel → fungsi → trigger → RLS → storage.
-- Aman dijalankan ulang (idempotent sebisa mungkin: IF NOT EXISTS / CREATE OR REPLACE).
-- ============================================================================

-- 0) Extensions -------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ============================================================================
-- 1) TABEL
-- ============================================================================

-- 1.1 profiles (1-1 dengan auth.users) -------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  phone       text,
  role        text not null default 'customer' check (role in ('admin','customer')),
  created_at  timestamptz not null default now()
);

-- 1.2 categories ------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  image_url   text,
  created_at  timestamptz not null default now()
);

-- 1.3 products --------------------------------------------------------------
create table if not exists public.products (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  price           integer not null check (price >= 0),          -- Rupiah, tanpa desimal
  original_price  integer check (original_price >= 0),
  category_id     uuid references public.categories(id) on delete set null,
  size            text,
  available_sizes text[] default '{}',
  measurements    jsonb default '{}'::jsonb,
  condition       text,
  brand           text,
  color           text,
  material        text,
  weight          integer,                                      -- gram (utk ongkir kelak)
  description     text,
  video_url       text,
  stock           integer not null default 1 check (stock >= 0),
  status          text not null default 'available' check (status in ('available','sold')),
  featured        boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists products_category_idx on public.products(category_id);
create index if not exists products_status_idx   on public.products(status);
create index if not exists products_featured_idx on public.products(featured);

-- 1.4 product_images --------------------------------------------------------
create table if not exists public.product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  url         text not null,
  position    integer not null default 0,                       -- 0 = foto utama
  created_at  timestamptz not null default now()
);
create index if not exists product_images_product_idx on public.product_images(product_id, position);

-- 1.5 orders ----------------------------------------------------------------
create table if not exists public.orders (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete restrict,
  recipient_name text not null,
  phone          text not null,
  address        text not null,
  notes          text,
  subtotal       integer not null check (subtotal >= 0),
  shipping_cost  integer not null default 0 check (shipping_cost >= 0),
  total          integer not null check (total >= 0),
  status         text not null default 'Baru'
                 check (status in ('Baru','Diproses','Dikirim','Selesai','Dibatalkan')),
  -- Pembayaran (Pakasir) -------------------------------------------------
  payment_status text not null default 'unpaid'
                 check (payment_status in ('unpaid','paid','failed','expired')),
  payment_method text,                                  -- mis. 'qris', 'bni_va' dari webhook
  paid_at        timestamptz,
  created_at     timestamptz not null default now()
);
-- Idempotent: bila tabel sudah ada dari migrasi lama, tambahkan kolom pembayaran.
alter table public.orders add column if not exists payment_status text not null default 'unpaid';
alter table public.orders add column if not exists payment_method text;
alter table public.orders add column if not exists paid_at timestamptz;
create index if not exists orders_user_idx   on public.orders(user_id);
create index if not exists orders_status_idx on public.orders(status);

-- 1.6 order_items -----------------------------------------------------------
create table if not exists public.order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders(id) on delete cascade,
  product_id     uuid references public.products(id) on delete set null,
  name_snapshot  text not null,
  price_snapshot integer not null check (price_snapshot >= 0),
  size_snapshot  text,
  quantity       integer not null default 1 check (quantity > 0)
);
create index if not exists order_items_order_idx on public.order_items(order_id);

-- ============================================================================
-- 2) FUNGSI BANTU
-- ============================================================================

-- 2.1 is_admin(): cek peran TANPA memicu rekursi RLS (SECURITY DEFINER).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- 2.2 handle_new_user(): otomatis buat baris profiles saat user mendaftar.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    'customer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 2.3 prevent_role_escalation(): customer tidak boleh menaikkan perannya sendiri.
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Tidak diizinkan mengubah peran';
  end if;
  return new;
end;
$$;

-- 2.4 create_order(): checkout ATOMIK & AMAN.
--     - Harga diambil dari DB (BUKAN dari client) → cegah manipulasi harga.
--     - Lock baris produk (FOR UPDATE) → cegah double-sell saat race.
--     - Validasi stok & status → gagal total bila ada item tak tersedia.
--     - Kurangi stok; set status 'sold' bila stok habis.
--     p_items : jsonb array, contoh '[{"product_id":"<uuid>","quantity":1}]'
create or replace function public.create_order(
  p_recipient text,
  p_phone     text,
  p_address   text,
  p_notes     text,
  p_shipping  integer,
  p_items     jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_item      jsonb;
  v_pid       uuid;
  v_qty       integer;
  v_product   public.products%rowtype;
  v_subtotal  integer := 0;
  v_order_id  uuid;
begin
  if v_uid is null then
    raise exception 'Harus login untuk membuat pesanan';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Keranjang kosong';
  end if;
  -- Validasi data pengiriman di DALAM RPC (RPC bisa dipanggil langsung, jangan percaya client)
  if coalesce(trim(p_recipient), '') = '' then raise exception 'Nama penerima wajib diisi'; end if;
  if coalesce(trim(p_phone), '')     = '' then raise exception 'Nomor telepon wajib diisi'; end if;
  if coalesce(trim(p_address), '')   = '' then raise exception 'Alamat wajib diisi'; end if;
  -- Ongkir tidak boleh negatif (clamp). Untuk v1 boleh dipaksa 0 (lihat scope C3).
  p_shipping := greatest(coalesce(p_shipping, 0), 0);

  -- buat order header dulu (subtotal/total diisi setelah loop)
  insert into public.orders (user_id, recipient_name, phone, address, notes,
                             subtotal, shipping_cost, total, status)
  values (v_uid, p_recipient, p_phone, p_address, p_notes, 0, p_shipping, 0, 'Baru')
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_pid := (v_item->>'product_id')::uuid;
    v_qty := coalesce((v_item->>'quantity')::integer, 1);
    if v_qty < 1 then v_qty := 1; end if;

    -- KUNCI baris produk agar tidak ada yang beli bersamaan
    select * into v_product from public.products where id = v_pid for update;

    if not found then
      raise exception 'Produk tidak ditemukan: %', v_pid;
    end if;
    if v_product.status <> 'available' or v_product.stock < v_qty then
      raise exception 'Stok habis / tidak tersedia: %', v_product.name;
    end if;

    insert into public.order_items (order_id, product_id, name_snapshot, price_snapshot,
                                    size_snapshot, quantity)
    values (v_order_id, v_product.id, v_product.name, v_product.price, v_product.size, v_qty);

    update public.products
      set stock = stock - v_qty,
          status = case when stock - v_qty <= 0 then 'sold' else status end
      where id = v_pid;

    v_subtotal := v_subtotal + (v_product.price * v_qty);
  end loop;

  update public.orders
    set subtotal = v_subtotal,
        total = v_subtotal + coalesce(p_shipping,0)
    where id = v_order_id;

  return v_order_id;
end;
$$;

-- 2.5 set_user_role(): ubah peran user. HANYA admin (cek is_admin di dalam).
--     Dipakai oleh aksi admin "Tambah Admin" dari sesi admin (BUKAN service-role),
--     supaya tetap melewati pengecekan is_admin() yang membaca auth.uid().
--     Karena SECURITY DEFINER, fungsi ini boleh mengubah role meski trigger
--     prevent_role_escalation aktif (trigger memanggil is_admin() yang true utk admin).
create or replace function public.set_user_role(p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang boleh mengubah peran';
  end if;
  if p_role not in ('admin','customer') then
    raise exception 'Peran tidak valid';
  end if;
  update public.profiles set role = p_role where id = p_user;
end;
$$;

-- 2.6 cancel_order(): batalkan order yg BELUM dibayar & KEMBALIKAN stok produk.
--     Dipakai saat pembayaran gagal/expired/dibatalkan (mis. dari admin atau dari aksi server
--     setelah cek status Pakasir). Hanya admin (UI) ATAU pemilik order itu sendiri yang boleh.
--     Tidak mengembalikan stok bila order sudah 'paid' (cegah lepas stok barang yg sudah dibayar).
create or replace function public.cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item  public.order_items%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order tidak ditemukan'; end if;
  if not (public.is_admin() or v_order.user_id = auth.uid()) then
    raise exception 'Tidak diizinkan';
  end if;
  if v_order.payment_status = 'paid' then
    raise exception 'Order sudah dibayar, tidak bisa dibatalkan';
  end if;
  if v_order.status = 'Dibatalkan' then return; end if;   -- idempotent

  -- kembalikan stok tiap item
  for v_item in select * from public.order_items where order_id = p_order_id loop
    if v_item.product_id is not null then
      update public.products
        set stock = stock + v_item.quantity, status = 'available'
        where id = v_item.product_id;
    end if;
  end loop;

  update public.orders
    set status = 'Dibatalkan', payment_status = 'failed'
    where id = p_order_id;
end;
$$;

-- ============================================================================
-- 2.9) HAK EKSEKUSI FUNGSI (hardening): cabut dari publik/anon, beri ke authenticated
-- ============================================================================
revoke execute on function public.create_order(text,text,text,text,integer,jsonb) from public, anon;
grant  execute on function public.create_order(text,text,text,text,integer,jsonb) to authenticated;

revoke execute on function public.set_user_role(uuid,text) from public, anon;
grant  execute on function public.set_user_role(uuid,text) to authenticated;

revoke execute on function public.cancel_order(uuid) from public, anon;
grant  execute on function public.cancel_order(uuid) to authenticated;

-- ============================================================================
-- 3) TRIGGERS
-- ============================================================================
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists trg_prevent_role_escalation on public.profiles;
create trigger trg_prevent_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_escalation();

-- ============================================================================
-- 4) ROW LEVEL SECURITY
--    Aktifkan RLS di semua tabel, lalu definisikan policy.
-- ============================================================================
alter table public.profiles       enable row level security;
alter table public.categories     enable row level security;
alter table public.products       enable row level security;
alter table public.product_images enable row level security;
alter table public.orders         enable row level security;
alter table public.order_items    enable row level security;

-- 4.1 profiles --------------------------------------------------------------
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using ( id = auth.uid() or public.is_admin() );

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using ( id = auth.uid() or public.is_admin() )
  with check ( id = auth.uid() or public.is_admin() );
-- (perubahan kolom role dijaga oleh trigger prevent_role_escalation)

drop policy if exists "profiles_delete_admin" on public.profiles;
create policy "profiles_delete_admin" on public.profiles
  for delete using ( public.is_admin() );
-- INSERT profiles hanya via trigger handle_new_user (security definer) → tak perlu policy insert.

-- 4.2 categories: publik boleh baca; hanya admin tulis ----------------------
drop policy if exists "categories_select_all" on public.categories;
create policy "categories_select_all" on public.categories
  for select using ( true );

drop policy if exists "categories_write_admin" on public.categories;
create policy "categories_write_admin" on public.categories
  for all using ( public.is_admin() ) with check ( public.is_admin() );

-- 4.3 products: publik boleh baca; hanya admin tulis ------------------------
drop policy if exists "products_select_all" on public.products;
create policy "products_select_all" on public.products
  for select using ( true );

drop policy if exists "products_write_admin" on public.products;
create policy "products_write_admin" on public.products
  for all using ( public.is_admin() ) with check ( public.is_admin() );

-- 4.4 product_images: publik baca; admin tulis ------------------------------
drop policy if exists "product_images_select_all" on public.product_images;
create policy "product_images_select_all" on public.product_images
  for select using ( true );

drop policy if exists "product_images_write_admin" on public.product_images;
create policy "product_images_write_admin" on public.product_images
  for all using ( public.is_admin() ) with check ( public.is_admin() );

-- 4.5 orders: pemilik atau admin baca; user buat order sendiri; admin kelola -
drop policy if exists "orders_select_own_or_admin" on public.orders;
create policy "orders_select_own_or_admin" on public.orders
  for select using ( user_id = auth.uid() or public.is_admin() );

drop policy if exists "orders_insert_self" on public.orders;
create policy "orders_insert_self" on public.orders
  for insert with check ( user_id = auth.uid() );

drop policy if exists "orders_update_admin" on public.orders;
create policy "orders_update_admin" on public.orders
  for update using ( public.is_admin() ) with check ( public.is_admin() );

drop policy if exists "orders_delete_admin" on public.orders;
create policy "orders_delete_admin" on public.orders
  for delete using ( public.is_admin() );

-- 4.6 order_items: ikut kepemilikan order induk -----------------------------
drop policy if exists "order_items_select" on public.order_items;
create policy "order_items_select" on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and ( o.user_id = auth.uid() or public.is_admin() )
    )
  );
-- INSERT order_items dilakukan via RPC create_order (security definer) → tak perlu policy insert.
-- (Bila admin perlu hapus item manual, tambahkan policy delete admin sesuai kebutuhan.)

-- ============================================================================
-- 5) STORAGE (bucket foto produk)
--    Buat bucket lewat Dashboard ATAU SQL di bawah. Bucket PUBLIC (baca publik).
--    Tulis (upload/hapus) hanya untuk admin (RLS di storage.objects).
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read" on storage.objects
  for select using ( bucket_id = 'product-images' );

drop policy if exists "product_images_admin_write" on storage.objects;
create policy "product_images_admin_write" on storage.objects
  for insert with check ( bucket_id = 'product-images' and public.is_admin() );

drop policy if exists "product_images_admin_update" on storage.objects;
create policy "product_images_admin_update" on storage.objects
  for update using ( bucket_id = 'product-images' and public.is_admin() );

drop policy if exists "product_images_admin_delete" on storage.objects;
create policy "product_images_admin_delete" on storage.objects
  for delete using ( bucket_id = 'product-images' and public.is_admin() );

-- ============================================================================
-- SELESAI. Lanjut jalankan seed.sql untuk kategori + produk awal.
-- ============================================================================
