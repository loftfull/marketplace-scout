export function filterHistory<
  T extends {
    offer: { title?: string; sku?: string; requestedCity?: string };
  },
>(rows: T[], query?: string, city?: string): T[];
export function statusLabel(status: string): string;
