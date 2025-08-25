import { CohereClient } from 'cohere-ai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ParsedArticle } from './rss-parser';
import { buildPrompt, buildGeminiImagePrompt } from '@/config/prompts';
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

// Initialize AI clients with better error handling
const cohereApiKey = process.env.COHERE_API_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;

if (!cohereApiKey) {
  console.warn('COHERE_API_KEY not found in environment variables');
}

if (!geminiApiKey) {
  console.warn('GEMINI_API_KEY not found in environment variables');
}

const cohere = cohereApiKey ? new CohereClient({
  token: cohereApiKey,
}) : null;

const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

// Newsletter topic interface
export interface NewsletterTopic {
  headline: string;
  summary: string;
  keyTakeaway?: string;
  imagePrompt: string;
  imageUrl?: string;
  sourceUrl: string;
  category: 'research' | 'product' | 'business' | 'policy' | 'fun';
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
    llmUsed: 'cohere' | 'gemini';
  };
}

// Cohere integration
export async function analyzeWithCohere(
  articles: ParsedArticle[],
  options?: { maxTopics?: number; language?: 'english' | 'hebrew' | 'spanish' | 'french' | 'german' | 'italian' | 'portuguese' }
): Promise<{ success: boolean; content?: string; error?: string }> {
  const maxRetries = 2;
  
  // Resolve any lazy content first
  const resolvedArticles = await resolveArticleContent(articles);
  
  // Check cache first
  const prompt = buildPrompt(resolvedArticles, 'cohere', options);
  const cacheKey = createContentHash(prompt);
  const cachedResponse = getCachedAIResponse(cacheKey);
  
  if (cachedResponse) {
    console.log('Using cached Cohere response');
    return { success: true, content: cachedResponse };
  }
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (!cohere) {
        return {
          success: false,
          error: 'Cohere API key not configured. Please add COHERE_API_KEY to your .env.local file.'
        };
      }
      
      console.log(`Cohere attempt ${attempt}/${maxRetries}`);
      
      const response = await cohere.chat({
        model: 'command-r', // Free tier model
        message: prompt,
        temperature: attempt === 1 ? 0.2 : 0.05, // Much lower temperature to force compliance
        maxTokens: 3000, // Increased for longer responses
        presencePenalty: attempt > 1 ? 0.5 : 0, // Add presence penalty on retry to vary output
        frequencyPenalty: attempt > 1 ? 0.3 : 0, // Add frequency penalty to break patterns
      });
      
      // Quick validation to see if response looks like JSON
      const content = response.text.trim();
      if (!content.includes('{') || !content.includes('}')) {
        if (attempt < maxRetries) {
          console.log(`Attempt ${attempt} returned non-JSON content, retrying...`);
          continue;
        }
        return {
          success: false,
          error: 'Cohere returned non-JSON response after multiple attempts. Please try Gemini instead.'
        };
      }
      
      // Use shared processing function
      const processResult = processAIResponse(response.text, options?.language, maxRetries, attempt);
      if (processResult.success) {
        // Cache successful response
        cacheAIResponse(cacheKey, processResult.content!);
        return {
          success: true,
          content: processResult.content
        };
      } else if (attempt < maxRetries && processResult.error === 'No JSON found in response') {
        console.log(`Attempt ${attempt}: ${processResult.error}, retrying...`);
        continue;
      } else {
        return {
          success: false,
          error: processResult.error
        };
      }
    } catch (error) {
      console.error(`Cohere API error on attempt ${attempt}:`, error);
      if (attempt === maxRetries) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown Cohere error' 
        };
      }
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return { 
    success: false, 
    error: 'All Cohere attempts failed' 
  };
}

