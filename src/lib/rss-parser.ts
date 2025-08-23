import Parser from 'rss-parser';
import { RSS_FEEDS, type RSSFeed } from '@/config/rss-feeds';
import { 
  cacheRSSContent, 
  getCachedRSSContent, 
  createContentHash,
  LazyContent
} from '@/utils/cache-optimization';

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'AI Newsletter Bot 1.0',
  },
});

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