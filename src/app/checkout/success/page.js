import Link from 'next/link';
import { requireAuth } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import { confirmPaymentByOrderId } from '@/lib/payments/confirm';
import { formatCurrency } from '@/utils/helpers';

export default async function CheckoutSuccessPage({ searchParams }) {
  const { order_id } = await searchParams;
  const { user } = await requireAuth();

  const supabase = await createClient();
  const { data: order } = await supabase.from('orders')
    .select('id, total, payment_status, status, recipient_name, needs_review')
    .eq('id', order_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!order) {
    return (
      <div className="page-enter" style={{ marginTop: 'var(--navbar-height)', minHeight: '80vh' }}>
        <div className="container section">
          <div className="empty-state">
            <h3>Pesanan tidak ditemukan</h3>
            <Link href="/" className="btn btn-primary" style={{ marginTop: 16 }}>Kembali ke Beranda</Link>
          </div>
        </div>
      </div>
    );
  }

  // Konfirmasi pembayaran via fungsi terpusat (read-your-write, bypass RLS via admin).
  // - paymentCompleted: lunas
  // - needsReview: KONFLIK nyata (pembayaran masuk untuk order batal/expired) → hanya dari flag
  // - closed: dibatalkan/kedaluwarsa biasa (tanpa pembayaran) → pesan netral
  let paymentCompleted = order.payment_status === 'paid';
  let needsReview = order.needs_review === true;
  let closed = order.status === 'Dibatalkan' || order.payment_status === 'expired';
  if (!paymentCompleted && !needsReview) {
    const r = await confirmPaymentByOrderId(order.id);
    paymentCompleted = r.status === 'paid';
    needsReview = r.status === 'needs_manual';
    if (r.status === 'cancelled') closed = true;
  }

  return (
    <div className="page-enter" style={{ marginTop: 'var(--navbar-height)', minHeight: '80vh' }}>
      <div className="container section">
        <div className="empty-state">
          {paymentCompleted ? (
            <>
              <div className="empty-state-icon" style={{ color: 'var(--color-success)' }}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <h3 style={{ color: 'var(--color-success)' }}>Pembayaran Berhasil!</h3>
              <p>Terima kasih, {order.recipient_name}. Pesanan Anda sedang diproses.</p>
              <p className="text-muted" style={{ fontSize: '0.9rem' }}>Total: {formatCurrency(order.total)}</p>
            </>
          ) : needsReview ? (
            <>
              <div className="empty-state-icon" style={{ color: 'var(--color-danger)' }}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <h3>Pembayaran Sedang Ditinjau</h3>
              <p>Pesanan ini sudah dibatalkan atau kedaluwarsa, namun pembayaran terdeteksi. Tim kami akan meninjau dan menghubungi Anda.</p>
              <p className="text-muted" style={{ fontSize: '0.9rem' }}>Total: {formatCurrency(order.total)}. Jika butuh bantuan, hubungi admin.</p>
            </>
          ) : closed ? (
            <>
              <div className="empty-state-icon" style={{ color: 'var(--color-text-muted)' }}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              </div>
              <h3>Pesanan {order.payment_status === 'expired' ? 'Kedaluwarsa' : 'Dibatalkan'}</h3>
              <p>Pesanan ini sudah {order.payment_status === 'expired' ? 'kedaluwarsa karena batas pembayaran terlewat' : 'dibatalkan'}. Stok telah dikembalikan dan tidak ada tagihan.</p>
              <p className="text-muted" style={{ fontSize: '0.9rem' }}>Silakan buat pesanan baru bila masih berminat.</p>
            </>
          ) : (
            <>
              <div className="empty-state-icon" style={{ color: 'var(--color-warning, #f59e0b)' }}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <h3>Menunggu Pembayaran</h3>
              <p>Silakan selesaikan pembayaran Anda. Total: {formatCurrency(order.total)}</p>
            </>
          )}
          <div style={{ marginTop: 'var(--space-xl)', display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/profile" className="btn btn-primary">Lihat Pesanan Saya</Link>
            <Link href="/shop" className="btn btn-outline">Lanjut Belanja</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
