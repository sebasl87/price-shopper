export function extractPrice(data: unknown): number | null {
  const root = Array.isArray(data) ? (data as unknown[])[0] : data;
  const blocks = (root as { block?: unknown[] } | null)?.block ?? [];
  let min: number | null = null;
  for (const b of blocks) {
    const block = b as {
      min_price?: { price?: unknown };
      product_price_breakdown?: { gross_amount?: { value?: unknown } };
      price_breakdown?: { gross_price?: unknown };
    };
    const p =
      block?.min_price?.price ??
      block?.product_price_breakdown?.gross_amount?.value ??
      block?.price_breakdown?.gross_price ??
      null;
    if (p != null) {
      const v = parseFloat(String(p));
      if (!isNaN(v) && (min === null || v < min)) min = v;
    }
  }
  return min != null ? Math.round(min) : null;
}
