'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import { ProductSchema } from '@/lib/validation';

const ALLOWED = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

async function uploadImages(supabase, productId, files) {
  const urls = [];
  // Fix E3: lanjutkan posisi dari foto yang sudah ada, jangan reset ke 0
  // (mencegah dua foto ber-"posisi 0"/foto utama ganda saat edit).
  const { data: existing } = await supabase
    .from('product_images').select('position')
    .eq('product_id', productId).order('position', { ascending: false }).limit(1);
  let position = existing && existing.length > 0 ? (existing[0].position + 1) : 0;
  for (const file of files) {
    if (!(file instanceof File) || file.size === 0) continue;
    const ext = ALLOWED[file.type];
    if (!ext) return { error: 'Format gambar harus JPG, PNG, atau WebP' };
    if (file.size > MAX_BYTES) return { error: 'Ukuran gambar maksimal 5 MB' };

    const base = (file.name || 'foto').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 40);
    const safeName = `${base.replace(/\.[^.]*$/, '')}.${ext}`;
    const path = `${productId}/${crypto.randomUUID()}-${safeName}`;

    const { error } = await supabase.storage.from('product-images')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) return { error: 'Gagal mengunggah gambar' };
    const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path);

    // Simpan ke tabel product_images
    await supabase.from('product_images').insert({
      product_id: productId,
      url: publicUrl,
      position: position++,
    });
    urls.push(publicUrl);
  }
  return { urls };
}

function parseFormData(formData) {
  const raw = {
    name: formData.get('name'),
    price: formData.get('price'),
    original_price: formData.get('original_price') || null,
    category_id: formData.get('category_id'),
    size: formData.get('size') || '',
    condition: formData.get('condition') || '',
    brand: formData.get('brand') || '',
    color: formData.get('color') || '',
    material: formData.get('material') || '',
    weight: formData.get('weight') || null,
    description: formData.get('description') || '',
    video_url: formData.get('video_url') || '',
    stock: formData.get('stock') ?? 1,
    featured: formData.get('featured') === 'true' || formData.get('featured') === 'on',
  };
  // Available sizes: comma-separated string → array
  const sizesStr = formData.get('available_sizes') || '';
  raw.available_sizes = sizesStr ? sizesStr.split(',').map(s => s.trim()).filter(Boolean) : [];

  // Measurements: JSON string dari client → object { key: value } (Fix A4)
  const measurementsStr = formData.get('measurements');
  if (measurementsStr) {
    try {
      const obj = JSON.parse(measurementsStr);
      const clean = {};
      for (const [k, v] of Object.entries(obj)) {
        if (v != null && String(v).trim() !== '') clean[k] = String(v).trim();
      }
      raw.measurements = clean;
    } catch { raw.measurements = {}; }
  } else {
    raw.measurements = {};
  }
  return raw;
}

export async function createProduct(prevState, formData) {
  await requireAdmin();
  const raw = parseFormData(formData);
  const parsed = ProductSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const supabase = await createClient();
  const { data: inserted, error } = await supabase.from('products').insert({
    name: data.name,
    price: data.price,
    original_price: data.original_price || null,
    category_id: data.category_id,
    size: data.size || null,
    available_sizes: data.available_sizes || [],
    measurements: data.measurements || {},
    condition: data.condition || null,
    brand: data.brand || null,
    color: data.color || null,
    material: data.material || null,
    weight: data.weight || null,
    description: data.description || null,
    video_url: data.video_url || null,
    stock: data.stock,
    featured: data.featured,
  }).select('id').single();
  if (error) return { error: 'Gagal menyimpan produk' };

  // Upload gambar (abaikan entri kosong dari input file)
  const files = formData.getAll('images').filter(f => f instanceof File && f.size > 0);
  if (files.length > 0) {
    const result = await uploadImages(supabase, inserted.id, files);
    if (result.error) return result;
  }

  revalidatePath('/');
  revalidatePath('/shop');
  revalidatePath('/admin/products');
  return { ok: true };
}

export async function updateProduct(prevState, formData) {
  await requireAdmin();
  const id = formData.get('id');
  const raw = parseFormData(formData);
  const parsed = ProductSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from('products').update({
    name: data.name,
    price: data.price,
    original_price: data.original_price || null,
    category_id: data.category_id,
    size: data.size || null,
    available_sizes: data.available_sizes || [],
    measurements: data.measurements || {},
    condition: data.condition || null,
    brand: data.brand || null,
    color: data.color || null,
    material: data.material || null,
    weight: data.weight || null,
    description: data.description || null,
    video_url: data.video_url || null,
    stock: data.stock,
    featured: data.featured,
  }).eq('id', id);
  if (error) return { error: 'Gagal memperbarui produk' };

  // Upload gambar baru (abaikan entri kosong dari input file)
  const files = formData.getAll('images').filter(f => f instanceof File && f.size > 0);
  if (files.length > 0) {
    const result = await uploadImages(supabase, id, files);
    if (result.error) return result;
  }

  // Hapus gambar yang ditandai untuk dihapus (DB + file Storage), dibatasi milik produk ini
  const deleteIds = formData.get('delete_image_ids');
  if (deleteIds) {
    let ids = [];
    try { ids = JSON.parse(deleteIds); } catch { ids = []; }
    if (Array.isArray(ids) && ids.length > 0) {
      // Ambil url dulu untuk menghapus file di Storage; scope ke product_id (keamanan)
      const { data: imgs } = await supabase
        .from('product_images').select('id, url')
        .in('id', ids).eq('product_id', id);
      if (imgs && imgs.length > 0) {
        const paths = imgs.map(img => {
          try {
            return new URL(img.url).pathname
              .replace('/storage/v1/object/public/product-images/', '');
          } catch { return null; }
        }).filter(Boolean);
        if (paths.length > 0) {
          await supabase.storage.from('product-images').remove(paths);
        }
        const validIds = imgs.map(i => i.id);
        await supabase.from('product_images').delete().in('id', validIds).eq('product_id', id);
      }
    }
  }

  revalidatePath('/');
  revalidatePath('/shop');
  revalidatePath('/admin/products');
  revalidatePath(`/product/${id}`);
  return { ok: true };
}

export async function deleteProduct(id) {
  await requireAdmin();
  const supabase = await createClient();

  // Hapus file dari Storage
  const { data: images } = await supabase.from('product_images').select('url').eq('product_id', id);
  if (images?.length > 0) {
    const paths = images.map(img => {
      const url = new URL(img.url);
      return url.pathname.replace('/storage/v1/object/public/product-images/', '');
    }).filter(Boolean);
    if (paths.length > 0) {
      await supabase.storage.from('product-images').remove(paths);
    }
  }

  // product_images ikut terhapus cascade
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) return { error: 'Gagal menghapus produk' };
  revalidatePath('/');
  revalidatePath('/shop');
  revalidatePath('/admin/products');
  return { ok: true };
}
