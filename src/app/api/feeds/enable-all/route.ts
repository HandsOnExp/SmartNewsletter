import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB, updateUserSettings } from '@/lib/db';
import { RSS_FEEDS } from '@/config/rss-feeds';

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    
    // Enable all RSS feeds
    const allFeedIds = RSS_FEEDS.map(feed => feed.id);
    
    await updateUserSettings(userId, {
      rssFeeds: {
        enabled: allFeedIds,
        disabled: [],
        custom: []
      }
    });
    
    return NextResponse.json({ 
      success: true, 
      message: `Enabled all ${allFeedIds.length} RSS feeds`,
      enabledFeeds: allFeedIds
    });

  } catch (error) {
    console.error('Enable all feeds error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to enable feeds' 
    }, { status: 500 });
  }
}