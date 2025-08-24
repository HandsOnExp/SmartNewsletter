'use client';

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Download, Send, Sparkles, ExternalLink, X } from 'lucide-react';
import { toast } from 'sonner';
import { NewsletterPreviewProps } from '@/types';

export function NewsletterPreview({ data, onSave, onPublish, onClose }: NewsletterPreviewProps) {
  const copyToClipboard = async () => {
    try {
      const htmlContent = await generateHTML(data);
      navigator.clipboard.writeText(htmlContent);
      toast.success('Newsletter HTML copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy HTML:', error);
      toast.error('Failed to copy HTML to clipboard');
    }
  };

  const downloadHTML = async () => {
    try {
      const htmlContent = await generateHTML(data);
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `newsletter-${new Date().toISOString().split('T')[0]}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Newsletter downloaded successfully!');
    } catch (error) {
      console.error('Failed to download HTML:', error);
      toast.error('Failed to download HTML');
    }
  };

  // Function to detect Hebrew content
  const isHebrewText = (text: string): boolean => {
    const hebrewPattern = /[\u0590-\u05FF]/;
    return hebrewPattern.test(text);
  };

  // Server-side HTML generation using API
  const generateHTML = async (data: NewsletterPreviewProps['data']): Promise<string> => {
    try {
      const response = await fetch('/api/newsletter/generate-html', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate HTML: ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to generate HTML');
      }

      return result.data.html;
    } catch (error) {
      console.error('Error generating HTML:', error);
      throw error;
    }
  };

  return (
    <Card className="bg-gray-900/90 backdrop-blur-xl border-gray-800 shadow-2xl">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-2xl font-bold text-white flex items-center">
            <Sparkles className="mr-2 h-6 w-6 text-purple-400" />
            Newsletter Preview
          </CardTitle>
          <div className="flex gap-2">
            <Button 
              onClick={copyToClipboard} 
              variant="outline" 
              size="sm" 
              className="bg-blue-500/20 border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white transition-colors"
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy HTML
            </Button>
            <Button 
              onClick={downloadHTML} 
              variant="outline" 
              size="sm" 
              className="bg-green-500/20 border-green-500 text-green-400 hover:bg-green-500 hover:text-white transition-colors"
            >
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
            {onSave && (
              <Button 
                onClick={onSave} 
                variant="outline" 
                size="sm" 
                className="bg-yellow-500/20 border-yellow-500 text-yellow-400 hover:bg-yellow-500 hover:text-white transition-colors"
              >
                <Send className="mr-2 h-4 w-4" />
                Save Draft
              </Button>
            )}
            {onPublish && (
              <Button 
                onClick={onPublish} 
                size="sm" 
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                <Send className="mr-2 h-4 w-4" />
                Publish
              </Button>
            )}
            {onClose && (
              <Button 
                onClick={onClose} 
                variant="outline" 
                size="sm" 
                className="bg-red-500/20 border-red-500 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                title="Close Preview"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="bg-white mx-6 mb-6 rounded-lg shadow-lg max-h-[600px] overflow-y-auto">
          {/* Newsletter Header */}
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-8 text-center">
            <h1 className={`text-3xl font-bold mb-2 ${isHebrewText(data.newsletterTitle) ? 'hebrew-text' : ''}`}>
              {data.newsletterTitle}
            </h1>
            <p className="text-purple-100">
              {data.newsletterDate || new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>

          {/* Introduction */}
          {data.introduction && (
            <div className={`p-6 bg-gray-50 ${isHebrewText(data.introduction) ? 'border-r-4 border-purple-500' : 'border-l-4 border-purple-500'}`}>
              <p className={`text-gray-700 italic text-lg leading-relaxed ${isHebrewText(data.introduction) ? 'mixed-content' : ''}`}>
                {data.introduction}
              </p>
            </div>
          )}

          {/* Topics */}
          <div className="divide-y divide-gray-200">
            {data.topics.map((topic, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="p-6"
              >
                {/* Category Badge */}
                <span className="inline-block bg-purple-100 text-purple-800 text-xs font-semibold px-3 py-1 rounded-full mb-3">
                  {topic.category?.toUpperCase() || 'NEWS'}
                </span>
                
                <h2 className={`text-xl font-bold text-gray-800 mb-3 leading-tight ${isHebrewText(topic.headline) ? 'newsletter-article' : ''}`}>
                  {index + 1}. {topic.headline}
                </h2>
                
                {topic.imageUrl && (
                  <div className="mb-4">
                    <img 
                      src={topic.imageUrl} 
                      alt={topic.headline}
                      className="w-full h-64 object-cover rounded-lg shadow-md"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}
                
                <p className={`text-gray-700 leading-relaxed mb-4 text-base ${isHebrewText(topic.summary) ? 'mixed-content' : ''}`}>
                  {topic.summary}
                </p>
                
                {topic.keyTakeaway && (
                  <div className={`bg-blue-50 p-4 mb-4 ${isHebrewText(topic.keyTakeaway) ? 'key-takeaway' : 'border-l-4 border-blue-400'}`}>
                    <div className={`text-blue-800 ${isHebrewText(topic.keyTakeaway) ? 'text-right' : ''}`}>
                      <span className="font-semibold english-in-hebrew">Key Takeaway: </span>
                      <span className={isHebrewText(topic.keyTakeaway) ? 'mixed-content inline' : ''}>{topic.keyTakeaway}</span>
                    </div>
                  </div>
                )}
                
                {topic.sourceUrl && (
                  <a 
                    href={topic.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-purple-600 hover:text-purple-700 font-medium transition-colors"
                  >
                    Read full article
                    <ExternalLink className="ml-1 h-4 w-4" />
                  </a>
                )}
              </motion.div>
            ))}
          </div>

          {/* Conclusion */}
          {data.conclusion && (
            <div className="bg-gray-50 p-6 text-center">
              <p className="text-gray-600 italic">
                {data.conclusion}
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="bg-gray-100 p-4 text-center text-sm text-gray-500">
            Generated with AI Newsletter Generator • {new Date().toLocaleDateString()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}