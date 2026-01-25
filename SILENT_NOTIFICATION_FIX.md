# Silent Notification Problem - Diagnosis & Fix

## 🔍 THE ISSUE

**Symptom:** Enrolled students receive in-app notifications (visible in app's notification tab) but **NO push notification popup/banner** appears on their phone.

**What's Working:** ✅ In-app notifications created in database  
**What's NOT Working:** ❌ Push notifications not appearing on lock screen/as banner

---

## 🎯 ROOT CAUSES (Multiple Issues)

I've identified **5 potential reasons** why this happens. Let's check each one:

### **Cause 1: No Device Tokens Registered** ⚠️ MOST LIKELY

**Problem:** Students haven't logged in recently, so they have no push tokens stored.

**Check:**
```javascript
// MongoDB query
db.devicetokens.aggregate([
  { $match: { isActive: true } },
  { $group: { _id: "$userId", tokenCount: { $sum: 1 } } }
])

// Count users with NO tokens
db.users.aggregate([
  {
    $lookup: {
      from: "devicetokens",
      localField: "_id",
      foreignField: "userId",
      as: "tokens"
    }
  },
  {
    $match: {
      $or: [
        { tokens: { $size: 0 } },
        { "tokens.isActive": { $ne: true } }
      ]
    }
  },
  { $count: "usersWithoutTokens" }
])
```

**Fix:** Students need to logout and login again to register tokens.

---

### **Cause 2: Active Access Check** ⚠️ VERY LIKELY

**Problem:** Push notifications only sent if `hasActiveAccess() === true` (paid OR active trial).

**Code Location:** `backend/src/routes/notifications.js` line 243

```javascript
if (hasActiveAccess && student.notificationsEnabled) {
  // Only these students get push notifications
  const deviceTokens = await DeviceToken.getActiveTokens(student._id);
  // ...
}
```

**Check:**
```javascript
// MongoDB - Find users without active access
db.users.find({
  $and: [
    { paymentStatus: false },
    {
      $or: [
        { trialEndDate: null },
        { trialEndDate: { $lt: new Date() } }
      ]
    }
  ]
}).count()
```

**Fix Options:**

**Option A: Extend Trial Period** (Recommended for testing)
```javascript
// Extend trial for all users
db.users.updateMany(
  { paymentStatus: false },
  {
    $set: {
      trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    }
  }
)
```

**Option B: Remove Active Access Check** (If you want all enrolled students to get notifications)

---

### **Cause 3: notificationsEnabled = false**

**Problem:** Students disabled notifications in app settings.

**Check:**
```javascript
db.users.find({ notificationsEnabled: false }).count()
```

**Fix:** Students need to enable notifications in app settings.

---

### **Cause 4: Invalid/Expired Tokens**

**Problem:** Tokens are registered but expired/invalid (app uninstalled, token revoked).

**Check Backend Logs:**
```
❌ Failed to send to ios device: DeviceNotRegistered
❌ Failed to send to ios device: InvalidCredentials
```

**Fix:** Automatic - our multi-device fix deactivates invalid tokens automatically.

---

### **Cause 5: Old User.pushToken Instead of DeviceToken**

**Problem:** Before the multi-device fix, only `User.pushToken` was used. If students haven't logged in since the fix, they have no DeviceToken entries.

**Check:**
```javascript
// Users with User.pushToken but NO DeviceToken
db.users.aggregate([
  {
    $match: { pushToken: { $ne: null, $exists: true } }
  },
  {
    $lookup: {
      from: "devicetokens",
      localField: "_id",
      foreignField: "userId",
      as: "deviceTokens"
    }
  },
  {
    $match: { deviceTokens: { $size: 0 } }
  },
  { $count: "usersNeedingMigration" }
])
```

**Fix:** Migration script or ask students to logout/login.

---

## 🔧 IMMEDIATE FIXES

### **Fix 1: Add Better Logging** 

Add diagnostic logging to see exactly why push notifications aren't sent:

**File:** `backend/src/routes/notifications.js` (after line 204)

```javascript
for (const enrollment of enrollments) {
  const student = enrollment.userId;
  
  if (!student || !student._id) {
    console.log('⚠️ Student not found for enrollment');
    continue;
  }
  
  const fullUser = await User.findById(student._id);
  if (!fullUser) {
    console.log('⚠️ Full user not found:', student._id);
    continue;
  }

  const hasActiveAccess = fullUser.hasActiveAccess();
  const studentName = student.fullName || 'Student';
  
  // ✅ ADD THIS DIAGNOSTIC LOGGING
  console.log(`📊 Student ${studentName} (${student._id}):`, {
    hasActiveAccess,
    notificationsEnabled: student.notificationsEnabled,
    paymentStatus: fullUser.paymentStatus,
    trialEndDate: fullUser.trialEndDate,
    trialActive: fullUser.isTrialActive()
  });
  
  // Create in-app notification for all students
  notifications.push({
    userId: student._id,
    title,
    message: personalizedMessage,
    type: 'announcement',
    courseId: courseId,
  });

  // Get device tokens
  if (hasActiveAccess && student.notificationsEnabled) {
    const deviceTokens = await DeviceToken.getActiveTokens(student._id);
    
    // ✅ ADD THIS DIAGNOSTIC LOGGING
    console.log(`📱 Device tokens for ${studentName}: ${deviceTokens.length}`);
    
    if (deviceTokens.length === 0) {
      console.log(`⚠️ NO DEVICE TOKENS for student ${studentName} - they need to login!`);
    }
    
    // ... rest of code
  } else {
    // ✅ ADD THIS DIAGNOSTIC LOGGING
    if (!hasActiveAccess) {
      console.log(`⚠️ ${studentName} has NO ACTIVE ACCESS - no push notification sent`);
    }
    if (!student.notificationsEnabled) {
      console.log(`⚠️ ${studentName} has NOTIFICATIONS DISABLED - no push notification sent`);
    }
  }
}
```

---

### **Fix 2: Migrate Old Tokens to DeviceToken Collection**

Create a migration script to move old `User.pushToken` values to the new `DeviceToken` collection:

**File:** `backend/src/utils/migrateTokens.js` (NEW)

```javascript
const { User, DeviceToken } = require('../models');

/**
 * Migrate old User.pushToken values to DeviceToken collection
 * This ensures users who haven't logged in since the multi-device fix still receive notifications
 */
const migrateOldTokens = async () => {
  try {
    console.log('🔄 Starting token migration...');
    
    // Find all users with pushToken but no DeviceToken entries
    const users = await User.find({
      pushToken: { $ne: null, $exists: true }
    });
    
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const user of users) {
      try {
        // Check if token already exists in DeviceToken collection
        const existingToken = await DeviceToken.findOne({
          pushToken: user.pushToken
        });
        
        if (existingToken) {
          console.log(`⏭️  Token already exists for user ${user.fullName}, skipping`);
          skipped++;
          continue;
        }
        
        // Detect platform from token format
        const platform = user.pushToken.startsWith('ExponentPushToken[') ? 'ios' : 'android';
        
        // Create DeviceToken entry
        await DeviceToken.create({
          userId: user._id,
          pushToken: user.pushToken,
          platform: platform,
          isActive: true,
          lastUsed: new Date(),
          appVersion: 'migrated',
          expoVersion: 'unknown'
        });
        
        console.log(`✅ Migrated token for user ${user.fullName} (${platform})`);
        migrated++;
        
      } catch (error) {
        console.error(`❌ Error migrating token for user ${user._id}:`, error.message);
        errors++;
      }
    }
    
    console.log('✅ Token migration complete:', {
      migrated,
      skipped,
      errors,
      total: users.length
    });
    
    return { success: true, migrated, skipped, errors };
    
  } catch (error) {
    console.error('❌ Token migration failed:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Run migration immediately
 */
if (require.main === module) {
  const mongoose = require('mongoose');
  const config = require('../config');
  
  mongoose.connect(config.mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
    .then(async () => {
      console.log('📡 Connected to MongoDB');
      await migrateOldTokens();
      process.exit(0);
    })
    .catch(err => {
      console.error('MongoDB connection error:', err);
      process.exit(1);
    });
}

module.exports = { migrateOldTokens };
```

**Run Migration:**
```bash
cd backend
node src/utils/migrateTokens.js
```

---

### **Fix 3: Extend Trial Period Globally**

If the issue is trial expiration, extend trials:

**MongoDB Command:**
```javascript
// Extend trial for all users by 30 days
db.users.updateMany(
  { paymentStatus: false },
  {
    $set: {
      trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }
  }
)
```

**Or via Backend Script:**

**File:** `backend/src/utils/extendTrials.js` (NEW)

```javascript
const { User } = require('../models');

const extendAllTrials = async (days = 30) => {
  try {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);
    
    const result = await User.updateMany(
      { paymentStatus: false },
      {
        $set: {
          trialEndDate: endDate,
          trialStartDate: new Date() // Reset start date too
        }
      }
    );
    
    console.log(`✅ Extended trials for ${result.modifiedCount} users until ${endDate}`);
    return result;
  } catch (error) {
    console.error('Error extending trials:', error);
    throw error;
  }
};

module.exports = { extendAllTrials };
```

---

### **Fix 4: Remove Active Access Check (Optional)**

If you want **ALL enrolled students** to receive push notifications regardless of payment/trial status:

**File:** `backend/src/routes/notifications.js` (line 243)

**Change from:**
```javascript
if (hasActiveAccess && student.notificationsEnabled) {
  const deviceTokens = await DeviceToken.getActiveTokens(student._id);
  // ...
}
```

**Change to:**
```javascript
// Send push notifications to ALL students (remove access check)
if (student.notificationsEnabled) {
  const deviceTokens = await DeviceToken.getActiveTokens(student._id);
  
  if (deviceTokens.length === 0) {
    console.log(`⚠️ ${studentName} has no device tokens - they need to login!`);
  }
  
  // ... rest of code
}
```

**Also update class reminder job** (`backend/src/utils/classReminderJob.js` line 220):

**Change from:**
```javascript
if (!user.hasActiveAccess()) {
  console.log(`User ${user._id} does not have active access`);
  continue;
}
```

**Change to:**
```javascript
// Remove this check entirely, or comment it out:
// if (!user.hasActiveAccess()) {
//   console.log(`User ${user._id} does not have active access`);
//   continue;
// }
```

---

## 🧪 DIAGNOSTIC SCRIPT

Create this script to diagnose the exact issue:

**File:** `backend/src/utils/diagnoseNotifications.js` (NEW)

```javascript
const { User, Enrollment, DeviceToken, Course } = require('../models');

const diagnoseNotificationIssues = async (courseId) => {
  try {
    console.log('🔍 Diagnosing notification issues for course:', courseId);
    
    const course = await Course.findById(courseId);
    if (!course) {
      console.log('❌ Course not found');
      return;
    }
    
    console.log(`📚 Course: ${course.courseName}`);
    
    const enrollments = await Enrollment.find({ courseId })
      .populate('userId', 'fullName pushToken notificationsEnabled paymentStatus trialEndDate');
    
    console.log(`👥 Total enrolled students: ${enrollments.length}\n`);
    
    let stats = {
      total: enrollments.length,
      hasActiveAccess: 0,
      noActiveAccess: 0,
      notificationsEnabled: 0,
      notificationsDisabled: 0,
      hasDeviceTokens: 0,
      noDeviceTokens: 0,
      hasOldPushToken: 0,
      wouldReceivePush: 0,
      wouldNotReceivePush: 0
    };
    
    for (const enrollment of enrollments) {
      const student = enrollment.userId;
      if (!student) continue;
      
      const fullUser = await User.findById(student._id);
      if (!fullUser) continue;
      
      const hasActiveAccess = fullUser.hasActiveAccess();
      const deviceTokens = await DeviceToken.find({
        userId: student._id,
        isActive: true
      });
      
      // Stats
      if (hasActiveAccess) stats.hasActiveAccess++;
      else stats.noActiveAccess++;
      
      if (student.notificationsEnabled) stats.notificationsEnabled++;
      else stats.notificationsDisabled++;
      
      if (deviceTokens.length > 0) stats.hasDeviceTokens++;
      else stats.noDeviceTokens++;
      
      if (student.pushToken) stats.hasOldPushToken++;
      
      const wouldReceive = hasActiveAccess && student.notificationsEnabled && deviceTokens.length > 0;
      if (wouldReceive) stats.wouldReceivePush++;
      else stats.wouldNotReceivePush++;
      
      // Detailed log
      console.log(`📊 ${student.fullName}:`);
      console.log(`   ✓ Has Active Access: ${hasActiveAccess ? '✅' : '❌'}`);
      console.log(`   ✓ Notifications Enabled: ${student.notificationsEnabled ? '✅' : '❌'}`);
      console.log(`   ✓ Device Tokens: ${deviceTokens.length}`);
      console.log(`   ✓ Old Push Token: ${student.pushToken ? '✅' : '❌'}`);
      console.log(`   ✓ Would Receive Push: ${wouldReceive ? '✅' : '❌'}`);
      
      if (!wouldReceive) {
        console.log(`   ⚠️  REASON WHY NOT:`);
        if (!hasActiveAccess) console.log(`      - No active access (trial expired or not paid)`);
        if (!student.notificationsEnabled) console.log(`      - Notifications disabled`);
        if (deviceTokens.length === 0) console.log(`      - No device tokens (needs to login)`);
      }
      console.log('');
    }
    
    console.log('📊 SUMMARY:');
    console.log(`   Total Students: ${stats.total}`);
    console.log(`   Has Active Access: ${stats.hasActiveAccess} (${Math.round(stats.hasActiveAccess/stats.total*100)}%)`);
    console.log(`   No Active Access: ${stats.noActiveAccess} (${Math.round(stats.noActiveAccess/stats.total*100)}%)`);
    console.log(`   Notifications Enabled: ${stats.notificationsEnabled}`);
    console.log(`   Notifications Disabled: ${stats.notificationsDisabled}`);
    console.log(`   Has Device Tokens: ${stats.hasDeviceTokens}`);
    console.log(`   No Device Tokens: ${stats.noDeviceTokens}`);
    console.log(`   Has Old Push Token: ${stats.hasOldPushToken}`);
    console.log(`   WOULD RECEIVE PUSH: ${stats.wouldReceivePush} ✅`);
    console.log(`   WOULD NOT RECEIVE PUSH: ${stats.wouldNotReceivePush} ❌`);
    
    return stats;
    
  } catch (error) {
    console.error('Error diagnosing notifications:', error);
  }
};

// Run if called directly
if (require.main === module) {
  const mongoose = require('mongoose');
  const config = require('../config');
  
  const courseId = process.argv[2];
  if (!courseId) {
    console.log('Usage: node diagnoseNotifications.js <courseId>');
    process.exit(1);
  }
  
  mongoose.connect(config.mongoUri)
    .then(async () => {
      await diagnoseNotificationIssues(courseId);
      process.exit(0);
    })
    .catch(err => {
      console.error('Error:', err);
      process.exit(1);
    });
}

module.exports = { diagnoseNotificationIssues };
```

**Run it:**
```bash
cd backend
node src/utils/diagnoseNotifications.js YOUR_COURSE_ID_HERE
```

---

## 🎯 RECOMMENDED ACTION PLAN

### **Step 1: Diagnose (5 minutes)**

```bash
# Run diagnostic script
cd backend
node src/utils/diagnoseNotifications.js <COURSE_ID>
```

This will tell you EXACTLY why students aren't receiving push notifications.

### **Step 2: Migrate Old Tokens (2 minutes)**

```bash
# Migrate old User.pushToken to DeviceToken collection
node src/utils/migrateTokens.js
```

### **Step 3: Extend Trials (if needed) (1 minute)**

If many students have expired trials:

```javascript
// In MongoDB shell
db.users.updateMany(
  { paymentStatus: false },
  { $set: { trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } }
)
```

### **Step 4: Add Diagnostic Logging (10 minutes)**

Update `backend/src/routes/notifications.js` with the enhanced logging from Fix 1 above.

### **Step 5: Ask Students to Re-login (if needed)**

If students still have no device tokens after migration, send them an in-app message asking them to logout and login again.

### **Step 6: Test**

Send a test announcement and check logs for:
```
📊 Student John Doe: { hasActiveAccess: true, notificationsEnabled: true }
📱 Device tokens for John Doe: 2
✅ Push notifications sent: 25 successful, 0 failed
```

---

## ✅ EXPECTED OUTCOME

After these fixes:

✅ Students with active access + device tokens → **Push notifications work**  
✅ Students without active access → **Only in-app notifications** (unless you remove the check)  
✅ Students without device tokens → **Migrated OR asked to re-login**  
✅ Clear diagnostic logs → **You know exactly why each student does/doesn't get push**  

---

**This should fix the silent notification issue!** 🚀
