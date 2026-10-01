export const cities = [
  { id: "voronezh", name: "Воронеж", latitude: 51.6608, longitude: 39.2003 },
  { id: "moskva", name: "Москва", latitude: 55.7558, longitude: 37.6173 },
  { id: "sankt-peterburg", name: "Санкт-Петербург", latitude: 59.9343, longitude: 30.3351 },
] as const;
export type City = (typeof cities)[number];
export function cityById(id: unknown): City | undefined {
  return cities.find((city) => city.id === (id === undefined ? "voronezh" : id));
}
export function sameCity(observed: unknown, city: City): boolean {
  if (typeof observed !== "string") return false;
  return (
    observed
      .trim()
      .toLowerCase()
      .replace(/^г\.?\s*/, "") === city.name.toLowerCase()
  );
}
