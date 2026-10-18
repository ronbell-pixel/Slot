// In-memory sliding-window limiter, keyed by client IP. Good enough for a single
// instance; swap for a shared store if the app ever runs on several replicas.
export class RateLimiter {
  constructor({ limit, windowMs, now = () => Date.now() }) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
    this.hits = new Map();
  }

  take(key) {
    if (this.limit <= 0) return true;
    const cutoff = this.now() - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(this.now());
    this.hits.set(key, recent);
    return true;
  }
}
