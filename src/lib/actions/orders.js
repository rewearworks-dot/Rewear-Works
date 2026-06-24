'use server';
import { revalidatePath } from 'next/cache';
import { requireAuth, requireAdmin } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import { OrderSchema } from '@/lib/validation';
import { z } from 'zod';
import { buildPayUrl } from '@/lib/payments/pakasir';

export async function createOrder(payload) {
  await requireAuth();
  const parsed = OrderSchema.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_order', {
    p_recipient: parsed.data.recipient,
    p_phone: parsed.data.phone,
    p_address: parsed.data.address,
    p_notes: parsed.data.notes ?? '',
    p_shipping: 0,
    p_items: parsed.data.items,
  });
  if (error) return { error: 'Sebagian barang tidak tersedia. Periksa keranjang.' };

  const orderId = data;
  // Ambil total untuk pay URL
  const { data: ord, error: ordErr } = await supabase
    .from('orders').select('total').eq('id', orderId).single();

  revalidatePath('/profile');

  // B3: jangan biarkan ord.total melempar bila query gagal — order sudah terbuat,
  // jadi tetap sukses; pembeli bisa membayar dari halaman sukses/profil.
  if (ordErr || !ord) {
    return { ok: true, orderId, payUrl: null };
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL || '';
  const payUrl = buildPayUrl({
    total: ord.total,
    orderId,
    redirectUrl: `${site}/checkout/success?order_id=${orderId}`,
  });

  return { ok: true, orderId, payUrl };
}

export async function cancelOrder(orderId) {
  await requireAuth();
  if (!z.string().uuid().safeParse(orderId).success) return { error: 'Order tidak valid' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('cancel_order', { p_order_id: orderId });
  if (error) return { error: error.message || 'Gagal membatalkan pesanan' };
  revalidatePath('/profile');
  revalidatePath('/admin/orders');
  revalidatePath('/shop');
  revalidatePath('/');
  return { ok: true };
}

// C1: bangun ulang URL bayar untuk order milik sendiri yang belum lunas.
export async function getOrderPayUrl(orderId) {
  await requireAuth();
  if (!z.string().uuid().safeParse(orderId).success) return { error: 'Order tidak valid' };
  const supabase = await createClient();
  // RLS membatasi: hanya order milik user (atau admin) yang terbaca.
  const { data: ord, error } = await supabase
    .from('orders').select('id, total, payment_status, status')
    .eq('id', orderId).maybeSingle();
  if (error || !ord) return { error: 'Pesanan tidak ditemukan' };
  if (ord.payment_status === 'paid') return { error: 'Pesanan sudah dibayar' };
  if (ord.status === 'Dibatalkan') return { error: 'Pesanan sudah dibatalkan' };

  const site = process.env.NEXT_PUBLIC_SITE_URL || '';
  const payUrl = buildPayUrl({
    total: ord.total,
    orderId: ord.id,
    redirectUrl: `${site}/checkout/success?order_id=${ord.id}`,
  });
  if (!payUrl) return { error: 'Pembayaran belum dikonfigurasi' };
  return { ok: true, payUrl };
}

export async function updateOrderStatus(orderId, status) {
  await requireAdmin();
  const STATUSES = ['Baru', 'Diproses', 'Dikirim', 'Selesai', 'Dibatalkan'];
  if (!z.string().uuid().safeParse(orderId).success) return { error: 'Order tidak valid' };
  if (!STATUSES.includes(status)) return { error: 'Status tidak valid' };

  const supabase = await createClient();

  // Jika dibatalkan, gunakan RPC cancel_order agar stok dikembalikan
  if (status === 'Dibatalkan') {
    const { error } = await supabase.rpc('cancel_order', { p_order_id: orderId });
    if (error) return { error: error.message || 'Gagal membatalkan pesanan' };
  } else {
    // 1.3: cegah fulfilment order yang belum lunas (risiko kirim barang belum dibayar)
    const FULFILLMENT = ['Diproses', 'Dikirim', 'Selesai'];
    if (FULFILLMENT.includes(status)) {
      const { data: o } = await supabase.from('orders')
        .select('payment_status').eq('id', orderId).single();
      if (o?.payment_status !== 'paid') {
        return { error: 'Pesanan belum dibayar — tidak bisa diproses/dikirim.' };
      }
    }
    const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
    if (error) return { error: 'Gagal memperbarui status' };
  }

  revalidatePath('/admin/orders');
  revalidatePath('/profile');
  return { ok: true };
}