// Gemini integration
export async function analyzeWithGemini(
  articles: ParsedArticle[],
  options?: { maxTopics?: number; language?: 'english' | 'hebrew' | 'spanish' | 'french' | 'german' | 'italian' | 'portuguese' }
): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    if (!geminiApiKey) {
      return {
        success: false,
        error: 'Gemini API key not found in environment variables. Please add GEMINI_API_KEY to your .env.local file.'
      };
    }
    
    if (!genAI) {
      return {
        success: false,
        error: 'Gemini API client initialization failed. Please check your API key.'
      };
    }
    
    // Resolve any lazy content first
    const resolvedArticles = await resolveArticleContent(articles);
    
    const prompt = buildPrompt(resolvedArticles, 'gemini', options);
    
    // Check cache first
    const cacheKey = createContentHash(prompt);
    const cachedResponse = getCachedAIResponse(cacheKey);
    
    if (cachedResponse) {
      console.log('Using cached Gemini response');
      return { success: true, content: cachedResponse };
    }
    
    console.log('Using Gemini API key:', geminiApiKey.substring(0, 10) + '...');

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp" // Free tier model
    });
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const rawContent = response.text();
    
    // Use shared processing function for consistent Hebrew support
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
    console.error('Gemini API error details:', error);
    
    // Check for specific API key errors
    if (error instanceof Error && error.message.includes('API key not valid')) {
      return { 
        success: false, 
        error: 'Invalid Gemini API key. Please get a new key from https://makersuite.google.com/app/apikey' 
      };
    }
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown Gemini error' 
    };
  }
}

// Generate images with Gemini (requires paid tier)
export async function generateImage(prompt: string): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  try {
    // Check if we're on free tier
    if (process.env.GEMINI_TIER === 'free' || !process.env.GEMINI_API_KEY) {
      // Return placeholder image URL for free tier
      const encodedPrompt = encodeURIComponent(prompt.slice(0, 50));
      return {
        success: true,
        imageUrl: `https://via.placeholder.com/800x400/667eea/ffffff?text=${encodedPrompt}`
      };
    }
    
    // For paid tier, use actual image generation
    if (!genAI) {
      return {
        success: false,
        error: 'Gemini API key not configured'
      };
    }
    
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp" 
    });
    
    const fullPrompt = buildGeminiImagePrompt(prompt);
    
    // Note: This is a placeholder for actual image generation
    // Gemini's image generation API may have different implementation
    await model.generateContent(fullPrompt);
    
    // For now, return a styled placeholder
    const encodedPrompt = encodeURIComponent(prompt.slice(0, 50));
    return {
      success: true,
      imageUrl: `https://source.unsplash.com/800x400/?artificial-intelligence,technology,${encodedPrompt}`
    };
    
  } catch (error) {
    console.error('Image generation error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Image generation failed' 
    };
  }
}

// Main newsletter generation function
export async function generateNewsletterContent(
  articles: ParsedArticle[], 
  provider: 'cohere' | 'gemini' = 'cohere',
  options?: { maxTopics?: number; language?: 'english' | 'hebrew' | 'spanish' | 'french' | 'german' | 'italian' | 'portuguese' }
): Promise<{ success: boolean; data?: NewsletterData; error?: string }> {
  const startTime = Date.now();
  const maxRetries = 3;
  
  // Resolve any lazy content first
  const resolvedArticles = await resolveArticleContent(articles);
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Newsletter generation attempt ${attempt}/${maxRetries}`);
      
      let response;
      
      if (provider === 'gemini') {
        response = await analyzeWithGemini(resolvedArticles, options);
      } else {
        response = await analyzeWithCohere(resolvedArticles, options);
      }
      
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
      
      // Generate images for topics if using Gemini
      if (provider === 'gemini') {
        for (const topic of newsletterData.topics) {
          if (topic.imagePrompt) {
            const imageResult = await generateImage(topic.imagePrompt);
            if (imageResult.success) {
              topic.imageUrl = imageResult.imageUrl;
            }
          }
        }
      } else {
        // Add placeholder images for Cohere
        newsletterData.topics.forEach((topic: NewsletterTopic) => {
          if (!topic.imageUrl) {
            const encodedHeadline = encodeURIComponent(topic.headline.slice(0, 30));
            topic.imageUrl = `https://source.unsplash.com/800x400/?artificial-intelligence,technology,${encodedHeadline}`;
          }
        });
      }
      
      // Add stats
      const finalData: NewsletterData = {
        ...newsletterData,
        stats: {
          sourcesAnalyzed: resolvedArticles.length,
          generationTime: Date.now() - startTime,
          llmUsed: provider
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
                category: (categoryMatch?.[1]?.replace(/\\"/g, '"').trim() || 'research') as 'research' | 'product' | 'business' | 'policy' | 'fun'
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
    'policy': 5,
    'security': 12,
    'fun': 3
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