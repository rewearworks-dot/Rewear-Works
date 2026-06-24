'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import { CategorySchema } from '@/lib/validation';

export async function createCategory(prevState, formData) {
  await requireAdmin();
  const parsed = CategorySchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, description } = parsed.data;
  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const supabase = await createClient();
  const { error } = await supabase.from('categories').insert({ name, slug, description: description || '' });
  if (error) return { error: error.message.includes('duplicate') ? 'Slug sudah ada' : 'Gagal menyimpan' };
  revalidatePath('/admin/categories');
  revalidatePath('/');
  revalidatePath('/shop');
  return { ok: true };
}

export async function updateCategory(prevState, formData) {
  await requireAdmin();
  const id = formData.get('id');
  const parsed = CategorySchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, description } = parsed.data;
  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const supabase = await createClient();
  const { error } = await supabase.from('categories').update({ name, slug, description: description || '' }).eq('id', id);
  if (error) return { error: 'Gagal memperbarui kategori' };
  revalidatePath('/admin/categories');
  revalidatePath('/');
  revalidatePath('/shop');
  return { ok: true };
}

export async function deleteCategory(id) {
  await requireAdmin();
  const supabase = await createClient();
  // Cek apakah masih ada produk yang pakai kategori ini
  const { count } = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('category_id', id);
  if (count > 0) return { error: 'Tidak bisa menghapus kategori yang masih memiliki produk' };
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) return { error: 'Gagal menghapus kategori' };
  revalidatePath('/admin/categories');
  revalidatePath('/');
  revalidatePath('/shop');
  return { ok: true };
}
