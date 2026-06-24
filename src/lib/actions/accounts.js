'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AdminSchema } from '@/lib/validation';

export async function createAdmin(prevState, formData) {
  const { user } = await requireAdmin();
  const parsed = AdminSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    full_name: formData.get('full_name'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, password, full_name } = parsed.data;

  // 1) Buat user auth dengan service-role (createUser butuh admin privileges)
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });
  if (error) {
    return { error: error.message.includes('already') ? 'Email sudah terdaftar' : 'Gagal membuat akun' };
  }

  // 2) Naikkan peran lewat RPC set_user_role dari sesi admin yang login
  //    (bukan service-role, karena is_admin() perlu auth.uid())
  const supabase = await createClient();
  const { error: roleError } = await supabase.rpc('set_user_role', {
    p_user: data.user.id,
    p_role: 'admin',
  });
  if (roleError) return { error: 'Akun dibuat tapi gagal menjadikan admin: ' + roleError.message };

  revalidatePath('/admin/accounts');
  return { ok: true };
}

export async function deleteUser(id) {
  const { user } = await requireAdmin();

  // Jangan hapus diri sendiri
  if (id === user.id) return { error: 'Tidak bisa menghapus akun sendiri' };

  // Cek apakah target adalah admin utama (admin@rewearworks.com)
  const adminClient = createAdminClient();
  const { data: targetUser } = await adminClient.auth.admin.getUserById(id);
  if (targetUser?.user?.email === 'admin@rewearworks.com') {
    return { error: 'Tidak bisa menghapus admin utama' };
  }

  // E1: cek pesanan terlebih dahulu — FK orders.user_id ON DELETE RESTRICT akan
  // menggagalkan penghapusan. Beri pesan jelas alih-alih "Gagal menghapus akun".
  const { count } = await adminClient
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', id);
  if (count && count > 0) {
    return { error: `Tidak bisa menghapus: akun ini punya ${count} pesanan. Hapus/batalkan pesanannya dulu, atau nonaktifkan akun.` };
  }

  // Hapus user (profiles ikut cascade)
  const { error } = await adminClient.auth.admin.deleteUser(id);
  if (error) {
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('foreign key') || msg.includes('violates') || msg.includes('restrict')) {
      return { error: 'Tidak bisa menghapus: akun masih punya data terkait (mis. pesanan).' };
    }
    return { error: 'Gagal menghapus akun' };
  }

  revalidatePath('/admin/accounts');
  return { ok: true };
}
