/**
 * Freshness Scoring System
 * Prioritizes recent articles while applying progressive penalties for older content
 * Helps prevent 3-day-old articles from being selected when fresher content is available
 */

import { ParsedArticle } from '@/lib/rss-parser';
import { ExtractedContent } from '@/lib/content-extractor';

export interface FreshnessConfig {
  strictMode: boolean; // If true, heavily penalize articles older than 24 hours
  penaltyThresholds: {
    hours6: number;   // 6 hours - minimal penalty
    hours12: number;  // 12 hours - light penalty
    hours24: number;  // 24 hours - moderate penalty
    hours48: number;  // 48 hours - heavy penalty
    hours72: number;  // 72 hours - severe penalty
  };
  minFreshnessScore: number; // Minimum score to consider an article
}

export interface FreshnessScoredArticle {
  article: ParsedArticle | ExtractedContent;
  freshnessScore: number; // 0-100
  hoursOld: number;
  category: 'fresh' | 'recent' | 'old' | 'stale';
}

export const DEFAULT_FRESHNESS_CONFIG: FreshnessConfig = {
  strictMode: true, // Prefer fresh content
  penaltyThresholds: {
    hours6: 0.95,   // 5% penalty after 6 hours
    hours12: 0.85,  // 15% penalty after 12 hours
    hours24: 0.60,  // 40% penalty after 24 hours
    hours48: 0.30,  // 70% penalty after 48 hours
    hours72: 0.10   // 90% penalty after 72 hours
  },
  minFreshnessScore: 20 // Don't select articles with less than 20% freshness score
};

/**
 * Calculate freshness score for an article
 */
export function calculateFreshnessScore(
  pubDate: string,
  config: FreshnessConfig = DEFAULT_FRESHNESS_CONFIG
): { score: number; hoursOld: number; category: 'fresh' | 'recent' | 'old' | 'stale' } {
  try {
    const publishedDate = new Date(pubDate);
    const now = new Date();
    const diffMs = now.getTime() - publishedDate.getTime();
    const hoursOld = Math.max(0, diffMs / (1000 * 60 * 60));

    let score = 100; // Start with perfect score
    let category: 'fresh' | 'recent' | 'old' | 'stale' = 'fresh';

    // Apply progressive penalties based on age
    if (hoursOld <= 6) {
      score *= config.penaltyThresholds.hours6;
      category = 'fresh';
    } else if (hoursOld <= 12) {
      score *= config.penaltyThresholds.hours12;
      category = 'fresh';
    } else if (hoursOld <= 24) {
      score *= config.penaltyThresholds.hours24;
      category = 'recent';
    } else if (hoursOld <= 48) {
      score *= config.penaltyThresholds.hours48;
      category = 'old';
    } else {
      score *= config.penaltyThresholds.hours72;
      category = 'stale';
    }

    // In strict mode, apply additional penalties for older content
    if (config.strictMode && hoursOld > 24) {
      const extraPenalty = Math.min(0.5, (hoursOld - 24) / 48); // Up to 50% additional penalty
      score *= (1 - extraPenalty);
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      hoursOld: Math.round(hoursOld * 10) / 10, // Round to 1 decimal
      category
    };
  } catch {
    return { score: 0, hoursOld: 999, category: 'stale' };
  }
}

/**
 * Score all articles by freshness
 */
