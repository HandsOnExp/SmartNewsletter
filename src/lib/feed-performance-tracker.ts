/**
 * RSS Feed Performance Tracking System
 * Monitors feed reliability, response times, and content quality for intelligent prioritization
 */

import { RSSFeedPerformance, EnhancedRSSFeed, RSSFeed } from '@/config/rss-feeds';
import { globalCache } from '@/utils/cache-optimization';

interface FeedMetrics {
  responseTime: number;
  success: boolean;
  contentQuality?: number;
  timestamp: Date;
  errorMessage?: string;
}

// Circuit Breaker States
export enum CircuitBreakerState {
  CLOSED = 'closed',     // Normal operation
  OPEN = 'open',         // Feed disabled due to failures
  HALF_OPEN = 'half_open' // Testing if feed recovered
}

interface CircuitBreakerConfig {
  failureThreshold: number;     // Number of failures to trigger open state
  successThreshold: number;     // Number of successes to close circuit
  timeWindow: number;          // Time window in minutes to consider failures
  recoveryTimeout: number;     // Time in minutes before trying half-open
}

interface FeedCircuitBreaker {
  feedId: string;
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date;
  nextRetryTime?: Date;
  config: CircuitBreakerConfig;
}

// In-memory performance tracking (in production, use database)
const performanceHistory = new Map<string, FeedMetrics[]>();
const circuitBreakers = new Map<string, FeedCircuitBreaker>();
const MAX_HISTORY_PER_FEED = 50;

// Default circuit breaker configuration
const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,     // 5 consecutive failures
  successThreshold: 3,     // 3 consecutive successes to recover
  timeWindow: 30,          // 30 minute window
  recoveryTimeout: 15      // Try recovery after 15 minutes
};

/**
 * Track RSS feed performance metrics and update circuit breaker state
 */
export function trackFeedPerformance(
  feedId: string,
  responseTime: number,
  success: boolean,
  contentQuality?: number,
  errorMessage?: string
): void {
  const metrics: FeedMetrics = {
    responseTime,
    success,
    contentQuality,
    timestamp: new Date(),
    errorMessage
  };

  // Get existing history or create new
  const history = performanceHistory.get(feedId) || [];
  history.push(metrics);

  // Keep only recent history
  if (history.length > MAX_HISTORY_PER_FEED) {
    history.splice(0, history.length - MAX_HISTORY_PER_FEED);
  }

  performanceHistory.set(feedId, history);
  
  // Update circuit breaker state
  updateCircuitBreaker(feedId, success, errorMessage);
  
  // Cache the performance data
  const cacheKey = `feed-perf:${feedId}`;
  globalCache.set(cacheKey, JSON.stringify(history), 60); // 1 hour TTL

  const circuitState = getCircuitBreakerState(feedId);
  const stateInfo = circuitState !== CircuitBreakerState.CLOSED ? ` [${circuitState}]` : '';
  console.log(`Feed performance tracked: ${feedId} - ${success ? 'Success' : 'Failed'} in ${responseTime}ms${stateInfo}`);
}

/**
 * Get or create circuit breaker for a feed
 */
function getOrCreateCircuitBreaker(feedId: string): FeedCircuitBreaker {
  let breaker = circuitBreakers.get(feedId);
  if (!breaker) {
    breaker = {
      feedId,
      state: CircuitBreakerState.CLOSED,
      failureCount: 0,
      successCount: 0,
      config: DEFAULT_CIRCUIT_CONFIG
    };
    circuitBreakers.set(feedId, breaker);
  }
  return breaker;
}

/**
 * Update circuit breaker state based on feed performance
 */
function updateCircuitBreaker(feedId: string, success: boolean, errorMessage?: string): void {
  const breaker = getOrCreateCircuitBreaker(feedId);
  const now = new Date();

  switch (breaker.state) {
    case CircuitBreakerState.CLOSED:
      if (success) {
        breaker.failureCount = 0; // Reset failure count on success
      } else {
        breaker.failureCount++;
        breaker.lastFailureTime = now;
        
        if (breaker.failureCount >= breaker.config.failureThreshold) {
          breaker.state = CircuitBreakerState.OPEN;
          breaker.nextRetryTime = new Date(now.getTime() + breaker.config.recoveryTimeout * 60 * 1000);
          console.warn(`🚨 Circuit breaker OPENED for feed ${feedId} after ${breaker.failureCount} failures. Last error: ${errorMessage}`);
        }
      }
      break;

    case CircuitBreakerState.OPEN:
      // Check if it's time to try recovery
      if (now >= (breaker.nextRetryTime || now)) {
        breaker.state = CircuitBreakerState.HALF_OPEN;
        breaker.successCount = 0;
        console.log(`🔄 Circuit breaker entering HALF_OPEN state for feed ${feedId}`);
      }
      break;

    case CircuitBreakerState.HALF_OPEN:
      if (success) {
        breaker.successCount++;
        if (breaker.successCount >= breaker.config.successThreshold) {
          breaker.state = CircuitBreakerState.CLOSED;
          breaker.failureCount = 0;
          breaker.successCount = 0;
          console.log(`✅ Circuit breaker CLOSED for feed ${feedId} after ${breaker.successCount} successful attempts`);
        }
      } else {
        // Failed during half-open, go back to open
        breaker.state = CircuitBreakerState.OPEN;
        breaker.failureCount++;
        breaker.nextRetryTime = new Date(now.getTime() + breaker.config.recoveryTimeout * 60 * 1000);
        console.warn(`❌ Circuit breaker returned to OPEN state for feed ${feedId}. Error: ${errorMessage}`);
      }
      break;
  }
}

