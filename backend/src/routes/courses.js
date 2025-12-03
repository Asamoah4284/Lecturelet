const express = require('express');
const { body, param, query } = require('express-validator');
const { Course, Enrollment, Notification } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

/**
 * @route   POST /api/courses
 * @desc    Create a new course (Course Rep only)
 * @access  Private (course_rep)
 */
router.post(
  '/',
  authenticate,
  authorize('course_rep'),
  [
    body('courseName')
      .trim()
      .notEmpty()
      .withMessage('Course name is required'),
    body('courseCode')
      .trim()
      .notEmpty()
      .withMessage('Course code is required'),
    body('days')
      .notEmpty()
      .withMessage('At least one lecture day is required'),
    body('startTime')
      .trim()
      .notEmpty()
      .withMessage('Start time is required'),
    body('endTime')
      .trim()
      .notEmpty()
      .withMessage('End time is required'),
    body('venue').optional().trim(),
    body('creditHours').optional().trim(),
    body('indexFrom').optional().trim(),
    body('indexTo').optional().trim(),
    body('courseRepName').optional().trim(),
  ],
  validate,
  async (req, res) => {
    try {
      const {
        courseName,
        courseCode,
        days,
        startTime,
        endTime,
        venue,
        creditHours,
        indexFrom,
        indexTo,
        courseRepName,
      } = req.body;

      // Generate unique code
      const uniqueCode = await Course.generateUniqueCode();

      const course = await Course.create({
        uniqueCode,
        courseName,
        courseCode,
        days: Array.isArray(days) ? days : [days],
        startTime,
        endTime,
        venue,
        creditHours,
        indexFrom,
        indexTo,
        courseRepName: courseRepName || req.user.full_name,
        createdBy: req.user.id,
      });

      res.status(201).json({
        success: true,
        message: 'Course created successfully',
        data: {
          course,
        },
      });
    } catch (error) {
      console.error('Create course error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create course',
      });
    }
  }
);

/**
 * @route   GET /api/courses/my-courses
 * @desc    Get courses created by the current user (Course Rep)
 * @access  Private (course_rep)
 */
router.get(
  '/my-courses',
  authenticate,
  authorize('course_rep'),
  async (req, res) => {
    try {
      const courses = await Course.findByCreator(req.user.id);

      // Get student count for each course
      const coursesWithCount = await Promise.all(
        courses.map(async (course) => {
          const studentCount = await Enrollment.getCount(course._id);
          return {
            ...course.toJSON(),
            student_count: studentCount,
          };
        })
      );

      res.json({
        success: true,
        data: {
          courses: coursesWithCount,
          count: coursesWithCount.length,
        },
      });
    } catch (error) {
      console.error('Get my courses error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch courses',
      });
    }
  }
);

/**
 * @route   GET /api/courses/search
 * @desc    Search courses by name, code, or rep name
 * @access  Private
 */
router.get(
  '/search',
  authenticate,
  [
    query('q')
      .trim()
      .notEmpty()
      .withMessage('Search query is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const { q } = req.query;
      const courses = await Course.search(q);

      // Get student count for each course
      const coursesWithCount = await Promise.all(
        courses.map(async (course) => {
          const studentCount = await Enrollment.getCount(course._id);
          return {
            ...course.toJSON(),
            student_count: studentCount,
            creator_name: course.createdBy?.fullName,
          };
        })
      );

      res.json({
        success: true,
        data: {
          courses: coursesWithCount,
          count: coursesWithCount.length,
        },
      });
    } catch (error) {
      console.error('Search courses error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search courses',
      });
    }
  }
);

/**
 * @route   GET /api/courses/code/:uniqueCode
 * @desc    Get course by unique code
 * @access  Private
 */
router.get(
  '/code/:uniqueCode',
  authenticate,
  [
    param('uniqueCode')
      .trim()
      .isLength({ min: 6, max: 6 })
      .withMessage('Invalid course code format'),
  ],
  validate,
  async (req, res) => {
    try {
      const course = await Course.findByUniqueCode(req.params.uniqueCode);

      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'Course not found',
        });
      }

      // Check if user is enrolled
      const isEnrolled = await Enrollment.isEnrolled(req.user.id, course._id);
      const studentCount = await Enrollment.getCount(course._id);

      res.json({
        success: true,
        data: {
          course: {
            ...course.toJSON(),
            student_count: studentCount,
            creator_name: course.createdBy?.fullName,
          },
          isEnrolled,
        },
      });
    } catch (error) {
      console.error('Get course by code error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch course',
      });
    }
  }
);

/**
 * @route   GET /api/courses/:id
 * @desc    Get course by ID
 * @access  Private
 */
