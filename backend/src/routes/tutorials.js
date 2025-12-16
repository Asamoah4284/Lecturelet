const express = require('express');
const { body } = require('express-validator');
const { Tutorial, Course, Enrollment, Notification, User } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { sendBulkPushNotifications } = require('../utils/pushNotificationService');

const router = express.Router();

/**
 * @route   POST /api/tutorials/create
 * @desc    Create a new tutorial (Course Rep only)
 * @access  Private (course_rep)
 */
router.post(
  '/create',
  authenticate,
  authorize('course_rep'),
  [
    body('tutorialName')
      .trim()
      .notEmpty()
      .withMessage('Tutorial name is required'),
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
        tutorialName,
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
          message: 'You can only create tutorials for your own courses',
        });
      }

      // Create the tutorial
      const tutorial = await Tutorial.create({
        tutorialName: tutorialName.trim(),
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
          title: 'New Tutorial Created',
          message: `A new tutorial "${tutorialName}" has been scheduled for ${courseName} on ${date} at ${time}`,
          type: 'announcement',
          courseId: courseId,
        });

        // Prepare push notification for students with push tokens and notifications enabled
        if (student.pushToken && student.notificationsEnabled) {
          pushNotifications.push({
            pushToken: student.pushToken,
            title: 'New Tutorial Created',
            body: `A new tutorial "${tutorialName}" has been scheduled for ${courseName} on ${date} at ${time}`,
            data: {
              type: 'tutorial_created',
              tutorialId: tutorial._id.toString(),
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
        message: 'Tutorial created successfully',
        data: {
          tutorial: tutorial.toJSON(),
          notificationsSent: notifications.length,
          pushNotificationsSent: pushNotifications.length,
        },
      });
    } catch (error) {
      console.error('Create tutorial error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create tutorial',
      });
    }
  }
);

/**
 * @route   GET /api/tutorials/course/:courseId
 * @desc    Get all tutorials for a course
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
          message: 'You can only view tutorials for courses you are enrolled in or created',
        });
      }

      const tutorials = await Tutorial.findByCourse(courseId);

      res.json({
        success: true,
        data: {
          tutorials: tutorials.map(tutorial => tutorial.toJSON()),
          count: tutorials.length,
        },
      });
    } catch (error) {
      console.error('Get tutorials error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch tutorials',
      });
    }
  }
);

/**
 * @route   GET /api/tutorials/my-tutorials
 * @desc    Get all tutorials created by the current user (Course Rep)
 * @access  Private (course_rep)
 */
router.get(
  '/my-tutorials',
  authenticate,
  authorize('course_rep'),
  async (req, res) => {
    try {
      const tutorials = await Tutorial.findByCreator(req.user.id);

      res.json({
        success: true,
        data: {
          tutorials: tutorials.map(tutorial => tutorial.toJSON()),
          count: tutorials.length,
        },
      });
    } catch (error) {
      console.error('Get my tutorials error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch tutorials',
      });
    }
  }
);

/**
 * @route   PUT /api/tutorials/:id
 * @desc    Update a tutorial (Course Rep only)
 * @access  Private (course_rep)
 */
router.put(
  '/:id',
  authenticate,
  authorize('course_rep'),
  [
    body('tutorialName').optional().trim().notEmpty(),
    body('date').optional().trim().notEmpty(),
    body('time').optional().trim().notEmpty(),
    body('venue').optional().trim().notEmpty(),
    body('topic').optional().trim(),
  ],
  validate,
  async (req, res) => {
    try {
      const tutorialId = req.params.id;
      const { tutorialName, date, time, venue, topic } = req.body;

      // Get current tutorial data before updating
      const currentTutorial = await Tutorial.findById(tutorialId);
      if (!currentTutorial) {
        return res.status(404).json({
          success: false,
          message: 'Tutorial not found',
        });
      }

      // Verify user is creator
      const tutorialCreatorId = currentTutorial.createdBy.toString();
      const userId = req.user.id?.toString ? req.user.id.toString() : String(req.user.id);
      if (tutorialCreatorId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You can only update tutorials you created',
        });
      }

      // Build update data
      const updateData = {};
      if (tutorialName !== undefined) updateData.tutorialName = tutorialName.trim();
      if (date !== undefined) updateData.date = date;
      if (time !== undefined) updateData.time = time;
      if (venue !== undefined) updateData.venue = venue.trim();
      if (topic !== undefined) updateData.topic = topic ? topic.trim() : null;

      // Detect what changed for notification
      const changes = [];
      if (updateData.tutorialName && updateData.tutorialName !== currentTutorial.tutorialName) {
        changes.push(`Tutorial name: ${currentTutorial.tutorialName} → ${updateData.tutorialName}`);
      }
      if (updateData.date && updateData.date !== currentTutorial.date) {
        changes.push(`Date: ${currentTutorial.date} → ${updateData.date}`);
      }
      if (updateData.time && updateData.time !== currentTutorial.time) {
        changes.push(`Time: ${currentTutorial.time} → ${updateData.time}`);
      }
      if (updateData.venue && updateData.venue !== currentTutorial.venue) {
        changes.push(`Venue: ${currentTutorial.venue} → ${updateData.venue}`);
      }

      // Update the tutorial
      const tutorial = await Tutorial.findByIdAndUpdate(tutorialId, updateData, { new: true });

      // Get all enrolled students for the course
      const enrollments = await Enrollment.find({ courseId: tutorial.courseId })
        .populate('userId', 'pushToken notificationsEnabled fullName');

      // Build notification messages
      let detailedMessage = `Tutorial "${tutorial.tutorialName}" for ${tutorial.courseName} has been updated`;
      if (changes.length > 0) {
        detailedMessage += `:\n${changes.join('\n')}`;
      }

      let pushMessage = `Tutorial "${tutorial.tutorialName}" has been updated`;
      if (changes.length > 0) {
        const changeSummary = changes.map(change => {
          if (change.includes('Date:')) return 'Date changed';
          if (change.includes('Time:')) return 'Time changed';
          if (change.includes('Venue:')) return 'Venue changed';
          if (change.includes('name:')) return 'Name changed';
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
          title: 'Tutorial Updated',
          message: detailedMessage,
          type: 'announcement',
          courseId: tutorial.courseId,
        });

        // Prepare push notification for students with push tokens and notifications enabled
        if (student.pushToken && student.notificationsEnabled) {
          pushNotifications.push({
            pushToken: student.pushToken,
            title: 'Tutorial Updated',
            body: pushMessage,
            data: {
              type: 'tutorial_updated',
              tutorialId: tutorial._id.toString(),
              courseId: tutorial.courseId.toString(),
              courseName: tutorial.courseName,
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
        message: 'Tutorial updated successfully',
        data: {
          tutorial: tutorial.toJSON(),
          notificationsSent: notifications.length,
          pushNotificationsSent: pushNotifications.length,
        },
      });
    } catch (error) {
      console.error('Update tutorial error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update tutorial',
      });
    }
  }
);

module.exports = router;


