import mongoose from 'mongoose';
import { NewsletterTopic } from './ai-processors';
import { encryptApiKeys, decryptApiKeys } from './crypto';

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
      enum: ['research', 'product', 'business', 'policy', 'security', 'fun', 'health', 'technology', 'science', 'innovation', 'ai', 'machine-learning'],
      default: 'research'
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
    required: true,
    unique: true 
  },
  apiKeys: {
    cohere: { type: String, default: '' },
    gemini: { type: String, default: '' }
  },
  preferences: {
    autoGenerate: { type: Boolean, default: false },
    generateTime: { type: String, default: '09:00' },
    emailNotifications: { type: Boolean, default: true },
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
      enum: ['1hour', '6hours', '12hours', '24hours', '3days', '1week', '1month'],
      default: '24hours'
    }
  },
  rssFeeds: {
    enabled: [{ type: String }], // Array of feed IDs
    disabled: [{ type: String }],
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
  return await Newsletter.create(data);
}

export async function getUserNewsletters(userId: string, limit: number = 10) {
  await connectDB();
  return await Newsletter.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .exec();
}

export async function getUserSettings(userId: string) {
  await connectDB();
  let settings = await UserSettings.findOne({ userId });
  
  if (!settings) {
    // Create default settings for new user
    settings = await UserSettings.create({ userId });
  }
  
  // Decrypt API keys before returning (handle both encrypted and unencrypted for backward compatibility)
  if (settings && settings.apiKeys) {
    try {
      const decryptedKeys = decryptApiKeys(settings.apiKeys);
      settings = settings.toObject();
      settings.apiKeys = decryptedKeys;
    } catch (error) {
      console.error('Failed to decrypt API keys for user:', userId, error);
      // If decryption fails, assume keys are already unencrypted (backward compatibility)
    }
  }
  
  return settings;
}

export async function updateUserSettings(userId: string, updates: Partial<{ apiKeys: { cohere: string; gemini: string }; preferences: { autoGenerate: boolean; generateTime: string; emailNotifications: boolean; llmPreference: 'cohere' | 'gemini' | 'auto' }; rssFeeds: { enabled: string[]; disabled: string[]; custom: unknown[] } }>) {
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