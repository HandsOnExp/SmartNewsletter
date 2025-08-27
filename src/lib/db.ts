import mongoose from 'mongoose';
import { NewsletterTopic } from './ai-processors';
import { encryptApiKeys, decryptApiKeys } from './crypto';
import { validateAndNormalizeTopics } from './category-manager';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.warn('MONGODB_URI not found. Database features will be disabled.');
}

// Global mongoose instance for Next.js with enhanced connection pooling
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export async function connectDB() {
  if (!MONGODB_URI) {
    console.warn('MongoDB not configured, skipping connection');
    return null;
  }

  if (cached.conn) {
    // Check if connection is still alive
    if (mongoose.connection.readyState === 1) {
      return cached.conn;
    }
    // If connection is dead, reset cache
    cached.conn = null;
    cached.promise = null;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      // Enhanced connection pooling options
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      family: 4, // Use IPv4, skip trying IPv6
      // Connection pool monitoring
      maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
      waitQueueTimeoutMS: 5000, // Timeout waiting for connections from pool
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongooseInstance) => {
      console.log('MongoDB connected with enhanced pooling');
      
      // Add connection event listeners for monitoring
      mongoose.connection.on('error', (err) => {
        console.error('MongoDB connection error:', err);
      });
      
      mongoose.connection.on('disconnected', () => {
        console.warn('MongoDB disconnected');
        cached.conn = null;
        cached.promise = null;
      });
      
      return mongooseInstance;
    });
  }
  
  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    console.error('MongoDB connection failed:', e);
    return null;
  }

  return cached.conn;
}

// Connection health check utility
export function getConnectionStatus() {
  return {
    isConnected: mongoose.connection.readyState === 1,
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host,
    name: mongoose.connection.name,
    collections: Object.keys(mongoose.connection.collections)
  };
}

