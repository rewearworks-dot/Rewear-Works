'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency } from '@/utils/helpers';
import { createOrder } from '@/lib/actions/orders';

export default function CheckoutPage() {
  const { items, totalPrice, clearCart } = useCart();
  const { currentUser, isLoggedIn } = useAuth();
  const [form, setForm] = useState({ name: '', phone: '', address: '', notes: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isLoggedIn) {
    return (
      <div className="page-enter" style={{ marginTop: 'var(--navbar-height)', minHeight: '80vh' }}>
        <div className="container section">
          <div className="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.5" style={{ marginBottom: 16 }}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            <h3>Masuk untuk Checkout</h3>
            <p className="text-muted" style={{ marginBottom: 'var(--space-lg)' }}>
              Anda perlu masuk terlebih dahulu untuk melanjutkan pembelian
            </p>
            <div className="flex-center gap-md">
              <Link href="/login" className="btn btn-primary">Masuk</Link>
              <Link href="/register" className="btn btn-outline">Daftar Baru</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = await createOrder({
      recipient: form.name,
      phone: form.phone,
      address: form.address,
      notes: form.notes,
      items: items.map(i => ({ product_id: i.id, quantity: i.quantity, size: i.selectedSize || i.size || '' })),
    });
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    clearCart();
    // Redirect ke Pakasir pay URL jika ada, atau ke halaman sukses
    if (result.payUrl) {
      window.location.href = result.payUrl;
    } else {
      window.location.href = `/checkout/success?order_id=${result.orderId}`;
    }
  };

  if (items.length === 0) {
    return (
      <div className="page-enter" style={{ marginTop: 'var(--navbar-height)', minHeight: '80vh' }}>
        <div className="container section">
          <div className="empty-state">
            <h3>Keranjang kosong</h3>
            <p>Tambahkan produk terlebih dahulu</p>
            <Link href="/shop" className="btn btn-primary" style={{ marginTop: 24 }}>Belanja Sekarang</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter" style={{ marginTop: 'var(--navbar-height)' }}>
      <section className="section">
        <div className="container">
          <h1 style={{ marginBottom: 'var(--space-xl)' }}>Checkout</h1>

          {error && (
            <div className="auth-error" style={{ marginBottom: 'var(--space-lg)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              {error}
            </div>
          )}

          {/* Logged in info */}
          <div className="card" style={{ marginBottom: 'var(--space-lg)', padding: 'var(--space-md) var(--space-lg)', background: 'rgba(44,62,107,0.04)' }}>
            <div className="flex gap-sm">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <span style={{ fontSize: '0.9rem' }}>Checkout sebagai <strong>{currentUser?.name}</strong> ({currentUser?.email})</span>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid" style={{ gridTemplateColumns: '1fr 400px', gap: 'var(--space-xl)', alignItems: 'start' }}>
              {/* Form */}
              <div className="card">
                <h3 style={{ fontFamily: 'var(--font-body)', marginBottom: 'var(--space-lg)' }}>Informasi Pengiriman</h3>
                <div className="form-group">
                  <label className="form-label">Nama Penerima *</label>
                  <input className="form-input" name="name" value={form.name} onChange={handleChange} required placeholder="Nama lengkap penerima" />
                </div>
                <div className="form-group">
                  <label className="form-label">No. Telepon / WhatsApp *</label>
                  <input className="form-input" name="phone" value={form.phone} onChange={handleChange} required placeholder="08xx-xxxx-xxxx" />
                </div>
                <div className="form-group">
                  <label className="form-label">Alamat Lengkap *</label>
                  <textarea className="form-textarea" name="address" value={form.address} onChange={handleChange} required placeholder="Jl. ..., RT/RW, Kelurahan, Kecamatan, Kota, Kode Pos" />
                </div>
                <div className="form-group">
                  <label className="form-label">Catatan (opsional)</label>
                  <textarea className="form-textarea" name="notes" value={form.notes} onChange={handleChange} placeholder="Catatan tambahan" style={{ minHeight: 60 }} />
                </div>
              </div>

              {/* Summary */}
              <div className="card" style={{ position: 'sticky', top: 'calc(var(--navbar-height) + var(--space-lg))' }}>
                <h3 style={{ fontFamily: 'var(--font-body)', marginBottom: 'var(--space-lg)' }}>Ringkasan Pesanan</h3>
                {items.map(item => (
                  <div key={item.cartId} className="flex-between" style={{ marginBottom: 'var(--space-md)', gap: 'var(--space-md)' }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 'var(--radius-sm)', flexShrink: 0,
                      background: 'var(--color-bg-alt)', position: 'relative', overflow: 'hidden',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {item.image ? (
                        <Image src={item.image} alt={item.name} fill sizes="48px" style={{ objectFit: 'cover' }} />
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-light)" strokeWidth="1.5">
                          <path d="M20.38 3.46L16 2L12 5.5L8 2L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6l1 12h10l1-12h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>
                        </svg>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.name}</p>
                      <p className="text-muted" style={{ fontSize: '0.8rem' }}>
                        {(item.selectedSize || item.size) && `Ukuran ${item.selectedSize || item.size} · `}x{item.quantity}
                      </p>
                    </div>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{formatCurrency(item.price * item.quantity)}</span>
                  </div>
                ))}
                <hr style={{ border: 'none', borderTop: '1px solid var(--color-border-light)', margin: 'var(--space-md) 0' }} />
                <div className="flex-between" style={{ marginBottom: 'var(--space-sm)' }}>
                  <span className="text-muted">Subtotal</span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(totalPrice)}</span>
                </div>
                <div className="flex-between" style={{ marginBottom: 'var(--space-md)' }}>
                  <span className="text-muted">Ongkir</span>
                  <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>Gratis</span>
                </div>
                <hr style={{ border: 'none', borderTop: '1px solid var(--color-border-light)', margin: 'var(--space-md) 0' }} />
                <div className="flex-between" style={{ marginBottom: 'var(--space-xl)' }}>
                  <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>Total</span>
                  <span style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--color-accent)' }}>{formatCurrency(totalPrice)}</span>
                </div>
                <button type="submit" className="btn btn-accent btn-lg" style={{ width: '100%' }} disabled={loading}>
                  {loading ? (
                    <span className="auth-spinner"></span>
                  ) : (
                    <>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                      Bayar Sekarang
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
