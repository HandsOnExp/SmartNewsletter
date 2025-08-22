import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB, Newsletter } from '@/lib/db';
import { APIResponse } from '@/types';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json<APIResponse>({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // Try to connect to database
    const dbConnection = await connectDB();
    if (!dbConnection) {
      return NextResponse.json<APIResponse>({
        success: true,
        data: [] // Return empty array if database not available
      });
    }

    // Fetch user's newsletters
    const newsletters = await Newsletter.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('title date introduction topics llmUsed status createdAt')
      .exec();

    return NextResponse.json<APIResponse>({
      success: true,
      data: newsletters
    });

  } catch (error) {
    console.error('Error fetching newsletters:', error);
    return NextResponse.json<APIResponse>({
      success: false,
      error: 'Failed to fetch newsletters'
    }, { status: 500 });
  }
}