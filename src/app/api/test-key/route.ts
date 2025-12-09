import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

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
    // Use SDK wrapper (same as newsletter generation for consistency)
    const genAI = new GoogleGenerativeAI(apiKey.trim());
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent('Test connection - respond with just "OK"');
    const response = await result.response;
    const text = response.text();

    // More flexible validation - check for any text response
    if (text && text.length > 0) {
      return {
        success: true,
        message: 'Gemini API key is working correctly'
      };
    } else {
      return {
        success: false,
        error: 'API key is valid but received empty response'
      };
    }

  } catch (error) {
    // Enhanced error messages for better debugging
    if (error instanceof Error) {
      if (error.message.includes('API key not valid')) {
        return {
          success: false,
          error: 'Invalid API key. Please check your key at https://makersuite.google.com/app/apikey'
        };
      }
      if (error.message.includes('404') || error.message.includes('not found')) {
        return {
          success: false,
          error: 'Model not available for this API key. Please ensure you have access to Gemini 2.5 Flash.'
        };
      }
      return {
        success: false,
        error: error.message
      };
    }
    return {
      success: false,
      error: 'Network error'
    };
  }
}


export async function GET() {
  return NextResponse.json({
    success: false,
    error: 'Method not allowed'
  }, { status: 405 });
}