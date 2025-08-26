export const RSS_FEEDS = [
  // Business Category - 2 best feeds
  {
    id: 'techcrunch-ai',
    name: 'TechCrunch AI',
    url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
    category: 'business',
    priority: 1,
    enabled: true
  },
  {
    id: 'axios-tech',
    name: 'Axios Technology',
    url: 'https://api.axios.com/feed/technology',
    category: 'business',
    priority: 2,
    enabled: true
  },

  // Technology Category - 2 best feeds
  {
    id: 'the-verge',
    name: 'The Verge',
    url: 'https://www.theverge.com/rss/index.xml',
    category: 'technology',
    priority: 3,
    enabled: true
  },
  {
    id: 'ieee-spectrum',
    name: 'IEEE Spectrum',
    url: 'https://spectrum.ieee.org/rss',
    category: 'technology',
    priority: 4,
    enabled: true
  },

  // Research Category - 2 best feeds
  {
    id: 'mit-tech-review',
    name: 'MIT Technology Review',
    url: 'https://www.technologyreview.com/feed/',
    category: 'research',
    priority: 5,
    enabled: true
  },
  {
    id: 'google-ai-blog',
    name: 'Google AI Blog',
    url: 'https://ai.googleblog.com/feeds/posts/default',
    category: 'research',
    priority: 6,
    enabled: true
  },

  // Analysis Category - 2 best feeds
  {
    id: 'stratechery',
    name: 'Stratechery',
    url: 'https://stratechery.com/feed/',
    category: 'analysis',
    priority: 7,
    enabled: true
  },
  {
    id: 'benedict-evans',
    name: 'Benedict Evans',
    url: 'https://www.ben-evans.com/benedictevans?format=rss',
    category: 'analysis',
    priority: 8,
    enabled: true
  },

  // Product Category - 2 best feeds
  {
    id: 'product-hunt',
    name: 'Product Hunt Daily',
    url: 'https://www.producthunt.com/feed',
    category: 'product',
    priority: 9,
    enabled: true
  },
  {
    id: 'mind-the-product',
    name: 'Mind the Product',
    url: 'https://www.mindtheproduct.com/feed/',
    category: 'product',
    priority: 10,
    enabled: true
  },

  // Enterprise Category - 2 best feeds
  {
    id: 'venturebeat-ai',
    name: 'VentureBeat AI',
    url: 'https://venturebeat.com/category/ai/feed',
    category: 'enterprise',
    priority: 11,
    enabled: true
  },
  {
    id: 'enterprise-ai',
    name: 'Enterprise AI News',
    url: 'https://www.enterpriseai.news/feed/',
    category: 'enterprise',
    priority: 12,
    enabled: true
  },

  // Consumer Category - 2 best feeds
  {
    id: 'verge-ai',
    name: 'The Verge AI',
    url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
    category: 'consumer',
    priority: 13,
    enabled: true
  },
  {
    id: 'mashable-ai',
    name: 'Mashable AI',
    url: 'https://mashable.com/feeds/rss/tech',
    category: 'consumer',
    priority: 14,
    enabled: true
  },

  // Security Category - 2 best feeds
  {
    id: 'ai-security',
    name: 'AI Security News',
    url: 'https://www.darkreading.com/rss.xml',
    category: 'security',
    priority: 15,
    enabled: true
  },
  {
    id: 'cybersecurity-ai',
    name: 'Cybersecurity & AI',
    url: 'https://www.securityweek.com/feed/',
    category: 'security',
    priority: 16,
    enabled: true
  },

  // Development Category - 2 best feeds
  {
    id: 'hacker-news',
    name: 'Hacker News',
    url: 'https://hnrss.org/newest',
    category: 'development',
    priority: 17,
    enabled: true
  },
  {
    id: 'github-blog',
    name: 'GitHub Blog',
    url: 'https://github.blog/feed/',
    category: 'development',
    priority: 18,
    enabled: true
  },

  // Innovation Category - 2 best feeds
  {
    id: 'fast-company-ai',
    name: 'Fast Company AI',
    url: 'https://www.fastcompany.com/section/artificial-intelligence/rss',
    category: 'innovation',
    priority: 19,
    enabled: true
  },
  {
    id: 'techcrunch-startups',
    name: 'TechCrunch Startups',
    url: 'https://techcrunch.com/category/startups/feed/',
    category: 'innovation',
    priority: 20,
    enabled: true
  },

  // Policy Category - 2 best feeds
  {
    id: 'ai-policy',
    name: 'AI Policy News',
    url: 'https://www.brookings.edu/feed/',
    category: 'policy',
    priority: 21,
    enabled: true
  },
  {
    id: 'ai-policy-institute',
    name: 'AI Policy Institute',
    url: 'https://www.aipolicyinstitute.org/feed/',
    category: 'policy',
    priority: 22,
    enabled: true
  },

  // News Category - 2 best feeds
  {
    id: 'bbc-tech',
    name: 'BBC Technology',
    url: 'https://feeds.bbci.co.uk/news/technology/rss.xml',
    category: 'news',
    priority: 23,
    enabled: true
  },
  {
    id: 'ap-technology',
    name: 'Associated Press Technology',
    url: 'https://apnews.com/rss/Technology',
    category: 'news',
    priority: 24,
    enabled: true
  }
];

export type RSSFeed = typeof RSS_FEEDS[0];