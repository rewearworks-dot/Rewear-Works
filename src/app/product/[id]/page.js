import { notFound } from 'next/navigation';
import { getProductById, getRelatedProducts } from '@/lib/data/products';
import ProductDetail from './ProductDetail';

export async function generateMetadata({ params }) {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) return { title: 'Produk Tidak Ditemukan' };
  return {
    title: `${product.name} — Rewear Works`,
    description: product.description?.slice(0, 160) || `Beli ${product.name} preloved berkualitas`,
  };
}

export default async function ProductDetailPage({ params }) {
  const { id } = await params; // Next.js 16: params is a Promise in Server Components
  const product = await getProductById(id);
  if (!product) notFound();

  const related = await getRelatedProducts(product.category_id, product.id, 4);

  return <ProductDetail product={product} related={related} />;
}
