export const RSS_FEEDS = [
  {
    id: 'rundown-ai',
    name: 'The Rundown AI',
    url: 'https://rss.beehiiv.com/feeds/2R3C6Bt5wj.xml',
    category: 'daily-digest',
    priority: 1,
    enabled: true
  },
  {
    id: 'ai-weirdness',
    name: 'AI Weirdness',
    url: 'https://www.aiweirdness.com/rss/',
    category: 'entertainment',
    priority: 2,
    enabled: true
  },
  {
    id: 'techcrunch-ai',
    name: 'TechCrunch AI',
    url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
    category: 'business',
    priority: 3,
    enabled: true
  },
  {
    id: 'verge-ai',
    name: 'The Verge AI',
    url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
    category: 'consumer',
    priority: 4,
    enabled: true
  },
  {
    id: 'venturebeat-ai',
    name: 'VentureBeat AI',
    url: 'https://venturebeat.com/category/ai/feed',
    category: 'enterprise',
    priority: 5,
    enabled: true
  },
  {
    id: 'mit-tech-review',
    name: 'MIT Technology Review',
    url: 'https://www.technologyreview.com/feed/',
    category: 'research',
    priority: 6,
    enabled: true
  },
  {
    id: 'import-ai',
    name: 'Import AI',
    url: 'https://importai.substack.com/feed',
    category: 'analysis',
    priority: 7,
    enabled: true
  }
];

export type RSSFeed = typeof RSS_FEEDS[0];