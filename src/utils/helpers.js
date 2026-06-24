export function formatCurrency(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateString) {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(dateString));
}

export function generateId() {
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
}

export function calculateDiscount(originalPrice, price) {
  if (!originalPrice || originalPrice <= 0 || price >= originalPrice) return 0;
  return Math.round(((originalPrice - price) / originalPrice) * 100);
}

// C3: ubah URL video menjadi URL embed yang AMAN.
// Hanya host yang di-allowlist (YouTube/TikTok) yang dirender via <iframe>,
// untuk mencegah XSS lewat src iframe sembarangan.
export function getVideoEmbed(rawUrl) {
  if (!rawUrl) return null;
  let url;
  try { url = new URL(rawUrl); } catch { return null; }
  if (url.protocol !== 'https:') return null;
  const host = url.hostname.replace(/^www\./, '').toLowerCase();

  // YouTube
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const v = url.searchParams.get('v');
    if (v && /^[\w-]{6,20}$/.test(v)) return `https://www.youtube.com/embed/${v}`;
    const shorts = url.pathname.match(/^\/shorts\/([\w-]{6,20})/);
    if (shorts) return `https://www.youtube.com/embed/${shorts[1]}`;
    const embed = url.pathname.match(/^\/embed\/([\w-]{6,20})/);
    if (embed) return `https://www.youtube.com/embed/${embed[1]}`;
    return null;
  }
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1);
    if (/^[\w-]{6,20}$/.test(id)) return `https://www.youtube.com/embed/${id}`;
    return null;
  }

  // TikTok
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) {
    const m = url.pathname.match(/\/video\/(\d{6,30})/);
    if (m) return `https://www.tiktok.com/embed/v2/${m[1]}`;
    return null;
  }

  return null;
}

// Warna badge konsisten untuk status order (Dibatalkan = merah).
export function orderStatusBadge(status) {
  return ({ Baru: 'badge-warning', Diproses: 'badge-warning', Dikirim: 'badge-info',
    Selesai: 'badge-success', Dibatalkan: 'badge-danger' })[status] || 'badge-secondary';
}
