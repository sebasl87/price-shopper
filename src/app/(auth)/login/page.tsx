import LoginForm from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '360px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '32px',
        }}
      >
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <div className="logo" style={{ fontSize: '14px', marginBottom: '4px' }}>
            Price Shopper
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--muted)' }}>
            · Booking.com ·
          </div>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
