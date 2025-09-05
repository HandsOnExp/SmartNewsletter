# 🤖 Smart Newsletter

> **Transform RSS feeds into stunning AI-powered newsletters in seconds**

## 🚀 **[LIVE DEMO](https://smart-news-letter.vercel.app)** 
> Experience the full app functionality with pre-configured API keys. Generate demo newsletters to explore all features!

An intelligent newsletter generation platform that leverages advanced AI algorithms to curate, analyze, and format RSS content into beautiful, engaging newsletters. Never miss important AI developments again with our automated content curation system.

## ✨ Features

### 🧠 **AI-Powered Content Curation**
- **Dual AI Engine Support**: Choose between Cohere and Google Gemini for content analysis
- **Performance-Optimized AI**: Automatic fallback from Cohere to Gemini on timeout, intelligent provider switching
- **Background Processing**: Optional background generation for longer requests without timeout issues
- **Intelligent Summarization**: Complex AI topics distilled into clear, engaging content
- **Smart Topic Selection**: AI analyzes RSS feeds and intelligently selects 1-8 topics based on importance, relevance, and quality (recommended: 5-7 for optimal engagement)
- **Multi-language Support**: Generate newsletters in English, Hebrew, Spanish, French, German, Italian, and Portuguese
- **Quality Scoring Algorithm**: Advanced topic ranking system that prioritizes breakthrough announcements, model releases, and practical applications

### 📰 **Professional Newsletter Generation**
- **Beautiful HTML Export**: Ready-to-send newsletter templates with responsive design
- **Smart Content Optimization**: AI automatically trims and optimizes content for maximum engagement
- **Advanced Content Extraction**: Full article content fetching with quality scoring and enhanced context
- **Source Diversity Control**: Prevents single-source domination with balanced representation across categories
- **URL Deduplication**: Prevents duplicate URLs across topics, ensures content accuracy
- **Rich Media Integration**: Automatic image generation and placeholder integration
- **Performance Optimized**: Advanced caching system for faster generation times (sub-30s with Gemini, sub-50s with Cohere+fallback)
- **URL Validation**: Comprehensive link verification prevents broken URLs in newsletters
- **Fast Mode Processing**: Optimized prompts and processing for time-sensitive generation
- **Feed Blacklist Management**: Automatic exclusion of problematic feeds with subscription requirements or access restrictions

### 🔧 **Developer-Friendly Architecture**
- **Modern Tech Stack**: Built with Next.js 15, React 19, TypeScript, and TailwindCSS
- **Authentication**: Secure user management with Clerk
- **Database**: MongoDB integration with Mongoose ODM
- **Security**: Built-in secrets detection and security scanning
- **Performance**: Optimized with Turbopack and advanced caching strategies

