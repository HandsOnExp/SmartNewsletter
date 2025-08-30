/**
 * Trend Analysis and Source Authority Weighting System
 * Provides intelligent insights for better content curation
 */

import { ParsedArticle } from '@/lib/rss-parser';
import { ExtractedContent } from '@/lib/content-extractor';
// Trend analysis utilities

export interface TrendAnalysis {
  emergingTopics: Array<{
    topic: string;
    frequency: number;
    growth: number; // Percentage growth over time
    significance: 'high' | 'medium' | 'low';
    relatedKeywords: string[];
  }>;
  topEntities: Array<{
    entity: string;
    mentions: number;
    context: 'company' | 'person' | 'technology' | 'product';
    sentiment: 'positive' | 'neutral' | 'negative';
  }>;
  temporalInsights: {
    peakActivity: string; // Time period with most activity
    contentVelocity: number; // Articles per hour
    freshnessScore: number; // How recent the content is (0-100)
  };
  qualityMetrics: {
    averageAuthorityScore: number;
    sourceReliability: number;
    contentDepth: number;
    factualConsistency: number;
  };
}

export interface SourceAuthority {
  domain: string;
  authorityScore: number; // 0-100
  reliabilityHistory: number;
  contentQuality: number;
  expertiseAreas: string[];
  trustIndicators: {
    establishedDomain: boolean;
    frequentUpdates: boolean;
    authorCredentials: boolean;
    factualAccuracy: boolean;
  };
}

export interface WeightedContent {
  article: ParsedArticle | ExtractedContent;
  weights: {
    authority: number;
    freshness: number;
    relevance: number;
    trending: number;
    quality: number;
    diversity: number;
    composite: number;
  };
  reasoning: string[];
  feedId?: string;
  feedName?: string;
}

// Authority scores for known sources
const SOURCE_AUTHORITY_MAP: Record<string, number> = {
  // Tier 1: Premium tech journalism
  'arstechnica.com': 95,
  'techcrunch.com': 90,
  'theverge.com': 88,
  'wired.com': 92,
  'reuters.com': 94,
  'bloomberg.com': 93,
  'wsj.com': 92,
  
  // Tier 2: Company/Research sources
  'openai.com': 89,
  'blog.google': 87,
  'research.google.com': 90,
  'microsoft.com': 85,
  'nvidia.com': 84,
  'anthropic.com': 88,
  
  // Tier 3: Academic sources
  'arxiv.org': 92,
  'nature.com': 95,
  'science.org': 94,
  'acm.org': 89,
  'ieee.org': 88,
  
  // Tier 4: General tech news
  'venturebeat.com': 75,
  'techradar.com': 70,
  'engadget.com': 72,
  'mashable.com': 68,
  'gizmodo.com': 70,
  
  // Default for unknown sources
  'unknown': 60
};

/**
 * Analyze trends across articles
 */
