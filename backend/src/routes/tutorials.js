const express = require('express');
const { body } = require('express-validator');
const { Tutorial, Course } = require('../models');
const { isEnrolled } = require('../services/firestore/enrollments');
const { getCourseById: getFirestoreCourseById, isCreator: isFirestoreCreator } = require('../services/firestore/courses');
const {
  createTutorial: createFirestoreTutorial,
  getTutorialsByCourseId: getFirestoreTutorialsByCourseId,
  getTutorialsByCreator: getFirestoreTutorialsByCreator,
  getTutorialById: getFirestoreTutorialById,
  updateTutorial: updateFirestoreTutorial,
} = require('../services/firestore/tutorials');
const { authenticate, authorize } = require('../middleware/auth');

const isValidMongoObjectId = (id) => typeof id === 'string' && /^[a-fA-F0-9]{24}$/.test(id);
const validate = require('../middleware/validate');
const { notifyEnrolledUsers } = require('../utils/notifyEnrolledUsers');

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

      let course;
      let isCreator;
      if (isValidMongoObjectId(courseId)) {
        course = await Course.findById(courseId);
        if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
        isCreator = await Course.isCreator(courseId, req.user.id);
      } else {
        course = await getFirestoreCourseById(courseId);
        if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
        isCreator = await isFirestoreCreator(courseId, req.user.id);
      }
      if (!isCreator) {
        return res.status(403).json({
          success: false,
          message: 'You can only create tutorials for your own courses',
        });
      }

      if (isValidMongoObjectId(courseId)) {
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
        const baseMessage = `A new tutorial "${tutorialName}" has been scheduled for ${courseName} on ${date} at ${time}`;
        const notifyResult = await notifyEnrolledUsers(courseId, {
          title: 'New Tutorial Created',
          message: baseMessage,
          type: 'tutorial_created',
          data: {
            tutorialId: tutorial._id.toString(),
            courseId: courseId.toString(),
            courseName: courseName,
          },
          courseName,
        });
        return res.status(201).json({
          success: true,
          message: 'Tutorial created successfully',
          data: {
            tutorial: tutorial.toJSON(),
            notificationsSent: notifyResult.inAppCount,
            pushNotificationsSent: notifyResult.pushCount,
          },
        });
      }

      const tutorial = await createFirestoreTutorial({
        courseId,
        tutorialName,
        date,
        time,
        venue,
        topic,
        courseCode,
        courseName,
        createdBy: req.user.id,
      });
      const baseMessage = `A new tutorial "${tutorialName}" has been scheduled for ${courseName} on ${date} at ${time}`;
      const notifyResult = await notifyEnrolledUsers(courseId, {
        title: 'New Tutorial Created',
        message: baseMessage,
        type: 'tutorial_created',
        data: {
          tutorialId: tutorial.id,
          courseId,
          courseName: courseName,
        },
        courseName,
      });
      return res.status(201).json({
        success: true,
        message: 'Tutorial created successfully',
        data: {
          tutorial,
          notificationsSent: notifyResult.inAppCount,
          pushNotificationsSent: notifyResult.pushCount,
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
            message: 'You can only view tutorials for courses you are enrolled in or created',
          });
        }
        const tutorials = await getFirestoreTutorialsByCourseId(courseId);
        return res.json({
          success: true,
          data: { tutorials, count: tutorials.length },
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
          message: 'You can only view tutorials for courses you are enrolled in or created',
        });
      }

      const tutorials = await Tutorial.findByCourse(courseId);

      res.json({
        success: true,
        data: {
          tutorials: Array.isArray(tutorials) ? tutorials.map(t => (t && t.toJSON ? t.toJSON() : t)) : [],
          count: Array.isArray(tutorials) ? tutorials.length : 0,
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
      const userId = req.user.id;
      const mongoList = [];
      if (isValidMongoObjectId(userId)) {
        const mongoTutorials = await Tutorial.findByCreator(userId);
        mongoList.push(...(Array.isArray(mongoTutorials) ? mongoTutorials : []).map((t) =>
          t && typeof t.toJSON === 'function' ? t.toJSON() : t
        ));
      }
      const firestoreList = await getFirestoreTutorialsByCreator(userId);
      const tutorials = [...mongoList, ...(Array.isArray(firestoreList) ? firestoreList : [])].sort((a, b) => {
        const ta = new Date(a.created_at || 0).getTime();
        const tb = new Date(b.created_at || 0).getTime();
        return tb - ta;
      });
      res.json({
        success: true,
        data: {
          tutorials,
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

      const userId = req.user.id?.toString ? req.user.id.toString() : String(req.user.id);

      // Firestore IDs are not valid MongoDB ObjectIds (e.g. "6g4B1eaQaF7KiqW2NuOM")
      if (!isValidMongoObjectId(tutorialId)) {
        const currentTutorial = await getFirestoreTutorialById(tutorialId);
        if (!currentTutorial) {
          return res.status(404).json({
            success: false,
            message: 'Tutorial not found',
          });
        }

        const tutorialCreatorId = String(currentTutorial.createdBy || '');
        if (tutorialCreatorId !== userId) {
          return res.status(403).json({
            success: false,
            message: 'You can only update tutorials you created',
          });
        }

        const updateData = {};
        if (tutorialName !== undefined) updateData.tutorialName = tutorialName.trim();
        if (date !== undefined) updateData.date = date;
        if (time !== undefined) updateData.time = time;
        if (venue !== undefined) updateData.venue = venue.trim();
        if (topic !== undefined) updateData.topic = topic ? topic.trim() : null;

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

        const tutorial = await updateFirestoreTutorial(tutorialId, updateData);
        if (!tutorial) {
          return res.status(404).json({
            success: false,
            message: 'Tutorial not found',
          });
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

        const notifyResult = await notifyEnrolledUsers(tutorial.courseId, {
          title: 'Tutorial Updated',
          message: pushMessage,
          type: 'tutorial_updated',
          data: {
            tutorialId: tutorial.id,
            courseId: tutorial.courseId,
            courseName: tutorial.courseName,
          },
          courseName: tutorial.courseName,
        });

        return res.json({
          success: true,
          message: 'Tutorial updated successfully',
          data: {
            tutorial: {
              id: tutorial.id,
              tutorial_name: tutorial.tutorialName,
              date: tutorial.date,
              time: tutorial.time,
              venue: tutorial.venue,
              topic: tutorial.topic ?? null,
              course_id: tutorial.courseId,
              course_code: tutorial.courseCode,
              course_name: tutorial.courseName,
            },
            notificationsSent: notifyResult.inAppCount,
            pushNotificationsSent: notifyResult.pushCount,
          },
        });
      }

      // MongoDB path
      const currentTutorial = await Tutorial.findById(tutorialId);
      if (!currentTutorial) {
        return res.status(404).json({
          success: false,
          message: 'Tutorial not found',
        });
      }

      const tutorialCreatorId = currentTutorial.createdBy.toString();
      if (tutorialCreatorId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You can only update tutorials you created',
        });
      }

      const updateData = {};
      if (tutorialName !== undefined) updateData.tutorialName = tutorialName.trim();
      if (date !== undefined) updateData.date = date;
      if (time !== undefined) updateData.time = time;
      if (venue !== undefined) updateData.venue = venue.trim();
      if (topic !== undefined) updateData.topic = topic ? topic.trim() : null;

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

      const tutorial = await Tutorial.findByIdAndUpdate(tutorialId, updateData, { new: true });

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

      const notifyResult = await notifyEnrolledUsers(tutorial.courseId.toString(), {
        title: 'Tutorial Updated',
        message: pushMessage,
        type: 'tutorial_updated',
        data: {
          tutorialId: tutorial._id.toString(),
          courseId: tutorial.courseId.toString(),
          courseName: tutorial.courseName,
        },
        courseName: tutorial.courseName,
      });

      res.json({
        success: true,
        message: 'Tutorial updated successfully',
        data: {
          tutorial: tutorial.toJSON(),
          notificationsSent: notifyResult.inAppCount,
          pushNotificationsSent: notifyResult.pushCount,
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



