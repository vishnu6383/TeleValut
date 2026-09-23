'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    confirm: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirm) {
      return setError('Passwords do not match.');
    }
    if (form.password.length < 8) {
      return setError('Password must be at least 8 characters.');
    }

    setLoading(true);
    try {
      const normalizedEmail = form.email.trim().toLowerCase();
      await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          username: form.username.trim(),
          email: normalizedEmail,
          password: form.password,
        }),
      });

      // Save email for the verification step
      sessionStorage.setItem('verifyEmail', normalizedEmail);
      router.push('/verify-email');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-aside">
        <div className="brand">
          <span className="brand-mark">T</span>
          <span>TeleVault</span>
        </div>
        <div style={{ maxWidth: '30rem', marginTop: '7rem' }}>
          <p style={{ color: '#d7e87e', fontWeight: 800 }}>PRIVATE STORAGE, BEAUTIFULLY SIMPLE</p>
          <h1
            style={{
              fontFamily: 'var(--font-space-grotesk)',
              fontSize: 'clamp(2.5rem,5vw,4.5rem)',
              lineHeight: 1.02,
              letterSpacing: '-.06em',
            }}
          >
            Your files.
            <br />
            Your vault.
          </h1>
          <p style={{ fontSize: '1.1rem', lineHeight: 1.7, color: '#d9e8e3' }}>
            A calm, private home for your files, backed by your own Telegram channel.
          </p>
        </div>
      </section>

      <section className="auth-form-wrap">
        <form className="auth-card" onSubmit={submit}>
          <p className="muted">CREATE YOUR ACCOUNT</p>
          <h2 style={{ fontSize: '2rem', letterSpacing: '-.04em', margin: '.4rem 0' }}>
            Start with TeleVault
          </h2>
          <p className="muted">We will send a 6-digit verification code to your email.</p>

          {[
            ['fullName', 'Full name', 'e.g. Alex Morgan', 'text'],
            ['username', 'Username', 'alexmorgan', 'text'],
            ['email', 'Email address', 'you@example.com', 'email'],
            ['password', 'Password', 'At least 8 characters', 'password'],
            ['confirm', 'Confirm password', 'Repeat your password', 'password'],
          ].map(([key, label, placeholder, type]) => (
            <div className="field" key={key}>
              <label htmlFor={key}>{label}</label>
              <input
                id={key}
                type={type}
                placeholder={placeholder}
                value={form[key as keyof typeof form]}
                required
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </div>
          ))}

          {error && <p className="error">{error}</p>}

          <button className="primary" style={{ width: '100%', marginTop: '1.3rem' }} disabled={loading}>
            {loading ? 'Sending verification code...' : 'Create account'}
          </button>

          <p className="muted" style={{ textAlign: 'center', marginTop: '1.2rem' }}>
            Already have an account?{' '}
            <Link className="link" href="/login">
              Sign in
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}
