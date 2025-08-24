import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

interface EmailRequest {
  newsletterData: {
    newsletterTitle: string;
    newsletterDate: string;
    introduction?: string;
    topics: Array<{
      headline: string;
      summary: string;
      keyTakeaway?: string;
      imagePrompt: string;
      sourceUrl: string;
      category: string;
    }>;
    conclusion?: string;
  };
  recipientEmail: string;
  recipientName?: string;
}

interface APIResponse {
  success: boolean;
  data?: { messageId: string };
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<APIResponse>> {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json<APIResponse>({ 
        success: false, 
        error: 'Authentication required' 
      }, { status: 401 });
    }

    const body: EmailRequest = await request.json();
    const { newsletterData, recipientEmail, recipientName } = body;

    // Validate required fields
    if (!newsletterData || !recipientEmail) {
      return NextResponse.json<APIResponse>({ 
        success: false, 
        error: 'Newsletter data and recipient email are required' 
      }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return NextResponse.json<APIResponse>({ 
        success: false, 
        error: 'Invalid email address format' 
      }, { status: 400 });
    }

    // Generate HTML content for email
    const htmlContent = generateNewsletterHTML(newsletterData);
    
    // For now, we'll simulate sending the email
    // In production, you would integrate with an email service like:
    // - SendGrid
    // - AWS SES
    // - Resend
    // - Nodemailer with SMTP
    
    console.log('Email sending simulation:', {
      to: recipientEmail,
      recipientName: recipientName || 'Unknown',
      subject: newsletterData.newsletterTitle,
      contentPreview: htmlContent.substring(0, 200) + '...'
    });

    // Simulate email service response
    const simulatedMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Log successful send attempt
    console.log(`Newsletter "${newsletterData.newsletterTitle}" sent to ${recipientEmail}`);
    
    return NextResponse.json<APIResponse>({ 
      success: true, 
      data: { messageId: simulatedMessageId }
    });

  } catch (error) {
    console.error('Email sending error:', error);
    return NextResponse.json<APIResponse>({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to send email' 
    }, { status: 500 });
  }
}

// Helper function to generate newsletter HTML for email
function generateNewsletterHTML(data: EmailRequest['newsletterData']): string {
  const { newsletterTitle, newsletterDate, introduction, topics, conclusion } = data;
  
  // Function to detect Hebrew content
  const isHebrewText = (text: string): boolean => {
    const hebrewPattern = /[\u0590-\u05FF]/;
    return hebrewPattern.test(text);
  };

  const hasHebrew = isHebrewText(newsletterTitle) || 
                   isHebrewText(introduction || '') || 
                   topics.some(topic => isHebrewText(topic.headline) || isHebrewText(topic.summary));

  return `
<!DOCTYPE html>
<html lang="${hasHebrew ? 'he' : 'en'}" dir="${hasHebrew ? 'rtl' : 'ltr'}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${newsletterTitle}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 0;
            background-color: #f8f9fa;
            color: #333;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: bold;
        }
        .date {
            margin-top: 10px;
            opacity: 0.9;
            font-size: 16px;
        }
        .introduction {
            padding: 30px 20px;
            background-color: #f8f9ff;
            border-${hasHebrew ? 'right' : 'left'}: 4px solid #667eea;
            font-style: italic;
            font-size: 18px;
            color: #555;
        }
        .topic {
            padding: 30px 20px;
            border-bottom: 1px solid #e9ecef;
        }
        .topic:last-child {
            border-bottom: none;
        }
        .topic-category {
            display: inline-block;
            background-color: #667eea;
            color: white;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
            margin-bottom: 15px;
        }
        .topic-headline {
            font-size: 22px;
            font-weight: bold;
            color: #333;
            margin: 0 0 15px 0;
            line-height: 1.3;
        }
        .topic-summary {
            color: #555;
            font-size: 16px;
            line-height: 1.7;
            margin-bottom: 15px;
        }
        .key-takeaway {
            background-color: #e3f2fd;
            border-${hasHebrew ? 'right' : 'left'}: 4px solid #2196f3;
            padding: 15px;
            margin: 15px 0;
            border-radius: 4px;
        }
        .key-takeaway-label {
            font-weight: bold;
            color: #1976d2;
        }
        .source-link {
            color: #667eea;
            text-decoration: none;
            font-weight: 500;
        }
        .source-link:hover {
            text-decoration: underline;
        }
        .conclusion {
            background-color: #f8f9fa;
            padding: 30px 20px;
            text-align: center;
            font-style: italic;
            color: #666;
            font-size: 16px;
        }
        .footer {
            background-color: #e9ecef;
            padding: 20px;
            text-align: center;
            color: #6c757d;
            font-size: 14px;
        }
        .hebrew-text {
            direction: rtl;
            text-align: right;
        }
        .mixed-content {
            direction: ${hasHebrew ? 'rtl' : 'ltr'};
            text-align: ${hasHebrew ? 'right' : 'left'};
        }
        .english-in-hebrew {
            direction: ltr;
            display: inline-block;
        }
        @media only screen and (max-width: 600px) {
            .container {
                margin: 0;
                border-radius: 0;
            }
            .header {
                padding: 30px 15px;
            }
            .header h1 {
                font-size: 24px;
            }
            .topic {
                padding: 20px 15px;
            }
            .topic-headline {
                font-size: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="${isHebrewText(newsletterTitle) ? 'hebrew-text' : ''}">${newsletterTitle}</h1>
            <div class="date">${newsletterDate || new Date().toLocaleDateString()}</div>
        </div>
        
        ${introduction ? `
        <div class="introduction">
            <div class="${isHebrewText(introduction) ? 'mixed-content' : ''}">${introduction}</div>
        </div>
        ` : ''}
        
        ${topics.map((topic, index) => `
        <div class="topic">
            <span class="topic-category">${topic.category || 'NEWS'}</span>
            <h2 class="topic-headline ${isHebrewText(topic.headline) ? 'mixed-content' : ''}">${index + 1}. ${topic.headline}</h2>
            <div class="topic-summary ${isHebrewText(topic.summary) ? 'mixed-content' : ''}">${topic.summary}</div>
            ${topic.keyTakeaway ? `
            <div class="key-takeaway">
                <span class="key-takeaway-label english-in-hebrew">Key Takeaway:</span>
                <span class="${isHebrewText(topic.keyTakeaway) ? 'mixed-content' : ''}">${topic.keyTakeaway}</span>
            </div>
            ` : ''}
            ${topic.sourceUrl ? `
            <a href="${topic.sourceUrl}" class="source-link" target="_blank" rel="noopener noreferrer">Read full article →</a>
            ` : ''}
        </div>
        `).join('')}
        
        ${conclusion ? `
        <div class="conclusion">
            <div class="${isHebrewText(conclusion) ? 'mixed-content' : ''}">${conclusion}</div>
        </div>
        ` : ''}
        
        <div class="footer">
            Generated with Smart Newsletter • ${new Date().toLocaleDateString()}
        </div>
    </div>
</body>
</html>
  `.trim();
}