// Newsletter Schema
const NewsletterSchema = new mongoose.Schema({
  userId: { 
    type: String, 
    required: true 
  },
  title: { 
    type: String, 
    required: true 
  },
  date: { 
    type: Date, 
    default: Date.now 
  },
  introduction: {
    type: String
  },
  topics: [{
    headline: { type: String, required: true },
    summary: { type: String, required: true },
    keyTakeaway: { type: String },
    imagePrompt: { type: String },
    imageUrl: { type: String },
    sourceUrl: { type: String },
    category: { 
      type: String, 
      default: 'research',
      // Remove enum restriction - allow any category and validate/normalize in application logic
      validate: {
        validator: function(v: string) {
          // Allow any string category - we'll handle validation in the application layer
          return typeof v === 'string' && v.length > 0;
        },
        message: 'Category must be a non-empty string'
      }
    }
  }],
  conclusion: {
    type: String
  },
  llmUsed: { 
    type: String, 
    enum: ['cohere', 'gemini'],
    required: true 
  },
  status: { 
    type: String, 
    enum: ['draft', 'published'], 
    default: 'draft' 
  },
  rawContent: { 
    type: String 
  },
  formattedHtml: { 
    type: String 
  },
  stats: {
    sourcesAnalyzed: { type: Number, default: 0 },
    generationTime: { type: Number, default: 0 }
  },
  metadata: {
    feedsUsed: [{ type: String }],
    totalArticles: { type: Number, default: 0 },
    processingErrors: [{ type: String }]
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Add composite indexes for common query patterns
NewsletterSchema.index({ userId: 1, createdAt: -1 }); // User newsletters by date
NewsletterSchema.index({ userId: 1, status: 1, createdAt: -1 }); // User newsletters by status and date
NewsletterSchema.index({ status: 1 }); // All newsletters by status
NewsletterSchema.index({ llmUsed: 1, createdAt: -1 }); // Analytics by LLM usage
NewsletterSchema.index({ 'stats.generationTime': 1 }); // Performance analytics
NewsletterSchema.index({ 'metadata.totalArticles': 1 }); // Content analytics

// User Settings Schema
const UserSettingsSchema = new mongoose.Schema({
  userId: { 
    type: String, 
    required: true
  },
  apiKeys: {
    cohere: { type: String, default: '' },
    gemini: { type: String, default: '' }
  },
  preferences: {
    autoGenerate: { type: Boolean, default: false },
    generateTime: { type: String, default: '09:00' },
    llmPreference: { 
      type: String, 
      enum: ['cohere', 'gemini', 'auto'],
      default: 'cohere'
    },
    maxArticles: { type: Number, default: 7 },
    language: { 
      type: String, 
      enum: ['english', 'hebrew', 'spanish', 'french', 'german', 'italian', 'portuguese'],
      default: 'english'
    },
    timePeriod: {
      type: String,
      enum: ['24hours', '3days', '1week'],
      default: '24hours'
    },
    preferredCategories: {
      type: [String],
      enum: ['business', 'technology', 'research', 'product', 'enterprise', 'consumer', 'security', 'development'],
      default: []
    }
  },
  rssFeeds: {
    enabled: { type: [String], default: undefined }, // Let API handle defaults
    disabled: { type: [String], default: [] },
    deleted: { type: [String], default: [] }, // Array of permanently deleted feed IDs
    custom: [{
      id: String,
      name: String,
      url: String,
      category: String,
      enabled: { type: Boolean, default: true }
    }]
  }
}, { 
  timestamps: true 
});

// Add indexes for UserSettings
UserSettingsSchema.index({ userId: 1 }, { unique: true }); // Primary lookup
UserSettingsSchema.index({ 'preferences.llmPreference': 1 }); // Analytics by LLM preference
UserSettingsSchema.index({ 'preferences.language': 1 }); // Analytics by language
UserSettingsSchema.index({ 'rssFeeds.enabled': 1 }); // Feed usage analytics

// Feed Analytics Schema
const FeedAnalyticsSchema = new mongoose.Schema({
  feedId: { 
    type: String, 
    required: true 
  },
  date: { 
    type: Date, 
    default: Date.now 
  },
  articlesCount: { type: Number, default: 0 },
  successfulFetch: { type: Boolean, default: true },
  responseTime: { type: Number }, // milliseconds
  error: { type: String },
  topArticles: [{
    title: String,
    url: String,
    engagement: Number
  }]
}, { 
  timestamps: true 
});

// Add indexes for FeedAnalytics
FeedAnalyticsSchema.index({ feedId: 1, date: -1 }); // Feed performance over time
FeedAnalyticsSchema.index({ successfulFetch: 1 }); // Success/failure analytics

// Export models
export const Newsletter = mongoose.models.Newsletter || mongoose.model('Newsletter', NewsletterSchema);
export const UserSettings = mongoose.models.UserSettings || mongoose.model('UserSettings', UserSettingsSchema);
export const FeedAnalytics = mongoose.models.FeedAnalytics || mongoose.model('FeedAnalytics', FeedAnalyticsSchema);

// Helper functions
async function getDefaultUserSettings(userId: string) {
  // Import RSS_FEEDS to populate default enabled feeds
  const { RSS_FEEDS } = await import('@/config/rss-feeds');
  
  return {
    userId,
    apiKeys: { cohere: '', gemini: '' },
    preferences: {
      autoGenerate: false,
      generateTime: '09:00',
      llmPreference: 'cohere' as const,
      maxArticles: 7,
      language: 'english' as const,
      timePeriod: '24hours' as const,
      preferredCategories: ['business', 'technology', 'development'] as const
    },
    rssFeeds: {
      enabled: RSS_FEEDS.map(feed => feed.id),
      disabled: [] as string[],
      deleted: [] as string[],
      custom: []
    }
  };
}

export async function createNewsletter(data: {
  userId: string;
  title: string;
  topics: NewsletterTopic[];
  llmUsed: 'cohere' | 'gemini';
  introduction?: string;
  conclusion?: string;
  stats: {
    sourcesAnalyzed: number;
    generationTime: number;
  };
}) {
  await connectDB();
  
  // Validate and normalize categories before saving
  const normalizedTopics = await validateAndNormalizeTopics(data.topics);
  
  return await Newsletter.create({
    ...data,
    topics: normalizedTopics
  });
}

export async function getUserNewsletters(userId: string, limit: number = 10) {
  await connectDB();
  return await Newsletter.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .exec();
}

export async function getUserSettings(userId: string) {
  try {
    const connection = await connectDB();
    if (!connection) {
      console.warn('MongoDB not available for getUserSettings, returning defaults');
      return await getDefaultUserSettings(userId);
    }

    // Ensure mongoose connection is ready
    if (mongoose.connection.readyState !== 1) {
      console.warn('MongoDB connection not ready, returning defaults');
      return await getDefaultUserSettings(userId);
    }

    let settings = await UserSettings.findOne({ userId });
    
    if (!settings) {
      // Try to create default settings for new user
      try {
        settings = await UserSettings.create({ userId });
      } catch (createError) {
        console.error('Failed to create user settings:', createError);
        return await getDefaultUserSettings(userId);
      }
    }

    // Convert to object for manipulation
    const settingsObj = settings.toObject();
  
    // Ensure RSS feeds default to all enabled if undefined or empty
    if (!settingsObj.rssFeeds || !settingsObj.rssFeeds.enabled || settingsObj.rssFeeds.enabled.length === 0) {
      const { RSS_FEEDS } = await import('@/config/rss-feeds');
      settingsObj.rssFeeds = {
        ...settingsObj.rssFeeds,
        enabled: RSS_FEEDS.map(feed => feed.id),
        disabled: settingsObj.rssFeeds?.disabled || [],
        deleted: settingsObj.rssFeeds?.deleted || [],
        custom: settingsObj.rssFeeds?.custom || []
      };
    }
    
    // Decrypt API keys before returning (handle both encrypted and unencrypted for backward compatibility)
    if (settingsObj && settingsObj.apiKeys) {
      try {
        const decryptedKeys = decryptApiKeys(settingsObj.apiKeys);
        settingsObj.apiKeys = decryptedKeys;
      } catch (error) {
        console.error('Failed to decrypt API keys for user:', userId, error);
        // If decryption fails, assume keys are already unencrypted (backward compatibility)
      }
    }
    
    return settingsObj;
  } catch (dbError) {
    console.error('Database error in getUserSettings:', dbError);
    return await getDefaultUserSettings(userId);
  }
}

export async function updateUserSettings(userId: string, updates: Partial<{ apiKeys: { cohere: string; gemini: string }; preferences: { autoGenerate: boolean; generateTime: string; llmPreference: 'cohere' | 'gemini' | 'auto' }; rssFeeds: { enabled: string[]; disabled: string[]; custom: unknown[] } }>) {
  await connectDB();
  
  // Encrypt API keys before storing
  if (updates.apiKeys) {
    try {
      const encryptedKeys = encryptApiKeys(updates.apiKeys);
      updates = { ...updates, apiKeys: encryptedKeys };
    } catch (error) {
      console.error('Failed to encrypt API keys for user:', userId, error);
      throw new Error('Failed to encrypt API keys');
    }
  }
  
  const result = await UserSettings.findOneAndUpdate(
    { userId },
    { $set: updates },
    { new: true, upsert: true }
  );
  
  // Decrypt API keys in the returned result
  if (result && result.apiKeys) {
    try {
      const decryptedKeys = decryptApiKeys(result.apiKeys);
      const resultObj = result.toObject();
      resultObj.apiKeys = decryptedKeys;
      return resultObj;
    } catch (error) {
      console.error('Failed to decrypt API keys in result for user:', userId, error);
      return result;
    }
  }
  
  return result;
}

// Global type augmentation for mongoose caching
declare global {
  var mongoose: {
    conn: unknown;
    promise: unknown;
  };
}