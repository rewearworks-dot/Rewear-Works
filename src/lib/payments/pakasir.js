import 'server-only';
const BASE = 'https://app.pakasir.com';

export function buildPayUrl({ total, orderId, redirectUrl, qrisOnly = false }) {
  const slug = process.env.PAKASIR_SLUG;
  if (!slug) return null; // Pakasir belum dikonfigurasi
  const params = new URLSearchParams({ order_id: orderId });
  if (redirectUrl) params.set('redirect', redirectUrl);
  if (qrisOnly) params.set('qris_only', '1');
  return `${BASE}/pay/${slug}/${total}?${params.toString()}`;
}

export async function getTransactionDetail({ amount, orderId }) {
  const slug = process.env.PAKASIR_SLUG;
  const key = process.env.PAKASIR_API_KEY;
  if (!slug || !key) return null;
  const url = `${BASE}/api/transactiondetail?project=${slug}&amount=${amount}&order_id=${encodeURIComponent(orderId)}&api_key=${key}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;
  const json = await res.json();
  return json.transaction ?? null;
}
