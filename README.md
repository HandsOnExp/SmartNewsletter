# 🤖 Smart Newsletter

> **Transform RSS feeds into stunning AI-powered newsletters in seconds**

## 🚀 **[LIVE DEMO](https://smart-news-letter.vercel.app)** 
> Experience the full app functionality with pre-configured API keys. Generate demo newsletters to explore all features!

An intelligent newsletter generation platform that leverages advanced AI algorithms to curate, analyze, and format RSS content into beautiful, engaging newsletters. Never miss important AI developments again with our automated content curation system.

## ✨ Features

### 🧠 **AI-Powered Content Curation**
- **Dual AI Engine Support**: Choose between Cohere and Google Gemini for content analysis
- **Intelligent Summarization**: Complex AI topics distilled into clear, engaging content
- **Smart Topic Selection**: AI analyzes RSS feeds and intelligently selects 1-20 topics based on importance, relevance, and quality (recommended: 5-7 for optimal engagement)
- **Multi-language Support**: Generate newsletters in English, Hebrew, Spanish, French, German, Italian, and Portuguese
- **Quality Scoring Algorithm**: Advanced topic ranking system that prioritizes breakthrough announcements, model releases, and practical applications

### 📰 **Professional Newsletter Generation**
- **Beautiful HTML Export**: Ready-to-send newsletter templates with responsive design
- **Smart Content Optimization**: AI automatically trims and optimizes content for maximum engagement
- **Rich Media Integration**: Automatic image generation and placeholder integration
- **Performance Optimized**: Advanced caching system for faster generation times
- **URL Validation**: Comprehensive link verification prevents broken URLs in newsletters

### 🔧 **Developer-Friendly Architecture**
- **Modern Tech Stack**: Built with Next.js 15, React 19, TypeScript, and TailwindCSS
- **Authentication**: Secure user management with Clerk
- **Database**: MongoDB integration with Mongoose ODM
- **Security**: Built-in secrets detection and security scanning
- **Performance**: Optimized with Turbopack and advanced caching strategies

### 📊 **Analytics & Management**
- **Dashboard Interface**: Clean, intuitive dashboard for newsletter management with demo banner
- **Generation Statistics**: Track sources analyzed, generation time, and AI model usage
- **RSS Feed Management**: Curated list of 24+ top AI publications across 8 categories
- **Content Preview**: Review and edit newsletters before export
- **Newsletter History**: View and manage previously generated newsletters with delete functionality

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
│   └── rss-feeds.ts      # Curated RSS feed sources
├── lib/                  # Core utilities
│   ├── ai-processors.ts  # AI integration logic
│   ├── rss-parser.ts     # RSS feed parsing
│   ├── crypto.ts         # Security utilities
│   └── db.ts            # Database connection
└── utils/               # Helper utilities
    └── cache-optimization.ts  # Caching system
```

## 🧠 Smart Topic Selection Algorithm

The AI doesn't just pick random articles - it uses a sophisticated scoring system to identify the most valuable content:

### Quality Scoring Factors
- **Content Quality**: Longer, more detailed summaries score higher
- **Category Priority**: Research and product announcements get priority
- **Freshness**: More recent articles receive preference
- **Impact Keywords**: "breakthrough", "major", "announced", "released" boost scores
- **Position Bias**: Earlier AI-suggested topics get slight preference

### Selection Process
1. **RSS Analysis**: Processes up to 100 articles from enabled feeds
2. **AI Curation**: Uses advanced prompts to identify key developments
3. **Quality Scoring**: Ranks topics using multi-factor algorithm
4. **Smart Trimming**: If AI generates too many topics, keeps only the highest-scoring ones
5. **Fallback Handling**: Ensures minimum content quality even with limited sources

### Topic Count Recommendations
- **1-3 topics**: Perfect for focused, daily updates
- **5-7 topics**: Optimal for weekly comprehensive newsletters (recommended)
- **10-15 topics**: Suitable for research digests or industry roundups
- **16-20 topics**: Best for comprehensive coverage or less frequent publications

## 📡 API Endpoints

### Newsletter Generation
- `POST /api/newsletter/generate` - Generate newsletter content
- `POST /api/newsletter/generate-html` - Export newsletter as HTML
- `GET /api/newsletters` - List user newsletters
- `GET /api/newsletters/[id]` - Get specific newsletter

### RSS Management
- `POST /api/rss/refresh` - Refresh RSS feed data

### Analytics
- `GET /api/dashboard/stats` - Get dashboard statistics

### Settings
- `GET /api/settings` - Get user settings
- `POST /api/settings` - Update user settings

## 🎨 Customization

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
- **Newsletter Generation**: < 30 seconds average
- **RSS Parsing**: Supports 100+ articles per feed
- **Memory Usage**: Optimized for serverless environments
- **Cache Hit Rate**: ~80% for repeated content requests
- **Topic Selection**: Processes and scores articles in under 5 seconds

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
- **Topic Selection**: Check RSS feeds are returning recent articles

---

<div align="center">

**Built with ❤️ using Next.js, TypeScript, and AI**

*Transform your RSS feeds into beautiful, intelligently curated newsletters today!*

[🚀 Get Started](#-quick-start) • [📖 Documentation](#-architecture) • [🤝 Contributing](#-contributing)

</div>
