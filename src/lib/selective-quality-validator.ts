/**
 * Selective Quality Validation System
 * Performs thorough validation only on final selected newsletter topics
 * to ensure accuracy while maintaining performance
 */

import { NewsletterTopic } from '@/lib/ai-processors';
import { ParsedArticle } from '@/lib/rss-parser';
import { ExtractedContent } from '@/lib/content-extractor';
import { validateURLsBatch } from '@/lib/url-validator';

export interface QualityValidationResult {
  validTopics: NewsletterTopic[];
  invalidTopics: Array<{
    topic: NewsletterTopic;
    issues: string[];
    severity: 'warning' | 'error';
  }>;
  validationStats: {
    totalTopics: number;
    validTopics: number;
    urlValidation: {
      valid: number;
      invalid: number;
    };
    contentAlignment: {
      aligned: number;
      misaligned: number;
    };
    categoryConsistency: {
      consistent: number;
      inconsistent: number;
    };
  };
  processingTime: number;
}

export interface ValidationOptions {
  validateUrls: boolean;
  checkContentAlignment: boolean;
  validateCategories: boolean;
  allowedCategories?: string[];
  strictMode: boolean;
}

const DEFAULT_OPTIONS: ValidationOptions = {
  validateUrls: true,
  checkContentAlignment: true,
  validateCategories: true,
  strictMode: false
};

/**
 * Perform comprehensive quality validation on newsletter topics
 */
export async function validateNewsletterQuality(
  topics: NewsletterTopic[],
  sourceArticles: ParsedArticle[] | ExtractedContent[],
  options: Partial<ValidationOptions> = {}
): Promise<QualityValidationResult> {
  const startTime = Date.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  console.log(`🔍 Starting selective quality validation for ${topics.length} newsletter topics...`);
  
  const validTopics: NewsletterTopic[] = [];
  const invalidTopics: Array<{
    topic: NewsletterTopic;
    issues: string[];
    severity: 'warning' | 'error';
  }> = [];
  
  const urlStats = { valid: 0, invalid: 0 };
  const alignmentStats = { aligned: 0, misaligned: 0 };
  const categoryStats = { consistent: 0, inconsistent: 0 };
  
  // Step 1: URL Validation (batch validation for efficiency)
  const urlValidationMap = new Map<string, boolean>();
  if (opts.validateUrls) {
    console.log('📡 Validating URLs for final topics...');
    const urls = topics.map(t => t.sourceUrl).filter(Boolean);
    const uniqueUrls = [...new Set(urls)];
    
    if (uniqueUrls.length > 0) {
      const urlValidationResults = await validateURLsBatch(uniqueUrls, {
        batchSize: 10,
        timeout: 5000,
        delayMs: 100
      });
      
      urlValidationResults.forEach(result => {
        urlValidationMap.set(result.url, result.isValid);
      });
    }
  }
  
  // Step 2: Content alignment validation
  const sourceArticleMap = new Map<string, ParsedArticle | ExtractedContent>();
  sourceArticles.forEach(article => {
    const url = 'sourceUrl' in article ? article.sourceUrl : article.link;
    sourceArticleMap.set(url, article);
  });
  
  // Step 3: Validate each topic
  for (const topic of topics) {
    const issues: string[] = [];
    let severity: 'warning' | 'error' = 'warning';
    
    // URL Validation
    if (opts.validateUrls && topic.sourceUrl) {
      const isUrlValid = urlValidationMap.get(topic.sourceUrl);
      if (isUrlValid === false) {
        issues.push(`Invalid or inaccessible URL: ${topic.sourceUrl}`);
        severity = 'error';
        urlStats.invalid++;
      } else if (isUrlValid === true) {
        urlStats.valid++;
      }
      
      // Check if URL exists in source articles
      if (!sourceArticleMap.has(topic.sourceUrl)) {
        issues.push(`URL not found in source articles: ${topic.sourceUrl}`);
        severity = 'error';
      }
    }
    
    // Content Alignment Validation
    if (opts.checkContentAlignment && topic.sourceUrl) {
      const sourceArticle = sourceArticleMap.get(topic.sourceUrl);
      if (sourceArticle) {
        const alignmentIssues = validateContentAlignment(topic, sourceArticle);
        if (alignmentIssues.length > 0) {
          issues.push(...alignmentIssues);
          if (alignmentIssues.some(issue => issue.includes('major mismatch'))) {
            severity = 'error';
          }
          alignmentStats.misaligned++;
        } else {
          alignmentStats.aligned++;
        }
      }
    }
    
    // Category Validation
    if (opts.validateCategories && opts.allowedCategories) {
      if (!opts.allowedCategories.includes(topic.category)) {
        issues.push(`Invalid category: ${topic.category}. Allowed: ${opts.allowedCategories.join(', ')}`);
        severity = 'warning';
        categoryStats.inconsistent++;
      } else {
        categoryStats.consistent++;
      }
    }
    
    // Quality Checks
    const qualityIssues = validateTopicQuality(topic);
    if (qualityIssues.length > 0) {
      issues.push(...qualityIssues);
    }
    
    // Decide if topic is valid
    const isValid = opts.strictMode ? 
      (issues.length === 0) : 
      (severity !== 'error');
    
    if (isValid) {
      validTopics.push(topic);
    } else {
      invalidTopics.push({ topic, issues, severity });
    }
  }
  
  const processingTime = Date.now() - startTime;
  
  const result: QualityValidationResult = {
    validTopics,
    invalidTopics,
    validationStats: {
      totalTopics: topics.length,
      validTopics: validTopics.length,
      urlValidation: urlStats,
      contentAlignment: alignmentStats,
      categoryConsistency: categoryStats
    },
    processingTime
  };
  
  console.log(`✅ Quality validation complete: ${validTopics.length}/${topics.length} topics passed validation (${processingTime}ms)`);
  
  if (invalidTopics.length > 0) {
    console.log('❌ Quality issues found:');
    invalidTopics.forEach(({ topic, issues, severity }) => {
      console.log(`  ${severity === 'error' ? '🔴' : '🟡'} "${topic.headline}": ${issues.join(', ')}`);
    });
  }
  
  return result;
}

