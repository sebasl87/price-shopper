import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('genius_discounts')
    .select('hotel_id, ratio, calibrated_at');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { hotel_id: string; ratio: number }[];
  const calibrated_by = req.headers.get('x-user-name') ?? 'unknown';

  const rows = body.map((r) => ({
    hotel_id: r.hotel_id,
    ratio: r.ratio,
    calibrated_at: new Date().toISOString(),
    calibrated_by,
  }));

  const { error } = await supabaseAdmin
    .from('genius_discounts')
    .upsert(rows, { onConflict: 'hotel_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
