import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { cleanupDemoData, getDatabaseUsage } from '@/lib/database-cleanup';

// Admin endpoint for database cleanup
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const body = await request.json();
    const { dryRun = true } = body;

    // Get current database usage
    const usage = await getDatabaseUsage();
    
    // Run cleanup
    const stats = await cleanupDemoData(dryRun);
    
    return NextResponse.json({
      success: true,
      usage,
      cleanup: stats,
      dryRun
    });

  } catch (error) {
    console.error('Cleanup API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Cleanup failed'
    }, { status: 500 });
  }
}

// Get database usage stats
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const usage = await getDatabaseUsage();
    
    return NextResponse.json({
      success: true,
      usage
    });

  } catch (error) {
    console.error('Usage stats error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get usage stats'
    }, { status: 500 });
  }
}