import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { fetchAllFeeds } from '@/lib/rss-parser';
import { RSS_FEEDS } from '@/utils/rss-feeds';
import { APIResponse } from '@/types';

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json<APIResponse>({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    console.log('Refreshing RSS feeds...');
    const startTime = Date.now();

    // Fetch all feeds
    const feedResults = await fetchAllFeeds(RSS_FEEDS);
    
    // Count successful and failed feeds
    let successCount = 0;
    let errorCount = 0;
    let totalArticles = 0;

    const feedStatuses = feedResults.map(result => {
      if (result.articles.success) {
        successCount++;
        totalArticles += result.articles.data.length;
        return {
          feedName: result.feed.name,
          status: 'success',
          articleCount: result.articles.data.length
        };
      } else {
        errorCount++;
        return {
          feedName: result.feed.name,
          status: 'error',
          error: result.articles.error
        };
      }
    });

    const responseTime = Date.now() - startTime;

    console.log(`RSS refresh completed: ${successCount} successful, ${errorCount} failed, ${totalArticles} total articles in ${responseTime}ms`);

    return NextResponse.json<APIResponse>({
      success: true,
      message: `Refreshed ${successCount} feeds successfully. Found ${totalArticles} articles.`,
      data: {
        successCount,
        errorCount,
        totalArticles,
        responseTime,
        feedStatuses
      }
    });

  } catch (error) {
    console.error('RSS refresh error:', error);
    return NextResponse.json<APIResponse>(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error during RSS refresh' 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json<APIResponse>({
    success: false,
    error: 'Method not allowed. Use POST to refresh feeds.'
  }, { status: 405 });
}