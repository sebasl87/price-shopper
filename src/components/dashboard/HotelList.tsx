'use client';

import { HOTELS, COLORS } from '@/lib/hotels';

export default function HotelList() {
  return (
    <div>
      {HOTELS.map((hotel, i) => (
        <div
          key={hotel.id}
          className={`hotel-static${hotel.mine ? ' mine' : ''}`}
        >
          <div
            className="color-dot"
            style={{ background: COLORS[i] }}
          />
          <div className="hotel-static-info">
            <div className="hotel-static-name">{hotel.name}</div>
            <div className="hotel-static-id">ID: {hotel.id}</div>
          </div>
          <div className={`hotel-badge ${hotel.mine ? 'badge-mine' : 'badge-comp'}`}>
            {hotel.mine ? 'Mi hotel' : 'Comp.'}
          </div>
        </div>
      ))}
    </div>
  );
}
