const express = require('express');
const authRoutes = require('./auth');
const courseRoutes = require('./courses');
const enrollmentRoutes = require('./enrollments');
const notificationRoutes = require('./notifications');
const quizRoutes = require('./quizzes');
const assignmentRoutes = require('./assignments');
const tutorialRoutes = require('./tutorials');
const paymentRoutes = require('./payments');
const feedbackRoutes = require('./feedback');

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'LectureLet API is running',
    timestamp: new Date().toISOString(),
  });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/courses', courseRoutes);
router.use('/enrollments', enrollmentRoutes);
router.use('/notifications', notificationRoutes);
router.use('/quizzes', quizRoutes);
router.use('/assignments', assignmentRoutes);
router.use('/tutorials', tutorialRoutes);
router.use('/payments', paymentRoutes);
router.use('/feedback', feedbackRoutes);

module.exports = router;



