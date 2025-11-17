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

### AI APIs - User Provided Keys
```
# No server-side AI API keys needed!
# Users provide their own Gemini API key via Settings page
# Get your free Gemini API key at: https://makersuite.google.com/app/apikey

# Model Information:
# - Uses gemini-1.5-flash (stable model with good free tier quotas)
# - Free tier limits: 15 requests per minute, 1 million tokens per day
# - Automatic retry logic with exponential backoff for rate limits
# - For higher limits, users can upgrade at: https://ai.google.dev/pricing
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

### 4. Update Production Environment Variables
In your Vercel dashboard:
1. Go to your project
2. Navigate to Settings → Environment Variables
3. **REMOVE these obsolete variables:**
   - `GEMINI_API_KEY` (delete completely)
   - `GEMINI_TIER` (delete completely) 
   - `COHERE_API_KEY` (if present, delete completely)
4. **KEEP these required variables:**
   - All Clerk authentication variables
   - `MONGODB_URI`
   - `ENCRYPTION_KEY`
   - `NEXT_PUBLIC_APP_URL`

### 5. Deploy to Production
```bash
vercel --prod
```

## 🔒 Security Considerations

### Before Deployment:
1. **Get Production Keys**:
   - Clerk: Create production environment at https://dashboard.clerk.com
   - MongoDB: Use MongoDB Atlas production cluster
   - **No AI API keys needed** - Users provide their own Gemini API key

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

- **User API Keys**: Each user provides their own Gemini API key for cost control
- **MongoDB**: Use a production MongoDB Atlas cluster
- **Clerk**: Configure production domains and webhooks
- **No Server AI Costs**: Users pay for their own API usage through their keys

## 🐛 Common Deployment Issues

### Build Fails
- Check all environment variables are set
- Verify MongoDB connection string format
- Ensure no obsolete AI API keys are set (users provide their own)

### Authentication Issues
- Verify Clerk configuration for production domain
- Check NEXT_PUBLIC_CLERK_* variables are set

### API Timeouts
- Newsletter generation can take 30-60 seconds
- `vercel.json` configured with 60-second timeout for API routes

### MongoDB Connection
- Verify connection string includes database name
- Check IP whitelist allows Vercel's IPs (or use 0.0.0.0/0)

### Gemini API Quota Errors
If users encounter "quota exceeded" or "429 Too Many Requests" errors:
1. **Free Tier Limits**: gemini-1.5-flash has 15 requests/minute, 1M tokens/day
2. **Solutions**:
   - Wait a few minutes for quota to reset
   - Get a new API key at https://makersuite.google.com/app/apikey
   - Upgrade to paid tier at https://ai.google.dev/pricing
3. **Automatic Retry**: The app automatically retries with exponential backoff
4. **Model Stability**: Using stable gemini-1.5-flash (not experimental models)

## 📊 Post-Deployment Testing

1. **Authentication**: Test sign-up and sign-in
2. **API Key Setup**: Verify new users see API key warning banner
3. **Settings**: Test API key configuration and validation
4. **Newsletter Generation**: Test with user-provided API key
5. **RSS Feeds**: Verify feeds are loading
6. **Email**: Test newsletter email functionality

## 🔄 Continuous Deployment

Vercel automatically deploys when you push to your main branch. To deploy:

```bash
git add .
git commit -m "Deploy to production"
git push origin main
```

## 🔄 Migrating from Server-Side to User-Provided API Keys

If you're updating from the previous version that used server-side API keys:

### Step 1: Update Vercel Environment Variables
1. **Access Vercel Dashboard**: Go to https://vercel.com/dashboard
2. **Select Your Project**: Click on your smart newsletter project
3. **Go to Settings**: Click Settings → Environment Variables
4. **Delete Obsolete Variables**:
   - Find and delete `GEMINI_API_KEY`
   - Find and delete `GEMINI_TIER` 
   - Find and delete `COHERE_API_KEY` (if present)
5. **Click Save**: Vercel will automatically redeploy

### Step 2: Verify Deployment
1. **Check Build Logs**: Ensure the build completes successfully
2. **Test New User Flow**: 
   - Create a new account
   - Verify the API key warning banner appears
   - Test adding an API key in Settings
3. **Test Newsletter Generation**: Confirm it works with user-provided keys

### Step 3: Communicate with Existing Users
- Existing users will need to add their own Gemini API key
- They'll see the warning banner guiding them through setup
- No action needed from you - the UI handles user onboarding

## 📞 Support

If you encounter issues:
1. Check Vercel deployment logs
2. Verify all environment variables
3. Test API endpoints individually
4. Check MongoDB connection and Clerk configuration