/**
 * Validate content alignment between topic and source article
 */
function validateContentAlignment(
  topic: NewsletterTopic, 
  sourceArticle: ParsedArticle | ExtractedContent
): string[] {
  const issues: string[] = [];
  
  const articleTitle = sourceArticle.title.toLowerCase();
  const topicHeadline = topic.headline.toLowerCase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sourceArticleAny = sourceArticle as any;
  const articleContent = ('content' in sourceArticle && typeof sourceArticle.content === 'string') 
    ? sourceArticle.content.toLowerCase()
    : sourceArticleAny.contentSnippet?.toLowerCase() || '';
  
  // Check headline alignment
  const headlineKeywords = topicHeadline.split(/\s+/).filter(word => 
    word.length > 3 && !['the', 'and', 'for', 'with', 'that', 'this', 'from'].includes(word)
  );
  
  const matchingKeywords = headlineKeywords.filter(keyword => 
    articleTitle.includes(keyword) || articleContent.includes(keyword)
  );
  
  const alignmentRatio = matchingKeywords.length / Math.max(headlineKeywords.length, 1);
  
  if (alignmentRatio < 0.3) {
    issues.push(`Low content alignment: headline doesn't match article content (${Math.round(alignmentRatio * 100)}% keyword match)`);
  }
  
  // Check for contradictory statements
  const topicClaims = extractClaims(topic.summary);
  const articleClaims = extractClaims(articleContent);
  
  const contradictions = findContradictions(topicClaims, articleClaims);
  if (contradictions.length > 0) {
    issues.push(`Potential contradictions: ${contradictions.join(', ')}`);
  }
  
  // Check for exaggeration
  const exaggerationWords = ['revolutionary', 'breakthrough', 'unprecedented', 'game-changing', 'transforms', 'disrupts'];
  const topicHasExaggeration = exaggerationWords.some(word => 
    topic.headline.toLowerCase().includes(word) || topic.summary.toLowerCase().includes(word)
  );
  
  if (topicHasExaggeration) {
    const articleSupportsExaggeration = exaggerationWords.some(word => 
      articleContent.includes(word)
    );
    
    if (!articleSupportsExaggeration) {
      issues.push('Potential exaggeration: strong claims not supported by source article');
    }
  }
  
  return issues;
}

/**
 * Extract claims from text (simplified approach)
 */
function extractClaims(text: string): string[] {
  if (!text) return [];
  
  // Look for definitive statements
  const claimPatterns = [
    /(\w+\s+(?:is|are|will|has|have|can|cannot|does|doesn't))/gi,
    /(\w+\s+(?:announced|released|launched|developed|created))/gi
  ];
  
  const claims: string[] = [];
  claimPatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      claims.push(...matches.map(m => m.toLowerCase().trim()));
    }
  });
  
  return [...new Set(claims)];
}

/**
 * Find potential contradictions between claims
 */
