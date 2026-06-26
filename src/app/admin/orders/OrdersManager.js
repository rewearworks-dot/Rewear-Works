'use client';
import { useState, useTransition } from 'react';
import { updateOrderStatus } from '@/lib/actions/orders';
import { formatCurrency, formatDate } from '@/utils/helpers';

const STATUSES = ['Baru', 'Diproses', 'Dikirim', 'Selesai', 'Dibatalkan'];
const statusColors = {
  Baru: 'badge-primary',
  Diproses: 'badge-warning',
  Dikirim: 'badge-info',
  Selesai: 'badge-success',
  Dibatalkan: 'badge-danger',
};
const paymentColors = {
  unpaid: 'badge-warning',
  paid: 'badge-success',
  failed: 'badge-danger',
  expired: 'badge-danger',
};

export default function OrdersManager({ orders: initialOrders }) {
  // Fix B2: gunakan props langsung. useState(initialOrders) mengabaikan props baru
  // hasil revalidatePath sehingga status "balik" ke nilai lama.
  const orders = initialOrders;
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState('');

  const handleStatusChange = (orderId, status) => {
    startTransition(async () => {
      setMessage('');
      const res = await updateOrderStatus(orderId, status);
      if (res.error) setMessage(res.error);
      else setMessage('Status berhasil diperbarui');
    });
  };

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: 'var(--space-xl)' }}>
        <h2>Kelola Pesanan</h2>
        <span className="text-muted">{orders.length} pesanan</span>
      </div>

      {message && (
        <div style={{ padding: 'var(--space-sm) var(--space-md)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)', background: message.includes('error') || message.includes('Gagal') ? 'var(--color-danger-bg, #fef2f2)' : 'var(--color-success-bg, #f0fdf4)', color: message.includes('error') || message.includes('Gagal') ? 'var(--color-danger)' : 'var(--color-success, #16a34a)', fontSize: '0.9rem' }}>
          {message}
        </div>
      )}

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Penerima</th>
              <th>Item</th>
              <th>Total</th>
              <th>Status</th>
              <th>Pembayaran</th>
              <th>Tanggal</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => (
              <tr key={order.id}>
                <td style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>{order.id.slice(0, 8)}…</td>
                <td>
                  <div style={{ fontWeight: 600 }}>{order.customer?.name}</div>
                  <div className="text-muted" style={{ fontSize: '0.8rem' }}>{order.customer?.phone}</div>
                </td>
                <td>
                  {order.items?.map((item, i) => (
                    <div key={i} style={{ fontSize: '0.85rem' }}>
                      {item.name} {item.selectedSize && `(${item.selectedSize})`} x{item.quantity}
                    </div>
                  ))}
                </td>
                <td style={{ fontWeight: 600 }}>{formatCurrency(order.total)}</td>
                <td><span className={`badge ${statusColors[order.status] || ''}`}>{order.status}</span></td>
                <td>
                  <span className={`badge ${paymentColors[order.paymentStatus] || ''}`}>{order.paymentStatus}</span>
                  {order.needsReview && (
                    <span className="badge badge-danger" style={{ marginLeft: 4 }} title="Pembayaran masuk untuk order batal/expired — perlu refund/tinjauan manual">⚠ Perlu Tinjau</span>
                  )}
                </td>
                <td style={{ fontSize: '0.85rem' }}>{formatDate(order.createdAt)}</td>
                <td>
                  <select
                    className="form-select"
                    style={{ width: 'auto', minWidth: 120, fontSize: '0.85rem' }}
                    value={order.status}
                    onChange={e => handleStatusChange(order.id, e.target.value)}
                    disabled={isPending || order.status === 'Selesai' || order.status === 'Dibatalkan'}
                  >
                    {STATUSES.map(s => (
                      <option
                        key={s}
                        value={s}
                        disabled={['Diproses', 'Dikirim', 'Selesai'].includes(s) && order.paymentStatus !== 'paid'}
                      >
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--color-text-muted)' }}>
                  Belum ada pesanan
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
