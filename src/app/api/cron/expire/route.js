import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Fase 1.1 — dipanggil oleh Vercel Cron (atau penjadwal lain) tiap ~15 menit.
// Mengembalikan stok order yang belum dibayar & sudah lewat batas waktu.
export async function GET(request) {
  // Proteksi: hanya boleh dipanggil cron dengan secret.
  const auth = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('expire_unpaid_orders');
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, expired: data ?? 0 });
}
