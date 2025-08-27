export const RSS_FEEDS = [
  // Business Category - 3 best feeds
  {
    id: 'techcrunch-ai',
    name: 'TechCrunch AI',
    url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
    category: 'business',
    priority: 1,
    enabled: true
  },
  {
    id: 'marktech-post',
    name: 'MarkTechPost AI',
    url: 'https://marktechpost.com/feed',
    category: 'business',
    priority: 2,
    enabled: true
  },
  {
    id: 'venturebeat-ai',
    name: 'VentureBeat AI',
    url: 'https://venturebeat.com/category/ai/feed',
    category: 'business',
    priority: 3,
    enabled: true
  },

  // Technology Category - 3 best feeds
  {
    id: 'the-verge',
    name: 'The Verge',
    url: 'https://www.theverge.com/rss/index.xml',
    category: 'technology',
    priority: 4,
    enabled: true
  },
  {
    id: 'ieee-spectrum',
    name: 'IEEE Spectrum',
    url: 'https://spectrum.ieee.org/rss',
    category: 'technology',
    priority: 5,
    enabled: true
  },
  {
    id: 'wired-ai',
    name: 'WIRED AI',
    url: 'https://www.wired.com/feed/tag/ai/latest/rss',
    category: 'technology',
    priority: 6,
    enabled: true
  },

  // Research Category - 3 best feeds
  {
    id: 'mit-tech-review',
    name: 'MIT Technology Review',
    url: 'https://www.technologyreview.com/feed/',
    category: 'research',
    priority: 7,
    enabled: true
  },
  {
    id: 'nature-machine-intelligence',
    name: 'Nature Machine Intelligence',
    url: 'https://www.nature.com/natmachintell.rss',
    category: 'research',
    priority: 8,
    enabled: true
  },
  {
    id: 'arxiv-ai',
    name: 'arXiv AI Papers',
    url: 'https://rss.arxiv.org/rss/cs.AI',
    category: 'research',
    priority: 9,
    enabled: true
  },

  // Product Category - 3 best feeds
  {
    id: 'product-hunt',
    name: 'Product Hunt Daily',
    url: 'https://www.producthunt.com/feed',
    category: 'product',
    priority: 10,
    enabled: true
  },
  {
    id: 'ai-tools',
    name: 'AI News',
    url: 'https://artificialintelligence-news.com/feed/',
    category: 'product',
    priority: 11,
    enabled: true
  },
  {
    id: 'openai-blog',
    name: 'OpenAI Blog',
    url: 'https://openai.com/blog/rss.xml',
    category: 'product',
    priority: 12,
    enabled: true
  },

  // Enterprise Category - 3 best feeds
  {
    id: 'enterprise-ai-news',
    name: 'Enterprise AI News',
    url: 'https://www.enterpriseai.news/feed/',
    category: 'enterprise',
    priority: 13,
    enabled: true
  },
  {
    id: 'ai-business',
    name: 'AI Business',
    url: 'https://aibusiness.com/feed',
    category: 'enterprise',
    priority: 14,
    enabled: true
  },
  {
    id: 'techcrunch-enterprise',
    name: 'TechCrunch Enterprise',
    url: 'https://techcrunch.com/category/enterprise/feed/',
    category: 'enterprise',
    priority: 15,
    enabled: true
  },

  // Consumer Category - 3 best feeds
  {
    id: 'verge-ai',
    name: 'The Verge AI',
    url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
    category: 'consumer',
    priority: 16,
    enabled: true
  },
  {
    id: 'mashable-tech',
    name: 'Mashable Tech',
    url: 'https://mashable.com/feeds/rss/tech',
    category: 'consumer',
    priority: 17,
    enabled: true
  },
  {
    id: 'cnet-ai',
    name: 'CNET AI',
    url: 'https://www.cnet.com/rss/news/',
    category: 'consumer',
    priority: 18,
    enabled: true
  },

  // Security Category - 3 best feeds
  {
    id: 'dark-reading',
    name: 'Dark Reading',
    url: 'https://www.darkreading.com/rss.xml',
    category: 'security',
    priority: 19,
    enabled: true
  },
  {
    id: 'security-week',
    name: 'Security Week',
    url: 'https://www.securityweek.com/feed/',
    category: 'security',
    priority: 20,
    enabled: true
  },
  {
    id: 'ai-security-wire',
    name: 'AI Security Wire',
    url: 'https://www.aiwire.net/feed/',
    category: 'security',
    priority: 21,
    enabled: true
  },

  // Development Category - 3 best feeds
  {
    id: 'hacker-news',
    name: 'Hacker News',
    url: 'https://hnrss.org/newest',
    category: 'development',
    priority: 22,
    enabled: true
  },
  {
    id: 'github-blog',
    name: 'GitHub Blog',
    url: 'https://github.blog/feed/',
    category: 'development',
    priority: 23,
    enabled: true
  },
  {
    id: 'dev-to',
    name: 'DEV Community',
    url: 'https://dev.to/feed',
    category: 'development',
    priority: 24,
    enabled: true
  }
];

export type RSSFeed = typeof RSS_FEEDS[0];