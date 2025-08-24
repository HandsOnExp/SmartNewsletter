import Parser from 'rss-parser';
import { RSS_FEEDS, type RSSFeed } from '@/config/rss-feeds';
import { 
  cacheRSSContent, 
  getCachedRSSContent, 
  createContentHash,
  LazyContent
} from '@/utils/cache-optimization';
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

export async function fetchRSSFeed(url: string, feedName: string) {
  try {
    // Check cache first
    const cacheKey = createContentHash(`${url}:${feedName}`);
    const cachedContent = getCachedRSSContent(cacheKey);
    
    if (cachedContent) {
      console.log(`Using cached RSS feed for ${feedName}`);
      return JSON.parse(cachedContent);
    }
    
    const feed = await parser.parseURL(url);
    const result = {
      success: true,
      data: feed.items.map(item => ({
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
  
  const results = await Promise.allSettled(
    enabledFeeds.map(async (feed) => {
      const result = await fetchRSSFeed(feed.url, feed.name);
      return {
        ...feed,
        articles: result
      };
    })
  );

  return results.map((result, index) => ({
    feed: enabledFeeds[index],
    status: result.status,
    articles: result.status === 'fulfilled' ? result.value.articles : { success: false, error: 'Promise rejected', data: [] }
  }));
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