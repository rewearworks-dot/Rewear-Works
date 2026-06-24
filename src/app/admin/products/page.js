import { getProducts } from '@/lib/data/products';
import { getCategories } from '@/lib/data/categories';
import ProductsManager from './ProductsManager';

export default async function AdminProducts() {
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);
  return <ProductsManager products={products} categories={categories} />;
}
