import { Suspense } from 'react';
import { getProducts } from '@/lib/data/products';
import { getCategories } from '@/lib/data/categories';
import ShopClient from './ShopClient';

export default async function ShopPage() {
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);
  return (
    <Suspense fallback={<div className="container section" style={{ marginTop: 'var(--navbar-height)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Memuat…</div>}>
      <ShopClient products={products} categories={categories} />
    </Suspense>
  );
}
