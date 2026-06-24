'use client';
import { useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import ProductCard from '@/components/ProductCard';

export default function ShopClient({ products, categories }) {
  const searchParams = useSearchParams();
  const categorySlug = searchParams.get('category');

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(categorySlug || 'semua');
  const [sortBy, setSortBy] = useState('terbaru');
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 8;

  // Fix B1: sinkronkan filter dengan URL tanpa useEffect (pola "adjust state
  // during render"). Klik "Pria"/"Wanita" di navbar saat sudah berada di /shop
  // mengubah ?category=… → filter ikut ter-reset.
  const [prevSlug, setPrevSlug] = useState(categorySlug);
  if (categorySlug !== prevSlug) {
    setPrevSlug(categorySlug);
    setActiveCategory(categorySlug || 'semua');
    setCurrentPage(1);
  }

  const filtered = useMemo(() => {
    let result = [...products];

    if (activeCategory && activeCategory !== 'semua') {
      const cat = categories.find(c => c.slug === activeCategory);
      if (cat) result = result.filter(p => p.category === cat.id);
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.categoryName && p.categoryName.toLowerCase().includes(q))
      );
    }

    switch (sortBy) {
      case 'termurah': result.sort((a, b) => a.price - b.price); break;
      case 'termahal': result.sort((a, b) => b.price - a.price); break;
      case 'terbaru': default: result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); break;
    }

    return result;
  }, [products, categories, activeCategory, search, sortBy]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  return (
    <div className="page-enter" style={{ marginTop: 'var(--navbar-height)', minHeight: '100vh' }}>
      <section className="section">
        <div className="container">
          <div className="section-header" style={{ marginBottom: 'var(--space-lg)' }}>
            <h1>Belanja</h1>
            <p>Temukan fashion preloved berkualitas dari brand ternama</p>
            <div className="line"></div>
          </div>

          {/* Filter Bar */}
          <div className="filter-bar">
            <div className="search-bar" style={{ flex: 1, maxWidth: 360 }}>
              <svg className="search-bar-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input
                type="text"
                placeholder="Cari produk, brand..."
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              />
            </div>

            <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
              <button
                className={`filter-chip ${activeCategory === 'semua' ? 'active' : ''}`}
                onClick={() => { setActiveCategory('semua'); setCurrentPage(1); }}
              >
                Semua
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  className={`filter-chip ${activeCategory === cat.slug ? 'active' : ''}`}
                  onClick={() => { setActiveCategory(cat.slug); setCurrentPage(1); }}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            <select
              className="form-select"
              style={{ width: 'auto', minWidth: 160 }}
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
            >
              <option value="terbaru">Terbaru</option>
              <option value="termurah">Harga Termurah</option>
              <option value="termahal">Harga Termahal</option>
            </select>
          </div>

          {/* Results count */}
          <p className="text-muted" style={{ marginBottom: 'var(--space-lg)', fontSize: '0.9rem' }}>
            Menampilkan {paginated.length} dari {filtered.length} produk
          </p>

          {/* Products Grid */}
          {paginated.length > 0 ? (
            <div className="grid grid-4">
              {paginated.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              </div>
              <h3>Produk tidak ditemukan</h3>
              <p>Coba ubah kata kunci atau filter pencarian</p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="pagination-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
              >
                &lt;
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i + 1}
                  className={`pagination-btn ${currentPage === i + 1 ? 'active' : ''}`}
                  onClick={() => setCurrentPage(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
              <button
                className="pagination-btn"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
              >
                &gt;
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
