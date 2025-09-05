/**
 * Performance monitoring for Gemini LLM
 */

interface PerformanceMetric {
  provider: 'gemini';
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
 * Get recent performance stats for Gemini
 */
export function getProviderStats(provider: 'gemini', timeWindowMs: number = 30 * 60 * 1000) {
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
 * Get Gemini provider info
 */
export function getBestProvider(): {
  provider: 'gemini';
  reason: string;
  confidence: 'high' | 'medium' | 'low';
} {
  const geminiStats = getProviderStats('gemini');
  
  if (geminiStats.successRate >= 0.7 && geminiStats.avgDuration < 45000) {
    return {
      provider: 'gemini',
      reason: `Gemini performing well (${(geminiStats.successRate * 100).toFixed(1)}% success rate, ${(geminiStats.avgDuration/1000).toFixed(1)}s avg)`,
      confidence: 'high'
    };
  }
  
  if (geminiStats.successRate >= 0.5) {
    return {
      provider: 'gemini',
      reason: `Gemini moderate performance (${(geminiStats.successRate * 100).toFixed(1)}% success rate)`,
      confidence: 'medium'
    };
  }

  return {
    provider: 'gemini',
    reason: 'Using Gemini (only available provider)',
    confidence: 'low'
  };
}

/**
 * Check if Gemini is healthy
 */
export function isProviderHealthy(provider: 'gemini'): boolean {
  const stats = getProviderStats(provider, 15 * 60 * 1000); // Last 15 minutes
  
  // Consider healthy if success rate > 60% and average duration < 50 seconds
  return stats.successRate > 0.6 && stats.avgDuration < 50000;
}

/**
 * Performance monitoring wrapper for newsletter generation
 */
export async function monitoredGeneration<T>(
  provider: 'gemini',
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
  const geminiStats = getProviderStats('gemini');
  const recommendation = getBestProvider();
  
  return {
    gemini: geminiStats,
    recommendation,
    totalRequests: performanceHistory.length,
    timeWindow: '30 minutes'
  };
}