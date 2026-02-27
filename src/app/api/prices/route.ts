import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { HotelResult, PriceSnapshot } from '@/types/prices';

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const currency = searchParams.get('currency') ?? 'USD';
  const adults = searchParams.get('adults') ?? '2';
  const days = parseInt(searchParams.get('days') ?? '60');
  const date = searchParams.get('date') ?? todayStr();

  const { data, error } = await supabaseAdmin
    .from('price_snapshots')
    .select('*')
    .eq('date', date)
    .eq('currency', currency)
    .eq('adults', adults)
    .eq('days', days)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    snapshot: data as PriceSnapshot | null,
    fromCache: !!data,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { results, currency, adults, days } = body as {
    results: HotelResult[];
    currency: string;
    adults: string;
    days: number;
  };

  const fetchedBy = req.headers.get('x-user-email') ?? 'unknown';
  const date = todayStr();

  const { data, error } = await supabaseAdmin
    .from('price_snapshots')
    .upsert(
      {
        date,
        results,
        currency,
        adults,
        days,
        fetched_at: new Date().toISOString(),
        fetched_by: fetchedBy,
      },
      { onConflict: 'date,currency,adults,days' }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data as PriceSnapshot, { status: 201 });
}
