'use client';
import { useActionState } from 'react';
import Link from 'next/link';
import { requestPasswordReset } from '@/lib/actions/auth';

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);

  return (
    <div className="auth-page page-enter">
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <Link href="/" className="auth-logo">
              <img src="/logo-circle.png" alt="Rewear Works" />
            </Link>
            <h1>Lupa Password</h1>
            <p className="text-muted">Masukkan email Anda untuk menerima link reset password</p>
          </div>

          {state?.error && (
            <div className="auth-error">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              {state.error}
            </div>
          )}

          {state?.success ? (
            <div className="auth-error" style={{ background: '#ecfdf5', borderColor: '#a7f3d0', color: '#047857' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              {state.success}
            </div>
          ) : (
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

              <button
                type="submit"
                className="btn btn-primary btn-lg auth-submit"
                disabled={pending}
              >
                {pending ? (
                  <span className="auth-spinner"></span>
                ) : (
                  'Kirim Link Reset'
                )}
              </button>
            </form>
          )}

          <div className="auth-divider">
            <span>atau</span>
          </div>

          <p className="auth-footer-text">
            Ingat password Anda?{' '}
            <Link href="/login" className="auth-link">Kembali ke Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
