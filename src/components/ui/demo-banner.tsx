"use client";

import { AlertTriangle } from "lucide-react";

export function DemoBanner() {
  return (
    <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-lg p-4 mb-6">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-yellow-500" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-white">
            🚀 Demo Mode - Try Smart Newsletter
          </h3>
          <p className="text-sm text-gray-300 mt-1">
            This is a live demo using the developer free API keys. Generate newsletters to test all features. 
            For less restricted number of generation, add your own API keys in Settings.
          </p>
        </div>
        <div className="text-xs text-gray-400 bg-gray-800/50 px-2 py-1 rounded">
          Free Demo
        </div>
      </div>
    </div>
  );
}