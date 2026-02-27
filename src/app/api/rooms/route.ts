import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const hotel_id = searchParams.get('hotel_id');
  const arrival_date = searchParams.get('arrival_date');
  const departure_date = searchParams.get('departure_date');
  const rec_guest_qty = searchParams.get('rec_guest_qty') ?? '2';
  const currency_code = searchParams.get('currency_code') ?? 'USD';

  if (!hotel_id || !arrival_date || !departure_date) {
    return NextResponse.json(
      { error: 'Missing required params: hotel_id, arrival_date, departure_date' },
      { status: 400 }
    );
  }

  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'RAPIDAPI_KEY not configured' }, { status: 500 });
  }

  const url = new URL('https://apidojo-booking-v1.p.rapidapi.com/properties/v2/get-rooms');
  url.searchParams.set('hotel_id', hotel_id);
  url.searchParams.set('arrival_date', arrival_date);
  url.searchParams.set('departure_date', departure_date);
  url.searchParams.set('rec_guest_qty', rec_guest_qty);
  url.searchParams.set('rec_room_qty', '1');
  url.searchParams.set('currency_code', currency_code);
  url.searchParams.set('languagecode', 'en-us');
  url.searchParams.set('units', 'metric');

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'apidojo-booking-v1.p.rapidapi.com',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
