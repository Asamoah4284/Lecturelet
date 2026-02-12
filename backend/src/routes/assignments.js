const express = require('express');
const { body } = require('express-validator');
const { Assignment, Course } = require('../models');
const { isEnrolled } = require('../services/firestore/enrollments');
const { getCourseById: getFirestoreCourseById, isCreator: isFirestoreCreator } = require('../services/firestore/courses');
const {
  createAssignment: createFirestoreAssignment,
  getAssignmentsByCourseId: getFirestoreAssignmentsByCourseId,
  getAssignmentsByCreator: getFirestoreAssignmentsByCreator,
  getAssignmentById: getFirestoreAssignmentById,
  updateAssignment: updateFirestoreAssignment,
} = require('../services/firestore/assignments');
const { authenticate, authorize } = require('../middleware/auth');

const isValidMongoObjectId = (id) => typeof id === 'string' && /^[a-fA-F0-9]{24}$/.test(id);
const validate = require('../middleware/validate');
const { notifyEnrolledUsers } = require('../utils/notifyEnrolledUsers');

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
          message: 'You can only create assignments for your own courses',
        });
      }

      if (isValidMongoObjectId(courseId)) {
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
        const baseMessage = `A new assignment "${assignmentName}" has been created for ${courseName}. Submission deadline: ${date} at ${time}`;
        const notifyResult = await notifyEnrolledUsers(courseId, {
          title: 'New Assignment Created',
          message: baseMessage,
          type: 'assignment_created',
          data: {
            assignmentId: assignment._id.toString(),
            courseId: courseId.toString(),
            courseName: courseName,
          },
          courseName,
        });
        return res.status(201).json({
          success: true,
          message: 'Assignment created successfully',
          data: {
            assignment: assignment.toJSON(),
            notificationsSent: notifyResult.inAppCount,
            pushNotificationsSent: notifyResult.pushCount,
          },
        });
      }

      const assignment = await createFirestoreAssignment({
        courseId,
        assignmentName,
        date,
        time,
        venue,
        topic,
        courseCode,
        courseName,
        createdBy: req.user.id,
      });
      const baseMessage = `A new assignment "${assignmentName}" has been created for ${courseName}. Submission deadline: ${date} at ${time}`;
      const notifyResult = await notifyEnrolledUsers(courseId, {
        title: 'New Assignment Created',
        message: baseMessage,
        type: 'assignment_created',
        data: {
          assignmentId: assignment.id,
          courseId,
          courseName: courseName,
        },
        courseName,
      });
      return res.status(201).json({
        success: true,
        message: 'Assignment created successfully',
        data: {
          assignment,
          notificationsSent: notifyResult.inAppCount,
          pushNotificationsSent: notifyResult.pushCount,
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
            message: 'You can only view assignments for courses you are enrolled in or created',
          });
        }
        return res.json({
          success: true,
          data: { assignments: [], count: 0 },
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
          message: 'You can only view assignments for courses you are enrolled in or created',
        });
      }

      const assignments = await Assignment.findByCourse(courseId);

      res.json({
        success: true,
        data: {
          assignments: Array.isArray(assignments) ? assignments.map(a => (a && a.toJSON ? a.toJSON() : a)) : [],
          count: Array.isArray(assignments) ? assignments.length : 0,
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
      const userId = req.user.id;
      const mongoList = [];
      if (isValidMongoObjectId(userId)) {
        const mongoAssignments = await Assignment.findByCreator(userId);
        mongoList.push(...(Array.isArray(mongoAssignments) ? mongoAssignments : []).map((a) =>
          a && typeof a.toJSON === 'function' ? a.toJSON() : a
        ));
      }
      const firestoreList = await getFirestoreAssignmentsByCreator(userId);
      const assignments = [...mongoList, ...(Array.isArray(firestoreList) ? firestoreList : [])].sort((a, b) => {
        const ta = new Date(a.created_at || 0).getTime();
        const tb = new Date(b.created_at || 0).getTime();
        return tb - ta;
      });
      res.json({
        success: true,
        data: {
          assignments,
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

      const userId = req.user.id?.toString ? req.user.id.toString() : String(req.user.id);

      // Firestore IDs are not valid MongoDB ObjectIds
      if (!isValidMongoObjectId(assignmentId)) {
        const currentAssignment = await getFirestoreAssignmentById(assignmentId);
        if (!currentAssignment) {
          return res.status(404).json({
            success: false,
            message: 'Assignment not found',
          });
        }

        const assignmentCreatorId = String(currentAssignment.createdBy || '');
        if (assignmentCreatorId !== userId) {
          return res.status(403).json({
            success: false,
            message: 'You can only update assignments you created',
          });
        }

        const updateData = {};
        if (assignmentName !== undefined) updateData.assignmentName = assignmentName.trim();
        if (date !== undefined) updateData.date = date;
        if (time !== undefined) updateData.time = time;
        if (venue !== undefined) updateData.venue = venue.trim();
        if (topic !== undefined) updateData.topic = topic ? topic.trim() : null;

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

        const assignment = await updateFirestoreAssignment(assignmentId, updateData);
        if (!assignment) {
          return res.status(404).json({
            success: false,
            message: 'Assignment not found',
          });
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

        const notifyResult = await notifyEnrolledUsers(assignment.courseId, {
          title: 'Assignment Updated',
          message: pushMessage,
          type: 'assignment_updated',
          data: {
            assignmentId: assignment.id,
            courseId: assignment.courseId,
            courseName: assignment.courseName,
          },
          courseName: assignment.courseName,
        });

        return res.json({
          success: true,
          message: 'Assignment updated successfully',
          data: {
            assignment: {
              id: assignment.id,
              assignment_name: assignment.assignmentName,
              date: assignment.date,
              time: assignment.time,
              venue: assignment.venue,
              topic: assignment.topic ?? null,
              course_id: assignment.courseId,
              course_code: assignment.courseCode,
              course_name: assignment.courseName,
            },
            notificationsSent: notifyResult.inAppCount,
            pushNotificationsSent: notifyResult.pushCount,
          },
        });
      }

      // MongoDB path
      const currentAssignment = await Assignment.findById(assignmentId);
      if (!currentAssignment) {
        return res.status(404).json({
          success: false,
          message: 'Assignment not found',
        });
      }

      const assignmentCreatorId = currentAssignment.createdBy.toString();
      if (assignmentCreatorId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You can only update assignments you created',
        });
      }

      const updateData = {};
      if (assignmentName !== undefined) updateData.assignmentName = assignmentName.trim();
      if (date !== undefined) updateData.date = date;
      if (time !== undefined) updateData.time = time;
      if (venue !== undefined) updateData.venue = venue.trim();
      if (topic !== undefined) updateData.topic = topic ? topic.trim() : null;

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

      const assignment = await Assignment.findByIdAndUpdate(assignmentId, updateData, { new: true });

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

      const notifyResult = await notifyEnrolledUsers(assignment.courseId.toString(), {
        title: 'Assignment Updated',
        message: pushMessage,
        type: 'assignment_updated',
        data: {
          assignmentId: assignment._id.toString(),
          courseId: assignment.courseId.toString(),
          courseName: assignment.courseName,
        },
        courseName: assignment.courseName,
      });

      res.json({
        success: true,
        message: 'Assignment updated successfully',
        data: {
          assignment: assignment.toJSON(),
          notificationsSent: notifyResult.inAppCount,
          pushNotificationsSent: notifyResult.pushCount,
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



