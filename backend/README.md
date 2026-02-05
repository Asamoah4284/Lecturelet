# LectureLet Backend API

A Node.js/Express backend for the LectureLet university course management mobile application.

## 🚀 Getting Started

### Prerequisites

- Node.js v18+ 
- npm or yarn

### Installation

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file (copy from `.env.example`):
   ```bash
   # Windows
   copy .env.example .env
   
   # Linux/Mac
   cp .env.example .env
   ```

4. Configure your `.env` file:
   ```env
   PORT=3000
   NODE_ENV=development
   JWT_SECRET=your-super-secret-key-change-this
   JWT_EXPIRES_IN=7d
   DATABASE_PATH=./data/LectureLet.db
   ```

5. Start the server:
   ```bash
   # Development (with hot reload)
   npm run dev
   
   # Production
   npm start
   ```

The server will start on `http://localhost:3000`

### Deploying to Render (or similar)

Set these **environment variables** in your Render service (Dashboard → Environment):

| Variable | Description |
|----------|-------------|
| `FIREBASE_SERVICE_ACCOUNT_KEY` | **Required.** Full Firebase service account JSON as a single line. In Firebase Console: Project Settings → Service accounts → Generate new private key. Copy the entire JSON and paste as the value (minify to one line if needed). |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Optional. Path to a key file instead of `FIREBASE_SERVICE_ACCOUNT_KEY` (e.g. if mounting a secret file). |
| `PAYSTACK_SECRET_KEY` | **Required for payments.** Paystack secret key (starts with `sk_live_` or `sk_test_`). Without it, payment initialization returns "Payment service is not configured." |
| Other vars | Copy from your local `.env` (e.g. `JWT_SECRET`, `MONGODB_URI`, `PORT`, etc.) as needed. |

Without `FIREBASE_SERVICE_ACCOUNT_KEY` (or a valid `FIREBASE_SERVICE_ACCOUNT_PATH`), the server will fail to start with: *Firebase service account key not found*.

## 📚 API Documentation

### Base URL
```
http://localhost:3000/api
```

### Authentication
Most endpoints require a JWT token. Include it in the Authorization header:
```
Authorization: Bearer <your-token>
```

---

## 🔐 Auth Endpoints

### Sign Up
```http
POST /api/auth/signup
```

**Body:**
```json
{
  "email": "student@university.edu",
  "password": "password123",
  "fullName": "John Doe",
  "role": "student",
  "studentId": "STU12345"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "user": {
      "id": "uuid",
      "email": "student@university.edu",
      "full_name": "John Doe",
      "role": "student"
    },
    "token": "jwt-token"
  }
}
```

### Login
```http
POST /api/auth/login
```

**Body:**
```json
{
  "email": "student@university.edu",
  "password": "password123"
}
```

### Get Current User
```http
GET /api/auth/me
```
*Requires Authentication*

### Update Profile
```http
PUT /api/auth/profile
```
*Requires Authentication*

**Body:**
```json
{
  "fullName": "John Smith",
  "studentId": "STU12345",
  "role": "course_rep",
  "notificationsEnabled": true,
  "reminderMinutes": 15
}
```

### Change Password
```http
PUT /api/auth/password
```
*Requires Authentication*

**Body:**
```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123"
}
```

---

## 📖 Course Endpoints

### Create Course (Course Rep Only)
```http
POST /api/courses
```
*Requires Authentication (course_rep role)*

**Body:**
```json
{
  "courseName": "Introduction to Computer Science",
  "courseCode": "CS101",
  "days": ["Monday", "Wednesday"],
  "startTime": "9:00 AM",
  "endTime": "10:30 AM",
  "venue": "Room A1",
  "creditHours": "3",
  "indexFrom": "1",
  "indexTo": "100",
  "courseRepName": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Course created successfully",
  "data": {
    "course": {
      "id": "uuid",
      "unique_code": "ABC123",
      "course_name": "Introduction to Computer Science",
      "course_code": "CS101",
      "days": ["Monday", "Wednesday"],
      "start_time": "9:00 AM",
      "end_time": "10:30 AM",
      "venue": "Room A1",
      "student_count": 0
    }
  }
}
```

### Get My Courses (Course Rep)
```http
GET /api/courses/my-courses
```
*Requires Authentication (course_rep role)*

### Search Courses
```http
GET /api/courses/search?q=computer
```
*Requires Authentication*

### Get Course by Unique Code
```http
GET /api/courses/code/:uniqueCode
```
*Requires Authentication*

### Get Course by ID
```http
GET /api/courses/:id
```
*Requires Authentication*

### Update Course
```http
PUT /api/courses/:id
```
*Requires Authentication (course_rep role, must be creator)*

### Delete Course
```http
DELETE /api/courses/:id
```
*Requires Authentication (course_rep role, must be creator)*

### Get Course Students
```http
GET /api/courses/:id/students
```
*Requires Authentication (course_rep role, must be creator)*

---

## 📝 Enrollment Endpoints

