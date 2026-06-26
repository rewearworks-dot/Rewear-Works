'use client';
import { useActionState, useState } from 'react';
import Link from 'next/link';
import { updatePassword } from '@/lib/actions/auth';

export default function ResetPasswordPage() {
  const [state, action, pending] = useActionState(updatePassword, null);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [clientError, setClientError] = useState('');

  const error = clientError || state?.error;

  return (
    <div className="auth-page page-enter">
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <Link href="/" className="auth-logo">
              <img src="/logo-circle.png" alt="Rewear Works" />
            </Link>
            <h1>Reset Password</h1>
            <p className="text-muted">Masukkan password baru untuk akun Anda</p>
          </div>

          {error && (
            <div className="auth-error">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              {error}
            </div>
          )}

          <form action={(formData) => {
            setClientError('');
            const pw = formData.get('password');
            if (pw !== confirmPassword) {
              setClientError('Password dan konfirmasi password tidak sama');
              return;
            }
            action(formData);
          }}>
            <div className="form-group">
              <label className="form-label">Password Baru</label>
              <input
                className="form-input"
                type="password"
                name="password"
                placeholder="Minimal 6 karakter"
                required
                minLength={6}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Konfirmasi Password</label>
              <input
                className="form-input"
                type="password"
                placeholder="Ulangi password baru"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
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
                'Simpan Password Baru'
              )}
            </button>
          </form>

          <div className="auth-divider">
            <span>atau</span>
          </div>

          <p className="auth-footer-text">
            <Link href="/login" className="auth-link">Kembali ke Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
