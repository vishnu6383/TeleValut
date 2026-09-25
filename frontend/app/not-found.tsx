import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="auth-form-wrap" style={{ minHeight: '100vh', textAlign: 'center' }}>
      <div className="auth-card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div
          style={{
            width: '4rem',
            height: '4rem',
            borderRadius: '1.25rem',
            background: 'rgba(215, 232, 126, 0.15)',
            color: 'var(--lime)',
            display: 'grid',
            placeItems: 'center',
            marginBottom: '1.25rem',
          }}
        >
          <ShieldAlert size={32} />
        </div>

        <h1 className="font-display" style={{ fontSize: '1.85rem', letterSpacing: '-0.04em', margin: '0 0 0.5rem', fontWeight: 800 }}>
          Page Not Found
        </h1>
        <p className="muted" style={{ marginBottom: '1.75rem', lineHeight: 1.5 }}>
          The vault page or resource you are looking for does not exist or has been relocated.
        </p>
        <Link href="/dashboard" className="primary" style={{ textDecoration: 'none' }}>
          <ArrowLeft size={16} /> Return to Vault
        </Link>
      </div>
    </main>
  );
}
