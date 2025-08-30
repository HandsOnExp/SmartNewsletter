/**
 * Source Diversity Control System
 * Ensures balanced representation across different news sources
 * Prevents any single source from dominating newsletter content
 */

import { ParsedArticle } from '@/lib/rss-parser';
import { ExtractedContent } from '@/lib/content-extractor';

export interface DiversityConfig {
  maxArticlesPerSource: number;
  maxArticlesPerCategory: number;
  maxArticlesPerDomain: number;
  prioritizeFreshness: boolean;
  diversityWeight: number; // 0-1, how much to prioritize diversity vs quality
  sourceRotationEnabled: boolean;
}

export interface SourceStats {
  source: string;
  domain: string;
  category: string;
  articleCount: number;
  averageQuality?: number;
  averageFreshness: number; // hours since publication
  lastSelected?: Date;
}

export interface DiversityResult {
  selectedArticles: (ParsedArticle | ExtractedContent)[];
  rejectedArticles: Array<{
    article: ParsedArticle | ExtractedContent;
    reason: string;
  }>;
  sourceStats: SourceStats[];
  diversityScore: number; // 0-100
}

/**
 * Default diversity configuration for balanced newsletter generation
 */
export const DEFAULT_DIVERSITY_CONFIG: DiversityConfig = {
  maxArticlesPerSource: 2, // Max 2 articles from any single source (e.g., TechCrunch)
  maxArticlesPerCategory: 4, // Max 4 articles from any single category
  maxArticlesPerDomain: 3, // Max 3 articles from any single domain
  prioritizeFreshness: true,
  diversityWeight: 0.3, // 30% weight for diversity, 70% for quality/relevance
  sourceRotationEnabled: true
};

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const domain = new URL(url).hostname.toLowerCase();
    // Remove www. prefix and common subdomains
    return domain.replace(/^(www\.|blog\.|news\.)/, '');
  } catch {
    return 'unknown';
  }
}

/**
 * Calculate article freshness in hours
 */
function calculateFreshness(pubDate: string): number {
  try {
    const publishedDate = new Date(pubDate);
    const now = new Date();
    const diffMs = now.getTime() - publishedDate.getTime();
    return Math.max(0, diffMs / (1000 * 60 * 60)); // Convert to hours
  } catch {
    return 999; // Very old if we can't parse the date
  }
}

/**
 * Get article source name
 */
function getArticleSource(article: ParsedArticle | ExtractedContent): string {
  if ('source' in article && article.source) {
    return article.source;
  }
  if ('feedName' in article && typeof article.feedName === 'string') {
    return article.feedName;
  }
  // Fallback to domain if no source specified
  const url = 'sourceUrl' in article ? article.sourceUrl : article.link;
  return extractDomain(url);
}

/**
 * Get article category
 */
function getArticleCategory(article: ParsedArticle | ExtractedContent): string {
  if ('category' in article && typeof article.category === 'string') {
    return article.category;
  }
  if ('categories' in article && article.categories && article.categories.length > 0) {
    return article.categories[0];
  }
  return 'general';
}

/**
 * Calculate quality score for an article
 */
function calculateQualityScore(article: ParsedArticle | ExtractedContent): number {
  // Use existing quality score if available
  if ('quality' in article && article.quality && typeof article.quality === 'object') {
    return article.quality.score || 70;
  }
  if ('qualityScore' in article && typeof article.qualityScore === 'number') {
    return article.qualityScore;
  }

  // Basic quality estimation based on content length and title
  let score = 70; // Base score
  
  const title = article.title || '';
  const content = ('content' in article && typeof article.content === 'string') 
    ? article.content 
    : ('contentSnippet' in article ? article.contentSnippet : '');

  // Title quality indicators
  if (title.length > 10 && title.length < 100) score += 5;
  if (title.includes('AI') || title.includes('artificial intelligence')) score += 5;
  
  // Content quality indicators
  if (content && content.length > 200) score += 10;
  if (content && content.length > 500) score += 5;

  return Math.min(100, Math.max(0, score));
}

/**
 * Apply source diversity controls to article selection
 */
