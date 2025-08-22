import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB, Newsletter } from '@/lib/db';
import { APIResponse } from '@/types';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
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
        success: false,
        error: 'Database not available'
      }, { status: 503 });
    }

    const { id } = params;

    // Find and delete the newsletter (ensure it belongs to the user)
    const newsletter = await Newsletter.findOneAndDelete({ 
      _id: id, 
      userId: userId 
    });

    if (!newsletter) {
      return NextResponse.json<APIResponse>({
        success: false,
        error: 'Newsletter not found or unauthorized'
      }, { status: 404 });
    }

    return NextResponse.json<APIResponse>({
      success: true,
      message: 'Newsletter deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting newsletter:', error);
    return NextResponse.json<APIResponse>({
      success: false,
      error: 'Failed to delete newsletter'
    }, { status: 500 });
  }
}