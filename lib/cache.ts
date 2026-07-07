/**
 * Server-side cache for Odesli lookups.
 *
 * The keyless Odesli tier allows ~10 requests/minute shared across ALL users
 * of this app, so every cache hit matters: repeat lookups of the same song
 * cost zero API calls.
 *
 * SWAPPING FOR A PERSISTENT STORE (Vercel KV / Upstash Redis)
 * -----------------------------------------------------------
 * The in-memory cache below lives per serverless instance, so it's lost on
 * cold starts and not shared between concurrent instances. That's fine at
 * friend-group scale. When usage grows, implement `LinkCache` with Redis and
 * change the one constructor line in `getCache()` — call sites don't change
 * because the interface is already async:
 *
 *   import { Redis } from "@upstash/redis";
 *   class RedisCache<T> implements LinkCache<T> {
 *     private redis = Redis.fromEnv();
 *     get(key: string) { return this.redis.get<T>(key); }
 *     async set(key: string, value: T, ttlSeconds: number) {
 *       await this.redis.set(key, value, { ex: ttlSeconds });
 *     }
 *   }
 */
export interface LinkCache<T> {
  get(key: string): Promise<T | null>;
  set(key: string, value: T, ttlSeconds: number): Promise<void>;
}

interface Entry<T> {
  value: T;
  expiresAt: number;
}

/** Max entries kept in memory so a long-lived instance can't grow unbounded. */
const MAX_ENTRIES = 500;

export class InMemoryCache<T> implements LinkCache<T> {
  private store = new Map<string, Entry<T>>();

  async get(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: T, ttlSeconds: number): Promise<void> {
    // Evict the oldest entry once at capacity (Map preserves insertion order).
    if (!this.store.has(key) && this.store.size >= MAX_ENTRIES) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    // Delete-then-set so refreshed keys move to the back of the eviction queue.
    this.store.delete(key);
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }
}

// Stash the singleton on globalThis so it survives dev-server hot reloads and
// is shared across route invocations within one serverless instance.
const globalStore = globalThis as unknown as {
  __linkmatchCache?: InMemoryCache<unknown>;
};

export function getCache<T>(): LinkCache<T> {
  if (!globalStore.__linkmatchCache) {
    globalStore.__linkmatchCache = new InMemoryCache<unknown>();
  }
  return globalStore.__linkmatchCache as LinkCache<T>;
}
