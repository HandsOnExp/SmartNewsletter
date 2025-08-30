// RSS Feeds Blacklist - Feeds that require subscriptions or are problematic
export const BLACKLISTED_FEEDS = [
  {
    id: 'fastcompany-ai',
    name: 'Fast Company AI',
    url: 'https://www.fastcompany.com/section/ai/rss',
    reason: 'Requires subscription',
    dateBlacklisted: '2025-08-30',
    category: 'business'
  },
  {
    id: 'mit-tech-review-ai',
    name: 'MIT Technology Review AI',
    url: 'https://www.technologyreview.com/feed/',
    reason: 'Requires subscription',
    dateBlacklisted: '2025-08-30',
    category: 'research'
  },
  {
    id: 'unite-ai',
    name: 'Unite.AI',
    url: 'https://www.unite.ai/feed/',
    reason: 'RSS feed disabled',
    dateBlacklisted: '2025-08-30',
    category: 'consumer'
  },
  {
    id: 'zdnet-ai',
    name: 'ZDNet AI',
    url: 'https://www.zdnet.com/topic/artificial-intelligence/rss.xml',
    reason: 'Access restricted',
    dateBlacklisted: '2025-08-30',
    category: 'consumer'
  },
  {
    id: 'venturebeat-ai',
    name: 'VentureBeat AI',
    url: 'https://venturebeat.com/ai/feed/',
    reason: 'Requires subscription',
    dateBlacklisted: '2025-08-30',
    category: 'business'
  }
];

export interface BlacklistedFeed {
  id: string;
  name: string;
  url: string;
  reason: string;
  dateBlacklisted: string;
  category: string;
}

// Check if a feed is blacklisted
export function isFeedBlacklisted(feedId: string): boolean {
  return BLACKLISTED_FEEDS.some(feed => feed.id === feedId);
}

// Check if a URL is blacklisted
export function isUrlBlacklisted(url: string): boolean {
  return BLACKLISTED_FEEDS.some(feed => feed.url === url);
}