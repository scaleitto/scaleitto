// Attempts per key in a sliding window, kept in memory (one server process on shared hosting; a restart forgets them,
// which is fine for slowing down guessing). Used by sign-in, password reset, sign-up and the store's order lookup.
const buckets = new Map<string, number[]>();

function recent(key: string, windowMs: number) {
  const now = Date.now();
  const list = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  buckets.set(key, list);
  // Never grows without bound: keys with nothing recent are dropped first
  if (buckets.size > 20_000) for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  return list;
}

// true = allowed (and counted); false = too many attempts in the window
export function allowAttempt(key: string, max: number, windowMs: number): boolean {
  const list = recent(key, windowMs);
  if (list.length >= max) return false;
  list.push(Date.now());
  return true;
}

// Sign-in: only failures count, so people who sign in often are never stopped
export function tooManyFailures(key: string, max: number, windowMs: number): boolean {
  return recent(key, windowMs).length >= max;
}
export function recordFailure(key: string) {
  const list = buckets.get(key) ?? [];
  list.push(Date.now());
  buckets.set(key, list);
}

// A successful sign-in clears its own counter
export function clearAttempts(key: string) {
  buckets.delete(key);
}
