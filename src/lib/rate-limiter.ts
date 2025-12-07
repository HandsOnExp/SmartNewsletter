/**
 * Per-User Rate Limiter
 *
 * Enforces rate limits on individual users to prevent quota exhaustion.
 * Uses sliding window algorithm for accurate rate limiting.
 *
 * Configuration (user confirmed):
 * - Per-user limit: 1 request per 30 seconds
 * - Global queue enforces 10s gaps between all requests
 */

class UserRateLimiter {
  private userRequests: Map<string, number[]> = new Map();
  private readonly WINDOW_MS = 30000; // 30 seconds (user confirmed)
  private readonly MAX_REQUESTS = 1; // 1 request per window
  private readonly CLEANUP_INTERVAL = 60000; // Cleanup every 60 seconds

  constructor() {
    // Periodic cleanup of old entries
    setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);
  }

  /**
   * Check if user can make a request
   *
   * @param userId - User ID to check
   * @returns Object with allowed status and optional error message
   */
  checkLimit(userId: string): { allowed: boolean; retryAfter?: number; message?: string } {
    const now = Date.now();
    const userTimestamps = this.userRequests.get(userId) || [];

    // Remove timestamps outside the sliding window
    const recentTimestamps = userTimestamps.filter(
      timestamp => now - timestamp < this.WINDOW_MS
    );

    // Update the map with filtered timestamps
    if (recentTimestamps.length > 0) {
      this.userRequests.set(userId, recentTimestamps);
    } else {
      this.userRequests.delete(userId);
    }

    // Check if user is within rate limit
    if (recentTimestamps.length >= this.MAX_REQUESTS) {
      const oldestTimestamp = Math.min(...recentTimestamps);
      const retryAfter = Math.ceil((this.WINDOW_MS - (now - oldestTimestamp)) / 1000);

      console.log(`🚫 Rate limit exceeded for user ${userId}. Retry after ${retryAfter}s`);

      return {
        allowed: false,
        retryAfter,
        message: `Rate limit exceeded. You can generate a new newsletter in ${retryAfter} seconds.`
      };
    }

    return { allowed: true };
  }

  /**
   * Record a request for a user
   *
   * @param userId - User ID making the request
   */
  recordRequest(userId: string): void {
    const now = Date.now();
    const userTimestamps = this.userRequests.get(userId) || [];

    userTimestamps.push(now);
    this.userRequests.set(userId, userTimestamps);

    console.log(`📝 Recorded request for user ${userId} (${userTimestamps.length}/${this.MAX_REQUESTS} in window)`);
  }

  /**
   * Cleanup old entries to prevent memory leaks
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedUsers = 0;

    for (const [userId, timestamps] of this.userRequests.entries()) {
      const recentTimestamps = timestamps.filter(
        timestamp => now - timestamp < this.WINDOW_MS
      );

      if (recentTimestamps.length === 0) {
        this.userRequests.delete(userId);
        cleanedUsers++;
      } else if (recentTimestamps.length < timestamps.length) {
        this.userRequests.set(userId, recentTimestamps);
      }
    }

    if (cleanedUsers > 0) {
      console.log(`🧹 Cleaned up ${cleanedUsers} inactive user(s) from rate limiter`);
    }
  }

  /**
   * Get current rate limit status for a user
   *
   * @param userId - User ID to check
   * @returns Status object with usage information
   */
  getStatus(userId: string) {
    const now = Date.now();
    const userTimestamps = this.userRequests.get(userId) || [];
    const recentTimestamps = userTimestamps.filter(
      timestamp => now - timestamp < this.WINDOW_MS
    );

    const canRequest = recentTimestamps.length < this.MAX_REQUESTS;
    const nextAvailableTime = recentTimestamps.length > 0
      ? Math.min(...recentTimestamps) + this.WINDOW_MS
      : now;

    return {
      userId,
      requestsInWindow: recentTimestamps.length,
      maxRequests: this.MAX_REQUESTS,
      windowMs: this.WINDOW_MS,
      canRequest,
      nextAvailableIn: canRequest ? 0 : Math.max(0, nextAvailableTime - now)
    };
  }

  /**
   * Reset rate limit for a user (admin use only)
   *
   * @param userId - User ID to reset
   */
  reset(userId: string): void {
    this.userRequests.delete(userId);
    console.log(`🔄 Reset rate limit for user ${userId}`);
  }

  /**
   * Clear all rate limit data (admin/emergency use only)
   */
  clearAll(): void {
    console.warn('⚠️ Clearing all rate limit data');
    this.userRequests.clear();
  }

  /**
   * Get global rate limiter statistics
   */
  getGlobalStats() {
    const now = Date.now();
    let totalRecentRequests = 0;
    let activeUsers = 0;

    for (const timestamps of this.userRequests.values()) {
      const recentTimestamps = timestamps.filter(
        timestamp => now - timestamp < this.WINDOW_MS
      );
      if (recentTimestamps.length > 0) {
        activeUsers++;
        totalRecentRequests += recentTimestamps.length;
      }
    }

    return {
      totalTrackedUsers: this.userRequests.size,
      activeUsers,
      totalRecentRequests,
      windowMs: this.WINDOW_MS,
      maxRequestsPerUser: this.MAX_REQUESTS
    };
  }
}

// Export singleton instance
export const userRateLimiter = new UserRateLimiter();

/**
 * Helper function for backward compatibility with existing checkRateLimit() calls
 *
 * @param userId - User ID to check (optional)
 * @returns Object with allowed status and optional message
 */
export function checkRateLimit(userId?: string): { allowed: boolean; message?: string } {
  if (!userId) {
    // If no userId provided, allow the request (backward compatibility)
    console.warn('⚠️ checkRateLimit called without userId, allowing request');
    return { allowed: true };
  }

  const result = userRateLimiter.checkLimit(userId);

  if (!result.allowed) {
    return {
      allowed: false,
      message: result.message
    };
  }

  return { allowed: true };
}
