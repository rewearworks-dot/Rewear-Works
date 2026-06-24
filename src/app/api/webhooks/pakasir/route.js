import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { confirmPaymentByOrderId } from '@/lib/payments/confirm';

export async function POST(request) {
  // E4: verifikasi shared-secret bila dikonfigurasi (defense-in-depth; dana tetap
  // diverifikasi ulang ke Pakasir di bawah). Set PAKASIR_WEBHOOK_SECRET di env.
  const secret = process.env.PAKASIR_WEBHOOK_SECRET;
  if (secret) {
    const url = new URL(request.url);
    const provided = request.headers.get('x-webhook-secret') || url.searchParams.get('secret');
    if (provided !== secret) {
      return NextResponse.json({ ok: false, reason: 'forbidden' }, { status: 401 });
    }
  }

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const { order_id, amount } = body || {};
  if (!order_id || amount == null) return NextResponse.json({ ok: false }, { status: 400 });

  // Konfirmasi terpusat (verifikasi otoritatif + guard race + idempoten)
  const result = await confirmPaymentByOrderId(order_id);
  if (result.status === 'not_found') return NextResponse.json({ ok: false }, { status: 404 });

  // Segarkan tampilan agar admin/profil tidak stale
  revalidatePath('/profile');
  revalidatePath('/admin/orders');
  revalidatePath('/admin');

  if (result.status === 'paid' || result.status === 'needs_manual') {
    return NextResponse.json({ ok: true, note: result.status });
  }
  return NextResponse.json({ ok: false, reason: result.status }, { status: 202 });
}
