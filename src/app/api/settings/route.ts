import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB, getUserSettings, updateUserSettings } from '@/lib/db';
import { APIResponse, UserSettings } from '@/types';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json<APIResponse>({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    await connectDB();
    const settings = await getUserSettings(userId);

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
    const { apiKeys, preferences, rssFeeds } = body;

    // Validate the input
    if (!apiKeys || !preferences || !rssFeeds) {
      return NextResponse.json<APIResponse>({ 
        success: false, 
        error: 'Missing required settings data' 
      }, { status: 400 });
    }

    await connectDB();
    const updatedSettings = await updateUserSettings(userId, {
      apiKeys: {
        cohere: apiKeys.cohere || '',
        gemini: apiKeys.gemini || ''
      },
      preferences: {
        autoGenerate: preferences.autoGenerate || false,
        generateTime: preferences.generateTime || '09:00',
        emailNotifications: preferences.emailNotifications || true,
        llmPreference: preferences.llmPreference || 'cohere'
      },
      rssFeeds: {
        enabled: rssFeeds.enabled || [],
        disabled: rssFeeds.disabled || [],
        custom: rssFeeds.custom || []
      }
    });

    return NextResponse.json<APIResponse>({
      success: true,
      message: 'Settings saved successfully',
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