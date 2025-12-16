const express = require('express');
const { body } = require('express-validator');
const { Quiz, Course, Enrollment, Notification, User } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { sendBulkPushNotifications } = require('../utils/pushNotificationService');

const router = express.Router();

/**
 * @route   POST /api/quizzes/create
 * @desc    Create a new quiz (Course Rep only)
 * @access  Private (course_rep)
 */
router.post(
  '/create',
  authenticate,
  authorize('course_rep'),
  [
    body('quizName')
      .trim()
      .notEmpty()
      .withMessage('Quiz name is required'),
    body('date')
      .trim()
      .notEmpty()
      .withMessage('Date is required'),
    body('time')
      .trim()
      .notEmpty()
      .withMessage('Time is required'),
    body('venue')
      .trim()
      .notEmpty()
      .withMessage('Venue is required'),
    body('courseId')
      .notEmpty()
      .withMessage('Course ID is required'),
    body('courseCode')
      .trim()
      .notEmpty()
      .withMessage('Course code is required'),
    body('courseName')
      .trim()
      .notEmpty()
      .withMessage('Course name is required'),
    body('topic').optional().trim(),
  ],
  validate,
  async (req, res) => {
    try {
      const {
        quizName,
        date,
        time,
        venue,
        topic,
        courseId,
        courseCode,
        courseName,
      } = req.body;

      // Verify course exists and user is creator
      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'Course not found',
        });
      }

      if (!(await Course.isCreator(courseId, req.user.id))) {
        return res.status(403).json({
          success: false,
          message: 'You can only create quizzes for your own courses',
        });
      }

      // Create the quiz
      const quiz = await Quiz.create({
        quizName: quizName.trim(),
        date,
        time,
        venue: venue.trim(),
        topic: topic ? topic.trim() : null,
        courseId,
        courseCode: courseCode.trim(),
        courseName: courseName.trim(),
        createdBy: req.user.id,
      });

      // Get all enrolled students for the course
      const enrollments = await Enrollment.find({ courseId })
        .populate('userId', 'pushToken notificationsEnabled fullName');

      // Prepare notifications for all enrolled students
      const notifications = [];
      const pushNotifications = [];

      for (const enrollment of enrollments) {
        const student = enrollment.userId;
        
        // Create in-app notification for all students
        notifications.push({
          userId: student._id,
          title: 'New Quiz Created',
          message: `A new quiz "${quizName}" has been scheduled for ${courseName} on ${date} at ${time}`,
          type: 'announcement',
          courseId: courseId,
        });

        // Prepare push notification for students with push tokens and notifications enabled
        if (student.pushToken && student.notificationsEnabled) {
          pushNotifications.push({
            pushToken: student.pushToken,
            title: 'New Quiz Created',
            body: `A new quiz "${quizName}" has been scheduled for ${courseName} on ${date} at ${time}`,
            data: {
              type: 'quiz_created',
              quizId: quiz._id.toString(),
              courseId: courseId.toString(),
              courseName: courseName,
            },
          });
        }
      }

      // Create in-app notifications in database
      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }

      // Send push notifications
      if (pushNotifications.length > 0) {
        try {
          const pushResult = await sendBulkPushNotifications(pushNotifications);
          console.log(`Push notifications sent: ${pushResult.sent || 0} successful, ${pushResult.failed || 0} failed`);
        } catch (pushError) {
          console.error('Error sending push notifications:', pushError);
          // Don't fail the request if push notifications fail
        }
      }

      res.status(201).json({
        success: true,
        message: 'Quiz created successfully',
        data: {
          quiz: quiz.toJSON(),
          notificationsSent: notifications.length,
          pushNotificationsSent: pushNotifications.length,
        },
      });
    } catch (error) {
      console.error('Create quiz error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create quiz',
      });
    }
  }
);

/**
 * @route   GET /api/quizzes/course/:courseId
 * @desc    Get all quizzes for a course
 * @access  Private
 */
router.get(
  '/course/:courseId',
  authenticate,
  async (req, res) => {
    try {
      const { courseId } = req.params;

      // Verify course exists
      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'Course not found',
        });
      }

      // Check if user is enrolled or is the creator
      const isEnrolled = await Enrollment.isEnrolled(req.user.id, courseId);
      const isCreator = course.createdBy.toString() === req.user.id;

      if (!isEnrolled && !isCreator) {
        return res.status(403).json({
          success: false,
          message: 'You can only view quizzes for courses you are enrolled in or created',
        });
      }

      const quizzes = await Quiz.findByCourse(courseId);

      res.json({
        success: true,
        data: {
          quizzes: quizzes.map(quiz => quiz.toJSON()),
          count: quizzes.length,
        },
      });
    } catch (error) {
      console.error('Get quizzes error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch quizzes',
      });
    }
  }
);

/**
 * @route   GET /api/quizzes/my-quizzes
 * @desc    Get all quizzes created by the current user (Course Rep)
 * @access  Private (course_rep)
 */
