import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { dev, isServer }) => {
    // Optimize webpack cache to handle large strings more efficiently
    config.cache = {
      ...config.cache,
      type: 'filesystem',
      maxMemoryGenerations: 0, // Don't keep generations in memory
      compression: 'gzip', // Compress cache files
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    };

    // Optimize module parsing for large content
    config.optimization = {
      ...config.optimization,
      moduleIds: 'deterministic',
      chunkIds: 'deterministic',
      // Prevent large strings from being inlined
      splitChunks: {
        ...config.optimization?.splitChunks,
        cacheGroups: {
          ...config.optimization?.splitChunks?.cacheGroups,
          largeContent: {
            test: /node_modules.*\.(rss|xml|txt)$/,
            name: 'large-content',
            chunks: 'all',
            enforce: true,
          },
        },
      },
    };

    // Add custom rules for large text files
    config.module.rules.push({
      test: /\.(txt|md|rss|xml)$/,
      type: 'asset/resource',
      generator: {
        filename: 'static/text/[hash][ext]'
      }
    });

    return config;
  },
  turbopack: {
    // Enable modern bundling optimizations
    rules: {
      '*.{rss,xml,txt}': {
        loaders: ['raw-loader'],
        as: '*.js'
      }
    }
  }
};

export default nextConfig;
