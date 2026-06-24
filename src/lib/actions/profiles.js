'use server';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import { ProfileSchema } from '@/lib/validation';

// C2: ubah nama & telepon profil milik sendiri.
export async function updateProfile(prevState, formData) {
  const { user } = await requireAuth();
  const parsed = ProfileSchema.safeParse({
    full_name: formData.get('full_name'),
    phone: formData.get('phone') || '',
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: parsed.data.full_name, phone: parsed.data.phone || null })
    .eq('id', user.id);
  if (error) return { error: 'Gagal memperbarui profil' };

  revalidatePath('/profile');
  return { ok: true };
}
