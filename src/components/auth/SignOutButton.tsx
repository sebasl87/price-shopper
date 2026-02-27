'use client';

import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

export default function SignOutButton() {
  const router = useRouter();
  const qc = useQueryClient();

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    qc.clear();
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className="btn btn-secondary"
      style={{ width: 'auto', padding: '4px 12px', fontSize: '11px' }}
    >
      Salir
    </button>
  );
}
