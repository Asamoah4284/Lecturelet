# MongoDB to Firebase Migration Summary

## Overview
This document summarizes the migration from MongoDB/Mongoose to Firebase (Auth + Firestore + FCM).

## ✅ Completed Tasks

### 1. MongoDB Removal
- ✅ Removed MongoDB connection logic from `server.js`
- ✅ Created Firestore service layer to replace Mongoose models
- ⚠️ **TODO**: Remove mongoose from package.json dependencies
- ⚠️ **TODO**: Remove MongoDB environment variables from `.env`

### 2. Firebase Setup
- ✅ Created `backend/src/config/firebase.js` - Firebase Admin SDK configuration
- ✅ Created `frontend/config/firebase.js` - Firebase client SDK configuration
- ✅ Firebase Admin SDK installed
- ✅ Firebase client SDK already installed in frontend

### 3. Firestore Services Created
- ✅ `backend/src/services/firestore/users.js` - User operations
- ✅ `backend/src/services/firestore/courses.js` - Course operations
- ✅ `backend/src/services/firestore/enrollments.js` - Enrollment operations
- ✅ `backend/src/services/firestore/notifications.js` - Notification operations
- ✅ `backend/src/services/firestore/deviceTokens.js` - Device token management
- ✅ `backend/src/services/firestore/colleges.js` - College management

### 4. Authentication Migration
- ✅ Updated `backend/src/middleware/auth.js` to use Firebase ID token verification
- ✅ Updated `backend/src/routes/auth.js` to use Firebase Auth
- ✅ Password hashing with bcryptjs (stored in Firestore for server-side verification)
- ✅ Custom claims for role-based access control
- ⚠️ **TODO**: Update frontend to use Firebase Auth SDK for login/signup

### 5. FCM Push Notifications
- ✅ Created `backend/src/services/fcm/pushNotificationService.js`
- ✅ Replaced Expo push notifications with FCM
- ⚠️ **TODO**: Update frontend notification service to use FCM
- ⚠️ **TODO**: Create Cloud Functions for automatic notifications

## ⚠️ Pending Tasks

### Routes Migration
- ✅ Update `backend/src/routes/courses.js` to use Firestore services
- ✅ Update `backend/src/routes/enrollments.js` to use Firestore services
- ✅ Update `backend/src/routes/notifications.js` to use Firestore services
- ✅ Update `backend/src/routes/auth.js` to use Firebase Auth
- ⚠️ Update other routes (payments, quizzes, assignments, tutorials, feedback)
  - **Note**: These routes still use MongoDB models and need Firestore services created
  - **Priority**: Lower - core functionality (auth, courses, enrollments, notifications) is complete

### Utility Functions
- ⚠️ Update `backend/src/utils/temporaryEditReset.js` to use Firestore
- ⚠️ Update `backend/src/utils/classReminderJob.js` to use Firestore
- ⚠️ Update `backend/src/utils/deviceTokenCleanup.js` to use Firestore

### Frontend Updates
- ⚠️ Update frontend to use Firebase Auth SDK
- ⚠️ Update frontend to use FCM instead of Expo push notifications
- ⚠️ Update API calls to handle Firebase ID tokens

### Cleanup
- ⚠️ Remove mongoose from `backend/package.json`
- ⚠️ Remove MongoDB URI from `backend/.env`
- ⚠️ Remove old MongoDB model files
- ⚠️ Remove MongoDB connection file

## 🔄 Breaking Changes

1. **Authentication Flow**
   - Old: JWT tokens from backend
   - New: Firebase ID tokens (custom tokens exchanged client-side)
   - **Action Required**: Update frontend to use Firebase Auth SDK

2. **Push Notifications**
   - Old: Expo Push Notification Service
   - New: Firebase Cloud Messaging (FCM)
   - **Action Required**: Update frontend to use FCM SDK

3. **Database Queries**
   - Old: Mongoose queries with populate()
   - New: Firestore queries (manual joins where needed)
   - **Note**: Some queries may need optimization

4. **Password Storage**
   - Old: Passwords hashed and stored in MongoDB
   - New: Passwords hashed and stored in Firestore + Firebase Auth
   - **Note**: Dual storage for server-side verification compatibility

## 📋 Firestore Collections Structure

### users
- Document ID: Firebase Auth UID
- Fields: phoneNumber, passwordHash, fullName, role, studentId, college, etc.

### courses
- Document ID: Auto-generated
- Fields: uniqueCode, courseName, courseCode, days, startTime, endTime, etc.

### enrollments
- Document ID: `${userId}_${courseId}` (composite key)
- Fields: userId, courseId, enrolledAt

### notifications
- Document ID: Auto-generated
- Fields: userId, title, message, type, courseId, isRead, createdAt

### deviceTokens
- Document ID: Auto-generated
- Fields: userId, pushToken, platform, isActive, lastUsed

### colleges
- Document ID: Auto-generated
- Fields: name, isActive

## 🔐 Security Rules (TODO)

Firestore Security Rules need to be configured in Firebase Console:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own user document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Courses: public read, course_rep write for their own courses
    match /courses/{courseId} {
      allow read: if true;
      allow write: if request.auth != null && 
        (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'course_rep' ||
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
    }
    
    // Enrollments: users can read their own, course_rep can read for their courses
    match /enrollments/{enrollmentId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow delete: if request.auth != null;
    }
    
    // Notifications: users can read/write their own
    match /notifications/{notificationId} {
      allow read, write: if request.auth != null && 
        resource.data.userId == request.auth.uid;
    }
    
    // Device tokens: users can manage their own
    match /deviceTokens/{tokenId} {
      allow read, write: if request.auth != null && 
        resource.data.userId == request.auth.uid;
    }
  }
}
```

## 📝 Next Steps

1. Complete routes migration (courses, enrollments, notifications)
2. Update utility functions to use Firestore
3. Update frontend authentication flow
4. Update frontend push notifications to FCM
5. Create Cloud Functions for automatic notifications
6. Remove MongoDB dependencies
7. Test all endpoints
8. Deploy Firestore Security Rules

## 🚨 Important Notes

- **Custom Tokens**: The backend returns custom tokens that clients must exchange for ID tokens using Firebase SDK
- **Password Verification**: Passwords are verified server-side using bcrypt, then custom tokens are issued
- **Role-Based Access**: Custom claims are set on Firebase Auth users for role-based access control
- **FCM Migration**: Frontend needs to migrate from Expo push tokens to FCM tokens
