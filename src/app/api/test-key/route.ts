import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const { provider, apiKey } = await request.json();

    if (!provider || !apiKey) {
      return NextResponse.json({
        success: false,
        error: 'Missing provider or API key'
      }, { status: 400 });
    }

    let testResult;

    if (provider === 'gemini') {
      testResult = await testGeminiKey(apiKey);
    } else if (provider === 'cohere') {
      testResult = await testCohereKey(apiKey);
    } else {
      return NextResponse.json({
        success: false,
        error: 'Unsupported provider'
      }, { status: 400 });
    }

    return NextResponse.json(testResult);

  } catch (error) {
    console.error('API key test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function testGeminiKey(apiKey: string) {
  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: 'Test connection - respond with just "OK"'
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 10
          }
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      let errorMessage = 'Invalid API key or request failed';
      
      try {
        const parsedError = JSON.parse(errorData);
        if (parsedError.error?.message) {
          errorMessage = parsedError.error.message;
        }
      } catch {
        // If not JSON, use the raw error
        if (errorData) {
          errorMessage = errorData.substring(0, 100);
        }
      }

      return {
        success: false,
        error: errorMessage
      };
    }

    const data = await response.json();
    
    // Check if we got a valid response
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      return {
        success: true,
        message: 'Gemini API key is working correctly'
      };
    } else {
      return {
        success: false,
        error: 'API key is valid but response format is unexpected'
      };
    }

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
}

async function testCohereKey(apiKey: string) {
  try {
    const response = await fetch('https://api.cohere.ai/v2/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'command-r',
        messages: [
          {
            role: 'user',
            content: 'Test connection - respond with just "OK"'
          }
        ],
        max_tokens: 10,
        temperature: 0
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      let errorMessage = 'Invalid API key or request failed';
      
      try {
        const parsedError = JSON.parse(errorData);
        if (parsedError.message) {
          errorMessage = parsedError.message;
        }
      } catch {
        // If not JSON, use status text or raw error
        if (response.status === 401) {
          errorMessage = 'Invalid API key';
        } else if (response.status === 429) {
          errorMessage = 'Rate limit exceeded';
        } else if (errorData) {
          errorMessage = errorData.substring(0, 100);
        }
      }

      return {
        success: false,
        error: errorMessage
      };
    }

    const data = await response.json();
    
    // Check if we got a valid response from Cohere
    if (data.message?.content?.[0]?.text || data.text) {
      return {
        success: true,
        message: 'Cohere API key is working correctly'
      };
    } else {
      return {
        success: false,
        error: 'API key is valid but response format is unexpected'
      };
    }

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
}

export async function GET() {
  return NextResponse.json({
    success: false,
    error: 'Method not allowed'
  }, { status: 405 });
}