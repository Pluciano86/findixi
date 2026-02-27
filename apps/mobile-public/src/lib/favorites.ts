import { FAVORITES_KEY, getJsonStorageValue, setJsonStorageValue } from './storage';

export async function getFavoriteComercioIds(): Promise<number[]> {
  const ids = await getJsonStorageValue<number[]>(FAVORITES_KEY, []);
  return ids.filter((id) => Number.isFinite(id));
}

export async function toggleFavoriteComercioId(id: number): Promise<number[]> {
  const current = await getFavoriteComercioIds();
  const normalized = Math.trunc(id);
  const next = current.includes(normalized)
    ? current.filter((entry) => entry !== normalized)
    : [...current, normalized];
  await setJsonStorageValue(FAVORITES_KEY, next);
  return next;
}
