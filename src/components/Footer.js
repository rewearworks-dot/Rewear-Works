import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <div className="navbar-logo" style={{ color: 'white', marginBottom: '8px' }}>
              <img src="/logo-circle.png" alt="Rewear Works" style={{ width: 40, height: 40, borderRadius: '50%' }} />
              <span>Rewear Works</span>
            </div>
            <p>
              Temukan fashion preloved berkualitas dengan harga terjangkau.
              Bergaya tanpa harus mahal, ramah lingkungan, dan selalu tampil trendi.
            </p>
          </div>

          <div>
            <h4>Navigasi</h4>
            <ul className="footer-links">
              <li><Link href="/">Beranda</Link></li>
              <li><Link href="/shop">Belanja</Link></li>
              <li><Link href="/shop?category=pria">Koleksi Pria</Link></li>
              <li><Link href="/shop?category=wanita">Koleksi Wanita</Link></li>
            </ul>
          </div>

          <div>
            <h4>Layanan</h4>
            <ul className="footer-links">
              <li><Link href="/bantuan#cara-belanja">Cara Belanja</Link></li>
              <li><Link href="/bantuan#pengembalian">Pengembalian</Link></li>
              <li><Link href="/bantuan#faq">FAQ</Link></li>
              <li><Link href="/bantuan#kontak">Kontak Kami</Link></li>
            </ul>
          </div>

          <div>
            <h4>Hubungi Kami</h4>
            <ul className="footer-links">
              <li><a href="https://wa.me/6281234567890" target="_blank" rel="noopener noreferrer">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }}>
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                +62 812-3456-7890
              </a></li>
              <li><a href="mailto:info@rewearworks.com">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }}>
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                </svg>
                info@rewearworks.com
              </a></li>
              <li><a href="https://www.google.com/maps/search/?api=1&query=Jakarta%2C+Indonesia" target="_blank" rel="noopener noreferrer">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }}>
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                Jakarta, Indonesia
              </a></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} Rewear Works. All rights reserved.</p>
          <p>Sustainable Fashion, Affordable Style</p>
        </div>
      </div>
    </footer>
  );
}
