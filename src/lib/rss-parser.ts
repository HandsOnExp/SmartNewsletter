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

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'AI Newsletter Bot 1.0',
  },
});

// Time period options with their corresponding durations in hours
export const TIME_PERIOD_OPTIONS: TimePeriodOption[] = [
  { value: '1hour', label: 'Last Hour', description: 'Very recent articles', hours: 1 },
  { value: '6hours', label: 'Last 6 Hours', description: 'Latest updates', hours: 6 },
  { value: '12hours', label: 'Last 12 Hours', description: 'Half-day updates', hours: 12 },
  { value: '24hours', label: 'Last 24 Hours', description: 'Daily digest', hours: 24 },
  { value: '3days', label: 'Last 3 Days', description: 'Recent stories', hours: 72 },
  { value: '1week', label: 'Last Week', description: 'Weekly summary', hours: 168 },
  { value: '1month', label: 'Last Month', description: 'Monthly overview', hours: 720 }
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
    console.error(`Error fetching RSS feed ${feedName}:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      data: [] as ParsedArticle[]
    };
  }
}

export async function fetchAllFeeds(feeds: RSSFeed[] = RSS_FEEDS) {
  const enabledFeeds = feeds.filter(f => f.enabled);
  
  // Sort feeds by priority (higher priority = faster expected response)
  const prioritizedFeeds = enabledFeeds.sort((a, b) => b.priority - a.priority);
  
  // Use different timeouts based on feed priority
  const results = await Promise.allSettled(
    prioritizedFeeds.map(async (feed) => {
      const timeoutMs = feed.priority >= 3 ? 6000 : feed.priority >= 2 ? 8000 : 12000;
      const result = await fetchRSSFeed(feed.url, feed.name, timeoutMs);
      return {
        ...feed,
        articles: result
      };
    })
  );

  // Restore original order based on input array
  const orderedResults = results.map((result, index) => ({
    feed: prioritizedFeeds[index],
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
    batchSize = 10,
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
    batchSize,
    timeout: 8000,
    delayMs: 500, // Be gentle on servers
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