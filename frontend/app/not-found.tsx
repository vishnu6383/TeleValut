import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="auth-form-wrap" style={{ minHeight: '100vh', textAlign: 'center' }}>
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>🔍</div>
        <h1 style={{ fontFamily: 'var(--font-space-grotesk)', fontSize: '2rem', letterSpacing: '-0.04em', margin: '0 0 0.5rem' }}>
          Page Not Found
        </h1>
        <p className="muted" style={{ marginBottom: '1.5rem' }}>
          The vault page you are looking for does not exist or has been moved.
        </p>
        <Link href="/dashboard" className="primary" style={{ textDecoration: 'none' }}>
          Return to Vault
        </Link>
      </div>
    </main>
  );
}
