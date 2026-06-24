import { getCategories } from '@/lib/data/categories';
import { getProducts } from '@/lib/data/products';
import CategoriesManager from './CategoriesManager';

export default async function AdminCategories() {
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);
  // count produk per kategori
  const catsWithCount = categories.map(c => ({
    ...c,
    productCount: products.filter(p => p.category === c.id).length,
  }));
  return <CategoriesManager categories={catsWithCount} />;
}
