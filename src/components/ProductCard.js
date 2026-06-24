import Link from 'next/link';
import Image from 'next/image';
import { formatCurrency, calculateDiscount } from '@/utils/helpers';

export default function ProductCard({ product }) {
  const discount = calculateDiscount(product.originalPrice, product.price);
  const isSold = product.stock <= 0 || product.status === 'sold';

  return (
    <Link href={`/product/${product.id}`} className="product-card">
      <div className="product-card-image" style={{ position: 'relative' }}>
        {product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(max-width:768px) 50vw, 25vw"
            style={{ objectFit: 'cover' }}
            className="product-card-photo"
          />
        ) : (
          <div className="product-card-placeholder">
            {product.categoryName === 'Pria' ? (
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.38 3.46L16 2L12 5.5L8 2L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6l1 12h10l1-12h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>
              </svg>
            ) : (
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L2 8l10 14L22 8l-4-6z"/>
              </svg>
            )}
          </div>
        )}
        {isSold && (
          <span className="product-badge" style={{ background: 'var(--color-danger)' }}>Terjual</span>
        )}
        {!isSold && discount > 0 && (
          <span className="product-badge">-{discount}%</span>
        )}
      </div>
      <div className="product-card-body">
        <p className="product-card-category">{product.categoryName}</p>
        <h4 className="product-card-name">{product.name}</h4>
        <div className="product-card-price">
          <span className="price-current">{formatCurrency(product.price)}</span>
          {product.originalPrice > product.price && (
            <span className="price-original">{formatCurrency(product.originalPrice)}</span>
          )}
        </div>
        <div className="product-card-meta">
          {product.brand && <span className="meta-tag">{product.brand}</span>}
          {product.availableSizes && product.availableSizes.length > 0 ? (
            <span className="meta-tag">📏 {product.availableSizes.join(', ')}</span>
          ) : product.size ? (
            <span className="meta-tag">{product.size}</span>
          ) : null}
          {product.condition && <span className="meta-tag">{product.condition}</span>}
        </div>
      </div>
    </Link>
  );
}
