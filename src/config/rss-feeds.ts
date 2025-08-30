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
    id: 'ieee-spectrum-ai',
    name: 'IEEE Spectrum AI',
    url: 'https://spectrum.ieee.org/feeds/topic/artificial-intelligence.rss',
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

  // Research Category - 3 highest quality, most frequently updated feeds
  {
    id: 'google-ai-blog',
    name: 'Google AI Blog',
    url: 'http://feeds.feedburner.com/blogspot/gJZg',
    category: 'research',
    priority: 5,
    enabled: true
  },
  {
    id: 'mit-tech-review-ai',
    name: 'MIT Technology Review AI',
    url: 'https://www.technologyreview.com/feed/',
    category: 'research',
    priority: 6,
    enabled: true
  },
  {
    id: 'distill-pub',
    name: 'Distill Machine Learning Research',
    url: 'https://distill.pub/rss.xml',
    category: 'research',
    priority: 7,
    enabled: true
  },

  // Product Category - 2 highest quality, most frequently updated feeds
  {
    id: 'openai-blog',
    name: 'OpenAI Blog',
    url: 'https://openai.com/blog/rss.xml',
    category: 'product',
    priority: 8,
    enabled: true
  },
  {
    id: 'marktechpost',
    name: 'MarkTechPost',
    url: 'https://marktechpost.com/feed/',
    category: 'product',
    priority: 9,
    enabled: true
  },

  // Enterprise Category - 2 highest quality, most frequently updated feeds
  {
    id: 'nvidia-ai-blog',
    name: 'NVIDIA AI Blog',
    url: 'https://blogs.nvidia.com/feed/',
    category: 'enterprise',
    priority: 10,
    enabled: true
  },
  {
    id: 'ai-business',
    name: 'AI Business',
    url: 'https://aibusiness.com/rss.xml',
    category: 'enterprise', 
    priority: 11,
    enabled: true
  },

  // Consumer Category - 3 highest quality, most frequently updated feeds
  {
    id: 'ai-news',
    name: 'AI News',
    url: 'https://www.artificialintelligence-news.com/feed/rss/',
    category: 'consumer',
    priority: 12,
    enabled: true
  },
  {
    id: 'unite-ai',
    name: 'Unite.AI',
    url: 'https://www.unite.ai/feed/',
    category: 'consumer',
    priority: 13,
    enabled: true
  },
  {
    id: 'infoworld-ai',
    name: 'InfoWorld AI',
    url: 'https://www.infoworld.com/category/artificial-intelligence/rss',
    category: 'consumer',
    priority: 14,
    enabled: true
  },

  // Security Category - 2 highest quality, most frequently updated feeds
  {
    id: 'dark-reading',
    name: 'Dark Reading',
    url: 'https://www.darkreading.com/rss.xml',
    category: 'security',
    priority: 15,
    enabled: true
  },
  {
    id: 'security-week',
    name: 'Security Week',
    url: 'https://www.securityweek.com/feed/',
    category: 'security',
    priority: 16,
    enabled: true
  },

  // Development Category - 2 highest quality, most frequently updated feeds
  {
    id: 'hacker-news',
    name: 'Hacker News',
    url: 'https://hnrss.org/newest',
    category: 'development',
    priority: 17,
    enabled: true
  },
  {
    id: 'dev-to',
    name: 'DEV Community',
    url: 'https://dev.to/feed',
    category: 'development',
    priority: 18,
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