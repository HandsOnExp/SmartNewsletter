import { GoogleGenerativeAI } from '@google/generative-ai';
import { ParsedArticle } from './rss-parser';
import { buildPrompt, buildGeminiImagePrompt } from '@/config/prompts';
import { buildEnhancedPrompt } from '@/lib/enhanced-prompts';
import { ExtractedContent } from '@/lib/content-extractor';
import {
  cacheAIResponse,
  getCachedAIResponse,
  createContentHash,
  LazyContent
} from '@/utils/cache-optimization';

// Helper function to resolve LazyContent in articles with chunked processing
async function resolveArticleContent(articles: ParsedArticle[]): Promise<ParsedArticle[]> {
  const CHUNK_SIZE = 10; // Process articles in chunks to prevent memory overload
  const resolvedArticles: ParsedArticle[] = [];
  
  for (let i = 0; i < articles.length; i += CHUNK_SIZE) {
    const chunk = articles.slice(i, i + CHUNK_SIZE);
    
    const resolvedChunk = await Promise.all(chunk.map(async (article) => {
      if (article.content instanceof LazyContent) {
        const content = await article.content.getContent();
        // Clear the lazy content to free memory
        article.content.clear();
        return {
          ...article,
          content
        };
      }
      return article;
    }));
    
    resolvedArticles.push(...resolvedChunk);
    
    // Log progress for large batches
    if (articles.length > CHUNK_SIZE) {
      console.log(`Processed ${Math.min(i + CHUNK_SIZE, articles.length)}/${articles.length} articles`);
    }
  }
  
  return resolvedArticles;
}