export function analyzeTrends(
  articles: (ParsedArticle | ExtractedContent)[],
  timeWindowHours: number = 72
): TrendAnalysis {
  console.log(`📈 Analyzing trends across ${articles.length} articles over ${timeWindowHours}h window...`);
  
  // Extract temporal data
  const now = new Date();
  const windowStart = new Date(now.getTime() - (timeWindowHours * 60 * 60 * 1000));
  const recentArticles = articles.filter(article => {
    const pubDate = 'publishedAt' in article ? article.publishedAt : article.pubDate;
    const articleDate = new Date(pubDate);
    return articleDate >= windowStart;
  });
  
  // Topic extraction and frequency analysis
  const topicFrequency = new Map<string, number>();
  const entityMentions = new Map<string, { count: number; contexts: string[] }>();
  const authorityScores: number[] = [];
  
  // Extract topics and entities
  articles.forEach(article => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const articleAny = article as any;
    const content = ('content' in article && typeof article.content === 'string') 
      ? article.content 
      : articleAny.contentSnippet || '';
    const title = article.title || '';
    const fullText = `${title} ${content}`.toLowerCase();
    
    // Extract AI/tech topics
    const techTopics = extractTechTopics(fullText);
    techTopics.forEach(topic => {
      topicFrequency.set(topic, (topicFrequency.get(topic) || 0) + 1);
    });
    
    // Extract entities
    const entities = extractEntities(fullText);
    entities.forEach(entity => {
      const existing = entityMentions.get(entity.name) || { count: 0, contexts: [] };
      entityMentions.set(entity.name, {
        count: existing.count + 1,
        contexts: [...existing.contexts, entity.context]
      });
    });
    
    // Calculate authority score
    const sourceUrl = 'sourceUrl' in article ? article.sourceUrl : article.link;
    const authority = calculateSourceAuthority(sourceUrl);
    authorityScores.push(authority.authorityScore);
  });
  
  // Calculate emerging topics
  const emergingTopics = Array.from(topicFrequency.entries())
    .map(([topic, frequency]) => ({
      topic,
      frequency,
      growth: calculateGrowthRate(topic, articles, timeWindowHours),
      significance: frequency > 5 ? 'high' as const : frequency > 2 ? 'medium' as const : 'low' as const,
      relatedKeywords: getRelatedKeywords(topic, articles)
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10);
  
  // Calculate top entities
  const topEntities = Array.from(entityMentions.entries())
    .map(([entity, data]) => ({
      entity,
      mentions: data.count,
      context: getMostCommonContext(data.contexts),
      sentiment: calculateSentiment(entity, articles)
    }))
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 10);
  
  // Temporal insights
  const contentVelocity = recentArticles.length / Math.max(timeWindowHours, 1);
  const avgAge = articles.reduce((sum, article) => {
    const pubDate = 'publishedAt' in article ? article.publishedAt : article.pubDate;
    const age = (now.getTime() - new Date(pubDate).getTime()) / (1000 * 60 * 60); // hours
    return sum + age;
  }, 0) / articles.length;
  
  const freshnessScore = Math.max(0, Math.min(100, 100 - (avgAge / 24) * 10)); // Decay over days
  
  // Quality metrics
  const averageAuthorityScore = authorityScores.length > 0 
    ? authorityScores.reduce((sum, score) => sum + score, 0) / authorityScores.length 
    : 60;
  
  const sourceReliability = calculateOverallReliability(articles);
  const contentDepth = calculateContentDepth(articles);
  const factualConsistency = calculateFactualConsistency(articles);
  
  return {
    emergingTopics,
    topEntities,
    temporalInsights: {
      peakActivity: getPeakActivityPeriod(articles),
      contentVelocity: Math.round(contentVelocity * 100) / 100,
      freshnessScore: Math.round(freshnessScore)
    },
    qualityMetrics: {
      averageAuthorityScore: Math.round(averageAuthorityScore),
      sourceReliability: Math.round(sourceReliability),
      contentDepth: Math.round(contentDepth),
      factualConsistency: Math.round(factualConsistency)
    }
  };
}

/**
 * Calculate source authority for a given URL
 */
export function calculateSourceAuthority(url: string): SourceAuthority {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    const baseScore = SOURCE_AUTHORITY_MAP[domain] || SOURCE_AUTHORITY_MAP['unknown'];
    
    // Authority indicators
    const trustIndicators = {
      establishedDomain: baseScore > 80,
      frequentUpdates: true, // Would be calculated from history
      authorCredentials: domain.includes('.edu') || domain.includes('.org') || baseScore > 85,
      factualAccuracy: baseScore > 75
    };
    
    // Adjust score based on indicators
    let adjustedScore = baseScore;
    if (domain.includes('.edu')) adjustedScore += 5;
    if (domain.includes('.gov')) adjustedScore += 8;
    if (domain.includes('research.')) adjustedScore += 3;
    
    // Determine expertise areas based on domain
    const expertiseAreas = getExpertiseAreas(domain);
    
    return {
      domain,
      authorityScore: Math.min(100, adjustedScore),
      reliabilityHistory: baseScore,
      contentQuality: baseScore,
      expertiseAreas,
      trustIndicators
    };
  } catch {
    return {
      domain: 'unknown',
      authorityScore: SOURCE_AUTHORITY_MAP['unknown'],
      reliabilityHistory: 60,
      contentQuality: 60,
      expertiseAreas: [],
      trustIndicators: {
        establishedDomain: false,
        frequentUpdates: false,
        authorCredentials: false,
        factualAccuracy: false
      }
    };
  }
}

/**
 * Weight articles based on multiple factors including feed diversity
 */
