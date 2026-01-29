# Where Your Data Goes - Firestore Guide

## Important Distinction

**Firebase Firestore** = Database (where your data goes) ✅  
**Firebase Storage** = File storage (for images/files) ❌

Your app data goes to **Firestore**, not Storage!

## Where to View Your Data

### Firebase Console
1. Go to: https://console.firebase.google.com/
2. Select your project: `lecturelet-c03be`
3. Click **"Firestore Database"** in the left menu
4. You'll see your collections there

## Collections You'll See

After creating accounts and courses, you'll see these collections in Firestore:

### 1. **users** Collection
When a user signs up, a document is created here:
```
users/
  └── {firebaseAuthUID}/
      ├── phoneNumber: "233241234567"
      ├── fullName: "John Doe"
      ├── role: "student" or "course_rep"
      ├── passwordHash: "..."
      ├── studentId: "12345"
      ├── college: "College of..."
      ├── notificationsEnabled: true
      ├── paymentStatus: false
      ├── trialStartDate: Timestamp
      ├── trialEndDate: Timestamp
      ├── createdAt: Timestamp
      └── updatedAt: Timestamp
```

### 2. **courses** Collection
When a course rep creates a course:
```
courses/
  └── {auto-generated-id}/
      ├── uniqueCode: "12345"
      ├── courseName: "Introduction to Computer Science"
      ├── courseCode: "CS101"
      ├── days: ["Monday", "Wednesday"]
      ├── startTime: "10:00 AM"
      ├── endTime: "12:00 PM"
      ├── dayTimes: {...}
      ├── dayVenues: {...}
      ├── venue: "Room 101"
      ├── createdBy: "userId"
      ├── createdAt: Timestamp
      └── updatedAt: Timestamp
```

### 3. **enrollments** Collection
When a student enrolls in a course:
```
enrollments/
  └── {userId}_{courseId}/
      ├── userId: "user123"
      ├── courseId: "course456"
      └── enrolledAt: Timestamp
```

### 4. **notifications** Collection
When notifications are sent:
```
notifications/
  └── {auto-generated-id}/
      ├── userId: "user123"
      ├── title: "Course Updated"
      ├── message: "Hi John, CS101 has been updated..."
      ├── type: "course_update"
      ├── courseId: "course456"
      ├── isRead: false
      ├── createdAt: Timestamp
      └── updatedAt: Timestamp
```

### 5. **deviceTokens** Collection
When users register push tokens:
```
deviceTokens/
  └── {auto-generated-id}/
      ├── userId: "user123"
      ├── pushToken: "FCM-token-here"
      ├── platform: "android" or "ios"
      ├── isActive: true
      ├── lastUsed: Timestamp
      └── createdAt: Timestamp
```

### 6. **colleges** Collection
Pre-seeded college data:
```
colleges/
  └── {auto-generated-id}/
      ├── name: "College of Humanities..."
      ├── isActive: true
      └── createdAt: Timestamp
```

### 7. **smsLogs** Collection (if SMS is sent)
```
smsLogs/
  └── {auto-generated-id}/
      ├── userId: "user123"
      ├── phoneNumber: "233241234567"
      ├── message: "Hi John, URGENT:..."
      ├── type: "announcement"
      ├── courseId: "course456"
      └── sentAt: Timestamp
```

## How to View Data in Firebase Console

### Step-by-Step:

1. **Go to Firebase Console**
   - Visit: https://console.firebase.google.com/
   - Login with your Google account

2. **Select Your Project**
   - Click on `lecturelet-c03be`

3. **Open Firestore Database**
   - Left sidebar → "Firestore Database"
   - Or: Build → Firestore Database

4. **View Collections**
   - You'll see all collections listed
   - Click on a collection to see documents
   - Click on a document to see its fields

5. **Query Data**
   - Use the "Add filter" button to query
   - Example: Filter `users` where `role == "student"`

## Example: After Creating an Account

1. User signs up via `/api/auth/signup`
2. Firebase Auth creates user → **Authentication** tab
3. Express backend creates document → **Firestore** → `users` collection
4. You'll see the user document with all fields

## Example: After Creating a Course

1. Course rep creates course via `/api/courses`
2. Document created in → **Firestore** → `courses` collection
3. You'll see the course with `uniqueCode`, `courseName`, etc.

## Data Structure Summary

```
Firestore Database
├── users/              ← User accounts
├── courses/            ← Courses created by reps
├── enrollments/        ← Student enrollments
├── notifications/      ← In-app notifications
├── deviceTokens/       ← FCM push tokens
├── colleges/          ← College list
└── smsLogs/           ← SMS audit trail
```

## Important Notes

1. **Firestore vs Storage**
   - ✅ **Firestore** = Database (JSON documents) ← Your data goes here
   - ❌ **Storage** = Files (images, videos, PDFs) ← Not used for database

2. **Real-time Updates**
   - Firestore updates in real-time
   - Changes appear immediately in Firebase Console

3. **Security Rules**
   - Set up Firestore Security Rules in Firebase Console
   - Controls who can read/write data

4. **Indexes**
   - Firestore may require composite indexes for complex queries
   - Firebase will prompt you to create them when needed

## Quick Access

**Firebase Console:** https://console.firebase.google.com/project/lecturelet-c03be/firestore

**Direct Links:**
- Firestore: https://console.firebase.google.com/project/lecturelet-c03be/firestore/data
- Authentication: https://console.firebase.google.com/project/lecturelet-c03be/authentication/users
- Cloud Messaging: https://console.firebase.google.com/project/lecturelet-c03be/cloudmessaging

## Testing

After creating an account:
1. Go to Firebase Console → Firestore Database
2. Look for `users` collection
3. You should see a document with the user's data

After creating a course:
1. Go to Firebase Console → Firestore Database
2. Look for `courses` collection
3. You should see the course document with `uniqueCode`
