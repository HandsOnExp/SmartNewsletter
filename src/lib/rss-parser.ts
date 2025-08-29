import Parser from 'rss-parser';
import { RSS_FEEDS, type RSSFeed } from '@/config/rss-feeds';
import { 
  cacheRSSContent, 
  getCachedRSSContent, 
  createContentHash,
  LazyContent
} from '@/utils/cache-optimization';
import { validateURLsBatch, sanitizeURL, getFallbackURL, filterValidURLs } from '@/lib/url-validator';
import { TimePeriod, TimePeriodOption } from '@/types';
import { extractAndEnhanceContent, ExtractedContent } from '@/lib/content-extractor';
import { 
  trackFeedPerformance, 
  getFeedsByPerformancePriority,
  getAdaptiveTimeout
} from '@/lib/feed-performance-tracker';

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'AI Newsletter Bot 1.0',
  },
});

// Time period options with their corresponding durations in hours
export const TIME_PERIOD_OPTIONS: TimePeriodOption[] = [
  { value: '24hours', label: 'Last 24 Hours', description: 'Daily digest', hours: 24 },
  { value: '3days', label: 'Last 3 Days', description: 'Recent stories', hours: 72 },
  { value: '1week', label: 'Last Week', description: 'Weekly summary', hours: 168 }
];

export interface ParsedArticle {
  title: string;
  link: string;
  pubDate: string;
  contentSnippet: string;
  content: string | LazyContent;
  creator: string;
  categories: string[];
  source: string;
}

