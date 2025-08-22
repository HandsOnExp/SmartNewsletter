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
export async function analyzeWithCohere(articles: ParsedArticle[]): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    if (!cohere) {
      return {
        success: false,
        error: 'Cohere API key not configured. Please add COHERE_API_KEY to your .env.local file.'
      };
    }

    const prompt = buildPrompt(articles, 'cohere');
    
    const response = await cohere.chat({
      model: 'command-r', // Free tier model
      message: prompt,
      temperature: 0.7,
      maxTokens: 2500,
    });
    
    return {
      success: true,
      content: response.text
    };
  } catch (error) {
    console.error('Cohere API error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown Cohere error' 
    };
  }
}

// Gemini integration
export async function analyzeWithGemini(articles: ParsedArticle[]): Promise<{ success: boolean; content?: string; error?: string }> {
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
    
    const prompt = buildPrompt(articles, 'gemini');
    
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
  provider: 'cohere' | 'gemini' = 'cohere'
): Promise<{ success: boolean; data?: NewsletterData; error?: string }> {
  const startTime = Date.now();
  
  try {
    let response;
    
    if (provider === 'gemini') {
      response = await analyzeWithGemini(articles);
    } else {
      response = await analyzeWithCohere(articles);
    }
    
    if (!response.success) {
      return { success: false, error: response.error };
    }
    
    // Parse the response
    let newsletterData;
    try {
      // Clean the response to extract JSON
      let cleanedContent = response.content!;
      
      // Remove markdown code blocks
      cleanedContent = cleanedContent
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      // If response starts with markdown headers, try to extract JSON from it
      if (cleanedContent.startsWith('#') || cleanedContent.includes('##')) {
        // Look for JSON-like content between braces
        const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          cleanedContent = jsonMatch[0];
        } else {
          console.error('No JSON found in markdown response:', cleanedContent.substring(0, 200));
          return { success: false, error: 'AI returned markdown instead of JSON. Please try again or use Cohere.' };
        }
      }
      
      newsletterData = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      console.error('Response content:', response.content?.substring(0, 500));
      return { success: false, error: 'Failed to parse AI response as JSON. Please try again or use Cohere.' };
    }
    
    // Validate the structure
    if (!newsletterData.topics || !Array.isArray(newsletterData.topics)) {
      return { success: false, error: 'Invalid newsletter structure returned by AI' };
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
    
  } catch (error) {
    console.error('Newsletter generation error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error during generation' 
    };
  }
}

// Rate limiting helper
export function checkRateLimit(): { allowed: boolean; message?: string } {
  // This is a simple implementation - in production, you'd use Redis or similar
  
  // For now, always allow (implement proper rate limiting in production)
  return { allowed: true };
}