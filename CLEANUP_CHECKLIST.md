# MongoDB to Firebase Migration - Cleanup Checklist

## ✅ Completed

### Core Migration
- ✅ Firebase Admin SDK configured
- ✅ Firebase Client SDK configured
- ✅ Firestore services created (users, courses, enrollments, notifications, deviceTokens, colleges)
- ✅ Authentication migrated to Firebase Auth
- ✅ Core routes migrated (auth, courses, enrollments, notifications)
- ✅ FCM push notification service created
- ✅ Server updated to initialize Firebase instead of MongoDB

## 🧹 Cleanup Tasks

### 1. Remove MongoDB Dependencies

#### Backend `package.json`
```bash
npm uninstall mongoose
```

**File:** `backend/package.json`
- Remove `"mongoose": "^8.20.1"` from dependencies

### 2. Remove MongoDB Environment Variables

**File:** `backend/.env`
Remove or comment out:
```
# MONGODB_URI=mongodb+srv://...
# USERNAME=...
# PASSWORD=...
```

### 3. Remove MongoDB Model Files

**Directory:** `backend/src/models/`

Files to remove:
- ✅ `User.js` (replaced by `services/firestore/users.js`)
- ✅ `Course.js` (replaced by `services/firestore/courses.js`)
- ✅ `Enrollment.js` (replaced by `services/firestore/enrollments.js`)
- ✅ `Notification.js` (replaced by `services/firestore/notifications.js`)
- ✅ `DeviceToken.js` (replaced by `services/firestore/deviceTokens.js`)
- ✅ `College.js` (replaced by `services/firestore/colleges.js`)
- ⚠️ `Payment.js` (still used by payments route - migrate first)
- ⚠️ `Quiz.js` (still used by quizzes route - migrate first)
- ⚠️ `Assignment.js` (still used by assignments route - migrate first)
- ⚠️ `Tutorial.js` (still used by tutorials route - migrate first)
- ⚠️ `Feedback.js` (still used by feedback route - migrate first)
- ⚠️ `SmsLog.js` (may still be used - check)

**File:** `backend/src/models/index.js`
- Remove exports for migrated models
- Keep only models that still need migration

### 4. Remove MongoDB Connection Files

**File:** `backend/src/config/database.js`
- Can be deleted (no longer needed)

**File:** `backend/src/database/init.js`
- Can be deleted or updated to use Firestore initialization

**File:** `backend/src/database/seed.js`
- Can be deleted or updated to use Firestore seeding

### 5. Update Utility Functions

**Files to update:**
- `backend/src/utils/temporaryEditReset.js` - Update to use Firestore
- `backend/src/utils/classReminderJob.js` - Update to use Firestore
- `backend/src/utils/deviceTokenCleanup.js` - Update to use Firestore

**Current status:**
- These files may still reference MongoDB models
- Need to update imports and queries

### 6. Remove Old Push Notification Service

**File:** `backend/src/utils/pushNotificationService.js`
- This uses Expo SDK
- Can be removed after confirming FCM service works
- **Note:** Keep until FCM is fully tested

### 7. Update Package Scripts

**File:** `backend/package.json`

Remove or update:
```json
{
  "scripts": {
    "db:init": "node src/database/init.js",  // Remove or update
    "db:seed": "node src/database/seed.js"   // Remove or update
  }
}
```

### 8. Search for Remaining MongoDB References

Run these searches to find any remaining MongoDB references:

```bash
# Search for mongoose imports
grep -r "require.*mongoose" backend/src/

# Search for MongoDB references
grep -r "MongoDB\|mongodb\|mongoose" backend/src/ --exclude-dir=node_modules

# Search for model imports
grep -r "require.*models" backend/src/routes/
```

### 9. Update Documentation

**Files to update:**
- `backend/README.md` - Update database section
- `APP_STORE_REVIEW_DOCUMENTATION.md` - Update database references
- Any other documentation mentioning MongoDB

### 10. Test All Endpoints

Before removing files, test:
- ✅ Authentication (login, signup)
- ✅ Courses (create, read, update, delete)
- ✅ Enrollments (join, list, unenroll)
- ✅ Notifications (send, read, delete)
- ⚠️ Payments (if still using MongoDB)
- ⚠️ Quizzes, Assignments, Tutorials, Feedback (if still using MongoDB)

## ⚠️ Important Notes

1. **Don't delete model files yet** - Secondary routes (payments, quizzes, etc.) still use them
2. **Test thoroughly** - Ensure all core functionality works before cleanup
3. **Keep backups** - Consider keeping old files in a backup branch
4. **Gradual migration** - Migrate secondary routes before removing their models

## Verification Commands

After cleanup, verify no MongoDB references remain:

```bash
# Check for mongoose
grep -r "mongoose" backend/src/ --exclude-dir=node_modules

# Check for MongoDB connection
grep -r "connectDB\|MongoDB\|mongodb" backend/src/ --exclude-dir=node_modules

# Check package.json
grep "mongoose" backend/package.json
```

All should return empty or only comments/documentation.
