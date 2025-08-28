"use client";

import React from 'react';
import { AlertTriangle, Clock, Zap } from 'lucide-react';

interface CohereWarningBannerProps {
  selectedLLM: string;
  onSwitchToBackground?: () => void;
  onSwitchToGemini?: () => void;
}

export default function CohereWarningBanner({ 
  selectedLLM, 
  onSwitchToBackground, 
  onSwitchToGemini 
}: CohereWarningBannerProps) {
  if (selectedLLM !== 'cohere') return null;

  return (
    <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
        
        <div className="flex-1">
          <h3 className="font-medium text-amber-800 mb-2">
            Cohere Performance Notice
          </h3>
          
          <p className="text-sm text-amber-700 mb-3">
            Cohere may take 45-60 seconds to generate newsletters and occasionally timeout. 
            For faster, more reliable results:
          </p>
          
          <div className="flex flex-col sm:flex-row gap-2">
            {onSwitchToBackground && (
              <button
                onClick={onSwitchToBackground}
                className="flex items-center gap-2 px-3 py-2 bg-amber-100 hover:bg-amber-200 
                         text-amber-800 rounded-md text-sm font-medium transition-colors"
              >
                <Clock className="w-4 h-4" />
                Use Background Generation
              </button>
            )}
            
            {onSwitchToGemini && (
              <button
                onClick={onSwitchToGemini}
                className="flex items-center gap-2 px-3 py-2 bg-blue-100 hover:bg-blue-200 
                         text-blue-800 rounded-md text-sm font-medium transition-colors"
              >
                <Zap className="w-4 h-4" />
                Switch to Gemini (faster)
              </button>
            )}
          </div>
          
          <p className="text-xs text-amber-600 mt-2">
            💡 Tip: Our system will automatically fallback to Gemini if Cohere times out
          </p>
        </div>
      </div>
    </div>
  );
}