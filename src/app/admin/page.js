import { getProducts } from '@/lib/data/products';
import { getCategories } from '@/lib/data/categories';
import { getAllOrders } from '@/lib/data/orders';
import { formatCurrency, formatDate, orderStatusBadge } from '@/utils/helpers';

export default async function AdminDashboard() {
  const [products, categories, orders] = await Promise.all([
    getProducts(),
    getCategories(),
    getAllOrders(),
  ]);
  const paidOrders = orders.filter(o => o.paymentStatus === 'paid');
  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.total, 0);

  const stats = [
    { label: 'Total Produk', value: products.length, color: '#2C3E6B', bg: 'rgba(44,62,107,0.08)', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.38 3.46L16 2L12 5.5L8 2L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6l1 12h10l1-12h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/></svg> },
    { label: 'Total Pesanan', value: orders.length, color: '#CA8A04', bg: 'rgba(202,138,4,0.08)', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg> },
    { label: 'Pendapatan', value: formatCurrency(totalRevenue), color: '#059669', bg: 'rgba(5,150,105,0.08)', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
    { label: 'Kategori', value: categories.length, color: '#C0392B', bg: 'rgba(192,57,43,0.08)', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> },
  ];

  return (
    <div className="page-enter">
      <div className="admin-page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="text-muted">Ringkasan toko Rewear Works</p>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        {stats.map((stat, i) => (
          <div key={i} className="stat-card" style={{ '--stat-color': stat.color, '--stat-bg': stat.bg }}>
            <div className="stat-card-icon">{stat.icon}</div>
            <p className="stat-card-value">{stat.value}</p>
            <p className="stat-card-label">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Recent Orders */}
      <div className="card" style={{ marginTop: 'var(--space-lg)' }}>
        <h3 style={{ fontFamily: 'var(--font-body)', fontWeight: 700, marginBottom: 'var(--space-lg)' }}>Pesanan Terbaru</h3>
        {orders.length === 0 ? (
          <div className="empty-state" style={{ padding: 'var(--space-xl)' }}>
            <p className="text-muted">Belum ada pesanan</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Pelanggan</th>
                  <th>Item</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Tanggal</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 10).map(order => (
                  <tr key={order.id}>
                    <td><span className="badge badge-primary">{order.id.slice(0, 10)}</span></td>
                    <td style={{ fontWeight: 600 }}>{order.customer?.name}</td>
                    <td>{order.items?.length} produk</td>
                    <td style={{ fontWeight: 700, color: 'var(--color-accent)' }}>{formatCurrency(order.total)}</td>
                    <td><span className={`badge ${orderStatusBadge(order.status)}`}>{order.status}</span></td>
                    <td className="text-muted">{formatDate(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Product list summary */}
      <div className="card" style={{ marginTop: 'var(--space-lg)' }}>
        <h3 style={{ fontFamily: 'var(--font-body)', fontWeight: 700, marginBottom: 'var(--space-lg)' }}>Produk Terbaru</h3>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Nama Produk</th>
                <th>Kategori</th>
                <th>Harga</th>
                <th>Stok</th>
                <th>Kondisi</th>
              </tr>
            </thead>
            <tbody>
              {products.slice(0, 5).map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td><span className="badge badge-primary">{p.categoryName}</span></td>
                  <td style={{ fontWeight: 700 }}>{formatCurrency(p.price)}</td>
                  <td>{p.stock}</td>
                  <td><span className="meta-tag">{p.condition}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
