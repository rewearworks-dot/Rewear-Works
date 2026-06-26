import Link from 'next/link';
import ProductCard from '@/components/ProductCard';
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

        {/* Hero showcase image */}
        <div className="hero-visual">
          <div className="hero-showcase">
            <img src="/hero/hero.jpg" alt="Koleksi kemeja preloved Rewear Works" />
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
                    <img
                      className="category-card-img"
                      src={cat.slug === 'pria' ? '/categories/pria.jpg' : '/categories/wanita.jpg'}
                      alt={cat.name}
                    />
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
