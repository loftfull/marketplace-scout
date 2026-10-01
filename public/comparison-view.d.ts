export interface ComparisonModel {
  requestedCity: string;
  region: string;
  notes: string[];
  columns: { title: string; id: string; error: string | null; values: string[] }[];
}
export function comparisonModel(result: unknown): ComparisonModel | null;
export function comparisonTable(model: ComparisonModel): HTMLElement;
