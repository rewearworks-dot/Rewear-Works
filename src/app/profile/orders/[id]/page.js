import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/dal';
import { getOrderById } from '@/lib/data/orders';
import { formatCurrency, formatDate } from '@/utils/helpers';

const statusBadge = (s) => s === 'Baru' ? 'badge-warning' : s === 'Dibatalkan' ? 'badge-danger' : 'badge-success';

export default async function OrderDetailPage({ params }) {
  const { id } = await params;
  await requireAuth();
  const order = await getOrderById(id); // RLS membatasi ke pemilik/admin

  if (!order) notFound();

  return (
    <div className="page-enter" style={{ marginTop: 'var(--navbar-height)', minHeight: '80vh' }}>
      <section className="section">
        <div className="container" style={{ maxWidth: 760 }}>
          <div className="flex gap-sm" style={{ marginBottom: 'var(--space-lg)', fontSize: '0.9rem' }}>
            <Link href="/profile" style={{ color: 'var(--color-text-muted)' }}>Profil</Link>
            <span style={{ color: 'var(--color-text-light)' }}>/</span>
            <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Detail Pesanan</span>
          </div>

          <div className="flex-between" style={{ marginBottom: 'var(--space-lg)', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
            <h1 style={{ fontSize: '1.5rem' }}>Pesanan #{order.id.slice(0, 8)}</h1>
            <div className="flex gap-sm">
              <span className={`badge ${statusBadge(order.status)}`}>{order.status}</span>
              <span className={`badge ${order.paymentStatus === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                {order.paymentStatus === 'paid' ? 'Lunas' : 'Belum Bayar'}
              </span>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
            <h3 style={{ fontFamily: 'var(--font-body)', marginBottom: 'var(--space-md)' }}>Item</h3>
            {order.items?.map((item, i) => (
              <div key={i} className="flex-between" style={{ marginBottom: 'var(--space-sm)' }}>
                <div>
                  <p style={{ fontWeight: 600 }}>{item.name}</p>
                  <p className="text-muted" style={{ fontSize: '0.85rem' }}>
                    {item.selectedSize && `Ukuran ${item.selectedSize} · `}x{item.quantity}
                  </p>
                </div>
                <span style={{ fontWeight: 600 }}>{formatCurrency(item.price * item.quantity)}</span>
              </div>
            ))}
            <hr style={{ border: 'none', borderTop: '1px solid var(--color-border-light)', margin: 'var(--space-md) 0' }} />
            <div className="flex-between" style={{ marginBottom: 4 }}>
              <span className="text-muted">Subtotal</span><span>{formatCurrency(order.subtotal)}</span>
            </div>
            <div className="flex-between" style={{ marginBottom: 4 }}>
              <span className="text-muted">Ongkir</span>
              <span>{order.shippingCost > 0 ? formatCurrency(order.shippingCost) : 'Gratis'}</span>
            </div>
            <div className="flex-between" style={{ marginTop: 'var(--space-sm)' }}>
              <span style={{ fontWeight: 700 }}>Total</span>
              <span style={{ fontWeight: 800, color: 'var(--color-accent)' }}>{formatCurrency(order.total)}</span>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
            <h3 style={{ fontFamily: 'var(--font-body)', marginBottom: 'var(--space-md)' }}>Pengiriman</h3>
            <p style={{ fontWeight: 600 }}>{order.customer?.name}</p>
            <p className="text-muted" style={{ fontSize: '0.9rem' }}>{order.customer?.phone}</p>
            <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: 4 }}>{order.customer?.address}</p>
            {order.notes && <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: 8, fontStyle: 'italic' }}>Catatan: {order.notes}</p>}
            <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: 'var(--space-md)' }}>Dibuat: {formatDate(order.createdAt)}</p>
            {order.paidAt && <p className="text-muted" style={{ fontSize: '0.8rem' }}>Dibayar: {formatDate(order.paidAt)}</p>}
          </div>

          <Link href="/profile" className="btn btn-outline">← Kembali ke Profil</Link>
        </div>
      </section>
    </div>
  );
}
