/**
 * Cache optimization utilities for handling large strings efficiently
 * Addresses webpack cache serialization performance issues
 */

export interface CachedContent {
  data: Buffer;
  encoding: BufferEncoding;
  compressed: boolean;
  size: number;
}

export interface CacheEntry {
  key: string;
  content: CachedContent;
  timestamp: number;
  ttl: number;
}

// Convert large strings to Buffer for better cache performance
export function optimizeForCache(content: string): CachedContent {
  const buffer = Buffer.from(content, 'utf8');
  
  // For strings larger than 50KB, use compression
  if (buffer.length > 50 * 1024) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const zlib = require('zlib');
    const compressed = zlib.gzipSync(buffer);
    
    return {
      data: compressed,
      encoding: 'utf8',
      compressed: true,
      size: compressed.length
    };
  }
  
  return {
    data: buffer,
    encoding: 'utf8',
    compressed: false,
    size: buffer.length
  };
}

// Restore content from optimized cache entry
export function restoreFromCache(cached: CachedContent): string {
  if (cached.compressed) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const zlib = require('zlib');
    const decompressed = zlib.gunzipSync(cached.data);
    return decompressed.toString(cached.encoding);
  }
  
  return cached.data.toString(cached.encoding);
}

// Lazy loading wrapper for large content
export class LazyContent {
  private _content: string | null = null;
  private _loader: () => Promise<string>;
  
  constructor(loader: () => Promise<string>) {
    this._loader = loader;
  }
  
  async getContent(): Promise<string> {
    if (this._content === null) {
      this._content = await this._loader();
    }
    return this._content;
  }
  
  // Get content length without loading full content
  async getSize(): Promise<number> {
    const content = await this.getContent();
    return Buffer.byteLength(content, 'utf8');
  }
  
  // Check if content is already loaded
  isLoaded(): boolean {
    return this._content !== null;
  }
  
  // Clear cached content to free memory
  clear(): void {
    this._content = null;
  }
}

// Memory-efficient cache for RSS feeds and AI responses
export class OptimizedCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private currentSize: number = 0;
  
  constructor(maxSizeMB: number = 50) {
    this.maxSize = maxSizeMB * 1024 * 1024; // Convert to bytes
  }
  
  set(key: string, content: string, ttlMinutes: number = 60): void {
    const optimized = optimizeForCache(content);
    const entry: CacheEntry = {
      key,
      content: optimized,
      timestamp: Date.now(),
      ttl: ttlMinutes * 60 * 1000
    };
    
    // Remove old entry if exists
    if (this.cache.has(key)) {
      const oldEntry = this.cache.get(key)!;
      this.currentSize -= oldEntry.content.size;
    }
    
    // Check if we need to evict entries
    this.evictIfNeeded(optimized.size);
    
    this.cache.set(key, entry);
    this.currentSize += optimized.size;
  }
  
  get(key: string): string | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.delete(key);
      return null;
    }
    
    return restoreFromCache(entry.content);
  }
  
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.currentSize -= entry.content.size;
      return this.cache.delete(key);
    }
    return false;
  }
  
  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
  }
  
  private evictIfNeeded(newEntrySize: number): void {
    // If adding new entry would exceed max size, evict oldest entries
    while (this.currentSize + newEntrySize > this.maxSize && this.cache.size > 0) {
      const oldest = Array.from(this.cache.entries())
        .sort(([,a], [,b]) => a.timestamp - b.timestamp)[0];
      
      if (oldest) {
        this.delete(oldest[0]);
      }
    }
  }
  
  getStats() {
    return {
      entries: this.cache.size,
      sizeMB: (this.currentSize / (1024 * 1024)).toFixed(2),
      maxSizeMB: (this.maxSize / (1024 * 1024)).toFixed(2)
    };
  }
}

// Global cache instance
export const globalCache = new OptimizedCache(50); // 50MB cache

// Wrapper functions for RSS and AI content
export function cacheRSSContent(feedId: string, content: string): void {
  globalCache.set(`rss:${feedId}`, content, 30); // 30 minutes TTL
}

export function getCachedRSSContent(feedId: string): string | null {
  return globalCache.get(`rss:${feedId}`);
}

export function cacheAIResponse(promptHash: string, response: string): void {
  globalCache.set(`ai:${promptHash}`, response, 60); // 1 hour TTL
}

export function getCachedAIResponse(promptHash: string): string | null {
  return globalCache.get(`ai:${promptHash}`);
}

// Helper to create hash from content for caching
export function createContentHash(content: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('crypto');
  return crypto.createHash('md5').update(content).digest('hex').substring(0, 16);
}