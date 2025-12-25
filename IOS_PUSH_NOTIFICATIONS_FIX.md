# iOS Push Notifications Fix Guide

## Problem
Push notifications are received inside the app but **do not appear as banners, on the lock screen, or in the notification center** on iOS devices. Notifications only work when the app is open.

## Solution Overview
This guide fixes iOS push notifications by:
1. Configuring `app.json` for iOS notification display
2. Properly requesting iOS notification permissions (alert, badge, sound)
3. Setting up the notification handler for foreground display
4. Ensuring backend payloads include iOS-specific fields

---

## Step 1: Update `app.json` Configuration

**File:** `app.json` (or `app.config.js`)

### Add iOS Display in Foreground Setting

In the `expo-notifications` plugin configuration, add `iosDisplayInForeground: true`:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-notifications",
        {
          "color": "#2563eb",
          "sounds": [],
          "mode": "production",
          "iosDisplayInForeground": true,  // ← ADD THIS LINE
          "androidMode": "default",
          "androidCollapsedTitle": "#{unread_notifications} new notifications"
        }
      ]
    ]
  }
}
```

**Why:** This enables notifications to display as banners when the app is in the foreground on iOS.

---

## Step 2: Update Notification Service - Request iOS Permissions

**File:** `services/notificationService.js` (or wherever you handle notifications)

### 2.1 Update Permission Request Function

Replace your `requestNotificationPermissions` function with this enhanced version:

```javascript
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const requestNotificationPermissions = async () => {
  try {
    // Create Android notification channel first (required for Android 8.0+)
    if (Platform.OS === 'android') {
      await createNotificationChannel(); // Your existing function
    }
    
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      // Request permissions with all required options for iOS (alert, badge, sound)
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowAnnouncements: false,
        },
      });
      finalStatus = status;
    }

    // For iOS, verify that all permission types are granted
    if (Platform.OS === 'ios' && finalStatus === 'granted') {
      const permissions = await Notifications.getPermissionsAsync();
      if (permissions.ios) {
        const iosPerms = permissions.ios;
        if (!iosPerms.allowAlert || !iosPerms.allowBadge || !iosPerms.allowSound) {
          console.warn('Some iOS notification permissions not fully granted:', iosPerms);
          // Request again with explicit options
          const retryResult = await Notifications.requestPermissionsAsync({
            ios: {
              allowAlert: true,
              allowBadge: true,
              allowSound: true,
              allowAnnouncements: false,
            },
          });
          return retryResult.status === 'granted';
        }
      }
    }

    return finalStatus === 'granted';
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
};
```

**Why:** iOS requires explicit permission for alerts, badges, and sounds. Without all three, notifications won't display properly.

---

### 2.2 Set Up Notification Handler (Critical for Foreground Display)

**Location:** At the top of your `notificationService.js` file, before any other notification code.

```javascript
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications are handled when app is in foreground
// This is CRITICAL for iOS to show notifications as banners and on lock screen
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // For iOS, ensure all presentation options are enabled
    if (Platform.OS === 'ios') {
      return {
        shouldShowAlert: true,    // Show banner/alert
        shouldPlaySound: true,     // Play sound
        shouldSetBadge: true,      // Update badge count
      };
    }
    // For Android, use default behavior
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    };
  },
});
```

**Important:** This handler must be set up **before** any notification listeners or initialization code runs. Place it at the top of your notification service file.

**Why:** Without this handler, iOS will not display notifications when the app is in the foreground, even if permissions are granted.

---

## Step 3: Update Backend Push Notification Payload

**File:** Your backend push notification service (e.g., `utils/pushNotificationService.js`)

### Ensure Payload Includes iOS-Specific Fields

Update your notification message construction to include iOS-specific fields:

```javascript
const message = {
  to: pushToken,
  sound: 'default',           // Required for sound
  title: title,               // Required for display
  body: body,                 // Required for display
  data: {
    ...data,
    type: data.type || 'lecture_reminder',
  },
  priority: 'high',
  channelId: 'default',       // Android only
  
  // iOS-specific fields for proper notification display
  badge: data.badge !== undefined ? data.badge : 1,  // Badge count (iOS)
  subtitle: data.subtitle || undefined,              // Optional subtitle (iOS)
  categoryId: data.categoryId || 'default',         // Category identifier (iOS)
};
```

**Critical Fields:**
- ✅ `title` - Must be present (not just in `data`)
- ✅ `body` - Must be present (not just in `data`)
- ✅ `sound: 'default'` - Required for iOS to treat as alert (not silent)
- ✅ `badge` - Helps iOS recognize this as a user-facing notification
- ✅ `subtitle` - Optional but recommended
- ✅ `categoryId` - Optional but recommended

**Why:** iOS treats notifications without `title`, `body`, and `sound` as "silent" or "data-only" notifications, which won't display banners or appear on the lock screen.

---

## Step 4: Initialize Notifications in App.js

**File:** `App.js` (or your root component)

Ensure notifications are initialized early in your app lifecycle:

```javascript
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { initializeNotifications, setupNotificationListeners } from './services/notificationService';

export default function App() {
  useEffect(() => {
    // Initialize notifications on app launch
    const initNotifications = async () => {
      try {
        // Request permissions and register push token
        await initializeNotifications();
        
        // Set up notification listeners
        setupNotificationListeners(
          (notification) => {
            console.log('Notification received:', notification);
            // Handle notification received
          },
          (response) => {
            console.log('Notification tapped:', response);
            // Handle notification tap
          }
        );
      } catch (error) {
        console.error('Error initializing notifications:', error);
      }
    };

    initNotifications();
  }, []);

  // ... rest of your app
}
```

**Note:** The `setNotificationHandler` in your notification service will be executed automatically when the module is imported, so it runs before any notification code.

---

## Step 5: Rebuild Native Code

After making changes to `app.json`, you **must** rebuild the native iOS project:

```bash
# Clean and regenerate native code
npx expo prebuild --clean

