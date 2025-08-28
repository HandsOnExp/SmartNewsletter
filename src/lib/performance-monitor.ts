/**
 * Performance monitoring and automatic LLM fallback system
 */

interface PerformanceMetric {
  provider: 'cohere' | 'gemini';
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  error?: string;
  userId: string;
  timestamp: Date;
}

// In-memory performance tracking (in production, use Redis or database)
const performanceHistory: PerformanceMetric[] = [];
const MAX_HISTORY = 100; // Keep last 100 requests

/**
 * Track LLM performance
 */
export function trackPerformance(metric: PerformanceMetric) {
  if (metric.endTime && metric.startTime) {
    metric.duration = metric.endTime - metric.startTime;
  }
  
  performanceHistory.push(metric);
  
  // Keep only recent history
  if (performanceHistory.length > MAX_HISTORY) {
    performanceHistory.splice(0, performanceHistory.length - MAX_HISTORY);
  }
  
  console.log(`Performance: ${metric.provider} - ${metric.success ? 'Success' : 'Failed'} in ${metric.duration}ms`);
}

/**
 * Get recent performance stats for a provider
 */
export function getProviderStats(provider: 'cohere' | 'gemini', timeWindowMs: number = 30 * 60 * 1000) {
  const cutoff = Date.now() - timeWindowMs;
  const recentMetrics = performanceHistory.filter(
    m => m.provider === provider && m.timestamp.getTime() > cutoff
  );
  
  if (recentMetrics.length === 0) {
    return {
      totalRequests: 0,
      successRate: 1.0, // Default to good performance if no data
      avgDuration: 0,
      failureRate: 0
    };
  }
  
  const successful = recentMetrics.filter(m => m.success);
  const successRate = successful.length / recentMetrics.length;
  const avgDuration = successful.length > 0 
    ? successful.reduce((sum, m) => sum + (m.duration || 0), 0) / successful.length
    : 0;
  
  return {
    totalRequests: recentMetrics.length,
    successRate,
    avgDuration,
    failureRate: 1 - successRate
  };
}

/**
 * Determine the best provider based on recent performance
 */
export function getBestProvider(userPreference?: 'cohere' | 'gemini'): {
  provider: 'cohere' | 'gemini';
  reason: string;
  confidence: 'high' | 'medium' | 'low';
} {
  const cohereStats = getProviderStats('cohere');
  const geminiStats = getProviderStats('gemini');
  
  // If user has a preference and that provider is performing well, use it
  if (userPreference) {
    const preferredStats = userPreference === 'cohere' ? cohereStats : geminiStats;
    
    if (preferredStats.successRate >= 0.7 && preferredStats.avgDuration < 45000) {
      return {
        provider: userPreference,
        reason: `Using your preferred ${userPreference} (performing well)`,
        confidence: 'high'
      };
    }
    
    if (preferredStats.successRate >= 0.5) {
      return {
        provider: userPreference,
        reason: `Using your preferred ${userPreference} (moderate performance)`,
        confidence: 'medium'
      };
    }
  }
  
  // Compare providers based on performance
  const cohereScore = cohereStats.successRate * 0.7 + (cohereStats.avgDuration < 30000 ? 0.3 : 0);
  const geminiScore = geminiStats.successRate * 0.7 + (geminiStats.avgDuration < 30000 ? 0.3 : 0);
  
  if (Math.abs(cohereScore - geminiScore) < 0.1) {
    // Similar performance, prefer Gemini for speed
    return {
      provider: 'gemini',
      reason: 'Both providers performing similarly, choosing Gemini for speed',
      confidence: 'medium'
    };
  }
  
  const bestProvider = cohereScore > geminiScore ? 'cohere' : 'gemini';
  const confidence = Math.abs(cohereScore - geminiScore) > 0.3 ? 'high' : 'medium';
  
  return {
    provider: bestProvider,
    reason: `${bestProvider} has better recent performance`,
    confidence
  };
}

/**
 * Check if a provider is experiencing issues
 */
export function isProviderHealthy(provider: 'cohere' | 'gemini'): boolean {
  const stats = getProviderStats(provider, 15 * 60 * 1000); // Last 15 minutes
  
  // Consider healthy if success rate > 60% and average duration < 50 seconds
  return stats.successRate > 0.6 && stats.avgDuration < 50000;
}

/**
 * Get automatic fallback suggestion
 */
export function getFallbackSuggestion(
  primaryProvider: 'cohere' | 'gemini',
  error?: string
): {
  shouldFallback: boolean;
  fallbackProvider?: 'cohere' | 'gemini';
  reason: string;
} {
  const primaryHealthy = isProviderHealthy(primaryProvider);
  const fallbackProvider = primaryProvider === 'cohere' ? 'gemini' : 'cohere';
  const fallbackHealthy = isProviderHealthy(fallbackProvider);
  
  // If primary is unhealthy and fallback is healthy, suggest fallback
  if (!primaryHealthy && fallbackHealthy) {
    return {
      shouldFallback: true,
      fallbackProvider,
      reason: `${primaryProvider} is experiencing issues, ${fallbackProvider} is performing better`
    };
  }
  
  // If error contains timeout-related keywords, suggest faster provider
  if (error && (error.includes('timeout') || error.includes('time') || error.includes('duration'))) {
    if (primaryProvider === 'cohere') {
      return {
        shouldFallback: true,
        fallbackProvider: 'gemini',
        reason: 'Cohere timeout detected, switching to faster Gemini'
      };
    }
  }
  
  // If both are unhealthy, still prefer the less bad one
  if (!primaryHealthy && !fallbackHealthy) {
    const primaryStats = getProviderStats(primaryProvider);
    const fallbackStats = getProviderStats(fallbackProvider);
    
    if (fallbackStats.successRate > primaryStats.successRate + 0.1) {
      return {
        shouldFallback: true,
        fallbackProvider,
        reason: `Both providers struggling, but ${fallbackProvider} has better success rate`
      };
    }
  }
  
  return {
    shouldFallback: false,
    reason: `${primaryProvider} is performing adequately`
  };
}

/**
 * Performance monitoring wrapper for newsletter generation
 */
export async function monitoredGeneration<T>(
  provider: 'cohere' | 'gemini',
  userId: string,
  generationFn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  const metric: PerformanceMetric = {
    provider,
    startTime,
    success: false,
    userId,
    timestamp: new Date()
  };
  
  try {
    const result = await generationFn();
    metric.success = true;
    metric.endTime = Date.now();
    trackPerformance(metric);
    return result;
  } catch (error) {
    metric.success = false;
    metric.endTime = Date.now();
    metric.error = error instanceof Error ? error.message : 'Unknown error';
    trackPerformance(metric);
    throw error;
  }
}

/**
 * Get performance summary for debugging
 */
export function getPerformanceSummary() {
  const cohereStats = getProviderStats('cohere');
  const geminiStats = getProviderStats('gemini');
  const bestProvider = getBestProvider();
  
  return {
    cohere: cohereStats,
    gemini: geminiStats,
    recommendation: bestProvider,
    totalRequests: performanceHistory.length,
    timeWindow: '30 minutes'
  };
}