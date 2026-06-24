'use client';
import { useActionState } from 'react';
import Link from 'next/link';
import { login } from '@/lib/actions/auth';

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, null);

  return (
    <div className="auth-page page-enter">
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <Link href="/" className="auth-logo">
              <img src="/logo-circle.png" alt="Rewear Works" />
            </Link>
            <h1>Masuk</h1>
            <p className="text-muted">Masuk ke akun Rewear Works Anda</p>
          </div>

          {state?.error && (
            <div className="auth-error">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              {state.error}
            </div>
          )}

          <form action={action}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="form-input"
                type="email"
                name="email"
                placeholder="nama@email.com"
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                className="form-input"
                type="password"
                name="password"
                placeholder="Masukkan password"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg auth-submit"
              disabled={pending}
            >
              {pending ? (
                <span className="auth-spinner"></span>
              ) : (
                'Masuk'
              )}
            </button>
          </form>

          <div className="auth-divider">
            <span>atau</span>
          </div>

          <p className="auth-footer-text">
            Belum punya akun?{' '}
            <Link href="/register" className="auth-link">Daftar sekarang</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