# Then rebuild your iOS app
# For development build:
npx expo run:ios

# Or build with EAS:
eas build --platform ios
```

**Why:** Changes to `app.json` plugins and iOS configuration require native code regeneration.

---

## Step 6: Test on Physical iOS Device

⚠️ **Important:** Push notifications **do not work** in the iOS Simulator. You must test on a **physical iOS device**.

### Testing Checklist

1. **First Launch - Permission Prompt**
   - App should request notification permissions
   - User must grant **all three** (Alerts, Badges, Sounds)
   - Check in iOS Settings → Your App → Notifications

2. **Foreground Test**
   - Send push notification while app is open
   - ✅ Should show banner at top of screen
   - ✅ Should play sound
   - ✅ Should update badge count

3. **Background Test**
   - Send push notification while app is in background
   - ✅ Should show notification banner
   - ✅ Should appear in Notification Center

4. **Lock Screen Test**
   - Lock device
   - Send push notification
   - ✅ Should appear on lock screen
   - ✅ Should wake screen (if device settings allow)

5. **Notification Center Test**
   - Swipe down from top of screen
   - ✅ Notification should appear in Notification Center

---

## Common Issues & Solutions

### Issue 1: Notifications Still Not Showing

**Check:**
- ✅ Did you run `npx expo prebuild --clean` after changing `app.json`?
- ✅ Are you testing on a **physical device** (not simulator)?
- ✅ Did user grant **all three** permission types (Alerts, Badges, Sounds)?
- ✅ Is `setNotificationHandler` called **before** any notification listeners?

**Solution:** 
- Delete app from device
- Rebuild and reinstall
- Grant permissions again

### Issue 2: Notifications Work in Foreground but Not Background

**Check:**
- ✅ Backend payload includes `title`, `body`, and `sound: 'default'`
- ✅ Backend payload includes `badge` field
- ✅ iOS device notification settings allow banners/alerts

**Solution:**
- Verify backend is sending complete payload (not just `data` field)
- Check iOS Settings → Your App → Notifications → Allow Notifications is ON

### Issue 3: Silent/Data-Only Notifications

**Symptom:** Notifications received but no banner/sound/lock screen display.

**Cause:** Backend payload missing `title`, `body`, or `sound`.

**Solution:**
```javascript
// ❌ WRONG - Silent notification
{
  to: pushToken,
  data: { title: "Hello", body: "World" }  // Title/body in data only
}

// ✅ CORRECT - Alert notification
{
  to: pushToken,
  title: "Hello",        // At root level
  body: "World",         // At root level
  sound: "default",      // Required
  badge: 1,              // iOS-specific
  data: { type: "reminder" }
}
```

### Issue 4: Permissions Not Requesting Properly

**Check:**
- ✅ Using `requestPermissionsAsync` with iOS-specific options
- ✅ Not using deprecated permission methods

**Solution:**
```javascript
// ✅ CORRECT
await Notifications.requestPermissionsAsync({
  ios: {
    allowAlert: true,
    allowBadge: true,
    allowSound: true,
  },
});

// ❌ WRONG - Missing iOS-specific options
await Notifications.requestPermissionsAsync();
```

---

## Verification Checklist

Before considering the fix complete, verify:

- [ ] `app.json` has `iosDisplayInForeground: true` in expo-notifications plugin
- [ ] `setNotificationHandler` is configured with all options enabled
- [ ] Permission request includes iOS-specific options (allowAlert, allowBadge, allowSound)
- [ ] Backend payload includes `title`, `body`, `sound: 'default'`, and `badge`
- [ ] Ran `npx expo prebuild --clean` after app.json changes
- [ ] Testing on physical iOS device (not simulator)
- [ ] User granted all notification permissions
- [ ] Notifications appear as banners when app is in foreground
- [ ] Notifications appear on lock screen when device is locked
- [ ] Notifications appear in Notification Center

---

## File Locations Summary

| Change | File Location |
|--------|--------------|
| iOS display configuration | `app.json` → `plugins` → `expo-notifications` → `iosDisplayInForeground` |
| Permission request | `services/notificationService.js` → `requestNotificationPermissions()` |
| Notification handler | `services/notificationService.js` → `Notifications.setNotificationHandler()` |
| Backend payload | `backend/utils/pushNotificationService.js` → message construction |
| App initialization | `App.js` → `useEffect` → `initializeNotifications()` |

---

## Additional Resources

- [Expo Notifications Documentation](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [iOS Notification Best Practices](https://developer.apple.com/documentation/usernotifications)
- [Expo Push Notification Tool](https://expo.dev/notifications) - Test push notifications

---

## Quick Reference: Complete Notification Service Setup

```javascript
// notificationService.js
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// 1. SET HANDLER FIRST (at top of file)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// 2. REQUEST PERMISSIONS WITH iOS OPTIONS
export const requestNotificationPermissions = async () => {
  const { status } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });
  return status === 'granted';
};

// 3. GET PUSH TOKEN
export const getPushToken = async () => {
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return null;
  
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: 'your-project-id', // From app.json
  });
  return tokenData.data;
};
```

---

**Last Updated:** 2024
**Tested With:** Expo SDK 49+, React Native, iOS 15+