// Helper function to chunk articles for AI processing to prevent token limits
export function chunkArticlesForProcessing(articles: ParsedArticle[], maxTokensPerChunk: number = 50000): ParsedArticle[][] {
  const chunks: ParsedArticle[][] = [];
  let currentChunk: ParsedArticle[] = [];
  let currentTokens = 0;
  
  for (const article of articles) {
    // Estimate tokens (rough approximation: 1 token ≈ 4 characters)
    const articleTokens = Math.ceil((article.title.length + article.contentSnippet.length + (typeof article.content === 'string' ? article.content.length : 1000)) / 4);
    
    if (currentTokens + articleTokens > maxTokensPerChunk && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [article];
      currentTokens = articleTokens;
    } else {
      currentChunk.push(article);
      currentTokens += articleTokens;
    }
  }
  
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

// Note: No longer using server-side API key
// Each user must provide their own Gemini API key

// Newsletter topic interface
export interface NewsletterTopic {
  headline: string;
  summary: string;
  keyTakeaway?: string;
  imagePrompt: string;
  imageUrl?: string;
  sourceUrl: string;
  category: 'business' | 'technology' | 'research' | 'product' | 'enterprise' | 'consumer' | 'security' | 'development';
}

export interface NewsletterData {
  newsletterTitle: string;
  newsletterDate: string;
  introduction?: string;
  topics: NewsletterTopic[];
  conclusion?: string;
  stats: {
    sourcesAnalyzed: number;
    generationTime: number;
    llmUsed: 'gemini';
  };
}


// Enhanced Gemini integration with better prompts
export async function analyzeWithGemini(
  articles: ParsedArticle[] | ExtractedContent[],
  userApiKey: string,
  options?: { 
    maxTopics?: number; 
    language?: 'english' | 'hebrew' | 'spanish' | 'french' | 'german' | 'italian' | 'portuguese';
    preferredCategories?: string[];
    useEnhancedContent?: boolean;
    enhancedPrompts?: boolean;
  }
): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    if (!userApiKey || userApiKey.trim() === '') {
      return {
        success: false,
        error: 'Gemini API key is required. Please add your API key in Settings to generate newsletters.'
      };
    }

    // Initialize Gemini client with user's API key
    const genAI = new GoogleGenerativeAI(userApiKey.trim());
    
    // Handle both article types
    let resolvedArticles: ParsedArticle[] | ExtractedContent[];
    if (options?.useEnhancedContent && articles.length > 0 && 'quality' in articles[0]) {
      // Already enhanced content
      resolvedArticles = articles as ExtractedContent[];
    } else {
      // Resolve lazy content for regular articles
      resolvedArticles = await resolveArticleContent(articles as ParsedArticle[]);
    }
    
    // Choose prompt strategy
    const prompt = options?.enhancedPrompts 
      ? buildEnhancedPrompt(resolvedArticles, {
          maxTopics: options.maxTopics || 7,
          language: options.language || 'english',
          preferredCategories: options.preferredCategories,
          useEnhancedContent: options.useEnhancedContent || false,
          contextAnalysis: true,
          factualAccuracyMode: true,
          creativityLevel: 'balanced'
        })
      : buildPrompt(resolvedArticles as ParsedArticle[], 'gemini', options);
    
    // Check cache first
    const cacheKey = createContentHash(prompt);
    const cachedResponse = getCachedAIResponse(cacheKey);
    
    if (cachedResponse) {
      console.log('Using cached Gemini response');
      return { success: true, content: cachedResponse };
    }
    
    console.log('Using user-provided Gemini API key:', userApiKey.substring(0, 10) + '...');

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash" // Stable free tier model with better quotas
    });

    // Retry logic with exponential backoff for rate limits
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const rawContent = response.text();

        // Success - process the response
        const processResult = processAIResponse(rawContent, options?.language);
        if (processResult.success) {
          // Cache successful response
          cacheAIResponse(cacheKey, processResult.content!);
          return {
            success: true,
            content: processResult.content
          };
        } else {
          return {
            success: false,
            error: processResult.error
          };
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if it's a rate limit error (429)
        const isRateLimitError = lastError.message.includes('429') ||
                                  lastError.message.includes('quota') ||
                                  lastError.message.includes('rate limit');

        if (isRateLimitError && attempt < maxRetries) {
          // Extract retry delay from error message if available
          const retryMatch = lastError.message.match(/retry.*?(\d+(?:\.\d+)?)\s*s/i);
          const suggestedDelay = retryMatch ? parseFloat(retryMatch[1]) * 1000 : null;

          // Use suggested delay or exponential backoff: 2s, 4s, 8s
          const delay = suggestedDelay || (Math.pow(2, attempt) * 1000);

          console.log(`Rate limit hit (attempt ${attempt}/${maxRetries}). Retrying in ${delay/1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // If not a rate limit error or last attempt, throw
        if (attempt === maxRetries) {
          throw lastError;
        }
      }
    }

    // If we get here, all retries failed
    throw lastError || new Error('All retry attempts failed');

  } catch (error) {
    console.error('Gemini API error details:', error);

    // Check for specific error types and provide helpful messages
    if (error instanceof Error) {
      // API key validation errors
      if (error.message.includes('API key not valid')) {
        return {
          success: false,
          error: 'Invalid Gemini API key. Please get a new key from https://makersuite.google.com/app/apikey'
        };
      }

      // Quota and rate limit errors
      if (error.message.includes('429') || error.message.includes('quota') || error.message.includes('rate limit')) {
        return {
          success: false,
          error: 'Gemini API quota exceeded. Your free tier has reached its limit. Options: 1) Wait a few minutes and try again, 2) Upgrade your Gemini API plan at https://ai.google.dev/pricing, or 3) Get a new API key at https://makersuite.google.com/app/apikey'
        };
      }

      // Model access errors
      if (error.message.includes('model') && error.message.includes('not found')) {
        return {
          success: false,
          error: 'The AI model is temporarily unavailable. Please try again in a few minutes.'
        };
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown Gemini error'
    };
  }
}

// Generate images with Gemini (requires paid tier)
export async function generateImage(prompt: string, userApiKey?: string): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  try {
    // For now, always use placeholder images since image generation requires paid tier
    // Users can upgrade to paid Gemini tier for actual image generation
    const encodedPrompt = encodeURIComponent(prompt.slice(0, 50));
    return {
      success: true,
      imageUrl: `https://placehold.co/800x400/667eea/ffffff?text=${encodedPrompt}`
    };
    
    // Future implementation for paid tier:
    // if (userApiKey && process.env.GEMINI_TIER === 'paid') {
    //   const genAI = new GoogleGenerativeAI(userApiKey);
    //   const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    //   const fullPrompt = buildGeminiImagePrompt(prompt);
    //   await model.generateContent(fullPrompt);
    //   // Handle actual image generation response
    // }
    
  } catch (error) {
    console.error('Image generation error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Image generation failed' 
    };
  }
}

// Multi-pass topic generation with validation and refinement
export async function generateNewsletterContentWithValidation(
  articles: ParsedArticle[] | ExtractedContent[],
  userApiKey: string,
  options?: {
    maxTopics?: number; 
    language?: 'english' | 'hebrew' | 'spanish' | 'french' | 'german' | 'italian' | 'portuguese';
    preferredCategories?: string[];
    fastMode?: boolean;
    timeout?: number;
    useEnhancedContent?: boolean;
    enhancedPrompts?: boolean;
    multiPass?: boolean; // Enable multi-pass generation and validation
  }
): Promise<{ success: boolean; data?: NewsletterData; error?: string }> {
  const startTime = Date.now();
  
  // First pass: Generate initial topics
  console.log(`🔄 Multi-pass generation: Starting initial topic generation...`);
  const initialResult = await generateNewsletterContent(articles, userApiKey, {
    ...options,
    maxTopics: Math.min((options?.maxTopics || 7) + 3, 12) // Generate 3 extra topics for validation
  });
  
  if (!initialResult.success || !initialResult.data) {
    return initialResult;
  }
  
  // Second pass: Validate topics and refine if needed (if multiPass enabled)
  if (options?.multiPass && options?.language === 'hebrew') {
    console.log(`🔍 Multi-pass validation: Validating ${initialResult.data.topics.length} topics...`);
    
    const validatedResult = await validateAndRefineTOpics(
      initialResult.data,
      articles,
      options?.maxTopics || 7
    );
    
    if (validatedResult.success) {
      console.log(`✅ Multi-pass validation: Refined to ${validatedResult.data!.topics.length} high-quality topics`);
      return {
        success: true,
        data: {
          ...validatedResult.data!,
          stats: {
            ...validatedResult.data!.stats,
            generationTime: Date.now() - startTime
          }
        }
      };
    }
  }
  
  // Fallback: Trim to requested number of topics
  if (initialResult.data.topics.length > (options?.maxTopics || 7)) {
    const targetTopics = options?.maxTopics || 7;
    console.log(`📝 Trimming from ${initialResult.data.topics.length} to ${targetTopics} topics`);
    
    // Score and select best topics
    const scoredTopics = initialResult.data.topics.map((topic, index) => ({
      ...topic,
      score: calculateTopicScore(topic, index)
    }));
    
    scoredTopics.sort((a, b) => b.score - a.score);
    initialResult.data.topics = scoredTopics.slice(0, targetTopics).map(({ score: _, ...topic }) => topic);
  }
  
  return {
    success: true,
    data: {
      ...initialResult.data,
      stats: {
        ...initialResult.data.stats,
        generationTime: Date.now() - startTime
      }
    }
  };
}

