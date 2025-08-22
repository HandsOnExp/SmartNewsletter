'use client';

import { motion } from 'framer-motion';
import { TrendingUp, Sparkles, Clock, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { DashboardStats } from '@/types';

interface StatsCardsProps {
  stats: DashboardStats | null;
}

export function StatsCards({ stats }: StatsCardsProps) {
  // Provide default values if stats is null/undefined
  const safeStats = stats || {
    totalArticlesToday: 0,
    newslettersGenerated: 0,
    lastUpdateTime: 'Loading...',
    averageGenerationTime: '0s',
    topSources: [],
    recentActivity: []
  };

  const statCards = [
    { 
      icon: TrendingUp, 
      label: 'Articles Today', 
      value: safeStats.totalArticlesToday?.toString() || '0', 
      color: 'from-blue-500 to-cyan-500' 
    },
    { 
      icon: Sparkles, 
      label: 'Newsletters Generated', 
      value: safeStats.newslettersGenerated?.toString() || '0', 
      color: 'from-purple-500 to-pink-500' 
    },
    { 
      icon: Clock, 
      label: 'Last Update', 
      value: safeStats.lastUpdateTime || 'Never', 
      color: 'from-green-500 to-teal-500' 
    },
    { 
      icon: Zap, 
      label: 'Avg Generation Time', 
      value: safeStats.averageGenerationTime || '0s', 
      color: 'from-orange-500 to-red-500' 
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      {statCards.map((stat, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.1 }}
          whileHover={{ scale: 1.05 }}
          className="relative group"
        >
          <div className={`absolute -inset-0.5 bg-gradient-to-r ${stat.color} rounded-lg blur opacity-60 group-hover:opacity-100 transition duration-1000 group-hover:duration-200`}></div>
          <Card className="relative bg-gray-900 border-gray-800">
            <CardContent className="flex items-center p-6">
              <stat.icon className="h-12 w-12 text-white mr-4" />
              <div>
                <p className="text-sm text-gray-400">{stat.label}</p>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}