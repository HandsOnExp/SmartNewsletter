import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getAllCategories, DynamicCategory } from '@/lib/category-manager';
import { connectDB } from '@/lib/db';

// GET - Fetch all categories
export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const url = new URL(request.url);
    const includeStats = url.searchParams.get('stats') === 'true';

    if (includeStats) {
      // Return detailed category information including usage stats
      await connectDB();
      const dynamicCategories = await DynamicCategory.find({})
        .sort({ usageCount: -1 })
        .limit(100);
      
      return NextResponse.json({
        success: true,
        categories: {
          dynamic: dynamicCategories,
          all: await getAllCategories()
        }
      });
    } else {
      // Return simple list of all categories
      const categories = await getAllCategories();
      return NextResponse.json({
        success: true,
        categories
      });
    }
  } catch (error) {
    console.error('Categories fetch error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch categories'
    }, { status: 500 });
  }
}

// POST - Update category information (admin function)
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
    const { categoryId, displayName, emoji, isApproved } = body;

    if (!categoryId) {
      return NextResponse.json({
        success: false,
        error: 'Category ID is required'
      }, { status: 400 });
    }

    await connectDB();
    const updateData: Record<string, string | boolean> = {};
    
    if (displayName) updateData.displayName = displayName;
    if (emoji) updateData.emoji = emoji;
    if (typeof isApproved === 'boolean') updateData.isApproved = isApproved;

    const updatedCategory = await DynamicCategory.findOneAndUpdate(
      { categoryId },
      { $set: updateData },
      { new: true, upsert: false }
    );

    if (!updatedCategory) {
      return NextResponse.json({
        success: false,
        error: 'Category not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      category: updatedCategory
    });

  } catch (error) {
    console.error('Category update error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update category'
    }, { status: 500 });
  }
}