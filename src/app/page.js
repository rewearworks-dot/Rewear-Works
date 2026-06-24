import Link from 'next/link';
import ProductCard from '@/components/ProductCard';
import { formatCurrency } from '@/utils/helpers';
import { getProducts } from '@/lib/data/products';
import { getCategories } from '@/lib/data/categories';

export default async function HomePage() {
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);
  const featuredProducts = products.filter(p => p.featured).slice(0, 8);
  const newArrivals = [...products].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 4);

  return (
    <div className="page-enter">
      {/* ======= HERO SECTION ======= */}
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <div className="hero-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              Sustainable Fashion
            </div>
            <h1>
              Tampil Keren Dengan<br/>
              <span>Fashion Preloved</span><br/>
              Berkualitas
            </h1>
            <p>
              Temukan koleksi fashion preloved dari brand-brand ternama dengan harga
              terjangkau. Bergaya tanpa mahal, ramah lingkungan.
            </p>
            <div className="hero-buttons">
              <Link href="/shop" className="btn btn-primary btn-lg">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                Mulai Belanja
              </Link>
              <Link href="/shop?category=wanita" className="btn btn-outline btn-lg">
                Koleksi Wanita
              </Link>
            </div>
          </div>
        </div>

        {/* Floating cards - 3D elements */}
        <div className="hero-visual">
          <div className="floating-card" style={{'--rotate': '-5deg'}}>
            <div className="floating-card-img">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CA8A04" strokeWidth="1.5"><path d="M20.38 3.46L16 2L12 5.5L8 2L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6l1 12h10l1-12h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/></svg>
            </div>
            <div className="floating-card-info">
              <h4>Jaket Denim Vintage</h4>
              <span className="price">{formatCurrency(185000)}</span>
            </div>
          </div>
          <div className="floating-card" style={{'--rotate': '5deg'}}>
            <div className="floating-card-img" style={{background: 'linear-gradient(135deg, #EDE4D8, #D4C4A8)'}}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="1.5"><path d="M6 2L2 8l10 14L22 8l-4-6z"/></svg>
            </div>
            <div className="floating-card-info">
              <h4>Dress Floral Vintage</h4>
              <span className="price">{formatCurrency(135000)}</span>
            </div>
          </div>
          <div className="floating-card" style={{'--rotate': '-3deg'}}>
            <div className="floating-card-img" style={{background: 'linear-gradient(135deg, #F0EBE3, #E5DDD3)'}}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#2C3E6B" strokeWidth="1.5"><rect x="3" y="6" width="18" height="15" rx="2"/><path d="M3 12h18"/><path d="M12 6v15"/></svg>
            </div>
            <div className="floating-card-info">
              <h4>Tas Tote Canvas</h4>
              <span className="price">{formatCurrency(175000)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ======= KATEGORI ======= */}
      <section className="section">
        <div className="container">
          <div className="section-header">
            <h2>Belanja Berdasarkan Kategori</h2>
            <p>Temukan koleksi terbaik untuk gaya Anda</p>
            <div className="line"></div>
          </div>

          <div className="grid grid-2" style={{ maxWidth: 800, margin: '0 auto' }}>
            {categories.map(cat => (
              <Link key={cat.id} href={`/shop?category=${cat.slug}`} style={{ textDecoration: 'none' }}>
                <div className={`category-card`}>
                  <div className={`category-card-bg ${cat.slug === 'wanita' ? 'wanita' : ''}`}>
                    <div className="category-card-icon">
                      {cat.slug === 'pria' ? (
                        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1"><path d="M20.38 3.46L16 2L12 5.5L8 2L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6l1 12h10l1-12h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/></svg>
                      ) : (
                        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1"><path d="M6 2L2 8l10 14L22 8l-4-6z"/></svg>
                      )}
                    </div>
                  </div>
                  <div className="category-card-overlay"></div>
                  <div className="category-card-content">
                    <h3>{cat.name}</h3>
                    <p>{cat.description}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ======= PRODUK UNGGULAN ======= */}
      <section className="section" style={{ background: 'var(--color-bg-alt)' }}>
        <div className="container">
          <div className="section-header">
            <h2>Produk Unggulan</h2>
            <p>Pilihan terbaik dari koleksi kami</p>
            <div className="line"></div>
          </div>

          <div className="grid grid-4">
            {featuredProducts.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: 'var(--space-xl)' }}>
            <Link href="/shop" className="btn btn-outline btn-lg">
              Lihat Semua Produk
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ======= NEW ARRIVALS ======= */}
      <section className="section">
        <div className="container">
          <div className="section-header">
            <h2>Baru Datang</h2>
            <p>Koleksi terbaru yang baru saja masuk</p>
            <div className="line"></div>
          </div>

          <div className="grid grid-4">
            {newArrivals.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* ======= CTA BANNER ======= */}
      <section className="section" style={{
        background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
        color: 'white',
        textAlign: 'center',
      }}>
        <div className="container">
          <h2 style={{ color: 'white', marginBottom: 'var(--space-md)' }}>
            Mulai Jual Beli Fashion Preloved
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.8)', maxWidth: 500, margin: '0 auto var(--space-xl)', fontSize: '1.1rem' }}>
            Bergabunglah dengan komunitas sustainable fashion terbesar. Jual baju lama, beli yang baru!
          </p>
          <Link href="/shop" className="btn btn-gold btn-lg">
            Jelajahi Koleksi
          </Link>
        </div>
      </section>
    </div>
  );
}