router.get(
  '/:id',
  authenticate,
  async (req, res) => {
    try {
      const course = await Course.findById(req.params.id).populate('createdBy', 'fullName');

      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'Course not found',
        });
      }

      // Check if user is enrolled or is the creator
      const isEnrolled = await Enrollment.isEnrolled(req.user.id, course._id);
      const isCreator = course.createdBy._id.toString() === req.user.id;
      const studentCount = await Enrollment.getCount(course._id);

      res.json({
        success: true,
        data: {
          course: {
            ...course.toJSON(),
            student_count: studentCount,
            creator_name: course.createdBy?.fullName,
          },
          isEnrolled,
          isCreator,
        },
      });
    } catch (error) {
      console.error('Get course error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch course',
      });
    }
  }
);

/**
 * @route   PUT /api/courses/:id
 * @desc    Update a course (Creator only)
 * @access  Private (course_rep)
 */
router.put(
  '/:id',
  authenticate,
  authorize('course_rep'),
  [
    body('courseName').optional().trim().notEmpty(),
    body('courseCode').optional().trim().notEmpty(),
    body('days').optional(),
    body('startTime').optional().trim().notEmpty(),
    body('endTime').optional().trim().notEmpty(),
    body('venue').optional().trim(),
    body('creditHours').optional().trim(),
    body('indexFrom').optional().trim(),
    body('indexTo').optional().trim(),
    body('courseRepName').optional().trim(),
  ],
  validate,
  async (req, res) => {
    try {
      const courseId = req.params.id;

      // Check if course exists and user is creator
      if (!(await Course.isCreator(courseId, req.user.id))) {
        return res.status(403).json({
          success: false,
          message: 'You can only update courses you created',
        });
      }

      const {
        courseName,
        courseCode,
        days,
        startTime,
        endTime,
        venue,
        creditHours,
        indexFrom,
        indexTo,
        courseRepName,
      } = req.body;

      const updateData = {};
      if (courseName !== undefined) updateData.courseName = courseName;
      if (courseCode !== undefined) updateData.courseCode = courseCode;
      if (days !== undefined) updateData.days = Array.isArray(days) ? days : [days];
      if (startTime !== undefined) updateData.startTime = startTime;
      if (endTime !== undefined) updateData.endTime = endTime;
      if (venue !== undefined) updateData.venue = venue;
      if (creditHours !== undefined) updateData.creditHours = creditHours;
      if (indexFrom !== undefined) updateData.indexFrom = indexFrom;
      if (indexTo !== undefined) updateData.indexTo = indexTo;
      if (courseRepName !== undefined) updateData.courseRepName = courseRepName;

      const course = await Course.findByIdAndUpdate(courseId, updateData, { new: true });

      // Notify enrolled students about the update
      await Notification.createForCourse(courseId, {
        title: 'Course Updated',
        message: `${course.courseName} has been updated`,
        type: 'course_update',
      });

      res.json({
        success: true,
        message: 'Course updated successfully',
        data: {
          course,
        },
      });
    } catch (error) {
      console.error('Update course error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update course',
      });
    }
  }
);

/**
 * @route   DELETE /api/courses/:id
 * @desc    Delete a course (Creator only)
 * @access  Private (course_rep)
 */
router.delete(
  '/:id',
  authenticate,
  authorize('course_rep'),
  async (req, res) => {
    try {
      const courseId = req.params.id;

      // Check if course exists and user is creator
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
          message: 'You can only delete courses you created',
        });
      }

      // Delete related enrollments and notifications
      await Enrollment.deleteMany({ courseId });
      await Notification.deleteMany({ courseId });
      await Course.findByIdAndDelete(courseId);

      res.json({
        success: true,
        message: 'Course deleted successfully',
      });
    } catch (error) {
      console.error('Delete course error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete course',
      });
    }
  }
);

/**
 * @route   GET /api/courses/:id/students
 * @desc    Get students enrolled in a course (Creator only)
 * @access  Private (course_rep)
 */
router.get(
  '/:id/students',
  authenticate,
  authorize('course_rep'),
  async (req, res) => {
    try {
      const courseId = req.params.id;

      // Check if user is creator
      if (!(await Course.isCreator(courseId, req.user.id))) {
        return res.status(403).json({
          success: false,
          message: 'You can only view students for courses you created',
        });
      }

      const students = await Enrollment.getCourseStudents(courseId);

      res.json({
        success: true,
        data: {
          students,
          count: students.length,
        },
      });
    } catch (error) {
      console.error('Get course students error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch students',
      });
    }
  }
);

module.exports = router;
