'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/context/CartContext';
import ProductCard from '@/components/ProductCard';
import { formatCurrency, calculateDiscount, getVideoEmbed } from '@/utils/helpers';

const measurementLabels = {
  lingkarDada: 'Lingkar Dada',
  panjangBaju: 'Panjang Baju',
  lebarBahu: 'Lebar Bahu',
  panjangLengan: 'Panjang Lengan',
  lingkarPinggang: 'Lingkar Pinggang',
  lingkarPinggul: 'Lingkar Pinggul',
  panjangCelana: 'Panjang Celana',
  lebarKaki: 'Lebar Kaki',
  panjangRok: 'Panjang Rok',
  panjangInsole: 'Panjang Insole',
  lebarInsole: 'Lebar Insole',
  tinggiHeel: 'Tinggi Heel',
  panjang: 'Panjang',
  tinggi: 'Tinggi',
  lebar: 'Lebar',
  panjangTali: 'Panjang Tali',
};

export default function ProductDetail({ product, related }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const [selectedSize, setSelectedSize] = useState('');
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [sizeError, setSizeError] = useState(false);
  // Fix B5: initialize mainImage via useState initializer (not during render)
  const [mainImage, setMainImage] = useState(() => product.images?.[0] ?? null);

  const discount = calculateDiscount(product.originalPrice, product.price);
  const sizes = product.availableSizes || (product.size ? [product.size] : []);
  const measurements = product.measurements || {};
  const hasMeasurements = Object.keys(measurements).length > 0;
  const isSingleSize = sizes.length === 1 && (sizes[0] === 'Free Size' || sizes[0] === 'One Size');
  // Fix A2: removed filter for 'data:' — render ALL image URLs from Storage
  const allImages = product.images || [];
  const hasImages = allImages.length > 0;
  const isSold = product.stock <= 0 || product.status === 'sold';
  const videoEmbed = getVideoEmbed(product.videoUrl);

  const handleAdd = () => {
    if (isSold) return; // Fix B2: prevent adding sold items
    if (!isSingleSize && sizes.length > 0 && !selectedSize) {
      setSizeError(true);
      return;
    }
    const chosenSize = isSingleSize ? sizes[0] : selectedSize || product.size;
    addItem({ ...product, selectedSize: chosenSize });
    setAdded(true);
    setSizeError(false);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="page-enter" style={{ marginTop: 'var(--navbar-height)' }}>
      <section className="section">
        <div className="container">
          {/* Breadcrumb */}
          <div className="flex gap-sm" style={{ marginBottom: 'var(--space-xl)', fontSize: '0.9rem' }}>
            <Link href="/" style={{ color: 'var(--color-text-muted)' }}>Beranda</Link>
            <span style={{ color: 'var(--color-text-light)' }}>/</span>
            <Link href="/shop" style={{ color: 'var(--color-text-muted)' }}>Belanja</Link>
            <span style={{ color: 'var(--color-text-light)' }}>/</span>
            <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{product.name}</span>
          </div>

          <div className="product-detail-grid">
            {/* Image Gallery */}
            <div>
              <div className="product-gallery-main" style={{ position: 'relative' }}>
                {hasImages && mainImage ? (
                  <Image src={mainImage} alt={product.name} fill sizes="(max-width:768px) 100vw, 50vw"
                         style={{ objectFit: 'cover' }} className="product-gallery-img" priority />
                ) : (
                  <svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-light)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
                    <path d="M20.38 3.46L16 2L12 5.5L8 2L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6l1 12h10l1-12h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>
                  </svg>
                )}
                {isSold && (
                  <span className="product-badge" style={{ fontSize: '0.9rem', padding: '6px 16px', background: 'var(--color-danger)' }}>Terjual</span>
                )}
                {!isSold && discount > 0 && (
                  <span className="product-badge" style={{ fontSize: '0.9rem', padding: '6px 16px' }}>-{discount}%</span>
                )}
              </div>
              {allImages.length > 1 && (
                <div className="product-gallery-thumbs">
                  {allImages.map((img, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`product-gallery-thumb ${mainImage === img ? 'active' : ''}`}
                      onClick={() => setMainImage(img)}
                      aria-label={`Foto ${i + 1}`}
                    >
                      <Image src={img} alt={`Foto ${i + 1}`} width={80} height={80} style={{ objectFit: 'cover' }} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Info */}
            <div>
              <p className="product-card-category" style={{ marginBottom: 'var(--space-sm)' }}>{product.categoryName}</p>
              <h1 style={{ marginBottom: 'var(--space-md)', fontSize: '2rem' }}>{product.name}</h1>

              <div className="flex gap-md" style={{ marginBottom: 'var(--space-lg)' }}>
                <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-accent)' }}>
                  {formatCurrency(product.price)}
                </span>
                {product.originalPrice > product.price && (
                  <span style={{ fontSize: '1.2rem', color: 'var(--color-text-light)', textDecoration: 'line-through', alignSelf: 'center' }}>
                    {formatCurrency(product.originalPrice)}
                  </span>
                )}
              </div>

              <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.8, marginBottom: 'var(--space-xl)', fontSize: '1.05rem' }}>
                {product.description}
              </p>

              {/* Size Selector */}
              {sizes.length > 0 && !isSingleSize && (
                <div style={{ marginBottom: 'var(--space-xl)' }}>
                  <div className="flex-between" style={{ marginBottom: 'var(--space-sm)' }}>
                    <label className="form-label" style={{ margin: 0 }}>
                      Pilih Ukuran <span style={{ color: 'var(--color-accent)' }}>*</span>
                    </label>
                    {hasMeasurements && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setShowSizeGuide(!showSizeGuide)}
                        style={{ color: 'var(--color-primary)', fontSize: '0.85rem' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M2 17l10-10M4 19l2-2M8 15l2-2M12 11l2-2M16 7l2-2M18 5l4 4-14 14-4-4z"/>
                        </svg>
                        Panduan Ukuran
                      </button>
                    )}
                  </div>

                  <div className="size-selector">
                    {sizes.map(s => (
                      <button
                        key={s}
                        type="button"
                        className={`size-chip ${selectedSize === s ? 'active' : ''} ${sizeError && !selectedSize ? 'error' : ''}`}
                        onClick={() => { setSelectedSize(s); setSizeError(false); }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  {sizeError && (
                    <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem', marginTop: 'var(--space-sm)', fontWeight: 500 }}>
                      Silakan pilih ukuran terlebih dahulu
                    </p>
                  )}
                </div>
              )}

              {/* Single size display */}
              {isSingleSize && (
                <div style={{ marginBottom: 'var(--space-xl)' }}>
                  <label className="form-label" style={{ marginBottom: 'var(--space-sm)' }}>Ukuran</label>
                  <span className="badge badge-primary" style={{ fontSize: '0.9rem', padding: '6px 14px' }}>{sizes[0]}</span>
                </div>
              )}

              {/* Measurement Table */}
              {showSizeGuide && hasMeasurements && (
                <div className="card" style={{ marginBottom: 'var(--space-xl)', background: 'var(--color-bg)', animation: 'slideUp 200ms ease' }}>
                  <div className="flex-between" style={{ marginBottom: 'var(--space-md)' }}>
                    <h4 style={{ fontFamily: 'var(--font-body)', fontSize: '0.95rem' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" style={{ verticalAlign: 'middle', marginRight: 6 }}>
                        <path d="M2 17l10-10M4 19l2-2M8 15l2-2M12 11l2-2M16 7l2-2M18 5l4 4-14 14-4-4z"/>
                      </svg>
                      Detail Pengukuran
                    </h4>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowSizeGuide(false)} style={{ fontSize: '0.8rem' }}>Tutup</button>
                  </div>
                  <div className="measurement-grid">
                    {Object.entries(measurements).map(([key, val]) => (
                      <div key={key} className="measurement-item">
                        <span className="measurement-label">{measurementLabels[key] || key}</span>
                        <span className="measurement-value">{val}</span>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', marginTop: 'var(--space-md)', fontStyle: 'italic' }}>
                    * Ukuran diambil secara flat (rata). Toleransi ±1-2 cm.
                  </p>
                </div>
              )}

              {/* Detail Grid */}
              <div className="product-info-grid" style={{ marginBottom: 'var(--space-xl)' }}>
                <div className="card" style={{ padding: 'var(--space-md)' }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>Brand</p>
                  <p style={{ fontWeight: 700 }}>{product.brand || '-'}</p>
                </div>
                <div className="card" style={{ padding: 'var(--space-md)' }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>Kondisi</p>
                  <p style={{ fontWeight: 700 }}>{product.condition || '-'}</p>
                </div>
                <div className="card" style={{ padding: 'var(--space-md)' }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>Warna</p>
                  <p style={{ fontWeight: 700 }}>{product.color || '-'}</p>
                </div>
                <div className="card" style={{ padding: 'var(--space-md)' }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>Material</p>
                  <p style={{ fontWeight: 700 }}>{product.material || '-'}</p>
                </div>
                <div className="card" style={{ padding: 'var(--space-md)' }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>Stok</p>
                  <p style={{ fontWeight: 700 }}>{isSold ? 'Habis' : `${product.stock} pcs`}</p>
                </div>
                <div className="card" style={{ padding: 'var(--space-md)' }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>Ukuran Tersedia</p>
                  <p style={{ fontWeight: 700 }}>{sizes.join(', ')}</p>
                </div>
              </div>

              {/* Add to Cart */}
              <button
                className={`btn ${isSold ? 'btn-secondary' : added ? 'btn-success' : 'btn-accent'} btn-lg`}
                style={{ width: '100%', fontSize: '1.1rem', padding: '18px' }}
                onClick={handleAdd}
                disabled={isSold}
              >
                {isSold ? (
                  <>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    Stok Habis
                  </>
                ) : added ? (
                  <>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    Ditambahkan! {selectedSize && `(Ukuran ${selectedSize})`}
                  </>
                ) : (
                  <>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                    Tambah ke Keranjang
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Video Produk (C3: hanya host allowlist) */}
          {videoEmbed && (
            <div style={{ marginTop: 'var(--space-3xl)' }}>
              <div className="section-header">
                <h2>Video Produk</h2>
                <div className="line"></div>
              </div>
              <div style={{ position: 'relative', width: '100%', maxWidth: 720, margin: '0 auto', aspectRatio: '16 / 9', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: '#000' }}>
                <iframe
                  src={videoEmbed}
                  title={`Video ${product.name}`}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  referrerPolicy="strict-origin-when-cross-origin"
                  loading="lazy"
                  allowFullScreen
                />
              </div>
            </div>
          )}

          {/* Related Products */}
          {related.length > 0 && (
            <div style={{ marginTop: 'var(--space-4xl)' }}>
              <div className="section-header">
                <h2>Produk Terkait</h2>
                <div className="line"></div>
              </div>
              <div className="grid grid-4">
                {related.map(p => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
