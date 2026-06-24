'use client';
import { useState, useActionState } from 'react';
import { createAdmin, deleteUser } from '@/lib/actions/accounts';

export default function AccountsManager({ admins, customers, currentUserId }) {
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState('');
  const [state, action, pending] = useActionState(createAdmin, null);

  // React ke hasil action tanpa useEffect (adjust-state-during-render)
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state?.ok) { setShowModal(false); setMessage('Admin berhasil ditambahkan'); }
    if (state?.error) setMessage(state.error);
  }

  const handleDelete = async (user) => {
    if (user.id === currentUserId) { alert('Tidak bisa menghapus akun Anda sendiri'); return; }
    if (!confirm(`Yakin ingin menghapus akun "${user.full_name}"?`)) return;
    setMessage('');
    const res = await deleteUser(user.id);
    if (res.error) setMessage(res.error);
    else setMessage('Akun dihapus');
  };

  return (
    <div className="page-enter">
      <div className="admin-page-header">
        <div>
          <h1>Kelola Akun</h1>
          <p className="text-muted">Kelola akun admin dan lihat pelanggan terdaftar</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowModal(true); setMessage(''); }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Tambah Admin
        </button>
      </div>

      {message && (
        <div style={{ padding: 'var(--space-sm) var(--space-md)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)', background: message.includes('Gagal') || message.includes('Tidak') ? '#fef2f2' : '#f0fdf4', color: message.includes('Gagal') || message.includes('Tidak') ? 'var(--color-danger)' : '#16a34a', fontSize: '0.9rem' }}>
          {message}
        </div>
      )}

      {/* Admin accounts */}
      <h3 style={{ fontFamily: 'var(--font-body)', fontWeight: 700, marginBottom: 'var(--space-md)' }}>
        Admin ({admins.length})
      </h3>
      <div className="table-container" style={{ marginBottom: 'var(--space-xl)' }}>
        <table className="table">
          <thead><tr><th>Nama</th><th>Telepon</th><th>Dibuat</th><th>Aksi</th></tr></thead>
          <tbody>
            {admins.map(u => (
              <tr key={u.id}>
                <td>
                  <div className="flex gap-sm">
                    <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-full)', background: 'var(--color-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0 }}>
                      {u.full_name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p style={{ fontWeight: 600 }}>{u.full_name}</p>
                    </div>
                  </div>
                </td>
                <td className="text-muted">{u.phone || '-'}</td>
                <td className="text-muted" style={{ fontSize: '0.85rem' }}>{u.created_at ? new Date(u.created_at).toLocaleDateString('id-ID') : '-'}</td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(u)} style={{ color: 'var(--color-danger)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Customer accounts */}
      <h3 style={{ fontFamily: 'var(--font-body)', fontWeight: 700, marginBottom: 'var(--space-md)' }}>
        Pelanggan ({customers.length})
      </h3>
      {customers.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ padding: 'var(--space-xl)' }}>
            <p className="text-muted">Belum ada pelanggan terdaftar</p>
          </div>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead><tr><th>Nama</th><th>Telepon</th><th>Bergabung</th><th>Aksi</th></tr></thead>
            <tbody>
              {customers.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.full_name}</td>
                  <td className="text-muted">{u.phone || '-'}</td>
                  <td className="text-muted" style={{ fontSize: '0.85rem' }}>{new Date(u.created_at).toLocaleDateString('id-ID')}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(u)} style={{ color: 'var(--color-danger)' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Admin Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)} role="dialog" aria-modal="true">
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Tambah Admin Baru</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)} aria-label="Tutup">✕</button>
            </div>
            <form action={action}>
              <div className="modal-body">
                {state?.error && <div className="auth-error" style={{ marginBottom: 'var(--space-md)' }}>{state.error}</div>}
                <div className="form-group">
                  <label className="form-label">Nama</label>
                  <input className="form-input" name="full_name" required placeholder="Nama admin" />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" name="email" required placeholder="email@domain.com" />
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input className="form-input" type="password" name="password" required minLength={6} placeholder="Minimal 6 karakter" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? 'Menambahkan…' : 'Tambah Admin'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
