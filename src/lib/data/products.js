import { createClient } from '@/lib/supabase/server';
import { cache } from 'react';

const SELECT = `
  *,
  category:categories ( id, name, slug ),
  product_images ( id, url, position )
`;

function shape(p) {
  const sorted = (p.product_images ?? []).slice().sort((a, b) => a.position - b.position);
  const images = sorted.map((i) => i.url);
  const imageItems = sorted.map((i) => ({ id: i.id, url: i.url }));
  return {
    ...p,
    price: p.price,
    originalPrice: p.original_price,
    availableSizes: p.available_sizes ?? [],
    measurements: p.measurements ?? {},
    videoUrl: p.video_url ?? '',
    createdAt: p.created_at,
    categoryName: p.category?.name ?? '',
    categorySlug: p.category?.slug ?? '',
    category: p.category_id,
    images,
    imageItems,
    image: images[0] ?? null,
  };
}

export async function getProducts() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('products').select(SELECT)
      .order('created_at', { ascending: false });
    if (error) { console.error('[getProducts]', error.message); return []; }
    return (data ?? []).map(shape);
  } catch (e) { console.error('[getProducts] exception:', e.message); return []; }
}

export async function getFeaturedProducts(limit = 8) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('products').select(SELECT)
      .eq('featured', true).order('created_at', { ascending: false }).limit(limit);
    if (error) { console.error('[getFeaturedProducts]', error.message); return []; }
    return (data ?? []).map(shape);
  } catch (e) { console.error('[getFeaturedProducts] exception:', e.message); return []; }
}

export const getProductById = cache(async (id) => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('products').select(SELECT)
      .eq('id', id).maybeSingle();
    if (error) { console.error('[getProductById]', error.message); return null; }
    return data ? shape(data) : null;
  } catch (e) { console.error('[getProductById] exception:', e.message); return null; }
});

export async function getRelatedProducts(categoryId, excludeId, limit = 4) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('products').select(SELECT)
      .eq('category_id', categoryId).neq('id', excludeId).limit(limit);
    if (error) { console.error('[getRelatedProducts]', error.message); return []; }
    return (data ?? []).map(shape);
  } catch (e) { console.error('[getRelatedProducts] exception:', e.message); return []; }
}
