# API Testing Commands for Push Notifications

## 🧪 TEST 1: Register Device Token (Multi-Device)

### Register iPhone
```bash
curl -X POST https://lecturelet.onrender.com/api/notifications/register-token \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "pushToken": "ExponentPushToken[YOUR_IOS_TOKEN_HERE]",
    "platform": "ios",
    "appVersion": "1.0.5",
    "expoVersion": "54.0.0",
    "deviceId": "iphone-test-001"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Push token registered successfully",
  "data": {
    "deviceId": "65f8a1234567890abcdef123",
    "platform": "ios",
    "registeredAt": "2026-01-25T13:38:23.000Z"
  }
}
```

### Register iPad (Same User)
```bash
curl -X POST https://lecturelet.onrender.com/api/notifications/register-token \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN_HERE" \
  -H "Content-Type": application/json" \
  -d '{
    "pushToken": "ExponentPushToken[YOUR_IPAD_TOKEN_HERE]",
    "platform": "ios",
    "appVersion": "1.0.5",
    "expoVersion": "54.0.0",
    "deviceId": "ipad-test-001"
  }'
```

---

## 🧪 TEST 2: Send Announcement (Course Rep)

```bash
curl -X POST https://lecturelet.onrender.com/api/notifications/send \
  -H "Authorization: Bearer YOUR_COURSE_REP_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "courseId": "YOUR_COURSE_ID_HERE",
    "title": "Multi-Device Test",
    "message": "This notification should appear on ALL your devices! Check your iPhone, iPad, and any other registered devices."
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Notification sent to 10 students",
  "data": {
    "recipientCount": 10,
    "pushNotificationsSent": 25,  // ← Note: More than recipientCount (multi-device!)
    "smsSent": 0
  }
}
```

**Backend Logs Should Show:**
```
📱 Sending to 2 devices for student John Doe
📱 Sending to ios device for John Doe
✅ Sent to ios device
📱 Sending to ios device for John Doe
✅ Sent to ios device
```

---

## 🧪 TEST 3: Remove Specific Device Token

```bash
curl -X DELETE "https://lecturelet.onrender.com/api/notifications/token?pushToken=ExponentPushToken[TOKEN_TO_REMOVE]" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN_HERE"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Push token removed successfully"
}
```

---

## 🧪 TEST 4: Remove All User Tokens (Logout from All Devices)

```bash
curl -X DELETE https://lecturelet.onrender.com/api/notifications/token \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN_HERE"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "All push tokens removed successfully"
}
```

---

## 🧪 TEST 5: Get User Notifications

```bash
curl -X GET https://lecturelet.onrender.com/api/notifications \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN_HERE"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "_id": "65f8a...",
        "title": "Multi-Device Test",
        "message": "This notification should appear on ALL your devices!",
        "type": "announcement",
        "isRead": false,
        "createdAt": "2026-01-25T13:38:23.000Z"
      }
    ],
    "unreadCount": 1,
    "count": 1
  }
}
```

---

## 📊 MONGODB VERIFICATION QUERIES

### Check DeviceToken Collection

```javascript
// Connect to MongoDB
mongosh "your-mongodb-connection-string"

// Use the correct database
use lecturelet  // or your database name

// View all device tokens
db.devicetokens.find().pretty()

// Count active tokens per user
db.devicetokens.aggregate([
  { $match: { isActive: true } },
  { $group: {
      _id: "$userId",
      deviceCount: { $sum: 1 },
      platforms: { $addToSet: "$platform" },
      tokens: { $push: {
        platform: "$platform",
        lastUsed: "$lastUsed",
        appVersion: "$appVersion"
      }}
    }
  },
  { $sort: { deviceCount: -1 } }
])

// Expected output:
// {
//   "_id": ObjectId("65f8a..."),  // userId
//   "deviceCount": 2,
//   "platforms": ["ios"],
//   "tokens": [
//     { "platform": "ios", "lastUsed": ISODate("..."), "appVersion": "1.0.5" },
//     { "platform": "ios", "lastUsed": ISODate("..."), "appVersion": "1.0.5" }
//   ]
// }

// Find users with multiple devices
db.devicetokens.aggregate([
  { $match: { isActive: true } },
  { $group: { _id: "$userId", count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }
])

// Check recent token registrations
db.devicetokens.find({ 
  isActive: true 
}).sort({ 
  createdAt: -1 
}).limit(10).pretty()

// Count by platform
db.devicetokens.aggregate([
  { $match: { isActive: true } },
  { $group: {
      _id: "$platform",
      count: { $sum: 1 }
    }
  }
])

// Expected output:
// [
//   { "_id": "ios", "count": 45 },
//   { "_id": "android", "count": 23 }
// ]
```

