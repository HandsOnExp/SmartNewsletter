'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { sanitizeURL } from '@/lib/url-validator';
import { Rss, Settings, Key, Save, Plus, Trash2, ArrowLeft, ExternalLink, X, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { RSS_FEEDS, type RSSFeed } from '@/config/rss-feeds';
import { UserSettings, CustomRSSFeed, TimePeriod, NewsletterCategory } from '@/types';
import { TIME_PERIOD_OPTIONS } from '@/lib/rss-parser';

export default function SettingsPage() {
  const { user, isLoaded } = useUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedsLoading, setFeedsLoading] = useState(false);
  const [testingKey, setTestingKey] = useState<{ provider: string; testing: boolean }>({ provider: '', testing: false });
  const [showApiKeys, setShowApiKeys] = useState({
    gemini: false
  });
  
  const [feeds, setFeeds] = useState<RSSFeed[]>([]);
  const [customFeeds, setCustomFeeds] = useState<CustomRSSFeed[]>([]);
  const [deletedFeeds, setDeletedFeeds] = useState<string[]>([]);
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [newFeedName, setNewFeedName] = useState('');
  
  const [apiKeys, setApiKeys] = useState({
    gemini: ''
  });
  
  const [preferences, setPreferences] = useState({
    autoGenerate: false,
    generateTime: '09:00',
    maxArticles: 5,
    language: 'english' as 'english' | 'hebrew' | 'spanish' | 'french' | 'german' | 'italian' | 'portuguese',
    timePeriod: '24hours' as TimePeriod,
    preferredCategories: [] as NewsletterCategory[]
  });

  // API Key management functions (Gemini only)
  const openAPIKeyDashboard = () => {
    window.open('https://makersuite.google.com/app/apikey', '_blank');
  };

  const clearAPIKey = () => {
    setApiKeys({ gemini: '' });
    toast.success('Gemini API key cleared');
  };

  const toggleApiKeyVisibility = () => {
    setShowApiKeys(prev => ({ gemini: !prev.gemini }));
  };

  const testAPIKey = async () => {
    const apiKey = apiKeys.gemini;
    if (!apiKey) {
      toast.error('Please enter Gemini API key first');
      return;
    }

    setTestingKey({ provider: 'gemini', testing: true });
    
    try {
      const response = await fetch('/api/test-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ provider: 'gemini', apiKey }),
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Gemini API key is working!', {
          description: data.message
        });
      } else {
        toast.error('Gemini API key test failed', {
          description: data.error
        });
      }
    } catch {
      toast.error('Failed to test API key', {
        description: 'Network error or server unavailable'
      });
    } finally {
      setTestingKey({ provider: '', testing: false });
    }
  };

  const loadUserSettings = async () => {
    try {
      // Add cache-busting parameter to prevent browser caching
      const timestamp = Date.now();
      const response = await fetch(`/api/settings?t=${timestamp}`);
      let settingsLoaded = false;

      console.log('🔄 Loading settings from API, response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📥 API response data:', {
          success: data.success,
          hasSettings: !!data.data?.settings,
          rssFeeds: data.data?.settings?.rssFeeds
        });
        
        if (data.success && data.data?.settings) {
          const settings: UserSettings = data.data.settings;
          console.log('✅ Settings loaded successfully, RSS feed counts:', {
            enabled: settings.rssFeeds?.enabled?.length || 0,
            disabled: settings.rssFeeds?.disabled?.length || 0,
            custom: settings.rssFeeds?.custom?.length || 0,
            deleted: settings.rssFeeds?.deleted?.length || 0
          });
          applySettings(settings);
          settingsLoaded = true;
        }
      } else {
        console.error('❌ API response not ok:', response.status, response.statusText);
      }

      // If server failed, try localStorage as fallback
      if (!settingsLoaded) {
        const localSettings = loadFromLocalStorage();
        if (localSettings) {
          console.log('Loading settings from localStorage');
          applySettings(localSettings);
          toast.info('Settings loaded from local storage');
        } else {
          // Apply defaults if nothing found
          applyDefaultSettings();
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      
      // Try localStorage as fallback
      const localSettings = loadFromLocalStorage();
      if (localSettings) {
        applySettings(localSettings);
        toast.warning('Settings loaded from backup (server unavailable)');
      } else {
        toast.error('Failed to load settings');
        applyDefaultSettings();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadUserSettings();
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const getStorageKey = (userId: string) => `smart-newsletter-settings-${userId}`;

  const saveToLocalStorage = (settings: UserSettings) => {
    if (user && typeof window !== 'undefined') {
      try {
        localStorage.setItem(getStorageKey(user.id), JSON.stringify({
          ...settings,
          lastSaved: new Date().toISOString()
        }));
      } catch (error) {
        console.error('Failed to save to localStorage:', error);
      }
    }
  };

  const loadFromLocalStorage = (): UserSettings | null => {
    if (user && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(getStorageKey(user.id));
        if (stored) {
          const parsedSettings = JSON.parse(stored) as UserSettings;
          
          // Filter out invalid categories from localStorage as well
          const validCategories: NewsletterCategory[] = ['business', 'technology', 'research', 'product', 'enterprise', 'consumer', 'security', 'development'];
          if (parsedSettings.preferences?.preferredCategories) {
            parsedSettings.preferences.preferredCategories = parsedSettings.preferences.preferredCategories
              .filter((cat): cat is NewsletterCategory => validCategories.includes(cat as NewsletterCategory));
          }
          
          return parsedSettings;
        }
        return null;
      } catch (error) {
        console.error('Failed to load from localStorage:', error);
        return null;
      }
    }
    return null;
  };


  const applySettings = (settings: UserSettings) => {
    console.log('🔧 applySettings called with:', {
      hasApiKeys: !!settings.apiKeys,
      hasPreferences: !!settings.preferences,
      hasRssFeeds: !!settings.rssFeeds,
      rssFeeds: settings.rssFeeds
    });

    // Valid categories for filtering
    const validCategories: NewsletterCategory[] = ['business', 'technology', 'research', 'product', 'enterprise', 'consumer', 'security', 'development'];
    
    // Filter out invalid categories from loaded preferences
    const filteredCategories = (settings.preferences?.preferredCategories || [])
      .filter((cat): cat is NewsletterCategory => validCategories.includes(cat as NewsletterCategory));
    
    setApiKeys({ gemini: settings.apiKeys?.gemini || '' });
    setPreferences({
      ...(settings.preferences || {}),
      autoGenerate: settings.preferences?.autoGenerate || false,
      generateTime: settings.preferences?.generateTime || '09:00',
      maxArticles: settings.preferences?.maxArticles || 5,
      language: settings.preferences?.language || 'english',
      timePeriod: settings.preferences?.timePeriod || '24hours',
      preferredCategories: filteredCategories
    });
    setCustomFeeds(settings.rssFeeds?.custom || []);
    
    // Update feed enabled/disabled status and filter out deleted feeds
    // If no RSS settings exist, enable all feeds by default
    // If RSS settings exist but enabled array is empty, respect that (all disabled)
    const enabledIds = settings.rssFeeds ? 
      (settings.rssFeeds.enabled || []) : 
      RSS_FEEDS.map(feed => feed.id);
    const deletedIds = settings.rssFeeds?.deleted || [];
    setDeletedFeeds(deletedIds);
    
    console.log('📊 Processing RSS feeds:', {
      totalRssFeeds: RSS_FEEDS.length,
      enabledIds: enabledIds,
      enabledCount: enabledIds.length,
      deletedIds: deletedIds,
      deletedCount: deletedIds.length
    });
    
    const updatedFeeds = RSS_FEEDS
      .filter(feed => !deletedIds.includes(feed.id)) // Filter out deleted feeds
      .map(feed => ({
        ...feed,
        enabled: enabledIds.includes(feed.id)
      }));
      
    console.log('📋 Final feed states:', updatedFeeds.map(feed => ({
      id: feed.id,
      name: feed.name,
      enabled: feed.enabled
    })));
    
    setFeeds(updatedFeeds);
    
    console.log('✅ applySettings completed, feeds updated');
    
    // Add a small delay and verify the state was actually updated
    setTimeout(() => {
      console.log('🔍 Post-update feed verification:', updatedFeeds.slice(0, 3).map(f => ({
        id: f.id,
        name: f.name,
        enabled: f.enabled,
        uiShouldShow: f.enabled ? 'ON' : 'OFF'
      })));
    }, 100);
  };


  // Function to enable all RSS feeds
  const enableAllFeeds = async () => {
    if (feedsLoading) return; // Prevent multiple simultaneous calls
    
    try {
      setFeedsLoading(true);
      console.log('🟢 Enabling all RSS feeds...');
      const response = await fetch('/api/feeds/enable-all', {
        method: 'POST',
        headers: {
          'Cache-Control': 'no-cache',
        }
      });
      
      const result = await response.json();
      console.log('🟢 Enable all feeds API response:', result);
      
      if (result.success) {
        toast.success(result.message);
        console.log('🔄 Reloading settings after enable all...');
        // Reload settings to reflect changes
        await loadUserSettings();
      } else {
        console.error('❌ Enable all feeds failed:', result.error);
        toast.error(result.error || 'Failed to enable all feeds');
      }
    } catch (error) {
      console.error('Enable all feeds error:', error);
      toast.error('Failed to enable all feeds');
    } finally {
      setFeedsLoading(false);
    }
  };

  // Function to disable all RSS feeds
  const disableAllFeeds = async () => {
    if (feedsLoading) return; // Prevent multiple simultaneous calls
    
    try {
      setFeedsLoading(true);
      console.log('🔴 Disabling all RSS feeds...');
      const response = await fetch('/api/feeds/disable-all', {
        method: 'POST',
        headers: {
          'Cache-Control': 'no-cache',
        }
      });
      
      const result = await response.json();
      console.log('🔴 Disable all feeds API response:', result);
      
      if (result.success) {
        toast.success(result.message);
        console.log('🔄 Reloading settings after disable all...');
        // Reload settings to reflect changes
        await loadUserSettings();
      } else {
        console.error('❌ Disable all feeds failed:', result.error);
        toast.error(result.error || 'Failed to disable all feeds');
      }
    } catch (error) {
      console.error('Disable all feeds error:', error);
      toast.error('Failed to disable all feeds');
    } finally {
      setFeedsLoading(false);
    }
  };


  const applyDefaultSettings = () => {
    setApiKeys({ gemini: '' });
    setPreferences({
      autoGenerate: false,
      generateTime: '09:00',
      maxArticles: 5,
      language: 'english',
      timePeriod: '24hours',
      preferredCategories: []
    });
    setCustomFeeds([]);
    setDeletedFeeds([]);
    
    // All feeds enabled by default
    const updatedFeeds = RSS_FEEDS.map(feed => ({
      ...feed,
      enabled: true
    }));
    setFeeds(updatedFeeds);
  };

  const toggleFeed = (feedId: string, enabled: boolean) => {
    console.log(`🔄 toggleFeed called: ${feedId} -> ${enabled}`);
    
    setFeeds(prev => {
      const updated = prev.map(feed => 
        feed.id === feedId ? { ...feed, enabled } : feed
      );
      
      console.log(`🔄 toggleFeed result for ${feedId}:`, 
        updated.find(f => f.id === feedId)?.enabled
      );
      
      return updated;
    });
  };

  const addCustomFeed = () => {
    if (!newFeedUrl || !newFeedName) {
      toast.error('Please enter both feed name and URL');
      return;
    }

    // Validate URL format
    const sanitizedUrl = sanitizeURL(newFeedUrl);
    
    try {
      new URL(sanitizedUrl);
    } catch {
      toast.error('Please enter a valid URL (e.g., https://example.com/feed.xml)');
      return;
    }

    // Check if URL already exists
    const urlExists = customFeeds.some(feed => feed.url === sanitizedUrl);
    if (urlExists) {
      toast.error('This RSS feed URL has already been added');
      return;
    }

    const newFeed: CustomRSSFeed = {
      id: `custom-${Date.now()}`,
      name: newFeedName,
      url: sanitizedUrl,
      category: 'custom',
      enabled: true
    };

    setCustomFeeds(prev => [...prev, newFeed]);
    setNewFeedName('');
    setNewFeedUrl('');
    toast.success('Custom feed added successfully');
  };

  const removeCustomFeed = (feedId: string) => {
    const feed = customFeeds.find(f => f.id === feedId);
    if (feed && confirm(`Are you sure you want to remove "${feed.name}"? This action cannot be undone.`)) {
      setCustomFeeds(prev => prev.filter(feed => feed.id !== feedId));
      toast.success('Custom feed removed');
    }
  };

  const removeFeed = (feedId: string) => {
    const feed = feeds.find(f => f.id === feedId);
    if (feed && confirm(`Are you sure you want to remove "${feed.name}"? This action cannot be undone.`)) {
      setFeeds(prev => prev.filter(feed => feed.id !== feedId));
      setDeletedFeeds(prev => [...prev, feedId]); // Track deleted feed
      toast.success('RSS feed removed');
    }
  };

  const toggleCustomFeed = (feedId: string, enabled: boolean) => {
    console.log(`🔄 toggleCustomFeed called: ${feedId} -> ${enabled}`);
    
    setCustomFeeds(prev => {
      const updated = prev.map(feed => 
        feed.id === feedId ? { ...feed, enabled } : feed
      );
      
      console.log(`🔄 toggleCustomFeed result for ${feedId}:`, 
        updated.find(f => f.id === feedId)?.enabled
      );
      
      return updated;
    });
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const settingsData = {
        apiKeys,
        preferences,
        rssFeeds: {
          enabled: feeds.filter(f => f.enabled).map(f => f.id),
          disabled: feeds.filter(f => !f.enabled).map(f => f.id),
          deleted: deletedFeeds,
          custom: customFeeds
        }
      };

      // Always save to localStorage first (immediate backup)
      const fullSettingsData = {
        userId: user?.id || '',
        ...settingsData
      };
      saveToLocalStorage(fullSettingsData);

      // Try to save to server
      try {
        const response = await fetch('/api/settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(settingsData),
        });

        const data = await response.json();
        
        if (response.ok && data.success) {
          toast.success('Settings saved successfully!');
        } else {
          toast.warning('Settings saved locally (server sync failed)');
        }
      } catch (serverError) {
        console.error('Server save failed:', serverError);
        toast.warning('Settings saved locally (server unavailable)');
      }

    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // Show loading while Clerk is checking authentication
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-xl">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-4xl font-bold mb-4">Access Denied</h1>
          <p className="text-xl">Please sign in to access settings</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-xl">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Button
            onClick={() => window.location.href = '/dashboard'}
            variant="outline"
            className="mb-4 bg-gray-900/50 backdrop-blur-xl border-gray-700 text-white hover:bg-gray-800/50"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Settings
          </h1>
          <p className="text-gray-300 mt-2">Configure your AI newsletter preferences</p>
        </motion.div>

        <Tabs defaultValue="feeds" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 bg-gray-800/50">
            <TabsTrigger value="feeds" className="data-[state=active]:bg-purple-600">RSS Feeds</TabsTrigger>
            <TabsTrigger value="api" className="data-[state=active]:bg-purple-600">API Keys</TabsTrigger>
            <TabsTrigger value="preferences" className="data-[state=active]:bg-purple-600">Preferences</TabsTrigger>
          </TabsList>

          <TabsContent value="feeds">
            <div className="space-y-6">
              {/* Default RSS Feeds */}
              <Card className="bg-gray-900/90 backdrop-blur-xl border-gray-800">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center text-white">
                        <Rss className="mr-2 h-5 w-5" />
                        RSS Feed Management
                      </CardTitle>
                      <CardDescription className="text-gray-400">
                        Enable or disable RSS feeds for newsletter generation
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={enableAllFeeds}
                        disabled={feedsLoading}
                        variant="outline"
                        className="border-green-600 text-green-600 hover:bg-green-600 hover:text-white px-4 py-2 text-sm disabled:opacity-50"
                      >
                        {feedsLoading ? (
                          <>
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2"></div>
                            Enabling...
                          </>
                        ) : (
                          'Enable All'
                        )}
                      </Button>
                      <Button
                        onClick={disableAllFeeds}
                        disabled={feedsLoading}
                        variant="outline"
                        className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white px-4 py-2 text-sm disabled:opacity-50"
                      >
                        {feedsLoading ? (
                          <>
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2"></div>
                            Disabling...
                          </>
                        ) : (
                          'Disable All'
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {feeds.map((feed) => (
                    <div key={feed.id} className="flex items-center justify-between p-4 border border-gray-700 rounded-lg bg-gray-800/50">
                      <div>
                        <h3 className="font-semibold text-white">{feed.name}</h3>
                        <p className="text-sm text-gray-400 capitalize">{feed.category}</p>
                        <p className="text-xs text-gray-500 mt-1">{feed.url}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch 
                          checked={feed.enabled}
                          onCheckedChange={(checked) => {
                            console.log(`🔀 Switch toggled for ${feed.name}: ${feed.enabled} -> ${checked}`);
                            toggleFeed(feed.id, checked);
                          }}
                        />
                        {/* Debug indicator */}
                        <span className="text-xs text-gray-500 ml-2">
                          {feed.enabled ? '🟢' : '🔴'}
                        </span>
                        <Button
                          onClick={() => removeFeed(feed.id)}
                          variant="outline"
                          size="sm"
                          className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Custom RSS Feeds */}
              <Card className="bg-gray-900/90 backdrop-blur-xl border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white">Custom RSS Feeds</CardTitle>
                  <CardDescription className="text-gray-400">
                    Add your own RSS feeds
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Add new feed form */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Feed name"
                      value={newFeedName}
                      onChange={(e) => setNewFeedName(e.target.value)}
                      className="bg-gray-800 border-gray-600 text-white w-40 flex-shrink-0"
                    />
                    <Input
                      placeholder="RSS feed URL"
                      value={newFeedUrl}
                      onChange={(e) => setNewFeedUrl(e.target.value)}
                      className="bg-gray-800 border-gray-600 text-white flex-1 min-w-0"
                    />
                    <Button onClick={addCustomFeed} className="bg-purple-600 hover:bg-purple-700 flex-shrink-0">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Custom feeds list */}
                  {customFeeds.map((feed) => (
                    <div key={feed.id} className="flex items-center justify-between p-4 border border-gray-700 rounded-lg bg-gray-800/50">
                      <div>
                        <h3 className="font-semibold text-white">{feed.name}</h3>
                        <p className="text-xs text-gray-500 mt-1">{feed.url}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch 
                          checked={feed.enabled}
                          onCheckedChange={(checked) => toggleCustomFeed(feed.id, checked)}
                        />
                        {/* Debug indicator */}
                        <span className="text-xs text-gray-500 ml-2">
                          {feed.enabled ? '🟢' : '🔴'}
                        </span>
                        <Button
                          onClick={() => removeCustomFeed(feed.id)}
                          variant="outline"
                          size="sm"
                          className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="api">
            <Card className="bg-gray-900/90 backdrop-blur-xl border-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center text-white">
                  <Key className="mr-2 h-5 w-5" />
                  API Configuration
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Configure your AI provider API keys
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="gemini-key" className="text-white">Google Gemini API Key</Label>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => openAPIKeyDashboard()}
                        variant="outline"
                        size="sm"
                        className="bg-blue-500/20 border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white transition-colors"
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Get Key
                      </Button>
                      {apiKeys.gemini && (
                        <Button
                          onClick={() => testAPIKey()}
                          variant="outline"
                          size="sm"
                          disabled={testingKey.testing && testingKey.provider === 'gemini'}
                          className="bg-green-500/20 border-green-500 text-green-400 hover:bg-green-500 hover:text-white transition-colors disabled:opacity-50"
                        >
                          {testingKey.testing && testingKey.provider === 'gemini' ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-transparent border-t-current mr-1" />
                          ) : (
                            <CheckCircle className="h-4 w-4 mr-1" />
                          )}
                          Test Key
                        </Button>
                      )}
                      {apiKeys.gemini && (
                        <Button
                          onClick={() => clearAPIKey()}
                          variant="outline"
                          size="sm"
                          className="bg-red-500/20 border-red-500 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="relative">
                    <Input
                      id="gemini-key"
                      type={showApiKeys.gemini ? "text" : "password"}
                      placeholder="Enter your Gemini API key"
                      value={apiKeys.gemini}
                      onChange={(e) => setApiKeys({...apiKeys, gemini: e.target.value})}
                      className="bg-gray-800 border-gray-600 text-white pr-10"
                    />
                    {apiKeys.gemini && (
                      <Button
                        type="button"
                        onClick={() => toggleApiKeyVisibility()}
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-gray-400 hover:text-white"
                      >
                        {showApiKeys.gemini ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    Get your key at makersuite.google.com • 15 requests/min free
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preferences">
            <Card className="bg-gray-900/90 backdrop-blur-xl border-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center text-white">
                  <Settings className="mr-2 h-5 w-5" />
                  Generation Preferences
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Customize how newsletters are generated
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-white">Auto-Generate Daily</Label>
                    <p className="text-sm text-gray-400">
                      Automatically generate newsletter at scheduled time
                    </p>
                  </div>
                  <Switch 
                    checked={preferences.autoGenerate}
                    onCheckedChange={(checked) => 
                      setPreferences({...preferences, autoGenerate: checked})
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white">Generation Time</Label>
                  <Input
                    type="time"
                    value={preferences.generateTime}
                    onChange={(e) => 
                      setPreferences({...preferences, generateTime: e.target.value})
                    }
                    disabled={!preferences.autoGenerate}
                    className="bg-gray-800 border-gray-600 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white">AI Provider</Label>
                  <div className="flex items-center justify-between p-3 bg-gray-800 rounded-md border border-gray-600">
                    <span className="text-white">Google Gemini</span>
                    <span className="text-green-400 text-sm">Active</span>
                  </div>
                  <p className="text-xs text-gray-400">Powered by Google&apos;s Gemini AI for reliable newsletter generation</p>
                </div>
              </CardContent>
            </Card>

            {/* Newsletter Preferences Card */}
            <Card className="bg-gray-900/90 backdrop-blur-xl border-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center text-white">
                  <Settings className="mr-2 h-5 w-5" />
                  Newsletter Preferences
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Configure newsletter generation settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-white">Newsletter Articles</Label>
                    <span className="text-purple-400 font-semibold text-lg">
                      {preferences.maxArticles}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="range"
                      min="1"
                      max="8"
                      value={preferences.maxArticles}
                      onChange={(e) => setPreferences({...preferences, maxArticles: parseInt(e.target.value)})}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${((preferences.maxArticles - 1) / 7) * 100}%, #374151 ${((preferences.maxArticles - 1) / 7) * 100}%, #374151 100%)`
                      }}
                    />
                    <style jsx>{`
                      input[type="range"]::-webkit-slider-thumb {
                        appearance: none;
                        height: 20px;
                        width: 20px;
                        border-radius: 50%;
                        background: #8b5cf6;
                        border: 2px solid #ffffff;
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                        cursor: pointer;
                      }
                      input[type="range"]::-moz-range-thumb {
                        height: 20px;
                        width: 20px;
                        border-radius: 50%;
                        background: #8b5cf6;
                        border: 2px solid #ffffff;
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                        cursor: pointer;
                        border: none;
                      }
                      input[type="range"]:focus::-webkit-slider-thumb {
                        box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.3);
                      }
                      input[type="range"]:focus::-moz-range-thumb {
                        box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.3);
                      }
                    `}</style>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>1</span>
                    <span>4</span>
                    <span>8</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Number of articles to include in each generated newsletter
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-white">Language</Label>
                  <Select 
                    value={preferences.language}
                    onValueChange={(value: 'english' | 'hebrew' | 'spanish' | 'french' | 'german' | 'italian' | 'portuguese') => 
                      setPreferences({...preferences, language: value})
                    }
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="english">English</SelectItem>
                      <SelectItem value="spanish">Español (Spanish)</SelectItem>
                      <SelectItem value="french">Français (French)</SelectItem>
                      <SelectItem value="german">Deutsch (German)</SelectItem>
                      <SelectItem value="italian">Italiano (Italian)</SelectItem>
                      <SelectItem value="portuguese">Português (Portuguese)</SelectItem>
                      <SelectItem value="hebrew">עברית (Hebrew)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    Language for newsletter generation and content
                  </p>
                </div>

                {/* Time Period Selection */}
                <div className="space-y-2">
                  <Label className="text-white">Article Time Period</Label>
                  <Select 
                    value={preferences.timePeriod}
                    onValueChange={(value: TimePeriod) => 
                      setPreferences({...preferences, timePeriod: value})
                    }
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600">
                      {TIME_PERIOD_OPTIONS.map((option) => (
                        <SelectItem 
                          key={option.value} 
                          value={option.value}
                          className="text-white hover:bg-gray-700 focus:bg-gray-700"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{option.label}</span>
                            <span className="text-xs text-gray-400">{option.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    Choose how far back to fetch articles from RSS feeds
                  </p>
                </div>

                {/* Category Selection */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-white">Preferred Categories</Label>
                    <span className="text-purple-400 text-sm font-medium">
                      {preferences.preferredCategories.length}/3 selected
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">
                    Select 1-3 categories that interest you. Only articles from these categories will appear in your newsletters.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {([
                      { value: 'business', label: 'Business', emoji: '💼' },
                      { value: 'technology', label: 'Technology', emoji: '⚡' },
                      { value: 'research', label: 'Research', emoji: '🔬' },
                      { value: 'product', label: 'Product', emoji: '🚀' },
                      { value: 'enterprise', label: 'Enterprise', emoji: '🏢' },
                      { value: 'consumer', label: 'Consumer', emoji: '🛍️' },
                      { value: 'security', label: 'Security', emoji: '🔒' },
                      { value: 'development', label: 'Development', emoji: '⚙️' }
                    ] as const).map((category) => {
                      const isSelected = preferences.preferredCategories.includes(category.value as NewsletterCategory);
                      const isDisabled = !isSelected && preferences.preferredCategories.length >= 3;
                      
                      return (
                        <button
                          key={category.value}
                          onClick={() => {
                            if (isSelected) {
                              setPreferences({
                                ...preferences,
                                preferredCategories: preferences.preferredCategories.filter(c => c !== category.value)
                              });
                            } else if (!isDisabled) {
                              setPreferences({
                                ...preferences,
                                preferredCategories: [...preferences.preferredCategories, category.value as NewsletterCategory]
                              });
                            }
                          }}
                          disabled={isDisabled}
                          className={`
                            relative p-3 rounded-lg border transition-all duration-200 text-left
                            ${isSelected 
                              ? 'bg-purple-600/20 border-purple-500 text-white' 
                              : isDisabled
                                ? 'bg-gray-800/30 border-gray-700 text-gray-500 cursor-not-allowed'
                                : 'bg-gray-800/50 border-gray-600 text-gray-300 hover:bg-gray-700/50 hover:border-gray-500'
                            }
                          `}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{category.emoji}</span>
                            <span className="text-sm font-medium">{category.label}</span>
                          </div>
                          {isSelected && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="none" strokeWidth="2" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path>
                              </svg>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500">
                    You must select at least one category. Maximum 3 categories allowed per generation.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>

        {/* Save Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 flex justify-center"
        >
          <Button
            onClick={saveSettings}
            disabled={saving}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-3 text-lg"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-5 w-5" />
                Save All Settings
              </>
            )}
          </Button>
        </motion.div>
      </div>
    </div>
  );
}