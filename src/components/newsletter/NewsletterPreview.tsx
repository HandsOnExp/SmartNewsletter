'use client';

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Download, Send, Sparkles, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { NewsletterPreviewProps } from '@/types';

export function NewsletterPreview({ data, onSave, onPublish }: NewsletterPreviewProps) {
  const copyToClipboard = () => {
    const htmlContent = generateHTML(data);
    navigator.clipboard.writeText(htmlContent);
    toast.success('Newsletter HTML copied to clipboard!');
  };

  const downloadHTML = () => {
    const htmlContent = generateHTML(data);
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
  };

  const generateHTML = (data: NewsletterPreviewProps['data']) => {
    const currentDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${data.newsletterTitle}</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background-color: white;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
          }
          .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 40px 30px; 
            text-align: center;
          }
          .header h1 {
            margin: 0 0 10px 0;
            font-size: 28px;
            font-weight: bold;
          }
          .header p {
            margin: 0;
            opacity: 0.9;
            font-size: 16px;
          }
          .intro {
            padding: 30px;
            background-color: #f8f9fa;
            font-size: 16px;
            font-style: italic;
            border-left: 4px solid #667eea;
          }
          .topic { 
            margin: 0; 
            padding: 30px; 
            border-bottom: 1px solid #eee;
          }
          .topic:last-child {
            border-bottom: none;
          }
          .topic h2 { 
            color: #1a202c; 
            margin: 0 0 15px 0; 
            font-size: 22px;
            line-height: 1.3;
          }
          .topic img { 
            width: 100%; 
            height: 300px; 
            object-fit: cover; 
            border-radius: 8px; 
            margin: 15px 0; 
          }
          .topic p {
            margin: 0 0 15px 0;
            color: #4a5568;
            font-size: 15px;
          }
          .topic a {
            color: #667eea;
            text-decoration: none;
            font-weight: 500;
          }
          .topic a:hover {
            text-decoration: underline;
          }
          .footer {
            background-color: #f8f9fa;
            padding: 30px;
            text-align: center;
            color: #6c757d;
            font-size: 14px;
          }
          .category-badge {
            display: inline-block;
            background-color: #e2e8f0;
            color: #4a5568;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
            margin-bottom: 10px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${data.newsletterTitle}</h1>
            <p>${data.newsletterDate || currentDate}</p>
          </div>
          
          ${data.introduction ? `
            <div class="intro">
              ${data.introduction}
            </div>
          ` : ''}
          
          ${data.topics.map((topic, index: number) => `
            <div class="topic">
              <span class="category-badge">${topic.category?.toUpperCase() || 'NEWS'}</span>
              <h2>${index + 1}. ${topic.headline}</h2>
              ${topic.imageUrl ? `<img src="${topic.imageUrl}" alt="${topic.headline}" />` : ''}
              <p>${topic.summary}</p>
              ${topic.keyTakeaway ? `<p><strong>Key Takeaway:</strong> ${topic.keyTakeaway}</p>` : ''}
              ${topic.sourceUrl ? `<a href="${topic.sourceUrl}" target="_blank">Read full article →</a>` : ''}
            </div>
          `).join('')}
          
          ${data.conclusion ? `
            <div class="footer">
              ${data.conclusion}
            </div>
          ` : `
            <div class="footer">
              Generated with AI Newsletter Generator • ${currentDate}
            </div>
          `}
        </div>
      </body>
      </html>
    `;
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
            <Button onClick={copyToClipboard} variant="outline" size="sm" className="border-gray-600 text-gray-300 hover:text-white">
              <Copy className="mr-2 h-4 w-4" />
              Copy HTML
            </Button>
            <Button onClick={downloadHTML} variant="outline" size="sm" className="border-gray-600 text-gray-300 hover:text-white">
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
            {onSave && (
              <Button onClick={onSave} variant="outline" size="sm" className="border-gray-600 text-gray-300 hover:text-white">
                <Send className="mr-2 h-4 w-4" />
                Save Draft
              </Button>
            )}
            {onPublish && (
              <Button onClick={onPublish} size="sm" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                <Send className="mr-2 h-4 w-4" />
                Publish
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="bg-white mx-6 mb-6 rounded-lg shadow-lg max-h-[600px] overflow-y-auto">
          {/* Newsletter Header */}
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-8 text-center">
            <h1 className="text-3xl font-bold mb-2">
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
            <div className="p-6 bg-gray-50 border-l-4 border-purple-500">
              <p className="text-gray-700 italic text-lg leading-relaxed">
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
                
                <h2 className="text-xl font-bold text-gray-800 mb-3 leading-tight">
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
                
                <p className="text-gray-700 leading-relaxed mb-4 text-base">
                  {topic.summary}
                </p>
                
                {topic.keyTakeaway && (
                  <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
                    <p className="text-blue-800">
                      <span className="font-semibold">Key Takeaway:</span> {topic.keyTakeaway}
                    </p>
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