'use client';

import { useQuery } from '@tanstack/react-query';
import type { AuthUser } from '@/types/auth';

async function fetchMe(): Promise<AuthUser> {
  const res = await fetch('/api/auth/me');
  if (!res.ok) throw new Error('Not authenticated');
  return res.json();
}

export function useAuth() {
  return useQuery<AuthUser, Error>({
    queryKey: ['auth', 'me'],
    queryFn: fetchMe,
    staleTime: Infinity,
    retry: false,
  });
}