### 📊 **Analytics & Management**
- **Dashboard Interface**: Clean, intuitive dashboard for newsletter management with demo banner
- **Performance Monitoring**: Real-time LLM performance tracking with automatic provider switching
- **Feed Performance Tracking**: Monitor RSS feed reliability, response times, and content quality
- **Generation Statistics**: Track sources analyzed, generation time, and AI model usage
- **RSS Feed Management**: Curated list of high-quality AI publications with automatic blacklist filtering
- **Content Preview**: Review and edit newsletters before export
- **Newsletter History**: View and manage previously generated newsletters with delete functionality
- **Background Generation**: Real-time progress tracking for long-running newsletter generation
- **Trend Analysis**: Advanced topic trend detection and freshness scoring

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- MongoDB database
- API keys for Cohere and/or Google Gemini
- Clerk account for authentication

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/HandsOnExp/SmartNewsletter.git
   cd smart-news-letter
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory:
   ```env
   # Authentication
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
   CLERK_SECRET_KEY=your_clerk_secret_key
   
   # Database
   MONGODB_URI=your_mongodb_connection_string
   
   # AI APIs
   COHERE_API_KEY=your_cohere_api_key
   GEMINI_API_KEY=your_gemini_api_key
   
   # Optional: Set to 'free' for free tier limitations
   GEMINI_TIER=free
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🏗️ Architecture

### Tech Stack
- **Frontend**: Next.js 15, React 19, TypeScript, TailwindCSS
- **UI Components**: Radix UI primitives with custom styling
- **Authentication**: Clerk for secure user management
- **Database**: MongoDB with Mongoose ODM
- **AI Integration**: Cohere and Google Gemini APIs
- **Styling**: TailwindCSS with Framer Motion animations
- **Development**: ESLint, TypeScript, Turbopack

### Key Components

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API endpoints
│   │   ├── newsletter/    # Newsletter generation endpoints
│   │   ├── settings/      # User settings management
│   │   └── dashboard/     # Analytics endpoints
│   ├── dashboard/         # Dashboard pages
│   └── settings/          # Settings pages
├── components/            # Reusable UI components
│   ├── ui/               # Base UI components
│   ├── dashboard/        # Dashboard-specific components
│   └── newsletter/       # Newsletter-specific components
├── config/               # Configuration files
│   ├── prompts.ts        # AI prompt templates
│   ├── rss-feeds.ts      # Curated RSS feed sources
│   └── feed-blacklist.ts # Blacklisted feed management
├── lib/                  # Core utilities
│   ├── ai-processors.ts  # AI integration logic
│   ├── rss-parser.ts     # RSS feed parsing
│   ├── content-extractor.ts # Advanced content extraction
│   ├── source-diversity.ts  # Source balancing and diversity
│   ├── feed-performance-tracker.ts # Feed reliability monitoring
│   ├── trend-analyzer.ts # Topic trend analysis
│   ├── freshness-scorer.ts # Content freshness scoring
│   ├── crypto.ts         # Security utilities
│   └── db.ts            # Database connection
└── utils/               # Helper utilities
    └── cache-optimization.ts  # Advanced caching system
```

## 🧠 Smart Topic Selection Algorithm

The AI uses an advanced multi-layered system to identify the most valuable content with balanced source representation:

### Quality Scoring Factors
- **Content Extraction**: Full article content analysis with reading time and word count assessment
- **Source Diversity**: Prevents single-source domination through balanced category representation
- **Content Quality**: Advanced quality scoring (0-110) based on length, freshness, authority, and engagement
- **Trend Analysis**: Identifies trending topics and emerging themes in AI development
- **Category Priority**: Research and product announcements get priority weighting
- **Freshness Scoring**: Recent articles receive preference with time-decay algorithms
- **Impact Keywords**: "breakthrough", "major", "announced", "released" boost scores
- **Authority Weighting**: IEEE Spectrum, arXiv, and academic sources receive higher trust scores

### Selection Process
1. **RSS Analysis**: Processes up to 100 articles from enabled feeds with blacklist filtering
2. **Content Extraction**: Fetches full article content for enhanced context and quality assessment  
3. **Source Diversity Control**: Ensures balanced representation across sources and categories
4. **AI Curation**: Uses enhanced prompts to identify key developments with trend analysis
5. **Quality Scoring**: Multi-factor ranking with diversity penalties for over-represented sources
6. **Smart Trimming**: Maintains optimal topic count while preserving source diversity
7. **Fallback Handling**: Automatic blacklist management and feed performance monitoring

### Topic Count Recommendations
- **1-3 topics**: Perfect for focused, daily updates
- **4-5 topics**: Ideal for regular digest newsletters
- **6-7 topics**: Optimal for weekly comprehensive newsletters (recommended)
- **8 topics**: Maximum coverage for comprehensive industry roundups

## 📡 API Endpoints

### Newsletter Generation
- `POST /api/newsletter/generate` - Generate newsletter content with automatic fallback
- `POST /api/newsletter/generate-background` - Background newsletter generation with progress tracking
- `GET /api/newsletter/generate-background?jobId=<id>` - Check background job status
- `POST /api/newsletter/generate-html` - Export newsletter as HTML
- `GET /api/newsletters` - List user newsletters
- `GET /api/newsletters/[id]` - Get specific newsletter

### RSS Management
- `POST /api/rss/refresh` - Refresh RSS feed data
- `POST /api/feeds/enable-all` - Enable all RSS feeds
- `POST /api/feeds/disable-all` - Disable all RSS feeds

