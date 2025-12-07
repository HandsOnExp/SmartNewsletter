/**
 * Gemini API Request Queue
 *
 * Ensures sequential processing of Gemini API requests with enforced delays
 * to prevent rate limit violations on the free tier (15 requests/minute).
 *
 * Features:
 * - Single-threaded request processing (only 1 active request at a time)
 * - Enforced 10-second minimum gap between requests
 * - Request deduplication (same user can't queue duplicate requests)
 * - Timeout handling (requests expire after 90 seconds in queue)
 * - Shared queue for all entry points (generate, generate-background, etc.)
 */

import { Newsletter } from '@/types';

export interface QueuedRequest {
  id: string;
  userId: string;
  prompt: string;
  options: Record<string, unknown>;
  timestamp: number;
  resolve: (value: { success: boolean; data?: Newsletter; error?: string }) => void;
  reject: (error: Error) => void;
}

class GeminiRequestQueue {
  private queue: QueuedRequest[] = [];
  private processing: boolean = false;
  private lastRequestTime: number = 0;
  private readonly MIN_INTERVAL = 10000; // 10 seconds between requests (user confirmed)
  private readonly MAX_QUEUE_SIZE = 20; // Prevent queue overflow
  private readonly REQUEST_TIMEOUT = 90000; // 90 seconds timeout for queued requests

  /**
   * Enqueue a new Gemini API request
   *
   * @param userId - User ID making the request
   * @param prompt - The prompt to send to Gemini
   * @param options - Additional options for the request
   * @param processor - The async function that actually calls Gemini
   * @returns Promise that resolves with the newsletter data
   */
  async enqueue(
    userId: string,
    prompt: string,
    options: Record<string, unknown>,
    processor: (prompt: string, options: Record<string, unknown>) => Promise<{ success: boolean; data?: Newsletter; error?: string }>
  ): Promise<{ success: boolean; data?: Newsletter; error?: string }> {
    // Check queue size
    if (this.queue.length >= this.MAX_QUEUE_SIZE) {
      console.error('⚠️ Request queue full, rejecting new request');
      return {
        success: false,
        error: 'Server is currently busy. Please try again in a few moments.'
      };
    }

    // Check for duplicate request from same user
    const existingRequest = this.queue.find(req =>
      req.userId === userId &&
      req.prompt === prompt
    );

    if (existingRequest) {
      console.log(`⚠️ Duplicate request detected for user ${userId}, rejecting`);
      return {
        success: false,
        error: 'You already have a newsletter generation in progress. Please wait for it to complete.'
      };
    }

    // Create request ID
    const requestId = `${userId}-${Date.now()}`;

    console.log(`📥 Enqueueing request ${requestId} (queue size: ${this.queue.length + 1})`);

    // Create promise that will be resolved when request is processed
    return new Promise<{ success: boolean; data?: Newsletter; error?: string }>((resolve, reject) => {
      const request: QueuedRequest = {
        id: requestId,
        userId,
        prompt,
        options,
        timestamp: Date.now(),
        resolve,
        reject
      };

      this.queue.push(request);

      // Start processing if not already running
      if (!this.processing) {
        this.processQueue(processor);
      }

      // Set timeout for this request
      setTimeout(() => {
        const index = this.queue.findIndex(req => req.id === requestId);
        if (index !== -1) {
          console.error(`⏱️ Request ${requestId} timed out after ${this.REQUEST_TIMEOUT/1000}s`);
          const timedOutRequest = this.queue.splice(index, 1)[0];
          timedOutRequest.reject(new Error('Request timed out waiting in queue'));
        }
      }, this.REQUEST_TIMEOUT);
    });
  }

  /**
   * Process the queue sequentially
   */
  private async processQueue(
    processor: (prompt: string, options: Record<string, unknown>) => Promise<{ success: boolean; data?: Newsletter; error?: string }>
  ): Promise<void> {
    if (this.processing) {
      return; // Already processing
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const request = this.queue[0]; // Peek at first request

      try {
        // Enforce minimum interval between requests
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;

        if (this.lastRequestTime > 0 && timeSinceLastRequest < this.MIN_INTERVAL) {
          const waitTime = this.MIN_INTERVAL - timeSinceLastRequest;
          console.log(`⏱️ Throttling: waiting ${(waitTime/1000).toFixed(1)}s before processing next request (queue size: ${this.queue.length})`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        // Update last request time
        this.lastRequestTime = Date.now();

        // Process the request
        console.log(`🚀 Processing request ${request.id} (${this.queue.length} remaining in queue)`);

        const result = await processor(request.prompt, request.options);

        // Remove from queue and resolve
        this.queue.shift();
        request.resolve(result);

        console.log(`✅ Request ${request.id} completed successfully (queue size: ${this.queue.length})`);

      } catch (error) {
        // Remove from queue and reject
        this.queue.shift();
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ Request ${request.id} failed:`, errorMessage);

        request.reject(error instanceof Error ? error : new Error(errorMessage));
      }
    }

    this.processing = false;
    console.log('📭 Queue empty, processing stopped');
  }

  /**
   * Get current queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      maxQueueSize: this.MAX_QUEUE_SIZE,
      minInterval: this.MIN_INTERVAL,
      timeSinceLastRequest: this.lastRequestTime > 0 ? Date.now() - this.lastRequestTime : null
    };
  }

  /**
   * Clear the queue (admin/emergency use only)
   */
  clear() {
    console.warn('⚠️ Clearing queue, rejecting all pending requests');

    while (this.queue.length > 0) {
      const request = this.queue.shift()!;
      request.reject(new Error('Queue was cleared'));
    }

    this.processing = false;
  }
}

// Export singleton instance
export const geminiQueue = new GeminiRequestQueue();
