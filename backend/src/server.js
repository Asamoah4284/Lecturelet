/**
 * LectureLet Backend Server
 * University Course Management API
 * Now using Firebase (Auth + Firestore + FCM) instead of MongoDB
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const config = require('./config');
const routes = require('./routes');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { initializeFirebase } = require('./config/firebase');
const { initializeColleges } = require('./services/firestore/colleges');
const { startTemporaryEditResetJob } = require('./utils/temporaryEditReset');
const { startClassReminderJob } = require('./utils/classReminderJob');
const { startDeviceTokenCleanupJob } = require('./utils/deviceTokenCleanup');

const app = express();

// Middleware
app.use(cors({
  origin: '*', // In production, specify your frontend URL
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging in development
if (config.nodeEnv === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} | ${req.method} ${req.path}`);
    next();
  });
}

// API Routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to LectureLet API',
    version: '1.0.0',
    backend: 'Firebase (Auth + Firestore + FCM)',
    documentation: '/api/health',
    endpoints: {
      auth: '/api/auth',
      courses: '/api/courses',
      enrollments: '/api/enrollments',
      notifications: '/api/notifications',
      payments: '/api/payments',
    },
  });
});

// Error handling
app.use(notFound);
app.use(errorHandler);

// Initialize Firebase and start server (skip when running inside Firebase Cloud Functions)
const startServer = async () => {
  try {
    console.log('🔥 Initializing Firebase...');
    initializeFirebase();
    console.log('✅ Firebase initialized successfully');

    console.log('🏛️  Initializing colleges...');
    await initializeColleges();
    console.log('✅ Colleges initialized');

    startTemporaryEditResetJob();
    startClassReminderJob();
    startDeviceTokenCleanupJob();

    const PORT = config.port;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 Backend: Firebase (Auth + Firestore + FCM)`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

/** Resolve when app is ready (Firebase + colleges). Use this when mounting app in Cloud Functions. */
const getAppReady = (() => {
  let promise = null;
  return () => {
    if (!promise) {
      promise = (async () => {
        initializeFirebase();
        await initializeColleges();
        return app;
      })();
    }
    return promise;
  };
})();

if (!process.env.K_SERVICE && !process.env.FUNCTION_NAME) {
  startServer();
}

module.exports = app;
module.exports.getAppReady = getAppReady;