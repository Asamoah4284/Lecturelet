const express = require('express');
const authRoutes = require('./auth');
const courseRoutes = require('./courses');
const enrollmentRoutes = require('./enrollments');
const notificationRoutes = require('./notifications');

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'LecturerLet API is running',
    timestamp: new Date().toISOString(),
  });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/courses', courseRoutes);
router.use('/enrollments', enrollmentRoutes);
router.use('/notifications', notificationRoutes);

module.exports = router;

