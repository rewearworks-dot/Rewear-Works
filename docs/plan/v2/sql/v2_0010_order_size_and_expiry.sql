-- ============================================================================
-- v2_0010 — create_order: simpan ukuran pilihan pembeli + batas bayar/expiry
-- ----------------------------------------------------------------------------
-- Menggabungkan dua perbaikan kritis pada RPC create_order:
--   (A1) size_snapshot diambil dari ukuran yang DIPILIH pembeli (item.size),
--        bukan kolom default produk. Multi-ukuran (S/M/L) kini tercatat benar.
--   (A2) expires_at diisi (batas bayar 2 jam) agar stok order yang tak dibayar
--        bisa dikembalikan otomatis oleh expire_unpaid_orders().
--
-- Idempoten & aman dijalankan ulang. Jalankan SETELAH schema.sql v1.
-- (Menggantikan/menyatukan v2_0001_orders_expiry.sql bila itu belum dijalankan.)
-- ============================================================================

-- 1) Kolom pendukung
alter table public.orders add column if not exists expires_at     timestamptz;
alter table public.orders add column if not exists customer_email text;

-- 2) create_order: terima p_items berisi { product_id, quantity, size? }
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
  v_size      text;
  v_product   public.products%rowtype;
  v_subtotal  integer := 0;
  v_order_id  uuid;
begin
  if v_uid is null then raise exception 'Harus login untuk membuat pesanan'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'Keranjang kosong'; end if;
  if coalesce(trim(p_recipient),'') = '' then raise exception 'Nama penerima wajib diisi'; end if;
  if coalesce(trim(p_phone),'')     = '' then raise exception 'Nomor telepon wajib diisi'; end if;
  if coalesce(trim(p_address),'')   = '' then raise exception 'Alamat wajib diisi'; end if;
  p_shipping := greatest(coalesce(p_shipping, 0), 0);

  insert into public.orders (user_id, customer_email, recipient_name, phone, address, notes,
                             subtotal, shipping_cost, total, status, payment_status, expires_at)
  values (v_uid, v_email, p_recipient, p_phone, p_address, p_notes,
          0, p_shipping, 0, 'Baru', 'unpaid', now() + interval '2 hours')
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_pid  := (v_item->>'product_id')::uuid;
    v_qty  := coalesce((v_item->>'quantity')::integer, 1);
    v_size := nullif(trim(coalesce(v_item->>'size','')), '');
    if v_qty < 1 then v_qty := 1; end if;

    -- KUNCI baris produk agar tidak ada yang beli bersamaan
    select * into v_product from public.products where id = v_pid for update;
    if not found then raise exception 'Produk tidak ditemukan: %', v_pid; end if;
    if v_product.status <> 'available' or v_product.stock < v_qty then
      raise exception 'Stok habis / tidak tersedia: %', v_product.name;
    end if;

    -- size_snapshot: pakai ukuran pilihan pembeli; fallback ke ukuran default produk
    insert into public.order_items (order_id, product_id, name_snapshot, price_snapshot,
                                    size_snapshot, quantity)
    values (v_order_id, v_product.id, v_product.name, v_product.price,
            coalesce(v_size, v_product.size), v_qty);

    update public.products
      set stock = stock - v_qty,
          status = case when stock - v_qty <= 0 then 'sold' else status end
      where id = v_pid;

    v_subtotal := v_subtotal + (v_product.price * v_qty);
  end loop;

  update public.orders
    set subtotal = v_subtotal,
        total = v_subtotal + coalesce(p_shipping, 0)
    where id = v_order_id;

  return v_order_id;
end;
$$;

-- 3) Auto-expire order yang belum dibayar & kembalikan stok (dipanggil cron/service-role)
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

-- 4) Hak eksekusi (signature tidak berubah, tetapi pastikan tetap benar)
revoke execute on function public.create_order(text,text,text,text,integer,jsonb) from public, anon;
grant  execute on function public.create_order(text,text,text,text,integer,jsonb) to authenticated;

-- 5) (Opsi pg_cron) jadwalkan tiap 15 menit:
-- select cron.schedule('expire-unpaid-orders', '*/15 * * * *', $$ select public.expire_unpaid_orders(); $$);
