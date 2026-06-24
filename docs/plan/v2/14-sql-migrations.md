# 14 — Migrasi SQL v2 (lengkap & siap jalan)

Semua migrasi v2 dikumpulkan di sini dengan **body lengkap, idempoten, dan urut**. Salin tiap blok
ke file di `docs/plan/v2/sql/` (nama sesuai judul), lalu jalankan **berurutan** di Supabase SQL
Editor. Jangan mengedit `docs/plan/schema.sql` v1 yang sudah dijalankan — ini tambahan.

> Konvensi: `create table if not exists`, `create or replace function`, `drop policy if exists`
> sebelum `create policy`. Semua tabel baru `enable row level security`. Semua fungsi DEFINER
> ber-`set search_path = public`.

**Urutan jalankan:**
1. `v2_0001_orders_expiry.sql`
2. `v2_0002_wishlist.sql`
3. `v2_0003_reviews.sql`
4. `v2_0004_addresses.sql`
5. `v2_0005_audit_log.sql`
6. `v2_0006_vouchers.sql` (opsional)
7. `v2_0007_product_search.sql`
8. `v2_0008_order_events.sql`
9. `v2_0009_rate_limit.sql` (jika pakai Opsi B rate limit)

---

## v2_0001_orders_expiry.sql — batas bayar + auto-expire + customer_email

> Menambah `expires_at` & `customer_email` ke `orders`, dan **mengganti** `create_order` agar
> mengisi keduanya. Body `create_order` di bawah = versi v1 + tambahan (expires_at, customer_email,
> auth email). Bandingkan dengan `docs/plan/schema.sql` v1 agar tidak menghilangkan logika.

```sql
-- 1) Kolom baru
alter table public.orders add column if not exists expires_at timestamptz;
alter table public.orders add column if not exists customer_email text;

-- 2) Ganti create_order (v1 + expires_at + customer_email)
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
  v_email     text := auth.email();
  v_item      jsonb;
  v_pid       uuid;
  v_qty       integer;
  v_product   public.products%rowtype;
  v_subtotal  integer := 0;
  v_order_id  uuid;
begin
  if v_uid is null then raise exception 'Harus login untuk membuat pesanan'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'Keranjang kosong'; end if;
  if coalesce(trim(p_recipient),'') = '' then raise exception 'Nama penerima wajib diisi'; end if;
  if coalesce(trim(p_phone),'')     = '' then raise exception 'Nomor telepon wajib diisi'; end if;
  if coalesce(trim(p_address),'')   = '' then raise exception 'Alamat wajib diisi'; end if;
  p_shipping := greatest(coalesce(p_shipping,0),0);

  insert into public.orders (user_id, customer_email, recipient_name, phone, address, notes,
                             subtotal, shipping_cost, total, status, payment_status, expires_at)
  values (v_uid, v_email, p_recipient, p_phone, p_address, p_notes,
          0, p_shipping, 0, 'Baru', 'unpaid', now() + interval '2 hours')
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_pid := (v_item->>'product_id')::uuid;
    v_qty := coalesce((v_item->>'quantity')::integer, 1);
    if v_qty < 1 then v_qty := 1; end if;

    select * into v_product from public.products where id = v_pid for update;
    if not found then raise exception 'Produk tidak ditemukan: %', v_pid; end if;
    if v_product.status <> 'available' or v_product.stock < v_qty then
      raise exception 'Stok habis / tidak tersedia: %', v_product.name;
    end if;

    insert into public.order_items (order_id, product_id, name_snapshot, price_snapshot, size_snapshot, quantity)
    values (v_order_id, v_product.id, v_product.name, v_product.price, v_product.size, v_qty);

    update public.products
      set stock = stock - v_qty,
          status = case when stock - v_qty <= 0 then 'sold' else status end
      where id = v_pid;

    v_subtotal := v_subtotal + (v_product.price * v_qty);
  end loop;

  update public.orders set subtotal = v_subtotal, total = v_subtotal + p_shipping where id = v_order_id;
  return v_order_id;
end;
$$;

-- 3) Fungsi expire (dipanggil cron/service-role saja)
create or replace function public.expire_unpaid_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_order record; v_count integer := 0;
begin
  for v_order in
    select id from public.orders
    where payment_status = 'unpaid' and status <> 'Dibatalkan'
      and expires_at is not null and expires_at < now()
  loop
    update public.products p
      set stock = p.stock + oi.quantity, status = 'available'
      from public.order_items oi
      where oi.order_id = v_order.id and oi.product_id = p.id;
    update public.orders set status = 'Dibatalkan', payment_status = 'expired' where id = v_order.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function public.expire_unpaid_orders() from public, anon, authenticated;

-- 4) (Opsi pg_cron) jadwalkan tiap 15 menit — aktifkan extension pg_cron dulu di Dashboard
-- select cron.schedule('expire-unpaid-orders', '*/15 * * * *', $$ select public.expire_unpaid_orders(); $$);
```

