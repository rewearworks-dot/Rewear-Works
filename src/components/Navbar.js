'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { totalItems } = useCart();
  const { currentUser, isLoggedIn, isAdmin, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
  }, [menuOpen]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClick = () => setDropdownOpen(false);
    if (dropdownOpen) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [dropdownOpen]);

  return (
    <>
      <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
        <div className="navbar-inner">
          <Link href="/" className="navbar-logo">
            <img src="/logo-circle.png" alt="Rewear Works" />
            <span>Rewear Works</span>
          </Link>

          <ul className="navbar-links">
            <li><Link href="/">Beranda</Link></li>
            <li><Link href="/shop">Belanja</Link></li>
            <li><Link href="/shop?category=pria">Pria</Link></li>
            <li><Link href="/shop?category=wanita">Wanita</Link></li>
          </ul>

          <div className="navbar-actions">
            {isLoggedIn ? (
              <>
                {/* Cart */}
                <Link href="/cart" className="cart-btn">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                  </svg>
                  {totalItems > 0 && <span className="cart-badge">{totalItems}</span>}
                </Link>

                {/* User Dropdown */}
                <div className="user-dropdown-wrapper" onClick={e => e.stopPropagation()}>
                  <button
                    className="user-avatar-btn"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    aria-label="Menu pengguna"
                  >
                    <div className="user-avatar">
                      {currentUser.name?.charAt(0).toUpperCase()}
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transition: 'transform 200ms', transform: dropdownOpen ? 'rotate(180deg)' : '' }}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>

                  {dropdownOpen && (
                    <div className="user-dropdown">
                      <div className="user-dropdown-header">
                        <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>{currentUser.name}</p>
                        <p className="text-muted" style={{ fontSize: '0.8rem' }}>{currentUser.email}</p>
                        <span className={`badge ${isAdmin ? 'badge-primary' : 'badge-success'}`} style={{ marginTop: 4, fontSize: '0.7rem' }}>
                          {isAdmin ? 'Admin' : 'Pelanggan'}
                        </span>
                      </div>
                      <div className="user-dropdown-divider"></div>

                      {isAdmin && (
                        <Link href="/admin" className="user-dropdown-item" onClick={() => setDropdownOpen(false)}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                          Panel Admin
                        </Link>
                      )}

                      <Link href="/profile" className="user-dropdown-item" onClick={() => setDropdownOpen(false)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        Profil Saya
                      </Link>

                      <div className="user-dropdown-divider"></div>

                      <button className="user-dropdown-item user-dropdown-logout" onClick={() => { logout(); setDropdownOpen(false); }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                        Keluar
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link href="/login" className="btn-login">Masuk</Link>
                <Link href="/register" className="btn btn-primary btn-sm">Daftar</Link>
              </>
            )}

            <button
              className="menu-toggle"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menu"
            >
              <span style={menuOpen ? { transform: 'rotate(45deg) translate(5px, 5px)' } : {}} />
              <span style={menuOpen ? { opacity: 0 } : {}} />
              <span style={menuOpen ? { transform: 'rotate(-45deg) translate(5px, -5px)' } : {}} />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <div className={`mobile-menu ${menuOpen ? 'open' : ''}`}>
        <Link href="/" onClick={() => setMenuOpen(false)}>Beranda</Link>
        <Link href="/shop" onClick={() => setMenuOpen(false)}>Belanja</Link>
        <Link href="/shop?category=pria" onClick={() => setMenuOpen(false)}>Pria</Link>
        <Link href="/shop?category=wanita" onClick={() => setMenuOpen(false)}>Wanita</Link>
        {isLoggedIn ? (
          <>
            <Link href="/cart" onClick={() => setMenuOpen(false)}>Keranjang ({totalItems})</Link>
            {isAdmin && <Link href="/admin" onClick={() => setMenuOpen(false)}>Panel Admin</Link>}
            <Link href="/profile" onClick={() => setMenuOpen(false)}>Profil Saya</Link>
            <button onClick={() => { logout(); setMenuOpen(false); }} style={{ background: 'none', border: 'none', fontFamily: 'var(--font-heading)', fontSize: '1.75rem', fontWeight: 600, color: 'var(--color-danger)', cursor: 'pointer' }}>
              Keluar
            </button>
          </>
        ) : (
          <>
            <Link href="/login" onClick={() => setMenuOpen(false)}>Masuk</Link>
            <Link href="/register" onClick={() => setMenuOpen(false)}>Daftar</Link>
          </>
        )}
      </div>
    </>
  );
}
