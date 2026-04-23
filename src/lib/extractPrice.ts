function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = parseFloat(String(v));
  return isNaN(n) || n <= 0 ? null : n;
}

function priceFromBlock(b: unknown): number | null {
  if (!b || typeof b !== 'object') return null;
  const block = b as Record<string, unknown>;

  const candidates = [
    toNum((block.min_price as Record<string,unknown>)?.price),
    toNum(((block.min_price as Record<string,unknown>)?.other_currencies as Record<string,unknown>[])?.[0]?.price),
    toNum(((block.product_price_breakdown as Record<string,unknown>)?.gross_amount_per_night as Record<string,unknown>)?.value),
    toNum(((block.product_price_breakdown as Record<string,unknown>)?.gross_amount as Record<string,unknown>)?.value),
    toNum(((block.product_price_breakdown as Record<string,unknown>)?.all_inclusive_amount as Record<string,unknown>)?.value),
    toNum((block.price_breakdown as Record<string,unknown>)?.gross_price),
    toNum((block.price_breakdown as Record<string,unknown>)?.all_inclusive_price),
    toNum(block.price),
    toNum(block.amount),
  ];

  for (const v of candidates) {
    if (v !== null) return v;
  }
  return null;
}

export function extractPrice(data: unknown, debug = false): number | null {
  // Unwrap common top-level wrappers: { data: ... } and { result: ... } and { rooms: ... }
  let root: unknown = data;

  while (root && typeof root === 'object' && !Array.isArray(root)) {
    const d = root as Record<string, unknown>;
    if (d.data !== undefined)   { root = d.data;   continue; }
    if (d.result !== undefined) { root = d.result; continue; }
    break;
  }

  // Take first element if array
  if (Array.isArray(root)) root = root[0];

  // Find blocks array — might be called "block" or "blocks" or "rooms"
  const obj = root as Record<string, unknown> | null;
  const blocks: unknown[] =
    (obj?.block  as unknown[] | undefined) ??
    (obj?.blocks as unknown[] | undefined) ??
    (obj?.rooms  as unknown[] | undefined) ??
    [];

  if (debug) {
    console.log('[extractPrice] root keys:', obj ? Object.keys(obj) : 'null');
    console.log('[extractPrice] blocks count:', blocks.length);
    if (blocks[0]) console.log('[extractPrice] first block keys:', Object.keys(blocks[0] as Record<string,unknown>));
  }

  let min: number | null = null;
  for (const b of blocks) {
    const v = priceFromBlock(b);
    if (v !== null && (min === null || v < min)) min = v;
  }

  return min != null ? Math.round(min) : null;
}
