import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { fetchAllFeeds, deduplicateArticles, sortArticlesByDate, filterArticlesByTimePeriod, processAndValidateArticles } from '@/lib/rss-parser';
import { generateNewsletterContent, checkRateLimit } from '@/lib/ai-processors';
import { RSS_FEEDS } from '@/config/rss-feeds';
import { createNewsletter, connectDB, getUserSettings } from '@/lib/db';
import { autoCleanupIfNeeded } from '@/lib/database-cleanup';
import { APIResponse, NewsletterGenerationResponse, CustomRSSFeed, NewsletterCategory } from '@/types';

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
    const maxArticles = userSettings?.preferences?.maxArticles || 5; // maxArticles controls number of articles
    const language = userSettings?.preferences?.language || 'english';
    const preferredCategories = userSettings?.preferences?.preferredCategories || ['business', 'product', 'technology'];

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

    // Auto-cleanup database if needed (runs in background)
    autoCleanupIfNeeded().catch(error => 
      console.log('Background cleanup failed:', error)
    );

    // Step 1: Get enabled RSS feeds based on preferred categories
    const customFeeds = userSettings?.rssFeeds?.custom || [];
    
    // Filter RSS feeds by preferred categories first
    const categoryFilteredFeeds = RSS_FEEDS.filter(feed => 
      preferredCategories.includes(feed.category as NewsletterCategory)
    );
    
    // When using preferred categories, use ALL feeds from those categories (ignore individual RSS feed settings)
    let enabledFeeds = categoryFilteredFeeds.filter(feed => feed.enabled);
    
    // Add enabled custom feeds (custom feeds can be from any category)
    enabledFeeds = [...enabledFeeds, ...customFeeds.filter((feed: CustomRSSFeed) => feed.enabled)];
    
    console.log(`Filtered to ${enabledFeeds.length} feeds based on preferred categories:`, preferredCategories);

    console.log(`Fetching RSS feeds... (${enabledFeeds.length} enabled feeds)`);
    console.log('Final enabled feeds:', enabledFeeds.map(f => f.name));
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

    // Step 2.5: Validate URLs to ensure all articles have working links
    console.log('Validating article URLs...');
    const validatedArticles = await processAndValidateArticles(allArticles, {
      validateURLs: true,
      fixBrokenLinks: true,
      batchSize: 10,
      skipValidationPatterns: [
        // MIT Technology Review problematic URL patterns
        'technologyreview\\.com/\\d{4}/\\d{2}/\\d{2}/[^/]+/$'
      ]
    });
    
    const removedArticles = allArticles.length - validatedArticles.length;
    if (removedArticles > 0) {
      console.log(`Removed ${removedArticles} articles with broken or invalid URLs`);
    }

    if (validatedArticles.length === 0) {
      return NextResponse.json<APIResponse>({ 
        success: false, 
        error: 'No articles with valid URLs found' 
      }, { status: 400 });
    }

    // Step 3: Deduplicate and filter articles by time period
    const uniqueArticles = deduplicateArticles(validatedArticles);
    const timePeriod = userSettings?.preferences?.timePeriod || '24hours';
    // Require at least half the requested articles to use the strict time filter, otherwise fallback to longer periods
    const minArticlesForStrict = Math.max(3, Math.ceil(maxArticles * 0.5)); // At least 3 articles or half of requested amount
    const filterResult = filterArticlesByTimePeriod(uniqueArticles, timePeriod, minArticlesForStrict);
    
    const sortedArticles = sortArticlesByDate(filterResult.articles);
    
    if (sortedArticles.length === 0) {
      return NextResponse.json<APIResponse>({ 
        success: false, 
        error: 'No articles found after filtering' 
      }, { status: 400 });
    }

    console.log(`Processing ${sortedArticles.length} articles (filtered by ${timePeriod}) to generate ${maxArticles} articles in ${language}`);

    // Step 4: Generate newsletter content
    console.log(`Generating ${maxArticles} newsletter articles with ${llmProvider} in ${language}...`);
    const generationResult = await generateNewsletterContent(sortedArticles, llmProvider, {
      maxTopics: Math.min(maxArticles, sortedArticles.length), // Don't request more articles than we have
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

    // Step 4.5: Validate and fix URLs in newsletter topics
    console.log('Validating URLs in generated newsletter content...');
    const validArticleUrls = new Set(sortedArticles.map(article => article.link));
    
    // Check if any URLs in the newsletter don't exist in our original articles
    let invalidUrls = 0;
    const fixedTopics = newsletterData.topics.map(topic => {
      if (!validArticleUrls.has(topic.sourceUrl)) {
        console.warn(`Invalid URL detected in topic "${topic.headline}": ${topic.sourceUrl}`);
        invalidUrls++;
        
        // Try to find a matching article by title similarity
        const matchingArticle = sortedArticles.find(article => 
          article.title.toLowerCase().includes(topic.headline.toLowerCase().split(' ')[0]) ||
          topic.headline.toLowerCase().includes(article.title.toLowerCase().split(' ')[0])
        );
        
        if (matchingArticle) {
          console.log(`Fixed URL for topic "${topic.headline}": ${topic.sourceUrl} -> ${matchingArticle.link}`);
          return { ...topic, sourceUrl: matchingArticle.link };
        } else {
          // Use the first available article as fallback
          console.log(`Using fallback URL for topic "${topic.headline}": ${sortedArticles[0].link}`);
          return { ...topic, sourceUrl: sortedArticles[0].link };
        }
      }
      return topic;
    });
    
    if (invalidUrls > 0) {
      console.log(`Fixed ${invalidUrls} invalid URLs in newsletter`);
      newsletterData.topics = fixedTopics;
    }

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

      // Step 6: Check for article count notification
      const generatedArticles = newsletterData.topics.length;
      let topicCountNotification = undefined;
      
      if (generatedArticles < maxArticles) {
        topicCountNotification = {
          requested: maxArticles,
          generated: generatedArticles,
          message: language === 'hebrew' 
            ? `נוצרו ${generatedArticles} כתבות במקום ${maxArticles} שהוזמנו בגלל מחסור בכתבות עדכניות`
            : `Generated ${generatedArticles} articles instead of ${maxArticles} requested due to insufficient recent articles`
        };
        console.log(`Article count notification: Generated ${generatedArticles} articles instead of ${maxArticles} requested`);
      }

      // Step 7: Return successful response
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
        },
        fallbackNotification: filterResult.usedFallback ? {
          usedFallback: true,
          originalPeriod: filterResult.originalPeriod,
          fallbackPeriod: filterResult.fallbackPeriod,
          message: filterResult.fallbackMessage
        } : {
          usedFallback: false,
          originalPeriod: filterResult.originalPeriod
        },
        topicCountNotification
      };

      return NextResponse.json(response);

    } catch (dbError) {
      console.error('Database error:', dbError);
      
      // If it's a category validation error, try to save with normalized categories
      if (dbError instanceof Error && dbError.message.includes('category') && dbError.message.includes('not a valid enum value')) {
        try {
          console.log('Attempting to save newsletter with category fallbacks...');
          const { validateAndNormalizeTopics } = await import('@/lib/category-manager');
          const normalizedTopics = await validateAndNormalizeTopics(newsletterData.topics);
          
          const savedNewsletter = await createNewsletter({
            userId,
            title: newsletterData.newsletterTitle,
            topics: normalizedTopics,
            llmUsed: llmProvider,
            introduction: newsletterData.introduction,
            conclusion: newsletterData.conclusion,
            stats: {
              sourcesAnalyzed: sortedArticles.length,
              generationTime: Date.now() - startTime
            }
          });
          
          console.log(`Newsletter saved with normalized categories: ${savedNewsletter._id}`);
          
          // Continue with success response
          const generatedArticles = normalizedTopics.length;
          let topicCountNotification = undefined;
          
          if (generatedArticles < maxArticles) {
            topicCountNotification = {
              requested: maxArticles,
              generated: generatedArticles,
              message: language === 'hebrew' 
                ? `נוצרו ${generatedArticles} כתבות במקום ${maxArticles} שהוזמנו בגלל מחסור בכתבות עדכניות`
                : `Generated ${generatedArticles} articles instead of ${maxArticles} requested due to insufficient recent articles`
            };
          }
          
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
              topics: normalizedTopics,
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
            },
            topicCountNotification
          };
          
          return NextResponse.json(response);
          
        } catch (fallbackError) {
          console.error('Fallback category normalization also failed:', fallbackError);
          // Fall through to original error handling
        }
      }
      
      // Check for article count notification even in error case
      const generatedArticles = newsletterData.topics.length;
      let topicCountNotification = undefined;
      
      if (generatedArticles < maxArticles) {
        topicCountNotification = {
          requested: maxArticles,
          generated: generatedArticles,
          message: language === 'hebrew' 
            ? `נוצרו ${generatedArticles} כתבות במקום ${maxArticles} שהוזמנו בגלל מחסור בכתבות עדכניות`
            : `Generated ${generatedArticles} articles instead of ${maxArticles} requested due to insufficient recent articles`
        };
      }
      
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
        },
        fallbackNotification: filterResult.usedFallback ? {
          usedFallback: true,
          originalPeriod: filterResult.originalPeriod,
          fallbackPeriod: filterResult.fallbackPeriod,
          message: filterResult.fallbackMessage
        } : {
          usedFallback: false,
          originalPeriod: filterResult.originalPeriod
        },
        topicCountNotification
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