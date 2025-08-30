import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { fetchAllFeedsWithEnhancement, deduplicateArticles, sortArticlesByDate, filterArticlesByTimePeriod, FilterResult } from '@/lib/rss-parser';
import { generateNewsletterContent, checkRateLimit } from '@/lib/ai-processors';
import { monitoredGeneration } from '@/lib/performance-monitor';
import { RSS_FEEDS } from '@/config/rss-feeds';
import { createNewsletter, connectDB, getUserSettings } from '@/lib/db';
import { autoCleanupIfNeeded } from '@/lib/database-cleanup';
import { validateNewsletterQuality, autoFixTopicIssues } from '@/lib/selective-quality-validator';
import { analyzeTrends, weightArticlesByQuality } from '@/lib/trend-analyzer';
import { applySourceDiversity, DEFAULT_DIVERSITY_CONFIG } from '@/lib/source-diversity';
import { enhancedTimeFilter, DEFAULT_FRESHNESS_CONFIG } from '@/lib/freshness-scorer';
import { APIResponse, NewsletterGenerationResponse, CustomRSSFeed, NewsletterCategory } from '@/types';

// Configure runtime for longer timeout (Free plan: up to 60s)
export const maxDuration = 60; // seconds

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json<APIResponse>({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // Always use Gemini - single provider for reliability

    // Fetch user settings for preferences
    const userSettings = await getUserSettings(userId);
    // Always use Gemini - single provider for reliability
    const llmProvider = 'gemini';
    console.log(`📊 USING GEMINI: Reliable AI provider for newsletter generation`);
    const maxArticles = userSettings?.preferences?.maxArticles || 5; // Use user preference or default to 5
    const language = userSettings?.preferences?.language || 'english';
    const preferredCategories = userSettings?.preferences?.preferredCategories || ['business', 'technology', 'development'];

    // Check rate limits
    const rateCheck = checkRateLimit();
    if (!rateCheck.allowed) {
      return NextResponse.json<APIResponse>({ 
        success: false, 
        error: rateCheck.message || 'Rate limit exceeded' 
      }, { status: 429 });
    }

    const startTime = Date.now();
    console.log(`🚀 Starting newsletter generation for user ${userId} with ${llmProvider}`);
    console.log(`🎥 User preferences: ${maxArticles} articles, ${language} language, categories: ${preferredCategories.join(', ')}`);

    // Auto-cleanup database if needed (runs in background)
    autoCleanupIfNeeded().catch(error => 
      console.log('Background cleanup failed:', error)
    );

    // Step 1: Get enabled RSS feeds based on both preferred categories AND user's individual feed settings
    const customFeeds = userSettings?.rssFeeds?.custom || [];
    const userEnabledFeeds = userSettings?.rssFeeds?.enabled || [];
    const userDisabledFeeds = userSettings?.rssFeeds?.disabled || [];
    
    // Filter RSS feeds by preferred categories first
    const categoryFilteredFeeds = RSS_FEEDS.filter(feed => 
      preferredCategories.includes(feed.category as NewsletterCategory)
    );
    
    // Then filter by user's individual RSS feed settings (enabled/disabled toggles)
    let enabledFeeds = categoryFilteredFeeds.filter(feed => {
      // If user has explicitly enabled/disabled this feed, respect that choice
      if (userEnabledFeeds.includes(feed.id)) return true;
      if (userDisabledFeeds.includes(feed.id)) return false;
      
      // Otherwise, use the default enabled state from the feed configuration
      return feed.enabled;
    });
    
    // Add enabled custom feeds (custom feeds can be from any category)
    enabledFeeds = [...enabledFeeds, ...customFeeds.filter((feed: CustomRSSFeed) => feed.enabled)];
    
    console.log(`🔍 DEBUGGING TOPIC SELECTION:`);
    console.log(`User preferred categories:`, preferredCategories);
    console.log(`Total RSS feeds available:`, RSS_FEEDS.length);
    console.log(`Filtered to ${enabledFeeds.length} feeds based on preferred categories and user settings`);
    console.log(`Enabled feeds by category:`, enabledFeeds.reduce((acc, feed) => {
      acc[feed.category] = (acc[feed.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>));
    console.log(`Final enabled feeds:`, enabledFeeds.map(f => `${f.name} (${f.category})`));

    console.log(`📰 Step 1/6: Fetching RSS feeds with enhancement... (${enabledFeeds.length} enabled feeds)`);
    console.log('Final enabled feeds:', enabledFeeds.map(f => f.name));
    
    // Use enhanced RSS processing with parallel optimizations and content quality analysis
    const feedFetchPromise = fetchAllFeedsWithEnhancement(enabledFeeds, {
      enhanceContent: true, // Enable full content extraction
      maxArticlesPerFeed: 30, // Allow more articles per feed for better selection
      qualityThreshold: 50, // Lowered threshold for more articles to pass
      parallelProcessing: true // Use parallel processing for speed
    });
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Enhanced feed fetching timeout')), 20000) // 20 second timeout for enhanced processing
    );
    
    const enhancedResults = await Promise.race([feedFetchPromise, timeoutPromise]) as Awaited<ReturnType<typeof fetchAllFeedsWithEnhancement>>;
    
    // Extract both regular feed results and enhanced content
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const feedResults: any[] = enhancedResults.feeds || [];
    const enhancedContent = enhancedResults.enhancedContent;
    
    if (!feedResults || feedResults.length === 0) {
      console.error('🚫 No RSS feeds could be fetched successfully');
      return NextResponse.json<APIResponse>({ 
        success: false, 
        error: 'Unable to fetch content from any RSS feeds. This might be due to temporary network issues or feed unavailability. Please try again in a few minutes.' 
      }, { status: 500 });
    }
    
    // Step 2: Aggregate and process articles (use enhanced content if available)
    let allArticles: Array<{
      title: string;
      link: string;
      pubDate: string;
      contentSnippet: string;
      content: string;
      creator: string;
      categories: string[];
      source: string;
      qualityScore?: number;
      wordCount?: number;
      readingTime?: number;
    }> = [];
    let useEnhancedContent = false;
    const minArticlesThreshold = Math.max(maxArticles, 5); // Need at least 5 articles for good generation
    
    if (enhancedContent && enhancedContent.length >= minArticlesThreshold) {
      // Use enhanced content when we have enough high-quality articles
      allArticles = enhancedContent.map(enhanced => ({
        title: enhanced.title,
        link: enhanced.sourceUrl,
        pubDate: enhanced.publishedAt,
        contentSnippet: enhanced.excerpt,
        content: enhanced.content, // Full article content
        creator: enhanced.author || '',
        categories: enhanced.topics,
        source: 'Enhanced Processing',
        qualityScore: enhanced.quality.score,
        wordCount: enhanced.wordCount,
        readingTime: enhanced.readingTime
      }));
      useEnhancedContent = true;
      console.log(`🚀 USING ENHANCED CONTENT: ${allArticles.length} high-quality articles`);
    } else if (enhancedContent && enhancedContent.length > 0) {
      // Hybrid approach: Use enhanced content + supplement with standard RSS content
      const enhancedArticles = enhancedContent.map(enhanced => ({
        title: enhanced.title,
        link: enhanced.sourceUrl,
        pubDate: enhanced.publishedAt,
        contentSnippet: enhanced.excerpt,
        content: enhanced.content,
        creator: enhanced.author || '',
        categories: enhanced.topics,
        source: 'Enhanced Processing',
        qualityScore: enhanced.quality.score,
        wordCount: enhanced.wordCount,
        readingTime: enhanced.readingTime
      }));
      
      // Get standard articles to supplement
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const standardArticles = (feedResults as any[])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((result: any) => result.articles.success)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .flatMap((result: any) => result.articles.data)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((article: any) => article.title && article.link)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((article: any) => ({
          title: article.title,
          link: article.link,
          pubDate: article.pubDate,
          contentSnippet: article.contentSnippet,
          content: typeof article.content === 'string' ? article.content : article.contentSnippet,
          creator: article.creator,
          categories: article.categories,
          source: article.source
        }));
      
      // Filter out articles that are already enhanced
      const enhancedUrls = new Set(enhancedArticles.map(a => a.link));
      const supplementaryArticles = standardArticles
        .filter(article => !enhancedUrls.has(article.link))
        .slice(0, minArticlesThreshold - enhancedArticles.length);
      
      allArticles = [...enhancedArticles, ...supplementaryArticles];
      useEnhancedContent = false; // Use standard processing mode since we have mixed content
      console.log(`🔄 USING HYBRID CONTENT: ${enhancedArticles.length} enhanced + ${supplementaryArticles.length} standard = ${allArticles.length} total articles`);
    } else {
      // Fall back to regular RSS content
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const standardArticles = (feedResults as any[])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((result: any) => result.articles.success)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .flatMap((result: any) => result.articles.data)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((article: any) => article.title && article.link)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((article: any) => ({
          title: article.title,
          link: article.link,
          pubDate: article.pubDate,
          contentSnippet: article.contentSnippet,
          content: typeof article.content === 'string' ? article.content : article.contentSnippet,
          creator: article.creator,
          categories: article.categories,
          source: article.source
        }));
      allArticles = standardArticles;
      console.log(`📰 Using standard RSS content: ${allArticles.length} articles`);
    }

    console.log(`📊 ARTICLE PROCESSING SUMMARY:`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    console.log(`Processing ${allArticles.length} articles from ${(feedResults as any[]).length} feeds`);
    console.log(`Enhanced content: ${useEnhancedContent ? 'YES' : 'NO'}`);
    console.log(`RSS Processing stats:`, enhancedResults.stats);
    
    if (useEnhancedContent) {
      // Log quality distribution for enhanced content
      const qualityScores = allArticles.map(a => a.qualityScore).filter((score): score is number => score !== undefined);
      if (qualityScores.length > 0) {
        const avgQuality = qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;
        const minQuality = Math.min(...qualityScores);
        const maxQuality = Math.max(...qualityScores);
        console.log(`Quality distribution: avg=${avgQuality.toFixed(1)}, range=${minQuality}-${maxQuality}`);
        
        // Log word count statistics
        const wordCounts = allArticles.map(a => a.wordCount).filter((count): count is number => count !== undefined);
        if (wordCounts.length > 0) {
          const avgWords = wordCounts.reduce((sum, count) => sum + count, 0) / wordCounts.length;
          console.log(`Content depth: avg=${Math.round(avgWords)} words per article`);
        }
      }
    }
    
    // Show articles per feed for debugging
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const articlesPerFeed = feedResults.map((result: any) => ({
      name: result.feed.name,
      count: result.articles.success ? result.articles.data.length : 0,
      success: result.articles.success,
      reliability: result.feed.performance?.reliability || 'N/A'
    }));
    
    console.log(`Articles per feed:`, articlesPerFeed);
    console.log(`Average articles per feed: ${Math.round(allArticles.length / feedResults.length)}`);
    console.log(`Target final articles: ${maxArticles}`);

    if (allArticles.length === 0) {
      console.warn('⚠️ No articles found after processing feeds');
      const feedNames = enabledFeeds.map(f => f.name).join(', ');
      return NextResponse.json<APIResponse>({ 
        success: false, 
        error: `No recent articles found from your selected feeds (${feedNames}). Try adjusting your category preferences or check back later for new content.` 
      }, { status: 400 });
    }

    // Step 2.5: Skip URL validation to save time (2-3 seconds)
    console.log('Skipping URL validation for faster generation...');
    const validatedArticles = allArticles; // Use all articles without validation
    
    console.log(`Using all ${validatedArticles.length} articles without URL validation`);

    if (validatedArticles.length === 0) {
      console.warn('⚠️ No valid articles after URL validation');
      return NextResponse.json<APIResponse>({ 
        success: false, 
        error: 'No articles with accessible URLs found. The feeds may contain broken links or temporary access issues.' 
      }, { status: 400 });
    }

    // Step 3: Deduplicate and apply enhanced filtering
    const uniqueArticles = deduplicateArticles(validatedArticles);
    
    console.log('🔄 Step 3/6: Applying enhanced article selection with diversity and freshness controls...');
    
    // Step 3a: Apply freshness scoring to prefer recent articles
    const freshnessConfig = {
      ...DEFAULT_FRESHNESS_CONFIG,
      strictMode: true, // Heavily penalize older articles
      minFreshnessScore: 15 // Allow slightly older articles if needed
    };
    
    const freshResult = enhancedTimeFilter(uniqueArticles, Math.min(30, uniqueArticles.length), freshnessConfig);
    console.log(`🕐 Freshness filter: Selected ${freshResult.selectedArticles.length} articles (avg freshness: ${freshResult.freshnessStats.averageFreshness.toFixed(1)}/100)`);
    
    // Step 3b: Apply source diversity controls
    const diversityConfig = {
      ...DEFAULT_DIVERSITY_CONFIG,
      maxArticlesPerSource: 2, // Limit TechCrunch and others to max 2 articles
      maxArticlesPerCategory: Math.ceil(maxArticles * 0.6), // Allow up to 60% from any category
      diversityWeight: 0.4 // Strong diversity preference
    };
    
    const diversityResult = applySourceDiversity(freshResult.selectedArticles, diversityConfig);
    console.log(`🎯 Diversity control: Selected ${diversityResult.selectedArticles.length} articles (diversity score: ${diversityResult.diversityScore}/100)`);
    
    // Step 3c: Fallback to time period filtering if needed
    // Convert ExtractedContent to ParsedArticle format for sorting
    const diversityArticles = diversityResult.selectedArticles.map(article => {
      if ('sourceUrl' in article) {
        // Convert ExtractedContent to ParsedArticle
        return {
          title: article.title,
          link: article.sourceUrl,
          pubDate: article.publishedAt,
          contentSnippet: article.excerpt,
          content: article.content,
          creator: article.author || '',
          categories: article.topics || [],
          source: 'Enhanced Processing'
        };
      }
      return article; // Already ParsedArticle
    });
    
    let sortedArticles = sortArticlesByDate(diversityArticles);
    let filterResult: FilterResult = { 
      articles: sortedArticles, 
      usedFallback: false, 
      originalPeriod: 'Enhanced Selection'
    };
    
    // If we don't have enough articles after diversity filtering, fall back to traditional time filtering
    if (sortedArticles.length < Math.max(maxArticles, 3)) {
      console.log(`⚠️ Only ${sortedArticles.length} articles after diversity control, falling back to time period filtering...`);
      const timePeriod = '3days';
      const minArticlesForStrict = Math.max(maxArticles, 5);
      filterResult = filterArticlesByTimePeriod(uniqueArticles, timePeriod, minArticlesForStrict);
      sortedArticles = sortArticlesByDate(filterResult.articles);
      
      // Still apply some diversity control on the fallback
      const fallbackDiversityResult = applySourceDiversity(sortedArticles, {
        ...diversityConfig,
        maxArticlesPerSource: 3, // Slightly more permissive for fallback
        diversityWeight: 0.2 // Less strict diversity
      });
      
      // Convert fallback articles if needed
      const fallbackArticles = fallbackDiversityResult.selectedArticles.map(article => {
        if ('sourceUrl' in article) {
          return {
            title: article.title,
            link: article.sourceUrl,
            pubDate: article.publishedAt,
            contentSnippet: article.excerpt,
            content: article.content,
            creator: article.author || '',
            categories: article.topics || [],
            source: 'Enhanced Processing'
          };
        }
        return article;
      });
      
      sortedArticles = sortArticlesByDate(fallbackArticles);
      console.log(`🔄 Fallback diversity: ${sortedArticles.length} articles selected`);
    }
    
    // Log the final source distribution for debugging
    const sourceDistribution = sortedArticles.reduce((acc, article) => {
      const source = article.source || 'Unknown';
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log(`📊 Final source distribution:`, Object.entries(sourceDistribution)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([source, count]) => `${source}(${count})`)
      .join(', ')
    );

    // Step 3.5: Advanced Analysis (when using enhanced content)
    let trendAnalysis, weightedArticles;
    if (useEnhancedContent && sortedArticles.length > 0) {
      console.log('📈 Step 3/6: Performing trend analysis and quality weighting...');
      
      // Use enhanced content or sorted articles for analysis
      const articlesForAnalysis = useEnhancedContent && enhancedContent 
        ? enhancedContent 
        : sortedArticles;
      
      // Analyze trends across all articles
      trendAnalysis = analyzeTrends(articlesForAnalysis, 72); // 72-hour window
      
      // Weight articles by quality factors
      weightedArticles = weightArticlesByQuality(articlesForAnalysis, trendAnalysis);
      
      console.log('🔥 Trending topics:', trendAnalysis.emergingTopics.slice(0, 3).map(t => `${t.topic} (${t.frequency})`).join(', '));
      console.log('🏆 Top entities:', trendAnalysis.topEntities.slice(0, 3).map(e => `${e.entity} (${e.mentions})`).join(', '));
      console.log('📈 Quality metrics:', `Authority: ${trendAnalysis.qualityMetrics.averageAuthorityScore}/100, Freshness: ${trendAnalysis.temporalInsights.freshnessScore}/100`);
      
      // Use top-weighted articles for AI generation
      const topWeightedArticles = weightedArticles.slice(0, 20).map(w => w.article);
      console.log(`🎯 Selected top ${topWeightedArticles.length} weighted articles for AI analysis`);
      
      // Log reasoning for top articles
      weightedArticles.slice(0, 5).forEach((weighted, i) => {
        console.log(`${i + 1}. "${weighted.article.title}" (${weighted.weights.composite.toFixed(1)} pts): ${weighted.reasoning.join(', ')}`);
      });
    }
    
    if (sortedArticles.length === 0) {
      return NextResponse.json<APIResponse>({ 
        success: false, 
        error: 'No articles found after filtering' 
      }, { status: 400 });
    }

    // Gemini Optimized: Limit to 10 most recent articles for optimal reliability
    if (sortedArticles.length > 10) {
      console.log(`GEMINI OPTIMIZED: Limiting from ${sortedArticles.length} to 10 articles for reliability`);
      sortedArticles = sortedArticles.slice(0, 10);
    }

    console.log(`🤖 Step 4/6: AI Generation - Processing ${sortedArticles.length} articles (enhanced selection) to generate ${maxArticles} articles in ${language}`);

    // Step 4: Generate newsletter content with Gemini (Single Reliable Attempt)
    console.log(`GEMINI GENERATION: Single reliable attempt in ${language}...`);
    console.log(`🎯 CATEGORY CONSTRAINT: Only allowing topics from categories:`, preferredCategories);
    
    let generationResult;
    // Intelligent topic request calculation: don't limit by article count for better generation
    let topicsToRequest = maxArticles; // Request the full amount needed
    let generationAttempt = 0;
    const maxGenerationAttempts = 1; // Single attempt for reliability
    
    // Prepare articles for AI generation (enhanced or standard) - define at higher scope
    const articlesForGeneration = useEnhancedContent && enhancedContent 
      ? enhancedContent 
      : sortedArticles;
    
    // Try generating with increasing topic count to compensate for category filtering
    while (generationAttempt < maxGenerationAttempts) {
      generationAttempt++;
      console.log(`Generation attempt ${generationAttempt}/${maxGenerationAttempts}, requesting ${topicsToRequest} topics`);
      
      try {
        // Use enhanced generation if we have enhanced content
        const generationOptions = {
          maxTopics: topicsToRequest,
          language,
          preferredCategories,
          fastMode: !useEnhancedContent, // Use detailed mode if we have enhanced content
          timeout: useEnhancedContent ? 20000 : 15000, // More time for enhanced processing
          useEnhancedContent,
          enhancedPrompts: useEnhancedContent // Use enhanced prompts with enhanced content
        };
        
        console.log(`🎯 Generation mode: ${useEnhancedContent ? 'Enhanced with full content analysis' : 'Standard fast mode'}`);
        
        generationResult = await monitoredGeneration(
          'gemini',
          userId,
          () => generateNewsletterContent(articlesForGeneration, generationOptions)
        );
      } catch (error) {
        console.error(`Gemini generation attempt ${generationAttempt} failed:`, error);
        generationResult = { success: false, error: error instanceof Error ? error.message : 'Gemini generation failed' };
      }
      
      // If generation successful, check if we need to retry due to category filtering
      if (generationResult.success && generationResult.data) {
        const generatedTopics = generationResult.data.topics.length;
        console.log(`AI generated ${generatedTopics} topics before category filtering`);
        
        // Estimate how many will be filtered out and break if we have enough or this is the last attempt
        if (generatedTopics >= maxArticles * 0.8 || generationAttempt === maxGenerationAttempts) {
          break;
        }
        
        // Request more topics for next attempt to compensate for expected filtering
        const expectedFilteredCount = Math.max(1, Math.ceil(generatedTopics * 0.3)); // Estimate 30% might be filtered
        topicsToRequest = Math.min(maxArticles + expectedFilteredCount, 15); // Cap at 15 topics max (increased from 10)
        console.log(`Planning to request ${topicsToRequest} topics next time to compensate for category filtering`);
      } else {
        break; // If generation fails, no point in retrying
      }
    }

    if (!generationResult || !generationResult.success || !generationResult.data) {
      console.error('Newsletter generation failed:', generationResult?.error);
      return NextResponse.json<APIResponse>({ 
        success: false, 
        error: generationResult?.error || 'Failed to generate newsletter content' 
      }, { status: 500 });
    }

    const newsletterData = generationResult.data;

    // Step 4.5: Smart category validation - map invalid categories instead of removing topics
    if (preferredCategories.length > 0) {
      const originalTopicCount = newsletterData.topics.length;
      console.log(`🔍 CATEGORY VALIDATION: Checking ${originalTopicCount} topics against preferred categories: [${preferredCategories.join(', ')}]`);
      
      const validTopics = newsletterData.topics.map(topic => {
        const topicCategory = topic.category.toLowerCase();
        const isValid = preferredCategories.some((cat: string) => cat.toLowerCase() === topicCategory);
        
        if (!isValid) {
          // Instead of removing, map to the closest preferred category
          let mappedCategory = preferredCategories[0]; // Default fallback
          
          // Smart category mapping based on content
          const categoryMap: Record<string, string> = {
            'business': preferredCategories.includes('business') ? 'business' : preferredCategories[0],
            'technology': preferredCategories.includes('technology') ? 'technology' : preferredCategories[0],
            'development': preferredCategories.includes('development') ? 'development' : 
                          preferredCategories.includes('technology') ? 'technology' : preferredCategories[0],
            'enterprise': preferredCategories.includes('enterprise') ? 'enterprise' : 
                         preferredCategories.includes('business') ? 'business' : preferredCategories[0],
            'consumer': preferredCategories.includes('consumer') ? 'consumer' : 
                       preferredCategories.includes('product') ? 'product' : preferredCategories[0],
          };
          
          mappedCategory = categoryMap[topicCategory] || preferredCategories[0];
          
          console.log(`🔄 MAPPING CATEGORY: "${topic.headline}" from "${topic.category}" to "${mappedCategory}"`);
          return { ...topic, category: mappedCategory };
        }
        
        return topic;
      });
      
      newsletterData.topics = validTopics;
      console.log(`✅ CATEGORY MAPPING: Processed ${originalTopicCount} topics, all mapped to preferred categories`);
    }

    // Step 4.6: Validate and fix URLs in newsletter topics + Remove duplicates
    console.log('Validating URLs and removing duplicates in generated newsletter content...');
    const validArticleUrls = new Set(sortedArticles.map(article => article.link));
    const usedUrls = new Set<string>();
    
    // Check if any URLs in the newsletter don't exist in our original articles
    let invalidUrls = 0;
    let duplicateUrls = 0;
    
    const fixedTopics = newsletterData.topics.map((topic) => {
      let currentTopic = { ...topic };
      
      // Step 1: Validate URL exists in source articles
      if (!validArticleUrls.has(currentTopic.sourceUrl)) {
        console.warn(`Invalid URL detected in topic "${currentTopic.headline}": ${currentTopic.sourceUrl}`);
        invalidUrls++;
        
        // Try to find a matching article by title similarity (require minimum 3 words match)
        const headlineWords = currentTopic.headline.toLowerCase().split(' ').filter(word => word.length > 2);
        const matchingArticle = sortedArticles.find(article => {
          const articleWords = article.title.toLowerCase().split(' ').filter(word => word.length > 2);
          const matchingWords = headlineWords.filter(word => 
            articleWords.some(articleWord => articleWord.includes(word) || word.includes(articleWord))
          );
          return matchingWords.length >= Math.min(3, Math.floor(headlineWords.length * 0.5)); // At least 3 words or 50% match
        });
        
        if (matchingArticle && !usedUrls.has(matchingArticle.link)) {
          console.log(`Fixed URL for topic "${currentTopic.headline}": ${currentTopic.sourceUrl} -> ${matchingArticle.link}`);
          currentTopic = { ...currentTopic, sourceUrl: matchingArticle.link };
        } else {
          console.warn(`No matching article found for topic "${currentTopic.headline}" - this topic may have inaccurate content`);
        }
      }
      
      // Step 2: Handle URL duplicates
      if (usedUrls.has(currentTopic.sourceUrl)) {
        console.warn(`Duplicate URL detected for topic "${currentTopic.headline}": ${currentTopic.sourceUrl}`);
        duplicateUrls++;
        
        // Find an unused article from the same category or any category
        const unusedArticle = sortedArticles.find(article => 
          !usedUrls.has(article.link) && validArticleUrls.has(article.link)
        );
        
        if (unusedArticle) {
          console.log(`Replaced duplicate URL for topic "${currentTopic.headline}": ${currentTopic.sourceUrl} -> ${unusedArticle.link}`);
          currentTopic = { ...currentTopic, sourceUrl: unusedArticle.link };
        } else {
          console.warn(`No unused URLs available, keeping duplicate for topic "${currentTopic.headline}"`);
        }
      }
      
      // Mark URL as used
      usedUrls.add(currentTopic.sourceUrl);
      return currentTopic;
    });
    
    if (invalidUrls > 0) {
      console.log(`Fixed ${invalidUrls} invalid URLs in newsletter`);
    }
    if (duplicateUrls > 0) {
      console.log(`Fixed ${duplicateUrls} duplicate URLs in newsletter`);
    }
    
    newsletterData.topics = fixedTopics;

    // Step 4.6: Selective Quality Validation (only for final selected articles)
    if (useEnhancedContent) {
      console.log('🔍 Performing selective quality validation on final topics...');
      try {
        const validationResult = await validateNewsletterQuality(
          newsletterData.topics,
          articlesForGeneration,
          {
            validateUrls: true,
            checkContentAlignment: true,
            validateCategories: true,
            allowedCategories: preferredCategories.length > 0 ? preferredCategories : undefined,
            strictMode: false // Allow warnings, only block errors
          }
        );
        
        console.log(`✅ Quality validation: ${validationResult.validTopics.length}/${validationResult.validationStats.totalTopics} topics passed`);
        
        if (validationResult.invalidTopics.length > 0) {
          const errorTopics = validationResult.invalidTopics.filter(t => t.severity === 'error');
          if (errorTopics.length > 0) {
            console.log(`🔧 Auto-fixing ${errorTopics.length} topics with errors...`);
            newsletterData.topics = autoFixTopicIssues(newsletterData.topics, articlesForGeneration);
          }
        }
        
        // Log validation statistics
        console.log(`📊 Validation stats: URLs: ${validationResult.validationStats.urlValidation.valid}✅/${validationResult.validationStats.urlValidation.invalid}❌, Content alignment: ${validationResult.validationStats.contentAlignment.aligned}✅/${validationResult.validationStats.contentAlignment.misaligned}❌`);
        
      } catch (validationError) {
        console.error('Quality validation failed:', validationError);
        // Continue without blocking - validation is enhancement, not requirement
      }
    }

    // Step 4.7: Map AI-generated categories to standard categories (but preserve diversity)
    // Create a mapping from various category names to standard ones
    type ValidCategory = 'business' | 'technology' | 'research' | 'product' | 'enterprise' | 'consumer' | 'security' | 'development';
    const categoryMapping: Record<string, ValidCategory> = {
      // Hebrew mappings
      'פיתוח': 'development',
      'אבטחה': 'security', 
      'מוצר': 'product',
      'עסקים': 'business',
      'טכנולוגיה': 'technology',
      'מחקר': 'research',
      'ארגונים': 'enterprise',
      'צרכנים': 'consumer',
      // English mappings (in case AI uses English)
      'development': 'development',
      'security': 'security',
      'product': 'product', 
      'business': 'business',
      'technology': 'technology',
      'research': 'research',
      'enterprise': 'enterprise',
      'consumer': 'consumer',
      // Legacy category mappings (redirect to closest match)
      'policy': 'business',
      'analysis': 'business',
      'innovation': 'business',
      'news': 'technology',
    };

    console.log('Mapping AI-generated categories to standard categories...');
    let mappedCategories = 0;
    const categoryMappedTopics = newsletterData.topics.map(topic => {
      let topicCategory = topic.category.toLowerCase().trim();
      
      // Handle multiple categories by taking the first one
      if (topicCategory.includes('|')) {
        topicCategory = topicCategory.split('|')[0].trim();
      }
      
      // Map to standard category if mapping exists
      const mappedCategory = categoryMapping[topicCategory];
      if (mappedCategory && mappedCategory !== topicCategory) {
        console.log(`Mapped category for topic "${topic.headline}": ${topic.category} -> ${mappedCategory}`);
        mappedCategories++;
        return { ...topic, category: mappedCategory };
      }
      
      // Keep original category if no mapping needed (ensure it's a valid category)
      const validCategory: ValidCategory = mappedCategory || 'business'; // fallback to business if no mapping found
      return { ...topic, category: validCategory };
    });
    
    if (mappedCategories > 0) {
      console.log(`Mapped ${mappedCategories} categories to standard format`);
      newsletterData.topics = categoryMappedTopics;
    }

    // Step 5: Save to database
    try {
      await connectDB();
      const savedNewsletter = await createNewsletter({
        userId,
        title: newsletterData.newsletterTitle,
        topics: newsletterData.topics,
        llmUsed: 'gemini',
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

      // Step 7: Return successful response with trend insights
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
          id: savedNewsletter._id.toString(),
          // Enhanced stats when using advanced processing
          ...(useEnhancedContent && trendAnalysis && {
            enhancedProcessing: {
              contentAnalyzed: enhancedResults.stats.enhancedArticles,
              averageQuality: enhancedResults.stats.averageQuality,
              trendingTopics: trendAnalysis.emergingTopics.slice(0, 3).map(t => t.topic),
              authorityScore: trendAnalysis.qualityMetrics.averageAuthorityScore,
              freshnessScore: trendAnalysis.temporalInsights.freshnessScore,
              processingMode: 'Enhanced with full content analysis'
            }
          })
        },
        fallbackNotification: filterResult.usedFallback ? {
          usedFallback: true,
          originalPeriod: filterResult.originalPeriod,
          fallbackPeriod: filterResult.fallbackPeriod || 'Extended Search',
          message: filterResult.fallbackMessage || 'Used extended search criteria to find sufficient articles'
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
            llmUsed: 'gemini',
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
              fallbackPeriod: filterResult.fallbackPeriod || 'Extended Search',
              message: filterResult.fallbackMessage || 'Used extended search criteria to find sufficient articles'
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
          fallbackPeriod: filterResult.fallbackPeriod || 'Extended Search',
          message: filterResult.fallbackMessage || 'Used extended search criteria to find sufficient articles'
        } : {
          usedFallback: false,
          originalPeriod: filterResult.originalPeriod
        },
        topicCountNotification
      };

      return NextResponse.json(response);
    }

  } catch (error) {
    console.error('💥 Newsletter generation error:', error);
    
    // Provide more specific error messages based on error type
    let userFriendlyMessage = 'An unexpected error occurred while generating your newsletter.';
    
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        userFriendlyMessage = 'The newsletter generation is taking longer than expected. This might be due to high demand or slow RSS feeds. Please try again.';
      } else if (error.message.includes('rate limit') || error.message.includes('quota')) {
        userFriendlyMessage = 'AI service rate limit reached. Please wait a few minutes before generating another newsletter.';
      } else if (error.message.includes('fetch') || error.message.includes('network')) {
        userFriendlyMessage = 'Network connectivity issues prevented newsletter generation. Please check your internet connection and try again.';
      } else if (error.message.includes('parse') || error.message.includes('JSON')) {
        userFriendlyMessage = 'There was an issue processing the content format. Our team has been notified and this should be resolved soon.';
      } else {
        // Include technical details for debugging while keeping message user-friendly
        userFriendlyMessage = `Newsletter generation failed: ${error.message.length > 100 ? error.message.substring(0, 100) + '...' : error.message}`;
      }
    }
    
    return NextResponse.json<APIResponse>(
      { 
        success: false, 
        error: userFriendlyMessage
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json<APIResponse>({
    success: false,
    error: 'This endpoint only accepts POST requests. Please use the correct method to generate newsletters.'
  }, { status: 405 });
}