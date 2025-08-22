import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB, getUserSettings, updateUserSettings } from '@/lib/db';
import { APIResponse, UserSettings } from '@/types';
import { RSS_FEEDS } from '@/utils/rss-feeds';

// Temporary in-memory storage (in production, use Redis or database)
const tempSettings = new Map<string, UserSettings>();

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
    } catch (dbError) {
      console.log('Database not available, using temporary storage');
    }

    // If no database settings, use temporary storage or defaults
    if (!settings) {
      settings = tempSettings.get(userId) || {
        userId,
        apiKeys: {
          cohere: '',
          gemini: ''
        },
        preferences: {
          autoGenerate: false,
          generateTime: '09:00',
          emailNotifications: true,
          llmPreference: 'cohere' as const
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
        llmPreference: preferences?.llmPreference || 'cohere'
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
    } catch (dbError) {
      console.log('Database not available, saving to temporary storage');
    }

    // Save to temporary storage
    tempSettings.set(userId, updatedSettings);
    console.log('Settings saved to temporary storage for user:', userId);

    return NextResponse.json<APIResponse>({
      success: true,
      message: 'Settings saved successfully (temporary storage)',
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