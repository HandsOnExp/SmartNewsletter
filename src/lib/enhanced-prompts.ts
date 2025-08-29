/**
 * Enhanced AI Prompt System with Multi-Stage Context Analysis
 * Provides better content quality through structured prompt engineering
 */

import { ParsedArticle } from '@/lib/rss-parser';
import { ExtractedContent } from '@/lib/content-extractor';

export interface EnhancedPromptOptions {
  maxTopics: number;
  language: 'english' | 'hebrew' | 'spanish' | 'french' | 'german' | 'italian' | 'portuguese';
  preferredCategories?: string[];
  useEnhancedContent?: boolean;
  contextAnalysis?: boolean;
  factualAccuracyMode?: boolean;
  creativityLevel?: 'conservative' | 'balanced' | 'creative';
}

export interface ContextAnalysis {
  trendingTopics: string[];
  keyEntities: string[];
  timeframeInsights: string[];
  categoryDistribution: Record<string, number>;
  qualityInsights: string[];
  diversityScore: number;
}

/**
 * Analyze article context to provide better AI guidance
 */
export function analyzeArticleContext(
  articles: ParsedArticle[] | ExtractedContent[]
): ContextAnalysis {
  const allTopics = new Set<string>();
  const allEntities = new Set<string>();
  const categoryCount: Record<string, number> = {};
  const timeframes: Date[] = [];
  
  // Extract insights from articles
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  articles.forEach((article: any) => {
    // Handle both ParsedArticle and ExtractedContent
    if ('topics' in article && Array.isArray(article.topics)) {
      article.topics.forEach((topic: string) => allTopics.add(topic));
    }
    
    if ('entities' in article && Array.isArray(article.entities)) {
      article.entities.forEach((entity: string) => allEntities.add(entity));
    }
    
    // Extract categories from content
    if ('categories' in article && Array.isArray(article.categories)) {
      article.categories.forEach((cat: string) => {
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
      });
    }
    
    // Parse publication dates
    const pubDate = 'publishedAt' in article ? article.publishedAt : article.pubDate;
    if (pubDate) {
      timeframes.push(new Date(pubDate));
    }
  });
  
  // Calculate trending topics (most frequent)
  const topicFrequency = new Map<string, number>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  articles.forEach((article: any) => {
    const content = ('content' in article ? article.content : article.contentSnippet) || '';
    const title = article.title || '';
    const text = `${title} ${content}`.toLowerCase();
    
    // Count AI/tech keywords
    const techKeywords = [
      'artificial intelligence', 'machine learning', 'ai model', 'neural network',
      'chatgpt', 'gpt-4', 'claude', 'gemini', 'llm', 'generative ai',
      'automation', 'robotics', 'computer vision', 'natural language processing'
    ];
    
    techKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        topicFrequency.set(keyword, (topicFrequency.get(keyword) || 0) + 1);
      }
    });
  });
  
  const trendingTopics = Array.from(topicFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic]) => topic);
  
  // Calculate time insights
  timeframes.sort((a, b) => b.getTime() - a.getTime());
  const latestDate = timeframes[0];
  const oldestDate = timeframes[timeframes.length - 1];
  const timeSpan = latestDate && oldestDate 
    ? Math.round((latestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60))
    : 0;
  
  const timeframeInsights = [
    timeSpan < 24 ? 'Very recent news (last 24 hours)' : 
    timeSpan < 72 ? 'Recent developments (last 3 days)' : 'Weekly digest content',
    `${timeframes.length} articles across ${timeSpan} hours`,
    latestDate ? `Most recent: ${latestDate.toISOString().split('T')[0]}` : ''
  ].filter(Boolean);
  
  // Quality insights for enhanced content
  let qualityInsights: string[] = [];
  if (articles.length > 0 && 'quality' in articles[0]) {
    const enhancedArticles = articles as ExtractedContent[];
    const avgQuality = enhancedArticles.reduce((sum, a) => sum + a.quality.score, 0) / enhancedArticles.length;
    const avgWordCount = enhancedArticles.reduce((sum, a) => sum + a.wordCount, 0) / enhancedArticles.length;
    
    qualityInsights = [
      `Average content quality: ${avgQuality.toFixed(1)}/100`,
      `Average article length: ${Math.round(avgWordCount)} words`,
      avgQuality > 80 ? 'High-quality source material' : 
      avgQuality > 60 ? 'Good source material' : 'Mixed quality sources'
    ];
  }
  
  // Calculate diversity score
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uniqueSources = new Set(articles.map((a: any) => a.source || 'unknown')).size;
  const diversityScore = Math.min(100, (uniqueSources / Math.max(1, articles.length)) * 100);
  
  return {
    trendingTopics,
    keyEntities: Array.from(allEntities).slice(0, 10),
    timeframeInsights,
    categoryDistribution: categoryCount,
    qualityInsights,
    diversityScore: Math.round(diversityScore)
  };
}

