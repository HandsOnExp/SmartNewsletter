import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB, updateUserSettings, getUserSettings } from '@/lib/db';
import { RSS_FEEDS } from '@/config/rss-feeds';

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    
    // Get existing settings to preserve custom feeds
    const existingSettings = await getUserSettings(userId);
    const existingCustomFeeds = existingSettings?.rssFeeds?.custom || [];
    
    // Disable all RSS feeds
    const allFeedIds = RSS_FEEDS.map(feed => feed.id);
    
    await updateUserSettings(userId, {
      rssFeeds: {
        enabled: [],
        disabled: allFeedIds,
        custom: existingCustomFeeds
      }
    });
    
    return NextResponse.json({ 
      success: true, 
      message: `Disabled all ${allFeedIds.length} RSS feeds`,
      disabledFeeds: allFeedIds
    });

  } catch (error) {
    console.error('Disable all feeds error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to disable feeds' 
    }, { status: 500 });
  }
}