export function weightArticlesByQuality(
  articles: (ParsedArticle | ExtractedContent)[],
  trendAnalysis?: TrendAnalysis
): WeightedContent[] {
  console.log(`⚖️ Weighting ${articles.length} articles by quality factors...`);
  
  const now = new Date();
  const trendingTopics = new Set(
    trendAnalysis?.emergingTopics.map(t => t.topic.toLowerCase()) || []
  );
  
  // Map articles to their source feeds for diversity tracking
  const feedCounts = new Map<string, number>();
  const weightedArticles = articles.map(article => {
    const reasoning: string[] = [];
    const weights = { authority: 0, freshness: 0, relevance: 0, trending: 0, quality: 0, diversity: 0, composite: 0 };
    
    // Extract feed information
    const sourceUrl = 'sourceUrl' in article ? article.sourceUrl : article.link;
    const domain = new URL(sourceUrl).hostname.replace('www.', '');
    const feedName = getFeedNameFromDomain(domain);
    const feedId = getFeedIdFromDomain(domain);
    
    // Track feed counts for diversity calculation
    const currentCount = feedCounts.get(feedId) || 0;
    feedCounts.set(feedId, currentCount + 1);
    
    // Authority weight (0-25 points, reduced to make room for diversity)
    const authority = calculateSourceAuthority(sourceUrl);
    weights.authority = (authority.authorityScore / 100) * 25;
    reasoning.push(`Authority: ${authority.authorityScore}/100 (${authority.domain})`);
    
    // Freshness weight (0-20 points, slightly reduced)
    const pubDate = 'publishedAt' in article ? article.publishedAt : article.pubDate;
    const ageHours = (now.getTime() - new Date(pubDate).getTime()) / (1000 * 60 * 60);
    if (ageHours <= 6) weights.freshness = 20;
    else if (ageHours <= 24) weights.freshness = 16;
    else if (ageHours <= 48) weights.freshness = 12;
    else if (ageHours <= 72) weights.freshness = 8;
    else weights.freshness = 4;
    reasoning.push(`Freshness: ${Math.round(ageHours)}h old`);
    
    // Relevance weight (0-20 points)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const articleAny = article as any;
    const content = ('content' in article && typeof article.content === 'string') 
      ? article.content 
      : articleAny.contentSnippet || '';
    const relevanceScore = calculateAIRelevance(`${article.title} ${content}`);
    weights.relevance = (relevanceScore / 100) * 20;
    reasoning.push(`AI relevance: ${relevanceScore}%`);
    
    // Trending weight (0-15 points)
    const articleText = `${article.title} ${content}`.toLowerCase();
    const trendingKeywords = Array.from(trendingTopics).filter(topic => 
      articleText.includes(topic)
    );
    weights.trending = Math.min(15, trendingKeywords.length * 3);
    if (trendingKeywords.length > 0) {
      reasoning.push(`Trending: ${trendingKeywords.join(', ')}`);
    }
    
    // Quality weight (0-10 points)
    if ('quality' in article && article.quality) {
      weights.quality = (article.quality.score / 100) * 10;
      reasoning.push(`Content quality: ${article.quality.score}/100`);
    } else {
      // Estimate quality for standard articles
      const estimatedQuality = estimateArticleQuality(article as ParsedArticle);
      weights.quality = (estimatedQuality / 100) * 10;
      reasoning.push(`Estimated quality: ${estimatedQuality}/100`);
    }
    
    return {
      article,
      weights,
      reasoning,
      feedId,
      feedName
    };
  });
  
  // Apply diversity bonuses/penalties based on feed distribution
  return applyDiversityWeighting(weightedArticles)
    .sort((a, b) => b.weights.composite - a.weights.composite);
}

// Helper functions

function extractTechTopics(text: string): string[] {
  const techKeywords = [
    'artificial intelligence', 'machine learning', 'neural network', 'deep learning',
    'large language model', 'llm', 'generative ai', 'chatgpt', 'gpt-4', 'claude',
    'gemini', 'bard', 'computer vision', 'natural language processing',
    'robotics', 'autonomous', 'automation', 'algorithm', 'data science',
    'quantum computing', 'blockchain', 'cryptocurrency', 'fintech',
    'biotech', 'medtech', 'healthtech', 'edtech', 'cleantech'
  ];
  
  return techKeywords.filter(keyword => text.includes(keyword));
}

