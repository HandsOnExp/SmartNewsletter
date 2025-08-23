import { NewsletterTopic } from '@/lib/ai-processors';

// RSS Feed Types
export interface RSSFeed {
  id: string;
  name: string;
  url: string;
  category: string;
  priority: number;
  enabled: boolean;
}

export interface ParsedArticle {
  title: string;
  link: string;
  pubDate: string;
  contentSnippet: string;
  content: string;
  creator: string;
  categories: string[];
  source: string;
}

// Newsletter Types
export interface Newsletter {
  _id: string;
  userId: string;
  title: string;
  date: Date;
  introduction?: string;
  topics: NewsletterTopic[];
  conclusion?: string;
  llmUsed: 'cohere' | 'gemini';
  status: 'draft' | 'published';
  rawContent?: string;
  formattedHtml?: string;
  stats: {
    sourcesAnalyzed: number;
    generationTime: number;
  };
  metadata?: {
    feedsUsed: string[];
    totalArticles: number;
    processingErrors: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

// Time period options for article filtering
export type TimePeriod = '1hour' | '6hours' | '12hours' | '24hours' | '3days' | '1week' | '1month';

export interface TimePeriodOption {
  value: TimePeriod;
  label: string;
  description: string;
  hours: number; // Duration in hours for filtering
}

// User Settings Types
export interface UserSettings {
  userId: string;
  apiKeys: {
    cohere: string;
    gemini: string;
  };
  preferences: {
    autoGenerate: boolean;
    generateTime: string;
    emailNotifications: boolean;
    llmPreference: 'cohere' | 'gemini' | 'auto';
    maxArticles: number;
    language: 'english' | 'hebrew' | 'spanish' | 'french' | 'german' | 'italian' | 'portuguese';
    timePeriod: TimePeriod;
  };
  rssFeeds: {
    enabled: string[];
    disabled: string[];
    custom: CustomRSSFeed[];
  };
}

export interface CustomRSSFeed {
  id: string;
  name: string;
  url: string;
  category: string;
  enabled: boolean;
}

// API Response Types
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface NewsletterGenerationResponse {
  success: boolean;
  newsletter?: {
    newsletterTitle: string;
    newsletterDate: string;
    introduction?: string;
    topics: NewsletterTopic[];
    conclusion?: string;
  };
  stats?: {
    articlesAnalyzed: number;
    generationTime: string;
    id: string;
  };
  fallbackNotification?: {
    usedFallback: boolean;
    originalPeriod: string;
    fallbackPeriod?: string;
    message?: string;
  };
  error?: string;
}

// Feed Analytics Types
export interface FeedAnalytics {
  feedId: string;
  date: Date;
  articlesCount: number;
  successfulFetch: boolean;
  responseTime?: number;
  error?: string;
  topArticles: {
    title: string;
    url: string;
    engagement: number;
  }[];
}

// Dashboard Stats Types
export interface DashboardStats {
  totalArticlesToday: number;
  newslettersGenerated: number;
  lastUpdateTime: string;
  averageGenerationTime: string;
  topSources: {
    name: string;
    count: number;
  }[];
  recentActivity: {
    type: 'generation' | 'feed_update' | 'error';
    message: string;
    timestamp: Date;
  }[];
}

// Component Props Types
export interface NewsletterPreviewProps {
  data: {
    newsletterTitle: string;
    newsletterDate: string;
    introduction?: string;
    topics: NewsletterTopic[];
    conclusion?: string;
  };
  onSave?: () => void;
  onPublish?: () => void;
  onClose?: () => void;
}

export interface RSSFeedManagerProps {
  feeds: RSSFeed[];
  onToggleFeed: (feedId: string, enabled: boolean) => void;
  onAddCustomFeed: (feed: CustomRSSFeed) => void;
  onRemoveCustomFeed: (feedId: string) => void;
}

// Form Types
export interface NewsletterGenerationForm {
  llmProvider: 'cohere' | 'gemini';
  includedFeeds: string[];
  customPrompt?: string;
  maxTopics?: number;
}

export interface SettingsForm {
  apiKeys: {
    cohere: string;
    gemini: string;
  };
  preferences: {
    autoGenerate: boolean;
    generateTime: string;
    emailNotifications: boolean;
    llmPreference: 'cohere' | 'gemini' | 'auto';
    maxArticles: number;
    language: 'english' | 'hebrew' | 'spanish' | 'french' | 'german' | 'italian' | 'portuguese';
  };
}

// Error Types
export interface AppError {
  code: string;
  message: string;
  details?: unknown;
  timestamp: Date;
}

export interface FeedError {
  feedId: string;
  feedName: string;
  error: string;
  timestamp: Date;
  retryCount: number;
}