---

## v2_0002_wishlist.sql

```sql
create table if not exists public.wishlists (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
create index if not exists wishlists_user_idx on public.wishlists(user_id);
alter table public.wishlists enable row level security;
drop policy if exists "wishlist_own" on public.wishlists;
create policy "wishlist_own" on public.wishlists
  for all using ( user_id = auth.uid() ) with check ( user_id = auth.uid() );
```

---

## v2_0003_reviews.sql

```sql
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  unique (product_id, user_id)
);
create index if not exists reviews_product_idx on public.reviews(product_id);
alter table public.reviews enable row level security;

drop policy if exists "reviews_read_all" on public.reviews;
create policy "reviews_read_all" on public.reviews for select using ( true );

drop policy if exists "reviews_insert_buyer" on public.reviews;
create policy "reviews_insert_buyer" on public.reviews for insert with check (
  user_id = auth.uid() and exists (
    select 1 from public.orders o join public.order_items oi on oi.order_id = o.id
    where o.user_id = auth.uid() and oi.product_id = reviews.product_id and o.payment_status = 'paid'
  )
);
drop policy if exists "reviews_update_own" on public.reviews;
create policy "reviews_update_own" on public.reviews for update using ( user_id = auth.uid() ) with check ( user_id = auth.uid() );

drop policy if exists "reviews_delete_own_or_admin" on public.reviews;
create policy "reviews_delete_own_or_admin" on public.reviews for delete using ( user_id = auth.uid() or public.is_admin() );

-- View agregat rating (opsional, mempermudah tampil bintang)
create or replace view public.product_ratings as
  select product_id, round(avg(rating)::numeric, 1) as avg_rating, count(*) as review_count
  from public.reviews group by product_id;
```

---

## v2_0004_addresses.sql

```sql
create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text,
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

-- Pastikan hanya satu default per user (opsional, via trigger)
create or replace function public.enforce_single_default_address()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_default then
    update public.addresses set is_default = false
      where user_id = new.user_id and id <> new.id and is_default = true;
  end if;
  return new;
end; $$;
drop trigger if exists trg_single_default_address on public.addresses;
create trigger trg_single_default_address
  after insert or update of is_default on public.addresses
  for each row when (new.is_default) execute function public.enforce_single_default_address();
```

---

## v2_0005_audit_log.sql

```sql
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor uuid references public.profiles(id) on delete set null,
  action text not null,
  entity text,
  entity_id text,
  meta jsonb default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);
alter table public.audit_logs enable row level security;
drop policy if exists "audit_read_admin" on public.audit_logs;
create policy "audit_read_admin" on public.audit_logs for select using ( public.is_admin() );
-- INSERT via fungsi DEFINER (dipanggil Server Action) atau service-role; tak ada policy insert utk user.

create or replace function public.log_audit(p_action text, p_entity text, p_entity_id text, p_meta jsonb, p_ip text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs (actor, action, entity, entity_id, meta, ip)
  values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_meta,'{}'::jsonb), p_ip);
end; $$;
revoke execute on function public.log_audit(text,text,text,jsonb,text) from public, anon;
grant execute on function public.log_audit(text,text,text,jsonb,text) to authenticated;
```