### Verify Notification Sending

```javascript
// Check recent notifications
db.notifications.find().sort({ createdAt: -1 }).limit(5).pretty()

// Count notifications per user
db.notifications.aggregate([
  { $group: {
      _id: "$userId",
      notificationCount: { $sum: 1 },
      unreadCount: {
        $sum: { $cond: [{ $eq: ["$isRead", false] }, 1, 0] }
      }
    }
  },
  { $sort: { notificationCount: -1 } }
])
```

---

## 🔍 BACKEND LOG PATTERNS TO LOOK FOR

### ✅ GOOD SIGNS (Working Correctly)

```
✅ Registered new device token for user 65f8a..., platform ios
✅ Registered push token for user 65f8a..., platform ios
📱 Sending to 2 devices for student John Doe
✅ Sent to ios device
✅ Sent class reminder to user 65f8a... for course MATH101
✅ Device token cleanup job started (runs daily)
```

### ❌ BAD SIGNS (Needs Investigation)

```
❌ Failed to send to ios device: DeviceNotRegistered
⚠️ No active device tokens found for user 65f8a...
❌ Failed to register push token: ValidationError
Error in processClassReminders: ...
```

---

## 🎯 END-TO-END TEST SCENARIO

### Step 1: Setup (2 devices)
1. Install app on iPhone
2. Login as Student A
3. Note push token from logs: `Token_iPhone`
4. Install app on iPad  
5. Login as Student A
6. Note push token from logs: `Token_iPad`

### Step 2: Verify Multi-Device Registration

Run MongoDB query:
```javascript
db.devicetokens.find({ 
  userId: ObjectId("STUDENT_A_ID") 
}).pretty()
```

**Expected:** 2 documents (one for iPhone, one for iPad)

### Step 3: Send Test Notification

As course rep, send announcement via API or app.

### Step 4: Verify Receipt

- [ ] iPhone receives notification ✅
- [ ] iPad receives notification ✅
- [ ] Both show in notification tray
- [ ] Both show on lock screen
- [ ] In-app notification count = 1 (not duplicated)

### Step 5: Check Backend Logs

Look for:
```
📱 Sending to 2 devices for student John Doe
✅ Sent to ios device
✅ Sent to ios device
```

### Step 6: Remove Token

Remove iPad token:
```bash
curl -X DELETE "https://lecturelet.onrender.com/api/notifications/token?pushToken=Token_iPad" \
  -H "Authorization: Bearer STUDENT_A_TOKEN"
```

### Step 7: Send Another Notification

- [ ] iPhone still receives notification ✅
- [ ] iPad does NOT receive notification ✅

---

## 📞 SUPPORT CHECKLIST

If notifications still not working after all tests:

- [ ] DeviceToken collection exists in MongoDB
- [ ] At least 1 active token registered
- [ ] Backend logs show "✅ Registered push token"
- [ ] Backend logs show "📱 Sending to X devices"
- [ ] Expo project ID matches in app.json
- [ ] APNs key configured in Expo dashboard
- [ ] User has active access (payment or trial)
- [ ] Notifications enabled for user
- [ ] Testing on physical device (not simulator)

---

**All systems GO for multi-device push notifications!** 🚀
