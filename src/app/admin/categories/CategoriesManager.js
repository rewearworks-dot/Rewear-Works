'use client';
import { useState, useActionState } from 'react';
import { createCategory, updateCategory, deleteCategory } from '@/lib/actions/categories';

export default function CategoriesManager({ categories }) {
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [message, setMessage] = useState('');

  const openAdd = () => { setEditItem(null); setForm({ name: '', description: '' }); setShowModal(true); };
  const openEdit = (c) => { setEditItem(c); setForm({ name: c.name, description: c.description || '' }); setShowModal(true); };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  // Use useActionState for create/update
  const boundAction = editItem ? updateCategory : createCategory;
  const [state, action, pending] = useActionState(boundAction, null);

  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state?.ok) { setShowModal(false); setMessage('Berhasil!'); }
    if (state?.error) setMessage(state.error);
  }

  const handleDelete = async (id) => {
    if (!confirm('Yakin ingin menghapus kategori ini?')) return;
    setMessage('');
    const res = await deleteCategory(id);
    if (res.error) setMessage(res.error);
    else setMessage('Kategori dihapus');
  };

  return (
    <div className="page-enter">
      <div className="admin-page-header">
        <div>
          <h1>Kategori</h1>
          <p className="text-muted">Kelola kategori produk ({categories.length})</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Tambah Kategori
        </button>
      </div>

      {message && (
        <div style={{ padding: 'var(--space-sm) var(--space-md)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)', background: message.includes('Gagal') || message.includes('Tidak bisa') ? '#fef2f2' : '#f0fdf4', color: message.includes('Gagal') || message.includes('Tidak bisa') ? 'var(--color-danger)' : '#16a34a', fontSize: '0.9rem' }}>
          {message}
        </div>
      )}

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Slug</th>
              <th>Deskripsi</th>
              <th>Jumlah Produk</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {categories.map(c => (
              <tr key={c.id}>
                <td style={{ fontWeight: 700 }}>{c.name}</td>
                <td><span className="badge badge-primary">{c.slug}</span></td>
                <td className="text-muted">{c.description || '-'}</td>
                <td>
                  <span className="badge badge-warning">{c.productCount} produk</span>
                </td>
                <td>
                  <div className="flex gap-sm">
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Edit
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(c.id)} style={{ color: 'var(--color-danger)' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      Hapus
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)} role="dialog" aria-modal="true">
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editItem ? 'Edit Kategori' : 'Tambah Kategori'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)} aria-label="Tutup">✕</button>
            </div>
            <form action={action}>
              {editItem && <input type="hidden" name="id" value={editItem.id} />}
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nama Kategori *</label>
                  <input className="form-input" name="name" value={form.name} onChange={handleChange} required placeholder="contoh: Anak-anak" />
                </div>
                <div className="form-group">
                  <label className="form-label">Deskripsi</label>
                  <textarea className="form-textarea" name="description" value={form.description} onChange={handleChange} placeholder="Deskripsi singkat kategori" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? 'Menyimpan…' : editItem ? 'Simpan' : 'Tambah'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
