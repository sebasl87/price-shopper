import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import SignOutButton from '@/components/auth/SignOutButton';
import { PostHogIdentify } from '@/components/PostHogIdentify';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const hdrs = await headers();
  const userId = hdrs.get('x-user-id') ?? '';
  const userName = hdrs.get('x-user-name') ?? '';
  const userEmail = hdrs.get('x-user-email') ?? '';

  return (
    <>
      <PostHogIdentify userId={userId} userEmail={userEmail} userName={userName} />
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