### Analytics
- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/categories` - Get feed categories and performance metrics

### Settings
- `GET /api/settings` - Get user settings
- `POST /api/settings` - Update user settings

### Administration
- `POST /api/admin/cleanup` - Database cleanup and maintenance
- `POST /api/admin/fix-categories` - Fix feed category assignments
- `POST /api/admin/reset-feeds` - Reset feed configurations
- `POST /api/admin/reset-user-settings` - Reset user settings to defaults

### Testing & Development  
- `GET /api/test-db` - Test database connection
- `POST /api/test-key` - Test API key functionality
- `GET /api/test/crypto-test` - Test encryption utilities

## 🎨 Customization

### Current RSS Feed Sources
The system includes carefully curated, bot-friendly RSS feeds with automatic blacklist management:

**Business**: TechCrunch AI, VentureBeat AI, Enterprise AI News  
**Technology**: IEEE Spectrum AI, WIRED AI  
**Research**: Google AI Blog, arXiv AI Papers, Distill ML Research  
**Product**: OpenAI Blog, MarkTechPost  
**Enterprise**: NVIDIA AI Blog, AI Business  
**Consumer**: AI News, Analytics India Magazine AI  
**Security**: Dark Reading, Security Week  
**Development**: Hacker News, DEV Community  

**Blacklist Management**: Automatically excludes feeds with subscription requirements, access restrictions, or parsing issues  

### Adding RSS Feeds
Edit `src/config/rss-feeds.ts` to add new RSS sources:

```typescript
{
  id: 'your-feed-id',
  name: 'Feed Name',
  url: 'https://example.com/rss',
  category: 'business',
  priority: 1,
  enabled: true
}
```

**Note**: All feeds are tested for bot accessibility and content quality to prevent 403 errors and parsing failures.

### Customizing AI Prompts
Modify `src/config/prompts.ts` to adjust AI behavior:
- Writing style and tone
- Content structure
- Language-specific instructions
- Output formatting
- Quality scoring criteria

### Topic Selection Tuning
Adjust the quality scoring algorithm in `src/lib/ai-processors.ts`:
```typescript
// Customize scoring factors
const categoryBonus = {
  'research': 15,
  'product': 10,
  'business': 8,
  'policy': 5,
  'security': 12,
  'fun': 3
};
```

### Source Diversity Configuration
Customize source balancing in `src/lib/source-diversity.ts`:
```typescript
const diversityConfig: DiversityConfig = {
  maxArticlesPerSource: 2,
  maxArticlesPerCategory: 3,
  maxArticlesPerDomain: 2,
  prioritizeFreshness: true,
  diversityWeight: 0.7,
  sourceRotationEnabled: true
};
```

### Feed Blacklist Management
Manage problematic feeds in `src/config/feed-blacklist.ts`:
```typescript
// Add feeds with subscription requirements or access issues
{
  id: 'problematic-feed',
  reason: 'Requires subscription',
  dateBlacklisted: '2025-09-05',
  category: 'business'
}
```

### UI Theming
The application uses TailwindCSS with custom color schemes:
- **Primary**: Purple to pink gradients
- **Accent**: Cyan and blue tones
- **Background**: Dark mode with glass morphism effects

## 🔒 Security

- **Secrets Detection**: Automated scanning with `detect-secrets`
- **Authentication**: Secure session management with Clerk
- **Input Validation**: Zod schema validation for API endpoints
- **URL Validation**: HTTP health checks prevent malicious or broken links
- **Rate Limiting**: Built-in rate limiting for API endpoints
- **Environment Variables**: Secure configuration management

### Security Commands
```bash
# Check for secrets before committing
npm run check-secrets

# Run security audit
npm audit

# Build with security checks
npm run build
```

## 🧪 Development

### Available Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production  
npm run start        # Start production server
npm run lint         # Run ESLint
npm run check-secrets # Scan for secrets
```

