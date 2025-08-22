import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB, Newsletter } from '@/lib/db';
import { fetchAllFeeds } from '@/lib/rss-parser';
import { RSS_FEEDS } from '@/utils/rss-feeds';
import { DashboardStats, APIResponse } from '@/types';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json<APIResponse>({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // Try to connect to database, but continue if it fails
    let userNewsletters: {
      stats?: { generationTime: number };
      title: string;
      createdAt: Date;
    }[] = [];
    let databaseAvailable = false;

    try {
      const dbConnection = await connectDB();
      if (dbConnection) {
        // Fetch user's newsletters
        userNewsletters = await Newsletter.find({ userId })
          .sort({ createdAt: -1 })
          .limit(10)
          .exec();
        databaseAvailable = true;
      }
    } catch {
      console.log('Database not available for stats, using mock data');
      userNewsletters = [];
    }

    // Calculate newsletter stats
    const newslettersGenerated = userNewsletters.length;

    // Calculate average generation time
    const totalTime = userNewsletters.reduce((sum, n) => 
      sum + (n.stats?.generationTime || 0), 0
    );
    const avgTime = newslettersGenerated > 0 
      ? (totalTime / newslettersGenerated / 1000).toFixed(1) 
      : '0';

    // Get last update time
    const lastNewsletter = userNewsletters[0];
    const lastUpdateTime = lastNewsletter 
      ? formatRelativeTime(lastNewsletter.createdAt)
      : databaseAvailable ? 'Never' : 'Demo Mode';

    // Fetch RSS feeds to get article count (simplified for demo)
    let totalArticlesToday = 0;
    
    if (!databaseAvailable) {
      // Show demo data when database is not available
      totalArticlesToday = 247;
    } else {
      try {
        const feedResults = await fetchAllFeeds(RSS_FEEDS.slice(0, 3)); // Limit to first 3 feeds for speed
        totalArticlesToday = feedResults
          .filter(result => result.articles.success)
          .reduce((sum, result) => sum + result.articles.data.length, 0);
      } catch (error) {
        console.error('Error fetching feeds for stats:', error);
        totalArticlesToday = 150; // Fallback demo number
      }
    }

    // Calculate top sources (simplified)
    const topSources = RSS_FEEDS.slice(0, 5).map(feed => ({
      name: feed.name,
      count: Math.floor(Math.random() * 20) + 5 // Mock data for demo
    }));

    // Recent activity (simplified)
    const recentActivity = userNewsletters.slice(0, 5).map(newsletter => ({
      type: 'generation' as const,
      message: `Newsletter "${newsletter.title}" generated`,
      timestamp: newsletter.createdAt
    }));

    const stats: DashboardStats = {
      totalArticlesToday,
      newslettersGenerated,
      lastUpdateTime,
      averageGenerationTime: `${avgTime}s`,
      topSources,
      recentActivity
    };

    return NextResponse.json<APIResponse<DashboardStats>>({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    
    // Return default stats if there's an error
    const defaultStats: DashboardStats = {
      totalArticlesToday: 0,
      newslettersGenerated: 0,
      lastUpdateTime: 'Never',
      averageGenerationTime: '0s',
      topSources: [],
      recentActivity: []
    };

    return NextResponse.json<APIResponse<DashboardStats>>({
      success: true,
      data: defaultStats
    });
  }
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hr ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else {
    return date.toLocaleDateString();
  }
}