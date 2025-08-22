import { ParsedArticle } from '@/lib/rss-parser';

export const NEWSLETTER_PROMPTS = {
  cohere: {
    analysis: `You are an expert AI newsletter curator with a witty, engaging writing style.
    Your task is to analyze AI news and create compelling content that makes complex topics accessible.
    
    Guidelines:
    - Focus on breakthrough announcements, model releases (Claude, GPT, Gemini, etc.), and practical applications
    - Write in plain English, avoiding jargon unless necessary
    - Add humor and personality where appropriate
    - Highlight "wow moments" and "aha insights"
    - CRITICAL: Each summary MUST be 4-6 full, substantial sentences (minimum 80 words). Never write short 1-2 sentence summaries. Answer: What happened? Why does it matter? What are the key details? How does this impact readers?
    
    Tone: Professional yet conversational, like explaining to a smart friend over coffee.`,
    
    formatting: `Structure your response as valid JSON with this exact format:
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
          "sourceUrl": "Original article URL",
          "category": "research|product|business|policy|security|fun"
        }
      ],
      "conclusion": "Witty sign-off message"
    }`
  },
  
  gemini: {
    analysis: `You are crafting an AI newsletter that balances technical accuracy with accessibility.
    
    Your readers include:
    - Tech professionals wanting industry updates
    - Business leaders tracking AI trends
    - Enthusiasts following the latest developments
    
    For each topic:
    1. Lead with the most interesting angle
    2. Explain technical concepts through analogies
    3. Connect developments to real-world impact
    4. Maintain optimistic but realistic tone
    5. Include specific names, numbers, and dates
    6. Write detailed, comprehensive summaries that thoroughly explain the news
    7. Provide context, background, and industry implications
    8. CRITICAL: Make each summary exactly 4-6 full sentences (minimum 80 words). Never write brief 1-2 sentence summaries.
    
    Remember: Every topic should make readers think "I need to know about this!"`,
    
    formatting: `CRITICAL: You MUST respond with ONLY valid JSON in this exact format:
    {
      "newsletterTitle": "Catchy title with emoji (e.g., 'AI Weekly: The Future is Now 🚀')",
      "newsletterDate": "Current date in friendly format",
      "introduction": "Brief 2-3 sentence opener that hooks the reader",
      "topics": [
        {
          "headline": "Attention-grabbing headline (max 10 words)",
          "summary": "MUST be exactly 4-6 full sentences. Provide comprehensive coverage including: what happened, why it's significant, key technical details, and real-world implications. Do NOT use short sentences. Each sentence should be substantial and information-rich. Minimum 80 words total.",
          "keyTakeaway": "One sentence 'bottom line' insight",
          "imagePrompt": "Detailed prompt for image generation",
          "sourceUrl": "Original article URL",
          "category": "research|product|business|policy|security|fun"
        }
      ],
      "conclusion": "Witty sign-off message"
    }
    
    DO NOT include any markdown, headers, or text outside the JSON object.`,
    
    imageGeneration: `Create a modern, tech-focused illustration that:
    - Uses purple, blue, and pink gradients
    - Includes abstract geometric shapes
    - Feels futuristic but approachable
    - Incorporates subtle AI/tech motifs
    - Has a clean, minimalist aesthetic
    
    Specific prompt: `
  }
};

export function buildPrompt(
  articles: ParsedArticle[], 
  provider: 'cohere' | 'gemini',
  options?: {
    maxArticles?: number;
    language?: 'english' | 'hebrew' | 'spanish' | 'french' | 'german' | 'italian' | 'portuguese';
  }
) {
  const maxArticles = options?.maxArticles || 20;
  const language = options?.language || 'english';
  
  // Sort articles by date and take the most recent articles
  const sortedArticles = articles
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
    .slice(0, maxArticles);
  
  const basePrompt = NEWSLETTER_PROMPTS[provider].analysis;
  const formatPrompt = NEWSLETTER_PROMPTS[provider].formatting;
  
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Language-specific instructions
  const languageInstructions = getLanguageInstructions(language);
  
  return `
    ${basePrompt}
    ${languageInstructions}
    
    Today's date: ${currentDate}
    
    Analyze these recent AI developments and create a newsletter with EXACTLY 7 topics.
    
    Articles to analyze:
    ${JSON.stringify(sortedArticles.map(a => ({
      title: a.title,
      content: a.contentSnippet || a.content,
      date: a.pubDate,
      link: a.link,
      source: a.source
    })))}
    
    ${formatPrompt}
    
    Important: Select the most significant and interesting developments. Prioritize:
    1. Major model releases or updates
    2. Breakthrough research findings
    3. Significant business/funding news
    4. Novel applications or use cases
    5. Policy or safety developments
    6. Surprising or entertaining AI behaviors
    7. Tools that developers/users can try today
  `;
}

function getLanguageInstructions(language: string): string {
  const instructions = {
    english: '',
    hebrew: `
    
    LANGUAGE REQUIREMENT: Write the entire newsletter in Hebrew.
    - Use proper Hebrew grammar and syntax
    - Write from right-to-left as appropriate
    - Use Hebrew tech terminology where available, with English terms in parentheses when needed
    - Ensure cultural relevance for Hebrew-speaking audiences`,
    
    spanish: `
    
    LANGUAGE REQUIREMENT: Write the entire newsletter in Spanish.
    - Use proper Spanish grammar and syntax
    - Use appropriate Spanish tech terminology
    - Ensure cultural relevance for Spanish-speaking audiences
    - Use formal but approachable tone`,
    
    french: `
    
    LANGUAGE REQUIREMENT: Write the entire newsletter in French.
    - Use proper French grammar and syntax
    - Use appropriate French tech terminology
    - Ensure cultural relevance for French-speaking audiences
    - Maintain elegant and professional French writing style`,
    
    german: `
    
    LANGUAGE REQUIREMENT: Write the entire newsletter in German.
    - Use proper German grammar and syntax
    - Use appropriate German tech terminology
    - Ensure cultural relevance for German-speaking audiences
    - Use compound words appropriately for tech concepts`,
    
    italian: `
    
    LANGUAGE REQUIREMENT: Write the entire newsletter in Italian.
    - Use proper Italian grammar and syntax
    - Use appropriate Italian tech terminology
    - Ensure cultural relevance for Italian-speaking audiences
    - Maintain elegant Italian writing style`,
    
    portuguese: `
    
    LANGUAGE REQUIREMENT: Write the entire newsletter in Portuguese.
    - Use proper Portuguese grammar and syntax
    - Use appropriate Portuguese tech terminology
    - Ensure cultural relevance for Portuguese-speaking audiences
    - Use Brazilian Portuguese conventions`
  };
  
  return instructions[language as keyof typeof instructions] || '';
}

export function buildGeminiImagePrompt(topic: string): string {
  return `${NEWSLETTER_PROMPTS.gemini.imageGeneration}${topic}. Style: modern, minimalist, gradient colors (purple, blue, pink), abstract tech elements, professional but approachable.`;
}