### Join Course (Student)
```http
POST /api/enrollments/join
```
*Requires Authentication (student role)*

**Body:**
```json
{
  "uniqueCode": "ABC123"
}
```

### Get Enrolled Courses (Student)
```http
GET /api/enrollments/my-courses
```
*Requires Authentication (student role)*

### Unenroll from Course
```http
DELETE /api/enrollments/:courseId
```
*Requires Authentication (student role)*

### Check Enrollment Status
```http
GET /api/enrollments/check/:courseId
```
*Requires Authentication*

---

## 🔔 Notification Endpoints

### Get Notifications
```http
GET /api/notifications?limit=50&unreadOnly=false
```
*Requires Authentication*

### Get Unread Count
```http
GET /api/notifications/unread-count
```
*Requires Authentication*

### Send Notification (Course Rep)
```http
POST /api/notifications/send
```
*Requires Authentication (course_rep role)*

**Body:**
```json
{
  "courseId": "course-uuid",
  "title": "Class Cancelled",
  "message": "Tomorrow's class has been cancelled"
}
```

### Mark as Read
```http
PUT /api/notifications/:id/read
```
*Requires Authentication*

### Mark All as Read
```http
PUT /api/notifications/read-all
```
*Requires Authentication*

### Delete Notification
```http
DELETE /api/notifications/:id
```
*Requires Authentication*

### Delete All Notifications
```http
DELETE /api/notifications
```
*Requires Authentication*

---

## 🗄️ Database Schema

### Users
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (UUID) | Primary key |
| email | TEXT | Unique email address |
| password | TEXT | Hashed password |
| full_name | TEXT | User's full name |
| role | TEXT | 'student' or 'course_rep' |
| student_id | TEXT | Student ID (optional) |
| notifications_enabled | INTEGER | 1 = enabled, 0 = disabled |
| reminder_minutes | INTEGER | Minutes before lecture to remind |
| created_at | TEXT | ISO timestamp |
| updated_at | TEXT | ISO timestamp |

### Courses
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (UUID) | Primary key |
| unique_code | TEXT | 6-character join code |
| course_name | TEXT | Course name |
| course_code | TEXT | Course code (e.g., CS101) |
| days | TEXT | JSON array of days |
| start_time | TEXT | Lecture start time |
| end_time | TEXT | Lecture end time |
| venue | TEXT | Location (optional) |
| credit_hours | TEXT | Credit hours (optional) |
| index_from | TEXT | Index range start (optional) |
| index_to | TEXT | Index range end (optional) |
| course_rep_name | TEXT | Representative name |
| created_by | TEXT | Creator user ID (FK) |
| created_at | TEXT | ISO timestamp |
| updated_at | TEXT | ISO timestamp |

### Enrollments
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (UUID) | Primary key |
| user_id | TEXT | Student ID (FK) |
| course_id | TEXT | Course ID (FK) |
| enrolled_at | TEXT | ISO timestamp |

### Notifications
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (UUID) | Primary key |
| user_id | TEXT | Recipient ID (FK) |
| title | TEXT | Notification title |
| message | TEXT | Notification message |
| type | TEXT | lecture_reminder, course_update, announcement, system |
| course_id | TEXT | Related course (optional, FK) |
| is_read | INTEGER | 1 = read, 0 = unread |
| created_at | TEXT | ISO timestamp |

---

## 🔧 Error Responses

All errors follow this format:
```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "field": "email",
      "message": "Please provide a valid email"
    }
  ]
}
```

### Common Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `500` - Internal Server Error

---

## 🛠️ Development

### Project Structure
```
backend/
├── src/
│   ├── config/         # Configuration files
│   │   ├── database.js # SQLite connection
│   │   └── index.js    # App configuration
│   ├── database/       # Database initialization
│   │   └── init.js     # Create tables
│   ├── middleware/     # Express middleware
│   │   ├── auth.js     # JWT authentication
│   │   ├── errorHandler.js
│   │   └── validate.js
│   ├── models/         # Data models
│   │   ├── User.js
│   │   ├── Course.js
│   │   ├── Enrollment.js
│   │   ├── Notification.js
│   │   └── index.js
│   ├── routes/         # API routes
│   │   ├── auth.js
│   │   ├── courses.js
│   │   ├── enrollments.js
│   │   ├── notifications.js
│   │   └── index.js
│   └── server.js       # Express app entry
├── data/               # SQLite database (auto-created)
├── .env.example        # Environment template
├── .gitignore
├── package.json
└── README.md
```

### Scripts
```bash
npm start      # Start production server
npm run dev    # Start with nodemon (hot reload)
npm run db:init # Initialize database manually
```

---

## 📱 Frontend Integration

Update your React Native app to point to this backend:

```javascript
// In your API service
const API_URL = 'http://localhost:3000/api';
// For physical device testing, use your computer's IP:
// const API_URL = 'http://192.168.1.x:3000/api';
```

Example fetch:
```javascript
const login = async (email, password) => {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  return response.json();
};
```

---

## 📄 License

MIT

