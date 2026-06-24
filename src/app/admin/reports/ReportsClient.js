'use client';
import { useState, useMemo } from 'react';
import { formatCurrency, formatDate, orderStatusBadge } from '@/utils/helpers';

export default function ReportsClient({ orders }) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filteredOrders = useMemo(() => {
    let result = [...orders];
    if (dateFrom) result = result.filter(o => new Date(o.createdAt) >= new Date(dateFrom));
    if (dateTo) result = result.filter(o => new Date(o.createdAt) <= new Date(dateTo + 'T23:59:59'));
    return result;
  }, [orders, dateFrom, dateTo]);

  // Pendapatan & item terjual hanya dihitung dari order yang sudah LUNAS (Fix A3)
  const paidOrders = useMemo(() => filteredOrders.filter(o => o.paymentStatus === 'paid'), [filteredOrders]);
  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.total, 0);
  const totalItems = paidOrders.reduce((sum, o) => sum + (o.items?.reduce((s, i) => s + i.quantity, 0) ?? 0), 0);

  const handlePrint = () => window.print();

  return (
    <div className="page-enter">
      <div className="admin-page-header no-print">
        <div>
          <h1>Laporan Penjualan</h1>
          <p className="text-muted">Cetak dan analisis data penjualan</p>
        </div>
        <button className="btn btn-primary" onClick={handlePrint}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Cetak Laporan
        </button>
      </div>

      {/* Filters */}
      <div className="card no-print" style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="flex gap-lg" style={{ flexWrap: 'wrap', alignItems: 'end' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Dari Tanggal</label>
            <input className="form-input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Sampai Tanggal</label>
            <input className="form-input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <button className="btn btn-ghost" onClick={() => { setDateFrom(''); setDateTo(''); }}>
            Reset Filter
          </button>
        </div>
      </div>

      {/* Print Header */}
      <div className="report-header" style={{ display: 'none' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: 4 }}>Rewear Works — Laporan Penjualan</h1>
        <p style={{ color: '#666' }}>Periode: {dateFrom || 'Awal'} s/d {dateTo || 'Sekarang'}</p>
        <p style={{ color: '#666', fontSize: '0.85rem' }}>Dicetak pada: {new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}</p>
      </div>

      {/* Summary Cards */}
      <div className="stats-grid" style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="stat-card" style={{ '--stat-color': '#2C3E6B' }}>
          <p className="stat-card-label">Total Pesanan</p>
          <p className="stat-card-value">{filteredOrders.length}</p>
        </div>
        <div className="stat-card" style={{ '--stat-color': '#CA8A04' }}>
          <p className="stat-card-label">Item Terjual (Lunas)</p>
          <p className="stat-card-value">{totalItems}</p>
        </div>
        <div className="stat-card" style={{ '--stat-color': '#059669' }}>
          <p className="stat-card-label">Pendapatan (Lunas)</p>
          <p className="stat-card-value" style={{ fontSize: '1.3rem' }}>{formatCurrency(totalRevenue)}</p>
        </div>
      </div>

      {/* Orders Table */}
      {filteredOrders.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ padding: 'var(--space-2xl)' }}>
            <h3>Belum ada data pesanan</h3>
            <p>Pesanan akan muncul di sini setelah ada transaksi</p>
          </div>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>No</th>
                <th>Pelanggan</th>
                <th>Telepon</th>
                <th>Produk</th>
                <th>Qty</th>
                <th>Total</th>
                <th>Status</th>
                <th>Tanggal</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order, i) => (
                <tr key={order.id}>
                  <td>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{order.customer?.name}</td>
                  <td className="text-muted">{order.customer?.phone}</td>
                  <td>
                    {order.items?.map((item, idx) => (
                      <div key={idx} style={{ fontSize: '0.85rem' }}>
                        {item.name} (x{item.quantity})
                      </div>
                    ))}
                  </td>
                  <td>{order.items?.reduce((s, i) => s + i.quantity, 0)}</td>
                  <td style={{ fontWeight: 700, color: 'var(--color-accent)' }}>{formatCurrency(order.total)}</td>
                  <td><span className={`badge ${orderStatusBadge(order.status)}`}>{order.status}</span></td>
                  <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>{formatDate(order.createdAt)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="4" style={{ fontWeight: 700, textAlign: 'right' }}>TOTAL (Lunas)</td>
                <td style={{ fontWeight: 700 }}>{totalItems}</td>
                <td style={{ fontWeight: 800, color: 'var(--color-accent)', fontSize: '1.1rem' }}>{formatCurrency(totalRevenue)}</td>
                <td colSpan="2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