function extractEntities(text: string): Array<{ name: string; context: string }> {
  const companies = [
    'openai', 'google', 'microsoft', 'apple', 'amazon', 'meta', 'tesla',
    'anthropic', 'deepmind', 'nvidia', 'intel', 'amd', 'qualcomm',
    'salesforce', 'oracle', 'ibm', 'adobe', 'servicenow'
  ];
  
  const people = [
    'sam altman', 'elon musk', 'satya nadella', 'sundar pichai',
    'jensen huang', 'demis hassabis', 'yann lecun', 'geoffrey hinton',
    'andrew ng', 'fei-fei li'
  ];
  
  const technologies = [
    'gpt-4', 'claude', 'gemini', 'chatgpt', 'dalle', 'midjourney',
    'stable diffusion', 'pytorch', 'tensorflow', 'transformers'
  ];
  
  const entities: Array<{ name: string; context: string }> = [];
  
  companies.forEach(company => {
    if (text.includes(company)) {
      entities.push({ name: company, context: 'company' });
    }
  });
  
  people.forEach(person => {
    if (text.includes(person)) {
      entities.push({ name: person, context: 'person' });
    }
  });
  
  technologies.forEach(tech => {
    if (text.includes(tech)) {
      entities.push({ name: tech, context: 'technology' });
    }
  });
  
  return entities;
}

function calculateGrowthRate(topic: string, articles: (ParsedArticle | ExtractedContent)[], windowHours: number): number {
  // Simplified growth calculation - would use historical data in production
  const recentCount = articles.filter(article => {
    const pubDate = 'publishedAt' in article ? article.publishedAt : article.pubDate;
    const ageHours = (Date.now() - new Date(pubDate).getTime()) / (1000 * 60 * 60);
    const content = ('content' in article && typeof article.content === 'string') 
      ? article.content 
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      : (article as any).contentSnippet || '';
    return ageHours <= windowHours / 2 && `${article.title} ${content}`.toLowerCase().includes(topic);
  }).length;
  
  const olderCount = articles.filter(article => {
    const pubDate = 'publishedAt' in article ? article.publishedAt : article.pubDate;
    const ageHours = (Date.now() - new Date(pubDate).getTime()) / (1000 * 60 * 60);
    const content = ('content' in article && typeof article.content === 'string') 
      ? article.content 
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      : (article as any).contentSnippet || '';
    return ageHours > windowHours / 2 && `${article.title} ${content}`.toLowerCase().includes(topic);
  }).length;
  
  return olderCount > 0 ? ((recentCount - olderCount) / olderCount) * 100 : 0;
}

function getRelatedKeywords(topic: string, articles: (ParsedArticle | ExtractedContent)[]): string[] {
  // Simplified - would use more sophisticated NLP in production
  const relatedWords = new Set<string>();
  
  articles.forEach(article => {
    const content = ('content' in article && typeof article.content === 'string') 
      ? article.content 
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      : (article as any).contentSnippet || '';
    const text = `${article.title} ${content}`.toLowerCase();
    
    if (text.includes(topic)) {
      // Extract nearby words (simplified approach)
      const words = text.split(/\s+/);
      const topicIndex = words.findIndex(word => word.includes(topic));
      if (topicIndex !== -1) {
        // Get words around the topic
        for (let i = Math.max(0, topicIndex - 3); i <= Math.min(words.length - 1, topicIndex + 3); i++) {
          const word = words[i].replace(/[^a-z]/g, '');
          if (word.length > 3 && word !== topic) {
            relatedWords.add(word);
          }
        }
      }
    }
  });
  
  return Array.from(relatedWords).slice(0, 5);
}

