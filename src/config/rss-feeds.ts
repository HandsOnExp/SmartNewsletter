export const RSS_FEEDS = [
  // Business Category - 2 highest quality, most frequently updated feeds
  {
    id: 'techcrunch-ai',
    name: 'TechCrunch AI',
    url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
    category: 'business',
    priority: 1,
    enabled: true
  },
  {
    id: 'fastcompany-ai',
    name: 'Fast Company AI',
    url: 'https://www.fastcompany.com/section/ai/rss',
    category: 'business',
    priority: 2,
    enabled: true
  },

  // Technology Category - 2 highest quality, most frequently updated feeds
  {
    id: 'the-verge',
    name: 'The Verge',
    url: 'https://www.theverge.com/rss/index.xml',
    category: 'technology',
    priority: 3,
    enabled: true
  },
  {
    id: 'wired-ai',
    name: 'WIRED AI',
    url: 'https://www.wired.com/feed/tag/ai/latest/rss',
    category: 'technology',
    priority: 4,
    enabled: true
  },

  // Research Category - 2 highest quality, most frequently updated feeds
  {
    id: 'google-ai-blog',
    name: 'Google AI Blog',
    url: 'http://feeds.feedburner.com/blogspot/gJZg',
    category: 'research',
    priority: 5,
    enabled: true
  },
  {
    id: 'arxiv-ai',
    name: 'arXiv AI Papers',
    url: 'https://rss.arxiv.org/rss/cs.AI',
    category: 'research',
    priority: 6,
    enabled: true
  },

  // Product Category - 2 highest quality, most frequently updated feeds
  {
    id: 'openai-blog',
    name: 'OpenAI Blog',
    url: 'https://openai.com/blog/rss.xml',
    category: 'product',
    priority: 7,
    enabled: true
  },
  {
    id: 'marktechpost',
    name: 'MarkTechPost',
    url: 'https://marktechpost.com/feed/',
    category: 'product',
    priority: 8,
    enabled: true
  },

  // Enterprise Category - 2 highest quality, most frequently updated feeds
  {
    id: 'nvidia-ai-blog',
    name: 'NVIDIA AI Blog',
    url: 'https://blogs.nvidia.com/feed/',
    category: 'enterprise',
    priority: 9,
    enabled: true
  },
  {
    id: 'ai-business',
    name: 'AI Business',
    url: 'https://aibusiness.com/rss.xml',
    category: 'enterprise', 
    priority: 10,
    enabled: true
  },

  // Consumer Category - 2 highest quality, most frequently updated feeds
  {
    id: 'verge-ai',
    name: 'The Verge AI',
    url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
    category: 'consumer',
    priority: 11,
    enabled: true
  },
  {
    id: 'venturebeat-ai',
    name: 'VentureBeat AI',
    url: 'https://venturebeat.com/ai/feed/',
    category: 'consumer',
    priority: 12,
    enabled: true
  },

  // Security Category - 2 highest quality, most frequently updated feeds
  {
    id: 'dark-reading',
    name: 'Dark Reading',
    url: 'https://www.darkreading.com/rss.xml',
    category: 'security',
    priority: 13,
    enabled: true
  },
  {
    id: 'security-week',
    name: 'Security Week',
    url: 'https://www.securityweek.com/feed/',
    category: 'security',
    priority: 14,
    enabled: true
  },

  // Development Category - 2 highest quality, most frequently updated feeds
  {
    id: 'hacker-news',
    name: 'Hacker News',
    url: 'https://hnrss.org/newest',
    category: 'development',
    priority: 15,
    enabled: true
  },
  {
    id: 'dev-to',
    name: 'DEV Community',
    url: 'https://dev.to/feed',
    category: 'development',
    priority: 16,
    enabled: true
  }
];

export type RSSFeed = typeof RSS_FEEDS[0];

export interface RSSFeedPerformance {
  feedId: string;
  averageResponseTime: number;
  successRate: number;
  lastChecked: Date;
  contentQuality: number;
  reliability: number; // 0-100
}

// Enhanced RSS feed interface
export interface EnhancedRSSFeed extends RSSFeed {
  performance?: RSSFeedPerformance;
  adaptiveTimeout?: number;
  qualityMultiplier?: number;
}