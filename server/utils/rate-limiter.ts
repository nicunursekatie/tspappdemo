import { logger } from './production-safe-logger';

/**
 * Simple in-memory rate limiter for API calls
 */
class RateLimiter {
  private lastCallTime: Map<string, number> = new Map();

  /**
   * Check if a call is allowed based on minimum interval
   * @param key - Unique identifier for the rate limit (e.g., 'geocode')
   * @param minIntervalMs - Minimum time between calls in milliseconds
   * @returns true if call is allowed, false if rate limited
   */
  async checkAndWait(key: string, minIntervalMs: number): Promise<boolean> {
    const now = Date.now();
    const lastCall = this.lastCallTime.get(key);

    if (lastCall) {
      const timeSinceLastCall = now - lastCall;
      if (timeSinceLastCall < minIntervalMs) {
        // Calculate wait time
        const waitTime = minIntervalMs - timeSinceLastCall;
        logger.warn(`Rate limit: waiting ${waitTime}ms before ${key} call`);
        
        // Wait for the required time
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    // Update last call time
    this.lastCallTime.set(key, Date.now());
    return true;
  }

  /**
   * Reset rate limit for a specific key
   */
  reset(key: string): void {
    this.lastCallTime.delete(key);
  }

  /**
   * Clear all rate limits
   */
  resetAll(): void {
    this.lastCallTime.clear();
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();
