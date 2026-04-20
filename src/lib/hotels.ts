export interface Hotel {
  name: string;
  id: string;
  mine: boolean;
}

export const HOTELS: Hotel[] = [
  { name: 'Altos Ushuaia', id: '358299',  mine: true  },
  { name: 'Las Lengas',    id: '239632',  mine: false },
  { name: 'Los Naranjos',  id: '245606',  mine: false },
  { name: 'Alto Andino',   id: '266628',  mine: false },
  { name: 'Canal Beagle',  id: '8017079', mine: false },
];

export const COLORS = ['#f0b429', '#34d399', '#60a5fa', '#f87171', '#c084fc'];

export const CUR_SYM: Record<string, string> = {
  USD: '$', EUR: '€', ARS: '$', BRL: 'R$', MXN: '$',
};