// Enhanced newsletter generation function
export async function generateNewsletterContent(
  articles: ParsedArticle[] | ExtractedContent[], 
  userApiKey: string,
  options?: { 
    maxTopics?: number; 
    language?: 'english' | 'hebrew' | 'spanish' | 'french' | 'german' | 'italian' | 'portuguese';
    preferredCategories?: string[];
    fastMode?: boolean;
    timeout?: number;
    useEnhancedContent?: boolean;
    enhancedPrompts?: boolean;
  }
): Promise<{ success: boolean; data?: NewsletterData; error?: string }> {
  const startTime = Date.now();
  const maxRetries = 1; // Single attempt for reliability
  
  // Handle different article types
  let processedArticles: ParsedArticle[] | ExtractedContent[];
  if (options?.useEnhancedContent && articles.length > 0 && 'quality' in articles[0]) {
    // Already enhanced content
    processedArticles = articles as ExtractedContent[];
    console.log(`Using ${processedArticles.length} enhanced articles for generation`);
  } else {
    // Resolve lazy content for regular articles
    processedArticles = await resolveArticleContent(articles as ParsedArticle[]);
    console.log(`Using ${processedArticles.length} standard articles for generation`);
  }
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const generationMode = options?.enhancedPrompts ? 'Enhanced' : 'Standard';
      console.log(`Newsletter generation with Gemini (${generationMode} mode, attempt ${attempt}/${maxRetries})`);
      
      const response = await analyzeWithGemini(processedArticles, userApiKey, {
        ...options,
        useEnhancedContent: options?.useEnhancedContent,
        enhancedPrompts: options?.enhancedPrompts
      });
      
      if (!response.success) {
        if (attempt === maxRetries) {
          return { success: false, error: response.error };
        }
        console.log(`Attempt ${attempt} failed, retrying...`);
        continue;
      }
      
      // Parse the response - now handled by shared processing function
      let newsletterData;
      try {
        newsletterData = JSON.parse(response.content!) as { 
          topics: NewsletterTopic[];
          newsletterTitle: string;
          newsletterDate: string;
          introduction?: string;
          conclusion?: string;
        };
      } catch (parseError) {
        console.error(`Attempt ${attempt} JSON parsing error:`, parseError);
        if (attempt === maxRetries) {
          return { 
            success: false, 
            error: `Failed to parse AI response as JSON after ${maxRetries} attempts. Error: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}. Please try again.` 
          };
        }
        console.log(`Attempt ${attempt} failed due to parsing error, retrying...`);
        continue;
      }
      
      // Validate the structure
      if (!newsletterData.topics || !Array.isArray(newsletterData.topics)) {
        if (attempt === maxRetries) {
          return { success: false, error: 'Invalid newsletter structure returned by AI after multiple attempts' };
        }
        console.log(`Attempt ${attempt}: Invalid newsletter structure, retrying...`);
        continue;
      }
      
      // Validate and auto-correct the number of topics
      const expectedTopics = options?.maxTopics || 7;
      const actualTopics = newsletterData.topics.length;
      
      if (actualTopics !== expectedTopics) {
        console.log(`Generated ${actualTopics} topics, expected ${expectedTopics}`);
        
        if (actualTopics > expectedTopics) {
          // Too many topics - trim to the requested count (keep the best ones)
          console.log(`Auto-trimming from ${actualTopics} to ${expectedTopics} topics`);
          
          // Score topics by quality indicators and keep the best ones
          const scoredTopics = newsletterData.topics.map((topic: NewsletterTopic, index: number) => ({
            ...topic,
            score: calculateTopicScore(topic, index)
          }));
          
          // Sort by score (highest first) and take the top N
          scoredTopics.sort((a: NewsletterTopic & { score: number }, b: NewsletterTopic & { score: number }) => b.score - a.score);
          newsletterData.topics = scoredTopics.slice(0, expectedTopics).map((topicWithScore: NewsletterTopic & { score: number }) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { score, ...topicWithoutScore } = topicWithScore;
            return topicWithoutScore;
          });
          
          console.log(`Selected top ${expectedTopics} topics based on quality scoring`);
        } else if (actualTopics < expectedTopics) {
          // Too few topics - only retry if we have very few topics and there are more attempts
          const shortfall = expectedTopics - actualTopics;
          const minAcceptableTopics = Math.max(1, Math.floor(expectedTopics * 0.4)); // Accept at least 40% of requested topics
          
          if (actualTopics < minAcceptableTopics && attempt < maxRetries) {
            console.log(`Attempt ${attempt}: Generated only ${actualTopics} topics (less than minimum ${minAcceptableTopics}), expected ${expectedTopics}. Retrying...`);
            continue;
          } else {
            console.log(`Generated ${actualTopics} topics (${shortfall} short), but proceeding since we have sufficient content`);
          }
        }
      }
      
      // Generate images for topics using Gemini
      for (const topic of newsletterData.topics) {
        if (topic.imagePrompt) {
          const imageResult = await generateImage(topic.imagePrompt);
          if (imageResult.success) {
            topic.imageUrl = imageResult.imageUrl;
          }
        }
        // Add placeholder if no image URL
        if (!topic.imageUrl) {
          const encodedHeadline = encodeURIComponent(topic.headline.slice(0, 30));
          topic.imageUrl = `https://placehold.co/800x400/667eea/ffffff?text=${encodedHeadline}`;
        }
      }
      
      // Add stats
      const finalData: NewsletterData = {
        ...newsletterData,
        stats: {
          sourcesAnalyzed: processedArticles.length,
          generationTime: Date.now() - startTime,
          llmUsed: 'gemini'
        }
      };
      
      return { success: true, data: finalData };
      
    } catch (parseError) {
      console.error(`Attempt ${attempt} parsing error:`, parseError);
      if (attempt === maxRetries) {
        return { 
          success: false, 
          error: parseError instanceof Error ? parseError.message : 'Unknown parsing error' 
        };
      }
      console.log(`Attempt ${attempt} failed due to parsing error, retrying...`);
      continue;
    }
  }
  
  return { 
    success: false, 
    error: 'All generation attempts failed' 
  };
}

