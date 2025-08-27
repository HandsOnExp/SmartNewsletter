import { NextResponse } from 'next/server';
import { connectDB, getConnectionStatus } from '@/lib/db';

export async function GET() {
  try {
    console.log('Testing MongoDB connection...');
    console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);
    console.log('MONGODB_URI (masked):', process.env.MONGODB_URI?.replace(/\/\/.*@/, '//***:***@'));
    
    // Test connection
    const connection = await connectDB();
    const status = getConnectionStatus();
    
    return NextResponse.json({
      success: true,
      connection: !!connection,
      status,
      env: {
        mongodbUri: !!process.env.MONGODB_URI,
        mongodbUriMasked: process.env.MONGODB_URI?.replace(/\/\/.*@/, '//***:***@')
      }
    });
  } catch (error) {
    console.error('MongoDB connection test failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      env: {
        mongodbUri: !!process.env.MONGODB_URI,
        mongodbUriMasked: process.env.MONGODB_URI?.replace(/\/\/.*@/, '//***:***@')
      }
    }, { status: 500 });
  }
}