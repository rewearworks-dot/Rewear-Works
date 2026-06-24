import { createClient } from '@/lib/supabase/server';

export async function getCategories() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('categories').select('*').order('name');
    if (error) { console.error('[getCategories]', error.message); return []; }
    return data ?? [];
  } catch (e) { console.error('[getCategories] exception:', e.message); return []; }
}
