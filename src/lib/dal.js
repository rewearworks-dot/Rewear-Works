import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const getCurrentUser = cache(async () => {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return null;
    const { data: profile } = await supabase
      .from('profiles').select('id, full_name, phone, role, created_at')
      .eq('id', user.id).maybeSingle();
    return { user, profile };
  } catch (e) {
    console.error('[getCurrentUser] exception:', e.message);
    return null;
  }
});

export async function requireAuth() {
  const res = await getCurrentUser();
  if (!res?.user) redirect('/login');
  return res;
}

export async function requireAdmin() {
  const res = await getCurrentUser();
  if (!res?.user) redirect('/login');
  if (res.profile?.role !== 'admin') redirect('/');
  return res;
}
