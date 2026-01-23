# LectureLet - Complete Technical & Functional Breakdown
## Apple App Store Review Documentation

**Document Version:** 1.0  
**App Name:** LectureLet  
**Bundle Identifier:** com.LectureLet.app  
**Version:** 1.0.5  
**Build Number:** 10

---

## 1. App Overview

### App Name
**LectureLet**

### Core Purpose
LectureLet is a university course management mobile application designed to facilitate communication and organization between course representatives (lecturers/teaching assistants) and students. The app enables course representatives to create and manage courses, while students can enroll in courses, receive class reminders, and stay updated with course announcements.

### Target Users
- **Primary Users:** University students and course representatives (lecturers/teaching assistants)
- **Student Users:** Enroll in courses, receive notifications about classes, view course schedules, and access course-related information
- **Course Representative Users:** Create courses, manage student enrollments, send announcements, schedule quizzes/tutorials/assignments, and update course information

### Primary Problem Solved
The app addresses the challenge of timely communication between course representatives and students in university settings. It solves:
- **Missed Classes:** Students receive automated reminders before their classes start
- **Last-Minute Changes:** Students are notified via push notifications and SMS when course details (venue, time, schedule) change, especially within 30 minutes of class time
- **Course Organization:** Centralized platform for course information, schedules, and announcements
- **Access Management:** Controlled enrollment system with unique course codes and optional phone number whitelisting

---

## 2. User Roles & Access Levels

### User Types

#### 2.1 Guest Users (Unauthenticated)
**Capabilities:**
- Browse and search for courses using course name, code, or representative name
- View course details by entering a 5-digit unique course code
- Preview course information (course name, code, schedule, venue, credit hours, student count)
- Cannot enroll in courses
- Cannot receive notifications
- Cannot access paid features

**Restrictions:**
- Cannot create an account
- Cannot join courses
- Cannot access any personalized features

**Technical Enforcement:**
- Routes marked with `optionalAuth` middleware allow unauthenticated access
- Frontend checks `isAuthenticated` state before allowing enrollment actions
- Enrollment endpoint requires authentication (`authenticate` middleware)

#### 2.2 Student Users (Authenticated, Role: 'student')
**Capabilities:**
- Create account with phone number and password
- Enroll in courses using unique 5-digit codes
- View enrolled courses and course details
- Receive push notifications for:
  - Class reminders (configurable, default 15 minutes before class)
  - Course updates (venue changes, time changes, cancellations)
  - Announcements from course representatives
- Receive SMS notifications for urgent updates (within 30 minutes of class time)
- View course schedules, quizzes, tutorials, and assignments
- Unenroll from courses
- Access 7-day free trial on first course enrollment
- Make one-time payment (GHS 25) to unlock full access after trial expires
- Configure notification preferences (enable/disable, reminder timing)
- Update profile information
- Delete account (with restrictions if enrolled in courses)

**Restrictions:**
- Cannot create courses
- Cannot send announcements
- Cannot add quizzes, tutorials, or assignments
- Cannot view student lists for courses
- Cannot modify course information
- Cannot delete account if they have created courses (only applies if role changes to course_rep)

**Technical Enforcement:**
- Role-based authorization: `authorize('student')` middleware on student-specific routes
- Access control: `hasActiveAccess()` method checks `paymentStatus` OR `isTrialActive()`
- Enrollment restrictions: Backend checks access status before allowing enrollment
- Notification restrictions: Push notifications and SMS only sent if `hasActiveAccess()` returns true

#### 2.3 Course Representative Users (Authenticated, Role: 'course_rep')
**Capabilities:**
- Create courses with:
  - Course name and code
  - Schedule (days of week, start/end times, or per-day time schedules)
  - Venue information
  - Credit hours
  - Index range (from/to)
  - Optional phone number whitelist for enrollment control
- Generate unique 5-digit course codes for student enrollment
- View all courses they created
- Update course information (permanent or temporary edits)
- Delete courses (removes all enrollments and related data)
- View list of enrolled students for each course
- Manually add students to courses by phone number
- Remove students from courses
- Send announcements to all enrolled students
- Create quizzes, tutorials, and assignments for courses
- Receive notifications when students enroll
- Update profile and switch between student/course_rep roles
- Delete account (only if no courses created)

**Restrictions:**
- Cannot enroll in courses as a student (must switch role to 'student')
- Cannot receive class reminders (only students receive these)
- Cannot make payments (payment system is for students only)
- Cannot delete account if courses exist (must delete or transfer courses first)

**Technical Enforcement:**
- Role-based authorization: `authorize('course_rep')` middleware on course creation/management routes
- Creator verification: `Course.isCreator(courseId, userId)` checks ownership before allowing modifications
- Account deletion protection: Backend checks for existing courses before allowing account deletion
- Role switching: Users can change role via profile update endpoint

---

## 3. Authentication & Account Management

### 3.1 User Sign Up Process

**Method:** Phone number and password (no social login)

**Step-by-Step Process:**
1. User opens app and navigates to Sign Up screen
2. User provides:
   - Phone number (required, unique, trimmed)
   - Password (minimum 6 characters)
   - Full name (required)
   - Role selection: 'student' or 'course_rep'
   - Optional: Student ID
   - Optional: College selection (must be from active colleges list)
3. Frontend sends POST request to `/api/auth/signup`
4. Backend validation:
   - Validates all required fields
   - Checks if phone number already exists (409 Conflict if duplicate)
   - Validates college name against database (if provided)
   - Validates role is either 'student' or 'course_rep'
5. Backend creates user:
   - Hashes password using bcrypt (10 rounds)
   - Sets default values:
     - `notificationsEnabled: true`
     - `reminderMinutes: 15`
     - `paymentStatus: false`
     - `trialStartDate: null`
     - `trialEndDate: null`
6. Backend generates JWT token (expires based on config, typically 7 days)
7. Response includes:
   - JWT token
   - User data (without password)
   - Success message
8. Frontend stores:
   - Token in AsyncStorage (`@auth_token`)
   - User data in AsyncStorage (`@user_data`)
9. Frontend navigates to appropriate home screen based on role

**Technical Details:**
- Password hashing: bcrypt with salt rounds of 10
- Token generation: JWT with user ID payload
- Phone number uniqueness: Enforced at database level (MongoDB unique index)
- Error handling: Returns 409 for duplicate phone numbers, 400 for validation errors

### 3.2 Login Process

