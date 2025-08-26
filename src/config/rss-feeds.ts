export const RSS_FEEDS = [

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
    id: 'axios-tech',
    name: 'Axios Technology',
    url: 'https://api.axios.com/feed/technology',
    category: 'business',
    priority: 4,
    enabled: true
  },

  // Technology Category  
  {
    id: 'the-verge',
    name: 'The Verge',
    url: 'https://www.theverge.com/rss/index.xml',
    category: 'technology',
    priority: 5,
    enabled: true
  },
  {
    id: 'ieee-spectrum',
    name: 'IEEE Spectrum',
    url: 'https://spectrum.ieee.org/rss',
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
  {
    id: 'arxiv-ai',
    name: 'ArXiv AI',
    url: 'https://rss.arxiv.org/rss/cs.AI',
    category: 'research',
    priority: 9,
    enabled: true
  },
  {
    id: 'google-ai-blog',
    name: 'Google AI Blog',
    url: 'https://ai.googleblog.com/feeds/posts/default',
    category: 'research',
    priority: 10,
    enabled: true
  },
  {
    id: 'openai-blog',
    name: 'OpenAI Blog',
    url: 'https://openai.com/blog/rss.xml',
    category: 'research',
    priority: 11,
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
  {
    id: 'cio-ai',
    name: 'CIO AI',
    url: 'https://www.cio.com/feed/',
    category: 'enterprise',
    priority: 15,
    enabled: false // Disabled due to Korean language content and parsing errors
  },
  {
    id: 'computerworld-ai',
    name: 'Computerworld AI',
    url: 'https://www.computerworld.com/category/artificial-intelligence/rss',
    category: 'enterprise',
    priority: 16,
    enabled: false // Disabled due to XML parsing errors and potential foreign language content
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
    id: 'techcrunch-startups',
    name: 'TechCrunch Startups',
    url: 'https://techcrunch.com/category/startups/feed/',
    category: 'innovation',
    priority: 22,
    enabled: true
  },
  {
    id: 'tech-republic',
    name: 'TechRepublic',
    url: 'https://www.techrepublic.com/rssfeeds/articles/',
    category: 'innovation',
    priority: 23,
    enabled: true
  },
  {
    id: 'zdnet-innovation',
    name: 'ZDNet Innovation',
    url: 'https://www.zdnet.com/topic/innovation/rss.xml',
    category: 'innovation',
    priority: 24,
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
    id: 'ai-policy-institute',
    name: 'AI Policy Institute',
    url: 'https://www.aipolicyinstitute.org/feed/',
    category: 'policy',
    priority: 24,
    enabled: true
  },
  {
    id: 'governance-ai',
    name: 'Governance AI',
    url: 'https://www.governance.ai/feed/',
    category: 'policy',
    priority: 25,
    enabled: true
  },

  // News Category
  {
    id: 'ap-technology',
    name: 'Associated Press Technology',
    url: 'https://apnews.com/rss/Technology',
    category: 'news',
    priority: 25,
    enabled: true
  },
  {
    id: 'ai-news',
    name: 'AI News',
    url: 'https://artificialintelligence-news.com/feed/',
    category: 'news',
    priority: 26,
    enabled: true
  },
  {
    id: 'bbc-tech',
    name: 'BBC Technology',
    url: 'https://feeds.bbci.co.uk/news/technology/rss.xml',
    category: 'news',
    priority: 27,
    enabled: true
  },

  // Additional feeds for better category coverage
  
  // More Business feeds (disabled to reduce AI content overload)
  {
    id: 'wsj-tech',
    name: 'Wall Street Journal Tech',
    url: 'https://feeds.a.dj.com/rss/RSSWSJD.xml',
    category: 'business',
    priority: 28,
    enabled: false
  },
  {
    id: 'bloomberg-tech',
    name: 'Bloomberg Technology',
    url: 'https://feeds.bloomberg.com/technology/news.rss',
    category: 'business',
    priority: 29,
    enabled: false
  },

  // More Technology feeds (keep Engadget, disable others to reduce AI overload)
  {
    id: 'engadget',
    name: 'Engadget',
    url: 'https://www.engadget.com/rss.xml',
    category: 'technology',
    priority: 30,
    enabled: false
  },
  {
    id: 'ars-technica',
    name: 'Ars Technica',
    url: 'https://feeds.arstechnica.com/arstechnica/index',
    category: 'technology',
    priority: 31,
    enabled: false
  },

  // More Research feeds (disabled to reduce AI content overload)
  {
    id: 'deepmind-blog',
    name: 'DeepMind Blog',
    url: 'https://deepmind.com/blog/feed/basic/',
    category: 'research',
    priority: 32,
    enabled: false
  },
  {
    id: 'distill-pub',
    name: 'Distill',
    url: 'https://distill.pub/rss.xml',
    category: 'research',
    priority: 33,
    enabled: false
  },

  // More Product feeds (disabled to reduce AI content overload)
  {
    id: 'product-coalition',
    name: 'Product Coalition',
    url: 'https://productcoalition.com/feed',
    category: 'product',
    priority: 34,
    enabled: false
  },
  {
    id: 'first-round-review',
    name: 'First Round Review',
    url: 'https://review.firstround.com/rss',
    category: 'product',
    priority: 35,
    enabled: false
  },

  // More Security feeds (disabled to reduce AI content overload)
  {
    id: 'krebs-security',
    name: 'Krebs on Security',
    url: 'https://krebsonsecurity.com/feed/',
    category: 'security',
    priority: 36,
    enabled: false
  },
  {
    id: 'threatpost',
    name: 'Threatpost',
    url: 'https://threatpost.com/feed/',
    category: 'security',
    priority: 37,
    enabled: false
  },

  // More Development feeds (keep these active for user's selected category)
  {
    id: 'github-blog',
    name: 'GitHub Blog',
    url: 'https://github.blog/feed/',
    category: 'development',
    priority: 38,
    enabled: true
  },
  {
    id: 'stack-overflow-blog',
    name: 'Stack Overflow Blog',
    url: 'https://stackoverflow.blog/feed/',
    category: 'development',
    priority: 39,
    enabled: false
  },

  // More Analysis feeds (disabled to reduce AI content overload)
  {
    id: 'a16z-future',
    name: 'Andreessen Horowitz Future',
    url: 'https://future.a16z.com/feed/',
    category: 'analysis',
    priority: 40,
    enabled: false
  },
  {
    id: 'cb-insights',
    name: 'CB Insights',
    url: 'https://www.cbinsights.com/research/rss',
    category: 'analysis',
    priority: 41,
    enabled: false
  },

  // More Enterprise feeds (disabled to reduce AI content overload)
  {
    id: 'harvard-business-review-tech',
    name: 'Harvard Business Review Tech',
    url: 'https://feeds.hbr.org/harvardbusiness/technology',
    category: 'enterprise',
    priority: 42,
    enabled: false
  },
  {
    id: 'mit-sloan-tech',
    name: 'MIT Sloan Management Review Tech',
    url: 'https://sloanreview.mit.edu/topic/technology/feed/',
    category: 'enterprise',
    priority: 43,
    enabled: false
  },

  // More Consumer feeds (disabled to reduce AI content overload)
  {
    id: 'pcworld',
    name: 'PCWorld',
    url: 'https://www.pcworld.com/index.rss',
    category: 'consumer',
    priority: 44,
    enabled: false
  },
  {
    id: 'cnet',
    name: 'CNET',
    url: 'https://www.cnet.com/rss/news/',
    category: 'consumer',
    priority: 45,
    enabled: false
  },

  // More Innovation feeds (keep Digital Trends for user's selected category)
  {
    id: 'digital-trends',
    name: 'Digital Trends',
    url: 'https://www.digitaltrends.com/feed/',
    category: 'innovation',
    priority: 46,
    enabled: true
  },
  {
    id: 'next-big-future',
    name: 'Next Big Future',
    url: 'https://www.nextbigfuture.com/feed',
    category: 'innovation',
    priority: 47,
    enabled: false
  }
];

export type RSSFeed = typeof RSS_FEEDS[0];