function getMostCommonContext(contexts: string[]): 'company' | 'person' | 'technology' | 'product' {
  const counts = contexts.reduce((acc, context) => {
    acc[context] = (acc[context] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return Object.entries(counts)
    .sort(([,a], [,b]) => b - a)[0]?.[0] as 'company' | 'person' | 'technology' | 'product' || 'technology';
}

function calculateSentiment(entity: string, articles: (ParsedArticle | ExtractedContent)[]): 'positive' | 'neutral' | 'negative' {
  // Simplified sentiment analysis
  const positiveWords = ['breakthrough', 'success', 'innovative', 'leading', 'improved', 'growth', 'advance'];
  const negativeWords = ['failure', 'problem', 'decline', 'concern', 'risk', 'challenge', 'criticism'];
  
  let positiveCount = 0;
  let negativeCount = 0;
  
  articles.forEach(article => {
    const content = ('content' in article && typeof article.content === 'string') 
      ? article.content 
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      : (article as any).contentSnippet || '';
    const text = `${article.title} ${content}`.toLowerCase();
    
    if (text.includes(entity.toLowerCase())) {
      positiveWords.forEach(word => {
        if (text.includes(word)) positiveCount++;
      });
      
      negativeWords.forEach(word => {
        if (text.includes(word)) negativeCount++;
      });
    }
  });
  
  if (positiveCount > negativeCount + 1) return 'positive';
  if (negativeCount > positiveCount + 1) return 'negative';
  return 'neutral';
}

function getPeakActivityPeriod(articles: (ParsedArticle | ExtractedContent)[]): string {
  const hourCounts = new Array(24).fill(0);
  
  articles.forEach(article => {
    const pubDate = 'publishedAt' in article ? article.publishedAt : article.pubDate;
    const hour = new Date(pubDate).getHours();
    hourCounts[hour]++;
  });
  
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
  return `${peakHour}:00-${(peakHour + 1) % 24}:00 UTC`;
}

function calculateOverallReliability(articles: (ParsedArticle | ExtractedContent)[]): number {
  const scores = articles.map(article => {
    const sourceUrl = 'sourceUrl' in article ? article.sourceUrl : article.link;
    return calculateSourceAuthority(sourceUrl).authorityScore;
  });
  
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function calculateContentDepth(articles: (ParsedArticle | ExtractedContent)[]): number {
  const depths = articles.map(article => {
    if ('wordCount' in article && article.wordCount) {
      return Math.min(100, article.wordCount / 10); // Scale word count to 0-100
    }
    
    const content = ('content' in article && typeof article.content === 'string') 
      ? article.content 
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      : (article as any).contentSnippet || '';
    const wordCount = content.split(/\s+/).length;
    return Math.min(100, wordCount / 5); // Scale to 0-100
  });
  
  return depths.reduce((sum, depth) => sum + depth, 0) / depths.length;
}

function calculateFactualConsistency(articles: (ParsedArticle | ExtractedContent)[]): number {
  // Simplified consistency check - would use more sophisticated analysis in production
  // For now, assume higher authority sources have better factual consistency
  return calculateOverallReliability(articles);
}

function getExpertiseAreas(domain: string): string[] {
  const expertiseMap: Record<string, string[]> = {
    'techcrunch.com': ['startups', 'venture capital', 'technology'],
    'arstechnica.com': ['technology', 'science', 'computing'],
    'wired.com': ['technology', 'culture', 'science'],
    'openai.com': ['artificial intelligence', 'machine learning'],
    'anthropic.com': ['ai safety', 'large language models'],
    'nvidia.com': ['graphics', 'ai computing', 'gaming'],
    'arxiv.org': ['research', 'academic papers', 'science'],
    'nature.com': ['scientific research', 'peer review', 'academia']
  };
  
  return expertiseMap[domain] || ['technology', 'general'];
}

function calculateAIRelevance(text: string): number {
  const aiKeywords = [
    'artificial intelligence', 'machine learning', 'neural', 'ai', 'ml',
    'algorithm', 'automation', 'robot', 'deep learning', 'nlp',
    'computer vision', 'generative', 'llm', 'chatbot', 'gpt'
  ];
  
  const textLower = text.toLowerCase();
  const matches = aiKeywords.filter(keyword => textLower.includes(keyword));
  
  return Math.min(100, (matches.length / aiKeywords.length) * 100 + (matches.length * 10));
}

function estimateArticleQuality(article: ParsedArticle): number {
  let score = 50; // Base score
  
  // Title quality
  if (article.title.length > 50 && article.title.length < 120) score += 10;
  if (article.title.includes('?') || article.title.includes('!')) score += 5;
  
  // Content length
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content = (article as any).contentSnippet || (typeof article.content === 'string' ? article.content : '');
  const wordCount = content.split(/\s+/).length;
  if (wordCount > 200) score += 15;
  if (wordCount > 500) score += 10;
  
  // Has author
  if (article.creator) score += 10;
  
  // Categories
  if (article.categories && article.categories.length > 0) score += 5;
  
  return Math.min(100, score);
}

/**
 * Apply diversity weighting to prevent single feed dominance
 */
function applyDiversityWeighting(weightedArticles: WeightedContent[]): WeightedContent[] {
  console.log('🎯 Applying feed diversity weighting...');
  
  // Count articles per feed
  const feedCounts = new Map<string, number>();
  weightedArticles.forEach(wa => {
    if (wa.feedId) {
      feedCounts.set(wa.feedId, (feedCounts.get(wa.feedId) || 0) + 1);
    }
  });
  
  // Log feed distribution
  console.log('📊 Article distribution by feed:', Object.fromEntries(feedCounts));
  
  // Apply diversity weights (0-10 points)
  const articlesWithDiversity = weightedArticles.map(wa => {
    if (!wa.feedId) {
      wa.weights.diversity = 5; // Neutral score for unknown feeds
      wa.weights.composite = wa.weights.authority + wa.weights.freshness + wa.weights.relevance + wa.weights.trending + wa.weights.quality + wa.weights.diversity;
      return wa;
    }
    
    const feedCount = feedCounts.get(wa.feedId) || 1;
    const totalArticles = weightedArticles.length;
    const feedPercentage = (feedCount / totalArticles) * 100;
    
    // Diversity bonus calculation
    // - Feeds with <20% of total articles get bonus
    // - Feeds with >50% of total articles get penalty
    // - Target: balanced distribution across feeds
    let diversityScore = 5; // Base score
    
    if (feedPercentage < 10) {
      diversityScore = 10; // High bonus for underrepresented feeds
    } else if (feedPercentage < 20) {
      diversityScore = 8; // Medium bonus
    } else if (feedPercentage < 30) {
      diversityScore = 6; // Small bonus
    } else if (feedPercentage < 40) {
      diversityScore = 4; // Small penalty
    } else if (feedPercentage < 60) {
      diversityScore = 2; // Medium penalty
    } else {
      diversityScore = 0; // High penalty for dominant feeds
    }
    
    wa.weights.diversity = diversityScore;
    wa.reasoning.push(`Diversity: ${diversityScore}/10 (feed: ${feedPercentage.toFixed(1)}% of articles)`);
    
    // Recalculate composite score
    wa.weights.composite = wa.weights.authority + wa.weights.freshness + wa.weights.relevance + wa.weights.trending + wa.weights.quality + wa.weights.diversity;
    
    return wa;
  });
  
  // Log diversity adjustments
  const diversityAdjustments = articlesWithDiversity
    .filter(wa => wa.weights.diversity !== 5)
    .map(wa => `${wa.feedName || wa.feedId}: ${wa.weights.diversity}/10`)
    .slice(0, 5);
  
  if (diversityAdjustments.length > 0) {
    console.log('🔄 Diversity adjustments applied:', diversityAdjustments.join(', '));
  }
  
  return articlesWithDiversity;
}

/**
 * Get feed name from domain
 */
function getFeedNameFromDomain(domain: string): string {
  const feedMap: Record<string, string> = {
    'techcrunch.com': 'TechCrunch AI',
    'fastcompany.com': 'Fast Company AI',
    'spectrum.ieee.org': 'IEEE Spectrum AI',
    'wired.com': 'WIRED AI',
    'technologyreview.com': 'MIT Technology Review',
    'distill.pub': 'Distill ML Research',
    'infoworld.com': 'InfoWorld AI',
    'unite.ai': 'Unite.AI',
    'openai.com': 'OpenAI Blog',
    'marktechpost.com': 'MarkTechPost',
    'blogs.nvidia.com': 'NVIDIA AI Blog',
    'aibusiness.com': 'AI Business',
    'artificialintelligence-news.com': 'AI News',
    'darkreading.com': 'Dark Reading',
    'securityweek.com': 'Security Week',
    'hnrss.org': 'Hacker News',
    'dev.to': 'DEV Community',
    'feeds.feedburner.com': 'Google AI Blog' // feedburner for Google AI Blog
  };
  
  return feedMap[domain] || domain;
}

/**
 * Get feed ID from domain
 */
function getFeedIdFromDomain(domain: string): string {
  const feedIdMap: Record<string, string> = {
    'techcrunch.com': 'techcrunch-ai',
    'fastcompany.com': 'fastcompany-ai',
    'spectrum.ieee.org': 'ieee-spectrum-ai',
    'wired.com': 'wired-ai',
    'technologyreview.com': 'mit-tech-review-ai',
    'distill.pub': 'distill-pub',
    'infoworld.com': 'infoworld-ai',
    'unite.ai': 'unite-ai',
    'openai.com': 'openai-blog',
    'marktechpost.com': 'marktechpost',
    'blogs.nvidia.com': 'nvidia-ai-blog',
    'aibusiness.com': 'ai-business',
    'artificialintelligence-news.com': 'ai-news',
    'darkreading.com': 'dark-reading',
    'securityweek.com': 'security-week',
    'hnrss.org': 'hacker-news',
    'dev.to': 'dev-to',
    'feeds.feedburner.com': 'google-ai-blog' // feedburner for Google AI Blog
  };
  
  return feedIdMap[domain] || domain;
}