export async function fetchRSSFeed(url: string, feedName: string, timeoutMs: number = 8000) {
  try {
    // Check cache first
    const cacheKey = createContentHash(`${url}:${feedName}`);
    const cachedContent = getCachedRSSContent(cacheKey);
    
    if (cachedContent) {
      console.log(`Using cached RSS feed for ${feedName}`);
      return JSON.parse(cachedContent);
    }
    
    // Create a promise that rejects after timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Feed ${feedName} timed out after ${timeoutMs}ms`)), timeoutMs);
    });
    
    // Race between feed parsing and timeout
    const feed = await Promise.race([
      parser.parseURL(url),
      timeoutPromise
    ]) as { items: {
      title?: string;
      link?: string;
      pubDate?: string;
      contentSnippet?: string;
      content?: string;
      creator?: string;
      categories?: string[];
    }[] };
    
    // Limit articles per feed to prevent overwhelming the system
    const MAX_ARTICLES_PER_FEED = 25;
    const limitedItems = feed.items.slice(0, MAX_ARTICLES_PER_FEED);
    
    if (feed.items.length > MAX_ARTICLES_PER_FEED) {
      console.log(`Limited ${feedName} from ${feed.items.length} to ${MAX_ARTICLES_PER_FEED} articles`);
    }
    
    const result = {
      success: true,
      data: limitedItems.map((item: {
        title?: string;
        link?: string;
        pubDate?: string;
        contentSnippet?: string;
        content?: string;
        creator?: string;
        categories?: string[];
      }) => ({
        title: item.title || '',
        link: item.link || '',
        pubDate: item.pubDate || '',
        contentSnippet: item.contentSnippet || '',
        // Use LazyContent for large content fields to optimize memory
        content: item.content && item.content.length > 10000 
          ? new LazyContent(() => Promise.resolve(item.content || ''))
          : item.content || '',
        creator: item.creator || '',
        categories: item.categories || [],
        source: feedName
      })) as ParsedArticle[]
    };
    
    // Cache the result
    cacheRSSContent(cacheKey, JSON.stringify(result));
    
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error fetching RSS feed ${feedName}:`, error);
    
    // Handle specific XML parsing errors
    if (errorMessage.includes('Invalid character in entity name') || 
        errorMessage.includes('Line:') || 
        errorMessage.includes('Column:')) {
      console.log(`${feedName} has malformed XML, skipping feed`);
    }
    
    return { 
      success: false, 
      error: errorMessage,
      data: [] as ParsedArticle[]
    };
  }
}

export async function fetchAllFeeds(feeds: RSSFeed[] = RSS_FEEDS) {
  const enabledFeeds = feeds.filter(f => f.enabled);
  
  // Use performance-based prioritization instead of just priority
  const performancePrioritizedFeeds = getFeedsByPerformancePriority(enabledFeeds);
  
  console.log(`Performance-prioritized feeds: ${performancePrioritizedFeeds.map(f => `${f.name}(rel:${f.performance?.reliability || 'N/A'})`).join(', ')}`);
  
  // Use adaptive timeouts based on feed performance
  const results = await Promise.allSettled(
    performancePrioritizedFeeds.map(async (feed) => {
      const startTime = Date.now();
      const timeoutMs = feed.adaptiveTimeout || getAdaptiveTimeout(feed.id);
      
      try {
        const result = await fetchRSSFeed(feed.url, feed.name, timeoutMs);
        const responseTime = Date.now() - startTime;
        
        // Track performance
        trackFeedPerformance(feed.id, responseTime, result.success, undefined, result.error);
        
        return {
          ...feed,
          articles: result
        };
      } catch (error) {
        const responseTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // Track failed performance
        trackFeedPerformance(feed.id, responseTime, false, undefined, errorMessage);
        
        throw error;
      }
    })
  );

  // Restore original order based on input array
  const orderedResults = results.map((result, index) => ({
    feed: performancePrioritizedFeeds[index],
    status: result.status,
    articles: result.status === 'fulfilled' ? result.value.articles : { success: false, error: 'Promise rejected', data: [] },
    responseTime: result.status === 'fulfilled' ? Date.now() : null
  }));

  // Log performance metrics
  const successful = orderedResults.filter(r => r.status === 'fulfilled' && r.articles.success);
  const failed = orderedResults.filter(r => r.status === 'rejected' || !r.articles.success);
  
  console.log(`RSS Fetch Summary: ${successful.length}/${orderedResults.length} feeds successful`);
  if (failed.length > 0) {
    console.log(`Failed feeds: ${failed.map(f => f.feed.name).join(', ')}`);
  }

  return orderedResults;
}

/**
 * Enhanced RSS processing with smart content extraction and quality analysis
 */
export async function fetchAllFeedsWithEnhancement(
  feeds: RSSFeed[] = RSS_FEEDS,
  options: {
    enhanceContent?: boolean;
    maxArticlesPerFeed?: number;
    qualityThreshold?: number;
    parallelProcessing?: boolean;
  } = {}
): Promise<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  feeds: any[];
  enhancedContent?: ExtractedContent[];
  stats: {
    totalFeeds: number;
    successfulFeeds: number;
    totalArticles: number;
    enhancedArticles: number;
    averageQuality: number;
    processingTime: number;
  };
}> {
  const startTime = Date.now();
  const {
    enhanceContent = true,
    maxArticlesPerFeed = 25,
    qualityThreshold = 60,
    parallelProcessing = true
  } = options;

  console.log(`Starting enhanced RSS processing for ${feeds.length} feeds...`);

  // Step 1: Fetch RSS feeds (existing logic with optimizations)
  let orderedResults;
  if (parallelProcessing) {
    // Use existing fetchAllFeeds function for parallel processing
    orderedResults = await fetchAllFeeds(feeds);
  } else {
    // Sequential processing for reliability if needed
    const enabledFeeds = feeds.filter(f => f.enabled);
    const results = [];
    
    for (const feed of enabledFeeds) {
      const timeoutMs = 6000; // Consistent timeout
      const result = await fetchRSSFeed(feed.url, feed.name, timeoutMs);
      results.push({
        feed,
        status: result.success ? 'fulfilled' as const : 'rejected' as const,
        articles: result,
        responseTime: Date.now()
      });
    }
    orderedResults = results;
  }

  // Step 2: Aggregate all articles
  const allArticles = orderedResults
    .filter(result => result.articles.success)
    .flatMap(result => 
      result.articles.data
        .slice(0, maxArticlesPerFeed) // Limit per feed
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((article: any) => ({ ...article, feedName: result.feed.name }))
    );

  console.log(`Aggregated ${allArticles.length} articles from ${orderedResults.length} feeds`);

  let enhancedContent: ExtractedContent[] = [];
  let averageQuality = 0;

  // Step 3: Enhanced content extraction (if enabled)
  if (enhanceContent && allArticles.length > 0) {
    try {
      enhancedContent = await extractAndEnhanceContent(allArticles, {
        maxArticles: Math.min(50, allArticles.length), // Process up to 50 articles
        qualityThreshold,
        enhanceWithFullContent: true,
        minWordCount: 200
      });

      if (enhancedContent.length > 0) {
        averageQuality = enhancedContent.reduce((sum, content) => sum + content.quality.score, 0) / enhancedContent.length;
        console.log(`Enhanced ${enhancedContent.length} articles with average quality: ${averageQuality.toFixed(1)}`);
      }
    } catch (error) {
      console.error('Content enhancement failed:', error);
      // Continue without enhancement
    }
  }

  const processingTime = Date.now() - startTime;

  // Step 4: Calculate stats
  const successfulFeeds = orderedResults.filter(r => r.articles.success).length;
  const stats = {
    totalFeeds: orderedResults.length,
    successfulFeeds,
    totalArticles: allArticles.length,
    enhancedArticles: enhancedContent.length,
    averageQuality,
    processingTime
  };

  console.log(`RSS processing complete: ${stats.successfulFeeds}/${stats.totalFeeds} feeds, ${stats.enhancedArticles}/${stats.totalArticles} enhanced articles (${processingTime}ms)`);

  return {
    feeds: orderedResults,
    enhancedContent: enhancedContent.length > 0 ? enhancedContent : undefined,
    stats
  };
}

/**
 * Processes articles to validate and fix URLs
 */
export async function processAndValidateArticles(
  articles: ParsedArticle[], 
  options: { 
    validateURLs?: boolean; 
    fixBrokenLinks?: boolean;
    batchSize?: number;
    skipValidationPatterns?: string[];
  } = {}
): Promise<ParsedArticle[]> {
  const { 
    validateURLs = true, 
    fixBrokenLinks = true, 
    skipValidationPatterns = ['.pdf', 'mailto:', 'javascript:', '/amp/']
  } = options;

  if (!validateURLs) {
    return articles;
  }

  console.log(`Processing ${articles.length} articles for URL validation...`);

  // Step 1: Sanitize all URLs
  const sanitizedArticles = articles.map(article => ({
    ...article,
    link: sanitizeURL(article.link)
  })).filter(article => {
    // Remove articles with clearly invalid URLs
    if (!article.link || article.link.length < 10) {
      console.log(`Removed article with invalid URL: "${article.title}"`);
      return false;
    }
    
    // Skip articles matching exclusion patterns
    const shouldSkip = skipValidationPatterns.some(pattern => 
      article.link.toLowerCase().includes(pattern.toLowerCase())
    );
    
    if (shouldSkip) {
      console.log(`Skipped validation for: ${article.link}`);
    }
    
    return !shouldSkip;
  });

  if (sanitizedArticles.length === 0) {
    console.log('No articles left after sanitization');
    return [];
  }

  // Step 2: Validate URLs in batches
  const urlsToValidate = [...new Set(sanitizedArticles.map(a => a.link))];
  console.log(`Validating ${urlsToValidate.length} unique URLs...`);

  const validationResults = await validateURLsBatch(urlsToValidate, {
    batchSize: 20, // Increase batch size for faster processing
    timeout: 5000, // Reduce timeout to 5 seconds
    delayMs: 300, // Reduce delay between batches
    allowedStatusCodes: [200, 201, 202, 301, 302, 307, 308]
  });

  // Step 3: Filter articles with valid URLs
  let validArticles = filterValidURLs(sanitizedArticles, validationResults);
  
  console.log(`URL validation: ${sanitizedArticles.length} -> ${validArticles.length} articles`);

  // Step 4: Optional - attempt to fix broken URLs
  if (fixBrokenLinks && validArticles.length < sanitizedArticles.length * 0.7) {
    console.log('Many URLs failed validation, attempting to fix broken links...');
    
    const invalidArticles = sanitizedArticles.filter(article => 
      !validArticles.some(valid => valid.link === article.link)
    );

    const fixedArticles: ParsedArticle[] = [];
    
    for (const article of invalidArticles.slice(0, 5)) { // Limit fixes to prevent spam
      try {
        const domain = new URL(article.link).hostname;
        const fallbackUrl = getFallbackURL(article.link, domain);
        
        // Test the fallback URL
        const fallbackValidation = await validateURLsBatch([fallbackUrl], { batchSize: 1 });
        
        if (fallbackValidation[0]?.isValid) {
          console.log(`Fixed broken link: ${article.link} -> ${fallbackUrl}`);
          fixedArticles.push({
            ...article,
            link: fallbackUrl
          });
        }
      } catch {
        console.log(`Could not fix URL for article: ${article.title}`);
      }
    }
    
    validArticles = [...validArticles, ...fixedArticles];
  }

  // Step 5: Log results
  const removedCount = articles.length - validArticles.length;
  if (removedCount > 0) {
    console.log(`Removed ${removedCount} articles with broken or invalid URLs`);
    
    // Log some examples of removed URLs for debugging
    const invalidResults = validationResults.filter(r => !r.isValid).slice(0, 3);
    if (invalidResults.length > 0) {
      console.log('Sample invalid URLs:');
      invalidResults.forEach(result => {
        console.log(`  - ${result.url}: ${result.error}`);
      });
    }
  }

  return validArticles;
}

export function deduplicateArticles(articles: ParsedArticle[]): ParsedArticle[] {
  const seen = new Set<string>();
  return articles.filter(article => {
    const key = article.link || article.title;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function sortArticlesByDate(articles: ParsedArticle[]): ParsedArticle[] {
  return articles.sort((a, b) => {
    const dateA = new Date(a.pubDate).getTime();
    const dateB = new Date(b.pubDate).getTime();
    return dateB - dateA; // Most recent first
  });
}

export interface FilterResult {
  articles: ParsedArticle[];
  usedFallback: boolean;
  originalPeriod: string;
  fallbackPeriod?: string;
  fallbackMessage?: string;
}

export function filterArticlesByTimePeriod(articles: ParsedArticle[], timePeriod: TimePeriod, minArticlesNeeded: number = 3): FilterResult {
  const timePeriodOption = TIME_PERIOD_OPTIONS.find(option => option.value === timePeriod);
  if (!timePeriodOption) {
    console.warn(`Unknown time period: ${timePeriod}, returning all articles`);
    return { 
      articles, 
      usedFallback: false, 
      originalPeriod: timePeriod 
    };
  }

  const now = new Date();
  const cutoffTime = new Date(now.getTime() - (timePeriodOption.hours * 60 * 60 * 1000));

  const filteredArticles = articles.filter(article => {
    if (!article.pubDate) {
      console.log('Article without pubDate:', article.title);
      return false; // Skip articles without dates
    }
    
    const articleDate = new Date(article.pubDate);
    const isValid = !isNaN(articleDate.getTime());
    const isRecent = isValid && articleDate >= cutoffTime;
    
    if (!isValid) {
      console.log('Invalid date format:', article.pubDate, 'for article:', article.title);
      return false;
    }
    
    if (!isRecent) {
      const hoursAgo = (now.getTime() - articleDate.getTime()) / (1000 * 60 * 60);
      console.log(`Article too old: "${article.title}" published ${hoursAgo.toFixed(1)} hours ago (${article.pubDate})`);
    }
    
    return isRecent;
  });

  console.log(`Time filtering: ${articles.length} -> ${filteredArticles.length} (cutoff: ${cutoffTime.toISOString()}, period: ${timePeriodOption.label})`);
  
  // If sufficient articles found in the requested period, return them
  if (filteredArticles.length >= minArticlesNeeded) {
    console.log('Sample recent articles:');
    filteredArticles.slice(0, 3).forEach(article => {
      console.log(`  - "${article.title}" (${article.pubDate})`);
    });
    
    return { 
      articles: filteredArticles, 
      usedFallback: false, 
      originalPeriod: timePeriodOption.label 
    };
  }
  
  // If some articles found but not enough, note it for fallback
  if (filteredArticles.length > 0 && filteredArticles.length < minArticlesNeeded) {
    console.warn(`Found only ${filteredArticles.length} articles in ${timePeriodOption.label}, need at least ${minArticlesNeeded}. Attempting fallback to longer periods...`);
  }
  
  // Fallback: if no articles match, try incremental time periods
  if (articles.length > 0) {
    console.warn(`No articles found within ${timePeriodOption.label}. Trying incremental fallback periods...`);
    
    // Get current period index and try next periods incrementally
    const currentIndex = TIME_PERIOD_OPTIONS.findIndex(option => option.value === timePeriod);
    
    for (let i = currentIndex + 1; i < TIME_PERIOD_OPTIONS.length; i++) {
      const fallbackOption = TIME_PERIOD_OPTIONS[i];
      const fallbackCutoff = new Date(now.getTime() - (fallbackOption.hours * 60 * 60 * 1000));
      
      const fallbackArticles = articles.filter(article => {
        if (!article.pubDate) return false;
        const articleDate = new Date(article.pubDate);
        const isValid = !isNaN(articleDate.getTime());
        return isValid && articleDate >= fallbackCutoff;
      });
      
      if (fallbackArticles.length > 0) {
        console.log(`Found ${fallbackArticles.length} articles in fallback period: ${fallbackOption.label}`);
        
        // Sort by date and take up to 20 most recent
        const sortedFallback = fallbackArticles
          .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
          .slice(0, 20);
        
        console.log('Sample fallback articles:');
        sortedFallback.slice(0, 3).forEach(article => {
          const hoursAgo = (now.getTime() - new Date(article.pubDate).getTime()) / (1000 * 60 * 60);
          console.log(`  - "${article.title}" (${hoursAgo.toFixed(1)} hours ago)`);
        });
        
        return {
          articles: sortedFallback,
          usedFallback: true,
          originalPeriod: timePeriodOption.label,
          fallbackPeriod: fallbackOption.label,
          fallbackMessage: `No news found from the selected sources in the ${timePeriodOption.label.toLowerCase()}, showing news from the ${fallbackOption.label.toLowerCase()} instead.`
        };
      }
    }
    
    // If no incremental periods work, use the 20 most recent articles regardless of age
    console.warn(`No articles found in any incremental time period. Using 20 most recent articles as final fallback.`);
    
    const sortedByDate = articles
      .filter(article => article.pubDate && !isNaN(new Date(article.pubDate).getTime()))
      .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
      .slice(0, 20);
    
    if (sortedByDate.length > 0) {
      const oldestArticle = sortedByDate[sortedByDate.length - 1];
      const oldestHours = (now.getTime() - new Date(oldestArticle.pubDate).getTime()) / (1000 * 60 * 60);
      const timeDesc = oldestHours > 168 ? `${Math.round(oldestHours / 24)} days` : 
                       oldestHours > 24 ? `${Math.round(oldestHours / 24)} days` : 
                       `${Math.round(oldestHours)} hours`;
      
      console.log(`Final fallback: ${sortedByDate.length} most recent articles (up to ${timeDesc} old)`);
      
      return {
        articles: sortedByDate,
        usedFallback: true,
        originalPeriod: timePeriodOption.label,
        fallbackPeriod: `${timeDesc}`,
        fallbackMessage: `No recent news found from the selected sources in the ${timePeriodOption.label.toLowerCase()}, showing the most recent available news from the past ${timeDesc} instead.`
      };
    }
  }
  
  // No articles at all
  return { 
    articles: [], 
    usedFallback: false, 
    originalPeriod: timePeriodOption.label 
  };
}