import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import SignOutButton from '@/components/auth/SignOutButton';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const hdrs = await headers();
  const userName = hdrs.get('x-user-name') ?? '';
  const userEmail = hdrs.get('x-user-email') ?? '';

  return (
    <>
      <header>
        <div className="logo">
          Price Shopper <span>· Booking.com</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="status">
            <div className="dot ok" />
            <span style={{ color: 'var(--dim)' }}>{userName || userEmail}</span>
          </div>
          <SignOutButton />
        </div>
      </header>
      {children}
    </>
  );
}
