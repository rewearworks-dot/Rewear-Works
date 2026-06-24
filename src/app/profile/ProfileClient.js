'use client';
import { useState, useActionState, useTransition } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency, formatDate } from '@/utils/helpers';
import { updateProfile } from '@/lib/actions/profiles';
import { cancelOrder, getOrderPayUrl } from '@/lib/actions/orders';

function OrderActions({ order }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const canAct = order.paymentStatus !== 'paid' && order.status !== 'Dibatalkan';

  if (!canAct) return null;

  const handlePay = () => {
    setError('');
    startTransition(async () => {
      const res = await getOrderPayUrl(order.id);
      if (res.error) { setError(res.error); return; }
      window.location.href = res.payUrl;
    });
  };

  const handleCancel = () => {
    if (!confirm('Batalkan pesanan ini? Stok akan dikembalikan.')) return;
    setError('');
    startTransition(async () => {
      const res = await cancelOrder(order.id);
      if (res.error) setError(res.error);
    });
  };

  return (
    <div className="flex gap-sm" style={{ marginTop: 'var(--space-sm)', flexWrap: 'wrap' }}>
      <button className="btn btn-accent btn-sm" onClick={handlePay} disabled={isPending}>
        {isPending ? '...' : 'Bayar Sekarang'}
      </button>
      <button className="btn btn-ghost btn-sm" onClick={handleCancel} disabled={isPending} style={{ color: 'var(--color-danger)' }}>
        Batalkan
      </button>
      {error && <span style={{ color: 'var(--color-danger)', fontSize: '0.8rem', alignSelf: 'center' }}>{error}</span>}
    </div>
  );
}

export default function ProfileClient({ user, profile, orders }) {
  const { logout, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(updateProfile, null);

  // Tutup form edit setelah simpan sukses (adjust-state-during-render, tanpa useEffect)
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state?.ok) { setEditing(false); refreshProfile(); }
  }

  return (
    <div className="page-enter" style={{ marginTop: 'var(--navbar-height)', minHeight: '80vh' }}>
      <section className="section">
        <div className="container" style={{ maxWidth: 800 }}>
          <h1 style={{ marginBottom: 'var(--space-xl)' }}>Profil Saya</h1>

          {/* Profile Card */}
          <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
            <div className="flex-between" style={{ marginBottom: 'var(--space-lg)' }}>
              <div className="flex gap-lg">
                <div style={{
                  width: 64, height: 64, borderRadius: 'var(--radius-full)',
                  background: 'var(--color-primary)', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.5rem', fontWeight: 700, flexShrink: 0,
                }}>
                  {profile?.full_name?.charAt(0).toUpperCase() || '?'}
                </div>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-body)', fontWeight: 700 }}>{profile?.full_name}</h3>
                  <p className="text-muted" style={{ fontSize: '0.9rem' }}>{user.email}</p>
                  <span className={`badge ${profile?.role === 'admin' ? 'badge-primary' : 'badge-success'}`} style={{ marginTop: 4 }}>
                    {profile?.role === 'admin' ? 'Admin' : 'Pelanggan'}
                  </span>
                </div>
              </div>
              {!editing && (
                <button className="btn btn-outline btn-sm" onClick={() => setEditing(true)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Edit Profil
                </button>
              )}
            </div>

            {editing ? (
              <form action={action}>
                {state?.error && <div className="auth-error" style={{ marginBottom: 'var(--space-md)' }}>{state.error}</div>}
                <div className="grid grid-2" style={{ gap: 'var(--space-md)' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Nama Lengkap *</label>
                    <input className="form-input" name="full_name" defaultValue={profile?.full_name || ''} required minLength={2} maxLength={80} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Telepon</label>
                    <input className="form-input" name="phone" defaultValue={profile?.phone || ''} maxLength={20} placeholder="08xx-xxxx-xxxx" />
                  </div>
                </div>
                <div className="flex gap-sm" style={{ marginTop: 'var(--space-md)' }}>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
                    {pending ? 'Menyimpan…' : 'Simpan'}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)} disabled={pending}>
                    Batal
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid grid-2" style={{ gap: 'var(--space-md)' }}>
                <div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Email</p>
                  <p style={{ fontWeight: 600 }}>{user.email}</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Telepon</p>
                  <p style={{ fontWeight: 600 }}>{profile?.phone || '-'}</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Bergabung Sejak</p>
                  <p style={{ fontWeight: 600 }}>{formatDate(profile?.created_at || user.created_at)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Order History */}
          <div className="card">
            <h3 style={{ fontFamily: 'var(--font-body)', fontWeight: 700, marginBottom: 'var(--space-lg)' }}>
              Riwayat Pesanan ({orders.length})
            </h3>

            {orders.length === 0 ? (
              <div className="empty-state" style={{ padding: 'var(--space-xl)' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-light)" strokeWidth="1.5" style={{ marginBottom: 16 }}>
                  <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                </svg>
                <p>Belum ada pesanan</p>
                <Link href="/shop" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>Mulai Belanja</Link>
              </div>
            ) : (
              <div className="flex-col gap-md">
                {orders.map(order => (
                  <div key={order.id} className="card" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border-light)' }}>
                    <div className="flex-between" style={{ marginBottom: 'var(--space-sm)' }}>
                      <Link href={`/profile/orders/${order.id}`} className="badge badge-primary" style={{ textDecoration: 'none' }}>{order.id.slice(0, 12)}</Link>
                      <div className="flex gap-sm">
                        <span className={`badge ${order.status === 'Baru' ? 'badge-warning' : order.status === 'Dibatalkan' ? 'badge-danger' : 'badge-success'}`}>{order.status}</span>
                        <span className={`badge ${order.paymentStatus === 'paid' ? 'badge-success' : 'badge-warning'}`}>{order.paymentStatus === 'paid' ? 'Lunas' : 'Belum Bayar'}</span>
                      </div>
                    </div>
                    <div className="flex-between">
                      <div>
                        {order.items?.map((item, i) => (
                          <p key={i} style={{ fontSize: '0.9rem' }}>
                            {item.name} {item.selectedSize && `(${item.selectedSize})`} (x{item.quantity})
                          </p>
                        ))}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontWeight: 700, color: 'var(--color-accent)' }}>{formatCurrency(order.total)}</p>
                        <p className="text-muted" style={{ fontSize: '0.8rem' }}>{formatDate(order.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex-between" style={{ marginTop: 'var(--space-sm)', alignItems: 'flex-end' }}>
                      <OrderActions order={order} />
                      <Link href={`/profile/orders/${order.id}`} style={{ fontSize: '0.85rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                        Lihat Detail →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Logout */}
          <button className="btn btn-ghost" style={{ marginTop: 'var(--space-xl)', color: 'var(--color-danger)', width: '100%' }} onClick={async () => { await logout(); }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Keluar dari Akun
          </button>
        </div>
      </section>
    </div>
  );
}
