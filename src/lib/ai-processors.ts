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
        temperature: attempt === 1 ? 0.3 : 0.1, // Lower temperature on retry for more structured output
        maxTokens: 3000, // Increased for longer responses
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
          .replace(/,\s*]/g, ']'); // Remove trailing commas in arrays
        
        console.log('Cleaned content for parsing:', cleanedContent.substring(0, 200) + '...');
        
        newsletterData = JSON.parse(cleanedContent);
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
      
      // Validate the exact number of topics
      const expectedTopics = options?.maxTopics || 7;
      const actualTopics = newsletterData.topics.length;
      if (actualTopics !== expectedTopics) {
        if (attempt === maxRetries) {
          return { 
            success: false, 
            error: `AI consistently generated ${actualTopics} topics but user requested exactly ${expectedTopics} topics. Please try again or adjust your topic count.` 
          };
        }
        console.log(`Attempt ${attempt}: Generated ${actualTopics} topics, expected ${expectedTopics}. Retrying...`);
        continue;
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

// Rate limiting helper
export function checkRateLimit(): { allowed: boolean; message?: string } {
  // This is a simple implementation - in production, you'd use Redis or similar
  
  // For now, always allow (implement proper rate limiting in production)
  return { allowed: true };
}