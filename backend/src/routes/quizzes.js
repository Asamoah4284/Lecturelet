const express = require('express');
const { body } = require('express-validator');
const { Quiz, Course } = require('../models');
const { isEnrolled } = require('../services/firestore/enrollments');
const { getCourseById: getFirestoreCourseById, isCreator: isFirestoreCreator } = require('../services/firestore/courses');
const { createQuiz: createFirestoreQuiz, getQuizzesByCourseId: getFirestoreQuizzesByCourseId, getQuizzesByCreator: getFirestoreQuizzesByCreator } = require('../services/firestore/quizzes');
const { authenticate, authorize } = require('../middleware/auth');

const isValidMongoObjectId = (id) => typeof id === 'string' && /^[a-fA-F0-9]{24}$/.test(id);
const validate = require('../middleware/validate');
const { notifyEnrolledUsers } = require('../utils/notifyEnrolledUsers');

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

      let course;
      let isCreator;

      if (isValidMongoObjectId(courseId)) {
        course = await Course.findById(courseId);
        if (!course) {
          return res.status(404).json({ success: false, message: 'Course not found' });
        }
        isCreator = await Course.isCreator(courseId, req.user.id);
      } else {
        course = await getFirestoreCourseById(courseId);
        if (!course) {
          return res.status(404).json({ success: false, message: 'Course not found' });
        }
        isCreator = await isFirestoreCreator(courseId, req.user.id);
      }

      if (!isCreator) {
        return res.status(403).json({
          success: false,
          message: 'You can only create quizzes for your own courses',
        });
      }

      if (isValidMongoObjectId(courseId)) {
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
        const baseMessage = `A new quiz "${quizName}" has been scheduled for ${courseName} on ${date} at ${time}`;
        const notifyResult = await notifyEnrolledUsers(courseId, {
          title: 'New Quiz Created',
          message: baseMessage,
          type: 'quiz_created',
          data: {
            quizId: quiz._id.toString(),
            courseId: courseId.toString(),
            courseName: courseName,
          },
          courseName,
        });
        return res.status(201).json({
          success: true,
          message: 'Quiz created successfully',
          data: {
            quiz: quiz.toJSON(),
            notificationsSent: notifyResult.inAppCount,
            pushNotificationsSent: notifyResult.pushCount,
          },
        });
      }

      const quiz = await createFirestoreQuiz({
        courseId,
        quizName,
        date,
        time,
        venue,
        topic,
        courseCode,
        courseName,
        createdBy: req.user.id,
      });
      const baseMessage = `A new quiz "${quizName}" has been scheduled for ${courseName} on ${date} at ${time}`;
      const notifyResult = await notifyEnrolledUsers(courseId, {
        title: 'New Quiz Created',
        message: baseMessage,
        type: 'quiz_created',
        data: {
          quizId: quiz.id,
          courseId,
          courseName: courseName,
        },
        courseName,
      });
      return res.status(201).json({
        success: true,
        message: 'Quiz created successfully',
        data: {
          quiz,
          notificationsSent: notifyResult.inAppCount,
          pushNotificationsSent: notifyResult.pushCount,
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

      // Firestore course IDs are not 24-char hex; never pass them to Mongoose
      if (!isValidMongoObjectId(courseId)) {
        const course = await getFirestoreCourseById(courseId);
        if (!course) {
          return res.status(404).json({ success: false, message: 'Course not found' });
        }
        const enrolled = await isEnrolled(req.user.id, courseId);
        const creator = await isFirestoreCreator(courseId, req.user.id);
        if (!enrolled && !creator) {
          return res.status(403).json({
            success: false,
            message: 'You can only view quizzes for courses you are enrolled in or created',
          });
        }
        const quizzes = await getFirestoreQuizzesByCourseId(courseId);
        return res.json({
          success: true,
          data: { quizzes, count: quizzes.length },
        });
      }

      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({ success: false, message: 'Course not found' });
      }
      const enrolled = await isEnrolled(req.user.id, courseId);
      const creator = course.createdBy.toString() === req.user.id;
      if (!enrolled && !creator) {
        return res.status(403).json({
          success: false,
          message: 'You can only view quizzes for courses you are enrolled in or created',
        });
      }

      const quizzes = await Quiz.findByCourse(courseId);

      res.json({
        success: true,
        data: {
          quizzes: Array.isArray(quizzes) ? quizzes.map(q => (q && q.toJSON ? q.toJSON() : q)) : [],
          count: Array.isArray(quizzes) ? quizzes.length : 0,
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
 * @desc    Get all quizzes created by the current user (Course Rep) – Mongo + Firestore
 * @access  Private (course_rep)
 */
router.get(
  '/my-quizzes',
  authenticate,
  authorize('course_rep'),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const mongoList = [];
      if (isValidMongoObjectId(userId)) {
        const mongoQuizzes = await Quiz.findByCreator(userId);
        mongoList.push(...(Array.isArray(mongoQuizzes) ? mongoQuizzes : []).map((q) =>
          q && typeof q.toJSON === 'function' ? q.toJSON() : q
        ));
      }
      const firestoreList = await getFirestoreQuizzesByCreator(userId);
      const quizzes = [...mongoList, ...(Array.isArray(firestoreList) ? firestoreList : [])].sort((a, b) => {
        const ta = new Date(a.created_at || 0).getTime();
        const tb = new Date(b.created_at || 0).getTime();
        return tb - ta;
      });

      res.json({
        success: true,
        data: {
          quizzes,
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

      // Build notification message
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

      // Notify enrolled students immediately (in-app + push)
      const notifyResult = await notifyEnrolledUsers(quiz.courseId.toString(), {
        title: 'Quiz Updated',
        message: pushMessage,
        type: 'quiz_updated',
        data: {
          quizId: quiz._id.toString(),
          courseId: quiz.courseId.toString(),
          courseName: quiz.courseName,
        },
        courseName: quiz.courseName,
      });

      res.json({
        success: true,
        message: 'Quiz updated successfully',
        data: {
          quiz: quiz.toJSON(),
          notificationsSent: notifyResult.inAppCount,
          pushNotificationsSent: notifyResult.pushCount,
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



