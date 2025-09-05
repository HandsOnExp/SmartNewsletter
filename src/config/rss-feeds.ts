export const RSS_FEEDS = [
  // Business Category - Balanced priorities to prevent single-source dominance
  {
    id: 'techcrunch-ai',
    name: 'TechCrunch AI',
    url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
    category: 'business',
    priority: 3,
    enabled: true
  },
  {
    id: 'venturebeat-ai',
    name: 'VentureBeat AI',
    url: 'https://venturebeat.com/ai/feed/',
    category: 'business',
    priority: 2, // High priority reliable business source
    enabled: true
  },
  {
    id: 'enterprise-ai-news',
    name: 'Enterprise AI News',
    url: 'https://www.enterpriseai.news/feed/',
    category: 'business',
    priority: 4, // Backup business source
    enabled: true
  },

  // Technology Category - Premium sources get higher priority
  {
    id: 'ieee-spectrum-ai',
    name: 'IEEE Spectrum AI',
    url: 'https://spectrum.ieee.org/feeds/topic/artificial-intelligence.rss',
    category: 'technology',
    priority: 1, // Moved to highest priority - academic/professional source
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

  // Research Category - High-quality research sources
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
  {
    id: 'distill-pub',
    name: 'Distill Machine Learning Research',
    url: 'https://distill.pub/rss.xml',
    category: 'research',
    priority: 7,
    enabled: true
  },

  // Product Category - Company blogs and product news
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

  // Enterprise Category - Business and enterprise focus
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

  // Consumer Category - General audience content
  {
    id: 'ai-news',
    name: 'AI News',
    url: 'https://www.artificialintelligence-news.com/feed/rss/',
    category: 'consumer',
    priority: 12,
    enabled: true
  },
  {
    id: 'analytics-india-ai',
    name: 'Analytics India Magazine AI',
    url: 'https://analyticsindiamag.com/feed/',
    category: 'consumer',
    priority: 18, // Reduced priority due to reliability issues
    enabled: true
  },

  // Security Category - Cybersecurity and AI safety
  {
    id: 'dark-reading',
    name: 'Dark Reading',
    url: 'https://www.darkreading.com/rss.xml',
    category: 'security',
    priority: 16,
    enabled: true
  },
  {
    id: 'security-week',
    name: 'Security Week',
    url: 'https://www.securityweek.com/feed/',
    category: 'security',
    priority: 17,
    enabled: true
  },

  // Development Category - Developer-focused content
  {
    id: 'hacker-news',
    name: 'Hacker News',
    url: 'https://hnrss.org/newest',
    category: 'development',
    priority: 18,
    enabled: true
  },
  {
    id: 'dev-to',
    name: 'DEV Community',
    url: 'https://dev.to/feed',
    category: 'development',
    priority: 19,
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