'use client';

import { useState, useEffect } from 'react';
import { useUser, UserButton } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { Sparkles, Loader2, RefreshCcw, Settings, Clock } from 'lucide-react';
import { toast } from 'sonner';

// UI Components (we'll create these)
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NewsletterPreview } from '@/components/newsletter/NewsletterPreview';
import { StatsCards } from '@/components/dashboard/StatsCards';

import { NewsletterGenerationResponse, DashboardStats } from '@/types';

export default function Dashboard() {
  const { user } = useUser();
  const [isGenerating, setIsGenerating] = useState(false);
  const [newsletter, setNewsletter] = useState<NewsletterGenerationResponse['newsletter'] | null>(null);
  const [selectedLLM, setSelectedLLM] = useState<'cohere' | 'gemini'>('cohere');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [refreshingFeeds, setRefreshingFeeds] = useState(false);
  const [recentNewsletters, setRecentNewsletters] = useState<any[]>([]);

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
    }
  }, [user]);

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

  const generateNewsletter = async () => {
    if (!user) {
      toast.error('Please sign in to generate newsletters');
      return;
    }

    setIsGenerating(true);
    
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

      const data: NewsletterGenerationResponse = await response.json();

      if (data.success && data.newsletter) {
        setNewsletter(data.newsletter);
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
            <Tabs value={selectedLLM} onValueChange={(value) => setSelectedLLM(value as 'cohere' | 'gemini')}>
              <TabsList className="grid w-full grid-cols-2 bg-gray-800">
                <TabsTrigger 
                  value="cohere" 
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500"
                >
                  Cohere (Free Tier)
                </TabsTrigger>
                <TabsTrigger 
                  value="gemini" 
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-teal-500"
                >
                  Gemini
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="cohere" className="mt-6">
                <div className="space-y-4">
                  <div className="p-4 bg-gray-800 rounded-lg">
                    <h3 className="text-lg font-semibold text-white mb-2">Cohere Command-R</h3>
                    <p className="text-gray-400">Fast, reliable text generation • 1000 calls/month free</p>
                    <div className="mt-3 flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-green-400">Ready to use</span>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="gemini" className="mt-6">
                <div className="space-y-4">
                  <div className="p-4 bg-gray-800 rounded-lg">
                    <h3 className="text-lg font-semibold text-white mb-2">Gemini 2.0 Flash</h3>
                    <p className="text-gray-400">Advanced generation with image support • 15 req/min free</p>
                    <div className="mt-3 flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-green-400">Ready to use</span>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="mt-8"
            >
              <Button
                onClick={generateNewsletter}
                disabled={isGenerating}
                className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Generating Magic...
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
                          {new Date(newsletter.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-gray-300 text-sm mb-3 line-clamp-2">{newsletter.introduction}</p>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-4">
                          <span className="text-xs text-gray-400">
                            {newsletter.topics?.length || 0} topics
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            newsletter.llmUsed === 'gemini' 
                              ? 'bg-green-500/20 text-green-400' 
                              : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {newsletter.llmUsed === 'gemini' ? 'Gemini' : 'Cohere'}
                          </span>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-xs bg-purple-500/20 border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white transition-colors"
                          onClick={() => setNewsletter(newsletter)}
                        >
                          View
                        </Button>
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