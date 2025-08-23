# MongoDB Atlas Permissions Fix

## Critical Issue
❌ **MongoDB user lacks write permissions**:
```
MongoServerError: user is not allowed to do action [insert] on [smart-newsletter.newsletters]
```

## Quick Fix Steps

### 1. Update MongoDB Atlas User Permissions
1. **Go to** [MongoDB Atlas Dashboard](https://cloud.mongodb.com)
2. **Click** your cluster → "Database Access"
3. **Find user** `claude-user`
4. **Click "Edit"**
5. **Change permissions** from "Read only" to:
   - **Option A**: `Atlas admin` (easiest)
   - **Option B**: `Read and write to any database`
   - **Option C**: Custom role with read/write on `smart-newsletter` database

### 2. Alternative: Create New User
If editing doesn't work:
1. **Delete** current `claude-user`
2. **Create new user** with proper permissions:
   - Username: `claude-user` 
   - Password: `L_6B7MKvM1ZjbuGRX3QFXg`
   - Role: **Read and write to any database**

### 3. Wait for Changes
- **Atlas updates** can take 1-2 minutes
- **Restart** your app after changes

## Verification
After fixing permissions, newsletter generation should work without database errors.