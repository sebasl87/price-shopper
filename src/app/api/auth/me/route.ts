import { NextRequest, NextResponse } from 'next/server';
import type { AuthUser } from '@/types/auth';

export async function GET(req: NextRequest) {
  const id = req.headers.get('x-user-id') ?? '';
  const email = req.headers.get('x-user-email') ?? '';
  const name = req.headers.get('x-user-name') ?? '';

  if (!id && !email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const user: AuthUser = { id, email, name };
  return NextResponse.json(user);
}
