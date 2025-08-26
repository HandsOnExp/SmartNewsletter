import { connectDB } from './db';
import mongoose from 'mongoose';

// Known categories with their display information
export const KNOWN_CATEGORIES = {
  'research': { label: 'Research', emoji: '🔬' },
  'product': { label: 'Product', emoji: '📦' },
  'business': { label: 'Business', emoji: '💼' },
  'policy': { label: 'Policy', emoji: '🏛️' },
  'security': { label: 'Security', emoji: '🔒' },
  'fun': { label: 'Fun', emoji: '🎉' },
  'health': { label: 'Health', emoji: '🏥' },
  'healthcare': { label: 'Healthcare', emoji: '⚕️' },
  'technology': { label: 'Technology', emoji: '💻' },
  'science': { label: 'Science', emoji: '🧪' },
  'innovation': { label: 'Innovation', emoji: '💡' },
  'ai': { label: 'AI', emoji: '🤖' },
  'machine-learning': { label: 'Machine Learning', emoji: '🧠' },
  'analysis': { label: 'Analysis', emoji: '📊' },
  'enterprise': { label: 'Enterprise', emoji: '🏢' },
  'consumer': { label: 'Consumer', emoji: '🛍️' },
  'development': { label: 'Development', emoji: '⚙️' },
  'news': { label: 'News', emoji: '📰' },
  'education': { label: 'Education', emoji: '🎓' }
};

// Dynamic Categories Schema - stores newly discovered categories
const DynamicCategorySchema = new mongoose.Schema({
  categoryId: { 
    type: String, 
    required: true, 
    lowercase: true,
    trim: true
  },
  displayName: { 
    type: String, 
    required: true 
  },
  emoji: { 
    type: String, 
    default: '📄' 
  },
  firstSeenAt: { 
    type: Date, 
    default: Date.now 
  },
  usageCount: { 
    type: Number, 
    default: 0 
  },
  isApproved: { 
    type: Boolean, 
    default: true // Auto-approve for now, can be changed to false for manual approval
  }
}, { 
  timestamps: true 
});

DynamicCategorySchema.index({ categoryId: 1 }, { unique: true });
DynamicCategorySchema.index({ isApproved: 1 });
DynamicCategorySchema.index({ usageCount: -1 });

export const DynamicCategory = mongoose.models.DynamicCategory || mongoose.model('DynamicCategory', DynamicCategorySchema);

/**
 * Normalizes a category string to a consistent format
 */
export function normalizeCategory(category: string): string {
  return category
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Gets display information for a category, creating it if it doesn't exist
 */
export async function getCategoryInfo(category: string): Promise<{ label: string; emoji: string; id: string }> {
  const normalizedId = normalizeCategory(category);
  
  // Check if it's a known category first
  if (normalizedId in KNOWN_CATEGORIES) {
    const knownCategory = KNOWN_CATEGORIES[normalizedId as keyof typeof KNOWN_CATEGORIES];
    return {
      id: normalizedId,
      label: knownCategory.label,
      emoji: knownCategory.emoji
    };
  }
  
  // Check if we've seen this category before in the database
  await connectDB();
  let dynamicCategory = await DynamicCategory.findOne({ categoryId: normalizedId });
  
  if (!dynamicCategory) {
    // Create new category
    const displayName = category
      .split(/[-_\s]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    dynamicCategory = await DynamicCategory.create({
      categoryId: normalizedId,
      displayName,
      emoji: '📄', // Default emoji for unknown categories
      usageCount: 1
    });
    
    console.log(`Created new dynamic category: ${normalizedId} -> ${displayName}`);
  } else {
    // Increment usage count
    await DynamicCategory.updateOne(
      { categoryId: normalizedId },
      { $inc: { usageCount: 1 } }
    );
  }
  
  return {
    id: normalizedId,
    label: dynamicCategory.displayName,
    emoji: dynamicCategory.emoji
  };
}

/**
 * Gets all available categories (known + approved dynamic)
 */
export async function getAllCategories(): Promise<Array<{ id: string; label: string; emoji: string }>> {
  const knownCategories = Object.entries(KNOWN_CATEGORIES).map(([id, info]) => ({
    id,
    label: info.label,
    emoji: info.emoji
  }));
  
  await connectDB();
  const dynamicCategories = await DynamicCategory.find({ 
    isApproved: true 
  }).sort({ usageCount: -1 });
  
  const dynamicCategoryList = dynamicCategories.map(cat => ({
    id: cat.categoryId,
    label: cat.displayName,
    emoji: cat.emoji
  }));
  
  return [...knownCategories, ...dynamicCategoryList];
}

/**
 * Validates and normalizes newsletter topics categories
 */
export async function validateAndNormalizeTopics<T extends { category?: string }>(topics: T[]): Promise<(T & { category: string })[]> {
  const normalizedTopics: (T & { category: string })[] = [];
  
  for (const topic of topics) {
    if (topic.category) {
      const categoryInfo = await getCategoryInfo(topic.category);
      normalizedTopics.push({
        ...topic,
        category: categoryInfo.id
      });
    } else {
      // Default category if none provided
      normalizedTopics.push({
        ...topic,
        category: 'research'
      });
    }
  }
  
  return normalizedTopics;
}

/**
 * Fallback function to map unknown categories to known ones
 */
export function mapUnknownCategory(unknownCategory: string): string {
  const normalized = normalizeCategory(unknownCategory);
  
  // Mapping rules for common variations
  const mappings: Record<string, string> = {
    'fintech': 'business',
    'startup': 'business',
    'startups': 'business',
    'funding': 'business',
    'investment': 'business',
    'healthcare': 'health',
    'medical': 'health',
    'biotech': 'health',
    'pharma': 'health',
    'cybersecurity': 'security',
    'privacy': 'security',
    'data-protection': 'security',
    'machine-learning': 'ai',
    'ml': 'ai',
    'artificial-intelligence': 'ai',
    'deep-learning': 'ai',
    'neural-networks': 'ai',
    'robotics': 'ai',
    'automation': 'ai',
    'tech': 'technology',
    'software': 'technology',
    'hardware': 'technology',
    'mobile': 'technology',
    'web': 'development',
    'programming': 'development',
    'coding': 'development',
    'devops': 'development',
    'cloud': 'enterprise',
    'saas': 'enterprise',
    'corporate': 'enterprise',
    'b2b': 'enterprise',
    'gaming': 'consumer',
    'entertainment': 'consumer',
    'social': 'consumer',
    'media': 'consumer'
  };
  
  return mappings[normalized] || normalized;
}