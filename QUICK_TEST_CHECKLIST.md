# Quick Testing Checklist - Push Notifications

Follow these steps in order to test the complete push notification system.

## Prerequisites ✅

- [ ] Backend server is running (`npm run dev` in backend folder)
- [ ] Frontend app is running (`npm start` in frontend folder)
- [ ] MongoDB is connected and working
- [ ] You have Expo Go app on your phone OR development build installed

---

## Test 1: User Registration & Push Token Registration

### Steps:
1. **Create a new student account**
   - Open app → Sign Up
   - Enter: Full Name, Phone Number, Password
   - Select "Student" role
   - Complete signup

### Expected Results:
- [ ] Account created successfully
- [ ] Navigated to Student Home screen
- [ ] Check console: Should see "Push token registered successfully"
- [ ] Check database:
   ```javascript
   db.users.findOne({ phoneNumber: "YOUR_PHONE" })
   ```
   - [ ] `pushToken` should NOT be `null`
   - [ ] `pushToken` should be like: `"ExponentPushToken[...]"`
   - [ ] `notificationsEnabled` should be `true`
   - [ ] `reminderMinutes` should be `15`

### If Failed:
- Check console for errors
- Verify notification permissions were granted
- Check if projectId is configured in app.json

---

## Test 2: Notification Settings

### Steps:
1. **Go to Settings**
   - Navigate to Settings (bottom nav)
   - Find "Notifications" section

### Expected Results:
- [ ] "Enable Notifications" toggle is ON
- [ ] "Remind me before (minutes)" input is visible
- [ ] Input shows "15" (or your current setting)

### Test Changing Settings:
1. Change reminder minutes to `5` (for quick testing)
2. Tap "Save Settings"

### Expected Results:
- [ ] Success message: "Settings saved successfully"
- [ ] Check database:
   ```javascript
   db.users.findOne({ phoneNumber: "YOUR_PHONE" }, { reminderMinutes: 1 })
   ```
   - [ ] `reminderMinutes` should be `5`

### Test Disable/Enable:
1. Toggle "Enable Notifications" OFF
2. Save Settings
3. Check database: `pushToken` should be `null`
4. Toggle back ON
5. Save Settings
6. Check database: `pushToken` should be registered again

---

## Test 3: Course Creation (as Course Rep)