**Step-by-Step Process:**
1. User enters phone number and password
2. Frontend sends POST request to `/api/auth/login`
3. Backend validation:
   - Finds user by phone number (case-insensitive, trimmed)
   - Verifies password using bcrypt comparison
4. If credentials valid:
   - Generates new JWT token
   - Returns user data (without password)
   - Includes trial status, payment status, notification preferences
5. If credentials invalid:
   - Returns 401 Unauthorized with generic message (does not reveal which field is wrong)
6. Frontend stores token and user data
7. Frontend registers push notification token (if notifications enabled)
8. Frontend navigates to home screen based on role

**Security Features:**
- Generic error messages prevent user enumeration
- Passwords never returned in responses
- JWT tokens expire and require re-authentication
- Token verification on every authenticated request

### 3.3 Password Reset

**Current Status:** Password reset functionality is NOT implemented in the current codebase.

**Implications:**
- Users cannot reset forgotten passwords through the app
- Users must contact support or create a new account if password is forgotten
- This is a limitation that should be addressed in future updates

**Recommendation for App Store Review:**
- This limitation should be clearly stated in app description or support documentation
- Consider implementing password reset via SMS or email in future updates

### 3.4 Account Deletion Process

**Step-by-Step Process:**

1. **User Initiates Deletion:**
   - User navigates to Settings screen
   - User taps "Delete Account" option
   - Frontend shows confirmation dialog
   - User confirms deletion

2. **Frontend Request:**
   - Frontend sends DELETE request to `/api/auth/account`
   - Includes JWT token in Authorization header

3. **Backend Verification:**
   - Authenticates user via JWT token
   - Fetches user from database
   - Checks user role