/**
 * Build enhanced prompt with context analysis
 */
export function buildEnhancedPrompt(
  articles: ParsedArticle[] | ExtractedContent[],
  options: EnhancedPromptOptions
): string {
  const {
    maxTopics,
    language,
    preferredCategories = [],
    useEnhancedContent = false,
    contextAnalysis = true,
    factualAccuracyMode = true,
    creativityLevel = 'balanced'
  } = options;
  
  // Perform context analysis
  const context = contextAnalysis ? analyzeArticleContext(articles) : null;
  
  // Build multi-stage prompt
  const prompt = `
${getLanguageInstructions(language)}

${getRoleAndObjective(creativityLevel, factualAccuracyMode)}

${getContextualGuidance(context, useEnhancedContent)}

${getContentRequirements(maxTopics, preferredCategories)}

${getQualityStandards(factualAccuracyMode, useEnhancedContent)}

${getArticleData(articles, useEnhancedContent)}

${getOutputFormat(language)}

${getFinalValidation(maxTopics, factualAccuracyMode)}
  `;
  
  return prompt.trim();
}

function getRoleAndObjective(creativityLevel: string, factualAccuracyMode: boolean): string {
  const creativityMap = {
    conservative: 'You prioritize accuracy and clarity above all else. Write in a straightforward, informative style.',
    balanced: 'You balance accuracy with engaging storytelling. Make complex topics accessible while maintaining precision.',
    creative: 'You craft compelling narratives around AI developments while ensuring factual accuracy.'
  };
  
  return `
🎯 YOUR ROLE: Expert AI Newsletter Curator & Content Analyst

MISSION: Transform raw AI news into a compelling, accurate newsletter that makes complex developments accessible to diverse audiences.

STYLE GUIDANCE: ${creativityMap[creativityLevel as keyof typeof creativityMap]}

${factualAccuracyMode ? `
🔍 FACTUAL ACCURACY MODE ACTIVATED:
- Every claim must be verifiable from the source articles
- No speculation or extrapolation beyond stated facts
- Clearly distinguish between announced plans and actual achievements
- Use precise language: "announced plans to..." vs "has developed..."
- Include specific details: dates, numbers, company names, technical specifications
` : ''}
  `;
}

function getContextualGuidance(context: ContextAnalysis | null, useEnhancedContent: boolean): string {
  if (!context) return '';
  
  return `
📊 CONTENT INTELLIGENCE BRIEFING:
${context.trendingTopics.length > 0 ? `
🔥 TRENDING: ${context.trendingTopics.slice(0, 3).join(', ')}
- These topics are appearing frequently in current sources
- Consider featuring breakthrough developments in these areas` : ''}

⏰ TEMPORAL CONTEXT: ${context.timeframeInsights.join(' • ')}

${context.qualityInsights.length > 0 ? `
📈 SOURCE QUALITY: ${context.qualityInsights.join(' • ')}
${useEnhancedContent ? '✅ Full article content available for analysis' : '⚠️ Working with article excerpts only'}
` : ''}

🎯 CONTENT DIVERSITY: ${context.diversityScore}% source variety
${context.diversityScore > 70 ? '✅ Excellent source diversity' : '⚠️ Consider balancing sources'}

${context.keyEntities.length > 0 ? `
🏢 KEY PLAYERS: ${context.keyEntities.slice(0, 5).join(', ')}
- Reference these entities when relevant for context` : ''}
  `;
}

