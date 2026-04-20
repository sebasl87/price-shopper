import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import GeniusCalibrationPage from '@/components/dashboard/GeniusCalibrationPage';
import type { HotelResult } from '@/types/prices';

const ADMIN_EMAIL = 'sebastian.loguzzo@gmail.com';

export default async function CalibracionPage() {
  const hdrs = await headers();
  const email = hdrs.get('x-user-email') ?? '';

  if (email !== ADMIN_EMAIL) redirect('/');

  const { data: snapshot } = await supabaseAdmin
    .from('price_snapshots')
    .select('results, currency, date')
    .order('date', { ascending: false })
    .limit(1)
    .single();

  return (
    <GeniusCalibrationPage
      results={(snapshot?.results as HotelResult[]) ?? []}
      currency={snapshot?.currency ?? 'USD'}
      snapshotDate={snapshot?.date ?? null}
    />
  );
}
