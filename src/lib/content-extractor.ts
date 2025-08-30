/**
 * Advanced content extraction utilities for better newsletter quality
 * Fetches full article content, analyzes quality, and provides enhanced context
 */

import { ParsedArticle } from '@/lib/rss-parser';
import { createContentHash, cacheAIResponse, getCachedAIResponse } from '@/utils/cache-optimization';

export interface ExtractedContent {
  title: string;
  content: string;
  excerpt: string;
  author?: string;
  publishedAt: string;
  wordCount: number;
  readingTime: number; // minutes
  quality: ContentQuality;
  topics: string[];
  entities: string[];
  sourceUrl: string;
}

export interface ContentQuality {
  score: number; // 0-110 (with extraction bonus)
  factors: {
    length: number; // Word count contribution
    freshness: number; // Recency contribution
    authority: number; // Source authority contribution
    engagement: number; // Potential engagement score
    relevance: number; // AI/tech relevance
    extraction: number; // Full content extraction success bonus
  };
  reasoning: string;
}

export interface ContentExtractionOptions {
  maxArticles: number;
  minWordCount: number;
  maxAge: number; // hours
  qualityThreshold: number; // 0-100
  enhanceWithFullContent: boolean;
  domainReliabilityCheck: boolean; // Enable domain-based filtering
}

const DEFAULT_OPTIONS: ContentExtractionOptions = {
  maxArticles: 20,
  minWordCount: 150, // Lowered from 200
  maxAge: 72, // 3 days
  qualityThreshold: 45, // Lowered from 60 to be more inclusive
  enhanceWithFullContent: true,
  domainReliabilityCheck: true
};

// Domain reliability mapping based on observed extraction success rates
const DOMAIN_RELIABILITY: Record<string, { reliability: number; skipExtraction?: boolean; fallbackToRSS?: boolean }> = {
  // High reliability domains (90%+ success rate)
  'techcrunch.com': { reliability: 95 },
  'arstechnica.com': { reliability: 95 },
  'spectrum.ieee.org': { reliability: 95 },
  'wired.com': { reliability: 90 },
  'news.mit.edu': { reliability: 90 },
  'blog.google': { reliability: 90 },
  'openai.com': { reliability: 90 },
  'technologyreview.com': { reliability: 90 }, // MIT Technology Review
  'distill.pub': { reliability: 95 }, // Distill research
  'infoworld.com': { reliability: 85 }, // InfoWorld AI
  'unite.ai': { reliability: 80 }, // Unite.AI
  
  // Medium reliability domains (60-89% success rate)
  'venturebeat.com': { reliability: 70, fallbackToRSS: true }, // Known XML issues
  'marktechpost.com': { reliability: 75 },
  'artificialintelligence-news.com': { reliability: 80 },
  'aibusiness.com': { reliability: 75 },
  'nvidia.com': { reliability: 85 }, // NVIDIA blog
  
  // Low reliability domains (paywall/403 issues) - Removed Analytics India Magazine
  'fastcompany.com': { reliability: 30, fallbackToRSS: true }, // Known 403 issues
  'businessinsider.com': { reliability: 40, fallbackToRSS: true },
  
  // Research domains (often have accessibility issues but valuable content)
  'arxiv.org': { reliability: 50, fallbackToRSS: true },
  'nature.com': { reliability: 60, fallbackToRSS: true },
  
  // Default for unknown domains
  'default': { reliability: 70 }
};

/**
 * Extract and enhance article content for better AI analysis
 */