export function scoreFreshness(
  articles: (ParsedArticle | ExtractedContent)[],
  config: FreshnessConfig = DEFAULT_FRESHNESS_CONFIG
): FreshnessScoredArticle[] {
  console.log(`🕐 Scoring freshness for ${articles.length} articles (strict mode: ${config.strictMode})`);

  const scoredArticles = articles.map(article => {
    const pubDate = 'publishedAt' in article ? article.publishedAt : article.pubDate;
    const freshnessResult = calculateFreshnessScore(pubDate, config);

    return {
      article,
      freshnessScore: freshnessResult.score,
      hoursOld: freshnessResult.hoursOld,
      category: freshnessResult.category
    };
  });

  // Filter out articles below minimum freshness score
  const filteredArticles = scoredArticles.filter(scored => 
    scored.freshnessScore >= config.minFreshnessScore
  );

  const removed = scoredArticles.length - filteredArticles.length;
  if (removed > 0) {
    console.log(`🕐 Removed ${removed} stale articles (score < ${config.minFreshnessScore})`);
  }

  // Log freshness distribution
  const categoryStats = filteredArticles.reduce((acc, scored) => {
    acc[scored.category] = (acc[scored.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log(`🕐 Freshness distribution:`, categoryStats);

  // Show sample of freshest articles
  const freshest = filteredArticles
    .sort((a, b) => b.freshnessScore - a.freshnessScore)
    .slice(0, 3);

  console.log(`🕐 Freshest articles:`);
  freshest.forEach(scored => {
    console.log(`  📰 "${scored.article.title}" (${scored.hoursOld}h old, score: ${scored.freshnessScore.toFixed(1)})`);
  });

  return filteredArticles;
}

/**
 * Enhanced time-based filtering with freshness prioritization
 */
export function enhancedTimeFilter(
  articles: (ParsedArticle | ExtractedContent)[],
  maxArticles: number,
  config: FreshnessConfig = DEFAULT_FRESHNESS_CONFIG
): {
  selectedArticles: (ParsedArticle | ExtractedContent)[];
  freshnessStats: {
    averageFreshness: number;
    freshCount: number;
    recentCount: number;
    oldCount: number;
    staleCount: number;
  };
} {
  const scoredArticles = scoreFreshness(articles, config);
  
  // Sort by freshness score (highest first)
  const sortedByFreshness = scoredArticles.sort((a, b) => b.freshnessScore - a.freshnessScore);
  
  // Take the freshest articles up to the limit
  const selectedScored = sortedByFreshness.slice(0, maxArticles);
  const selectedArticles = selectedScored.map(s => s.article);

  // Calculate freshness statistics
  const avgFreshness = selectedScored.length > 0 
    ? selectedScored.reduce((sum, s) => sum + s.freshnessScore, 0) / selectedScored.length
    : 0;

  const freshnessStats = selectedScored.reduce(
    (acc, scored) => {
      acc[`${scored.category}Count`]++;
      return acc;
    },
    { freshCount: 0, recentCount: 0, oldCount: 0, staleCount: 0 }
  );

  console.log(`🕐 Enhanced time filter results: ${selectedArticles.length} articles selected`);
  console.log(`🕐 Average freshness score: ${avgFreshness.toFixed(1)}/100`);
  console.log(`🕐 Age distribution:`, freshnessStats);

  return {
    selectedArticles,
    freshnessStats: {
      averageFreshness: avgFreshness,
      ...freshnessStats
    }
  };
}

/**
 * Generate freshness report for debugging
 */
export function generateFreshnessReport(scoredArticles: FreshnessScoredArticle[]): string {
  let report = `## Freshness Analysis Report\n\n`;
  
  const avgFreshness = scoredArticles.length > 0 
    ? scoredArticles.reduce((sum, s) => sum + s.freshnessScore, 0) / scoredArticles.length
    : 0;
  
  const avgAge = scoredArticles.length > 0 
    ? scoredArticles.reduce((sum, s) => sum + s.hoursOld, 0) / scoredArticles.length
    : 0;

  report += `**Average Freshness Score:** ${avgFreshness.toFixed(1)}/100\n`;
  report += `**Average Article Age:** ${avgAge.toFixed(1)} hours\n\n`;

  const categoryStats = scoredArticles.reduce((acc, scored) => {
    acc[scored.category] = (acc[scored.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  report += `### Age Distribution\n`;
  Object.entries(categoryStats).forEach(([category, count]) => {
    const percentage = ((count / scoredArticles.length) * 100).toFixed(1);
    report += `- **${category}**: ${count} articles (${percentage}%)\n`;
  });

  report += `\n### Sample Articles by Freshness\n`;
  const sorted = scoredArticles.sort((a, b) => b.freshnessScore - a.freshnessScore);
  
  sorted.slice(0, 5).forEach((scored, i) => {
    report += `${i + 1}. **${scored.article.title}** (${scored.hoursOld}h old, score: ${scored.freshnessScore.toFixed(1)})\n`;
  });

  return report;
}