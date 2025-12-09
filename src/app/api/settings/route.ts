import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB, getUserSettings, updateUserSettings } from '@/lib/db';
import { APIResponse, UserSettings } from '@/types';
import { RSS_FEEDS } from '@/config/rss-feeds';
import { encryptApiKeys, decryptApiKeys } from '@/lib/crypto';
import fs from 'fs';
import path from 'path';

// Temporary in-memory storage (in production, use Redis or database)
const tempSettings = new Map<string, UserSettings>();

// Check if we're in a serverless environment (Vercel)
// In serverless, we can't create directories or write files
const IS_SERVERLESS = !!process.env.VERCEL;

// File-based storage functions (only work in non-serverless environments)
const getSettingsFilePath = (): string | null => {
  if (IS_SERVERLESS) return null; // Skip file storage in serverless

  const settingsDir = path.join(process.cwd(), '.temp-settings');
  if (!fs.existsSync(settingsDir)) {
    fs.mkdirSync(settingsDir, { recursive: true });
  }
  return path.join(settingsDir, 'user-settings.json');
};

const loadFileSettings = (): Map<string, UserSettings> => {
  if (IS_SERVERLESS) {
    console.log('Serverless environment detected - skipping file storage, using in-memory only');
    return new Map();
  }

  try {
    const filePath = getSettingsFilePath();
    if (filePath && fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(data);
      return new Map(Object.entries(parsed));
    }
  } catch (error) {
    console.error('Error loading file settings:', error);
  }
  return new Map();
};

const saveFileSettings = (settings: Map<string, UserSettings>) => {
  if (IS_SERVERLESS) {
    console.log('Serverless environment - skipping file save, using in-memory storage');
    return; // Skip file storage in serverless
  }

  try {
    const filePath = getSettingsFilePath();
    if (filePath) {
      const data = Object.fromEntries(settings.entries());
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('Error saving file settings:', error);
  }
};

// Load existing settings from file on startup (skipped in serverless)
const fileSettings = loadFileSettings();

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json<APIResponse>({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // Try database first, fall back to temp storage
    let settings: UserSettings | null = null;
    
    try {
      const dbConnection = await connectDB();
      if (dbConnection) {
        settings = await getUserSettings(userId);
      }
    } catch {
      console.log('Database not available, using temporary storage');
    }

    // If no database settings, check file storage, then memory, then defaults
    if (!settings) {
      let fallbackSettings = fileSettings.get(userId) || tempSettings.get(userId);
      
      if (fallbackSettings && fallbackSettings.apiKeys) {
        // Decrypt API keys from fallback storage
        try {
          const decryptedKeys = decryptApiKeys(fallbackSettings.apiKeys);
          fallbackSettings = { ...fallbackSettings, apiKeys: decryptedKeys };
        } catch (error) {
          console.error('Failed to decrypt API keys from fallback storage:', error);
          // If decryption fails, assume keys are already unencrypted
        }
      }
      
      settings = fallbackSettings || {
        userId,
        apiKeys: {
          gemini: ''
        },
        preferences: {
          autoGenerate: false,
          generateTime: '09:00',
          maxArticles: 5,
          language: 'english' as const,
          timePeriod: '24hours' as const,
          preferredCategories: [] as const
        },
        rssFeeds: {
          enabled: RSS_FEEDS.map(feed => feed.id),
          disabled: [],
          deleted: [],
          custom: []
        }
      };
    }

    return NextResponse.json<APIResponse<{ settings: UserSettings }>>({
      success: true,
      data: { settings }
    });

  } catch (error) {
    console.error('Settings GET error:', error);
    return NextResponse.json<APIResponse>(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to load settings' 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json<APIResponse>({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const body = await request.json();
    // Sanitized debug log - never log API keys
    console.log('Settings POST received:', {
      hasApiKeys: !!body.apiKeys,
      preferences: body.preferences,
      rssFeeds: {
        enabled: body.rssFeeds?.enabled?.length || 0,
        disabled: body.rssFeeds?.disabled?.length || 0,
        custom: body.rssFeeds?.custom?.length || 0
      }
    });

    const { apiKeys, preferences, rssFeeds } = body;

    // Create settings object
    const updatedSettings: UserSettings = {
      userId,
      apiKeys: {
        gemini: apiKeys?.gemini || ''
      },
      preferences: {
        autoGenerate: preferences?.autoGenerate || false,
        generateTime: preferences?.generateTime || '09:00',
        maxArticles: preferences?.maxArticles || 5,
        language: preferences?.language || 'english',
        timePeriod: preferences?.timePeriod || '24hours',
        preferredCategories: preferences?.preferredCategories || []
      },
      rssFeeds: {
        enabled: rssFeeds?.enabled || RSS_FEEDS.map(feed => feed.id),
        disabled: rssFeeds?.disabled || [],
        deleted: rssFeeds?.deleted || [],
        custom: rssFeeds?.custom || []
      }
    };

    // Try to save to database first, fall back to temp storage
    try {
      const dbConnection = await connectDB();
      if (dbConnection) {
        const dbSettings = await updateUserSettings(userId, {
          apiKeys: updatedSettings.apiKeys,
          preferences: updatedSettings.preferences,
          rssFeeds: updatedSettings.rssFeeds
        });
        console.log('Settings saved to database');
        
        return NextResponse.json<APIResponse>({
          success: true,
          message: 'Settings saved successfully to database',
          data: { settings: dbSettings }
        });
      }
    } catch {
      console.log('Database not available, saving to temporary storage');
    }

    // Encrypt API keys before saving to fallback storage
    let settingsToStore = updatedSettings;
    if (updatedSettings.apiKeys) {
      try {
        const encryptedKeys = encryptApiKeys(updatedSettings.apiKeys);
        settingsToStore = { ...updatedSettings, apiKeys: encryptedKeys };
      } catch (error) {
        console.error('Failed to encrypt API keys for fallback storage:', error);
        // Continue with unencrypted keys if encryption fails
      }
    }
    
    // Save to file storage (persistent) and memory storage (fast access)
    fileSettings.set(userId, settingsToStore);
    tempSettings.set(userId, settingsToStore);
    
    // Persist to file
    saveFileSettings(fileSettings);
    console.log('Settings saved to persistent file storage for user:', userId);

    return NextResponse.json<APIResponse>({
      success: true,
      message: 'Settings saved successfully (persistent storage)',
      data: { settings: updatedSettings }
    });

  } catch (error) {
    console.error('Settings POST error:', error);
    return NextResponse.json<APIResponse>(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to save settings' 
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  // Alias for POST to handle updates
  return POST(request);
}