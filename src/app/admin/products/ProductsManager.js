'use client';
import { useState, useRef, useActionState } from 'react';
import Image from 'next/image';
import { formatCurrency } from '@/utils/helpers';
import { createProduct, updateProduct, deleteProduct } from '@/lib/actions/products';

export default function ProductsManager({ products, categories }) {
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('semua');
  const [message, setMessage] = useState('');
  const fileInputRef = useRef(null);
  const formRef = useRef(null);

  const emptyForm = {
    name: '', price: '', original_price: '', category_id: '',
    size: '', available_sizes: '', color: '', material: '', weight: '',
    condition: 'Baik', brand: '', description: '', stock: 1, featured: false,
    video_url: '',
    measurements: { lingkarDada: '', panjangBaju: '', lebarBahu: '', panjangLengan: '', lingkarPinggang: '', lingkarPinggul: '', panjangCelana: '' },
  };
  const [form, setForm] = useState(emptyForm);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [removedImageIds, setRemovedImageIds] = useState([]);
  const [activeTab, setActiveTab] = useState('info');

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.brand && p.brand.toLowerCase().includes(search.toLowerCase()));
    const matchCat = filterCat === 'semua' || p.category === filterCat;
    return matchSearch && matchCat;
  });

  const openAdd = () => {
    setEditItem(null);
    setForm({ ...emptyForm, category_id: categories[0]?.id || '' });
    setImagePreviews([]);
    setRemovedImageIds([]);
    setActiveTab('info');
    setShowModal(true);
  };

  const openEdit = (p) => {
    setEditItem(p);
    setForm({
      name: p.name,
      price: String(p.price),
      original_price: String(p.originalPrice || ''),
      category_id: p.category,
      size: p.size || '',
      available_sizes: (p.availableSizes || []).join(', '),
      condition: p.condition || 'Baik',
      brand: p.brand || '',
      color: p.color || '',
      material: p.material || '',
      weight: p.weight || '',
      description: p.description || '',
      video_url: p.videoUrl || '',
      stock: p.stock,
      featured: p.featured,
      measurements: { ...emptyForm.measurements, ...(p.measurements || {}) },
    });
    setImagePreviews((p.imageItems || []).map(it => ({ url: it.url, existingId: it.id })));
    setRemovedImageIds([]);
    setActiveTab('info');
    setShowModal(true);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name.startsWith('m_')) {
      const key = name.slice(2);
      setForm(f => ({ ...f, measurements: { ...f.measurements, [key]: value } }));
    } else {
      setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    }
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    // Simpan objek File di state (bukan hanya URL preview) supaya benar-benar ikut terkirim.
    setImagePreviews(prev => [
      ...prev,
      ...files.map(file => ({ url: URL.createObjectURL(file), file })),
    ]);
    e.target.value = '';
  };

  const removePreview = (index) => {
    const item = imagePreviews[index];
    // Foto lama (punya existingId) ditandai untuk dihapus dari DB & Storage saat simpan.
    if (item?.existingId) setRemovedImageIds(ids => [...ids, item.existingId]);
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Server Action binding
  const boundAction = editItem ? updateProduct : createProduct;
  const [state, submitAction, pending] = useActionState(async (prev, formData) => {
    // Inject measurements as JSON
    const clean = {};
    Object.entries(form.measurements).forEach(([k, v]) => { if (v) clean[k] = v; });
    // We need a plain FormData, but useActionState gives us one from the form
    // The measurements are complex — let's just handle it server-side via hidden field
    formData.set('measurements', JSON.stringify(clean));
    // Lampirkan foto baru (objek File). Input file dikelola di state, jadi append
    // manual ke FormData; foto lama (entri tanpa .file) tidak diunggah ulang.
    imagePreviews.forEach(p => { if (p.file) formData.append('images', p.file); });
    // Daftar id foto lama yang dihapus saat edit.
    if (editItem) formData.set('delete_image_ids', JSON.stringify(removedImageIds));
    return boundAction(prev, formData);
  }, null);

  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state?.ok) { setShowModal(false); setMessage('Berhasil disimpan!'); }
    if (state?.error) setMessage(state.error);
  }

  const handleDelete = async (id) => {
    if (!confirm('Yakin ingin menghapus produk ini?')) return;
    setMessage('');
    const res = await deleteProduct(id);
    if (res.error) setMessage(res.error);
    else setMessage('Produk dihapus');
  };

  return (
    <div className="page-enter">
      <div className="admin-page-header">
        <div>
          <h1>Produk</h1>
          <p className="text-muted">Kelola semua produk ({products.length})</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Tambah Produk
        </button>
      </div>

      {message && (
        <div style={{ padding: 'var(--space-sm) var(--space-md)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)', background: message.includes('Gagal') ? '#fef2f2' : '#f0fdf4', color: message.includes('Gagal') ? 'var(--color-danger)' : '#16a34a', fontSize: '0.9rem' }}>
          {message}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-md" style={{ marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ maxWidth: 300, flex: 1 }}>
          <svg className="search-bar-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input placeholder="Cari produk..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-select" style={{ maxWidth: 180 }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="semua">Semua Kategori</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Foto</th>
              <th>Produk</th>
              <th>Kategori</th>
              <th>Ukuran</th>
              <th>Harga</th>
              <th>Stok</th>
              <th>Kondisi</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--color-text-muted)' }}>Tidak ada produk ditemukan</td></tr>
            ) : filtered.map(p => (
              <tr key={p.id}>
                <td>
                  <div className="admin-product-thumb">
                    {p.image ? (
                      <Image src={p.image} alt={p.name} width={40} height={40} style={{ objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-light)" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                      </svg>
                    )}
                  </div>
                </td>
                <td>
                  <div>
                    <p style={{ fontWeight: 600 }}>{p.name}</p>
                    <p className="text-muted" style={{ fontSize: '0.8rem' }}>
                      {p.brand}{p.color ? ` · ${p.color}` : ''}
                    </p>
                  </div>
                </td>
                <td><span className="badge badge-primary">{p.categoryName}</span></td>
                <td>
                  <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                    {p.availableSizes?.length > 0 ? p.availableSizes.join(', ') : p.size || '-'}
                  </span>
                </td>
                <td style={{ fontWeight: 700 }}>{formatCurrency(p.price)}</td>
                <td>
                  <span className={`badge ${p.stock > 0 ? 'badge-success' : 'badge-danger'}`}>
                    {p.stock > 0 ? p.stock : 'Habis'}
                  </span>
                </td>
                <td><span className="meta-tag">{p.condition}</span></td>
                <td>
                  <div className="flex gap-sm">
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Edit
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(p.id)} style={{ color: 'var(--color-danger)' }}>
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

      {/* Product Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)} role="dialog" aria-modal="true">
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editItem ? 'Edit Produk' : 'Tambah Produk Baru'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)} aria-label="Tutup">✕</button>
            </div>

            {/* Tabs */}
            <div className="modal-tabs">
              <button className={`modal-tab ${activeTab === 'info' ? 'active' : ''}`} onClick={() => setActiveTab('info')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                Info Produk
              </button>
              <button className={`modal-tab ${activeTab === 'media' ? 'active' : ''}`} onClick={() => setActiveTab('media')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                Foto & Video
              </button>
              <button className={`modal-tab ${activeTab === 'size' ? 'active' : ''}`} onClick={() => setActiveTab('size')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 17l10-10M4 19l2-2M8 15l2-2M12 11l2-2M16 7l2-2M18 5l4 4-14 14-4-4z"/></svg>
                Ukuran & Pengukuran
              </button>
            </div>

            <form ref={formRef} action={submitAction}>
              {editItem && <input type="hidden" name="id" value={editItem.id} />}
              <div className="modal-body">
                {state?.error && <div className="auth-error" style={{ marginBottom: 'var(--space-md)' }}>{state.error}</div>}

                {/* Tab: Info Produk */}
                <div style={{ display: activeTab === 'info' ? 'block' : 'none' }}>
                    <div className="form-group">
                      <label className="form-label">Nama Produk *</label>
                      <input className="form-input" name="name" value={form.name} onChange={handleChange} required placeholder="contoh: Jaket Denim Vintage Levi's" />
                    </div>
                    <div className="grid grid-2">
                      <div className="form-group">
                        <label className="form-label">Harga Jual (Rp) *</label>
                        <input className="form-input" name="price" type="number" value={form.price} onChange={handleChange} required placeholder="185000" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Harga Asli (Rp)</label>
                        <input className="form-input" name="original_price" type="number" value={form.original_price} onChange={handleChange} placeholder="350000" />
                      </div>
                    </div>
                    <div className="grid grid-2">
                      <div className="form-group">
                        <label className="form-label">Kategori *</label>
                        <select className="form-select" name="category_id" value={form.category_id} onChange={handleChange} required>
                          <option value="">Pilih Kategori</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Brand</label>
                        <input className="form-input" name="brand" value={form.brand} onChange={handleChange} placeholder="Levi's, Nike, Zara..." />
                      </div>
                    </div>
                    <div className="grid grid-3">
                      <div className="form-group">
                        <label className="form-label">Warna</label>
                        <input className="form-input" name="color" value={form.color} onChange={handleChange} placeholder="Blue Wash" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Material/Bahan</label>
                        <input className="form-input" name="material" value={form.material} onChange={handleChange} placeholder="100% Cotton" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Berat (gram)</label>
                        <input className="form-input" name="weight" type="number" value={form.weight} onChange={handleChange} placeholder="500" />
                      </div>
                    </div>
                    <div className="grid grid-2">
                      <div className="form-group">
                        <label className="form-label">Kondisi *</label>
                        <select className="form-select" name="condition" value={form.condition} onChange={handleChange}>
                          <option>Sangat Baik</option>
                          <option>Baik</option>
                          <option>Cukup Baik</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Stok *</label>
                        <input className="form-input" name="stock" type="number" min="0" value={form.stock} onChange={handleChange} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Deskripsi</label>
                      <textarea className="form-textarea" name="description" value={form.description} onChange={handleChange} placeholder="Jelaskan kondisi produk, keaslian, defect (jika ada), dll." style={{ minHeight: 120 }} />
                    </div>
                    <label className="flex gap-sm" style={{ cursor: 'pointer' }}>
                      <input type="checkbox" name="featured" checked={form.featured} onChange={handleChange} value="true" />
                      <span style={{ fontWeight: 500 }}>Tampilkan sebagai Produk Unggulan di Beranda</span>
                    </label>
                </div>

                {/* Tab: Foto & Video */}
                <div style={{ display: activeTab === 'media' ? 'block' : 'none' }}>
                    <div className="form-group">
                      <label className="form-label">Foto Produk</label>
                      <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: 'var(--space-md)' }}>
                        Upload foto produk dari berbagai sudut. Foto pertama menjadi foto utama. Max 5 foto. Format: JPG, PNG, WebP.
                      </p>

                      <div className="image-upload-grid">
                        {imagePreviews.map((item, i) => (
                          <div key={i} className="image-upload-item">
                            <img src={item.url} alt={`Foto ${i + 1}`} />
                            <div className="image-upload-overlay">
                              {i === 0 && <span className="image-upload-badge">Utama</span>}
                              <button type="button" className="image-upload-remove" onClick={() => removePreview(i)} title="Hapus foto" aria-label="Hapus foto">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              </button>
                            </div>
                          </div>
                        ))}
                        {imagePreviews.length < 5 && (
                          <button type="button" className="image-upload-add" onClick={() => fileInputRef.current?.click()}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                            </svg>
                            <span>Tambah Foto</span>
                          </button>
                        )}
                      </div>
                      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleImageUpload} style={{ display: 'none' }} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Video Produk (URL)</label>
                      <input className="form-input" name="video_url" value={form.video_url} onChange={handleChange} placeholder="https://youtube.com/watch?v=..." />
                    </div>
                </div>

                {/* Tab: Ukuran */}
                <div style={{ display: activeTab === 'size' ? 'block' : 'none' }}>
                    <div className="grid grid-2">
                      <div className="form-group">
                        <label className="form-label">Ukuran Tersedia *</label>
                        <input className="form-input" name="available_sizes" value={form.available_sizes} onChange={handleChange} placeholder="S, M, L, XL" />
                        <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>Pisahkan dengan koma</p>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Ukuran Utama</label>
                        <input className="form-input" name="size" value={form.size} onChange={handleChange} placeholder="L" />
                      </div>
                    </div>
                    <hr style={{ border: 'none', borderTop: '1px solid var(--color-border-light)', margin: 'var(--space-md) 0 var(--space-lg)' }} />
                    <p className="form-label" style={{ marginBottom: 'var(--space-md)' }}>
                      📐 Detail Pengukuran (cm)
                    </p>
                    <div className="grid grid-2">
                      {Object.entries(form.measurements).map(([key, val]) => (
                        <div key={key} className="form-group">
                          <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 500 }}>{key}</label>
                          <input className="form-input" name={`m_${key}`} value={val} onChange={handleChange} placeholder="cm" />
                        </div>
                      ))}
                    </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={pending}>
                  {pending ? 'Menyimpan…' : editItem ? 'Simpan Perubahan' : 'Tambah Produk'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
