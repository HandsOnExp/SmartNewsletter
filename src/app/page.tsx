'use client';

import { useUser, UserButton } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Zap, ArrowRight, Bot, Newspaper } from 'lucide-react';

export default function Home() {
  const { user } = useUser();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900">
      <motion.div 
        className="absolute inset-0 opacity-30"
        animate={{
          background: [
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          ]
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          repeatType: "reverse"
        }}
      />
      
      <div className="relative z-10 container mx-auto px-4 py-16">
        {/* Top Navigation */}
        {user && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-between items-center mb-8"
          >
            <div></div>
            <UserButton afterSignOutUrl="/" />
          </motion.div>
        )}

        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-cyan-400 mb-6">
            Smart Newsletter
          </h1>
          <p className="text-2xl text-gray-300 mb-8 max-w-3xl mx-auto">
            Transform RSS feeds into stunning AI-powered newsletters in seconds. 
            Never miss important AI developments again.
          </p>
          
          {user && (
            <Button 
              onClick={() => window.location.href = '/dashboard'}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-4 text-lg font-semibold"
            >
              Go to Dashboard
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          )}
        </motion.div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {[
            {
              icon: Bot,
              title: "AI-Powered Curation",
              description: "Our AI analyzes RSS feeds and creates engaging, personalized newsletters with summaries and insights.",
              color: "from-blue-500 to-cyan-500"
            },
            {
              icon: Zap,
              title: "Lightning Fast",
              description: "Generate professional newsletters in under 30 seconds. No more manual curation or writing.",
              color: "from-purple-500 to-pink-500"
            },
            {
              icon: Newspaper,
              title: "Beautiful Templates",
              description: "Export ready-to-send HTML newsletters with modern designs and responsive layouts.",
              color: "from-green-500 to-teal-500"
            }
          ].map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.2 }}
              whileHover={{ scale: 1.05 }}
              className="relative group"
            >
              <div className={`absolute -inset-0.5 bg-gradient-to-r ${feature.color} rounded-lg blur opacity-60 group-hover:opacity-100 transition duration-1000 group-hover:duration-200`}></div>
              <Card className="relative bg-gray-900 border-gray-800 h-full">
                <CardContent className="p-6 text-center">
                  <feature.icon className="h-12 w-12 text-white mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                  <p className="text-gray-400">{feature.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* How It Works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold text-white mb-12">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Connect RSS Feeds",
                description: "Add your favorite AI news sources or use our curated list of top AI publications."
              },
              {
                step: "2", 
                title: "AI Processing",
                description: "Our AI analyzes articles, extracts key insights, and creates engaging summaries."
              },
              {
                step: "3",
                title: "Get Your Newsletter",
                description: "Receive a beautifully formatted newsletter ready to share or send to your audience."
              }
            ].map((step, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-white">{step.step}</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                <p className="text-gray-400">{step.description}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Demo Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center"
        >
          {[
            { label: "RSS Sources", value: "24+" },
            { label: "AI Models", value: "2" },
            { label: "Generation Time", value: "<30s" },
            { label: "Export Formats", value: "HTML" }
          ].map((stat, index) => (
            <div key={index} className="bg-gray-900/50 backdrop-blur-xl rounded-lg p-6 border border-gray-800">
              <div className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent mb-2">
                {stat.value}
              </div>
              <div className="text-gray-400">{stat.label}</div>
            </div>
          ))}
        </motion.div>

      </div>
    </div>
  );
}
