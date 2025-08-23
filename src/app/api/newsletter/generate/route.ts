import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { fetchAllFeeds, deduplicateArticles, sortArticlesByDate } from '@/lib/rss-parser';
import { generateNewsletterContent, checkRateLimit } from '@/lib/ai-processors';
import { RSS_FEEDS } from '@/config/rss-feeds';
import { createNewsletter, connectDB, getUserSettings } from '@/lib/db';
import { APIResponse, NewsletterGenerationResponse, CustomRSSFeed } from '@/types';

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
    const { llmProvider: requestedProvider } = body;

    // Fetch user settings for preferences
    const userSettings = await getUserSettings(userId);
    const llmProvider = requestedProvider || userSettings?.preferences?.llmPreference || 'cohere';
    const maxTopics = userSettings?.preferences?.maxArticles || 7; // maxArticles now controls number of topics
    const language = userSettings?.preferences?.language || 'english';

    // Check rate limits
    const rateCheck = checkRateLimit();
    if (!rateCheck.allowed) {
      return NextResponse.json<APIResponse>({ 
        success: false, 
        error: rateCheck.message || 'Rate limit exceeded' 
      }, { status: 429 });
    }

    const startTime = Date.now();
    console.log(`Starting newsletter generation for user ${userId} with ${llmProvider}`);

    // Step 1: Get enabled RSS feeds based on user settings
    const enabledFeedIds = userSettings?.rssFeeds?.enabled || [];
    const customFeeds = userSettings?.rssFeeds?.custom || [];
    
    // Start with enabled feeds from user settings
    let enabledFeeds = RSS_FEEDS.filter(feed => enabledFeedIds.includes(feed.id));
    
    // Add enabled custom feeds
    enabledFeeds = [...enabledFeeds, ...customFeeds.filter((feed: CustomRSSFeed) => feed.enabled)];
    
    // If no feeds are explicitly enabled (new user or no settings), fall back to using saved preferences
    // or default behavior based on RSS_FEEDS default enabled status
    if (enabledFeeds.length === 0) {
      console.log('No feeds explicitly enabled, using default RSS_FEEDS');
      enabledFeeds = RSS_FEEDS.filter(feed => feed.enabled);
    }

    console.log(`Fetching RSS feeds... (${enabledFeeds.length} enabled feeds)`);
    console.log('Enabled feeds:', enabledFeeds.map(f => f.name));
    const feedResults = await fetchAllFeeds(enabledFeeds);
    
    // Step 2: Aggregate and process articles
    const allArticles = feedResults
      .filter(result => result.articles.success)
      .flatMap(result => result.articles.data)
      .filter(article => article.title && article.link); // Filter out invalid articles

    console.log(`Fetched ${allArticles.length} articles from ${feedResults.length} feeds`);

    if (allArticles.length === 0) {
      return NextResponse.json<APIResponse>({ 
        success: false, 
        error: 'No articles found from RSS feeds' 
      }, { status: 400 });
    }

    // Step 3: Deduplicate and sort articles (analyze more articles to get better topic selection)
    const uniqueArticles = deduplicateArticles(allArticles);
    const sortedArticles = sortArticlesByDate(uniqueArticles); // Use all available articles for analysis

    console.log(`Processing ${sortedArticles.length} unique articles to generate ${maxTopics} topics in ${language}`);

    // Step 4: Generate newsletter content
    console.log(`Generating ${maxTopics} newsletter topics with ${llmProvider} in ${language}...`);
    const generationResult = await generateNewsletterContent(sortedArticles, llmProvider, {
      maxTopics,
      language
    });

    if (!generationResult.success || !generationResult.data) {
      console.error('Newsletter generation failed:', generationResult.error);
      return NextResponse.json<APIResponse>({ 
        success: false, 
        error: generationResult.error || 'Failed to generate newsletter content' 
      }, { status: 500 });
    }

    const newsletterData = generationResult.data;

    // Step 5: Save to database
    try {
      await connectDB();
      const savedNewsletter = await createNewsletter({
        userId,
        title: newsletterData.newsletterTitle,
        topics: newsletterData.topics,
        llmUsed: llmProvider,
        introduction: newsletterData.introduction,
        conclusion: newsletterData.conclusion,
        stats: {
          sourcesAnalyzed: sortedArticles.length,
          generationTime: Date.now() - startTime
        }
      });

      console.log(`Newsletter saved with ID: ${savedNewsletter._id}`);

      // Step 6: Return successful response
      const response: NewsletterGenerationResponse = {
        success: true,
        newsletter: {
          newsletterTitle: newsletterData.newsletterTitle,
          newsletterDate: newsletterData.newsletterDate || new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          introduction: newsletterData.introduction,
          topics: newsletterData.topics,
          conclusion: newsletterData.conclusion
        },
        stats: {
          articlesAnalyzed: sortedArticles.length,
          generationTime: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
          id: savedNewsletter._id.toString()
        }
      };

      return NextResponse.json(response);

    } catch (dbError) {
      console.error('Database error:', dbError);
      
      // Return the generated content even if saving fails
      const response: NewsletterGenerationResponse = {
        success: true,
        newsletter: {
          newsletterTitle: newsletterData.newsletterTitle,
          newsletterDate: newsletterData.newsletterDate || new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          introduction: newsletterData.introduction,
          topics: newsletterData.topics,
          conclusion: newsletterData.conclusion
        },
        stats: {
          articlesAnalyzed: sortedArticles.length,
          generationTime: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
          id: 'temp-id'
        }
      };

      return NextResponse.json(response);
    }

  } catch (error) {
    console.error('Newsletter generation error:', error);
    return NextResponse.json<APIResponse>(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error during generation' 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json<APIResponse>({
    success: false,
    error: 'Method not allowed'
  }, { status: 405 });
}