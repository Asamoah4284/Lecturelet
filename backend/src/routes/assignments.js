const express = require('express');
const { body } = require('express-validator');
const { Assignment, Course, Enrollment, Notification, User } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { sendBulkPushNotifications } = require('../utils/pushNotificationService');
const { sendBulkSMS } = require('../utils/smsService');

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

      // Helper function to calculate next class time (similar to classReminderJob)
      const calculateNextClassTime = (courseData, fromDate = new Date()) => {
        try {
          const days = courseData.days || [];
          if (days.length === 0) return null;
          
          const dayTimes = courseData.dayTimes || {};
          const hasDayTimes = Object.keys(dayTimes).length > 0;
          
          const getDayName = (date) => {
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            return days[date.getDay()];
          };
          
          const parseTime = (timeStr, date) => {
            if (!timeStr) return null;
            try {
              const time12Hour = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
              if (time12Hour) {
                let hours = parseInt(time12Hour[1], 10);
                const minutes = parseInt(time12Hour[2], 10);
                const ampm = time12Hour[3].toUpperCase();
                if (ampm === 'PM' && hours !== 12) hours += 12;
                if (ampm === 'AM' && hours === 12) hours = 0;
                const result = new Date(date);
                result.setHours(hours, minutes, 0, 0);
                return result;
              }
              const time24Hour = timeStr.match(/(\d{1,2}):(\d{2})/);
              if (time24Hour) {
                const hours = parseInt(time24Hour[1], 10);
                const minutes = parseInt(time24Hour[2], 10);
                const result = new Date(date);
                result.setHours(hours, minutes, 0, 0);
                return result;
              }
              return null;
            } catch (error) {
              return null;
            }
          };
          
          for (let i = 0; i < 7; i++) {
            const checkDate = new Date(fromDate);
            checkDate.setDate(checkDate.getDate() + i);
            const dayName = getDayName(checkDate);
            
            if (!days.includes(dayName)) continue;
            
            let startTime = null;
            
            if (hasDayTimes && dayTimes[dayName]) {
              startTime = parseTime(dayTimes[dayName].startTime, checkDate);
            } else {
              startTime = parseTime(courseData.startTime, checkDate);
            }
            
            if (startTime) {
              const timeDiff = startTime.getTime() - fromDate.getTime();
              const thirtyMinutes = 30 * 60 * 1000;
              if (timeDiff >= -thirtyMinutes) {
                return startTime;
              }
            }
          }
          
          return null;
        } catch (error) {
          return null;
        }
      };

      // Check if assignment creation is within 30 minutes of next class time
      const now = new Date();
      const nextClassTime = calculateNextClassTime(course, now);
      const thirtyMinutes = 30 * 60 * 1000;
      const isWithinThirtyMinutes = nextClassTime && 
                                    (nextClassTime.getTime() - now.getTime() <= thirtyMinutes && 
                                     nextClassTime.getTime() - now.getTime() > 0);
      
      const shouldSendSMS = isWithinThirtyMinutes;

      // Get all enrolled students for the course
      const enrollments = await Enrollment.find({ courseId })
        .populate('userId', 'pushToken notificationsEnabled fullName phoneNumber');

      // Prepare notifications for all enrolled students
      const notifications = [];
      const pushNotifications = [];
      const smsRecipients = [];

      const baseMessage = `A new assignment "${assignmentName}" has been created for ${courseName}. Submission deadline: ${date} at ${time}`;

      for (const enrollment of enrollments) {
        const student = enrollment.userId;
        
        // Get student's name for personalized notifications
        const studentName = student.fullName || 'Student';
        const personalizedMessage = `Hi ${studentName}, ${baseMessage}`;
        
        // Create in-app notification for all students
        notifications.push({
          userId: student._id,
          title: 'New Assignment Created',
          message: personalizedMessage,
          type: 'announcement',
          courseId: courseId,
        });

        // Prepare push notification for students with push tokens and notifications enabled
        if (student.pushToken && student.notificationsEnabled) {
          pushNotifications.push({
            pushToken: student.pushToken,
            title: 'New Assignment Created',
            body: personalizedMessage,
            data: {
              type: 'assignment_created',
              assignmentId: assignment._id.toString(),
              courseId: courseId.toString(),
              courseName: courseName,
            },
          });
        }

        // Prepare SMS for students with phone numbers (only if within 30 minutes of class)
        if (shouldSendSMS && student.phoneNumber) {
          const smsMessage = `Hi ${studentName}, URGENT: New assignment "${assignmentName}" for ${courseName}. Deadline: ${date} at ${time}.`;
          // Truncate if too long
          const finalSmsMessage = smsMessage.length > 160 ? smsMessage.substring(0, 157) + '...' : smsMessage;
          smsRecipients.push({
            phoneNumber: student.phoneNumber,
            message: finalSmsMessage,
            userId: student._id,
            type: 'assignment',
            courseId: courseId
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

      // Send SMS notifications (only if within 30 minutes of class)
      let smsResult = { sent: 0, failed: 0, limitExceeded: 0 };
      if (smsRecipients.length > 0) {
        try {
          console.log(`Sending ${smsRecipients.length} SMS notifications (within 30 minutes of class)`);
          smsResult = await sendBulkSMS(smsRecipients);
          console.log(`SMS notifications sent: ${smsResult.sent || 0} successful, ${smsResult.failed || 0} failed, ${smsResult.limitExceeded || 0} limit exceeded`);
          if (smsResult.errors && smsResult.errors.length > 0) {
            console.error('SMS errors:', smsResult.errors);
          }
        } catch (smsError) {
          console.error('Error sending SMS notifications:', smsError);
          // Don't fail the request if SMS fails
        }
      } else if (shouldSendSMS) {
        console.log('No SMS recipients found (students may not have phone numbers)');
      }

      res.status(201).json({
        success: true,
        message: 'Assignment created successfully',
        data: {
          assignment: assignment.toJSON(),
          notificationsSent: notifications.length,
          pushNotificationsSent: pushNotifications.length,
          smsSent: smsResult.sent || 0,
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