function getContentRequirements(maxTopics: number, preferredCategories: string[]): string {
  return `
📝 CONTENT REQUIREMENTS:
- Generate EXACTLY ${maxTopics} newsletter topics (not ${maxTopics - 1}, not ${maxTopics + 1})
- Each summary must be 4-6 substantial sentences (minimum 80 words)
- Focus on "why this matters" not just "what happened"
- Include specific details: companies, dates, numbers, technical terms
- Make complex AI concepts accessible to general audience

${preferredCategories.length > 0 ? `
📂 CATEGORY FOCUS: ${preferredCategories.join(', ')}
- ALL topics must use these categories only
- Map related topics to the closest preferred category
- Example mappings: "research" → "technology", "startups" → "business"
` : ''}

🎯 TOPIC PRIORITY ORDER:
1. Major product launches or model releases
2. Significant research breakthroughs with practical implications
3. Major funding/acquisition announcements
4. Policy developments affecting AI industry
5. Novel applications in real-world scenarios
6. Notable technical achievements or benchmarks
  `;
}

function getQualityStandards(factualAccuracyMode: boolean, useEnhancedContent: boolean): string {
  return `
⭐ QUALITY STANDARDS:
- Headlines: Clear, specific, avoid generic terms like "AI Breakthrough"
- Summaries: Start with the most newsworthy angle, then provide context
- Writing: Active voice, concrete examples, avoid marketing fluff
- Technical accuracy: Use precise terminology, explain complex concepts
${factualAccuracyMode ? '- Fact-checking: Every claim must be traceable to source article' : ''}

${useEnhancedContent ? `
📚 ENHANCED CONTENT MODE:
- You have access to full article text, not just excerpts
- Use this depth to provide richer context and details
- Reference specific quotes, data points, and technical specifications
- Identify nuances and implications that might be missed in summaries
` : `
📰 STANDARD MODE:
- Working with article headlines and excerpts
- Focus on clearly stated facts and announcements
- Avoid speculation about details not explicitly mentioned
`}

❌ AVOID:
- Generic headlines like "New AI Development" or "Company Announces Update"
- Overly promotional language
- Technical jargon without explanation
- Speculation beyond what's stated in sources
- Misleading implications about capabilities or timeline
  `;
}

function getArticleData(articles: ParsedArticle[] | ExtractedContent[], useEnhancedContent: boolean): string {
  if (useEnhancedContent) {
    // Enhanced articles with full content
    const enhancedArticles = articles as ExtractedContent[];
    return `
📰 SOURCE ARTICLES (Enhanced with Full Content):
${JSON.stringify(enhancedArticles.map(article => ({
  title: article.title,
  fullContent: article.content.substring(0, 2000) + (article.content.length > 2000 ? '...' : ''),
  excerpt: article.excerpt,
  publishedAt: article.publishedAt,
  sourceUrl: article.sourceUrl,
  qualityScore: article.quality.score,
  wordCount: article.wordCount,
  topics: article.topics,
  entities: article.entities,
  author: article.author
})), null, 2)}
    `;
  } else {
    // Standard articles
    const standardArticles = articles as ParsedArticle[];
    return `
📰 SOURCE ARTICLES (Standard RSS Content):
${JSON.stringify(standardArticles.slice(0, 50).map(article => ({
  title: article.title,
  content: article.contentSnippet || (typeof article.content === 'string' ? article.content.substring(0, 500) : ''),
  date: article.pubDate,
  link: article.link,
  source: article.source,
  categories: article.categories
})), null, 2)}
    `;
  }
}

