const express = require('express');
const { body, param } = require('express-validator');
const { Notification, Course, User, Enrollment } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { sendBulkPushNotifications } = require('../utils/pushNotificationService');
const { sendBulkSMS } = require('../utils/smsService');

const router = express.Router();

/**
 * @route   GET /api/notifications
 * @desc    Get all notifications for current user
 * @access  Private
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { limit, unreadOnly } = req.query;
    
    const notifications = await Notification.getByUser(req.user.id, {
      limit: limit ? parseInt(limit) : 50,
      unreadOnly: unreadOnly === 'true',
    });

    const unreadCount = await Notification.getUnreadCount(req.user.id);

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
        count: notifications.length,
      },
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
    });
  }
});

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get unread notification count
 * @access  Private
 */
router.get('/unread-count', authenticate, async (req, res) => {
  try {
    const count = await Notification.getUnreadCount(req.user.id);

    res.json({
      success: true,
      data: {
        count,
      },
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unread count',
    });
  }
});

/**
 * @route   POST /api/notifications/send
 * @desc    Send notification to all students in a course (Course Rep only)
 * @access  Private (course_rep)
 */
router.post(
  '/send',
  authenticate,
  authorize('course_rep'),
  [
    body('courseId')
      .notEmpty()
      .withMessage('Course ID is required'),
    body('title')
      .trim()
      .notEmpty()
      .withMessage('Title is required'),
    body('message')
      .trim()
      .notEmpty()
      .withMessage('Message is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const { courseId, title, message } = req.body;

      // Verify course belongs to user
      if (!(await Course.isCreator(courseId, req.user.id))) {
        return res.status(403).json({
          success: false,
          message: 'You can only send notifications for your own courses',
        });
      }

      // Get course details
      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'Course not found',
        });
      }

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

      // Check if announcement is being sent within 30 minutes of next class time
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

      // Create personalized notifications for each student
      for (const enrollment of enrollments) {
        const student = enrollment.userId;
        
        // Skip if user no longer exists
        if (!student || !student._id) {
          continue;
        }
        
        // Fetch full user to check access status
        const fullUser = await User.findById(student._id);
        if (!fullUser) {
          continue;
        }

        // Check if user has active access (payment OR active trial)
        // Only send push notifications and SMS if user has active access
        const hasActiveAccess = fullUser.hasActiveAccess();
        
        // Get student's name for personalized notifications
        const studentName = student.fullName || 'Student';
        
        // Include course name in the message if it's not already there
        let messageWithCourse = message;
        if (!message.includes(course.courseName) && !message.includes(course.courseCode)) {
          messageWithCourse = `${course.courseName}: ${message}`;
        }
        
        const personalizedMessage = `Hi ${studentName}, ${messageWithCourse}`;
        
        // Create in-app notification for all students (even if trial expired)
        notifications.push({
          userId: student._id,
          title,
          message: personalizedMessage,
          type: 'announcement',
          courseId: courseId,
        });

        // Prepare push notification only if user has active access
        if (hasActiveAccess && student.pushToken && student.notificationsEnabled) {
          pushNotifications.push({
            pushToken: student.pushToken,
            title,
            body: personalizedMessage,
            data: {
              type: 'announcement',
              courseId: courseId.toString(),
              courseName: course.courseName,
            },
          });
        }

        // Prepare SMS only if user has active access (only if within 30 minutes of class)
        if (hasActiveAccess && shouldSendSMS && student.phoneNumber) {
          // Create concise SMS message (max 160 chars)
          const smsMessage = `Hi ${studentName}, URGENT: ${messageWithCourse}`;
          // Truncate if too long
          const finalSmsMessage = smsMessage.length > 160 ? smsMessage.substring(0, 157) + '...' : smsMessage;
          smsRecipients.push({
            phoneNumber: student.phoneNumber,
            message: finalSmsMessage,
            userId: student._id,
            type: 'announcement',
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
          console.log(`Sending ${pushNotifications.length} push notifications for announcement`);
          const pushResult = await sendBulkPushNotifications(pushNotifications);
          console.log(`Push notifications sent: ${pushResult.sent || 0} successful, ${pushResult.failed || 0} failed`);
        } catch (pushError) {
          console.error('Error sending push notifications:', pushError);
          // Don't fail the request if push notifications fail
        }
      } else {
        console.log('No push notifications to send (students may not have push tokens or notifications disabled)');
      }

      // Send SMS notifications (only if within 30 minutes of class)
      let smsResult = { sent: 0, failed: 0, limitExceeded: 0 };
      if (smsRecipients.length > 0) {
        try {
          console.log(`Sending ${smsRecipients.length} SMS notifications for announcement (within 30 minutes of class)`);
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
        message: `Notification sent to ${notifications.length} students`,
        data: {
          recipientCount: notifications.length,
          pushNotificationsSent: pushNotifications.length,
          smsSent: smsResult.sent || 0,
        },
      });
    } catch (error) {
      console.error('Send notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send notification',
      });
    }
  }
);

/**
 * @route   PUT /api/notifications/:id/read
 * @desc    Mark a notification as read
 * @access  Private
 */
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    await Notification.markAsRead(req.params.id, req.user.id);

    res.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
    });
  }
});

/**
 * @route   PUT /api/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.put('/read-all', authenticate, async (req, res) => {
  try {
    await Notification.markAllAsRead(req.user.id);

    res.json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notifications as read',
    });
  }
});

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete a notification
 * @access  Private
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await Notification.deleteOne({ _id: req.params.id, userId: req.user.id });

    res.json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
    });
  }
});

/**
 * @route   DELETE /api/notifications
 * @desc    Delete all notifications for current user
 * @access  Private
 */
router.delete('/', authenticate, async (req, res) => {
  try {
    await Notification.deleteAllForUser(req.user.id);

    res.json({
      success: true,
      message: 'All notifications deleted',
    });
  } catch (error) {
    console.error('Delete all notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notifications',
    });
  }
});

/**
 * @route   POST /api/notifications/register-token
 * @desc    Register or update push notification token for current user
 * @access  Private
 */
router.post(
  '/register-token',
  authenticate,
  [
    body('pushToken')
      .trim()
      .notEmpty()
      .withMessage('Push token is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const { pushToken } = req.body;
      // req.user.id is the string ID from toPublicJSON()
      const user = await User.findById(req.user.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      await user.updatePushToken(pushToken);

      res.json({
        success: true,
        message: 'Push token registered successfully',
      });
    } catch (error) {
      console.error('Register push token error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to register push token',
      });
    }
  }
);

/**
 * @route   DELETE /api/notifications/token
 * @desc    Remove push notification token for current user
 * @access  Private
 */
router.delete('/token', authenticate, async (req, res) => {
  try {
    // req.user.id is the string ID from toPublicJSON()
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    await user.updatePushToken(null);

    res.json({
      success: true,
      message: 'Push token removed successfully',
    });
  } catch (error) {
    console.error('Remove push token error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove push token',
    });
  }
});

module.exports = router;
