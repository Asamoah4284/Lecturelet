# Firestore Index Setup Guide

## Current Status

The server is running, but you may see a warning about a missing Firestore index. This is **normal** and **non-critical**.

## Index Required (Optional)

The `resetExpiredTemporaryEdits` function queries courses with:
- `temporaryEditExpiresAt <= now`
- `originalValues != null`

**Status:** ✅ **FIXED** - The code now handles this gracefully without requiring an index.

## How to Create Index (If Needed Later)

If you want to optimize the query, you can create the index:

1. **Automatic Method (Recommended):**
   - The error message includes a direct link
   - Click the link in the error message
   - Firebase will create the index automatically

2. **Manual Method:**
   - Go to Firebase Console: https://console.firebase.google.com/project/lecturelet-c03be/firestore/indexes
   - Click "Create Index"
   - Collection: `courses`
   - Fields:
     - `originalValues` - Ascending
     - `temporaryEditExpiresAt` - Ascending
   - Click "Create"

## Current Solution

The code has been updated to:
- ✅ Query only by `temporaryEditExpiresAt` (no index needed)
- ✅ Filter `originalValues` in memory
- ✅ Handle errors gracefully (server won't crash)
- ✅ Log warning instead of crashing

## Other Potential Indexes

Firestore may request indexes for other queries. When you see an error with a link:
1. Click the link
2. Firebase will create the index automatically
3. Wait a few minutes for it to build
4. The query will work automatically

## Indexes That May Be Needed

### 1. Courses Collection
- **Query:** `temporaryEditExpiresAt <= now AND originalValues != null`
- **Status:** ✅ Handled in code (no index needed)

### 2. Enrollments Collection
- **Query:** `userId == X AND courseId == Y` (for unique constraint)
- **Status:** ✅ Using composite document ID (no index needed)

### 3. Notifications Collection
- **Query:** `userId == X AND isRead == false ORDER BY createdAt DESC`
- **Status:** May need index if you have many notifications

### 4. Device Tokens Collection
- **Query:** `userId == X AND isActive == true`
- **Status:** ✅ Single field equality (no index needed)

## Summary

**You don't need to create any indexes right now.** The code handles the query gracefully. If Firebase requests an index in the future, just click the link in the error message.
