'use client';
import { useActionState, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { register } from '@/lib/actions/auth';
import { Suspense } from 'react';

function RegisterContent() {
  const searchParams = useSearchParams();
  const checkEmail = searchParams.get('check-email');
  const [state, action, pending] = useActionState(register, null);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [clientError, setClientError] = useState('');

  if (checkEmail) {
    return (
      <div className="auth-page page-enter">
        <div className="auth-container">
          <div className="auth-card">
            <div className="auth-header">
              <h1>Cek Email Anda</h1>
              <p className="text-muted">Kami telah mengirim email verifikasi. Silakan cek inbox atau folder spam Anda.</p>
            </div>
            <Link href="/login" className="btn btn-primary btn-lg auth-submit">Kembali ke Login</Link>
          </div>
        </div>
      </div>
    );
  }

  const error = clientError || state?.error;

  return (
    <div className="auth-page page-enter">
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <Link href="/" className="auth-logo">
              <img src="/logo-circle.png" alt="Rewear Works" />
            </Link>
            <h1>Daftar</h1>
            <p className="text-muted">Buat akun baru untuk mulai belanja</p>
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
              <label className="form-label">Nama Lengkap</label>
              <input
                className="form-input"
                type="text"
                name="name"
                placeholder="Nama lengkap Anda"
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="form-input"
                type="email"
                name="email"
                placeholder="nama@email.com"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">No. Telepon</label>
              <input
                className="form-input"
                type="tel"
                name="phone"
                placeholder="08xx-xxxx-xxxx"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                className="form-input"
                type="password"
                name="password"
                placeholder="Minimal 6 karakter"
                required
                minLength={6}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Konfirmasi Password</label>
              <input
                className="form-input"
                type="password"
                placeholder="Ulangi password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-accent btn-lg auth-submit"
              disabled={pending}
            >
              {pending ? (
                <span className="auth-spinner"></span>
              ) : (
                'Daftar'
              )}
            </button>
          </form>

          <div className="auth-divider">
            <span>atau</span>
          </div>

          <p className="auth-footer-text">
            Sudah punya akun?{' '}
            <Link href="/login" className="auth-link">Masuk</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="auth-page page-enter"><div className="auth-container"><div className="auth-card">Memuat…</div></div></div>}>
      <RegisterContent />
    </Suspense>
  );
}
