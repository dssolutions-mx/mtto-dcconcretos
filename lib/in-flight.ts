/**
 * Coalesces concurrent calls with the same key into one shared promise.
 * Useful for data hooks under React Strict Mode (dev double mount).
 */
const flights = new Map<string, Promise<unknown>>()

export async function shareInFlight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = flights.get(key) as Promise<T> | undefined
  if (existing) return existing

  const p = fn().finally(() => {
    if (flights.get(key) === p) flights.delete(key)
  }) as Promise<T>

  flights.set(key, p)
  return p
}