/**
 * Check if a feed should be allowed to run (circuit breaker check)
 */
export function isFeedAllowed(feedId: string): boolean {
  const breaker = circuitBreakers.get(feedId);
  if (!breaker) return true; // No breaker = allowed

  const now = new Date();
  
  switch (breaker.state) {
    case CircuitBreakerState.CLOSED:
    case CircuitBreakerState.HALF_OPEN:
      return true;
    case CircuitBreakerState.OPEN:
      // Check if recovery time has passed
      if (breaker.nextRetryTime && now >= breaker.nextRetryTime) {
        breaker.state = CircuitBreakerState.HALF_OPEN;
        breaker.successCount = 0;
        console.log(`🔄 Circuit breaker transitioning to HALF_OPEN for feed ${feedId}`);
        return true;
      }
      return false;
  }
}

/**
 * Get current circuit breaker state for a feed
 */
export function getCircuitBreakerState(feedId: string): CircuitBreakerState {
  const breaker = circuitBreakers.get(feedId);
  return breaker?.state || CircuitBreakerState.CLOSED;
}

/**
 * Get circuit breaker info for a feed
 */
export function getCircuitBreakerInfo(feedId: string): {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  nextRetryTime?: Date;
  lastFailureTime?: Date;
} {
  const breaker = getOrCreateCircuitBreaker(feedId);
  return {
    state: breaker.state,
    failureCount: breaker.failureCount,
    successCount: breaker.successCount,
    nextRetryTime: breaker.nextRetryTime,
    lastFailureTime: breaker.lastFailureTime
  };
}

/**
 * Calculate comprehensive feed performance metrics
 */
export function calculateFeedPerformance(feedId: string): RSSFeedPerformance {
  const history = performanceHistory.get(feedId) || [];
  
  if (history.length === 0) {
    return {
      feedId,
      averageResponseTime: 5000, // Default assumption
      successRate: 0.8, // Optimistic default
      lastChecked: new Date(),
      contentQuality: 70, // Default quality
      reliability: 70 // Default reliability
    };
  }

  // Calculate metrics from recent history (last 20 attempts)
  const recentHistory = history.slice(-20);
  const successful = recentHistory.filter(m => m.success);
  
  const averageResponseTime = successful.length > 0 
    ? successful.reduce((sum, m) => sum + m.responseTime, 0) / successful.length
    : 10000; // High penalty for failed feeds

  const successRate = recentHistory.length > 0 
    ? successful.length / recentHistory.length 
    : 0;

  // Calculate content quality (average of successful attempts with quality data)
  const qualityMetrics = successful.filter(m => m.contentQuality !== undefined);
  const contentQuality = qualityMetrics.length > 0
    ? qualityMetrics.reduce((sum, m) => sum + (m.contentQuality || 0), 0) / qualityMetrics.length
    : 70; // Default quality

  // Calculate overall reliability score (0-100)
  const timelinessScore = Math.max(0, 100 - (averageResponseTime / 100)); // Penalty for slow response
  const consistencyScore = successRate * 100;
  const qualityScore = Math.min(100, contentQuality);
  
  const reliability = Math.round((timelinessScore * 0.3 + consistencyScore * 0.5 + qualityScore * 0.2));

  return {
    feedId,
    averageResponseTime: Math.round(averageResponseTime),
    successRate: Math.round(successRate * 100) / 100,
    lastChecked: new Date(),
    contentQuality: Math.round(contentQuality),
    reliability: Math.max(0, Math.min(100, reliability))
  };
}

/**
 * Get adaptive timeout based on feed performance
 */
export function getAdaptiveTimeout(feedId: string): number {
  const performance = calculateFeedPerformance(feedId);
  
  // Base timeout: 6 seconds
  let timeout = 6000;
  
  // Adjust based on historical performance
  if (performance.averageResponseTime > 8000) {
    timeout = 10000; // Give slow feeds more time
  } else if (performance.averageResponseTime < 3000) {
    timeout = 4000; // Fast feeds get less time
  }
  
  // Adjust based on reliability
  if (performance.reliability < 50) {
    timeout = Math.min(timeout + 2000, 12000); // Give unreliable feeds slightly more time
  }

  return timeout;
}

/**
 * Enhance RSS feeds with performance data and adaptive settings
 */
