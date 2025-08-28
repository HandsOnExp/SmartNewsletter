import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/db';
import mongoose from 'mongoose';

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    
    // Delete user settings to force recreation with new schema
    if (mongoose.connection.db) {
      const result = await mongoose.connection.db.collection('userSettings').deleteOne({ userId });
      console.log(`Deleted user settings for ${userId}:`, result);
      
      return NextResponse.json({ 
        success: true, 
        message: `Reset user settings for ${userId}. Refresh the page to see changes.`,
        deleted: result.deletedCount 
      });
    } else {
      return NextResponse.json({ success: false, error: 'Database connection failed' });
    }
  } catch (error) {
    console.error('Error resetting user settings:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}