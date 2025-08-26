import { connectDB } from './db';
import mongoose from 'mongoose';

/**
 * Database cleanup utilities for demo deployment
 * Prevents database from filling up with demo data
 */

export interface CleanupStats {
  deletedNewsletters: number;
  deletedUsers: number;
  freedSpace: string;
}

/**
 * Clean up old demo data when database approaches capacity
 */
export async function cleanupDemoData(dryRun: boolean = false): Promise<CleanupStats> {
  await connectDB();
  
  const stats: CleanupStats = {
    deletedNewsletters: 0,
    deletedUsers: 0,
    freedSpace: '0 MB'
  };

  try {
    // Get database stats
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not available');
    }
    const dbStats = await db.stats();
    const usagePercent = (dbStats.dataSize / (512 * 1024 * 1024)) * 100; // 512MB limit
    
    console.log(`Database usage: ${usagePercent.toFixed(2)}% (${(dbStats.dataSize / 1024 / 1024).toFixed(2)} MB)`);
    
    // Only cleanup if over 80% capacity
    if (usagePercent < 80) {
      console.log('Database usage below 80%, no cleanup needed');
      return stats;
    }
    
    console.log('Database usage above 80%, starting cleanup...');
    
    // 1. Delete newsletters older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    if (!dryRun) {
      const Newsletter = mongoose.model('Newsletter');
      const deleteResult = await Newsletter.deleteMany({
        createdAt: { $lt: thirtyDaysAgo }
      });
      stats.deletedNewsletters = deleteResult.deletedCount;
    } else {
      const Newsletter = mongoose.model('Newsletter');
      const count = await Newsletter.countDocuments({
        createdAt: { $lt: thirtyDaysAgo }
      });
      stats.deletedNewsletters = count;
    }
    
    // 2. Delete inactive users (no newsletters in 60 days)
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    
    if (!dryRun) {
      const User = mongoose.model('User');
      const Newsletter = mongoose.model('Newsletter');
      
      // Find users with no recent newsletters
      const inactiveUsers = await User.find({
        lastActive: { $lt: sixtyDaysAgo }
      });
      
      for (const user of inactiveUsers) {
        const hasRecentNewsletters = await Newsletter.countDocuments({
          userId: user.userId,
          createdAt: { $gt: sixtyDaysAgo }
        });
        
        if (hasRecentNewsletters === 0) {
          await User.deleteOne({ _id: user._id });
          await Newsletter.deleteMany({ userId: user.userId });
          stats.deletedUsers++;
        }
      }
    }
    
    // Calculate freed space estimate
    const avgNewsletterSize = 50; // KB
    const avgUserSize = 10; // KB
    const freedSpaceKB = (stats.deletedNewsletters * avgNewsletterSize) + (stats.deletedUsers * avgUserSize);
    stats.freedSpace = `${(freedSpaceKB / 1024).toFixed(2)} MB`;
    
    console.log(`Cleanup ${dryRun ? 'would delete' : 'deleted'}:`, stats);
    
  } catch (error) {
    console.error('Database cleanup error:', error);
    throw error;
  }
  
  return stats;
}

/**
 * Check if database needs cleanup and run it automatically
 */
export async function autoCleanupIfNeeded(): Promise<boolean> {
  try {
    const stats = await cleanupDemoData(true); // Dry run first
    
    if (stats.deletedNewsletters > 0 || stats.deletedUsers > 0) {
      console.log('Running automatic cleanup...');
      await cleanupDemoData(false); // Real cleanup
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Auto cleanup failed:', error);
    return false;
  }
}

/**
 * Get database usage statistics
 */
export async function getDatabaseUsage(): Promise<{
  usagePercent: number;
  usedMB: number;
  limitMB: number;
  needsCleanup: boolean;
}> {
  await connectDB();
  
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection not available');
  }
  const dbStats = await db.stats();
  const limitBytes = 512 * 1024 * 1024; // 512MB
  const usagePercent = (dbStats.dataSize / limitBytes) * 100;
  
  return {
    usagePercent: Math.round(usagePercent * 100) / 100,
    usedMB: Math.round((dbStats.dataSize / 1024 / 1024) * 100) / 100,
    limitMB: 512,
    needsCleanup: usagePercent > 80
  };
}