// Shared response processing for both providers
function processAIResponse(
  rawContent: string, 
  language?: string, 
  maxRetries: number = 3,
  attempt: number = 1
): { success: boolean; content?: string; error?: string } {
  try {
    // Clean the response to extract JSON
    let cleanedContent = rawContent;
    
    console.log('Raw AI response:', cleanedContent.substring(0, 200) + '...');
    
    // Remove markdown code blocks
    cleanedContent = cleanedContent
      .replace(/```json\n?/gi, '')
      .replace(/```\n?/gi, '')
      .trim();
    
    // Remove any text before the first {
    const firstBrace = cleanedContent.indexOf('{');
    if (firstBrace > 0) {
      cleanedContent = cleanedContent.substring(firstBrace);
    }
    
    // Remove any text after the last }
    const lastBrace = cleanedContent.lastIndexOf('}');
    if (lastBrace !== -1 && lastBrace < cleanedContent.length - 1) {
      cleanedContent = cleanedContent.substring(0, lastBrace + 1);
    }
    
    // If response starts with markdown headers or other text, try to extract JSON
    if (!cleanedContent.startsWith('{')) {
      // Look for JSON-like content between braces
      const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedContent = jsonMatch[0];
      } else {
        if (attempt === maxRetries) {
          return { 
            success: false, 
            error: `AI returned non-JSON content. Response started with: "${cleanedContent.substring(0, 100)}...". Please try again or switch providers.` 
          };
        }
        console.log(`Attempt ${attempt}: No JSON found in response, retrying...`);
        return { success: false, error: 'No JSON found in response' };
      }
    }
    
    // Additional cleaning for common AI response issues
    cleanedContent = cleanedContent
      .replace(/\n\s*\/\/.*$/gm, '') // Remove comment lines
      .replace(/,\s*}/g, '}') // Remove trailing commas
      .replace(/,\s*]/g, ']') // Remove trailing commas in arrays
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters that can break JSON
      .replace(/\r\n/g, '\n'); // Normalize line endings only
    
    // Additional validation for Hebrew and RTL text
    if (language && ['hebrew', 'arabic'].includes(language)) {
      // Extra cleaning for RTL languages
      cleanedContent = cleanedContent
        .replace(/[\u200E\u200F\u202A\u202B\u202C\u202D\u202E]/g, '') // Remove RTL/LTR marks
        .replace(/\u00A0/g, ' '); // Replace non-breaking spaces
    }
    
    console.log('Cleaned content for parsing:', cleanedContent.substring(0, 200) + '...');
    
    // Use enhanced JSON validation with language-specific repair
    const validationResult = validateAndRepairJSON(cleanedContent, language);
    
    if (validationResult.success) {
      return { success: true, content: JSON.stringify(validationResult.data) };
    } else {
      return { success: false, error: validationResult.error };
    }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown processing error' 
    };
  }
}

