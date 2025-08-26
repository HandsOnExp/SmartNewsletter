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
    
    // Reset RSS feeds to all enabled
    const allFeedIds = RSS_FEEDS.map(feed => feed.id);
    
    console.log('Resetting RSS feeds for user:', userId);
    console.log('Enabling feeds:', allFeedIds);
    
    await updateUserSettings(userId, {
      rssFeeds: {
        enabled: allFeedIds,
        disabled: [],
        custom: []
      }
    });
    
    console.log('RSS feeds reset completed');
    
    return NextResponse.json({ 
      success: true, 
      message: `Reset ${allFeedIds.length} RSS feeds to enabled`,
      enabledFeeds: allFeedIds
    });

  } catch (error) {
    console.error('RSS feed reset error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to reset RSS feeds' 
    }, { status: 500 });
  }
}