---

## v2_0006_vouchers.sql (opsional)

```sql
create table if not exists public.vouchers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null check (type in ('percent','fixed')),
  value int not null check (value >= 0),
  min_subtotal int not null default 0,
  max_uses int,
  used_count int not null default 0,
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.vouchers enable row level security;
drop policy if exists "vouchers_read_active" on public.vouchers;
create policy "vouchers_read_active" on public.vouchers for select using ( active = true or public.is_admin() );
drop policy if exists "vouchers_write_admin" on public.vouchers;
create policy "vouchers_write_admin" on public.vouchers for all using ( public.is_admin() ) with check ( public.is_admin() );

-- Validasi+pakai voucher di dalam create_order: tambahkan param p_voucher_code text dan,
-- setelah menghitung v_subtotal, lakukan (dalam transaksi yang sama):
--   select * into v_voucher from public.vouchers where code = p_voucher_code and active for update;
--   -- cek expires_at, min_subtotal, max_uses; hitung diskon; kurangi total; used_count += 1
-- JANGAN hitung diskon di client. (Buat versi create_order baru bernomor migrasi bila dipakai.)
```

---

## v2_0007_product_search.sql

```sql
create extension if not exists pg_trgm;
create index if not exists products_name_trgm  on public.products using gin (name gin_trgm_ops);
create index if not exists products_brand_trgm on public.products using gin (brand gin_trgm_ops);
-- (Opsional full-text Bahasa Indonesia: tambah kolom tsvector + trigger + index GIN.)
```

---

## v2_0008_order_events.sql

```sql
create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists order_events_order_idx on public.order_events(order_id, created_at);
alter table public.order_events enable row level security;
drop policy if exists "order_events_read" on public.order_events;
create policy "order_events_read" on public.order_events for select using (
  exists (select 1 from public.orders o where o.id = order_events.order_id
          and (o.user_id = auth.uid() or public.is_admin()))
);

-- Catat otomatis setiap perubahan status order
create or replace function public.log_order_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') or (new.status is distinct from old.status) then
    insert into public.order_events (order_id, status) values (new.id, new.status);
  end if;
  return new;
end; $$;
drop trigger if exists trg_log_order_status on public.orders;
create trigger trg_log_order_status
  after insert or update of status on public.orders
  for each row execute function public.log_order_status();
```

---

## v2_0009_rate_limit.sql (jika pakai rate limit berbasis DB — Opsi B)

```sql
create table if not exists public.rate_limits (
  key text primary key,
  count int not null default 0,
  window_start timestamptz not null default now()
);
alter table public.rate_limits enable row level security;
-- tak ada policy untuk user; diakses hanya via service-role / fungsi DEFINER.

create or replace function public.check_rate_limit(p_key text, p_max int, p_window interval)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_row public.rate_limits%rowtype;
begin
  select * into v_row from public.rate_limits where key = p_key for update;
  if not found then
    insert into public.rate_limits (key, count, window_start) values (p_key, 1, now());
    return true;
  end if;
  if v_row.window_start < now() - p_window then
    update public.rate_limits set count = 1, window_start = now() where key = p_key;
    return true;
  end if;
  if v_row.count >= p_max then return false; end if;
  update public.rate_limits set count = count + 1 where key = p_key;
  return true;
end; $$;
revoke execute on function public.check_rate_limit(text,int,interval) from public, anon;
-- panggil via service-role (admin client) dari Server Action; ATAU grant ke authenticated bila perlu.
```

---

## Verifikasi setelah semua migrasi
```sql
-- RLS aktif di semua tabel baru
select tablename, rowsecurity from pg_tables where schemaname='public'
 and tablename in ('wishlists','reviews','addresses','audit_logs','vouchers','order_events','rate_limits');
-- semua harus true.

-- Fungsi baru ada
select proname from pg_proc where pronamespace='public'::regnamespace
 and proname in ('expire_unpaid_orders','log_audit','log_order_status','check_rate_limit','enforce_single_default_address');
```
Lanjut ke **`15-edge-cases-and-gotchas.md`**.