export async function extractAndEnhanceContent(
  articles: ParsedArticle[], 
  options: Partial<ContentExtractionOptions> = {}
): Promise<ExtractedContent[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();
  
  console.log(`Starting content extraction for ${articles.length} articles...`);
  console.log(`🔧 Content extraction settings: maxArticles=${opts.maxArticles}, qualityThreshold=${opts.qualityThreshold}, domainReliabilityCheck=${opts.domainReliabilityCheck}`);
  
  // Step 1: Filter and sort articles by basic criteria
  const filteredArticles = articles
    .filter(article => {
      // Basic filtering
      if (!article.title || !article.link || !article.pubDate) return false;
      
      // Age filtering
      const articleAge = (Date.now() - new Date(article.pubDate).getTime()) / (1000 * 60 * 60);
      if (articleAge > opts.maxAge) return false;
      
      // Content length filtering (initial)
      const contentLength = typeof article.content === 'string' 
        ? article.content.length 
        : article.contentSnippet.length;
      if (contentLength < 100) return false; // Very short articles
      
      // Domain reliability filtering
      if (opts.domainReliabilityCheck) {
        const domain = getDomainFromURL(article.link);
        const domainInfo = DOMAIN_RELIABILITY[domain] || DOMAIN_RELIABILITY.default;
        
        // Skip domains with very low reliability unless we have fallback strategy
        if (domainInfo.reliability < 40 && !domainInfo.fallbackToRSS) {
          console.log(`⚠️ Skipping article from low-reliability domain: ${domain} (reliability: ${domainInfo.reliability}%)`);
          return false;
        }
      }
      
      return true;
    })
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
    .slice(0, opts.maxArticles * 2); // Take 2x to account for quality filtering
  
  console.log(`Filtered to ${filteredArticles.length} articles for content extraction`);
  
  // Step 2: Enhance articles with full content and quality analysis
  const enhancedArticles: ExtractedContent[] = [];
  const BATCH_SIZE = 5; // Process in batches to prevent overwhelming
  
  for (let i = 0; i < filteredArticles.length; i += BATCH_SIZE) {
    const batch = filteredArticles.slice(i, i + BATCH_SIZE);
    
    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(filteredArticles.length / BATCH_SIZE)}`);
    
    const batchResults = await Promise.allSettled(
      batch.map(article => enhanceArticle(article, opts))
    );
    
    batchResults.forEach((result, batchIndex) => {
      if (result.status === 'fulfilled' && result.value) {
        enhancedArticles.push(result.value);
      } else {
        const articleTitle = batch[batchIndex]?.title || 'Unknown';
        const articleUrl = batch[batchIndex]?.link || 'Unknown URL';
        const domain = getDomainFromURL(articleUrl);
        const error = result.status === 'rejected' ? result.reason : 'Unknown error';
        
        console.log(`❌ Failed to enhance article: "${articleTitle}"`);
        console.log(`   Domain: ${domain}, URL: ${articleUrl}`);
        console.log(`   Error: ${error instanceof Error ? error.message : error}`);
        
        // Track domain-specific failure patterns for future reliability updates
        if (error && typeof error === 'object') {
          if (error.message?.includes('HTTP 403')) {
            console.log(`   🚫 Domain ${domain} has paywall/access restrictions`);
          } else if (error.message?.includes('timeout')) {
            console.log(`   ⏱️ Domain ${domain} response timeout`);
          } else if (error.message?.includes('XML')) {
            console.log(`   📄 Domain ${domain} has malformed RSS/XML`);
          }
        }
      }
    });
    
    // Brief pause between batches to prevent overwhelming servers
    if (i + BATCH_SIZE < filteredArticles.length) {
      await new Promise(resolve => setTimeout(resolve, 100)); // Reduced from 200ms to 100ms
    }
  }
  
  // Step 3: Sort by quality score and take the best articles
  const qualityFiltered = enhancedArticles
    .filter(article => article.quality.score >= opts.qualityThreshold)
    .sort((a, b) => b.quality.score - a.quality.score)
    .slice(0, opts.maxArticles);
  
  const processingTime = Date.now() - startTime;
  console.log(`✅ Content extraction complete: ${enhancedArticles.length} enhanced, ${qualityFiltered.length} high-quality articles (${processingTime}ms)`);
  
  // Enhanced extraction statistics
  const successRate = ((enhancedArticles.length / filteredArticles.length) * 100).toFixed(1);
  const extractedCount = enhancedArticles.filter(a => a.quality.factors.extraction === 10).length;
  const fallbackCount = enhancedArticles.length - extractedCount;
  
  console.log(`📊 Enhancement success rate: ${successRate}% (${enhancedArticles.length}/${filteredArticles.length})`);
  console.log(`🎯 Full extraction: ${extractedCount}, RSS fallback: ${fallbackCount}`);
  
  // Enhanced quality statistics
  if (qualityFiltered.length > 0) {
    const averageQuality = qualityFiltered.reduce((sum, article) => sum + article.quality.score, 0) / qualityFiltered.length;
    const minScore = Math.min(...qualityFiltered.map(a => a.quality.score));
    const maxScore = Math.max(...qualityFiltered.map(a => a.quality.score));
    
    console.log(`📈 Average quality score: ${averageQuality.toFixed(1)}, range: ${minScore}-${maxScore}`);
    
    // Quality factor breakdown
    const avgFactors = qualityFiltered.reduce((acc, article) => {
      Object.keys(article.quality.factors).forEach(key => {
        acc[key] = (acc[key] || 0) + article.quality.factors[key as keyof typeof article.quality.factors];
      });
      return acc;
    }, {} as Record<string, number>);
    
    Object.keys(avgFactors).forEach(key => {
      avgFactors[key] = avgFactors[key] / qualityFiltered.length;
    });
    
    console.log(`🏆 Quality breakdown: Length=${avgFactors.length?.toFixed(1)}, Authority=${avgFactors.authority?.toFixed(1)}, Extraction=${avgFactors.extraction?.toFixed(1)}`);
  } else {
    console.warn(`⚠️ No articles met quality threshold of ${opts.qualityThreshold}`);
  }
  
  return qualityFiltered;
}

/**
 * Extract domain from URL for reliability checking
 */
function getDomainFromURL(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

/**
 * Enhance a single article with full content and quality analysis
 */
async function enhanceArticle(article: ParsedArticle, options: ContentExtractionOptions): Promise<ExtractedContent | null> {
  try {
    // Check cache first
    const cacheKey = createContentHash(article.link);
    const cached = getCachedAIResponse(`content:${cacheKey}`);
    
    if (cached) {
      return JSON.parse(cached) as ExtractedContent;
    }
    
    // Extract full content if enabled, with domain-aware fallback strategy
    let fullContent = '';
    let extractionMethod = 'rss'; // Track how content was obtained
    
    if (options.enhanceWithFullContent) {
      const domain = getDomainFromURL(article.link);
      const domainInfo = DOMAIN_RELIABILITY[domain] || DOMAIN_RELIABILITY.default;
      
      // Check if domain has known issues that suggest skipping full extraction
      if (domainInfo.fallbackToRSS && domainInfo.reliability < 50) {
        console.log(`🔄 Using RSS content for known problematic domain: ${domain} (reliability: ${domainInfo.reliability}%)`);
        fullContent = typeof article.content === 'string' ? article.content : article.contentSnippet;
        extractionMethod = 'rss-fallback';
      } else {
        try {
          fullContent = await fetchFullArticleContentWithRetry(article.link, domain);
          extractionMethod = 'extracted';
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          console.log(`⚠️ Failed to fetch full content for "${article.title}": ${errorMsg}`);
          console.log(`   🌐 Domain: ${domain}, URL: ${article.link}`);
          
          // Enhanced fallback strategy with better content handling
          fullContent = getEnhancedFallbackContent(article);
          extractionMethod = 'rss-error';
          
          // Log specific error types for domain reliability updates
          if (errorMsg.includes('HTTP 403') || errorMsg.includes('Forbidden')) {
            console.log(`   🚫 Domain ${domain} returned 403/Forbidden - consider updating reliability score to <50`);
          } else if (errorMsg.includes('timeout') || errorMsg.includes('TIMEOUT')) {
            console.log(`   ⏱️ Domain ${domain} response timeout - may need longer timeout`);
          } else if (errorMsg.includes('SSL') || errorMsg.includes('certificate')) {
            console.log(`   🔒 Domain ${domain} has SSL/certificate issues`);
          } else if (errorMsg.includes('HTTP 404')) {
            console.log(`   🔍 Domain ${domain} returned 404 - article may have been removed`);
          } else if (errorMsg.includes('HTTP 429')) {
            console.log(`   🚦 Domain ${domain} rate limited - consider longer delays`);
          } else {
            console.log(`   ❓ Domain ${domain} unknown error: ${errorMsg}`);
          }
        }
      }
    } else {
      fullContent = typeof article.content === 'string' ? article.content : article.contentSnippet;
    }
    
    // Clean and process content
    const cleanContent = cleanArticleContent(fullContent);
    const wordCount = countWords(cleanContent);
    const readingTime = Math.ceil(wordCount / 200); // Average reading speed
    
    // Extract topics and entities
    const topics = extractTopics(cleanContent, article.title);
    const entities = extractEntities(cleanContent, article.title);
    
    // Calculate content quality with extraction method context
    const quality = calculateContentQuality(article, cleanContent, wordCount, extractionMethod);
    
    // Skip if quality is too low
    if (quality.score < options.qualityThreshold) {
      return null;
    }
    
    const enhanced: ExtractedContent = {
      title: article.title,
      content: cleanContent,
      excerpt: generateExcerpt(cleanContent, 200),
      author: article.creator,
      publishedAt: article.pubDate,
      wordCount,
      readingTime,
      quality: {
        ...quality,
        factors: {
          ...quality.factors,
          // Boost quality score for successfully extracted content
          ...(extractionMethod === 'extracted' && { extraction: 10 })
        }
      },
      topics,
      entities,
      sourceUrl: article.link
    };
    
    // Cache the result
    cacheAIResponse(`content:${cacheKey}`, JSON.stringify(enhanced));
    
    return enhanced;
  } catch (error) {
    const domain = getDomainFromURL(article.link);
    console.error(`💥 Critical error enhancing article "${article.title}" from ${domain}:`, error);
    console.error(`   URL: ${article.link}`);
    console.error(`   Error type: ${error instanceof Error ? error.constructor.name : typeof error}`);
    return null;
  }
}

/**
 * Fetch full article content from URL using a simple text extraction approach
 */
async function fetchFullArticleContent(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // Increased to 10 second timeout for better quality
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI Newsletter Bot)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity',
        'Cache-Control': 'no-cache'
      },
      redirect: 'follow'
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    if (!html || html.length === 0) {
      throw new Error('Empty response body');
    }
    return extractTextFromHtml(html);
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Extract readable text from HTML content
 */
function extractTextFromHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    throw new Error('Invalid HTML input');
  }
  
  // Remove script and style elements
  const cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '');
  
  // Focus on main content areas
  const mainContentPatterns = [
    /<main[^>]*>([\s\S]*?)<\/main>/gi,
    /<article[^>]*>([\s\S]*?)<\/article>/gi,
    /<div[^>]*class[^>]*(?:content|article|post|story)[^>]*>([\s\S]*?)<\/div>/gi,
    /<div[^>]*id[^>]*(?:content|article|post|story)[^>]*>([\s\S]*?)<\/div>/gi
  ];
  
  let mainContent = '';
  for (const pattern of mainContentPatterns) {
    const match = cleaned.match(pattern);
    if (match && match[1] && match[1].length > mainContent.length) {
      mainContent = match[1];
    }
  }
  
  // If no main content found, use the whole body
  if (!mainContent) {
    const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/gi);
    mainContent = bodyMatch ? bodyMatch[0].replace(/<\/?body[^>]*>/gi, '') : cleaned;
  }
  
  // Remove all remaining HTML tags and decode entities
  let text = mainContent
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Remove common navigation and boilerplate text
  const boilerplatePatterns = [
    /subscribe to our newsletter/gi,
    /follow us on/gi,
    /share this article/gi,
    /read more articles/gi,
    /advertisement/gi,
    /cookie policy/gi,
    /privacy policy/gi
  ];
  
  boilerplatePatterns.forEach(pattern => {
    text = text.replace(pattern, '');
  });
  
  return text.trim();
}

/**
 * Clean article content
 */
function cleanArticleContent(content: string): string {
  return content
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Extract key topics from content
 */
function extractTopics(content: string, title: string): string[] {
  const text = `${title} ${content}`.toLowerCase();
  
  // AI/Tech-related keywords
  const techKeywords = [
    'artificial intelligence', 'machine learning', 'ai', 'ml', 'neural network',
    'deep learning', 'llm', 'gpt', 'claude', 'gemini', 'chatbot', 'automation',
    'robotics', 'computer vision', 'natural language', 'nlp', 'algorithm',
    'data science', 'big data', 'cloud computing', 'api', 'sdk', 'framework',
    'cryptocurrency', 'blockchain', 'web3', 'fintech', 'biotech', 'quantum',
    'cybersecurity', 'privacy', 'startup', 'funding', 'ipo', 'acquisition'
  ];
  
  const topics: string[] = [];
  techKeywords.forEach(keyword => {
    if (text.includes(keyword)) {
      topics.push(keyword);
    }
  });
  
  return [...new Set(topics)].slice(0, 10); // Unique topics, max 10
}

/**
 * Extract entities (companies, people, locations) from content
 */
function extractEntities(content: string, title: string): string[] {
  const text = `${title} ${content}`;
  
  // Common tech companies and AI entities
  const entities = [
    'OpenAI', 'Google', 'Microsoft', 'Apple', 'Amazon', 'Meta', 'Tesla',
    'Anthropic', 'DeepMind', 'NVIDIA', 'IBM', 'Oracle', 'Salesforce',
    'ChatGPT', 'GPT-4', 'Claude', 'Gemini', 'Bard', 'Copilot',
    'Stanford', 'MIT', 'Harvard', 'Berkeley', 'Carnegie Mellon'
  ];
  
  const found: string[] = [];
  entities.forEach(entity => {
    if (text.includes(entity)) {
      found.push(entity);
    }
  });
  
  return [...new Set(found)];
}

/**
 * Generate excerpt from content
 */
function generateExcerpt(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content;
  
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  let excerpt = '';
  
  for (const sentence of sentences) {
    if (excerpt.length + sentence.length + 1 <= maxLength) {
      excerpt += sentence.trim() + '. ';
    } else {
      break;
    }
  }
  
  return excerpt.trim() || content.substring(0, maxLength) + '...';
}

/**
 * Calculate content quality score
 */
function calculateContentQuality(article: ParsedArticle, content: string, wordCount: number, extractionMethod: string = 'rss'): ContentQuality {
  const factors = {
    length: 0,
    freshness: 0,
    authority: 0,
    engagement: 0,
    relevance: 0,
    extraction: 0 // New factor for successful content extraction
  };
  
  // Length factor (0-30 points)
  if (wordCount >= 1000) factors.length = 30;
  else if (wordCount >= 500) factors.length = 25;
  else if (wordCount >= 300) factors.length = 20;
  else if (wordCount >= 200) factors.length = 15;
  else factors.length = 5;
  
  // Freshness factor (0-25 points)
  const ageHours = (Date.now() - new Date(article.pubDate).getTime()) / (1000 * 60 * 60);
  if (ageHours <= 6) factors.freshness = 25;
  else if (ageHours <= 24) factors.freshness = 20;
  else if (ageHours <= 48) factors.freshness = 15;
  else if (ageHours <= 72) factors.freshness = 10;
  else factors.freshness = 5;
  
  // Authority factor (0-20 points) - based on source, updated with new IEEE Spectrum
  const authorityDomains = ['techcrunch.com', 'wired.com', 'arstechnica.com', 'spectrum.ieee.org', 'reuters.com'];
  const domain = new URL(article.link).hostname.replace('www.', '');
  if (authorityDomains.includes(domain)) factors.authority = 20;
  else if (domain.includes('google.com') || domain.includes('openai.com') || domain.includes('microsoft.com')) factors.authority = 18;
  else if (domain.includes('.edu') || domain.includes('arxiv.org') || domain.includes('mit.edu')) factors.authority = 16;
  else if (domain.includes('artificialintelligence-news.com') || domain.includes('marktechpost.com')) factors.authority = 14;
  else factors.authority = 10;
  
  // Engagement factor (0-15 points) - based on content characteristics
  const hasNumbers = /\d+/.test(article.title);
  const hasQuestions = /\?/.test(article.title);
  const hasActionWords = /\b(new|breakthrough|announced|released|launched|unveiled)\b/i.test(article.title);
  
  factors.engagement = (hasNumbers ? 5 : 0) + (hasQuestions ? 3 : 0) + (hasActionWords ? 7 : 0);
  
  // Relevance factor (0-10 points) - AI/tech relevance
  const aiKeywords = ['ai', 'artificial intelligence', 'machine learning', 'neural', 'gpt', 'llm', 'chatbot', 'automation'];
  const titleLower = article.title.toLowerCase();
  const contentLower = content.toLowerCase();
  
  let relevanceCount = 0;
  aiKeywords.forEach(keyword => {
    if (titleLower.includes(keyword)) relevanceCount += 2;
    else if (contentLower.includes(keyword)) relevanceCount += 1;
  });
  
  factors.relevance = Math.min(relevanceCount, 10);
  
  // Extraction factor (0-10 points) - bonus for successful full content extraction
  if (extractionMethod === 'extracted') factors.extraction = 10;
  else if (extractionMethod === 'rss-fallback') factors.extraction = 5; // Planned fallback, still good
  else factors.extraction = 0; // RSS-only or error fallback
  
  // Calculate total score with extraction bonus
  const score = factors.length + factors.freshness + factors.authority + factors.engagement + factors.relevance + factors.extraction;
  
  const reasoning = `Length: ${factors.length}/30, Freshness: ${factors.freshness}/25, Authority: ${factors.authority}/20, Engagement: ${factors.engagement}/15, Relevance: ${factors.relevance}/10, Extraction: ${factors.extraction}/10 (${extractionMethod})`;
  
  return {
    score,
    factors,
    reasoning
  };
}

/**
 * Fetch article content with retry mechanism for better reliability
 */
async function fetchFullArticleContentWithRetry(url: string, domain: string, maxRetries: number = 2): Promise<string> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Increase timeout for each retry attempt
      const timeout = 5000 + (attempt * 2000); // 5s, 7s, 9s
      return await fetchFullArticleContentWithTimeout(url, timeout);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.log(`   🔄 Retry ${attempt}/${maxRetries} failed for ${domain}: ${lastError.message}`);
      
      // Don't retry for certain error types
      if (lastError.message.includes('HTTP 403') || 
          lastError.message.includes('HTTP 404') || 
          lastError.message.includes('Forbidden')) {
        break;
      }
      
      // Brief pause between retries
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

/**
 * Fetch article content with configurable timeout
 */
async function fetchFullArticleContentWithTimeout(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI Newsletter Bot; +https://smart-newsletter.com)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      },
      redirect: 'follow'
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    
    const html = await response.text();
    if (!html || html.length === 0) {
      throw new Error('Empty response body');
    }
    
    return extractTextFromHtml(html);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

/**
 * Get enhanced fallback content from RSS data
 */
function getEnhancedFallbackContent(article: ParsedArticle): string {
  let content = '';
  
  // Prioritize content field if available and substantial
  if (typeof article.content === 'string' && article.content.length > 100) {
    content = article.content;
  } else if (article.contentSnippet && article.contentSnippet.length > 50) {
    content = article.contentSnippet;
  } else if ('summary' in article && article.summary && typeof article.summary === 'string' && article.summary.length > 50) {
    content = article.summary;
  } else if (typeof article.content === 'string') {
    content = article.content;
  } else {
    content = article.contentSnippet || '';
  }
  
  // Clean up HTML entities and formatting
  content = content
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/<[^>]*>/g, ' ') // Remove any remaining HTML tags
    .replace(/\s+/g, ' ')
    .trim();
  
  return content;
}