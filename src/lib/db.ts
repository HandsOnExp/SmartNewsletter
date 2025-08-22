import mongoose from 'mongoose';
import { NewsletterTopic } from './ai-processors';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.warn('MONGODB_URI not found. Database features will be disabled.');
}

// Global mongoose instance for Next.js
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
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongooseInstance) => {
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

// Newsletter Schema
const NewsletterSchema = new mongoose.Schema({
  userId: { 
    type: String, 
    required: true,
    index: true 
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
      enum: ['research', 'product', 'business', 'policy', 'security', 'fun'],
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

// Add indexes for better performance
NewsletterSchema.index({ userId: 1, createdAt: -1 });
NewsletterSchema.index({ status: 1 });

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
    maxArticles: { type: Number, default: 20 },
    language: { 
      type: String, 
      enum: ['english', 'hebrew', 'spanish', 'french', 'german', 'italian', 'portuguese'],
      default: 'english'
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

// Feed Analytics Schema
const FeedAnalyticsSchema = new mongoose.Schema({
  feedId: { 
    type: String, 
    required: true,
    index: true 
  },
  date: { 
    type: Date, 
    default: Date.now,
    index: true 
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
  
  return settings;
}

export async function updateUserSettings(userId: string, updates: Partial<{ apiKeys: { cohere: string; gemini: string }; preferences: { autoGenerate: boolean; generateTime: string; emailNotifications: boolean; llmPreference: 'cohere' | 'gemini' | 'auto' }; rssFeeds: { enabled: string[]; disabled: string[]; custom: unknown[] } }>) {
  await connectDB();
  return await UserSettings.findOneAndUpdate(
    { userId },
    { $set: updates },
    { new: true, upsert: true }
  );
}

// Global type augmentation for mongoose caching
declare global {
  var mongoose: {
    conn: unknown;
    promise: unknown;
  };
}