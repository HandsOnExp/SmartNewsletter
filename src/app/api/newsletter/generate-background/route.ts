import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/db';
import { APIResponse, NewsletterGenerationResponse, CustomRSSFeed } from '@/types';

// Background job status tracking
const jobStatus = new Map<string, {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: NewsletterGenerationResponse;
  error?: string;
  startTime: number;
}>();

// Cleanup old jobs (older than 10 minutes)
function cleanupOldJobs() {
  const now = Date.now();
  const tenMinutes = 10 * 60 * 1000;
  
  for (const [jobId, job] of jobStatus.entries()) {
    if (now - job.startTime > tenMinutes) {
      jobStatus.delete(jobId);
    }
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
    const { llmProvider } = body;
    
    // Generate unique job ID
    const jobId = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    // Initialize job status
    jobStatus.set(jobId, {
      status: 'pending',
      progress: 0,
      startTime: Date.now()
    });

    // Start background processing (don't await)
    processNewsletterInBackground(jobId, userId, body).catch(error => {
      console.error(`Background job ${jobId} failed:`, error);
      const job = jobStatus.get(jobId);
      if (job) {
        job.status = 'failed';
        job.error = error.message;
      }
    });

    // Clean up old jobs
    cleanupOldJobs();

    // Return job ID immediately
    return NextResponse.json({
      success: true,
      jobId,
      message: 'Newsletter generation started in background',
      estimatedTime: llmProvider === 'cohere' ? '45-60 seconds' : '20-30 seconds'
    });

  } catch (error) {
    console.error('Background generation initiation error:', error);
    return NextResponse.json<APIResponse>(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to start background generation' 
      },
      { status: 500 }
    );
  }
}

// Check job status
export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json<APIResponse>({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const url = new URL(request.url);
    const jobId = url.searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json<APIResponse>({ 
        success: false, 
        error: 'Job ID required' 
      }, { status: 400 });
    }

    const job = jobStatus.get(jobId);
    if (!job) {
      return NextResponse.json<APIResponse>({ 
        success: false, 
        error: 'Job not found or expired' 
      }, { status: 404 });
    }

    // Return job status and result if completed
    return NextResponse.json({
      success: true,
      status: job.status,
      progress: job.progress,
      result: job.result,
      error: job.error,
      elapsedTime: Date.now() - job.startTime
    });

  } catch (error) {
    console.error('Job status check error:', error);
    return NextResponse.json<APIResponse>(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to check job status' 
      },
      { status: 500 }
    );
  }
}

