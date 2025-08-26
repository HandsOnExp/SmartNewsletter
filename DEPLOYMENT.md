# Smart Newsletter - Vercel Deployment Guide

## 🚀 Pre-Deployment Checklist

✅ **Code Ready**
- [x] Build passes successfully
- [x] No TypeScript errors
- [x] All dependencies installed
- [x] API routes properly structured

✅ **Configuration Files**
- [x] `vercel.json` created for function timeouts
- [x] `.gitignore` configured to exclude sensitive files
- [x] Environment variables documented

## 🔧 Required Environment Variables

Set these in your Vercel dashboard:

### Authentication (Clerk)
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_production_clerk_publishable_key
CLERK_SECRET_KEY=your_production_clerk_secret_key
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

### Database (MongoDB)
```
MONGODB_URI=your_production_mongodb_connection_string
```

### AI APIs
```
COHERE_API_KEY=your_production_cohere_api_key
GEMINI_API_KEY=your_production_gemini_api_key
GEMINI_TIER=free
```

### Security & Configuration
```
ENCRYPTION_KEY=your_secure_32_character_encryption_key
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

## 📋 Step-by-Step Deployment

### 1. Install Vercel CLI
```bash
npm i -g vercel
```

### 2. Login to Vercel
```bash
vercel login
```

### 3. Deploy
```bash
vercel
```

Follow the prompts:
- Link to existing project? **N** (first time)
- Project name? **smart-newsletter** (or your preferred name)
- Directory? **./** (current directory)
- Modify settings? **N**

### 4. Set Production Environment Variables
In your Vercel dashboard:
1. Go to your project
2. Navigate to Settings → Environment Variables
3. Add all the variables listed above
4. **Important**: Get production API keys, don't use development keys

### 5. Deploy to Production
```bash
vercel --prod
```

## 🔒 Security Considerations

### Before Deployment:
1. **Get Production API Keys**:
   - Clerk: Create production environment at https://dashboard.clerk.com
   - MongoDB: Use MongoDB Atlas production cluster
   - Cohere: Get production API key from https://cohere.com
   - Gemini: Get production API key from https://makersuite.google.com

2. **Generate Secure Encryption Key**:
   ```javascript
   // Use a 32+ character random string
   const crypto = require('crypto');
   console.log(crypto.randomBytes(32).toString('hex'));
   ```

3. **Configure Domains**:
   - Update Clerk allowed origins
   - Update MongoDB IP whitelist if needed

## ⚠️ Important Notes

- **API Keys**: Never use development API keys in production
- **MongoDB**: Use a production MongoDB Atlas cluster
- **Clerk**: Configure production domains and webhooks
- **Rate Limits**: Monitor AI API usage to avoid exceeding limits

## 🐛 Common Deployment Issues

### Build Fails
- Check all environment variables are set
- Verify MongoDB connection string format
- Ensure API keys are valid

### Authentication Issues
- Verify Clerk configuration for production domain
- Check NEXT_PUBLIC_CLERK_* variables are set

### API Timeouts
- Newsletter generation can take 30-60 seconds
- `vercel.json` configured with 60-second timeout for API routes

### MongoDB Connection
- Verify connection string includes database name
- Check IP whitelist allows Vercel's IPs (or use 0.0.0.0/0)

## 📊 Post-Deployment Testing

1. **Authentication**: Test sign-up and sign-in
2. **Newsletter Generation**: Generate a test newsletter
3. **RSS Feeds**: Verify feeds are loading
4. **Settings**: Test API key configuration
5. **Email**: Test newsletter email functionality

## 🔄 Continuous Deployment

Vercel automatically deploys when you push to your main branch. To deploy:

```bash
git add .
git commit -m "Deploy to production"
git push origin main
```

## 📞 Support

If you encounter issues:
1. Check Vercel deployment logs
2. Verify all environment variables
3. Test API endpoints individually
4. Check MongoDB connection and Clerk configuration