'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/context/CartContext';
import { formatCurrency } from '@/utils/helpers';

export default function CartPage() {
  const { items, removeItem, updateQuantity, totalPrice, clearCart } = useCart();

  if (items.length === 0) {
    return (
      <div className="page-enter" style={{ marginTop: 'var(--navbar-height)', minHeight: '80vh' }}>
        <div className="container section">
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            </div>
            <h3>Keranjang Kosong</h3>
            <p>Belum ada produk di keranjang Anda</p>
            <Link href="/shop" className="btn btn-primary" style={{ marginTop: 24 }}>Mulai Belanja</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter" style={{ marginTop: 'var(--navbar-height)' }}>
      <section className="section">
        <div className="container">
          <h1 style={{ marginBottom: 'var(--space-xl)' }}>Keranjang Belanja</h1>

          <div className="grid" style={{ gridTemplateColumns: '1fr 380px', gap: 'var(--space-xl)', alignItems: 'start' }}>
            {/* Cart Items */}
            <div className="flex-col gap-md">
              {items.map(item => (
                <div key={item.cartId} className="card flex-between" style={{ padding: 'var(--space-lg)', gap: 'var(--space-lg)' }}>
                  <div style={{
                    width: 80, height: 80, borderRadius: 'var(--radius-md)',
                    background: 'var(--color-bg-alt)', flexShrink: 0, position: 'relative', overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {item.image ? (
                      <Image src={item.image} alt={item.name} fill sizes="80px" style={{ objectFit: 'cover' }} />
                    ) : (
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-light)" strokeWidth="1.5">
                        <path d="M20.38 3.46L16 2L12 5.5L8 2L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6l1 12h10l1-12h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>
                      </svg>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', fontWeight: 600, marginBottom: 4 }}>{item.name}</h4>
                    <p className="text-muted" style={{ fontSize: '0.85rem' }}>
                      {item.brand} · Ukuran: {item.selectedSize || item.size}
                      {item.color && ` · ${item.color}`}
                    </p>
                  </div>

                  <div className="flex gap-sm" style={{ alignItems: 'center' }}>
                    <button className="btn btn-ghost btn-icon" onClick={() => updateQuantity(item.cartId, item.quantity - 1)} style={{ border: '1px solid var(--color-border)' }}>−</button>
                    <span style={{ fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{item.quantity}</span>
                    <button className="btn btn-ghost btn-icon" onClick={() => updateQuantity(item.cartId, item.quantity + 1)} style={{ border: '1px solid var(--color-border)' }}>+</button>
                  </div>

                  <div style={{ textAlign: 'right', minWidth: 120 }}>
                    <p style={{ fontWeight: 700, color: 'var(--color-accent)', fontSize: '1.05rem' }}>{formatCurrency(item.price * item.quantity)}</p>
                  </div>

                  <button className="btn btn-ghost btn-icon" onClick={() => removeItem(item.cartId)} title="Hapus">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="card" style={{ position: 'sticky', top: 'calc(var(--navbar-height) + var(--space-lg))' }}>
              <h3 style={{ fontFamily: 'var(--font-body)', marginBottom: 'var(--space-lg)' }}>Ringkasan</h3>

              <div className="flex-between" style={{ marginBottom: 'var(--space-sm)' }}>
                <span className="text-muted">Subtotal ({items.length} item)</span>
                <span style={{ fontWeight: 600 }}>{formatCurrency(totalPrice)}</span>
              </div>
              <div className="flex-between" style={{ marginBottom: 'var(--space-sm)' }}>
                <span className="text-muted">Ongkir</span>
                <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>Gratis</span>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--color-border-light)', margin: 'var(--space-md) 0' }} />

              <div className="flex-between" style={{ marginBottom: 'var(--space-xl)' }}>
                <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>Total</span>
                <span style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--color-accent)' }}>{formatCurrency(totalPrice)}</span>
              </div>

              <Link href="/checkout" className="btn btn-accent btn-lg" style={{ width: '100%' }}>
                Checkout
              </Link>

              <button className="btn btn-ghost" style={{ width: '100%', marginTop: 'var(--space-sm)', color: 'var(--color-danger)' }} onClick={clearCart}>
                Kosongkan Keranjang
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
