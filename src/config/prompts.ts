import { ParsedArticle } from '@/lib/rss-parser';

export const NEWSLETTER_PROMPTS = {
  gemini: {
    analysis: `You are an expert AI newsletter curator with a witty, engaging writing style.
    Your task is to analyze AI news and create compelling content that makes complex topics accessible.
    
    Guidelines:
    - Focus on breakthrough announcements, model releases (Claude, GPT, Gemini, etc.), and practical applications
    - Write in plain English, avoiding jargon unless necessary
    - Add humor and personality where appropriate
    - Highlight "wow moments" and "aha insights"
    - CRITICAL: Each summary MUST be 4-6 full, substantial sentences (minimum 80 words). Never write short 1-2 sentence summaries. Answer: What happened? Why does it matter? What are the key details? How does this impact readers?
    
    Tone: Professional yet conversational, like explaining to a smart friend over coffee.`,
    
    formatting: `CRITICAL: You MUST respond with ONLY valid JSON in this exact format. Do NOT include any text before or after the JSON object. Do NOT use markdown code blocks.

    JSON FORMAT (no extra text):
    {
      "newsletterTitle": "Catchy title with emoji (e.g., 'AI Weekly: Robots Learn to Dance 🤖💃')",
      "newsletterDate": "Current date in friendly format",
      "introduction": "Brief 2-3 sentence opener that hooks the reader",
      "topics": [
        {
          "headline": "Attention-grabbing headline (max 10 words)",
          "summary": "MUST be exactly 4-6 full sentences. Provide comprehensive coverage including: what happened, why it's significant, key technical details, and real-world implications. Do NOT use short sentences. Each sentence should be substantial and information-rich. Minimum 80 words total.",
          "keyTakeaway": "One sentence 'bottom line' insight",
          "imagePrompt": "Detailed prompt for image generation",
          "sourceUrl": "MUST be the exact URL from one of the provided articles - never generate fake URLs",
          "category": "Pick ONE: 'business', 'technology', 'research', 'product', 'enterprise', 'consumer', 'security', 'development'"
        }
      ],
      "conclusion": "Upbeat 1-2 sentence wrap-up"
    }
    
    RULES:
    - Use ONLY URLs from the provided articles
    - Each topic MUST have exactly one sourceUrl
    - Do NOT invent or modify URLs
    - Each summary MUST be 4-6 complete sentences, minimum 80 words`
  }
};

export function buildPrompt(
  articles: ParsedArticle[], 
  provider: 'gemini',
  options?: {
    maxTopics?: number;
    language?: 'english' | 'hebrew' | 'spanish' | 'french' | 'german' | 'italian' | 'portuguese';
    preferredCategories?: string[];
    fastMode?: boolean;
  }
) {
  const maxTopics = options?.maxTopics || 7;
  const language = options?.language || 'english';
  const preferredCategories = options?.preferredCategories || [];
  
  // Sort articles by date and take the most recent articles (use more articles for analysis)
  const sortedArticles = articles
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
    .slice(0, Math.min(articles.length, 100)); // Analyze up to 100 articles to find the best topics
  
  const basePrompt = options?.fastMode ? 
    // Simplified prompt for fast mode
    `You are an AI newsletter curator. Create concise, accurate summaries for ${maxTopics} AI topics. Focus on clarity and brevity.` :
    NEWSLETTER_PROMPTS[provider].analysis;
    
  const formatPrompt = options?.fastMode ?
    // Simplified format for fast mode
    `CRITICAL: Response must be ONLY valid JSON in this format:
    {"newsletterTitle":"Title","topics":[{"headline":"Title","summary":"4-6 sentences","sourceUrl":"exact URL from articles","category":"category"}]}` :
    NEWSLETTER_PROMPTS[provider].formatting;
  
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Language-specific instructions
  const languageInstructions = getLanguageInstructions(language);
  
  return `
    ${languageInstructions}
    
    ${basePrompt}
    
    Today's date: ${currentDate}
    
    🎯 TARGET: ${maxTopics} TOPICS (NOT 13, NOT 7, EXACTLY ${maxTopics})
    
    ${preferredCategories.length > 0 ? `
    🎯 PREFERRED CATEGORIES: Focus on these categories when possible: ${preferredCategories.join(', ')}
    ` : ''}
    
    ARTICLES TO ANALYZE (${sortedArticles.length} articles):
    ${sortedArticles.map((article, index) => `
    [${index + 1}] TITLE: ${article.title}
    DATE: ${article.pubDate}
    SOURCE: ${article.source}
    URL: ${article.link}
    CONTENT: ${article.contentSnippet || 'No preview available'}
    ${article.content && typeof article.content === 'string' ? `FULL_TEXT: ${article.content.substring(0, 500)}...` : ''}
    `).join('\n')}
    
    ${formatPrompt}
  `;
}

// Language-specific instructions
function getLanguageInstructions(language: string): string {
  const instructions = {
    english: 'Write everything in English.',
    hebrew: `🇮🇱 HEBREW LANGUAGE INSTRUCTIONS:
    - Write ALL content in Hebrew (title, introduction, headlines, summaries, conclusion)
    - Use modern, natural Hebrew
    - Keep technical terms in English only when necessary (API, AI, ML)
    - Use Hebrew punctuation and formatting
    - Example headline: "בינה מלאכותית משנה את עולם הטכנולוgia"
    - Be culturally appropriate for Israeli readers`,
    spanish: 'Escribe todo el contenido en español. Usa un tono profesional pero accesible.',
    french: 'Écrivez tout le contenu en français. Utilisez un ton professionnel mais accessible.',
    german: 'Schreiben Sie alle Inhalte auf Deutsch. Verwenden Sie einen professionellen, aber zugänglichen Ton.',
    italian: 'Scrivi tutti i contenuti in italiano. Usa un tono professionale ma accessibile.',
    portuguese: 'Escreva todo o conteúdo em português. Use um tom profissional, mas acessível.'
  };
  
  return instructions[language as keyof typeof instructions] || instructions.english;
}

// Gemini-specific image generation prompt builder
export function buildGeminiImagePrompt(originalPrompt: string): string {
  return `Create a professional, clean illustration for an AI newsletter based on this prompt: "${originalPrompt}". 
  The image should be modern, tech-focused, and suitable for a business audience. 
  Use a clean, minimalist style with professional colors (blues, greens, purples). 
  Avoid clutter and ensure readability if text is included.`;
}