# Push Notification System - Testing Guide

This guide will help you test the complete push notification implementation to ensure everything works correctly.

## Prerequisites

1. **Install Dependencies**
   ```bash
   # Frontend
   cd frontend
   npm install

   # Backend
   cd ../backend
   npm install
   ```

2. **Ensure MongoDB is running**
   - Make sure your MongoDB database is accessible
   - Check your `.env` file has correct database connection string

3. **Expo Setup**
   - Make sure you have Expo Go app installed on your phone, OR
   - Have a development build set up

## Step-by-Step Testing

### 1. Start the Backend Server

```bash
cd backend
npm run dev
# or
npm start
```

**Verify:**
- Server starts without errors
- You see: "Class reminder job started (runs every 5 minutes)"
- Server is listening on the configured port (default: 3000)

### 2. Start the Frontend App

```bash
cd frontend
npm start
# or
expo start
```

**Verify:**
- App starts without errors
- No console errors about missing modules

### 3. Test User Registration/Login

1. **Create a Student Account**
   - Sign up with a new phone number
   - Role: Student
   - Complete registration

2. **Login**
   - Login with the created account
   - Verify you can access the app

### 4. Test Notification Permissions

**Expected Behavior:**
- On app launch, you should be prompted for notification permissions
- Check the console for: "Push token registered successfully" or permission denial messages

**Manual Test:**
1. Go to Settings screen
2. Toggle "Enable Notifications" ON
3. You should see a permission prompt (if not already granted)
4. Grant permissions
5. Check console for token registration

### 5. Test Push Token Registration

**Check Backend:**
1. After enabling notifications, check your MongoDB database:
   ```javascript
   // In MongoDB shell or Compass
   db.users.findOne({ phoneNumber: "YOUR_PHONE_NUMBER" })
   // Should show: pushToken: "ExponentPushToken[...]"
   ```

**Check API:**
```bash
# Test token registration endpoint
curl -X POST http://localhost:3000/api/notifications/register-token \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pushToken": "ExponentPushToken[test]"}'
```

### 6. Test Notification Settings

1. **Go to Settings Screen**
   - Navigate to Settings (bottom navigation)

2. **Test Enable/Disable**
   - Toggle "Enable Notifications" OFF
   - Tap "Save Settings"
   - Verify: Push token should be removed from backend
   - Toggle back ON
   - Tap "Save Settings"
   - Verify: Push token should be registered again

3. **Test Reminder Minutes**
   - Set reminder to 5 minutes (for testing)
   - Tap "Save Settings"
   - Verify: Settings saved successfully message
   - Check backend: User's `reminderMinutes` should be updated

### 7. Test Course Enrollment

1. **Create a Course (as Course Rep)**
   - Login as Course Rep
   - Create a course with:
     - Days: ["Monday", "Wednesday"] (or current day)
     - Start Time: Set to 5-10 minutes from now (for testing)
     - End Time: Any time after start
     - Venue: "Test Venue"

2. **Enroll as Student**
   - Login as Student
   - Go to "Add Course"
   - Enter the course code
   - Enroll in the course
   - **Verify:** Console should show "Push token registered successfully"

### 8. Test Push Notification Delivery

**Option A: Wait for Scheduled Job (5 minutes)**
- The job runs every 5 minutes
- Wait for the next run cycle
- Check console logs for: "Processing class reminders..."

**Option B: Manually Trigger Job (Recommended for Testing)**

Add this temporary endpoint to test immediately:

```javascript
// In backend/src/routes/notifications.js (temporary for testing)
router.post('/test-reminders', authenticate, async (req, res) => {
  const { processClassReminders } = require('../utils/classReminderJob');
  const result = await processClassReminders();
  res.json({ success: true, result });
});
```

Then call it:
```bash
curl -X POST http://localhost:3000/api/notifications/test-reminders \
  -H "Authorization: Bearer YOUR_STUDENT_TOKEN"
```

**Verify:**
- Check backend console for:
  - "Processing class reminders..."
  - "Sent reminder to user [ID] for course [Name]"
  - "Class reminders processed: X, sent: Y"

- Check your phone/device:
  - You should receive a push notification
  - Notification title: "Class Reminder"
  - Notification body: "Your [Course Name] class starts in [X] minutes at [Venue]"

### 9. Test Notification Content

**Verify Notification Data:**
- Tap on the notification
- Check console for notification data
- Should contain: `courseId`, `courseName`, `type: 'lecture_reminder'`

### 10. Test Edge Cases

#### Test 1: Multiple Courses
- Enroll in 2-3 courses with different times
- Verify notifications are sent for each course separately

#### Test 2: Different Reminder Times
- Create multiple student accounts
- Set different reminder minutes (5, 15, 30)
- Create courses that trigger at different times
- Verify each student gets notification at their preferred time

