'use client';

import { useState, useEffect } from 'react';
import { useUser, UserButton } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { Sparkles, Loader2, RefreshCcw, Settings, Clock, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

// UI Components (we'll create these)
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { NewsletterPreview } from '@/components/newsletter/NewsletterPreview';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { DemoBanner } from '@/components/ui/demo-banner';

import { NewsletterGenerationResponse, DashboardStats } from '@/types';
import { NewsletterTopic } from '@/lib/ai-processors';

export default function Dashboard() {
  const { user } = useUser();
  const [isGenerating, setIsGenerating] = useState(false);
  const [newsletter, setNewsletter] = useState<NewsletterGenerationResponse['newsletter'] | null>(null);
  const selectedLLM = 'gemini';
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [refreshingFeeds, setRefreshingFeeds] = useState(false);
  const [lastGenerationTime, setLastGenerationTime] = useState<number>(0);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const COOLDOWN_PERIOD = 30000; // 30 seconds to match server-side rate limit
  const [recentNewsletters, setRecentNewsletters] = useState<{
    _id: string;
    title: string;
    date: Date;
    llmUsed: string;
    status: string;
    introduction?: string;
    topics?: NewsletterTopic[];
    conclusion?: string;
  }[]>([]);
  
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null); // null means checking

  // Create stunning gradient animations
  const gradientAnimation = {
    background: [
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    ],
    transition: {
      duration: 10,
      repeat: Infinity,
      repeatType: "reverse" as const
    }
  };

  useEffect(() => {
    if (user) {
      fetchDashboardStats();
      fetchRecentNewsletters();
      checkUserApiKey();
    }
  }, [user]);
  
  const checkUserApiKey = async () => {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const result = await response.json();
        const hasKey = result.success && result.data?.settings?.apiKeys?.gemini?.trim();
        setHasApiKey(!!hasKey);
      } else {
        setHasApiKey(false);
      }
    } catch (error) {
      console.error('Failed to check API key:', error);
      setHasApiKey(false);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const response = await fetch('/api/dashboard/stats');
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setStats(result.data);
        } else {
          console.warn('Dashboard stats API returned no data');
          setStats(null);
        }
      } else {
        console.warn('Dashboard stats API request failed:', response.status);
        setStats(null);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
      setStats(null);
    }
  };

  const fetchRecentNewsletters = async () => {
    try {
      const response = await fetch('/api/newsletters');
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setRecentNewsletters(result.data);
        } else {
          setRecentNewsletters([]);
        }
      } else {
        setRecentNewsletters([]);
      }
    } catch (error) {
      console.error('Failed to fetch recent newsletters:', error);
      setRecentNewsletters([]);
    }
  };

  const deleteNewsletter = async (newsletterId: string) => {
    if (!confirm('Are you sure you want to delete this newsletter? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/newsletters/${newsletterId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Newsletter deleted successfully');
        // Refresh the newsletters list
        fetchRecentNewsletters();
        fetchDashboardStats(); // Update stats
        
        // If the deleted newsletter was currently being viewed, close it
        // Note: Newsletter preview doesn't store _id, so this check is not needed
        setNewsletter(null);
      } else {
        toast.error(result.error || 'Failed to delete newsletter');
      }
    } catch (error) {
      console.error('Delete newsletter error:', error);
      toast.error('Failed to delete newsletter. Please try again.');
    }
  };

  // Cooldown timer effect
  useEffect(() => {
    const interval = setInterval(() => {
      if (lastGenerationTime > 0) {
        const elapsed = Date.now() - lastGenerationTime;
        const remaining = Math.max(0, COOLDOWN_PERIOD - elapsed);
        setCooldownRemaining(remaining);

        if (remaining === 0) {
          clearInterval(interval);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lastGenerationTime, COOLDOWN_PERIOD]);

  const generateNewsletter = async () => {
    if (!user) {
      toast.error('Please sign in to generate newsletters');
      return;
    }

    // Check cooldown
    const elapsed = Date.now() - lastGenerationTime;
    if (lastGenerationTime > 0 && elapsed < COOLDOWN_PERIOD) {
      const remainingSeconds = Math.ceil((COOLDOWN_PERIOD - elapsed) / 1000);
      toast.error(`Please wait ${remainingSeconds} seconds before generating another newsletter`);
      return;
    }

    setIsGenerating(true);
    setLastGenerationTime(Date.now());
    
    try {
      const response = await fetch('/api/newsletter/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          llmProvider: selectedLLM,
        }),
      });

      // Handle non-JSON responses (HTML error pages)
      let data: NewsletterGenerationResponse;
      try {
        const contentType = response.headers.get('content-type');
        if (!contentType?.includes('application/json')) {
          const text = await response.text();
          console.error('Received non-JSON response:', text);
          throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        data = await response.json();
      } catch (jsonError) {
        console.error('Failed to parse JSON response:', jsonError);
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      if (data.success && data.newsletter) {
        setNewsletter(data.newsletter);
        
        // Check if fallback was used and show notification
        if (data.fallbackNotification?.usedFallback && data.fallbackNotification?.message) {
          toast.warning(data.fallbackNotification.message, {
            duration: 8000, // Show for 8 seconds
            position: 'top-center',
          });
        }
        
        // Check if fewer articles were generated than requested
        if (data.topicCountNotification) {
          toast.info(data.topicCountNotification.message, {
            duration: 6000, // Show for 6 seconds
            position: 'top-center',
          });
        }
        
        toast.success(`Newsletter generated successfully! (${data.stats?.generationTime})`);
        fetchDashboardStats(); // Refresh stats
        fetchRecentNewsletters(); // Refresh recent newsletters
      } else {
        toast.error(data.error || 'Failed to generate newsletter');
      }
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Failed to generate newsletter. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const refreshFeeds = async () => {
    setRefreshingFeeds(true);
    try {
      const response = await fetch('/api/rss/refresh', {
        method: 'POST',
      });
      
      if (response.ok) {
        toast.success('RSS feeds refreshed successfully');
        fetchDashboardStats();
      } else {
        toast.error('Failed to refresh feeds');
      }
    } catch {
      toast.error('Failed to refresh feeds');
    } finally {
      setRefreshingFeeds(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-4xl font-bold mb-4">Welcome to Smart Newsletter</h1>
          <p className="text-xl">Please sign in to access your dashboard</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900">
      <motion.div 
        className="absolute inset-0 opacity-30"
        animate={gradientAnimation}
      />
      
      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Top Navigation */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center mb-8"
        >
          <h2 className="text-2xl font-bold text-white">Dashboard</h2>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-300">
              {user?.firstName || user?.emailAddresses[0]?.emailAddress}
            </span>
            <UserButton 
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: "w-10 h-10"
                }
              }}
            />
          </div>
        </motion.div>

        {/* Animated Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600 mb-4">
            AI Newsletter Generator
          </h1>
          <p className="text-xl text-gray-300">
            Transform RSS feeds into stunning newsletters with AI magic ✨
          </p>
          <p className="text-lg text-gray-400 mt-2">
            Welcome back, {user.firstName || user.emailAddresses[0].emailAddress}
          </p>
        </motion.div>

        {/* Demo Banner */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <DemoBanner />
        </motion.div>

        {/* API Key Warning Banner */}
        {hasApiKey === false && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-6"
          >
            <Card className="bg-gradient-to-r from-orange-900/80 to-red-900/80 backdrop-blur-xl border-orange-600">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-orange-500/20 rounded-lg">
                      <Sparkles className="h-6 w-6 text-orange-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">
                        🔑 Gemini API Key Required
                      </h3>
                      <p className="text-orange-100 mb-4">
                        You need to add your own Gemini API key to generate newsletters. This ensures you control your API usage and costs.
                      </p>
                      <div className="flex gap-3">
                        <Button
                          onClick={() => window.location.href = '/settings'}
                          className="bg-orange-600 hover:bg-orange-700 text-white"
                        >
                          <Settings className="mr-2 h-4 w-4" />
                          Add API Key in Settings
                        </Button>
                        <Button
                          onClick={() => window.open('https://makersuite.google.com/app/apikey', '_blank')}
                          variant="outline"
                          className="border-orange-500 text-orange-300 hover:bg-orange-600 hover:text-white"
                        >
                          Get Free Gemini Key
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Stats Cards */}
        <StatsCards stats={stats} />

        {/* Action Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-center gap-4 mb-8"
        >
          <Button
            onClick={refreshFeeds}
            disabled={refreshingFeeds}
            variant="outline"
            className="bg-gray-900/50 backdrop-blur-xl border-gray-700 text-white hover:bg-gray-800/50"
          >
            {refreshingFeeds ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="mr-2 h-4 w-4" />
            )}
            Refresh Feeds
          </Button>
          
          <Button
            onClick={() => window.location.href = '/settings'}
            variant="outline"
            className="bg-gray-900/50 backdrop-blur-xl border-gray-700 text-white hover:bg-gray-800/50"
          >
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </motion.div>

        {/* Main Generation Panel */}
        <Card className="bg-gray-900/90 backdrop-blur-xl border-gray-800 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-3xl text-white">Generate Newsletter</CardTitle>
            <CardDescription className="text-gray-400">
              Choose your AI model and watch the magic happen
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-gray-800 rounded-lg border-2 border-green-500/50">
                <h3 className="text-lg font-semibold text-white mb-2 flex items-center">
                  <span className="w-3 h-3 bg-green-500 rounded-full mr-3"></span>
                  Gemini 2.0 Flash (Active)
                </h3>
                <p className="text-gray-400">Latest stable model • 15 req/min, 1M tokens/day free</p>
                <div className="mt-3 flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-green-400">Ready to use</span>
                </div>
              </div>
            </div>

            <motion.div
              whileHover={hasApiKey !== false ? { scale: 1.02 } : {}}
              whileTap={hasApiKey !== false ? { scale: 0.98 } : {}}
              className="mt-8"
            >
              <Button
                onClick={hasApiKey !== false && cooldownRemaining === 0 ? generateNewsletter : undefined}
                disabled={isGenerating || hasApiKey === false || cooldownRemaining > 0}
                className={`w-full h-14 text-lg font-semibold shadow-lg ${
                  hasApiKey === false || cooldownRemaining > 0
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white'
                }`}
                title={
                  hasApiKey === false
                    ? 'Please add your Gemini API key in Settings first'
                    : cooldownRemaining > 0
                    ? `Please wait ${Math.ceil(cooldownRemaining / 1000)} seconds before generating another newsletter`
                    : 'Newsletter generation may take 20-40 seconds'
                }
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Generating your newsletter...
                  </>
                ) : hasApiKey === false ? (
                  <>
                    <Settings className="mr-2 h-5 w-5" />
                    API Key Required - Go to Settings
                  </>
                ) : cooldownRemaining > 0 ? (
                  <>
                    <Clock className="mr-2 h-5 w-5" />
                    Wait {Math.ceil(cooldownRemaining / 1000)}s
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Generate Newsletter
                  </>
                )}
              </Button>
            </motion.div>
          </CardContent>
        </Card>

        {/* Newsletter Preview */}
        {newsletter && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8"
          >
            <NewsletterPreview 
              data={newsletter} 
              onClose={() => setNewsletter(null)} 
            />
          </motion.div>
        )}

        {/* Recent Newsletters - only show when no newsletter is being previewed */}
        {!newsletter && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8"
          >
          <Card className="bg-gray-900/90 backdrop-blur-xl border-gray-800">
            <CardHeader>
              <CardTitle className="text-2xl text-white flex items-center">
                <Clock className="mr-2 h-6 w-6 text-purple-400" />
                Recent Newsletters
              </CardTitle>
              <CardDescription className="text-gray-400">
                Your previously generated newsletters
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentNewsletters.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p>No newsletters generated yet. Create your first one above!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentNewsletters.map((newsletter, index) => (
                    <motion.div
                      key={newsletter._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="p-4 bg-gray-800 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg font-semibold text-white truncate">{newsletter.title}</h3>
                        <span className="text-sm text-gray-400 ml-4 whitespace-nowrap">
                          {new Date(newsletter.date).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-gray-300 text-sm mb-3 line-clamp-2">{newsletter.introduction}</p>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-4">
                          <span className="text-xs text-gray-400">
                            {newsletter.topics?.length || 0} topics
                          </span>
                          <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400">
                            Gemini
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-xs bg-purple-500/20 border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white transition-colors"
                            onClick={() => {
                              // Transform to the expected format for the preview
                              const previewData = {
                                newsletterTitle: newsletter.title,
                                newsletterDate: new Date(newsletter.date).toLocaleDateString(),
                                introduction: newsletter.introduction,
                                topics: newsletter.topics || [],
                                conclusion: newsletter.conclusion
                              };
                              setNewsletter(previewData);
                            }}
                          >
                            View
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-xs bg-red-500/20 border-red-500 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                            onClick={() => deleteNewsletter(newsletter._id)}
                            title="Delete newsletter"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
        )}
      </div>
    </div>
  );
}