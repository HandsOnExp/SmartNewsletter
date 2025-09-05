import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Test environment variables
    const geminiKey = process.env.GEMINI_API_KEY;
    
    return NextResponse.json({
      success: true,
      message: 'API test successful',
      env: {
        gemini: geminiKey ? `${geminiKey.substring(0, 8)}...` : 'NOT_SET',
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json({
    success: true,
    message: 'POST endpoint working'
  });
}