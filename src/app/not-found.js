import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="page-enter" style={{ marginTop: 'var(--navbar-height)', minHeight: '80vh' }}>
      <div className="container section">
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <path d="M16 16s-1.5-2-4-2-4 2-4 2"/>
              <line x1="9" y1="9" x2="9.01" y2="9"/>
              <line x1="15" y1="9" x2="15.01" y2="9"/>
            </svg>
          </div>
          <h3>Halaman Tidak Ditemukan</h3>
          <p>Maaf, halaman yang Anda cari tidak tersedia atau telah dipindahkan.</p>
          <Link href="/" className="btn btn-primary" style={{ marginTop: 16 }}>
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    </div>
  );
}