export function enhanceRSSFeedsWithPerformance(feeds: RSSFeed[]): EnhancedRSSFeed[] {
  return feeds.map(feed => {
    const performance = calculateFeedPerformance(feed.id);
    const adaptiveTimeout = getAdaptiveTimeout(feed.id);
    
    // Quality multiplier affects how much we trust content from this feed
    let qualityMultiplier = 1.0;
    if (performance.reliability > 80) {
      qualityMultiplier = 1.2; // Boost high-reliability feeds
    } else if (performance.reliability < 50) {
      qualityMultiplier = 0.8; // Reduce weight of unreliable feeds
    }

    return {
      ...feed,
      performance,
      adaptiveTimeout,
      qualityMultiplier
    };
  });
}

/**
 * Get feeds sorted by performance priority with diversity balancing
 */
export function getFeedsByPerformancePriority(feeds: RSSFeed[]): EnhancedRSSFeed[] {
  const enhancedFeeds = enhanceRSSFeedsWithPerformance(feeds);
  
  return enhancedFeeds.sort((a, b) => {
    // Primary sort: balance reliability and diversity
    const reliabilityA = a.performance?.reliability || 70;
    const reliabilityB = b.performance?.reliability || 70;
    
    // Don't let high-performing feeds completely overshadow others
    // Cap the reliability advantage to prevent single-source dominance
    const cappedReliabilityA = Math.min(reliabilityA, 85);
    const cappedReliabilityB = Math.min(reliabilityB, 85);
    
    const reliabilityDiff = cappedReliabilityB - cappedReliabilityA;
    
    // Only prioritize by reliability if difference is significant (>15 points)
    if (Math.abs(reliabilityDiff) > 15) return reliabilityDiff;
    
    // Secondary sort: original priority (ensures category diversity)
    const priorityDiff = a.priority - b.priority;
    if (Math.abs(priorityDiff) > 0) return priorityDiff;
    
    // Tertiary sort: slight preference for less reliable feeds for diversity
    // This helps ensure all quality sources get a chance
    return reliabilityA - reliabilityB; // Note: reversed to slightly favor less dominant sources
  });
}

/**
 * Get recommended feeds based on performance and user preferences
 */
export function getRecommendedFeeds(
  feeds: RSSFeed[], 
  maxFeeds: number = 10,
  minReliability: number = 60
): EnhancedRSSFeed[] {
  const enhancedFeeds = enhanceRSSFeedsWithPerformance(feeds.filter(f => f.enabled));
  
  // Filter by minimum reliability
  const reliableFeeds = enhancedFeeds.filter(feed => 
    (feed.performance?.reliability || 70) >= minReliability
  );
  
  // Sort by performance priority
  const sortedFeeds = reliableFeeds.sort((a, b) => {
    const scoreA = (a.performance?.reliability || 70) * (a.qualityMultiplier || 1);
    const scoreB = (b.performance?.reliability || 70) * (b.qualityMultiplier || 1);
    return scoreB - scoreA;
  });
  
  return sortedFeeds.slice(0, maxFeeds);
}

/**
 * Generate performance report for debugging
 */
export function generatePerformanceReport(): {
  totalFeeds: number;
  trackedFeeds: number;
  averageReliability: number;
  topPerformers: Array<{
    feedId: string;
    name: string;
    reliability: number;
    responseTime: number;
    successRate: number;
  }>;
  poorPerformers: Array<{
    feedId: string;
    name: string;
    reliability: number;
    issues: string[];
  }>;
} {
  const allFeedIds = Array.from(performanceHistory.keys());
  const performances = allFeedIds.map(id => calculateFeedPerformance(id));
  
  const averageReliability = performances.length > 0
    ? performances.reduce((sum, p) => sum + p.reliability, 0) / performances.length
    : 0;

  const topPerformers = performances
    .filter(p => p.reliability >= 80)
    .sort((a, b) => b.reliability - a.reliability)
    .slice(0, 5)
    .map(p => ({
      feedId: p.feedId,
      name: p.feedId, // Would map to actual feed name in production
      reliability: p.reliability,
      responseTime: p.averageResponseTime,
      successRate: p.successRate
    }));

  const poorPerformers = performances
    .filter(p => p.reliability < 60)
    .sort((a, b) => a.reliability - b.reliability)
    .slice(0, 5)
    .map(p => {
      const issues = [];
      if (p.successRate < 0.7) issues.push('Low success rate');
      if (p.averageResponseTime > 8000) issues.push('Slow response');
      if (p.contentQuality < 60) issues.push('Poor content quality');
      
      return {
        feedId: p.feedId,
        name: p.feedId,
        reliability: p.reliability,
        issues
      };
    });

  return {
    totalFeeds: allFeedIds.length,
    trackedFeeds: performances.length,
    averageReliability: Math.round(averageReliability),
    topPerformers,
    poorPerformers
  };
}

/**
 * Load performance history from cache
 */
export function loadPerformanceHistory(): void {
  // In production, this would load from database
  console.log('Feed performance tracking initialized');
}