4. **Role-Specific Checks:**
   - **If user is 'course_rep':**
     - Queries database for courses created by user
     - If courses exist, returns 403 Forbidden with message: "Cannot delete account. Please delete or transfer ownership of your courses first."
     - User must delete all courses before account deletion
   - **If user is 'student':**
     - No course ownership check (students don't create courses)
     - Proceeds to deletion

5. **Data Deletion (All User Types):**
   - **Enrollments:** Deletes all Enrollment records where `userId` matches
   - **Notifications:** Deletes all Notification records where `userId` matches (uses `Notification.deleteAllForUser()`)
   - **User Account:** Deletes User record from database

6. **Data NOT Deleted (Retained):**
   - **Payment Records:** Payment records are NOT deleted
     - **Reason:** Financial transaction records must be retained for accounting, tax, and legal compliance purposes
     - **Data Retained:** Payment reference, amount, currency, status, timestamps, email, metadata
   - **SMS Logs:** SMS logs are NOT deleted
     - **Reason:** Audit trail for SMS notifications sent, compliance with telecommunications regulations
     - **Data Retained:** Phone number, message content, timestamp, SMS type, course ID
   - **Courses Created (if course_rep):** Courses are NOT automatically deleted
     - **Reason:** Other students may be enrolled; course data is valuable
     - **Action Required:** User must manually delete courses before account deletion

7. **Response:**
   - Returns 200 OK with success message
   - Frontend clears AsyncStorage (token and user data)
   - Frontend navigates to login/signup screen

**Technical Implementation:**
```javascript
// Backend deletion logic (from auth.js)
- Check for courses (if course_rep)
- Delete enrollments: Enrollment.deleteMany({ userId })
- Delete notifications: Notification.deleteAllForUser(userId)
- Delete user: User.findByIdAndDelete(userId)
```

**Data Retention Compliance:**
- Payment records retained for financial compliance
- SMS logs retained for audit purposes
- No personal identifiers in retained records (user ID removed, but email/phone may remain for transaction records)

---

## 4. Subscription, Payments & Monetization

### 4.1 Payment Model

**Type:** One-time payment (NOT a subscription)

**Payment Amount:** GHS 25 (Ghana Cedis) - Fixed, non-negotiable

**Payment Currency:** GHS (Ghana Cedis)

**Payment Gateway:** Paystack (third-party payment processor)

### 4.2 Free Trial System

**Trial Duration:** 7 days

**Trial Activation:**
- Automatically activated when a student enrolls in their FIRST course
- Only one trial per user (cannot be restarted)
- Trial starts immediately upon first enrollment
- Trial end date = trial start date + 7 days

**Trial Access:**
- Full access to all features during trial period
- Can enroll in unlimited courses
- Receives all notifications (push and SMS)
- No restrictions during trial

**Trial Expiration:**
- After 7 days, trial automatically expires
- User loses access if payment not made
- Cannot enroll in new courses
- Push notifications and SMS stop (in-app notifications still created but not delivered)
- Existing enrollments remain, but user cannot access full features

**Trial Status Check:**
- Backend method: `user.isTrialActive()` checks if current date < `trialEndDate`
- Frontend displays trial countdown banner
- Shows days remaining in trial

### 4.3 Payment Process

**Step-by-Step Payment Flow:**

1. **User Initiates Payment:**
   - User navigates to Settings screen
   - Taps "Make Payment" or "Upgrade" button
   - Frontend shows payment amount (GHS 25)

2. **Payment Initialization:**
   - Frontend sends POST request to `/api/payments/initialize-payment`
   - Includes:
     - User email (required for Paystack)
     - JWT token for authentication
   - **Security:** Amount is NOT sent from frontend - backend uses fixed amount (GHS 25)

3. **Backend Processing:**
   - Backend validates email format
   - **SECURITY FEATURE:** Backend uses fixed amount (GHS 25) - ignores any amount from frontend
   - Converts amount to pesewas (smallest currency unit): 25 * 100 = 2500 pesewas
   - Generates unique payment reference: `pay_{timestamp}_{randomString}`
   - Creates Payment record in database with status 'pending'
   - Calls Paystack API to initialize transaction

4. **Paystack Response:**
   - Returns authorization URL and access code
   - Backend stores:
     - `authorizationUrl` (for redirect)
     - `accessCode` (for verification)
     - `reference` (unique payment identifier)
     - Payment status: 'pending'

5. **User Payment:**
   - Frontend redirects user to Paystack payment page (web view or browser)
   - User completes payment using:
     - Mobile money (MTN, Vodafone, AirtelTigo)
     - Bank card
     - Other Paystack-supported methods
   - Payment processed by Paystack (outside app)

6. **Payment Verification:**
   - **Method 1: Webhook (Automatic)**
     - Paystack sends webhook to `/api/payments/webhook`
     - Backend verifies webhook signature (HMAC SHA-512)
     - On 'charge.success' event:
       - Verifies payment with Paystack API
       - Checks amount matches expected (GHS 25)
       - Updates Payment record status to 'success'
       - Updates User `paymentStatus` to `true`
   - **Method 2: Manual Verification (Fallback)**
     - User returns to app
     - Frontend sends POST to `/api/payments/verify-payment`
     - Includes payment reference
     - Backend verifies with Paystack
     - Updates payment and user status

7. **Access Activation:**
   - Once payment verified, `user.paymentStatus` set to `true`
   - User immediately gains full access
   - Can enroll in courses
   - Receives all notifications
   - No expiration (one-time payment, lifetime access)

### 4.4 Payment Security

**Backend-Enforced Amount:**
- Payment amount (GHS 25) is hardcoded in backend
- Frontend cannot manipulate payment amount
- Paystack verification confirms amount paid matches expected amount
- If amount mismatch detected, payment marked as failed

**Payment Verification:**
- All payments verified with Paystack API before access granted
- Webhook signature verification prevents fake payment notifications
- Payment records stored for audit trail

**Payment Status:**
- `paymentStatus: false` - No payment made or payment failed
- `paymentStatus: true` - Payment successful, full access granted

### 4.5 Apple In-App Purchase (IAP) Compliance

**Current Implementation:** The app does NOT use Apple In-App Purchase (IAP).

**Payment Method:** External payment gateway (Paystack) - payments occur outside the app via web browser/web view.

**Apple Guidelines Consideration:**
- **Guideline 3.1.1:** Apps offering digital content/services must use IAP
- **Current Approach:** Payment redirects to external Paystack page (web view)
- **Compliance Status:** This may require clarification or modification for App Store approval

**Recommendations:**
1. **Option A:** Implement Apple In-App Purchase for iOS users
   - Use StoreKit 2 for payment processing
   - Create non-consumable in-app purchase product (GHS 25)
   - Verify receipts with Apple
   - Keep Paystack for Android/web

2. **Option B:** Clarify that payment is for service access, not digital content
   - Emphasize that payment unlocks notification and enrollment services
   - Consider if this qualifies as "digital content" under Apple guidelines

3. **Option C:** Make payment web-only
   - Remove payment functionality from iOS app
   - Direct users to website for payment
   - iOS app only displays payment status

**Current Payment Flow for Review:**
- Payment initialization happens in-app
- User redirected to Paystack web page (external)
- Payment completed outside app
- User returns to app for verification
- This may be acceptable if payment is clearly external

### 4.6 Content Locking & Access Control

**Free Content (No Payment Required):**
- Course search and browsing
- Viewing course details (by code)
- Creating account
- Course creation (for course_rep users)

**Locked Content (Requires Payment or Active Trial):**
- Enrolling in courses (after trial expires)
- Receiving push notifications (after trial expires)
- Receiving SMS notifications (after trial expires)
- Full app functionality (after trial expires)

**Access Verification:**
- Backend method: `user.hasActiveAccess()`
- Returns `true` if:
  - `paymentStatus === true` OR
  - `isTrialActive() === true`
- All protected endpoints check this before allowing access

**Trial vs. Paid Access:**
- Both provide identical functionality
- Trial has time limit (7 days)
- Paid access has no expiration

---

## 5. Content & Features

### 5.1 Major Features

#### 5.1.1 Course Management (Course Representatives)

**Course Creation:**
- Create courses with:
  - Course name (e.g., "Introduction to Computer Science")
  - Course code (e.g., "CS101")
  - Schedule:
    - Days of week (Monday, Tuesday, etc.)
    - Start time and end time (single schedule)
    - OR per-day schedules (different times for different days)
  - Venue (classroom location)
  - Credit hours
  - Index range (student index numbers)
  - Course representative name
  - Optional: Phone number whitelist (restricts enrollment)
- System generates unique 5-digit code for enrollment
- Course stored in database with creator reference

**Course Updates:**
- Update any course field
- Two edit types:
  - **Permanent Edit:** Changes saved permanently
  - **Temporary Edit:** Changes expire after 24 hours, then revert to original values
- Automatic notifications sent to enrolled students on updates
- SMS sent for urgent changes (within 30 minutes of next class)

**Course Deletion:**
- Delete course (removes all enrollments and notifications)
- Only creator can delete
- Cannot delete if students enrolled (must remove students first, or deletion removes enrollments)

#### 5.1.2 Course Enrollment (Students)

**Enrollment Process:**
1. Student enters 5-digit unique course code
2. System finds course by code
3. Checks if already enrolled
4. Checks access status (trial or payment)
5. If first enrollment and no access, starts 7-day trial
6. Creates enrollment record
7. Sends notification to course representative
8. Student can now view course and receive notifications

**Enrollment Restrictions:**
- Must have active access (trial or payment)
- Cannot enroll twice in same course
- If course has phone number whitelist, student's phone must be in list (enforced by course_rep)

**Unenrollment:**
- Student can leave course anytime
- Removes enrollment record
- Stops receiving course notifications
- Does not affect trial or payment status

#### 5.1.3 Class Reminders

**Automated Reminder System:**
- Background job runs every 5 minutes
- Calculates next class time for each enrolled student
- Sends push notification at configured time before class (default: 15 minutes)
- Notification includes:
  - Course name
  - Class time
  - Venue (if set)
  - Index range (if set)
  - Personalized greeting with student name

**Reminder Configuration:**
- User can set reminder time (0-120 minutes before class)
- Default: 15 minutes
- Stored in user profile (`reminderMinutes`)

**Reminder Logic:**
- Only sent if:
  - User has notifications enabled
  - User has push token registered
  - User has active access (trial or payment)
  - Next class time calculated successfully
  - Notification not already sent today for this class
- Prevents duplicate notifications

#### 5.1.4 Course Updates & Notifications

**Update Types:**
- Venue changes
- Time changes
- Day changes
- Course name changes
- Credit hours changes
- Class cancellations (venue cleared or days removed)

**Notification Delivery:**
- **In-App Notifications:** Always created for all enrolled students
- **Push Notifications:** Sent if user has active access and notifications enabled
- **SMS Notifications:** Sent only if:
  - Update occurs within 30 minutes of next class time
  - User has active access
  - User has phone number
  - Weekly SMS limit not exceeded (5 SMS per week per user)

**Urgent Update Detection:**
- System calculates next class time
- If update within 30 minutes of class, triggers SMS
- SMS message includes "URGENT" prefix
- Concise message (max 160 characters)

#### 5.1.5 Announcements

**Course Representative Features:**
- Send announcements to all enrolled students
- Announcement includes:
  - Title
  - Message content
  - Course association
- Personalized messages (includes student name)

**Announcement Delivery:**
- In-app notification created for all students
- Push notification sent (if access and notifications enabled)
- SMS sent (if within 30 minutes of class and access enabled)

#### 5.1.6 Quizzes, Tutorials, and Assignments

**Course Representative Features:**
- Create quizzes, tutorials, or assignments
- Each includes:
  - Name/title
  - Date
  - Time
  - Venue
  - Optional topic
  - Course association
- Stored in separate collections (Quiz, Tutorial, Assignment models)

**Student View:**
- Students can view quizzes, tutorials, and assignments for enrolled courses
- Displayed in course detail screens
- No creation or editing capabilities for students

#### 5.1.7 Student Management (Course Representatives)

**View Students:**
- Course representatives can view list of enrolled students
- Shows:
  - Student full name
  - Phone number
  - Student ID (if provided)
  - Enrollment date

**Add Students:**
- Manually add student by phone number
- System finds student account by phone number
- Enrolls student in course
- Sends notification to student

**Remove Students:**
- Remove student from course
- Removes enrollment record
- Sends notification to student
- Student loses access to course

### 5.2 Content Access

**User-Generated Content:**
- Courses created by course representatives
- Announcements created by course representatives
- Quizzes, tutorials, assignments created by course representatives
- Student enrollments (user actions)

**Admin-Generated Content:**
- College list (managed by backend/admin)
- System notifications

**Content Access Without Payment:**
- Course search and browsing (guest mode)
- Course detail viewing (guest mode, by code)
- Course creation (course_rep, no payment required)
- Account creation
- Profile management

**Content Access With Payment/Trial:**
- Course enrollment
- Receiving notifications
- Viewing enrolled courses
- Full app functionality

### 5.3 Content Moderation

**No Content Moderation:**
- Course representatives have full control over their courses
- No admin review of course content
- No content filtering or censorship
- Students can report issues via feedback system (if implemented)

**Content Ownership:**
- Course representatives own their courses
- Can delete courses (removes all associated data)
- Cannot transfer course ownership (feature not implemented)

---

## 6. Notifications & Background Behavior

### 6.1 Notification Types

#### 6.1.1 Push Notifications (Expo Push Notification Service)

**Types:**
1. **Lecture Reminders:**
   - Sent before class starts (configurable time, default 15 minutes)
   - Title: "Class Reminder"
   - Body: Personalized message with course name, time, venue
   - Data: Course ID, course name, type: 'lecture_reminder'

2. **Course Updates:**
   - Sent when course information changes
   - Title: Varies ("Venue Changed", "Time Changed", "Class Cancelled", etc.)
   - Body: Summary of changes
   - Data: Course ID, course name, type: 'course_update'

3. **Announcements:**
   - Sent by course representatives
   - Title: Custom title from course rep
   - Body: Personalized message
   - Data: Course ID, course name, type: 'announcement'

4. **System Notifications:**
   - Enrollment confirmations
   - Account-related messages
   - Type: 'system'

**Push Notification Delivery:**
- Sent via Expo Push Notification Service
- Requires valid Expo push token
- Token registered on app launch and login
- Token stored in user profile (`pushToken` field)

**Push Notification Requirements:**
- User must have active access (trial or payment)
- User must have notifications enabled (`notificationsEnabled: true`)
- User must have registered push token
- App must have notification permissions granted

**iOS-Specific Configuration:**
- Background mode: `remote-notification` enabled in `app.json`
- Notification display in foreground: Enabled (`iosDisplayInForeground: true`)
- Badge count: Set to 1 by default
- Sound: Default notification sound
- Category ID: 'default'

#### 6.1.2 SMS Notifications (Moolre SMS API)

**SMS Delivery Conditions:**
- Only sent for urgent updates (within 30 minutes of next class)
- User must have active access (trial or payment)
- User must have phone number in profile
- Weekly limit: 5 SMS per user per week (resets Monday)
- SMS service must be configured (MOOLRE_API_KEY)

**SMS Types:**
1. **Urgent Course Updates:**
   - Venue changes
   - Time changes
   - Class cancellations
   - Message prefix: "URGENT"
   - Max length: 160 characters (truncated if longer)

2. **Urgent Announcements:**
   - Announcements sent within 30 minutes of class
   - Message prefix: "URGENT"
   - Max length: 160 characters

**SMS Limit Enforcement:**
- Backend tracks SMS sent per user via `SmsLog` model
- Weekly count calculated from Monday of current week
- If limit exceeded, SMS not sent (returns `limitExceeded: true`)
- Limit applies per user, not per course

**SMS Logging:**
- All SMS logged in database
- Includes: user ID, phone number, message, type, course ID, timestamp
- Used for limit enforcement and audit trail

#### 6.1.3 In-App Notifications

**Storage:**
- Stored in `Notification` collection in database
- Associated with user ID
- Includes: title, message, type, course ID, read status

**Display:**
- Shown in Notifications tab/screen
- Mark as read/unread
- Delete individual or all notifications
- Unread count badge

**Notification Creation:**
- Created for all enrolled students on:
  - Course updates
  - Announcements
  - Enrollment confirmations
  - System events

**Access Control:**
- In-app notifications created regardless of access status
- However, push/SMS delivery requires active access
- Users with expired trial can see notifications but won't receive push/SMS

### 6.2 Background Behavior

#### 6.2.1 Class Reminder Job

**Execution:**
- Runs every 5 minutes (300,000 milliseconds)
- Started on server startup (after 30-second delay)
- Processes all users with notifications enabled and push tokens

**Process:**
1. Fetch all users with `notificationsEnabled: true` and valid `pushToken`
2. For each user:
   - Check if user has active access (trial or payment)
   - Get all enrolled courses
   - For each course:
     - Calculate next class time
     - Check if notification already sent today (cache)
     - Check if reminder time reached
     - Send push notification if conditions met
     - Save notification to database
     - Mark as sent in cache

**Caching:**
- In-memory cache prevents duplicate notifications
- Key format: `${userId}_${courseId}_${dateString}`
- Cache cleared daily (old entries removed)

**Error Handling:**
- Job continues if individual user/course processing fails
- Errors logged but don't stop entire job
- Failed notifications can be retried on next run

#### 6.2.2 Temporary Edit Reset Job

**Purpose:**
- Resets temporary course edits after 24 hours
- Restores original course values

**Execution:**
- Runs every hour
- Finds courses with `temporaryEditExpiresAt <= now`
- Restores `originalValues` to course fields
- Clears temporary edit fields

**Temporary Edit System:**
- Course representatives can make temporary changes
- Changes expire after 24 hours
- Original values restored automatically
- Useful for one-time schedule changes

### 6.3 Notification Preferences

**User Controls:**
- Enable/disable notifications: `notificationsEnabled` (default: true)
- Reminder timing: `reminderMinutes` (0-120, default: 15)
- Updated via profile endpoint: `PUT /api/auth/profile`

**Notification Behavior:**
- If `notificationsEnabled: false`:
  - Push notifications not sent
  - SMS not sent
  - In-app notifications still created (user can view later)
- If `reminderMinutes` changed:
  - Affects timing of class reminder notifications
  - Takes effect on next reminder job run

**Push Token Management:**
- Register token: `POST /api/notifications/register-token`
- Remove token: `DELETE /api/notifications/token`
- Token automatically registered on app launch (if permissions granted)

### 6.4 Notification Dependencies

**Push Notifications Require:**
- Active access (trial or payment)
- Notifications enabled
- Valid push token
- App notification permissions granted
- Internet connection

**SMS Notifications Require:**
- Active access (trial or payment)
- Urgent update (within 30 minutes of class)
- Phone number in profile
- Weekly limit not exceeded
- SMS service configured

**In-App Notifications:**
- Always created (no dependencies)
- User can view regardless of access status
- Read/unread status tracked

---

## 7. Data Collection & Privacy

### 7.1 User Data Collected

#### 7.1.1 Required Data (Account Creation)

**Phone Number:**
- **Purpose:** Primary identifier, account authentication, SMS notifications
- **Storage:** MongoDB User collection, hashed/indexed
- **Uniqueness:** Enforced at database level
- **Format:** String, trimmed, case-insensitive

**Password:**
- **Purpose:** Account authentication
- **Storage:** MongoDB User collection, hashed with bcrypt (10 rounds)
- **Never Returned:** Password never included in API responses
- **Minimum Length:** 6 characters

**Full Name:**
- **Purpose:** Personalization, notifications, course enrollment display
- **Storage:** MongoDB User collection
- **Display:** Shown in notifications, course lists, student lists

**Role:**
- **Purpose:** Access control, feature availability
- **Values:** 'student' or 'course_rep'
- **Storage:** MongoDB User collection
- **Changeable:** Users can switch roles via profile update

#### 7.1.2 Optional Data

**Student ID:**
- **Purpose:** Student identification, course enrollment display
- **Storage:** MongoDB User collection
- **Optional:** Not required for account creation

**College:**
- **Purpose:** User categorization, potential filtering
- **Storage:** MongoDB User collection
- **Validation:** Must be from active colleges list
- **Optional:** Not required for account creation

**Email:**
- **Purpose:** Payment processing (required for Paystack)
- **Storage:** Payment collection (not User collection)
- **Collection:** Only collected during payment flow
- **Usage:** Sent to Paystack for payment processing

#### 7.1.3 Automatically Collected Data

**Push Notification Token:**
- **Purpose:** Sending push notifications
- **Storage:** MongoDB User collection (`pushToken` field)
- **Collection:** Automatically registered on app launch/login
- **Format:** Expo push token (ExponentPushToken[...])

**Notification Preferences:**
- **Purpose:** User notification settings
- **Storage:** MongoDB User collection
- **Default Values:**
  - `notificationsEnabled: true`
  - `reminderMinutes: 15`

**Trial Information:**
- **Purpose:** Free trial management
- **Storage:** MongoDB User collection
- **Fields:**
  - `trialStartDate` (Date, null if no trial)
  - `trialEndDate` (Date, null if no trial)
- **Collection:** Automatically set on first course enrollment

**Payment Status:**
- **Purpose:** Access control
- **Storage:** MongoDB User collection
- **Values:** `true` (paid) or `false` (not paid)
- **Collection:** Automatically updated on successful payment

**Timestamps:**
- **Purpose:** Audit trail, sorting, analytics
- **Storage:** MongoDB (createdAt, updatedAt)
- **Fields:** Automatically managed by Mongoose

#### 7.1.4 Course-Related Data

**Enrollment Data:**
- **Purpose:** Track student-course relationships
- **Storage:** MongoDB Enrollment collection
- **Fields:** userId, courseId, enrolledAt timestamp
- **Retention:** Deleted when user unenrolls or account deleted

**Course Data:**
- **Purpose:** Course information, schedules, announcements
- **Storage:** MongoDB Course collection
- **Created By:** Course representatives
- **Contains:** Course name, code, schedule, venue, creator ID

**Notification Data:**
- **Purpose:** In-app notification history
- **Storage:** MongoDB Notification collection
- **Fields:** userId, title, message, type, courseId, isRead, timestamps
- **Retention:** Deleted when user deletes account or individual notifications

**Payment Data:**
- **Purpose:** Payment transaction records
- **Storage:** MongoDB Payment collection
- **Fields:** userId, email, amount, currency, reference, status, timestamps
- **Retention:** NOT deleted on account deletion (financial records)

**SMS Log Data:**
- **Purpose:** SMS audit trail, limit enforcement
- **Storage:** MongoDB SmsLog collection
- **Fields:** userId, phoneNumber, message, type, courseId, sentAt
- **Retention:** NOT deleted on account deletion (audit trail)

### 7.2 Data Storage

**Database:**
- **Primary Database:** MongoDB (cloud-hosted, likely MongoDB Atlas)
- **Connection:** Configured via environment variables
- **Collections:**
  - User
  - Course
  - Enrollment
  - Notification
  - Payment
  - Quiz
  - Tutorial
  - Assignment
  - Feedback
  - College
  - SmsLog

**Backend Server:**
- **Hosting:** Render.com (based on API URL: `https://lecturelet.onrender.com`)
- **Data Processing:** Node.js/Express backend
- **API:** RESTful API endpoints

**Frontend Storage:**
- **Local Storage:** AsyncStorage (React Native)
  - JWT token (`@auth_token`)
  - User data (`@user_data`)
- **No Cloud Sync:** Data not synced to iCloud or other cloud services

### 7.3 Data Sharing

**Third-Party Services:**

1. **Paystack (Payment Processing):**
   - **Data Shared:** Email, payment amount, currency, transaction reference
   - **Purpose:** Payment processing
   - **Privacy Policy:** Paystack's privacy policy applies
   - **User Consent:** Implicit (user initiates payment)

2. **Expo Push Notification Service:**
   - **Data Shared:** Push token, notification content (title, body, data)
   - **Purpose:** Delivering push notifications
   - **Privacy Policy:** Expo's privacy policy applies
   - **User Consent:** Implicit (user grants notification permissions)

3. **Moolre SMS Service:**
   - **Data Shared:** Phone number, SMS message content
   - **Purpose:** Sending SMS notifications
   - **Privacy Policy:** Moolre's privacy policy applies
   - **User Consent:** Implicit (user provides phone number)

**No Data Sold:**
- User data is not sold to third parties
- Data used only for app functionality
- No advertising or marketing data sharing

### 7.4 Apple Privacy Compliance

**Privacy Manifest (iOS 17+):**
- App should include privacy manifest file
- Declare data collection types
- Specify data usage purposes

**Required Privacy Disclosures:**
- **Phone Number:** Required for account, used for SMS
- **Location:** Not collected (no location services)
- **Contacts:** Not accessed
- **Camera:** Not used
- **Photos:** Not accessed
- **Notifications:** Used for push notifications (user permission required)

**Data Minimization:**
- Only collects data necessary for app functionality
- Optional fields clearly marked
- No unnecessary data collection

**User Rights:**
- **Account Deletion:** Users can delete accounts (with restrictions)
- **Data Access:** Users can view their data via profile endpoint
- **Data Correction:** Users can update profile information
- **Notification Control:** Users can disable notifications

**Data Retention:**
- User data deleted on account deletion (except financial/audit records)
- Payment records retained for compliance
- SMS logs retained for audit

---

## 8. Backend & Infrastructure (High-Level)

### 8.1 Backend Services

**Primary Backend:**
- **Technology:** Node.js with Express.js framework
- **Hosting:** Render.com (cloud platform)
- **API Base URL:** `https://lecturelet.onrender.com/api`
- **Architecture:** RESTful API
- **Language:** JavaScript (Node.js)

**Server Features:**
- JWT-based authentication
- Role-based authorization
- Request validation (express-validator)
- Error handling middleware
- CORS enabled (all origins in current config)

### 8.2 Database

**Primary Database:**
- **Type:** MongoDB (NoSQL document database)
- **ORM/ODM:** Mongoose (MongoDB object modeling)
- **Collections:**
  - User
  - Course
  - Enrollment
  - Notification
  - Payment
  - Quiz
  - Tutorial
  - Assignment
  - Feedback
  - College
  - SmsLog

**Database Features:**
- Indexes for performance (phone number, user ID, timestamps)
- Unique constraints (phone number, enrollment pairs)
- Automatic timestamps (createdAt, updatedAt)
- Data relationships (references between collections)

### 8.3 APIs

**Internal APIs:**
- RESTful API endpoints
- Standard HTTP methods (GET, POST, PUT, DELETE)
- JSON request/response format
- Authentication via JWT tokens

**External APIs:**

1. **Paystack API:**
   - **Endpoint:** `https://api.paystack.co`
   - **Usage:** Payment initialization and verification
   - **Authentication:** API secret key (server-side only)
   - **Methods:** POST (initialize), GET (verify), Webhook

2. **Expo Push Notification Service:**
   - **Endpoint:** Expo's push notification service
   - **Usage:** Sending push notifications
   - **Authentication:** Expo SDK (no explicit auth)
   - **Method:** POST (send notifications)

3. **Moolre SMS API:**
   - **Endpoint:** `https://api.moolre.com/open/sms/send`
   - **Usage:** Sending SMS notifications
   - **Authentication:** API key (X-API-VASKEY header)
   - **Method:** POST (send SMS)

### 8.4 Third-Party Integrations

**Payment Processing:**
- **Service:** Paystack
- **Integration:** Direct API calls from backend
- **Webhook:** Receives payment confirmation webhooks
- **Data Flow:** App → Backend → Paystack → Webhook → Backend → App

**Push Notifications:**
- **Service:** Expo Push Notification Service
- **Integration:** Expo SDK (expo-server-sdk)
- **Data Flow:** Backend → Expo Service → Device

**SMS Notifications:**
- **Service:** Moolre
- **Integration:** HTTP API calls
- **Data Flow:** Backend → Moolre API → SMS Gateway → User's Phone

**Background Jobs:**
- **Service:** Node.js setInterval (server-side)
- **Jobs:**
  - Class reminder job (every 5 minutes)
  - Temporary edit reset job (every hour)

### 8.5 Infrastructure Security

**Authentication:**
- JWT tokens with expiration
- Password hashing (bcrypt, 10 rounds)
- Token verification on protected routes

**Authorization:**
- Role-based access control
- Creator verification for course modifications
- User ID verification for data access

**Data Security:**
- Passwords never returned in responses
- Payment amounts enforced server-side
- Webhook signature verification (Paystack)
- Input validation on all endpoints

**Environment Variables:**
- Sensitive data stored in environment variables
- JWT secret
- Database connection string
- Paystack secret key
- Moolre API key
- Not exposed to frontend

---

## 9. UI / UX Flow

### 9.1 First-Time User Flow

**Step 1: App Launch**
- User opens app
- App checks for stored authentication token
- If no token, user sees login/signup options

**Step 2: Sign Up**
- User taps "Sign Up"
- User selects role (Student or Course Representative)
- User enters:
  - Phone number
  - Password (min 6 characters)
  - Full name
  - Optional: Student ID, College
- User submits form
- Account created, user logged in automatically

**Step 3: Role-Specific Home Screen**
- **Student:** Student Home Screen
  - Shows greeting
  - Trial banner (if applicable)
  - Enrolled courses list
  - Quick actions (Add Course, Notifications, Settings)
- **Course Representative:** Course Rep Home Screen
  - Shows greeting
  - Created courses list
  - Quick actions (Create Course, Notifications, Settings)

**Step 4: First Course Enrollment (Students Only)**
- Student navigates to "Add Course"
- Enters 5-digit course code
- System finds course, student enrolls
- **Trial Activated:** 7-day free trial starts automatically
- Student sees trial countdown banner
- Student can now enroll in more courses

### 9.2 Main Navigation Structure

**Student Navigation:**
- **Home:** Enrolled courses, quick actions
- **Add Course:** Search/join courses by code
- **Notifications:** In-app notifications list
- **Settings:** Profile, payment, account management

**Course Representative Navigation:**
- **Home:** Created courses list
- **Create Course:** Course creation form
- **My Courses:** List of created courses with student counts
- **Notifications:** In-app notifications
- **Settings:** Profile, account management

**Common Navigation:**
- **Notifications Tab:** Available to all authenticated users
- **Settings Screen:** Available to all authenticated users
- **Profile Management:** Update name, notification preferences, role

### 9.3 Screens Overview

**Authentication Screens:**
- **Login Screen:** Phone number and password
- **Sign Up Screen:** Registration form with role selection
- **Role Selection:** Choose student or course_rep (if not selected during signup)

**Student Screens:**
- **Student Home:** Dashboard with enrolled courses
- **Add Course:** Search and join courses
- **Course Detail:** View course information, quizzes, tutorials, assignments
- **Notifications:** List of in-app notifications
- **Settings:** Profile, payment, account deletion

**Course Representative Screens:**
- **Course Rep Home:** Dashboard with created courses
- **Create Course:** Course creation form
- **Course Management:** Edit course, view students, send announcements
- **Student List:** View enrolled students, add/remove students
- **Create Quiz/Tutorial/Assignment:** Forms for creating course events
- **Notifications:** List of in-app notifications
- **Settings:** Profile, account management

**Common Screens:**
- **Notifications Screen:** All notification types, mark as read, delete
- **Settings Screen:** Profile update, payment (students), account deletion
- **Profile Screen:** View and edit user information

### 9.4 Payment Flow (Students)

**Step 1: Access Payment Screen**
- Student navigates to Settings
- Sees "Make Payment" or "Upgrade" button
- Taps button

**Step 2: Payment Initialization**
- App shows payment amount (GHS 25)
- User enters email address
- App sends request to backend
- Backend initializes Paystack payment

**Step 3: Payment Processing**
- User redirected to Paystack payment page (web view)
- User selects payment method (mobile money, card, etc.)
- User completes payment on Paystack

**Step 4: Payment Verification**
- **Automatic (Webhook):** Paystack sends webhook, backend verifies, access granted
- **Manual (Fallback):** User returns to app, taps "Verify Payment", backend verifies

**Step 5: Access Granted**
- Payment status updated to `true`
- User gains full access immediately
- Can enroll in courses, receive notifications
- No expiration (lifetime access)

### 9.5 Course Enrollment Flow

**Step 1: Find Course**
- Student navigates to "Add Course"
- Enters 5-digit unique code OR searches for course

**Step 2: View Course Details**
- App displays course information
- Shows: name, code, schedule, venue, student count
- Shows enrollment status (if already enrolled)

**Step 3: Enroll**
- Student taps "Join Course" or "Enroll"
- App checks access status:
  - **If first enrollment and no access:** Trial starts, enrollment proceeds
  - **If no access and has enrollments:** Payment required message shown
  - **If has access:** Enrollment proceeds

**Step 4: Enrollment Confirmation**
- Enrollment created in database
- Notification sent to course representative
- Student sees success message
- Course appears in enrolled courses list

### 9.6 Notification Flow

**Step 1: Notification Trigger**
- Course update, announcement, or class reminder triggered

**Step 2: Notification Creation**
- In-app notification created in database
- Push notification prepared (if access and enabled)
- SMS prepared (if urgent and access enabled)

**Step 3: Notification Delivery**
- Push notification sent via Expo (if conditions met)
- SMS sent via Moolre (if conditions met)
- In-app notification stored in database

**Step 4: User Receives Notification**
- Push notification appears on device
- SMS received (if sent)
- In-app notification appears in Notifications tab

**Step 5: User Interaction**
- User taps notification
- App opens to relevant screen (course detail, notifications list)
- Notification marked as read (if in-app)

---

## 10. Edge Cases & Compliance Notes

### 10.1 Subscription Cancellation

**Not Applicable:** The app does not use subscriptions. It uses one-time payments only.

**Payment Model:** One-time payment of GHS 25 grants lifetime access with no recurring charges.

**No Cancellation Process:** Since there are no subscriptions, there is no cancellation process. Users who have paid have permanent access.

### 10.2 Account Deletion

**Process:** See Section 3.4 for detailed account deletion process.

**Restrictions:**
- Course representatives cannot delete accounts if they have created courses
- Must delete all courses first, or courses are deleted with account (removes enrollments)

**Data Retention:**
- Payment records retained (financial compliance)
- SMS logs retained (audit trail)
- User account, enrollments, notifications deleted

**Compliance:**
- Follows data deletion requests
- Retains only legally required records
- Clear communication of what is deleted vs. retained

### 10.3 Payment Failure

**Scenario 1: Payment Initialization Fails**
- Backend returns error message
- User sees error in app
- User can retry payment
- No charges made

**Scenario 2: Payment Processing Fails (Paystack)**
- Paystack returns failure status
- Payment record marked as 'failed'
- User's `paymentStatus` remains `false`
- User can retry payment with new reference

**Scenario 3: Payment Verification Fails**
- Backend cannot verify payment with Paystack
- Payment remains in 'pending' status
- User can manually verify payment
- If verification fails, payment marked as 'failed'

**Scenario 4: Amount Mismatch**
- Backend verifies amount paid matches expected (GHS 25)
- If mismatch detected, payment marked as 'failed'
- User's `paymentStatus` not updated
- User must contact support or retry payment

**User Experience:**
- Clear error messages
- Ability to retry payment
- Support contact information (if available)

### 10.4 Trial Expiration

**Automatic Expiration:**
- Trial expires 7 days after start date
- No notification sent on expiration
- User loses access automatically

**Post-Expiration Behavior:**
- Cannot enroll in new courses
- Push notifications stop
- SMS notifications stop
- In-app notifications still created but not delivered
- Existing enrollments remain (but user cannot access)

**User Notification:**
- Trial countdown banner shown during trial
- Shows days remaining
- "Pay Now" button in banner
- After expiration, payment required message shown

**Trial Restart:**
- **Not Allowed:** Users cannot restart trial
- One trial per user lifetime
- Must make payment to regain access

### 10.5 Access Control Edge Cases

**Scenario 1: User Has Trial But Payment Made**
- If user makes payment during trial:
  - `paymentStatus` set to `true`
  - Trial dates remain (but irrelevant)
  - `hasActiveAccess()` returns `true` (payment status takes precedence)
  - User maintains access after trial would have expired

**Scenario 2: Payment Made But Trial Still Active**
- Payment grants permanent access
- Trial expiration no longer relevant
- User has lifetime access

**Scenario 3: Multiple Payment Attempts**
- Each payment creates new Payment record
- Only successful payments update `paymentStatus`
- Failed payments do not affect access
- User can make multiple payments (but only first successful one grants access)

### 10.6 Notification Edge Cases

**Scenario 1: User Disables Notifications**
- `notificationsEnabled` set to `false`
- Push notifications not sent
- SMS not sent
- In-app notifications still created
- User can view notifications later if re-enabled

**Scenario 2: Push Token Invalid/Expired**
- Expo push token becomes invalid
- Push notifications fail silently
- In-app notifications still created
- User must re-register token (automatic on app launch)

**Scenario 3: SMS Limit Exceeded**
- User receives 5 SMS in current week
- Additional SMS not sent
- Returns `limitExceeded: true`
- Limit resets on Monday
- Push notifications still sent (separate from SMS limit)

**Scenario 4: No Internet Connection**
- Push notifications queued by Expo (if supported)
- SMS sent when backend processes (requires internet on backend)
- In-app notifications stored in database
- User sees notifications when app reconnects

### 10.7 Course Management Edge Cases

**Scenario 1: Course Representative Deletes Account**
- Cannot delete if courses exist
- Must delete courses first
- Or courses deleted with account (removes all enrollments)

**Scenario 2: Course Deleted While Students Enrolled**
- All enrollments deleted
- All course-related notifications deleted
- Students lose access to course
- No notification sent to students (course no longer exists)

**Scenario 3: Temporary Edit Expires**
- Course values revert to original after 24 hours
- Automatic reset via background job
- No notification sent to students
- Students see reverted values on next app refresh

**Scenario 4: Course Representative Changes Role to Student**
- Role updated in profile
- Can now enroll in courses as student
- Cannot create new courses (requires 'course_rep' role)
- Existing courses remain (but cannot be managed)

### 10.8 Compliance Safeguards

**Payment Security:**
- Payment amount enforced server-side (cannot be manipulated)
- Payment verification with Paystack before access granted
- Webhook signature verification
- Payment records retained for audit

**Data Privacy:**
- Passwords hashed (never stored in plain text)
- Passwords never returned in API responses
- JWT tokens expire (require re-authentication)
- User data deleted on account deletion (except required records)

**Access Control:**
- Role-based authorization enforced
- Creator verification for course modifications
- User ID verification for data access
- Trial/payment status checked before granting access

**Notification Compliance:**
- User can disable notifications
- SMS limit enforced (prevents spam)
- Push token registration requires user permission
- Notification preferences respected

**Financial Compliance:**
- Payment records retained (accounting/tax requirements)
- Transaction references stored
- Payment status tracked
- Audit trail maintained

---

## 11. Plain-English Summary (Non-Technical)

### What is LectureLet?

LectureLet is a mobile app that helps university students and their course instructors stay connected. Think of it as a digital assistant for managing your classes.

### How Does It Work?

**For Students:**
1. **Sign Up:** Create an account with your phone number and choose "Student" as your role.
2. **Join Courses:** Get a 5-digit code from your instructor and enter it in the app to join their course.
3. **Get Reminders:** The app automatically reminds you before your classes start (you can choose how many minutes before).
4. **Stay Updated:** If your instructor changes the class time, venue, or cancels a class, you'll get a notification right away.
5. **Free Trial:** When you join your first course, you get 7 days of free access to try everything out.
6. **Payment:** After your trial ends, you can pay GHS 25 (one-time payment) to keep using the app forever.

**For Course Instructors (Course Representatives):**
1. **Sign Up:** Create an account and choose "Course Representative" as your role.
2. **Create Courses:** Add your course details (name, schedule, venue, etc.) and the app gives you a unique 5-digit code.
3. **Share Code:** Give the code to your students so they can join your course.
4. **Manage Students:** See who's enrolled, add students manually, or remove students if needed.
5. **Send Updates:** If you need to change the class time or venue, update it in the app and all enrolled students get notified automatically.
6. **Send Announcements:** Post messages to all your students at once.
7. **No Payment Required:** Course instructors don't need to pay - creating and managing courses is free.

### Key Features

**Class Reminders:**
- The app knows when your next class is and reminds you before it starts.
- You can choose how early you want the reminder (default is 15 minutes before).

**Urgent Notifications:**
- If something changes within 30 minutes of your class (like venue change or cancellation), you'll get both a push notification on your phone AND an SMS text message.
- This ensures you don't miss important last-minute updates.

**Course Management:**
- Students can see all their enrolled courses in one place.
- Instructors can manage multiple courses and see how many students are in each.

**Easy Communication:**
- Instructors can send announcements to all students instantly.
- Students receive notifications in the app and on their phone.

### Payment Information

- **Free Trial:** 7 days free when you join your first course.
- **One-Time Payment:** GHS 25 (not a subscription - pay once, use forever).
- **Payment Method:** Pay through the app using mobile money or bank card (processed by Paystack, a secure payment company).
- **What You Get:** Full access to enroll in courses, receive notifications, and use all app features with no expiration.

### Privacy & Data

- Your phone number is used to create your account and send you SMS notifications.
- Your password is securely stored and never shared.
- You can delete your account anytime (though instructors need to delete their courses first).
- Payment information is handled by Paystack (a trusted payment processor).
- The app doesn't sell your data or share it with advertisers.

### Who Can Use It?

- **Students:** Any university student who wants to stay organized and never miss a class.
- **Course Instructors:** Lecturers, teaching assistants, or course representatives who want an easy way to communicate with their students.

### What Makes It Special?

- **Automatic Reminders:** Never forget a class - the app reminds you automatically.
- **Last-Minute Alerts:** Get urgent SMS notifications for changes right before class.
- **Simple Enrollment:** Just enter a code to join a course - no complicated setup.
- **Free for Instructors:** Course management is completely free for instructors.
- **One-Time Payment:** Students pay once and get lifetime access (no recurring fees).

---

## Document End

**Prepared For:** Apple App Store Review Team  
**Date:** [Current Date]  
**App Version:** 1.0.5  
**Build Number:** 10  
**Contact:** [If available]

---

**Note for Reviewers:** This document provides a comprehensive technical and functional breakdown of the LectureLet application. All information is based on the actual codebase and implementation. If any clarification is needed regarding specific features, data handling, or compliance matters, please refer to the relevant sections above or contact the development team.
