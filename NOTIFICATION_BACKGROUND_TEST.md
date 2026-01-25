# Notification Background Test Checklist

## ✅ Configuration Verified

### 1. **Android Configuration** ✅
- ✅ Notification channel created with `HIGH` importance
- ✅ `lockscreenVisibility: PUBLIC` - notifications show on lock screen
- ✅ Sound enabled
- ✅ Vibration enabled
- ✅ Backend sends `priority: 'high'` in notification payload
- ✅ Backend includes Android-specific fields

### 2. **iOS Configuration** ✅
- ✅ `UIBackgroundModes: ["remote-notification"]` in app.json
- ✅ Permissions requested: alert, badge, sound
- ✅ Backend sends `sound: 'default'` (required for background notifications)
- ✅ Backend includes `title` and `body` at root level (not just in data)

### 3. **Backend Payload** ✅
- ✅ `priority: 'high'` - ensures notification appears even when screen is off
- ✅ `sound: 'default'` - required for iOS background notifications
- ✅ `title` and `body` at root level - required for display
- ✅ Android-specific fields included

## 🧪 Testing Steps

### Test 1: Screen Off / Locked
1. Lock your phone (screen off)
2. Have someone send a notification (or use backend API)
3. **Expected:** Notification should appear on lock screen and wake device

### Test 2: App in Background
1. Open the app, then press home button (app in background)
2. Have someone send a notification
3. **Expected:** Notification should appear in notification tray

### Test 3: App Closed
1. Force close the app completely
2. Have someone send a notification
3. **Expected:** Notification should appear in notification tray

## 🔍 Verification Points

### Android:
- Check notification channel importance: Settings → Apps → LectureLet → Notifications
- Should show "Lecture Reminders" channel with "High" importance
- Lock screen visibility should be "Show all notification content"

### iOS:
- Check notification permissions: Settings → LectureLet → Notifications
- All permissions should be enabled: Allow Notifications, Sounds, Badges, Alerts
- Lock Screen should be enabled

## ⚠️ Common Issues

1. **Notifications not appearing when screen is off:**
   - Check battery optimization: Settings → Apps → LectureLet → Battery → Unrestricted
   - Check notification channel importance (should be HIGH)
   - Verify backend is sending `priority: 'high'`

2. **iOS notifications not showing:**
   - Verify `sound: 'default'` is in payload
   - Verify `title` and `body` are at root level (not just in data)
   - Check notification permissions are fully granted

3. **Notifications only work when app is open:**
   - Push token may not be registered
   - Check backend logs for token registration
   - Verify user has active access (payment or trial)

## 📝 Current Configuration Status

✅ **Android Channel:** HIGH importance, PUBLIC lock screen visibility
✅ **iOS Background Modes:** remote-notification enabled
✅ **Backend Payload:** High priority, sound, title/body at root level
✅ **Permissions:** Requested early in app lifecycle

**Status: ✅ Configured for background notifications**
