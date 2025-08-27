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
    id: 'venturebeat-ai',
    name: 'VentureBeat AI',
    url: 'https://venturebeat.com/category/ai/feed',
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
    id: 'mit-tech-review',
    name: 'MIT Technology Review',
    url: 'https://www.technologyreview.com/feed/',
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
    id: 'ai-tools',
    name: 'AI News',
    url: 'https://artificialintelligence-news.com/feed/',
    category: 'product',
    priority: 8,
    enabled: true
  },

  // Enterprise Category - 2 highest quality, most frequently updated feeds
  {
    id: 'enterprise-ai-news',
    name: 'Enterprise AI News',
    url: 'https://www.enterpriseai.news/feed/',
    category: 'enterprise',
    priority: 9,
    enabled: true
  },
  {
    id: 'ai-business',
    name: 'AI Business',
    url: 'https://aibusiness.com/feed',
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
    id: 'cnet-ai',
    name: 'CNET AI',
    url: 'https://www.cnet.com/rss/news/',
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