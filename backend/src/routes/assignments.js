const express = require('express');
const { body } = require('express-validator');
const { Assignment, Course, Enrollment, Notification, User } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { sendBulkPushNotifications } = require('../utils/pushNotificationService');

const router = express.Router();

/**
 * @route   POST /api/assignments/create
 * @desc    Create a new assignment (Course Rep only)
 * @access  Private (course_rep)
 */
router.post(
  '/create',
  authenticate,
  authorize('course_rep'),
  [
    body('assignmentName')
      .trim()
      .notEmpty()
      .withMessage('Assignment name is required'),
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
        assignmentName,
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
          message: 'You can only create assignments for your own courses',
        });
      }

      // Create the assignment
      const assignment = await Assignment.create({
        assignmentName: assignmentName.trim(),
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
          title: 'New Assignment Created',
          message: `A new assignment "${assignmentName}" has been created for ${courseName}. Submission deadline: ${date} at ${time}`,
          type: 'announcement',
          courseId: courseId,
        });

        // Prepare push notification for students with push tokens and notifications enabled
        if (student.pushToken && student.notificationsEnabled) {
          pushNotifications.push({
            pushToken: student.pushToken,
            title: 'New Assignment Created',
            body: `A new assignment "${assignmentName}" has been created for ${courseName}. Submission deadline: ${date} at ${time}`,
            data: {
              type: 'assignment_created',
              assignmentId: assignment._id.toString(),
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
        message: 'Assignment created successfully',
        data: {
          assignment: assignment.toJSON(),
          notificationsSent: notifications.length,
          pushNotificationsSent: pushNotifications.length,
        },
      });
    } catch (error) {
      console.error('Create assignment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create assignment',
      });
    }
  }
);

/**
 * @route   GET /api/assignments/course/:courseId
 * @desc    Get all assignments for a course
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
          message: 'You can only view assignments for courses you are enrolled in or created',
        });
      }

      const assignments = await Assignment.findByCourse(courseId);

      res.json({
        success: true,
        data: {
          assignments: assignments.map(assignment => assignment.toJSON()),
          count: assignments.length,
        },
      });
    } catch (error) {
      console.error('Get assignments error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch assignments',
      });
    }
  }
);

/**
 * @route   GET /api/assignments/my-assignments
 * @desc    Get all assignments created by the current user (Course Rep)
 * @access  Private (course_rep)
 */
router.get(
  '/my-assignments',
  authenticate,
  authorize('course_rep'),
  async (req, res) => {
    try {
      const assignments = await Assignment.findByCreator(req.user.id);

      res.json({
        success: true,
        data: {
          assignments: assignments.map(assignment => assignment.toJSON()),
          count: assignments.length,
        },
      });
    } catch (error) {
      console.error('Get my assignments error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch assignments',
      });
    }
  }
);

/**
 * @route   PUT /api/assignments/:id
 * @desc    Update an assignment (Course Rep only)
 * @access  Private (course_rep)
 */
router.put(
  '/:id',
  authenticate,
  authorize('course_rep'),
  [
    body('assignmentName').optional().trim().notEmpty(),
    body('date').optional().trim().notEmpty(),
    body('time').optional().trim().notEmpty(),
    body('venue').optional().trim().notEmpty(),
    body('topic').optional().trim(),
  ],
  validate,
  async (req, res) => {
    try {
      const assignmentId = req.params.id;
      const { assignmentName, date, time, venue, topic } = req.body;

      // Get current assignment data before updating
      const currentAssignment = await Assignment.findById(assignmentId);
      if (!currentAssignment) {
        return res.status(404).json({
          success: false,
          message: 'Assignment not found',
        });
      }

      // Verify user is creator
      const assignmentCreatorId = currentAssignment.createdBy.toString();
      const userId = req.user.id?.toString ? req.user.id.toString() : String(req.user.id);
      if (assignmentCreatorId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You can only update assignments you created',
        });
      }

      // Build update data
      const updateData = {};
      if (assignmentName !== undefined) updateData.assignmentName = assignmentName.trim();
      if (date !== undefined) updateData.date = date;
      if (time !== undefined) updateData.time = time;
      if (venue !== undefined) updateData.venue = venue.trim();
      if (topic !== undefined) updateData.topic = topic ? topic.trim() : null;

      // Detect what changed for notification
      const changes = [];
      if (updateData.assignmentName && updateData.assignmentName !== currentAssignment.assignmentName) {
        changes.push(`Assignment name: ${currentAssignment.assignmentName} → ${updateData.assignmentName}`);
      }
      if (updateData.date && updateData.date !== currentAssignment.date) {
        changes.push(`Submission deadline date: ${currentAssignment.date} → ${updateData.date}`);
      }
      if (updateData.time && updateData.time !== currentAssignment.time) {
        changes.push(`Submission deadline time: ${currentAssignment.time} → ${updateData.time}`);
      }
      if (updateData.venue && updateData.venue !== currentAssignment.venue) {
        changes.push(`Venue: ${currentAssignment.venue} → ${updateData.venue}`);
      }

      // Update the assignment
      const assignment = await Assignment.findByIdAndUpdate(assignmentId, updateData, { new: true });

      // Get all enrolled students for the course
      const enrollments = await Enrollment.find({ courseId: assignment.courseId })
        .populate('userId', 'pushToken notificationsEnabled fullName');

      // Build notification messages
      let detailedMessage = `Assignment "${assignment.assignmentName}" for ${assignment.courseName} has been updated`;
      if (changes.length > 0) {
        detailedMessage += `:\n${changes.join('\n')}`;
      }

      let pushMessage = `Assignment "${assignment.assignmentName}" has been updated`;
      if (changes.length > 0) {
        const changeSummary = changes.map(change => {
          if (change.includes('deadline date:')) return 'Deadline date changed';
          if (change.includes('deadline time:')) return 'Deadline time changed';
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
          title: 'Assignment Updated',
          message: detailedMessage,
          type: 'announcement',
          courseId: assignment.courseId,
        });

        // Prepare push notification for students with push tokens and notifications enabled
        if (student.pushToken && student.notificationsEnabled) {
          pushNotifications.push({
            pushToken: student.pushToken,
            title: 'Assignment Updated',
            body: pushMessage,
            data: {
              type: 'assignment_updated',
              assignmentId: assignment._id.toString(),
              courseId: assignment.courseId.toString(),
              courseName: assignment.courseName,
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
        message: 'Assignment updated successfully',
        data: {
          assignment: assignment.toJSON(),
          notificationsSent: notifications.length,
          pushNotificationsSent: pushNotifications.length,
        },
      });
    } catch (error) {
      console.error('Update assignment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update assignment',
      });
    }
  }
);

module.exports = router;


