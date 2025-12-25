const express = require('express');
const { body } = require('express-validator');
const { Quiz, Course, Enrollment, Notification, User } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { sendBulkPushNotifications } = require('../utils/pushNotificationService');
const { sendBulkSMS } = require('../utils/smsService');

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

      // Helper function to calculate next class time
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

      // Check if quiz creation is within 30 minutes of next class time
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

      const baseMessage = `A new quiz "${quizName}" has been scheduled for ${courseName} on ${date} at ${time}`;

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
        const hasActiveAccess = fullUser.hasActiveAccess();
        
        // Get student's name for personalized notifications
        const studentName = student.fullName || 'Student';
        const personalizedMessage = `Hi ${studentName}, ${baseMessage}`;
        
        // Create in-app notification for all students (even if trial expired)
        notifications.push({
          userId: student._id,
          title: 'New Quiz Created',
          message: personalizedMessage,
          type: 'announcement',
          courseId: courseId,
        });

        // Prepare push notification only if user has active access
        if (hasActiveAccess && student.pushToken && student.notificationsEnabled) {
          pushNotifications.push({
            pushToken: student.pushToken,
            title: 'New Quiz Created',
            body: personalizedMessage,
            data: {
              type: 'quiz_created',
              quizId: quiz._id.toString(),
              courseId: courseId.toString(),
              courseName: courseName,
            },
          });
        }

        // Prepare SMS only if user has active access (only if within 30 minutes of class)
        if (hasActiveAccess && shouldSendSMS && student.phoneNumber) {
          const smsMessage = `Hi ${studentName}, URGENT: New quiz "${quizName}" for ${courseName} on ${date} at ${time}.`;
          // Truncate if too long
          const finalSmsMessage = smsMessage.length > 160 ? smsMessage.substring(0, 157) + '...' : smsMessage;
          smsRecipients.push({
            phoneNumber: student.phoneNumber,
            message: finalSmsMessage,
            userId: student._id,
            type: 'quiz',
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
        message: 'Quiz created successfully',
        data: {
          quiz: quiz.toJSON(),
          notificationsSent: notifications.length,
          pushNotificationsSent: pushNotifications.length,
          smsSent: smsResult.sent || 0,
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



