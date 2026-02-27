import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  if (!username || !password) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
  }

  const keycloakUrl = process.env.KEYCLOAK_URL!;
  const realm = process.env.KEYCLOAK_REALM!;
  const clientId = process.env.KEYCLOAK_CLIENT_ID!;
  const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET!;

  const tokenUrl = `${keycloakUrl}/realms/${realm}/protocol/openid-connect/token`;

  const params = new URLSearchParams({
    grant_type: 'password',
    client_id: clientId,
    client_secret: clientSecret,
    username,
    password,
    scope: 'openid email profile',
  });

  let kcData: {
    access_token?: string;
    id_token?: string;
    error?: string;
    error_description?: string;
  };

  try {
    const kcRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    kcData = await kcRes.json();
  } catch {
    return NextResponse.json({ error: 'Keycloak unreachable' }, { status: 502 });
  }

  if (kcData.error) {
    return NextResponse.json(
      { error: kcData.error_description ?? kcData.error },
      { status: 401 }
    );
  }

  // Decode id_token (no verify — just issued by Keycloak)
  const idToken = kcData.id_token ?? '';
  let claims: { sub?: string; email?: string; name?: string } = {};
  try {
    const payload = idToken.split('.')[1];
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
  } catch {
    // fallback: extract from access_token
    try {
      const payload = (kcData.access_token ?? '').split('.')[1];
      claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
    } catch { /* ignore */ }
  }

  const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

  const psToken = await new SignJWT({
    email: claims.email ?? username,
    name: claims.name ?? username,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub ?? username)
    .setIssuedAt()
    .setExpirationTime('1d')
    .sign(secret);

  const response = NextResponse.json({ ok: true });
  response.cookies.set('ps-token', psToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 1 day
    path: '/',
  });

  return response;
}
