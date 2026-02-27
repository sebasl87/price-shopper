export interface Hotel {
  name: string;
  id: string;
  mine: boolean;
}

export const HOTELS: Hotel[] = [
  { name: 'Lennox Hotel',           id: '186029',  mine: true  },
  { name: 'Canal Beagle Ushuaia',   id: '8017079', mine: false },
  { name: 'Hotel Albatros Ushuaia', id: '191446',  mine: false },
  { name: 'Cilene del Fuego',       id: '186028',  mine: false },
  { name: 'Los Cauquenes Resort',   id: '23805',   mine: false },
];

export const COLORS = ['#f0b429', '#34d399', '#60a5fa', '#f87171', '#c084fc'];

export const CUR_SYM: Record<string, string> = {
  USD: '$', EUR: '€', ARS: '$', BRL: 'R$', MXN: '$',
};
