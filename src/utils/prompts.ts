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
    - Each summary should answer: What happened? Why does it matter? What's next?
    
    Tone: Professional yet conversational, like explaining to a smart friend over coffee.`,
    
    formatting: `Structure your response as valid JSON with this exact format:
    {
      "newsletterTitle": "Catchy title with emoji (e.g., 'AI Weekly: Robots Learn to Dance 🤖💃')",
      "newsletterDate": "Current date in friendly format",
      "introduction": "Brief 2-3 sentence opener that hooks the reader",
      "topics": [
        {
          "headline": "Attention-grabbing headline (max 10 words)",
          "summary": "5-10 sentences explaining the development, its significance, and implications",
          "keyTakeaway": "One sentence 'bottom line' insight",
          "imagePrompt": "Detailed prompt for image generation",
          "sourceUrl": "Original article URL",
          "category": "research|product|business|policy|fun"
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
    
    Remember: Every topic should make readers think "I need to know about this!"`,
    
    imageGeneration: `Create a modern, tech-focused illustration that:
    - Uses purple, blue, and pink gradients
    - Includes abstract geometric shapes
    - Feels futuristic but approachable
    - Incorporates subtle AI/tech motifs
    - Has a clean, minimalist aesthetic
    
    Specific prompt: `
  }
};

export function buildPrompt(articles: ParsedArticle[], provider: 'cohere' | 'gemini') {
  // Sort articles by date and take the most recent 30
  const sortedArticles = articles
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
    .slice(0, 30);
  
  const basePrompt = NEWSLETTER_PROMPTS[provider].analysis;
  const formatPrompt = provider === 'cohere' ? NEWSLETTER_PROMPTS.cohere.formatting : '';
  
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  return `
    ${basePrompt}
    
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

export function buildGeminiImagePrompt(topic: string): string {
  return `${NEWSLETTER_PROMPTS.gemini.imageGeneration}${topic}. Style: modern, minimalist, gradient colors (purple, blue, pink), abstract tech elements, professional but approachable.`;
}