// JSON validation and repair for non-Latin languages
function validateAndRepairJSON(jsonString: string, language?: string): { success: boolean; data?: unknown; error?: string } {
  try {
    const parsed = JSON.parse(jsonString);
    return { success: true, data: parsed };
  } catch {
    console.log('JSON validation failed, attempting repair...');
    
    let repairedJson = jsonString;
    
    // Common repairs for Hebrew and RTL languages
    if (language === 'hebrew' || language === 'arabic') {
      // More aggressive Hebrew text cleaning
      repairedJson = repairedJson
        // Remove all RTL/LTR marks and formatting characters
        .replace(/[\u200E\u200F\u202A\u202B\u202C\u202D\u202E\u2066\u2067\u2068\u2069]/g, '')
        // Replace non-breaking and special spaces
        .replace(/[\u00A0\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/g, ' ')
        // Fix Hebrew punctuation that might break JSON (but keep essential Hebrew characters)
        .replace(/[\u05BE\u05C0\u05C3\u05C6]/g, '') // Only remove specific problematic marks
        // Fix unescaped quotes and newlines in Hebrew strings
        .replace(/"([^"]*[א-ת\u0590-\u05FF][^"]*?)"/gu, (match, content) => {
          // Clean the content inside quotes
          const cleaned = content
            .replace(/(?<!\\)"/g, '\\"') // Escape unescaped quotes
            .replace(/(?<!\\)\n/g, '\\n') // Escape unescaped newlines
            .replace(/(?<!\\)\r/g, '\\r') // Escape unescaped carriage returns
            .replace(/(?<!\\)\t/g, '\\t') // Escape unescaped tabs
            .replace(/\\\\/g, '\\'); // Fix double backslashes
          return `"${cleaned}"`;
        })
        // Fix unquoted Hebrew text (common AI mistake)
        .replace(/:\s*([א-ת\u0590-\u05FF][^\s,}\]"]*(?:\s+[א-ת\u0590-\u05FF][^\s,}\]"]*)*)\s*([,}\]])/gu, ': "$1"$2')
        // Fix Hebrew text that spans multiple lines without proper escaping
        .replace(/:\s*"([^"]*[א-ת\u0590-\u05FF][^"]*)\n([^"]*[א-ת\u0590-\u05FF][^"]*?)"\s*([,}\]])/gu, ': "$1 $2"$3')
        // Fix broken JSON structure around Hebrew content
        .replace(/([א-ת\u0590-\u05FF])\s*"\s*([,}\]])/gu, '$1"$2')
        // Ensure proper JSON structure
        .replace(/,(\s*[}\]])/g, '$1'); // Remove trailing commas
    }
    
    // General JSON repairs
    repairedJson = repairedJson
      .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, ''); // Remove control characters only
    
    try {
      const parsed = JSON.parse(repairedJson);
      console.log('JSON repair successful');
      return { success: true, data: parsed };
    } catch (repairError) {
      console.log('Standard repair failed, attempting structural reconstruction...');
      
      // Last resort: try to extract and reconstruct the JSON structure
      if (language === 'hebrew') {
        try {
          const reconstructed = reconstructHebrewJSON(repairedJson);
          if (reconstructed) {
            console.log('Hebrew JSON reconstruction successful');
            return { success: true, data: reconstructed };
          }
        } catch (reconstructError) {
          console.log('JSON reconstruction failed:', reconstructError);
        }
      }
      
      return { 
        success: false, 
        error: `JSON repair failed: ${repairError instanceof Error ? repairError.message : 'Unknown error'}` 
      };
    }
  }
}

