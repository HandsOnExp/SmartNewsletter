import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB, getUserSettings, updateUserSettings } from '@/lib/db';
import { APIResponse, UserSettings } from '@/types';
import { RSS_FEEDS } from '@/utils/rss-feeds';
import fs from 'fs';
import path from 'path';

// Temporary in-memory storage (in production, use Redis or database)
const tempSettings = new Map<string, UserSettings>();

// File-based storage functions
const getSettingsFilePath = () => {
  const settingsDir = path.join(process.cwd(), '.temp-settings');
  if (!fs.existsSync(settingsDir)) {
    fs.mkdirSync(settingsDir, { recursive: true });
  }
  return path.join(settingsDir, 'user-settings.json');
};

const loadFileSettings = (): Map<string, UserSettings> => {
  try {
    const filePath = getSettingsFilePath();
    if (fs.existsSync(filePath)) {
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
  try {
    const filePath = getSettingsFilePath();
    const data = Object.fromEntries(settings.entries());
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving file settings:', error);
  }
};

// Load existing settings from file on startup
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
      settings = fileSettings.get(userId) || tempSettings.get(userId) || {
        userId,
        apiKeys: {
          cohere: '',
          gemini: ''
        },
        preferences: {
          autoGenerate: false,
          generateTime: '09:00',
          emailNotifications: true,
          llmPreference: 'cohere' as const,
          maxArticles: 20,
          language: 'english' as const
        },
        rssFeeds: {
          enabled: [],
          disabled: RSS_FEEDS.map(feed => feed.id),
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
    console.log('Settings POST body:', body); // Debug log

    const { apiKeys, preferences, rssFeeds } = body;

    // Create settings object
    const updatedSettings: UserSettings = {
      userId,
      apiKeys: {
        cohere: apiKeys?.cohere || '',
        gemini: apiKeys?.gemini || ''
      },
      preferences: {
        autoGenerate: preferences?.autoGenerate || false,
        generateTime: preferences?.generateTime || '09:00',
        emailNotifications: preferences?.emailNotifications !== false, // Default to true
        llmPreference: preferences?.llmPreference || 'cohere',
        maxArticles: preferences?.maxArticles || 20,
        language: preferences?.language || 'english'
      },
      rssFeeds: {
        enabled: rssFeeds?.enabled || [],
        disabled: rssFeeds?.disabled || [],
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

    // Save to file storage (persistent) and memory storage (fast access)
    fileSettings.set(userId, updatedSettings);
    tempSettings.set(userId, updatedSettings);
    
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