#### Test 3: Duplicate Prevention
- Enroll in a course
- Wait for notification
- Manually trigger job again immediately
- **Verify:** No duplicate notification (should be skipped)

#### Test 4: Disabled Notifications
- Disable notifications in Settings
- Enroll in a course
- Wait for reminder time
- **Verify:** No notification sent

#### Test 5: No Push Token
- Remove push token from user in database
- Wait for reminder time
- **Verify:** Job runs but skips user (no errors)

#### Test 6: Multiple Days
- Create course with multiple days (e.g., Monday, Wednesday, Friday)
- Verify notification is sent for each day separately

#### Test 7: Different Times Per Day
- Create course with `dayTimes` object:
  ```json
  {
    "Monday": { "startTime": "10:00 AM", "endTime": "11:00 AM" },
    "Wednesday": { "startTime": "2:00 PM", "endTime": "3:00 PM" }
  }
  ```
- Verify notifications use correct time for each day

### 11. Check Backend Logs

**Monitor these logs:**
```
✅ "Class reminder job started (runs every 5 minutes)"
✅ "Processing class reminders..."
✅ "Sent reminder to user [ID] for course [Name]"
✅ "Class reminders processed: X, sent: Y"
```

**Watch for errors:**
- Invalid push tokens
- Database connection issues
- Time parsing errors

### 12. Test Notification Listeners

**In App.js:**
- Check console when notification is received
- Should see: "Notification received: [notification object]"
- Tap notification
- Should see: "Notification tapped: [response object]"

## Debugging Tips

### If Notifications Don't Arrive:

1. **Check Push Token:**
   ```javascript
   // In MongoDB
   db.users.findOne({ phoneNumber: "YOUR_PHONE" }, { pushToken: 1 })
   ```
   - Should have a valid Expo push token
   - Format: `ExponentPushToken[...]`

2. **Check User Settings:**
   ```javascript
   db.users.findOne({ phoneNumber: "YOUR_PHONE" }, { 
     notificationsEnabled: 1, 
     reminderMinutes: 1 
   })
   ```
   - `notificationsEnabled` should be `true`
   - `reminderMinutes` should be a number

3. **Check Course Schedule:**
   - Verify course has valid `days` array
   - Verify `startTime` is in correct format
   - Verify course is in the future

4. **Check Job Timing:**
   - Job runs every 5 minutes
   - Notification is sent when: `currentTime + reminderMinutes >= classStartTime`
   - Example: If class is at 2:00 PM and reminder is 15 minutes, notification sent at 1:45 PM

5. **Check Console Logs:**
   - Look for errors in backend console
   - Check for "Invalid Expo push token" messages
   - Check for time parsing errors

6. **Test Push Token Manually:**
   ```bash
   # Use Expo's push notification tool
   # Or use curl to test Expo API directly
   curl -H "Content-Type: application/json" \
        -X POST https://exp.host/--/api/v2/push/send \
        -d '{
          "to": "YOUR_PUSH_TOKEN",
          "title": "Test",
          "body": "Test notification"
        }'
   ```

### Common Issues:

1. **"Invalid Expo push token"**
   - Token format is wrong
   - Token expired or invalid
   - Solution: Re-register token

2. **"No users with notifications enabled"**
   - User's `notificationsEnabled` is false
   - User doesn't have `pushToken`
   - Solution: Enable notifications in Settings

3. **"Time parsing error"**
   - Time format is incorrect
   - Solution: Check course time format (should be "10:00 AM" or "14:30")

4. **Notifications arrive too early/late**
   - Check `reminderMinutes` setting
   - Check job timing (runs every 5 minutes, so ±5 min variance is normal)

## Quick Test Checklist

- [ ] Backend server starts without errors
- [ ] Frontend app starts without errors
- [ ] Can login as student
- [ ] Notification permissions requested on app launch
- [ ] Push token registered in database
- [ ] Settings screen shows notification preferences
- [ ] Can enable/disable notifications
- [ ] Can set reminder minutes
- [ ] Settings save successfully
- [ ] Can enroll in course
- [ ] Push token registered after enrollment
- [ ] Course created with valid schedule
- [ ] Reminder job runs (check logs)
- [ ] Notification received on device
- [ ] Notification content is correct
- [ ] No duplicate notifications
- [ ] Disabled notifications don't send

## Production Considerations

Before deploying:

1. **Remove test endpoints** (if added)
2. **Set proper environment variables**
3. **Configure production Expo project**
4. **Test on real devices** (not just simulator)
5. **Monitor error logs**
6. **Set up error tracking** (Sentry, etc.)
7. **Test with multiple users simultaneously**

## Additional Resources

- [Expo Notifications Documentation](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Expo Push Notification API](https://docs.expo.dev/push-notifications/sending-notifications/)
- Check Expo dashboard for push notification delivery status

