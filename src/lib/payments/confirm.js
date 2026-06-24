import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTransactionDetail } from '@/lib/payments/pakasir';

// Verifikasi otoritatif ke Pakasir lalu tandai lunas. Idempoten.
// Sumber kebenaran tunggal — dipakai webhook (service-role) DAN success page.
// Memakai admin client agar bypass RLS (RLS hanya izinkan admin update orders;
// pelanggan tidak bisa update sendiri → ini memperbaiki bug "berhasil di layar,
// unpaid di DB").
export async function confirmPaymentByOrderId(orderId) {
  const supabase = createAdminClient();
  const { data: order } = await supabase
    .from('orders').select('id, total, status, payment_status, needs_review')
    .eq('id', orderId).maybeSingle();
  if (!order) return { status: 'not_found' };
  if (order.payment_status === 'paid') return { status: 'paid' };       // idempoten

  // Guard race: order batal/kadaluwarsa. JANGAN langsung tandai needs_review —
  // verifikasi dulu ke Pakasir apakah pembayaran BENAR-BENAR masuk (cegah flag palsu
  // bila webhook terbuka / di-POST sembarang order_id). Hanya set needs_review bila
  // transaksi benar-benar completed dengan jumlah cocok.
  if (order.status === 'Dibatalkan' ||
      order.payment_status === 'expired' || order.payment_status === 'failed') {
    const tx = await getTransactionDetail({ amount: order.total, orderId: order.id });
    if (tx && tx.status === 'completed' && Number(tx.amount) === Number(order.total)) {
      if (!order.needs_review) {
        await supabase.from('orders').update({ needs_review: true }).eq('id', order.id);
      }
      return { status: 'needs_manual' };
    }
    // batal/kadaluwarsa biasa tanpa pembayaran
    return { status: 'cancelled' };
  }

  const tx = await getTransactionDetail({ amount: order.total, orderId: order.id });
  if (!tx || tx.status !== 'completed' || Number(tx.amount) !== Number(order.total)) {
    return { status: 'unverified' };
  }
  await supabase.from('orders').update({
    payment_status: 'paid',
    payment_method: tx.payment_method ?? null,
    paid_at: tx.completed_at ?? new Date().toISOString(),
  }).eq('id', order.id);
  return { status: 'paid' };
}
