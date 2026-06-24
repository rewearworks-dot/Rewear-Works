import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/dal';
import { unstable_rethrow } from 'next/navigation';

export async function getAllProfiles() {
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, phone, role, created_at')
      .order('created_at', { ascending: false });
    if (error) { console.error('[getAllProfiles]', error.message); return []; }
    return data ?? [];
  } catch (e) { unstable_rethrow(e); console.error('[getAllProfiles] exception:', e.message); return []; }
}