async function processNewsletterInBackground(jobId: string, userId: string, requestBody: { llmProvider?: string }) {
  const job = jobStatus.get(jobId);
  if (!job) return;

  try {
    job.status = 'processing';
    job.progress = 10;

    // Import the newsletter generation logic
    const { generateNewsletterContent, checkRateLimit } = await import('@/lib/ai-processors');
    const { fetchAllFeeds, deduplicateArticles, sortArticlesByDate, filterArticlesByTimePeriod, processAndValidateArticles } = await import('@/lib/rss-parser');
    const { RSS_FEEDS } = await import('@/config/rss-feeds');
    const { createNewsletter, getUserSettings } = await import('@/lib/db');
    const { autoCleanupIfNeeded } = await import('@/lib/database-cleanup');

    const { llmProvider: requestedProvider } = requestBody;

    // Fetch user settings
    const userSettings = await getUserSettings(userId);
    const llmProvider = requestedProvider || userSettings?.preferences?.llmPreference || 'cohere';
    const maxArticles = userSettings?.preferences?.maxArticles || 5;
    const language = userSettings?.preferences?.language || 'english';
    const preferredCategories = userSettings?.preferences?.preferredCategories || ['business', 'technology', 'development'];

    job.progress = 20;

    // Check rate limits
    const rateCheck = checkRateLimit();
    if (!rateCheck.allowed) {
      throw new Error(rateCheck.message || 'Rate limit exceeded');
    }

    const startTime = Date.now();
    console.log(`Background: Starting newsletter generation for user ${userId} with ${llmProvider}`);

    // Auto-cleanup database (runs in background)
    autoCleanupIfNeeded().catch(error => 
      console.log('Background cleanup failed:', error)
    );

    job.progress = 30;

    // Get enabled feeds (same logic as main route)
    const customFeeds = userSettings?.rssFeeds?.custom || [];
    const userEnabledFeeds = userSettings?.rssFeeds?.enabled || [];
    const userDisabledFeeds = userSettings?.rssFeeds?.disabled || [];
    
    const categoryFilteredFeeds = RSS_FEEDS.filter(feed => 
      preferredCategories.includes(feed.category)
    );
    
    let enabledFeeds = categoryFilteredFeeds.filter(feed => {
      if (userEnabledFeeds.includes(feed.id)) return true;
      if (userDisabledFeeds.includes(feed.id)) return false;
      return feed.enabled;
    });
    
    enabledFeeds = [...enabledFeeds, ...customFeeds.filter((feed: CustomRSSFeed) => feed.enabled)];

    console.log(`Background: Fetching RSS feeds... (${enabledFeeds.length} enabled feeds)`);
    
    job.progress = 40;

    // Fetch feeds with timeout
    const feedFetchPromise = fetchAllFeeds(enabledFeeds);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Feed fetching timeout')), 20000) // Reduced to 20s
    );
    
    const feedResults = await Promise.race([feedFetchPromise, timeoutPromise]) as Awaited<ReturnType<typeof fetchAllFeeds>>;
    
    job.progress = 50;

    // Process articles
    const allArticles = feedResults
      .filter(result => result.articles.success)
      .flatMap(result => result.articles.data)
      .filter(article => article.title && article.link);

    console.log(`Background: Fetched ${allArticles.length} articles from ${feedResults.length} feeds`);

    if (allArticles.length === 0) {
      throw new Error('No articles found from RSS feeds');
    }

    job.progress = 60;

    // Fast URL validation
    const validatedArticles = await processAndValidateArticles(allArticles, {
      validateURLs: true,
      fixBrokenLinks: false,
      batchSize: 25, // Even larger batches for background processing
      skipValidationPatterns: ['technologyreview\\.com/\\d{4}/\\d{2}/\\d{2}/[^/]+/$']
    });

    if (validatedArticles.length === 0) {
      throw new Error('No articles with valid URLs found');
    }

    job.progress = 70;

    // Filter articles by time
    const uniqueArticles = deduplicateArticles(validatedArticles);
    const timePeriod = userSettings?.preferences?.timePeriod || '24hours';
    const minArticlesForStrict = Math.max(maxArticles * 2, 10);
    const filterResult = filterArticlesByTimePeriod(uniqueArticles, timePeriod, minArticlesForStrict);
    
    const sortedArticles = sortArticlesByDate(filterResult.articles);
    
    if (sortedArticles.length === 0) {
      throw new Error('No articles found after filtering');
    }

    console.log(`Background: Processing ${sortedArticles.length} articles to generate ${maxArticles} articles in ${language}`);

    job.progress = 80;

    // Generate newsletter with optimized settings
    const generationResult = await generateNewsletterContent(sortedArticles, {
      maxTopics: maxArticles,
      language,
      preferredCategories,
      fastMode: true,
      timeout: 15000 // Gemini timeout: 15 seconds
    });

    if (!generationResult || !generationResult.success || !generationResult.data) {
      throw new Error(generationResult?.error || 'Failed to generate newsletter content');
    }

    job.progress = 90;

    const newsletterData = generationResult.data;
    
    // URL deduplication and validation (same as main route)
    console.log('Background: Validating URLs and removing duplicates in generated newsletter content...');
    const validArticleUrls = new Set(sortedArticles.map(article => article.link));
    const usedUrls = new Set<string>();
    let duplicateUrls = 0;
    
    const fixedTopics = newsletterData.topics.map((topic) => {
      let currentTopic = { ...topic };
      
      // Handle URL duplicates
      if (usedUrls.has(currentTopic.sourceUrl)) {
        console.warn(`Background: Duplicate URL detected for topic "${currentTopic.headline}": ${currentTopic.sourceUrl}`);
        duplicateUrls++;
        
        // Find an unused article
        const unusedArticle = sortedArticles.find(article => 
          !usedUrls.has(article.link) && validArticleUrls.has(article.link)
        );
        
        if (unusedArticle) {
          console.log(`Background: Replaced duplicate URL for topic "${currentTopic.headline}": ${currentTopic.sourceUrl} -> ${unusedArticle.link}`);
          currentTopic = { ...currentTopic, sourceUrl: unusedArticle.link };
        }
      }
      
      usedUrls.add(currentTopic.sourceUrl);
      return currentTopic;
    });
    
    if (duplicateUrls > 0) {
      console.log(`Background: Fixed ${duplicateUrls} duplicate URLs in newsletter`);
      newsletterData.topics = fixedTopics;
    }

    // Save to database
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

    console.log(`Background: Newsletter saved with ID: ${savedNewsletter._id}`);

    job.progress = 100;
    job.status = 'completed';
    job.result = {
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
      },
      fallbackNotification: filterResult.usedFallback ? {
        usedFallback: true,
        originalPeriod: filterResult.originalPeriod,
        fallbackPeriod: filterResult.fallbackPeriod,
        message: filterResult.fallbackMessage
      } : {
        usedFallback: false,
        originalPeriod: filterResult.originalPeriod
      }
    };

    console.log(`Background: Job ${jobId} completed successfully`);

  } catch (error) {
    console.error(`Background job ${jobId} failed:`, error);
    if (job) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error during generation';
      job.progress = 0;
    }
  }
}