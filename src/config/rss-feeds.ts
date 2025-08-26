export const RSS_FEEDS = [
  // AI Category
  {
    id: 'rundown-ai',
    name: 'The Rundown AI',
    url: 'https://rss.beehiiv.com/feeds/2R3C6Bt5wj.xml',
    category: 'ai',
    priority: 1,
    enabled: true
  },
  {
    id: 'import-ai',
    name: 'Import AI',
    url: 'https://importai.substack.com/feed',
    category: 'ai',
    priority: 2,
    enabled: true
  },

  // Business Category
  {
    id: 'techcrunch-ai',
    name: 'TechCrunch AI',
    url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
    category: 'business',
    priority: 3,
    enabled: true
  },
  {
    id: 'business-insider-ai',
    name: 'Business Insider AI',
    url: 'https://www.businessinsider.com/sai/rss',
    category: 'business',
    priority: 4,
    enabled: true
  },

  // Technology Category  
  {
    id: 'ars-technica',
    name: 'Ars Technica',
    url: 'https://feeds.arstechnica.com/arstechnica/index',
    category: 'technology',
    priority: 5,
    enabled: true
  },
  {
    id: 'wired-ai',
    name: 'Wired AI',
    url: 'https://www.wired.com/feed/tag/ai/latest/rss',
    category: 'technology',
    priority: 6,
    enabled: true
  },

  // Research Category
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

  // Analysis Category
  {
    id: 'stratechery',
    name: 'Stratechery',
    url: 'https://stratechery.com/feed/',
    category: 'analysis',
    priority: 9,
    enabled: true
  },
  {
    id: 'benedict-evans',
    name: 'Benedict Evans',
    url: 'https://www.ben-evans.com/benedictevans?format=rss',
    category: 'analysis',
    priority: 10,
    enabled: true
  },

  // Product Category
  {
    id: 'product-hunt',
    name: 'Product Hunt Daily',
    url: 'https://www.producthunt.com/feed',
    category: 'product',
    priority: 11,
    enabled: true
  },
  {
    id: 'mind-the-product',
    name: 'Mind the Product',
    url: 'https://www.mindtheproduct.com/feed/',
    category: 'product',
    priority: 12,
    enabled: true
  },

  // Enterprise Category
  {
    id: 'venturebeat-ai',
    name: 'VentureBeat AI',
    url: 'https://venturebeat.com/category/ai/feed',
    category: 'enterprise',
    priority: 13,
    enabled: true
  },
  {
    id: 'enterprise-ai',
    name: 'Enterprise AI News',
    url: 'https://www.enterpriseai.news/feed/',
    category: 'enterprise',
    priority: 14,
    enabled: true
  },

  // Consumer Category
  {
    id: 'verge-ai',
    name: 'The Verge AI',
    url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
    category: 'consumer',
    priority: 15,
    enabled: true
  },
  {
    id: 'mashable-ai',
    name: 'Mashable AI',
    url: 'https://mashable.com/feeds/rss/tech',
    category: 'consumer',
    priority: 16,
    enabled: true
  },

  // Security Category
  {
    id: 'ai-security',
    name: 'AI Security News',
    url: 'https://www.darkreading.com/rss.xml',
    category: 'security',
    priority: 17,
    enabled: true
  },
  {
    id: 'cybersecurity-ai',
    name: 'Cybersecurity & AI',
    url: 'https://www.securityweek.com/feed/',
    category: 'security',
    priority: 18,
    enabled: true
  },

  // Development Category
  {
    id: 'hacker-news',
    name: 'Hacker News',
    url: 'https://hnrss.org/newest',
    category: 'development',
    priority: 19,
    enabled: true
  },
  {
    id: 'dev-to',
    name: 'Dev.to AI',
    url: 'https://dev.to/feed/tag/ai',
    category: 'development',
    priority: 20,
    enabled: true
  },

  // Innovation Category
  {
    id: 'fast-company-ai',
    name: 'Fast Company AI',
    url: 'https://www.fastcompany.com/section/artificial-intelligence/rss',
    category: 'innovation',
    priority: 21,
    enabled: true
  },
  {
    id: 'innovation-news',
    name: 'Innovation Excellence',
    url: 'https://www.innovationexcellence.com/feed/',
    category: 'innovation',
    priority: 22,
    enabled: true
  },

  // Policy Category
  {
    id: 'ai-policy',
    name: 'AI Policy News',
    url: 'https://www.brookings.edu/feed/',
    category: 'policy',
    priority: 23,
    enabled: true
  },
  {
    id: 'future-of-humanity',
    name: 'Future of Humanity Institute',
    url: 'https://www.fhi.ox.ac.uk/feed/',
    category: 'policy',
    priority: 24,
    enabled: true
  },

  // News Category
  {
    id: 'reuters-ai',
    name: 'Reuters AI',
    url: 'https://www.reuters.com/technology/artificial-intelligence/rss',
    category: 'news',
    priority: 25,
    enabled: true
  },
  {
    id: 'bbc-tech',
    name: 'BBC Technology',
    url: 'https://feeds.bbci.co.uk/news/technology/rss.xml',
    category: 'news',
    priority: 26,
    enabled: true
  }
];

export type RSSFeed = typeof RSS_FEEDS[0];