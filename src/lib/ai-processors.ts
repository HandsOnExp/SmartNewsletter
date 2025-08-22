import { CohereClient } from 'cohere-ai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ParsedArticle } from './rss-parser';
import { buildPrompt, buildGeminiImagePrompt } from '@/utils/prompts';

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
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (!cohere) {
        return {
          success: false,
          error: 'Cohere API key not configured. Please add COHERE_API_KEY to your .env.local file.'
        };
      }

      const prompt = buildPrompt(articles, 'cohere', options);
      
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
      
      return {
        success: true,
        content: response.text
      };
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
    
    console.log('Using Gemini API key:', geminiApiKey.substring(0, 10) + '...');

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp" // Free tier model
    });
    
    const prompt = buildPrompt(articles, 'gemini', options);
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    return {
      success: true,
      content: response.text()
    };
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
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Newsletter generation attempt ${attempt}/${maxRetries}`);
      
      let response;
      
      if (provider === 'gemini') {
        response = await analyzeWithGemini(articles, options);
      } else {
        response = await analyzeWithCohere(articles, options);
      }
      
      if (!response.success) {
        if (attempt === maxRetries) {
          return { success: false, error: response.error };
        }
        console.log(`Attempt ${attempt} failed, retrying...`);
        continue;
      }
      
      // Parse the response
      let newsletterData;
      try {
        // Clean the response to extract JSON
        let cleanedContent = response.content!;
        
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
                error: `AI returned non-JSON content. Response started with: "${cleanedContent.substring(0, 100)}...". Please try again or switch to Gemini.` 
              };
            }
            console.log(`Attempt ${attempt}: No JSON found in response, retrying...`);
            continue;
          }
        }
        
        // Additional cleaning for common AI response issues
        cleanedContent = cleanedContent
          .replace(/\n\s*\/\/.*$/gm, '') // Remove comment lines
          .replace(/,\s*}/g, '}') // Remove trailing commas
          .replace(/,\s*]/g, ']') // Remove trailing commas in arrays
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters that can break JSON
          .replace(/\r\n/g, '\n') // Normalize line endings
          .replace(/\n/g, '\\n') // Escape newlines in strings
          .replace(/\t/g, '\\t'); // Escape tabs
        
        // Additional validation for Hebrew and RTL text
        if (options?.language && ['hebrew', 'arabic'].includes(options.language)) {
          // Extra cleaning for RTL languages
          cleanedContent = cleanedContent
            .replace(/[\u200E\u200F\u202A\u202B\u202C\u202D\u202E]/g, '') // Remove RTL/LTR marks
            .replace(/\u00A0/g, ' '); // Replace non-breaking spaces
        }
        
        console.log('Cleaned content for parsing:', cleanedContent.substring(0, 200) + '...');
        
        // Use enhanced JSON validation with language-specific repair
        const validationResult = validateAndRepairJSON(cleanedContent, options?.language);
        
        if (validationResult.success) {
          newsletterData = validationResult.data as { 
            topics: NewsletterTopic[];
            newsletterTitle: string;
            newsletterDate: string;
            introduction?: string;
            conclusion?: string;
          };
        } else {
          throw new Error(validationResult.error || 'JSON validation failed');
        }
      } catch (parseError) {
        console.error(`Attempt ${attempt} JSON parsing error:`, parseError);
        if (attempt === maxRetries) {
          return { 
            success: false, 
            error: `Failed to parse AI response as JSON after ${maxRetries} attempts. Error: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}. Please try again or switch to Gemini.` 
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
          // Too few topics - only retry if significantly under (more than 2 topics short)
          const shortfall = expectedTopics - actualTopics;
          if (shortfall > 2 && attempt < maxRetries) {
            console.log(`Attempt ${attempt}: Generated only ${actualTopics} topics, expected ${expectedTopics}. Retrying...`);
            continue;
          } else {
            console.log(`Generated ${actualTopics} topics (${shortfall} short), but proceeding since close to target`);
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
          sourcesAnalyzed: articles.length,
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

// JSON validation and repair for non-Latin languages
function validateAndRepairJSON(jsonString: string, language?: string): { success: boolean; data?: unknown; error?: string } {
  try {
    const parsed = JSON.parse(jsonString);
    return { success: true, data: parsed };
  } catch (parseError) {
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
        // Fix Hebrew punctuation that might break JSON
        .replace(/[\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4]/g, '') // Hebrew punctuation marks
        // Escape problematic Hebrew characters in strings
        .replace(/"([^"]*[א-ת\u0590-\u05FF][^"]*?)"/g, (match, content) => {
          // Clean the content inside quotes
          const cleaned = content
            .replace(/\\/g, '\\\\') // Escape backslashes
            .replace(/"/g, '\\"') // Escape quotes
            .replace(/\n/g, '\\n') // Escape newlines
            .replace(/\r/g, '\\r') // Escape carriage returns
            .replace(/\t/g, '\\t'); // Escape tabs
          return `"${cleaned}"`;
        })
        // Fix unquoted Hebrew text (common AI mistake)
        .replace(/:\s*([א-ת][^\s,}\]]*(?:\s+[א-ת][^\s,}\]]*)*)\s*([,}\]])/g, ': "$1"$2')
        // Fix Hebrew text that spans multiple lines
        .replace(/:\s*"([^"]*[א-ת][^"]*)\n([^"]*[א-ת][^"]*?)"\s*([,}\]])/g, ': "$1 $2"$3');
    }
    
    // General JSON repairs
    repairedJson = repairedJson
      .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
      .replace(/\n/g, '\\n') // Escape newlines
      .replace(/\t/g, '\\t') // Escape tabs
      .replace(/\r/g, '\\r') // Escape carriage returns
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, ''); // Remove control characters
    
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
    
    // Extract key components using regex patterns
    const titleMatch = brokenJson.match(/"newsletterTitle"\s*:\s*"([^"]*(?:[א-ת][^"]*)*)"/);
    const dateMatch = brokenJson.match(/"newsletterDate"\s*:\s*"([^"]*(?:[א-ת][^"]*)*)"/);
    const introMatch = brokenJson.match(/"introduction"\s*:\s*"([^"]*(?:[א-ת][^"]*)*)"/);
    const conclusionMatch = brokenJson.match(/"conclusion"\s*:\s*"([^"]*(?:[א-ת][^"]*)*)"/);
    
    // Extract topics array - this is more complex
    const topicsMatch = brokenJson.match(/"topics"\s*:\s*\[([\s\S]*?)\]/);
    const topics = [];
    
    if (topicsMatch) {
      // Split topics by }, { pattern but be careful with Hebrew content
      const topicsContent = topicsMatch[1];
      const topicBlocks = topicsContent.split(/},\s*{/);
      
      for (let i = 0; i < topicBlocks.length; i++) {
        let block = topicBlocks[i].trim();
        if (i === 0) block = block.replace(/^{/, '');
        if (i === topicBlocks.length - 1) block = block.replace(/}$/, '');
        if (i > 0) block = '{' + block;
        if (i < topicBlocks.length - 1) block = block + '}';
        
        try {
          // Extract individual topic fields
          const headlineMatch = block.match(/"headline"\s*:\s*"([^"]*)"/);
          const summaryMatch = block.match(/"summary"\s*:\s*"([^"]*(?:[א-ת][^"]*)*)"/);
          const takeawayMatch = block.match(/"keyTakeaway"\s*:\s*"([^"]*(?:[א-ת][^"]*)*)"/);
          const imageMatch = block.match(/"imagePrompt"\s*:\s*"([^"]*)"/);
          const urlMatch = block.match(/"sourceUrl"\s*:\s*"([^"]*)"/);
          const categoryMatch = block.match(/"category"\s*:\s*"([^"]*)"/);
          
          if (headlineMatch && summaryMatch) {
            topics.push({
              headline: headlineMatch[1] || '',
              summary: summaryMatch[1] || '',
              keyTakeaway: takeawayMatch?.[1] || '',
              imagePrompt: imageMatch?.[1] || 'AI technology illustration',
              sourceUrl: urlMatch?.[1] || '',
              category: categoryMatch?.[1] || 'research'
            });
          }
        } catch (topicError) {
          console.log(`Failed to parse topic ${i}:`, topicError);
        }
      }
    }
    
    // Reconstruct the JSON object
    const reconstructed = {
      newsletterTitle: titleMatch?.[1] || 'AI Newsletter in Hebrew',
      newsletterDate: dateMatch?.[1] || new Date().toLocaleDateString('he-IL'),
      introduction: introMatch?.[1] || 'חדשות AI השבוע',
      topics: topics,
      conclusion: conclusionMatch?.[1] || 'זהו לשבוע זה!'
    };
    
    console.log(`Reconstructed newsletter with ${topics.length} topics`);
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