export function applySourceDiversity(
  articles: (ParsedArticle | ExtractedContent)[],
  config: DiversityConfig = DEFAULT_DIVERSITY_CONFIG
): DiversityResult {
  console.log(`🎯 Applying source diversity controls to ${articles.length} articles...`);
  console.log(`📊 Config: maxPerSource=${config.maxArticlesPerSource}, maxPerCategory=${config.maxArticlesPerCategory}, diversityWeight=${config.diversityWeight}`);

  const selectedArticles: (ParsedArticle | ExtractedContent)[] = [];
  const rejectedArticles: Array<{ article: ParsedArticle | ExtractedContent; reason: string }> = [];
  const sourceStats = new Map<string, SourceStats>();
  const categoryCount = new Map<string, number>();
  const domainCount = new Map<string, number>();

  // Sort articles by a composite score (quality + freshness - diversity penalty)
  const scoredArticles = articles.map(article => {
    const source = getArticleSource(article);
    const category = getArticleCategory(article);
    const domain = extractDomain('sourceUrl' in article ? article.sourceUrl : article.link);
    const quality = calculateQualityScore(article);
    const freshness = calculateFreshness('publishedAt' in article ? article.publishedAt : article.pubDate);
    
    // Calculate freshness score (newer = higher score)
    const freshnessScore = Math.max(0, 100 - (freshness / 24) * 50); // Decay over 48 hours
    
    // Base score combines quality and freshness
    let compositeScore = quality * 0.7 + freshnessScore * 0.3;
    
    // Apply diversity bonuses/penalties
    const currentSourceCount = sourceStats.get(source)?.articleCount || 0;
    const currentCategoryCount = categoryCount.get(category) || 0;
    const currentDomainCount = domainCount.get(domain) || 0;
    
    // Penalty for sources that already have many articles
    if (currentSourceCount > 0) {
      compositeScore *= (1 - config.diversityWeight * 0.5 * currentSourceCount);
    }
    if (currentCategoryCount > 2) {
      compositeScore *= (1 - config.diversityWeight * 0.3 * (currentCategoryCount - 2));
    }
    if (currentDomainCount > 1) {
      compositeScore *= (1 - config.diversityWeight * 0.4 * (currentDomainCount - 1));
    }

    return {
      article,
      source,
      category,
      domain,
      quality,
      freshness,
      compositeScore
    };
  });

  // Sort by composite score (highest first)
  scoredArticles.sort((a, b) => b.compositeScore - a.compositeScore);

  // Select articles with diversity constraints
  for (const scored of scoredArticles) {
    const { article, source, category, domain, quality, freshness } = scored;
    
    const currentSourceCount = sourceStats.get(source)?.articleCount || 0;
    const currentCategoryCount = categoryCount.get(category) || 0;
    const currentDomainCount = domainCount.get(domain) || 0;

    // Check constraints
    let rejected = false;
    let rejectionReason = '';

    if (currentSourceCount >= config.maxArticlesPerSource) {
      rejected = true;
      rejectionReason = `Source limit exceeded: ${source} (${currentSourceCount}/${config.maxArticlesPerSource})`;
    } else if (currentCategoryCount >= config.maxArticlesPerCategory) {
      rejected = true;
      rejectionReason = `Category limit exceeded: ${category} (${currentCategoryCount}/${config.maxArticlesPerCategory})`;
    } else if (currentDomainCount >= config.maxArticlesPerDomain) {
      rejected = true;
      rejectionReason = `Domain limit exceeded: ${domain} (${currentDomainCount}/${config.maxArticlesPerDomain})`;
    }

    if (rejected) {
      rejectedArticles.push({ article, reason: rejectionReason });
      continue;
    }

    // Article passes diversity checks - add to selected
    selectedArticles.push(article);

    // Update counts
    const currentStats = sourceStats.get(source) || {
      source,
      domain,
      category,
      articleCount: 0,
      averageQuality: quality,
      averageFreshness: freshness,
      lastSelected: new Date()
    };

    // Update averages
    const newCount = currentStats.articleCount + 1;
    const newAvgQuality = ((currentStats.averageQuality || 0) * currentStats.articleCount + quality) / newCount;
    const newAvgFreshness = (currentStats.averageFreshness * currentStats.articleCount + freshness) / newCount;

    sourceStats.set(source, {
      ...currentStats,
      articleCount: newCount,
      averageQuality: newAvgQuality,
      averageFreshness: newAvgFreshness,
      lastSelected: new Date()
    });

    categoryCount.set(category, (categoryCount.get(category) || 0) + 1);
    domainCount.set(domain, (domainCount.get(domain) || 0) + 1);
  }

  // Calculate diversity score
  const uniqueSources = sourceStats.size;
  const uniqueCategories = categoryCount.size;
  const uniqueDomains = domainCount.size;
  const totalArticles = selectedArticles.length;

  const diversityScore = Math.min(100, Math.round(
    (uniqueSources / Math.max(1, totalArticles) * 100 * 0.4) +
    (uniqueCategories / Math.max(1, totalArticles) * 100 * 0.3) +
    (uniqueDomains / Math.max(1, totalArticles) * 100 * 0.3)
  ));

  console.log(`🎯 Diversity Control Results:`);
  console.log(`✅ Selected: ${selectedArticles.length} articles`);
  console.log(`❌ Rejected: ${rejectedArticles.length} articles`);
  console.log(`📊 Sources: ${uniqueSources}, Categories: ${uniqueCategories}, Domains: ${uniqueDomains}`);
  console.log(`🌈 Diversity Score: ${diversityScore}/100`);

  // Log source distribution
  const sortedStats = Array.from(sourceStats.values()).sort((a, b) => b.articleCount - a.articleCount);
  console.log(`📰 Source Distribution:`, sortedStats.slice(0, 5).map(s => 
    `${s.source}(${s.articleCount})`).join(', '));

  return {
    selectedArticles,
    rejectedArticles,
    sourceStats: sortedStats,
    diversityScore
  };
}

/**
 * Generate diversity report for debugging
 */
export function generateDiversityReport(result: DiversityResult): string {
  const { selectedArticles, rejectedArticles, sourceStats, diversityScore } = result;
  
  let report = `## Source Diversity Report\n\n`;
  report += `**Overall Diversity Score:** ${diversityScore}/100\n\n`;
  
  report += `**Selected Articles:** ${selectedArticles.length}\n`;
  report += `**Rejected Articles:** ${rejectedArticles.length}\n\n`;
  
  report += `### Source Distribution\n`;
  sourceStats.forEach(stat => {
    report += `- **${stat.source}**: ${stat.articleCount} articles (Avg Quality: ${stat.averageQuality?.toFixed(1)}, Avg Freshness: ${stat.averageFreshness.toFixed(1)}h)\n`;
  });
  
  if (rejectedArticles.length > 0) {
    report += `\n### Rejection Reasons\n`;
    const reasonCounts = rejectedArticles.reduce((acc, rejected) => {
      const reason = rejected.reason.split(':')[0];
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(reasonCounts).forEach(([reason, count]) => {
      report += `- ${reason}: ${count} articles\n`;
    });
  }
  
  return report;
}