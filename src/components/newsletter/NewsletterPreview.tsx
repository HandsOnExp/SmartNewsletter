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
        <div className="bg-white mx-6 mb-6 rounded-lg shadow-xl max-h-[700px] overflow-y-auto border border-gray-200">
          {/* Newsletter Header */}
          <motion.div 
            className="relative bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700 text-white p-10 text-center overflow-hidden"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Animated background elements */}
            <div className="absolute inset-0 opacity-10">
              <motion.div 
                className="absolute top-0 left-0 w-72 h-72 bg-white rounded-full"
                animate={{ 
                  x: [0, 50, 0],
                  y: [0, -30, 0],
                  scale: [1, 1.1, 1]
                }}
                transition={{ duration: 20, repeat: Infinity, repeatType: "reverse" }}
              />
              <motion.div 
                className="absolute bottom-0 right-0 w-96 h-96 bg-pink-300 rounded-full"
                animate={{ 
                  x: [0, -30, 0],
                  y: [0, 20, 0],
                  scale: [1, 0.9, 1]
                }}
                transition={{ duration: 15, repeat: Infinity, repeatType: "reverse" }}
              />
            </div>
            
            <div className="relative z-10">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="mb-4"
              >
                <Sparkles className="h-8 w-8 mx-auto mb-3 text-yellow-300" />
              </motion.div>
              
              <motion.h1 
                className={`text-4xl font-extrabold mb-4 leading-tight ${isHebrewText(data.newsletterTitle) ? 'hebrew-text' : ''}`}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                {data.newsletterTitle}
              </motion.h1>
              
              <motion.p 
                className="text-blue-100 text-lg font-medium"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
              >
                {data.newsletterDate || new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </motion.p>
              
              <motion.div 
                className="mt-6 inline-block bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, duration: 0.3 }}
              >
                <span className="text-white text-sm font-semibold">
                  {data.topics.length} Featured Article{data.topics.length !== 1 ? 's' : ''}
                </span>
              </motion.div>
            </div>
          </motion.div>

          {/* Introduction */}
          {data.introduction && (
            <motion.div 
              className={`p-8 bg-gradient-to-r from-gray-50 to-blue-50 ${isHebrewText(data.introduction) ? 'border-r-4 border-purple-500' : 'border-l-4 border-purple-500'} relative overflow-hidden`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-100 rounded-full opacity-30 -mr-16 -mt-16"></div>
              <div className="relative">
                <div className="flex items-center mb-4">
                  <div className="w-1 h-6 bg-gradient-to-b from-purple-500 to-blue-500 rounded-full mr-3"></div>
                  <span className="text-purple-700 font-semibold text-sm tracking-wide uppercase">Introduction</span>
                </div>
                <p className={`text-gray-700 text-lg leading-relaxed font-medium ${isHebrewText(data.introduction) ? 'mixed-content' : ''}`}>
                  {data.introduction}
                </p>
              </div>
            </motion.div>
          )}

          {/* Topics */}
          <div className="space-y-6 p-6">
            {data.topics.map((topic, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + index * 0.15, duration: 0.5 }}
                whileHover={{ scale: 1.01, y: -2 }}
                className="bg-white border border-gray-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group"
              >
                {/* Topic Number & Category */}
                <div className="flex items-center justify-between p-6 pb-4">
                  <div className="flex items-center space-x-3">
                    <motion.div 
                      className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm"
                      whileHover={{ rotate: 360 }}
                      transition={{ duration: 0.5 }}
                    >
                      {index + 1}
                    </motion.div>
                    <span className="inline-flex items-center bg-gradient-to-r from-purple-100 to-blue-100 text-purple-800 text-xs font-semibold px-3 py-1.5 rounded-full border border-purple-200">
                      <span className="mr-1">{getCategoryIcon(topic.category || 'NEWS')}</span>
                      {topic.category?.toUpperCase() || 'NEWS'}
                    </span>
                  </div>
                  <div className="w-2 h-2 bg-green-400 rounded-full opacity-60 group-hover:opacity-100 transition-opacity"></div>
                </div>
                
                {/* Article Content */}
                <div className="px-6">
                  <motion.h2 
                    className={`text-2xl font-bold text-gray-900 mb-4 leading-tight group-hover:text-purple-700 transition-colors ${isHebrewText(topic.headline) ? 'newsletter-article' : ''}`}
                    initial={{ opacity: 0.8 }}
                    whileHover={{ opacity: 1 }}
                  >
                    {topic.headline}
                  </motion.h2>
                  
                  {topic.imageUrl && (
                    <motion.div 
                      className="mb-6 relative overflow-hidden rounded-lg"
                      whileHover={{ scale: 1.02 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Image 
                        src={topic.imageUrl} 
                        alt={topic.headline}
                        width={600}
                        height={256}
                        className="w-full h-64 object-cover shadow-md group-hover:shadow-lg transition-shadow"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </motion.div>
                  )}
                  
                  <p className={`text-gray-700 leading-relaxed mb-6 text-base ${isHebrewText(topic.summary) ? 'mixed-content' : ''}`}>
                    {topic.summary}
                  </p>
                  
                  {topic.keyTakeaway && (
                    <motion.div 
                      className={`bg-gradient-to-r from-blue-50 to-indigo-50 p-5 mb-6 rounded-lg border-l-4 border-blue-400 relative ${isHebrewText(topic.keyTakeaway) ? 'key-takeaway' : ''}`}
                      whileHover={{ scale: 1.01 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="absolute top-3 right-3 text-blue-300">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className={`text-blue-900 ${isHebrewText(topic.keyTakeaway) ? 'text-right' : ''}`}>
                        <span className="font-bold english-in-hebrew text-blue-700">💡 Key Insight: </span>
                        <span className={`font-medium ${isHebrewText(topic.keyTakeaway) ? 'mixed-content inline' : ''}`}>{topic.keyTakeaway}</span>
                      </div>
                    </motion.div>
                  )}
                </div>
                
                {topic.sourceUrl && (
                  <div className="px-6 pb-6">
                    <motion.a 
                      href={topic.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2.5 rounded-lg font-medium hover:from-purple-700 hover:to-blue-700 transition-all duration-300 shadow-md hover:shadow-lg group"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <span>Read Full Article</span>
                      <ExternalLink className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                    </motion.a>
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Conclusion */}
          {data.conclusion && (
            <motion.div 
              className="bg-gradient-to-r from-gray-50 via-blue-50 to-purple-50 p-8 text-center relative overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 + data.topics.length * 0.15, duration: 0.5 }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
              <div className="relative">
                <div className="flex items-center justify-center mb-4">
                  <div className="w-12 h-0.5 bg-gradient-to-r from-transparent to-purple-400"></div>
                  <span className="mx-4 text-purple-700 font-bold text-sm tracking-wider uppercase">Conclusion</span>
                  <div className="w-12 h-0.5 bg-gradient-to-l from-transparent to-purple-400"></div>
                </div>
                <p className="text-gray-700 text-lg leading-relaxed font-medium max-w-2xl mx-auto">
                  {data.conclusion}
                </p>
              </div>
            </motion.div>
          )}

          {/* Enhanced Footer */}
          <motion.div 
            className="bg-gradient-to-r from-gray-800 to-gray-900 text-white p-6 relative overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.5 }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-blue-600/10"></div>
            <div className="relative text-center">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <Sparkles className="h-5 w-5 text-purple-400" />
                <span className="font-semibold text-gray-200">Generated with AI Newsletter Generator</span>
                <Sparkles className="h-5 w-5 text-blue-400" />
              </div>
              <div className="flex items-center justify-center space-x-4 text-sm text-gray-400">
                <span>{new Date().toLocaleDateString()}</span>
                <div className="w-1 h-1 bg-gray-500 rounded-full"></div>
                <span>Powered by AI</span>
                <div className="w-1 h-1 bg-gray-500 rounded-full"></div>
                <span>{data.topics.length} Articles Curated</span>
              </div>
            </div>
          </motion.div>
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