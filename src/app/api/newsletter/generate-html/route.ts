import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { APIResponse } from '@/types';
import { NewsletterTopic } from '@/lib/ai-processors';

interface HTMLGenerationRequest {
  newsletterTitle: string;
  newsletterDate: string;
  introduction?: string;
  topics: NewsletterTopic[];
  conclusion?: string;
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json<APIResponse>({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const data: HTMLGenerationRequest = await request.json();

    const htmlContent = generateNewsletterHTML(data);

    return NextResponse.json<APIResponse<{ html: string }>>({
      success: true,
      data: { html: htmlContent }
    });

  } catch (error) {
    console.error('HTML generation error:', error);
    return NextResponse.json<APIResponse>(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error during HTML generation' 
      },
      { status: 500 }
    );
  }
}

function generateNewsletterHTML(data: HTMLGenerationRequest): string {
  // Function to detect Hebrew content
  const isHebrewText = (text: string): boolean => {
    const hebrewPattern = /[\u0590-\u05FF]/;
    return hebrewPattern.test(text);
  };

  // Function to get language attributes and direction
  const getTextAttributes = (text: string) => {
    const hasHebrew = isHebrewText(text);
    return {
      lang: hasHebrew ? 'he' : 'en',
      dir: hasHebrew ? 'rtl' : 'ltr',
      className: hasHebrew ? 'hebrew-content' : 'english-content'
    };
  };

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Detect the primary language of the newsletter
  const titleAttrs = getTextAttributes(data.newsletterTitle);
  const hasHebrew = data.topics.some(topic => 
    isHebrewText(topic.headline) || isHebrewText(topic.summary)
  );

  return `
    <!DOCTYPE html>
    <html lang="${titleAttrs.lang}" dir="${titleAttrs.dir}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${data.newsletterTitle}</title>
      <style>
        body { 
          font-family: ${hasHebrew ? 
            `'David Libre', 'Frank Ruhl Libre', 'Alef', 'Heebo', 'Noto Sans Hebrew', 'Arial Unicode MS', Arial, sans-serif` : 
            `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`
          }; 
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0;
          background-color: #f5f5f5;
          direction: ${hasHebrew ? 'rtl' : 'ltr'};
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
          font-size: 14px;
        }
        .content { 
          padding: 30px; 
        }
        .introduction {
          background: #f8f9ff;
          border: 1px solid #e1e5ff;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 30px;
          font-style: italic;
          color: #4a5568;
        }
        .topic { 
          margin-bottom: 40px; 
          border-bottom: 2px solid #f0f0f0; 
          padding-bottom: 30px;
        }
        .topic:last-child {
          border-bottom: none;
          margin-bottom: 0;
        }
        .topic h2 { 
          color: #2d3748; 
          margin: 0 0 15px 0; 
          font-size: 22px;
          line-height: 1.3;
        }
        .topic-meta {
          display: flex;
          align-items: center;
          margin-bottom: 15px;
          font-size: 12px;
          color: #718096;
          gap: 15px;
        }
        .category {
          background: #667eea;
          color: white;
          padding: 4px 12px;
          border-radius: 20px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .summary { 
          color: #4a5568; 
          margin-bottom: 15px;
          line-height: 1.7;
        }
        .key-takeaway {
          background: #e6fffa;
          border-left: 4px solid #38b2ac;
          padding: 15px 20px;
          margin: 20px 0;
          border-radius: 0 8px 8px 0;
        }
        .key-takeaway::before {
          content: "💡 Key Takeaway: ";
          font-weight: bold;
          color: #2c7a7b;
        }
        .source-link {
          display: inline-flex;
          align-items: center;
          color: #667eea;
          text-decoration: none;
          font-weight: 500;
          margin-top: 10px;
          padding: 8px 16px;
          background: #f7fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          transition: all 0.2s;
        }
        .source-link:hover {
          background: #667eea;
          color: white;
        }
        .conclusion {
          background: #fff5f5;
          border: 1px solid #fed7d7;
          border-radius: 8px;
          padding: 25px;
          margin-top: 40px;
          font-style: italic;
          color: #4a5568;
        }
        .footer {
          background: #2d3748;
          color: #a0aec0;
          padding: 30px;
          text-align: center;
          font-size: 14px;
        }
        .footer a {
          color: #63b3ed;
          text-decoration: none;
        }
        .footer a:hover {
          text-decoration: underline;
        }
        
        /* Hebrew-specific styles */
        .hebrew-content {
          font-family: 'David Libre', 'Frank Ruhl Libre', 'Alef', 'Heebo', 'Noto Sans Hebrew', 'Arial Unicode MS', Arial, sans-serif;
          direction: rtl;
          text-align: right;
        }
        
        .hebrew-content .topic-meta {
          justify-content: flex-end;
          direction: rtl;
        }
        
        .hebrew-content .source-link {
          direction: ltr;
          display: inline-block;
        }
        
        /* Responsive design */
        @media (max-width: 600px) {
          .container {
            margin: 0;
            box-shadow: none;
          }
          .header {
            padding: 20px 15px;
          }
          .header h1 {
            font-size: 24px;
          }
          .content {
            padding: 20px 15px;
          }
          .topic h2 {
            font-size: 20px;
          }
          .footer {
            padding: 20px 15px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${data.newsletterTitle}</h1>
          <p>${data.newsletterDate || currentDate}</p>
        </div>
        
        <div class="content">
          ${data.introduction ? `
            <div class="introduction ${getTextAttributes(data.introduction).className}">
              ${data.introduction}
            </div>
          ` : ''}
          
          ${data.topics.map(topic => {
            const topicAttrs = getTextAttributes(topic.headline);
            return `
              <div class="topic ${topicAttrs.className}">
                <h2>${topic.headline}</h2>
                <div class="topic-meta">
                  <span class="category">${topic.category}</span>
                </div>
                <div class="summary">${topic.summary}</div>
                ${topic.keyTakeaway ? `
                  <div class="key-takeaway">
                    ${topic.keyTakeaway}
                  </div>
                ` : ''}
                ${topic.sourceUrl ? `
                  <a href="${topic.sourceUrl}" class="source-link" target="_blank" rel="noopener noreferrer">
                    📖 Read Full Article →
                  </a>
                ` : ''}
              </div>
            `;
          }).join('')}
          
          ${data.conclusion ? `
            <div class="conclusion ${getTextAttributes(data.conclusion).className}">
              ${data.conclusion}
            </div>
          ` : ''}
        </div>
        
        <div class="footer">
          <p>Generated with ❤️ by Smart Newsletter</p>
          <p><a href="#unsubscribe">Unsubscribe</a> | <a href="#preferences">Preferences</a></p>
        </div>
      </div>
    </body>
    </html>
  `.trim();
}

export async function GET() {
  return NextResponse.json<APIResponse>({
    success: false,
    error: 'Method not allowed'
  }, { status: 405 });
}