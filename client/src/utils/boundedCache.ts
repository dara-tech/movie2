/** Keep in-memory Maps from growing without bound (hover prefetch, etc.) */
export const PREFETCH_MAX_ENTRIES = 12;

export function trimMapToMaxSize<K, V>(map: Map<K, V>, maxSize: number, companion?: Map<K, unknown>): void {
  while (map.size > maxSize) {
    const key = map.keys().next().value;
    if (key === undefined) break;
    map.delete(key);
    companion?.delete(key);
  }
}