### Development Workflow
1. **Feature Development**: Create feature branches for new functionality
2. **Security First**: Run `npm run check-secrets` before every commit
3. **Build Testing**: Use `npm run build` to test production builds
4. **Code Quality**: Maintain TypeScript strict mode and ESLint compliance

### Debugging
- **AI Responses**: Check console logs for AI processing details
- **Topic Selection**: Enable verbose logging to see scoring decisions
- **RSS Parsing**: Use verbose logging in RSS parser
- **Database**: Use MongoDB Compass for database inspection
- **Authentication**: Use Clerk dashboard for user management

## 🌐 Deployment

### Environment Setup
1. **Production Database**: Set up MongoDB Atlas or self-hosted instance
2. **AI API Keys**: Obtain production keys for Cohere/Gemini
3. **Authentication**: Configure Clerk for production domain
4. **Environment Variables**: Set all required variables in your deployment platform

### Recommended Platforms
- **Vercel**: Optimized for Next.js applications
- **Railway**: Great for full-stack applications
- **AWS/GCP/Azure**: For enterprise deployments

### Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

## 📊 Performance

### Optimization Features
- **Advanced Caching**: Intelligent caching of AI responses and RSS data
- **Lazy Loading**: Efficient content loading strategies
- **Bundle Optimization**: Turbopack for faster builds
- **Memory Management**: Chunked processing for large RSS feeds
- **Smart Batching**: Optimized API calls to reduce latency

### Performance Metrics
- **Newsletter Generation**: 
  - Gemini: 15-25 seconds average
  - Cohere: 25-35 seconds average (with 30s timeout + automatic Gemini fallback)
  - Background Mode: No timeout limitations
- **RSS Parsing**: Supports 115+ articles per session with intelligent batching (20 URLs per batch)
- **Content Extraction**: Advanced full-article content fetching with quality scoring
- **Source Diversity**: Balanced article selection across sources and categories
- **Memory Usage**: Optimized for serverless environments with LazyContent loading and chunked processing
- **Cache Hit Rate**: ~80% for repeated content requests
- **Topic Selection**: Processes and scores articles in under 5 seconds with trend analysis
- **URL Validation**: Fast batch processing with 5-second timeout per URL
- **Feed Reliability**: Automatic blacklist management and performance monitoring
- **Performance Monitoring**: Real-time LLM success rates, response time tracking, and feed health monitoring

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Follow security practices**: Run `npm run check-secrets`
4. **Test your changes**: Ensure build passes with `npm run build`
5. **Commit your changes**: Use conventional commit messages
6. **Push to your branch**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**

### Development Guidelines
- **TypeScript**: Maintain strict type safety
- **Testing**: Add tests for new features
- **Documentation**: Update README for API changes
- **Security**: Never commit secrets or API keys

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙋‍♂️ Support

### Getting Help
- **GitHub Issues**: Report bugs and request features
- **Documentation**: Check this README and inline code comments
- **Community**: Join discussions in GitHub Discussions

### Common Issues
- **API Key Errors**: Verify your Cohere/Gemini API keys are valid
- **Database Connection**: Check MongoDB connection string format
- **Build Failures**: Ensure all environment variables are set
- **Authentication Issues**: Verify Clerk configuration
- **Topic Selection**: System now includes advanced quality scoring and source diversity controls
- **Timeout Issues**: Use background generation for Cohere, or let automatic fallback handle it
- **RSS Feed Errors**: Automatic blacklist management handles subscription-required and problematic feeds
- **Content Quality**: Enhanced content extraction now fetches full article content for better summaries
- **Source Diversity**: Prevents single-source domination with balanced representation controls
- **Feed Performance**: Real-time monitoring tracks feed reliability and automatically adjusts priorities
- **Duplicate URLs**: Advanced deduplication with cross-source validation ensures unique content
- **Parsing Failures**: Automatic error handling and feed blacklisting for consistently problematic sources

---

<div align="center">

**Built with ❤️ using Next.js, TypeScript, and AI**

*Transform your RSS feeds into beautiful, intelligently curated newsletters today!*

[🚀 Get Started](#-quick-start) • [📖 Documentation](#-architecture) • [🤝 Contributing](#-contributing)

</div>
