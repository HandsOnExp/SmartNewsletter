"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, Clock, Zap } from 'lucide-react';

interface BackgroundGenerationButtonProps {
  llmProvider: string;
  onComplete: (result: NewsletterGenerationResponse) => void;
  onError: (error: string) => void;
  disabled?: boolean;
}

interface NewsletterGenerationResponse {
  success: boolean;
  newsletter?: {
    newsletterTitle: string;
    newsletterDate: string;
    introduction?: string;
    topics: Array<{
      headline: string;
      summary: string;
      category: string;
      sourceUrl: string;
      imagePrompt: string;
    }>;
    conclusion?: string;
  };
  stats?: {
    articlesAnalyzed: number;
    generationTime: string;
    id: string;
  };
}

export default function BackgroundGenerationButton({
  llmProvider,
  onComplete,
  onError,
  disabled
}: BackgroundGenerationButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('');
  const [elapsedTime, setElapsedTime] = useState(0);

  // Poll for job status
  useEffect(() => {
    if (!jobId || !isProcessing) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/newsletter/generate-background?jobId=${jobId}`);
        const data = await response.json();

        if (data.success) {
          setProgress(data.progress);
          setElapsedTime(Math.floor(data.elapsedTime / 1000));
          
          if (data.status === 'completed' && data.result) {
            setIsProcessing(false);
            setStatus('completed');
            onComplete(data.result);
            clearInterval(interval);
          } else if (data.status === 'failed') {
            setIsProcessing(false);
            setStatus('failed');
            onError(data.error || 'Background generation failed');
            clearInterval(interval);
          } else {
            setStatus(data.status);
          }
        } else {
          setIsProcessing(false);
          setStatus('failed');
          onError(data.error || 'Failed to check job status');
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Error checking job status:', err);
        setIsProcessing(false);
        setStatus('failed');
        onError('Failed to check background job status');
        clearInterval(interval);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [jobId, isProcessing, onComplete, onError]);

  const startBackgroundGeneration = async () => {
    try {
      setIsProcessing(true);
      setProgress(0);
      setStatus('starting');
      setElapsedTime(0);

      const response = await fetch('/api/newsletter/generate-background', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          llmProvider
        })
      });

      const data = await response.json();

      if (data.success) {
        setJobId(data.jobId);
        setStatus('pending');
      } else {
        setIsProcessing(false);
        onError(data.error || 'Failed to start background generation');
      }
    } catch {
      setIsProcessing(false);
      onError('Failed to initiate background generation');
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'processing':
        return <Zap className="w-4 h-4 text-blue-500 animate-pulse" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getEstimatedTime = () => {
    return llmProvider === 'cohere' ? '45-60 seconds' : '20-30 seconds';
  };

  if (isProcessing) {
    return (
      <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className="font-medium">
              {status === 'processing' ? 'Generating Newsletter...' : 'Starting Generation...'}
            </span>
          </div>
          <span className="text-sm text-gray-500">
            {elapsedTime}s elapsed
          </span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        <div className="text-sm text-gray-600">
          <p>Status: {status}</p>
          <p>Using: {llmProvider.charAt(0).toUpperCase() + llmProvider.slice(1)}</p>
          <p>Estimated time: {getEstimatedTime()}</p>
        </div>

        {llmProvider === 'cohere' && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              Cohere processing may take longer. You can safely close this page and return later.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={startBackgroundGeneration}
        disabled={disabled}
        className="w-full flex items-center gap-2"
        variant={llmProvider === 'cohere' ? 'secondary' : 'default'}
      >
        <Zap className="w-4 h-4" />
        Generate in Background
      </Button>
      
      <p className="text-xs text-gray-500 text-center">
        Estimated time: {getEstimatedTime()}
        {llmProvider === 'cohere' && ' (slower but thorough)'}
      </p>
    </div>
  );
}