// Hebrew JSON reconstruction - extract and rebuild structure
function reconstructHebrewJSON(brokenJson: string): unknown | null {
  try {
    console.log('Attempting Hebrew JSON reconstruction...');
    console.log('Input JSON length:', brokenJson.length);
    console.log('First 500 chars:', brokenJson.substring(0, 500));
    
    // Extract key components using more flexible regex patterns
    const titleMatch = brokenJson.match(/"newsletterTitle"\s*:\s*"([^"]*(?:[א-ת\u0590-\u05FF\uFB1D-\uFB4F][^"]*)*)"/u) ||
                     brokenJson.match(/"newsletterTitle"\s*:\s*"([^"]*)"/);
    
    const dateMatch = brokenJson.match(/"newsletterDate"\s*:\s*"([^"]*(?:[א-ת\u0590-\u05FF\uFB1D-\uFB4F][^"]*)*)"/u) ||
                     brokenJson.match(/"newsletterDate"\s*:\s*"([^"]*)"/);
    
    const introMatch = brokenJson.match(/"introduction"\s*:\s*"([^"]*(?:[א-ת\u0590-\u05FF\uFB1D-\uFB4F][^"]*)*)"/u) ||
                      brokenJson.match(/"introduction"\s*:\s*"([^"]*)"/);
    
    const conclusionMatch = brokenJson.match(/"conclusion"\s*:\s*"([^"]*(?:[א-ת\u0590-\u05FF\uFB1D-\uFB4F][^"]*)*)"/u) ||
                           brokenJson.match(/"conclusion"\s*:\s*"([^"]*)"/);
    
    // Extract topics array - use more flexible approach
    let topicsMatch = brokenJson.match(/"topics"\s*:\s*\[([\s\S]*?)\]/);
    
    // If topics array not found, try alternative patterns
    if (!topicsMatch) {
      console.log('Standard topics pattern failed, trying alternatives...');
      // Try without quotes around topics
      topicsMatch = brokenJson.match(/topics\s*:\s*\[([\s\S]*?)\]/);
      
      if (!topicsMatch) {
        // Try finding topics content between [ and ]
        const arrayStart = brokenJson.indexOf('[');
        const arrayEnd = brokenJson.lastIndexOf(']');
        if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
          console.log('Found array brackets, extracting content...');
          const arrayContent = brokenJson.substring(arrayStart + 1, arrayEnd);
          topicsMatch = [brokenJson, arrayContent];
        } else {
          console.log('No array brackets found, trying to find topics by keyword...');
          // Last resort: search for "topics" keyword and try to extract from there
          const topicsIndex = brokenJson.toLowerCase().indexOf('"topics"');
          if (topicsIndex !== -1) {
            const afterTopics = brokenJson.substring(topicsIndex + 8); // Skip past "topics"
            const colonIndex = afterTopics.indexOf(':');
            if (colonIndex !== -1) {
              const afterColon = afterTopics.substring(colonIndex + 1).trim();
              // Try to find some content that looks like topics
              if (afterColon.includes('{') && afterColon.includes('headline')) {
                console.log('Found potential topics content after "topics:" keyword');
                topicsMatch = [brokenJson, afterColon];
              }
            }
          }
        }
      }
    }
    
    const topics: NewsletterTopic[] = [];
    
    console.log('Title match:', titleMatch?.[1]);
    console.log('Topics match found:', !!topicsMatch);
    if (topicsMatch) {
      console.log('Topics content preview (first 300 chars):', topicsMatch[1]?.substring(0, 300));
    }
    
    if (topicsMatch) {
      const topicsContent = topicsMatch[1];
      console.log('Topics content length:', topicsContent.length);
      console.log('Topics content preview:', topicsContent.substring(0, 200));
      
      // Try to extract individual topic objects more robustly
      let topicMatches: string[] | null = topicsContent.match(/\{[^}]*"headline"[^}]*\}/g);
      
      // If strict matching fails, try more flexible patterns
      if (!topicMatches) {
        console.log('Strict topic matching failed, trying flexible patterns...');
        // Try to match objects that contain headline field (even if incomplete)
        topicMatches = topicsContent.match(/\{[\s\S]*?"headline"[\s\S]*?\}/g);
        
        if (!topicMatches) {
          // Even more flexible - split by likely topic boundaries
          const possibleTopics = topicsContent.split(/\s*},?\s*\{/);
          if (possibleTopics.length > 1) {
            console.log(`Found ${possibleTopics.length} potential topic blocks by splitting`);
            topicMatches = possibleTopics.map(block => {
              // Add braces if missing
              let cleanBlock = block.trim();
              if (!cleanBlock.startsWith('{')) cleanBlock = '{' + cleanBlock;
              if (!cleanBlock.endsWith('}')) cleanBlock = cleanBlock + '}';
              return cleanBlock;
            }).filter(block => block.includes('headline') || block.includes('summary'));
          }
        }
      }
      
      if (topicMatches && topicMatches.length > 0) {
        console.log('Found', topicMatches.length, 'topic objects');
        
        topicMatches.forEach((topicStr, i) => {
          try {
            console.log(`Processing topic ${i}: ${topicStr.substring(0, 100)}...`);
            
            // More flexible field extraction with Hebrew support
            const headlineMatch = topicStr.match(/"headline"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/u) ||
                                  topicStr.match(/headline\s*:\s*"([^"]*(?:\\.[^"]*)*)"/u);
            
            const summaryMatch = topicStr.match(/"summary"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/u) ||
                                topicStr.match(/summary\s*:\s*"([^"]*(?:\\.[^"]*)*)"/u);
            
            const takeawayMatch = topicStr.match(/"keyTakeaway"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/u) ||
                                 topicStr.match(/keyTakeaway\s*:\s*"([^"]*(?:\\.[^"]*)*)"/u);
            
            const imageMatch = topicStr.match(/"imagePrompt"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/u) ||
                              topicStr.match(/imagePrompt\s*:\s*"([^"]*(?:\\.[^"]*)*)"/u);
            
            const urlMatch = topicStr.match(/"sourceUrl"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/u) ||
                            topicStr.match(/sourceUrl\s*:\s*"([^"]*(?:\\.[^"]*)*)"/u);
            
            const categoryMatch = topicStr.match(/"category"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/u) ||
                                 topicStr.match(/category\s*:\s*"([^"]*(?:\\.[^"]*)*)"/u);
            
            console.log(`Topic ${i}: headline=${!!headlineMatch}, summary=${!!summaryMatch}`);
            
            if (headlineMatch || summaryMatch) {
              const cleanHeadline = (headlineMatch?.[1] || `נושא AI ${i + 1}`).replace(/\\"/g, '"').replace(/\\n/g, '\n').trim();
              const cleanSummary = (summaryMatch?.[1] || 'תקציר חדשות AI').replace(/\\"/g, '"').replace(/\\n/g, '\n').trim();
              
              topics.push({
                headline: cleanHeadline,
                summary: cleanSummary,
                keyTakeaway: (takeawayMatch?.[1] || '').replace(/\\"/g, '"').replace(/\\n/g, '\n').trim(),
                imagePrompt: (imageMatch?.[1] || 'AI technology illustration').replace(/\\"/g, '"').trim(),
                sourceUrl: (urlMatch?.[1] || '').replace(/\\"/g, '"').trim(),
                category: (categoryMatch?.[1]?.replace(/\\"/g, '"').trim() || 'business') as 'business' | 'technology' | 'research' | 'product' | 'enterprise' | 'consumer' | 'security' | 'development'
              });
              console.log(`Successfully extracted topic ${i}: "${cleanHeadline}"`);
            }
          } catch (topicError) {
            console.log(`Failed to parse topic ${i}:`, topicError);
          }
        });
      } else {
        // Final fallback: create some topics from the content we have
        console.log('No topic objects found at all, creating fallback topics...');
        
        // Try to find Hebrew text that looks like headlines
        const hebrewHeadlines = brokenJson.match(/[א-ת\u0590-\u05FF][^"]*[א-ת\u0590-\u05FF]/gu);
        
        if (hebrewHeadlines && hebrewHeadlines.length > 0) {
          console.log(`Found ${hebrewHeadlines.length} potential Hebrew headlines`);
          
          hebrewHeadlines.slice(0, 5).forEach((headline, i) => {
            if (headline.length > 10 && headline.length < 200) {
              topics.push({
                headline: headline.trim(),
                summary: 'תקציר חדשות AI מתוכן המקורי',
                keyTakeaway: '',
                imagePrompt: 'AI technology illustration',
                sourceUrl: '',
                category: 'research' as const
              });
              console.log(`Created fallback topic ${i}: "${headline.substring(0, 50)}..."`);
            }
          });
        }
        
        // If still no topics, create minimal ones
        if (topics.length === 0) {
          console.log('Creating minimal fallback topics...');
          for (let i = 0; i < 3; i++) {
            topics.push({
              headline: `חדשות AI ${i + 1}`,
              summary: 'תקציר חדשות מעולם הבינה המלאכותית השבוע',
              keyTakeaway: '',
              imagePrompt: 'AI technology illustration',
              sourceUrl: '',
              category: 'research' as const
            });
          }
        }
      }
    }
    
    // Reconstruct the JSON object
    const reconstructed = {
      newsletterTitle: (titleMatch?.[1] || 'AI Newsletter בעברית').replace(/\\"/g, '"'),
      newsletterDate: (dateMatch?.[1] || new Date().toLocaleDateString('he-IL')).replace(/\\"/g, '"'),
      introduction: (introMatch?.[1] || 'חדשות AI השבוע').replace(/\\"/g, '"'),
      topics: topics,
      conclusion: (conclusionMatch?.[1] || 'זהו לשבוע זה!').replace(/\\"/g, '"')
    };
    
    console.log(`Successfully reconstructed newsletter with ${topics.length} topics`);
    return reconstructed;
    
  } catch (error) {
    console.log('Reconstruction failed:', error);
    return null;
  }
}

// Topic quality scoring for smart trimming
function calculateTopicScore(topic: NewsletterTopic, index: number): number {
  let score = 100; // Base score
  
  // Penalize later positions (AI usually puts best topics first)
  score -= index * 5;
  
  // Reward longer, more detailed summaries
  const summaryLength = topic.summary?.length || 0;
  if (summaryLength > 200) score += 20;
  else if (summaryLength > 100) score += 10;
  else if (summaryLength < 50) score -= 20;
  
  // Reward certain high-value categories
  const categoryBonus = {
    'research': 15,
    'product': 10,
    'business': 8,
    'security': 12,
    'technology': 10,
    'development': 8,
    'enterprise': 6,
    'consumer': 5
  };
  score += categoryBonus[topic.category as keyof typeof categoryBonus] || 0;
  
  // Reward topics with more specific headlines (avoid generic ones)
  const headline = topic.headline?.toLowerCase() || '';
  if (headline.includes('breakthrough') || headline.includes('major') || headline.includes('first')) {
    score += 10;
  }
  if (headline.includes('announced') || headline.includes('released') || headline.includes('launched')) {
    score += 8;
  }
  
  // Penalize very generic headlines
  if (headline.includes('new') && headline.length < 30) score -= 5;
  
  return Math.max(0, score); // Ensure non-negative
}

// Rate limiting helper
export function checkRateLimit(): { allowed: boolean; message?: string } {
  // This is a simple implementation - in production, you'd use Redis or similar
  
  // For now, always allow (implement proper rate limiting in production)
  return { allowed: true };
}

// Topic validation and refinement function
async function validateAndRefineTOpics(
  newsletterData: NewsletterData,
  sourceArticles: (ParsedArticle | ExtractedContent)[],
  targetTopicCount: number
): Promise<{ success: boolean; data?: NewsletterData; error?: string }> {
  try {
    console.log(`🔍 Validating ${newsletterData.topics.length} topics for quality and accuracy...`);
    
    // Step 1: Validate topic-source alignment
    const validatedTopics = await Promise.all(
      newsletterData.topics.map(async (topic, index) => {
        const alignmentScore = await calculateTopicSourceAlignment(topic, sourceArticles);
        return {
          ...topic,
          validationScore: alignmentScore,
          originalIndex: index
        };
      })
    );
    
    // Step 2: Filter out low-quality topics
    const qualityThreshold = 0.6; // 60% alignment score minimum
    const qualityTopics = validatedTopics.filter(topic => topic.validationScore >= qualityThreshold);
    
    console.log(`📊 Topic validation: ${qualityTopics.length}/${newsletterData.topics.length} topics passed quality check`);
    
    // Step 3: Select best topics
    qualityTopics.sort((a, b) => {
      // Combine validation score with original topic score
      const aScore = b.validationScore * 0.6 + calculateTopicScore(a, a.originalIndex) * 0.4;
      const bScore = b.validationScore * 0.6 + calculateTopicScore(b, b.originalIndex) * 0.4;
      return bScore - aScore;
    });
    
    const finalTopics = qualityTopics
      .slice(0, targetTopicCount)
      .map(({ validationScore: _, originalIndex: __, ...topic }) => topic);
    
    // Step 4: If we don't have enough high-quality topics, add some from the original set
    if (finalTopics.length < Math.max(3, Math.floor(targetTopicCount * 0.6))) {
      console.log(`⚠️ Not enough high-quality topics (${finalTopics.length}), adding best remaining topics...`);
      
      const remainingTopics = validatedTopics
        .filter(topic => topic.validationScore < qualityThreshold)
        .sort((a, b) => b.validationScore - a.validationScore)
        .slice(0, targetTopicCount - finalTopics.length)
        .map(({ validationScore: _, originalIndex: __, ...topic }) => topic);
      
      finalTopics.push(...remainingTopics);
    }
    
    return {
      success: true,
      data: {
        ...newsletterData,
        topics: finalTopics
      }
    };
    
  } catch (error) {
    console.error('Topic validation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Topic validation failed'
    };
  }
}

// Calculate how well a topic aligns with source articles
async function calculateTopicSourceAlignment(
  topic: NewsletterTopic,
  sourceArticles: (ParsedArticle | ExtractedContent)[]
): Promise<number> {
  // Simple alignment calculation based on keyword matching and URL validation
  let alignmentScore = 0;
  
  // Check if topic URL exists in source articles
  const hasMatchingUrl = sourceArticles.some(article => {
    const articleUrl = 'sourceUrl' in article ? article.sourceUrl : article.link;
    return articleUrl === topic.sourceUrl;
  });
  
  if (hasMatchingUrl) {
    alignmentScore += 0.5; // 50% for URL match
  }
  
  // Check keyword alignment with source articles
  const topicKeywords = extractKeywords(topic.headline + ' ' + topic.summary);
  let keywordMatches = 0;
  const totalKeywords = topicKeywords.length;
  
  if (totalKeywords > 0) {
    sourceArticles.forEach(article => {
      let articleContent = '';
      if ('content' in article && typeof article.content === 'string') {
        articleContent = article.content;
      } else if ('contentSnippet' in article && article.contentSnippet) {
        articleContent = article.contentSnippet;
      } else if ('excerpt' in article && article.excerpt) {
        articleContent = article.excerpt; // For ExtractedContent type
      }
      
      const articleText = article.title + ' ' + articleContent;
      const articleKeywords = extractKeywords(articleText);
      
      const matches = topicKeywords.filter(keyword => 
        articleKeywords.some(artKeyword => 
          artKeyword.toLowerCase().includes(keyword.toLowerCase()) ||
          keyword.toLowerCase().includes(artKeyword.toLowerCase())
        )
      ).length;
      
      keywordMatches = Math.max(keywordMatches, matches);
    });
    
    alignmentScore += (keywordMatches / totalKeywords) * 0.5; // 50% for keyword alignment
  } else {
    alignmentScore += 0.25; // Partial credit if no extractable keywords
  }
  
  return Math.min(1, alignmentScore);
}

// Extract keywords from text for alignment checking
function extractKeywords(text: string): string[] {
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !isStopWord(word));
  
  // Return unique words, limited to most important ones
  return [...new Set(words)].slice(0, 10);
}

// Simple stop word check
function isStopWord(word: string): boolean {
  const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'this', 'that', 'these', 'those', 'a', 'an'];
  return stopWords.includes(word.toLowerCase());
}