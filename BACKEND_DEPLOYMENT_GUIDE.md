# Backend Deployment Guide

## Architecture Overview

Your app uses a **hybrid architecture**:

### Cloud Services (No Server Needed)
- ✅ **Firebase Firestore** - Database (cloud)
- ✅ **Firebase Authentication** - User auth (cloud)
- ✅ **Firebase Cloud Messaging (FCM)** - Push notifications (cloud)

### Express Backend Server (Required)
- ⚠️ **Express.js API** - Handles business logic, routes, and integrations
- ⚠️ **Firebase Admin SDK** - Server-side Firebase operations
- ⚠️ **SMS Service** - Moolre API integration
- ⚠️ **Payment Processing** - Paystack integration

## Why You Still Need the Backend Server

Even though Firebase handles database and auth, your Express server is essential for:

1. **API Routes** - All your `/api/*` endpoints
2. **Business Logic** - Course enrollment, notifications, etc.
3. **Server-Side Operations** - FCM sending, SMS, payments
4. **Security** - Token verification, authorization checks

## Development vs Production

### Local Development

**Backend:**
```bash
cd backend
npm install
npm run dev  # Runs on http://localhost:3000
```

**Frontend `app.json`:**
```json
"extra": {
  "apiUrl": "http://localhost:3000/api"
}
```

**Note:** For physical devices, use your computer's IP:
```json
"apiUrl": "http://192.168.1.XXX:3000/api"  // Replace XXX with your local IP
```

### Production (Render.com)

**Backend Deployment:**
1. Push code to GitHub
2. Connect Render to your repo
3. Set environment variables in Render dashboard
4. Deploy

**Frontend `app.json`:**
```json
"extra": {
  "apiUrl": "https://lecturelet.onrender.com/api"
}
```

## Environment Variables for Render

When deploying to Render, set these in the Render dashboard:

```env
PORT=3000
NODE_ENV=production
JWT_SECRET=your-secret-key-here

# Firebase (optional - if using file path)
FIREBASE_SERVICE_ACCOUNT_PATH=./lecturelet-c03be-firebase-adminsdk-fbsvc-b73708ead1.json

# OR use environment variable (recommended for production)
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# Paystack
PAYSTACK_SECRET_KEY=sk_live_...
PAYSTACK_PUBLIC_KEY=pk_live_...

# Moolre
MOOLRE_API_KEY=...
MOOLRE_SENDER_ID=LectureLet
MOOLRE_USERNAME=asamoah4284
```

## Important Notes

1. **Firebase Service Account File**: 
   - For local: Keep the JSON file in `backend/` directory
   - For Render: Either upload the file OR use `FIREBASE_SERVICE_ACCOUNT_KEY` env variable

2. **API URL Configuration**:
   - Development: Use `localhost` or your local IP
   - Production: Use Render URL (`https://lecturelet.onrender.com/api`)

3. **Firebase Admin SDK**: 
   - Runs on your Express server (backend)
   - Needs service account credentials
   - Handles server-side Firebase operations

4. **Frontend Firebase SDK**:
   - Runs in the mobile app
   - Uses `google-services.json` (Android) and Firebase config
   - Handles client-side auth and Firestore reads

## Quick Start

### Local Development:
```bash
# Terminal 1: Backend
cd backend
npm install
npm run dev

# Terminal 2: Frontend  
cd frontend
npm start
```

### Production:
- Deploy backend to Render
- Update `app.json` with Render URL
- Build and deploy app with EAS

## Summary

**You need BOTH:**
- ✅ Firebase (cloud) - Database, Auth, FCM
- ✅ Express Backend (server) - API routes, business logic

**Choose:**
- 🏠 **Local** - For development (`localhost:3000`)
- ☁️ **Render** - For production (`lecturelet.onrender.com`)
