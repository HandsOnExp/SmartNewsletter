# MongoDB Setup Guide

## Current Status
- ✅ **App is working** with file-based storage fallback
- ⚠️ **MongoDB not connected** - Database features disabled  
- 🔧 **Quick setup needed** for full functionality

## Option 1: MongoDB Atlas (Recommended - FREE)

1. **Sign up** at [MongoDB Atlas](https://cloud.mongodb.com)
2. **Create cluster** (select free M0 tier)
3. **Create database user** with username/password
4. **Whitelist IP** (use 0.0.0.0/0 for development)
5. **Get connection string** from "Connect" button
6. **Update .env.local**:
   ```bash
   # Replace this line:
   MONGODB_URI=mongodb://localhost:27017/smart-newsletter-local
   
   # With your Atlas URI:
   MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/smart-newsletter?retryWrites=true&w=majority
   ```

## Option 2: Local MongoDB (Windows)

1. **Download** [MongoDB Community Server](https://www.mongodb.com/try/download/community)
2. **Install** with default settings (includes MongoDB as Windows Service)
3. **Verify installation**:
   ```bash
   mongod --version
   ```
4. **Start MongoDB service** (should auto-start)
5. **.env.local is already configured** for local connection

## Option 3: Keep File Storage (Current)

- App works without MongoDB using file-based storage
- Settings saved to `.temp-settings/` folder  
- Newsletter history not persisted
- Comment out MONGODB_URI in .env.local to remove warnings

## Testing Your Setup

After setting up MongoDB:
1. Restart the development server: `npm run dev`
2. Check console - no more "MONGODB_URI not found" warnings
3. Test settings page - should save/persist properly
4. Generate newsletter - gets saved to database

## Need Help?

- MongoDB Atlas has excellent documentation
- Local installation troubleshooting: [MongoDB Docs](https://docs.mongodb.com/manual/installation/)
- App works fine without MongoDB for testing purposes