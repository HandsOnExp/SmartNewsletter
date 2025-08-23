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
import { Rss, Settings, Key, Bell, Save, Plus, Trash2, ArrowLeft, ExternalLink, X, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { RSS_FEEDS, type RSSFeed } from '@/config/rss-feeds';
import { UserSettings, CustomRSSFeed, TimePeriod } from '@/types';
import { TIME_PERIOD_OPTIONS } from '@/lib/rss-parser';

export default function SettingsPage() {
  const { user, isLoaded } = useUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingKey, setTestingKey] = useState<{ provider: string; testing: boolean }>({ provider: '', testing: false });
  const [showApiKeys, setShowApiKeys] = useState({
    cohere: false,
    gemini: false
  });
  
  const [feeds, setFeeds] = useState<RSSFeed[]>(RSS_FEEDS);
  const [customFeeds, setCustomFeeds] = useState<CustomRSSFeed[]>([]);
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [newFeedName, setNewFeedName] = useState('');
  
  const [apiKeys, setApiKeys] = useState({
    cohere: '',
    gemini: ''
  });
  
  const [preferences, setPreferences] = useState({
    autoGenerate: false,
    generateTime: '09:00',
    emailNotifications: true,
    llmPreference: 'cohere' as 'cohere' | 'gemini' | 'auto',
    maxArticles: 7,
    language: 'english' as 'english' | 'hebrew' | 'spanish' | 'french' | 'german' | 'italian' | 'portuguese',
    timePeriod: '24hours' as TimePeriod
  });

  // API Key management functions
  const openAPIKeyDashboard = (provider: 'cohere' | 'gemini') => {
    const urls = {
      cohere: 'https://dashboard.cohere.com/api-keys',
      gemini: 'https://makersuite.google.com/app/apikey'
    };
    window.open(urls[provider], '_blank');
  };

  const clearAPIKey = (provider: 'cohere' | 'gemini') => {
    setApiKeys(prev => ({
      ...prev,
      [provider]: ''
    }));
    toast.success(`${provider.charAt(0).toUpperCase() + provider.slice(1)} API key cleared`);
  };

  const toggleApiKeyVisibility = (provider: 'cohere' | 'gemini') => {
    setShowApiKeys(prev => ({
      ...prev,
      [provider]: !prev[provider]
    }));
  };

  const testAPIKey = async (provider: 'cohere' | 'gemini') => {
    const apiKey = apiKeys[provider];
    if (!apiKey) {
      toast.error(`Please enter ${provider} API key first`);
      return;
    }

    setTestingKey({ provider, testing: true });
    
    try {
      const response = await fetch('/api/test-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ provider, apiKey }),
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success(`${provider.charAt(0).toUpperCase() + provider.slice(1)} API key is working!`, {
          description: data.message
        });
      } else {
        toast.error(`${provider.charAt(0).toUpperCase() + provider.slice(1)} API key test failed`, {
          description: data.error
        });
      }
    } catch (error) {
      toast.error('Failed to test API key', {
        description: 'Network error or server unavailable'
      });
    } finally {
      setTestingKey({ provider: '', testing: false });
    }
  };

  useEffect(() => {
    if (user) {
      loadUserSettings();
    }
  }, [user]); // loadUserSettings is recreated on each render, which is fine for this use case

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
        return stored ? JSON.parse(stored) : null;
      } catch (error) {
        console.error('Failed to load from localStorage:', error);
        return null;
      }
    }
    return null;
  };

  const loadUserSettings = async () => {
    try {
      // First try to load from server
      const response = await fetch('/api/settings');
      let settingsLoaded = false;

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.settings) {
          const settings: UserSettings = data.data.settings;
          applySettings(settings);
          settingsLoaded = true;
        }
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

  const applySettings = (settings: UserSettings) => {
    setApiKeys(settings.apiKeys || { cohere: '', gemini: '' });
    setPreferences(settings.preferences || {
      autoGenerate: false,
      generateTime: '09:00',
      emailNotifications: true,
      llmPreference: 'cohere',
      maxArticles: 7,
      language: 'english',
      timePeriod: '24hours'
    });
    setCustomFeeds(settings.rssFeeds?.custom || []);
    
    // Update feed enabled/disabled status
    const enabledIds = settings.rssFeeds?.enabled || [];
    const updatedFeeds = RSS_FEEDS.map(feed => ({
      ...feed,
      enabled: enabledIds.includes(feed.id)
    }));
    setFeeds(updatedFeeds);
  };

  const applyDefaultSettings = () => {
    setApiKeys({ cohere: '', gemini: '' });
    setPreferences({
      autoGenerate: false,
      generateTime: '09:00',
      emailNotifications: true,
      llmPreference: 'cohere',
      maxArticles: 7,
      language: 'english',
      timePeriod: '24hours'
    });
    setCustomFeeds([]);
    
    // All feeds disabled by default
    const updatedFeeds = RSS_FEEDS.map(feed => ({
      ...feed,
      enabled: false
    }));
    setFeeds(updatedFeeds);
  };

  const toggleFeed = (feedId: string, enabled: boolean) => {
    setFeeds(prev => prev.map(feed => 
      feed.id === feedId ? { ...feed, enabled } : feed
    ));
  };

  const addCustomFeed = () => {
    if (!newFeedUrl || !newFeedName) {
      toast.error('Please enter both feed name and URL');
      return;
    }

    const newFeed: CustomRSSFeed = {
      id: `custom-${Date.now()}`,
      name: newFeedName,
      url: newFeedUrl,
      category: 'custom',
      enabled: true
    };

    setCustomFeeds(prev => [...prev, newFeed]);
    setNewFeedName('');
    setNewFeedUrl('');
    toast.success('Custom feed added successfully');
  };

  const removeCustomFeed = (feedId: string) => {
    setCustomFeeds(prev => prev.filter(feed => feed.id !== feedId));
    toast.success('Custom feed removed');
  };

  const toggleCustomFeed = (feedId: string, enabled: boolean) => {
    setCustomFeeds(prev => prev.map(feed => 
      feed.id === feedId ? { ...feed, enabled } : feed
    ));
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
          <TabsList className="grid w-full grid-cols-4 bg-gray-800/50">
            <TabsTrigger value="feeds" className="data-[state=active]:bg-purple-600">RSS Feeds</TabsTrigger>
            <TabsTrigger value="api" className="data-[state=active]:bg-purple-600">API Keys</TabsTrigger>
            <TabsTrigger value="preferences" className="data-[state=active]:bg-purple-600">Preferences</TabsTrigger>
            <TabsTrigger value="notifications" className="data-[state=active]:bg-purple-600">Notifications</TabsTrigger>
          </TabsList>

          <TabsContent value="feeds">
            <div className="space-y-6">
              {/* Default RSS Feeds */}
              <Card className="bg-gray-900/90 backdrop-blur-xl border-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center text-white">
                    <Rss className="mr-2 h-5 w-5" />
                    RSS Feed Management
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    Enable or disable RSS feeds for newsletter generation
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {feeds.map((feed) => (
                    <div key={feed.id} className="flex items-center justify-between p-4 border border-gray-700 rounded-lg bg-gray-800/50">
                      <div>
                        <h3 className="font-semibold text-white">{feed.name}</h3>
                        <p className="text-sm text-gray-400 capitalize">{feed.category}</p>
                        <p className="text-xs text-gray-500 mt-1">{feed.url}</p>
                      </div>
                      <Switch 
                        checked={!feed.enabled}
                        onCheckedChange={(checked) => toggleFeed(feed.id, !checked)}
                      />
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
                          checked={!feed.enabled}
                          onCheckedChange={(checked) => toggleCustomFeed(feed.id, !checked)}
                        />
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
                    <Label htmlFor="cohere-key" className="text-white">Cohere API Key (Free Tier)</Label>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => openAPIKeyDashboard('cohere')}
                        variant="outline"
                        size="sm"
                        className="bg-blue-500/20 border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white transition-colors"
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Get Key
                      </Button>
                      {apiKeys.cohere && (
                        <Button
                          onClick={() => testAPIKey('cohere')}
                          variant="outline"
                          size="sm"
                          disabled={testingKey.testing && testingKey.provider === 'cohere'}
                          className="bg-green-500/20 border-green-500 text-green-400 hover:bg-green-500 hover:text-white transition-colors disabled:opacity-50"
                        >
                          {testingKey.testing && testingKey.provider === 'cohere' ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-transparent border-t-current mr-1" />
                          ) : (
                            <CheckCircle className="h-4 w-4 mr-1" />
                          )}
                          Test Key
                        </Button>
                      )}
                      {apiKeys.cohere && (
                        <Button
                          onClick={() => clearAPIKey('cohere')}
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
                      id="cohere-key"
                      type={showApiKeys.cohere ? "text" : "password"}
                      placeholder="Enter your Cohere API key"
                      value={apiKeys.cohere}
                      onChange={(e) => setApiKeys({...apiKeys, cohere: e.target.value})}
                      className="bg-gray-800 border-gray-600 text-white pr-10"
                    />
                    {apiKeys.cohere && (
                      <Button
                        type="button"
                        onClick={() => toggleApiKeyVisibility('cohere')}
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-gray-400 hover:text-white"
                      >
                        {showApiKeys.cohere ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    Get your free key at dashboard.cohere.com • 1000 calls/month
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="gemini-key" className="text-white">Google Gemini API Key</Label>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => openAPIKeyDashboard('gemini')}
                        variant="outline"
                        size="sm"
                        className="bg-blue-500/20 border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white transition-colors"
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Get Key
                      </Button>
                      {apiKeys.gemini && (
                        <Button
                          onClick={() => testAPIKey('gemini')}
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
                          onClick={() => clearAPIKey('gemini')}
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
                        onClick={() => toggleApiKeyVisibility('gemini')}
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
                  <Label className="text-white">Default LLM Provider</Label>
                  <Select 
                    value={preferences.llmPreference}
                    onValueChange={(value: 'cohere' | 'gemini' | 'auto') => 
                      setPreferences({...preferences, llmPreference: value})
                    }
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cohere">Cohere (Fast, Free)</SelectItem>
                      <SelectItem value="gemini">Gemini</SelectItem>
                      <SelectItem value="auto">Auto-select based on limits</SelectItem>
                    </SelectContent>
                  </Select>
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
                    <Label className="text-white">Newsletter Topics</Label>
                    <span className="text-purple-400 font-semibold text-lg">
                      {preferences.maxArticles}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value={preferences.maxArticles}
                      onChange={(e) => setPreferences({...preferences, maxArticles: parseInt(e.target.value)})}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${((preferences.maxArticles - 1) / 19) * 100}%, #374151 ${((preferences.maxArticles - 1) / 19) * 100}%, #374151 100%)`
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
                    <span>10</span>
                    <span>20</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Number of topics to include in each generated newsletter
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
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card className="bg-gray-900/90 backdrop-blur-xl border-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center text-white">
                  <Bell className="mr-2 h-5 w-5" />
                  Notification Settings
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Configure how you receive updates
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-white">Email Notifications</Label>
                    <p className="text-sm text-gray-400">
                      Receive email when newsletter is ready
                    </p>
                  </div>
                  <Switch 
                    checked={preferences.emailNotifications}
                    onCheckedChange={(checked) => 
                      setPreferences({...preferences, emailNotifications: checked})
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-white">Generation Failures</Label>
                    <p className="text-sm text-gray-400">
                      Alert when generation fails
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-white">Weekly Summary</Label>
                    <p className="text-sm text-gray-400">
                      Weekly stats and insights
                    </p>
                  </div>
                  <Switch defaultChecked />
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