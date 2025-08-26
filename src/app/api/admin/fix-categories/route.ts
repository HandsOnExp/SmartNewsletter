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

    // Valid categories
    const validCategories = ['business', 'technology', 'research', 'product', 'enterprise', 'consumer', 'security', 'development'];
    
    // Find and update the user's settings
    const UserSettings = mongoose.models.UserSettings || mongoose.model('UserSettings', new mongoose.Schema({}, { strict: false, collection: 'usersettings' }));
    
    const userSettings = await UserSettings.findOne({ userId });
    
    if (userSettings) {
      console.log('Current categories:', userSettings.preferences?.preferredCategories);
      
      // Filter out invalid categories
      if (userSettings.preferences?.preferredCategories) {
        const filteredCategories = userSettings.preferences.preferredCategories.filter((cat: string) => 
          validCategories.includes(cat)
        );
        
        console.log('Filtered categories:', filteredCategories);
        
        // Update database with filtered categories
        await UserSettings.updateOne(
          { userId },
          { 
            $set: { 
              'preferences.preferredCategories': filteredCategories 
            }
          }
        );
        
        console.log('Database updated with clean categories');
        
        return NextResponse.json({ 
          success: true, 
          message: `Categories cleaned. Removed ${userSettings.preferences.preferredCategories.length - filteredCategories.length} invalid categories.`,
          oldCategories: userSettings.preferences.preferredCategories,
          newCategories: filteredCategories
        });
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'No categories to clean or user not found.' 
    });

  } catch (error) {
    console.error('Category cleanup error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to clean categories' 
    }, { status: 500 });
  }
}