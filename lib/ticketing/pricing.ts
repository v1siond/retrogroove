import type { PriceBundle } from './types';

// Greedy bundle packing — mirrors Retrogroove.Pricing.bundle_total/2 on the API,
// used only to show a running estimate. The order response is authoritative.
export function bundleTotal(bundles: PriceBundle[], quantity: number): number {
  const map = new Map(bundles.map((b) => [b.quantity, parseFloat(b.price)]));
  const sizes = [...map.keys()].sort((a, b) => b - a);

  let remaining = quantity;
  let total = 0;

  while (remaining > 0) {
    const size = sizes.find((s) => s <= remaining);
    if (size === undefined) break;
    total += map.get(size)!;
    remaining -= size;
  }

  return total;
}
