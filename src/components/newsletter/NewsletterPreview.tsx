'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Download, Send, Sparkles, ExternalLink, X, Mail, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { NewsletterPreviewProps } from '@/types';

// Function to get emoji icon for each category
function getCategoryIcon(category: string): string {
  const categoryLower = category.toLowerCase();
  
  switch (categoryLower) {
    case 'business': return '💼';
    case 'product': return '🚀';
    case 'policy': return '📋';
    case 'security': return '🔒';
    case 'research': return '🔬';
    case 'technology': return '⚡';
    case 'ai': return '🤖';
    case 'analysis': return '📊';
    case 'enterprise': return '🏢';
    case 'consumer': return '🛍️';
    case 'development': return '⚙️';
    case 'innovation': return '💡';
    default: return '📰';
  }
}

export function NewsletterPreview({ data, onSave, onPublish, onClose }: NewsletterPreviewProps) {
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

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

  const sendEmail = async () => {
    if (!emailAddress.trim()) {
      toast.error('Please enter a valid email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailAddress.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsSendingEmail(true);
    
    try {
      const response = await fetch('/api/newsletter/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newsletterData: data,
          recipientEmail: emailAddress.trim(),
          recipientName: recipientName.trim() || undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Newsletter sent successfully to ${emailAddress}!`);
        setShowEmailDialog(false);
        setEmailAddress('');
        setRecipientName('');
      } else {
        toast.error(result.error || 'Failed to send email');
      }
    } catch (error) {
      console.error('Email sending error:', error);
      toast.error('Failed to send email. Please try again.');
    } finally {
      setIsSendingEmail(false);
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
            <Button 
              onClick={() => setShowEmailDialog(true)} 
              variant="outline" 
              size="sm" 
              className="bg-orange-500/20 border-orange-500 text-orange-400 hover:bg-orange-500 hover:text-white transition-colors"
            >
              <Mail className="mr-2 h-4 w-4" />
              Email
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
                  {getCategoryIcon(topic.category || 'NEWS')} {topic.category?.toUpperCase() || 'NEWS'}
                </span>
                
                <h2 className={`text-xl font-bold text-gray-800 mb-3 leading-tight ${isHebrewText(topic.headline) ? 'newsletter-article' : ''}`}>
                  {index + 1}. {topic.headline}
                </h2>
                
                {topic.imageUrl && (
                  <div className="mb-4">
                    <Image 
                      src={topic.imageUrl} 
                      alt={topic.headline}
                      width={600}
                      height={256}
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

      {/* Email Dialog */}
      {showEmailDialog && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">Send Newsletter via Email</h3>
              <Button
                onClick={() => setShowEmailDialog(false)}
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-gray-700">
                  Recipient Email Address *
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="recipient@example.com"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="name" className="text-gray-700">
                  Recipient Name (optional)
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>Newsletter:</strong> {data.newsletterTitle}
                  <br />
                  <strong>Topics:</strong> {data.topics.length} articles
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <Button
                onClick={() => setShowEmailDialog(false)}
                variant="outline"
                className="flex-1"
                disabled={isSendingEmail}
              >
                Cancel
              </Button>
              <Button
                onClick={sendEmail}
                className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
                disabled={isSendingEmail || !emailAddress.trim()}
              >
                {isSendingEmail ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Email
                  </>
                )}
              </Button>
            </div>
            
            <p className="text-xs text-gray-500 mt-4 text-center">
              Note: This is a demo feature. In production, it would integrate with an email service provider.
            </p>
          </motion.div>
        </motion.div>
      )}
    </Card>
  );
}