import type { Offer } from "../src/domain.js";
export const imageHosts: Record<string, string[]>;
export function safeImage(value: unknown, marketplace: string): string | null;
export function statusNow(offer: Offer, now?: number): string;
export function priceFor(offer: Offer, basis: string): number | null;
export function parseBounds(
  min: string,
  max: string,
): { error?: string; min?: number | null; max?: number | null };
export function filterOffers<T extends Offer>(
  offers: T[],
  filter: { min: number | null; max: number | null; basis: string; includeUnknown: boolean },
): T[];
export function reasonSummary(offer: Offer): string;
