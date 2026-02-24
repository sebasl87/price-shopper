export default async function handler(req, res) {
  // CORS headers — allow requests from any origin (our frontend)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { hotel_id, arrival_date, departure_date, rec_guest_qty, currency_code } = req.query;

  if (!hotel_id || !arrival_date || !departure_date) {
    return res.status(400).json({ error: 'Missing required params: hotel_id, arrival_date, departure_date' });
  }

  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) return res.status(500).json({ error: 'RAPIDAPI_KEY not configured in environment' });

  const url = new URL('https://apidojo-booking-v1.p.rapidapi.com/properties/v2/get-rooms');
  url.searchParams.set('hotel_id',      hotel_id);
  url.searchParams.set('arrival_date',  arrival_date);
  url.searchParams.set('departure_date', departure_date);
  url.searchParams.set('rec_guest_qty', rec_guest_qty || '2');
  url.searchParams.set('rec_room_qty',  '1');
  url.searchParams.set('currency_code', currency_code || 'USD');
  url.searchParams.set('languagecode',  'en-us');
  url.searchParams.set('units',         'metric');

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key':  apiKey,
        'X-RapidAPI-Host': 'apidojo-booking-v1.p.rapidapi.com',
      },
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