function findContradictions(topicClaims: string[], articleClaims: string[]): string[] {
  // This is a simplified implementation
  // In production, you might use more sophisticated NLP
  const contradictions: string[] = [];
  
  // Look for direct contradictions (very basic)
  const negationPairs = [
    ['is', 'is not'],
    ['can', 'cannot'],
    ['will', 'will not'],
    ['has', 'has not']
  ];
  
  negationPairs.forEach(([positive, negative]) => {
    const hasPositiveInTopic = topicClaims.some(claim => claim.includes(positive));
    const hasNegativeInArticle = articleClaims.some(claim => claim.includes(negative));
    
    if (hasPositiveInTopic && hasNegativeInArticle) {
      contradictions.push(`${positive} vs ${negative}`);
    }
  });
  
  return contradictions;
}

/**
 * Validate individual topic quality
 */
function validateTopicQuality(topic: NewsletterTopic): string[] {
  const issues: string[] = [];
  
  // Check headline quality
  if (!topic.headline || topic.headline.length < 10) {
    issues.push('Headline too short or missing');
  }
  
  if (topic.headline && topic.headline.length > 100) {
    issues.push('Headline too long');
  }
  
  // Check for generic headlines
  const genericTerms = ['new', 'update', 'announcement', 'development', 'news'];
  const headlineLower = topic.headline?.toLowerCase() || '';
  const genericCount = genericTerms.filter(term => headlineLower.includes(term)).length;
  
  if (genericCount > 2) {
    issues.push('Headline appears generic (overuse of common terms)');
  }
  
  // Check summary quality
  if (!topic.summary || topic.summary.length < 80) {
    issues.push('Summary too short (minimum 80 words)');
  }
  
  if (topic.summary && topic.summary.length > 1000) {
    issues.push('Summary too long (maximum 1000 words)');
  }
  
  // Check for proper sentence structure
  if (topic.summary) {
    const sentenceCount = topic.summary.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    if (sentenceCount < 3) {
      issues.push('Summary needs more sentences (minimum 4-6 sentences)');
    }
    if (sentenceCount > 8) {
      issues.push('Summary too many sentences (maximum 6 sentences)');
    }
  }
  
  // Check URL format
  if (topic.sourceUrl) {
    try {
      new URL(topic.sourceUrl);
    } catch {
      issues.push('Invalid URL format');
    }
  } else {
    issues.push('Missing source URL');
  }
  
  return issues;
}

/**
 * Fix common topic issues automatically
 */
export function autoFixTopicIssues(
  topics: NewsletterTopic[],
  sourceArticles: ParsedArticle[] | ExtractedContent[]
): NewsletterTopic[] {
  const sourceMap = new Map<string, ParsedArticle | ExtractedContent>();
  sourceArticles.forEach(article => {
    const url = 'sourceUrl' in article ? article.sourceUrl : article.link;
    sourceMap.set(url, article);
  });
  
  return topics.map(topic => {
    const fixedTopic = { ...topic };
    
    // Fix missing URLs by finding best match
    if (!fixedTopic.sourceUrl || !sourceMap.has(fixedTopic.sourceUrl)) {
      const bestMatch = findBestMatchingArticle(topic, sourceArticles);
      if (bestMatch) {
        const matchUrl = 'sourceUrl' in bestMatch ? bestMatch.sourceUrl : bestMatch.link;
        fixedTopic.sourceUrl = matchUrl;
        console.log(`🔧 Fixed URL for "${topic.headline}": ${matchUrl}`);
      }
    }
    
    // Fix category issues
    const validCategories = ['security', 'business', 'technology', 'research', 'product', 'enterprise', 'consumer', 'development'];
    if (!fixedTopic.category || !validCategories.includes(fixedTopic.category)) {
      fixedTopic.category = 'technology'; // Default fallback
    }
    
    return fixedTopic;
  });
}

/**
 * Find best matching article for a topic
 */
function findBestMatchingArticle(
  topic: NewsletterTopic, 
  articles: (ParsedArticle | ExtractedContent)[]
): ParsedArticle | ExtractedContent | null {
  let bestMatch: ParsedArticle | ExtractedContent | null = null;
  let bestScore = 0;
  
  const topicWords = topic.headline.toLowerCase().split(/\s+/);
  
  articles.forEach(article => {
    const articleWords = article.title.toLowerCase().split(/\s+/);
    const commonWords = topicWords.filter(word => 
      word.length > 3 && articleWords.includes(word)
    );
    
    const score = commonWords.length / Math.max(topicWords.length, 1);
    
    if (score > bestScore && score > 0.3) {
      bestScore = score;
      bestMatch = article;
    }
  });
  
  return bestMatch;
}