router.get(
  '/my-quizzes',
  authenticate,
  authorize('course_rep'),
  async (req, res) => {
    try {
      const quizzes = await Quiz.findByCreator(req.user.id);

      res.json({
        success: true,
        data: {
          quizzes: quizzes.map(quiz => quiz.toJSON()),
          count: quizzes.length,
        },
      });
    } catch (error) {
      console.error('Get my quizzes error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch quizzes',
      });
    }
  }
);

/**
 * @route   PUT /api/quizzes/:id
 * @desc    Update a quiz (Course Rep only)
 * @access  Private (course_rep)
 */
router.put(
  '/:id',
  authenticate,
  authorize('course_rep'),
  [
    body('quizName').optional().trim().notEmpty(),
    body('date').optional().trim().notEmpty(),
    body('time').optional().trim().notEmpty(),
    body('venue').optional().trim().notEmpty(),
    body('topic').optional().trim(),
  ],
  validate,
  async (req, res) => {
    try {
      const quizId = req.params.id;
      const { quizName, date, time, venue, topic } = req.body;

      // Get current quiz data before updating
      const currentQuiz = await Quiz.findById(quizId);
      if (!currentQuiz) {
        return res.status(404).json({
          success: false,
          message: 'Quiz not found',
        });
      }

      // Verify user is creator
      const quizCreatorId = currentQuiz.createdBy.toString();
      const userId = req.user.id?.toString ? req.user.id.toString() : String(req.user.id);
      if (quizCreatorId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You can only update quizzes you created',
        });
      }

      // Build update data
      const updateData = {};
      if (quizName !== undefined) updateData.quizName = quizName.trim();
      if (date !== undefined) updateData.date = date;
      if (time !== undefined) updateData.time = time;
      if (venue !== undefined) updateData.venue = venue.trim();
      if (topic !== undefined) updateData.topic = topic ? topic.trim() : null;

      // Detect what changed for notification
      const changes = [];
      if (updateData.quizName && updateData.quizName !== currentQuiz.quizName) {
        changes.push(`Quiz name: ${currentQuiz.quizName} → ${updateData.quizName}`);
      }
      if (updateData.date && updateData.date !== currentQuiz.date) {
        changes.push(`Date: ${currentQuiz.date} → ${updateData.date}`);
      }
      if (updateData.time && updateData.time !== currentQuiz.time) {
        changes.push(`Time: ${currentQuiz.time} → ${updateData.time}`);
      }
      if (updateData.venue && updateData.venue !== currentQuiz.venue) {
        changes.push(`Venue: ${currentQuiz.venue} → ${updateData.venue}`);
      }

      // Update the quiz
      const quiz = await Quiz.findByIdAndUpdate(quizId, updateData, { new: true });

      // Get all enrolled students for the course
      const enrollments = await Enrollment.find({ courseId: quiz.courseId })
        .populate('userId', 'pushToken notificationsEnabled fullName');

      // Build notification messages
      let detailedMessage = `Quiz "${quiz.quizName}" for ${quiz.courseName} has been updated`;
      if (changes.length > 0) {
        detailedMessage += `:\n${changes.join('\n')}`;
      }

      let pushMessage = `Quiz "${quiz.quizName}" has been updated`;
      if (changes.length > 0) {
        const changeSummary = changes.map(change => {
          if (change.includes('Date:')) return 'Date changed';
          if (change.includes('Time:')) return 'Time changed';
          if (change.includes('Venue:')) return 'Venue changed';
          if (change.includes('Quiz name:')) return 'Name changed';
          return 'Updated';
        });
        pushMessage += `. ${changeSummary.join(', ')}`;
      }

      // Prepare notifications for all enrolled students
      const notifications = [];
      const pushNotifications = [];

      for (const enrollment of enrollments) {
        const student = enrollment.userId;

        // Create in-app notification for all students
        notifications.push({
          userId: student._id,
          title: 'Quiz Updated',
          message: detailedMessage,
          type: 'announcement',
          courseId: quiz.courseId,
        });

        // Prepare push notification for students with push tokens and notifications enabled
        if (student.pushToken && student.notificationsEnabled) {
          pushNotifications.push({
            pushToken: student.pushToken,
            title: 'Quiz Updated',
            body: pushMessage,
            data: {
              type: 'quiz_updated',
              quizId: quiz._id.toString(),
              courseId: quiz.courseId.toString(),
              courseName: quiz.courseName,
            },
          });
        }
      }

      // Create in-app notifications in database
      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }

      // Send push notifications
      if (pushNotifications.length > 0) {
        try {
          const pushResult = await sendBulkPushNotifications(pushNotifications);
          console.log(`Push notifications sent: ${pushResult.sent || 0} successful, ${pushResult.failed || 0} failed`);
        } catch (pushError) {
          console.error('Error sending push notifications:', pushError);
          // Don't fail the request if push notifications fail
        }
      }

      res.json({
        success: true,
        message: 'Quiz updated successfully',
        data: {
          quiz: quiz.toJSON(),
          notificationsSent: notifications.length,
          pushNotificationsSent: pushNotifications.length,
        },
      });
    } catch (error) {
      console.error('Update quiz error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update quiz',
      });
    }
  }
);

module.exports = router;