function getOutputFormat(language: string): string {
  if (language === 'hebrew') {
    return `
📋 פורמט התגובה (Hebrew JSON Format):
{
  "newsletterTitle": "כותרת ניוזלטר בעברית עם אמוג'י",
  "newsletterDate": "תאריך נוכחי בעברית",
  "introduction": "מבוא קצר בעברית (2-3 משפטים)",
  "topics": [
    {
      "headline": "כותרת בעברית (עד 8 מילים)",
      "summary": "תקציר מלא בעברית - בדיוק 4-6 משפטים מהותיים (מינימום 80 מילים). חובה להסביר: מה קרה, למה זה חשוב, פרטים טכניים מרכזיים, והשלכות על הקוראים.",
      "keyTakeaway": "מסקנה מרכזית במשפט אחד בעברית",
      "imagePrompt": "תיאור לתמונה באנגלית",
      "sourceUrl": "כתובת URL מדויקת מהמאמרים",
      "category": "קטגוריה מהרשימה המותרת"
    }
  ],
  "conclusion": "סיכום חברותי בעברית"
}

⚠️ חשוב: כל התוכן חייב להיות בעברית מלבד imagePrompt ו-sourceUrl
    `;
  }
  
  return `
📋 RESPONSE FORMAT (JSON Only - No Extra Text):
{
  "newsletterTitle": "Engaging title with emoji",
  "newsletterDate": "Current date in friendly format", 
  "introduction": "Brief 2-3 sentence opener",
  "topics": [
    {
      "headline": "Specific, attention-grabbing headline (max 8 words)",
      "summary": "Exactly 4-6 substantial sentences (minimum 80 words). Must explain: what happened, why it matters, key technical details, and implications for readers.",
      "keyTakeaway": "One sentence bottom-line insight",
      "imagePrompt": "Detailed image generation prompt",
      "sourceUrl": "Exact URL from provided articles",
      "category": "One of the allowed categories"
    }
  ],
  "conclusion": "Friendly sign-off message"
}

⚠️ CRITICAL: Response must be valid JSON only. No markdown, no explanations, no extra text.
  `;
}

function getFinalValidation(maxTopics: number, factualAccuracyMode: boolean): string {
  return `
🔍 FINAL VALIDATION CHECKLIST:
□ Exactly ${maxTopics} topics in the JSON array
□ Each headline is specific and compelling (not generic)
□ Each summary is 4-6 sentences with minimum 80 words
□ All sourceUrls are exact matches from provided articles
□ All categories match the allowed list
□ Headlines accurately reflect article content
${factualAccuracyMode ? '□ All claims are verifiable from source articles' : ''}
□ JSON is valid and contains no extra text

⚠️ MANDATORY FINAL STEP: Count your topics array. It must contain exactly ${maxTopics} objects.

🚫 AUTOMATIC REJECTION CRITERIA:
- Wrong number of topics (not ${maxTopics})
- Invalid JSON format
- Generic or misleading headlines
- Summaries shorter than 80 words
- URLs not from provided articles
  `;
}

function getLanguageInstructions(language: string): string {
  if (language === 'hebrew') {
    return `
🇮🇱 הנחיות עברית - HEBREW CONTENT REQUIREMENT 🇮🇱

⚠️ דרישה קריטית: כל התוכן חייב להיות בעברית מושלמת ⚠️

📝 דרישות תוכן בעברית:
- כותרות נושאים: עברית ברורה ומעניינת
- תקצירים: עברית זורמת ומקצועית (4-6 משפטים מלאים)
- טרמינולוגיה טכנית: השתמש במונחי טכנולוגיה מקובלים בעברית
- סגנון: רשמי אך נגיש, מתאים לקהל ישראלי

🔤 מונחי מפתח בעברית:
- AI = בינה מלאכותית
- Machine Learning = למידת מכונה
- Neural Networks = רשתות עצביות
- Algorithm = אלגוריתם
- Data = נתונים
- Startup = חברה ناشئة/סטארט-אפ
    `;
  }
  
  return '🌐 Language: English content required unless otherwise specified';
}