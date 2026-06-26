'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { RegisterSchema, ForgotPasswordSchema, ResetPasswordSchema } from '@/lib/validation';

export async function login(prevState, formData) {
  const email = String(formData.get('email') || '');
  const password = String(formData.get('password') || '');
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: 'Email atau password salah' };

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle();
  revalidatePath('/', 'layout');
  redirect(profile?.role === 'admin' ? '/admin' : '/');
}

export async function register(prevState, formData) {
  const parsed = RegisterSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, phone, password } = parsed.data;

  const supabase = await createClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL || '';
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name, phone: phone || '' },
      // Arahkan link konfirmasi ke domain produksi (bukan localhost/Site URL default).
      ...(site ? { emailRedirectTo: `${site}/auth/callback` } : {}),
    },
  });
  if (error) {
    return { error: error.message.includes('registered') ? 'Email sudah terdaftar' : 'Gagal mendaftar' };
  }
  revalidatePath('/', 'layout');
  // Bila "Confirm email" ON di Supabase, signUp tidak mengembalikan session
  if (!data.session) {
    redirect('/register?check-email=1');
  }
  redirect('/');
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}

export async function requestPasswordReset(prevState, formData) {
  const parsed = ForgotPasswordSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email } = parsed.data;

  try {
    const supabase = await createClient();
    const site = process.env.NEXT_PUBLIC_SITE_URL || '';
    await supabase.auth.resetPasswordForEmail(
      email,
      // Hanya set redirectTo bila site non-empty (mirror penanganan `site` di register)
      site ? { redirectTo: `${site}/auth/callback?next=/reset-password` } : undefined,
    );
  } catch {
    return { error: 'Gagal mengirim email reset' };
  }
  // Jangan bocorkan apakah email terdaftar — selalu pesan generik
  return { success: 'Jika email terdaftar, link reset password telah dikirim. Cek inbox/spam Anda.' };
}

export async function updatePassword(prevState, formData) {
  const parsed = ResetPasswordSchema.safeParse({ password: formData.get('password') });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { password } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: 'Gagal memperbarui password. Link mungkin sudah kedaluwarsa, minta link baru.' };

  revalidatePath('/', 'layout');
  redirect('/login?reset=1');
}
