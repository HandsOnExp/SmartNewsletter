# Gemini API Key Setup

## Current Issue
❌ **Gemini API key is invalid**: `AIzaSyAiBJ9yj26lmvIeibYygTjVwu_6APBHLyc`

## Quick Fix

### 1. Get New API Key
- Visit: https://makersuite.google.com/app/apikey
- Sign in with Google account  
- Click "Create API Key"
- Copy the generated key

### 2. Update .env.local
Replace this line in `.env.local`:
```bash
GEMINI_API_KEY=AIzaSyAiBJ9yj26lmvIeibYygTjVwu_6APBHLyc
```

With your new key:
```bash
GEMINI_API_KEY=YOUR_NEW_API_KEY_HERE
```

### 3. Restart Dev Server
```bash
npm run dev
```

## Testing
- Try generating a newsletter with Gemini model
- Should work without "Failed to parse AI response as JSON" error

## Note
- Gemini has 15 requests/minute free tier limit
- Cohere is working fine as fallback option