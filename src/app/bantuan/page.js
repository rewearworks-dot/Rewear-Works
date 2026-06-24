import Link from 'next/link';

export const metadata = {
  title: 'Bantuan — Rewear Works',
  description: 'Cara belanja, kebijakan pengembalian, FAQ, dan kontak Rewear Works.',
};

const sections = [
  {
    id: 'cara-belanja',
    title: 'Cara Belanja',
    body: [
      'Pilih produk di halaman Belanja, lalu pilih ukuran (jika tersedia) dan tambahkan ke keranjang.',
      'Buka keranjang, periksa item dan jumlahnya, lalu lanjut ke Checkout.',
      'Isi data pengiriman dan selesaikan pembayaran melalui metode yang tersedia.',
      'Status pesanan dapat dipantau di halaman Profil → Riwayat Pesanan.',
    ],
  },
  {
    id: 'pengembalian',
    title: 'Pengembalian',
    body: [
      'Karena produk preloved umumnya berstok satu dan kondisinya dijelaskan apa adanya, pengembalian hanya berlaku bila barang tidak sesuai deskripsi.',
      'Ajukan pengembalian maksimal 2x24 jam setelah barang diterima dengan menyertakan foto.',
      'Barang harus dikembalikan dalam kondisi yang sama seperti saat diterima.',
    ],
  },
  {
    id: 'faq',
    title: 'FAQ',
    body: [
      'Apakah semua produk asli? Ya, setiap item dikurasi dan dijelaskan kondisinya.',
      'Berapa lama pesanan diproses? Pesanan yang sudah dibayar diproses 1-2 hari kerja.',
      'Apakah stok bisa di-booking? Stok baru terkunci setelah checkout dan akan dilepas otomatis bila pembayaran tidak diselesaikan.',
    ],
  },
];

export default function BantuanPage() {
  return (
    <div className="page-enter" style={{ marginTop: 'var(--navbar-height)', minHeight: '80vh' }}>
      <section className="section">
        <div className="container" style={{ maxWidth: 800 }}>
          <h1 style={{ marginBottom: 'var(--space-xl)' }}>Pusat Bantuan</h1>

          {sections.map(s => (
            <div key={s.id} id={s.id} className="card" style={{ marginBottom: 'var(--space-lg)', scrollMarginTop: 'calc(var(--navbar-height) + var(--space-lg))' }}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-md)' }}>{s.title}</h2>
              <ul style={{ lineHeight: 1.8, color: 'var(--color-text-muted)', paddingLeft: '1.2rem' }}>
                {s.body.map((line, i) => <li key={i} style={{ marginBottom: 6 }}>{line}</li>)}
              </ul>
            </div>
          ))}

          <div id="kontak" className="card" style={{ scrollMarginTop: 'calc(var(--navbar-height) + var(--space-lg))' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-md)' }}>Kontak Kami</h2>
            <p className="text-muted" style={{ lineHeight: 1.8 }}>
              WhatsApp: <a href="https://wa.me/6281234567890">+62 812-3456-7890</a><br />
              Email: <a href="mailto:info@rewearworks.com">info@rewearworks.com</a><br />
              Lokasi: Jakarta, Indonesia
            </p>
            <Link href="/shop" className="btn btn-primary btn-sm" style={{ marginTop: 'var(--space-md)' }}>Mulai Belanja</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
