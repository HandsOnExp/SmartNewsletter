/**
 * URL validation utilities for RSS feed processing
 * Helps ensure article links are accessible and valid
 */

interface URLValidationResult {
  url: string;
  isValid: boolean;
  status?: number;
  error?: string;
  redirectUrl?: string;
}

interface ValidationOptions {
  timeout?: number;
  followRedirects?: boolean;
  allowedStatusCodes?: number[];
  userAgent?: string;
}

const DEFAULT_OPTIONS: ValidationOptions = {
  timeout: 5000,
  followRedirects: true,
  allowedStatusCodes: [200, 201, 202, 203, 204, 301, 302, 307, 308],
  userAgent: 'Smart Newsletter Bot 1.0'
};

/**
 * Validates a single URL by making a HEAD request
 */
export async function validateURL(url: string, options: ValidationOptions = {}): Promise<URLValidationResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Basic URL format validation
  try {
    new URL(url);
  } catch {
    return {
      url,
      isValid: false,
      error: 'Invalid URL format'
    };
  }

  // Skip validation for certain URL patterns that are known to be problematic
  const skipPatterns = [
    /^mailto:/,
    /^tel:/,
    /^javascript:/,
    /\.pdf$/i,
    /localhost/,
    /127\.0\.0\.1/,
    /\.local$/,
    // MIT Technology Review problematic URL patterns
    /technologyreview\.com\/\d{4}\/\d{2}\/\d{2}\/[^\/]+\/$/
  ];

  if (skipPatterns.some(pattern => pattern.test(url))) {
    return {
      url,
      isValid: false,
      error: 'URL type not supported for validation'
    };
  }

  try {
    // Use AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), opts.timeout);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0',
      },
      redirect: opts.followRedirects ? 'follow' : 'manual',
    });

    clearTimeout(timeoutId);

    const isValid = opts.allowedStatusCodes!.includes(response.status);
    const finalUrl = response.url !== url ? response.url : undefined;

    return {
      url,
      isValid,
      status: response.status,
      redirectUrl: finalUrl,
      error: isValid ? undefined : `HTTP ${response.status} ${response.statusText}`
    };

  } catch (error) {
    let errorMessage = 'Unknown validation error';
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = `Timeout after ${opts.timeout}ms`;
      } else if (error.message.includes('fetch')) {
        errorMessage = 'Network error or unreachable';
      } else {
        errorMessage = error.message;
      }
    }

    return {
      url,
      isValid: false,
      error: errorMessage
    };
  }
}

/**
 * Validates multiple URLs in batches to avoid overwhelming servers
 */
export async function validateURLsBatch(
  urls: string[], 
  options: ValidationOptions & { batchSize?: number; delayMs?: number } = {}
): Promise<URLValidationResult[]> {
  const { batchSize = 5, delayMs = 1000, ...validationOptions } = options;
  const results: URLValidationResult[] = [];
  
  // Remove duplicates
  const uniqueUrls = [...new Set(urls)];
  
  console.log(`Validating ${uniqueUrls.length} unique URLs in batches of ${batchSize}`);
  
  for (let i = 0; i < uniqueUrls.length; i += batchSize) {
    const batch = uniqueUrls.slice(i, i + batchSize);
    
    console.log(`Validating batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(uniqueUrls.length / batchSize)}: ${batch.length} URLs`);
    
    const batchResults = await Promise.allSettled(
      batch.map(url => validateURL(url, validationOptions))
    );
    
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          url: batch[index],
          isValid: false,
          error: `Validation promise rejected: ${result.reason}`
        });
      }
    });
    
    // Brief delay between batches to be respectful to servers
    if (i + batchSize < uniqueUrls.length && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  const validCount = results.filter(r => r.isValid).length;
  const invalidCount = results.length - validCount;
  
  console.log(`URL validation complete: ${validCount} valid, ${invalidCount} invalid`);
  
  if (invalidCount > 0) {
    console.log('Invalid URLs found:');
    results.filter(r => !r.isValid).forEach(result => {
      console.log(`  - ${result.url}: ${result.error}`);
    });
  }
  
  return results;
}

/**
 * Filters articles to only include those with valid URLs
 */
export function filterValidURLs<T extends { link: string }>(
  items: T[], 
  validationResults: URLValidationResult[]
): T[] {
  const validUrlsSet = new Set(
    validationResults.filter(result => result.isValid).map(result => result.url)
  );
  
  return items.filter(item => validUrlsSet.has(item.link));
}

/**
 * Basic URL sanitization to fix common RSS feed URL issues
 */
export function sanitizeURL(url: string): string {
  if (!url || typeof url !== 'string') {
    return '';
  }
  
  let sanitized = url.trim();
  
  // Remove common RSS feed artifacts
  sanitized = sanitized.replace(/\?utm_source=.*$/, ''); // Remove UTM parameters
  sanitized = sanitized.replace(/\?ref=.*$/, ''); // Remove ref parameters
  sanitized = sanitized.replace(/\?source=.*$/, ''); // Remove source parameters
  
  // Fix common URL encoding issues
  sanitized = sanitized.replace(/&amp;/g, '&');
  sanitized = sanitized.replace(/&lt;/g, '<');
  sanitized = sanitized.replace(/&gt;/g, '>');
  
  // Ensure proper protocol
  if (sanitized.startsWith('//')) {
    sanitized = 'https:' + sanitized;
  } else if (sanitized.startsWith('/') && !sanitized.startsWith('//')) {
    // Relative URL - can't fix without base domain
    return url; // Return original
  } else if (!sanitized.startsWith('http://') && !sanitized.startsWith('https://')) {
    sanitized = 'https://' + sanitized;
  }
  
  try {
    // Validate and normalize the URL
    const urlObj = new URL(sanitized);
    return urlObj.toString();
  } catch {
    return url; // Return original if sanitization failed
  }
}

/**
 * Get a fallback URL if the original is broken
 */
export function getFallbackURL(originalUrl: string, domain: string): string {
  try {
    const urlObj = new URL(originalUrl);
    // If URL is from the same domain but path is broken, try domain root
    if (urlObj.hostname === domain || originalUrl.includes(domain)) {
      return `https://${domain}`;
    }
  } catch {
    // Original URL is completely broken
  }
  
  // Return a search URL as last resort
  const searchQuery = encodeURIComponent(`site:${domain} news`);
  return `https://www.google.com/search?q=${searchQuery}`;
}