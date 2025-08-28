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
          "category": "Choose ONE primary category from: business, technology, research, product, enterprise, consumer, security, development"
        }
      ],
      "conclusion": "Witty sign-off message"
    }
    
    DO NOT include any markdown, explanations, or text outside the JSON object.`
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
          "sourceUrl": "MUST be the exact URL from one of the provided articles - never generate fake URLs",
          "category": "Choose ONE primary category from: business, technology, research, product, enterprise, consumer, security, development"
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
    
    Analyze these recent AI developments and create a newsletter with EXACTLY ${maxTopics} topics.
    
    🔗 CRITICAL URL & CONTENT REQUIREMENT: For each topic, you MUST:
    1. First read and understand the actual content of the article
    2. Write headlines and summaries that accurately reflect the article's actual content
    3. Use the exact "link" field from the article you're summarizing
    4. Do NOT write creative or misleading headlines that don't match the article
    5. Do NOT claim medical breakthroughs if the article is about movies
    6. Do NOT claim health benefits if the article is about cooking recipes
    7. Your headline and summary MUST accurately represent what the linked article actually discusses
    
    📂 CRITICAL CATEGORY REQUIREMENT: ${preferredCategories.length > 0 ? `
    ⚡ MANDATORY CATEGORIES ⚡: You MUST use ONLY these categories: ${preferredCategories.join(', ')}
    
    📝 CATEGORY ASSIGNMENT RULES:
    - Each topic MUST have "category": "<one of: ${preferredCategories.join(', ')}>"
    - Do NOT create new categories
    - Do NOT use: "business", "technology", "ai", or any other category
    - ONLY use the exact category names: ${preferredCategories.join(', ')}
    
    ✅ VALID CATEGORY VALUES: ${preferredCategories.map(c => `"${c}"`).join(', ')}
    ❌ INVALID CATEGORIES: Any category not in the above list will be rejected
    
    Example: "category": "${preferredCategories[0]}"` : 'Assign each topic ONE primary category from the standard categories.'} NEVER use "ai" as a category since this is an AI newsletter.
    
    Articles to analyze:
    ${options?.fastMode ? 
      // Minimal article data for fast mode
      JSON.stringify(sortedArticles.slice(0, 30).map(a => ({
        title: a.title,
        snippet: (typeof a.content === 'string' ? a.content.slice(0, 200) : a.contentSnippet || '').slice(0, 200) + '...',
        link: a.link,
        source: a.source
      }))) :
      // Full article data for regular mode
      JSON.stringify(sortedArticles.map(a => ({
        title: a.title,
        content: a.contentSnippet || a.content,
        date: a.pubDate,
        link: a.link,
        source: a.source
      })))
    }
    
    ${formatPrompt}
    
    ⚠️ THE "topics" ARRAY MUST CONTAIN EXACTLY ${maxTopics} OBJECTS ⚠️
    
    ⚠️ CRITICAL REQUIREMENT ⚠️ 
    THE TOPICS ARRAY MUST CONTAIN EXACTLY ${maxTopics} OBJECTS - NO MORE, NO LESS
    
    🚫 DO NOT GENERATE 13 TOPICS (unless specifically requested)
    ✅ GENERATE EXACTLY ${maxTopics} TOPICS
    
    TOPIC COUNT VALIDATION:
    - Required: ${maxTopics} topics
    - Not allowed: ${maxTopics - 2}, ${maxTopics - 1}, ${maxTopics + 1}, ${maxTopics + 2}, or any other number
    - Your response will be automatically rejected if the topic count is wrong
    
    STEP-BY-STEP INSTRUCTIONS:
    1. Read the requirement: Generate ${maxTopics} topics
    2. Select the ${maxTopics} most important AI developments
    3. Create exactly ${maxTopics} topic objects in the JSON array
    4. Count your topics: 1, 2, 3... up to ${maxTopics}
    5. Verify the count matches ${maxTopics} before responding
    
    Priority order for topic selection:
    1. Major model releases or updates
    2. Breakthrough research findings
    3. Significant business/funding news
    4. Novel applications or use cases
    5. Policy or safety developments
    6. Surprising or entertaining AI behaviors
    7. Tools that developers/users can try today
    
    ⚠️ CONTENT ACCURACY REQUIREMENT ⚠️
    - Read each article's content carefully before creating a topic
    - Your headline must match what the article actually discusses
    - Your summary must accurately reflect the article's main points
    - Do NOT create imaginative or creative headlines that mislead readers
    - Do NOT exaggerate or add claims not in the original article
    - Readers will click the link and expect to find content matching your description
    
    🔍 MANDATORY FINAL CHECK: Count your topics array length. It must equal ${maxTopics}.
  `;
}

function getLanguageInstructions(language: string): string {
  const instructions = {
    english: '',
    hebrew: `
    
    ████████████████████████████████████████████████████████████
    █                                                          █
    █   🇮🇱 עברית בלבד! HEBREW ONLY! עברית בלבד! 🇮🇱            █
    █                                                          █
    ████████████████████████████████████████████████████████████
    
    ⚠️ CRITICAL REQUIREMENT: ENTIRE RESPONSE MUST BE IN HEBREW ⚠️
    
    📖 HEBREW TEMPLATE (copy this structure exactly):
    {
      "newsletterTitle": "🤖 חדשות בינה מלאכותית: סיפורים מרתקים מהשבוע",
      "introduction": "שלום חברים! השבוע הביא עימו פיתוחים מרשימים בעולם הבינה המלאכותית...",
      "topics": [
        {
          "headline": "פריצת דרך חדשה בעולם הבינה המלאכותית",
          "summary": "חוקרים מאוניברסיטת סטנפורד פיתחו טכנולוגיה חדשנית שמאפשרת לבינה המלאכותית להבין טקסט עברי ברמה חסרת תקדים. המחקר מראה שיפורים דרמטיים ביכולות ההבנה וההפקה של תוכן בעברית, כולל הבנת דקדוק מורכב וביטויים תרבותיים. הטכנולוגיה החדשה עשויה לחולל מהפכה בשירותים הדיגיטליים הישראליים ולשפר את הנגישות לטכנולוגיה מתקדמת בעברית. החוקרים מעריכים שהטכנולוגיה תהיה זמינה לשימוש מסחרי בתוך שנתיים.",
          "keyTakeaway": "בינה מלאכותית חדשה תשנה את השירותים הדיגיטליים בישראל",
          "imagePrompt": "Modern AI brain with Hebrew letters flowing around it, blue and white tech design",
          "sourceUrl": "[use exact URL from articles]",
          "category": "research"
        }
      ],
      "conclusion": "זה היה עדכון השבוע מעולם הבינה המלאכותית. נתראה בשבוע הבא עם חדשות נוספות!"
    }
    
    🎯 HEBREW CONTENT REQUIREMENTS:
    ✅ newsletterTitle - כותרת ניוזלטר בעברית
    ✅ introduction - מבוא בעברית  
    ✅ headline - כותרת הנושא בעברית
    ✅ summary - תקציר מלא בעברית (4-6 משפטים)
    ✅ keyTakeaway - מסקנה חשובה בעברית
    ✅ conclusion - סיכום בעברית
    
    🔤 USE HEBREW TECH TERMS:
    - AI = בינה מלאכותית
    - Machine Learning = למידת מכונה  
    - Neural Networks = רשתות נוירונים
    - Algorithm = אלגוריתם
    - Data = נתונים
    `,
    
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