### Steps:
1. **Login as Course Rep** (or create new course rep account)
2. **Create a Course**
   - Go to Add Course
   - Fill in:
     - Course Name: "Test Course"
     - Course Code: "TEST101"
     - Days: Select **TODAY'S DAY** (e.g., if today is Monday, select Monday)
     - Start Time: Set to **5-10 minutes from now** (e.g., if it's 2:00 PM, set to 2:05 PM or 2:10 PM)
     - End Time: Any time after start time
     - Venue: "Test Venue"
   - Save course
   - Note the course code

### Expected Results:
- [ ] Course created successfully
- [ ] Course code displayed
- [ ] Course appears in Course Rep's course list

---

## Test 4: Student Enrollment

### Steps:
1. **Login as Student** (the one you created in Test 1)
2. **Enroll in Course**
   - Go to "Add Course" screen
   - Enter the course code from Test 3
   - Tap "Enroll"

### Expected Results:
- [ ] Course details displayed
- [ ] Successfully enrolled
- [ ] Check console: "Push token registered successfully" (backup registration)
- [ ] Course appears in "My Courses"

---

## Test 5: Manual Reminder Job Test (Quick Test)

### Option A: Add Test Endpoint (Recommended)

Add this to `backend/src/routes/notifications.js`:

```javascript
// Add after other routes, before module.exports
router.post('/test-reminders', authenticate, async (req, res) => {
  try {
    const { processClassReminders } = require('../utils/classReminderJob');
    const result = await processClassReminders();
    res.json({ 
      success: true, 
      message: 'Reminder job executed',
      result 
    });
  } catch (error) {
    console.error('Test reminders error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});
```

### Steps:
1. **Get your auth token** (from AsyncStorage or login response)
2. **Call the test endpoint:**
   ```bash
   curl -X POST http://localhost:3000/api/notifications/test-reminders \
     -H "Authorization: Bearer YOUR_STUDENT_TOKEN" \
     -H "Content-Type: application/json"
   ```

   OR use Postman/Thunder Client:
   - Method: POST
   - URL: `http://localhost:3000/api/notifications/test-reminders`
   - Headers: `Authorization: Bearer YOUR_TOKEN`

### Expected Results:
- [ ] Backend console shows:
  ```
  Processing class reminders...
  Sent reminder to user [ID] for course Test Course
  Class reminders processed: 1, sent: 1
  ```
- [ ] Response shows: `{ "success": true, "result": { "processed": 1, "sent": 1 } }`
- [ ] **Your phone receives push notification!**
  - Title: "Class Reminder"
  - Body: "Your Test Course class starts in 5 minutes at Test Venue. Time: [time]"

### Option B: Wait for Scheduled Job

If you don't want to add test endpoint:
1. Wait for the job to run (runs every 5 minutes)
2. Watch backend console for the same logs

---

## Test 6: Verify Notification Content

### Steps:
1. **Tap on the notification** you received
2. **Check console logs** (if you have notification listeners set up)

### Expected Results:
- [ ] Notification opens the app
- [ ] Console shows notification data:
  ```javascript
  {
    courseId: "...",
    courseName: "Test Course",
    type: "lecture_reminder"
  }
  ```

---

## Test 7: Duplicate Prevention

### Steps:
1. **Call test endpoint again immediately** (or wait for next job run)
2. **Check results**

### Expected Results:
- [ ] Backend console shows:
  ```
  Processing class reminders...
  Class reminders processed: 1, sent: 0
  ```
- [ ] **No duplicate notification received**
- [ ] This is correct! The system prevents sending the same notification twice per day

---

## Test 8: Different Reminder Times

### Steps:
1. **Create another student account**
2. **Set reminder to 10 minutes** (in Settings)
3. **Enroll in the same course**
4. **Create a new course** with start time 10 minutes from now
5. **Enroll new student in new course**
6. **Run test endpoint**

### Expected Results:
- [ ] Both students receive notifications
- [ ] Each gets notification at their preferred reminder time
- [ ] Student 1 (5 min): Gets notification 5 min before class
- [ ] Student 2 (10 min): Gets notification 10 min before class

---

## Test 9: Multiple Days Course

### Steps:
1. **Create course with multiple days** (e.g., Monday, Wednesday, Friday)
2. **Set different times for each day** (if using dayTimes)
3. **Enroll student**
4. **Test on different days**

### Expected Results:
- [ ] Notification sent for each day separately
- [ ] Correct time used for each day
- [ ] No duplicate notifications on same day

---

## Test 10: Disabled Notifications

### Steps:
1. **Disable notifications** in Settings
2. **Enroll in a course**
3. **Run test endpoint**

### Expected Results:
- [ ] Backend console: User skipped (notificationsEnabled: false)
- [ ] **No notification received**
- [ ] This is correct behavior

---

## Test 11: Login Flow

### Steps:
1. **Logout** from the app
2. **Login again** with same account
3. **Check database**

### Expected Results:
- [ ] Login successful
- [ ] Check console: "Push token registered successfully"
- [ ] Database: `pushToken` is updated/registered

---

## Common Issues & Solutions

### Issue: "No notification received"

**Check:**
1. Database: Does user have `pushToken`? (should not be null)
2. Database: Is `notificationsEnabled` true?
3. Backend logs: Did job run? Any errors?
4. Course time: Is it in the future? Is it today?
5. Reminder time: Is current time within reminder window?
   - Example: Class at 2:00 PM, reminder 5 min
   - Notification sent between 1:55 PM - 2:00 PM

**Debug:**
```javascript
// Check user
db.users.findOne({ phoneNumber: "YOUR_PHONE" })

// Check enrollments
db.enrollments.find({ userId: ObjectId("USER_ID") })

// Check courses
db.courses.find({ _id: ObjectId("COURSE_ID") })
```

### Issue: "Invalid Expo push token"

**Solution:**
- Restart Expo server: `npm start -- --clear`
- Re-login to get new token
- Check projectId in app.json

### Issue: "Job not running"

**Check:**
- Backend console: Should see "Class reminder job started"
- Wait 5 minutes or use test endpoint
- Check server logs for errors

### Issue: "Token not registering"

**Check:**
- Notification permissions granted?
- ProjectId configured?
- Check console for errors
- Try force registration: Toggle notifications off/on in Settings

---

## Success Criteria ✅

Your implementation is working if:

- [x] New users get push token registered on signup
- [x] Existing users get push token registered on login
- [x] Settings can enable/disable notifications
- [x] Settings can change reminder minutes
- [x] Students can enroll in courses
- [x] Reminder job runs (check logs)
- [x] Push notifications are received on device
- [x] Notification content is correct (course name, time, venue)
- [x] No duplicate notifications
- [x] Disabled notifications don't send

---

## Next Steps After Testing

1. **Remove test endpoint** (if you added it)
2. **Test on real device** (not just simulator)
3. **Test with multiple users simultaneously**
4. **Monitor backend logs** for any errors
5. **Test edge cases:**
   - Courses with no venue
   - Courses spanning multiple weeks
   - Timezone changes
   - App backgrounded/foregrounded

---

## Quick Test Command Summary

```bash
# 1. Start backend
cd backend && npm run dev

# 2. Start frontend (in new terminal)
cd frontend && npm start

# 3. Test reminder job (after setting up course)
curl -X POST http://localhost:3000/api/notifications/test-reminders \
  -H "Authorization: Bearer YOUR_TOKEN"

# 4. Check database
# In MongoDB shell or Compass:
db.users.findOne({ phoneNumber: "YOUR_PHONE" })
db.enrollments.find({ userId: ObjectId("USER_ID") })
db.courses.find({ _id: ObjectId("COURSE_ID") })
```

---

**Good luck with testing! 🚀**





