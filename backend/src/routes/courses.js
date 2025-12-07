const express = require('express');
const { body, param, query } = require('express-validator');
const { Course, Enrollment, Notification, User } = require('../models');
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
    body('dayTimes').optional(),
    body('startTime')
      .optional()
      .trim(),
    body('endTime')
      .optional()
      .trim(),
    body('venue').optional().trim(),
    body('creditHours').optional().trim(),
    body('indexFrom').optional().trim(),
    body('indexTo').optional().trim(),
    body('courseRepName').optional().trim(),
    body('allowedPhoneNumbers').optional().isArray(),
  ],
  validate,
  async (req, res) => {
    try {
      const {
        courseName,
        courseCode,
        days,
        dayTimes,
        startTime,
        endTime,
        venue,
        creditHours,
        indexFrom,
        indexTo,
        courseRepName,
        allowedPhoneNumbers,
      } = req.body;

      // Generate unique 5-digit code
      const uniqueCode = await Course.generateUniqueCode();

      // Use dayTimes if provided, otherwise fall back to single startTime/endTime
      let courseStartTime = startTime;
      let courseEndTime = endTime;
      
      if (dayTimes && Object.keys(dayTimes).length > 0) {
        // Use first day's time for backward compatibility
        const firstDay = Array.isArray(days) ? days[0] : days;
        if (dayTimes[firstDay]) {
          courseStartTime = dayTimes[firstDay].startTime;
          courseEndTime = dayTimes[firstDay].endTime;
        }
      }

      // Normalize phone numbers - trim and ensure they're strings
      const normalizedPhoneNumbers = allowedPhoneNumbers && Array.isArray(allowedPhoneNumbers)
        ? allowedPhoneNumbers.map(num => String(num).trim()).filter(num => num.length > 0)
        : [];

      const course = await Course.create({
        uniqueCode,
        courseName,
        courseCode,
        days: Array.isArray(days) ? days : [days],
        startTime: courseStartTime,
        endTime: courseEndTime,
        dayTimes: dayTimes || {},
        venue,
        creditHours,
        indexFrom,
        indexTo,
        courseRepName: courseRepName || req.user.full_name,
        createdBy: req.user.id,
        allowedPhoneNumbers: normalizedPhoneNumbers,
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
      .isLength({ min: 5, max: 5 })
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
        dayTimes,
        startTime,
        endTime,
        venue,
        creditHours,
        indexFrom,
        indexTo,
        courseRepName,
        editType, // 'temporary' or 'permanent'
      } = req.body;

      const updateData = {};
      if (courseName !== undefined) updateData.courseName = courseName;
      if (courseCode !== undefined) updateData.courseCode = courseCode;
      if (days !== undefined) updateData.days = Array.isArray(days) ? days : [days];
      
      // Handle dayTimes - if provided, use it; otherwise use single startTime/endTime
      if (dayTimes !== undefined && Object.keys(dayTimes).length > 0) {
        updateData.dayTimes = dayTimes;
        // Also update startTime/endTime for backward compatibility (use first day's time)
        const firstDay = Array.isArray(days) ? days[0] : days;
        if (dayTimes[firstDay]) {
          updateData.startTime = dayTimes[firstDay].startTime;
          updateData.endTime = dayTimes[firstDay].endTime;
        }
      } else {
        if (startTime !== undefined) updateData.startTime = startTime;
        if (endTime !== undefined) updateData.endTime = endTime;
      }
      
      if (venue !== undefined) updateData.venue = venue;
      if (creditHours !== undefined) updateData.creditHours = creditHours;
      if (indexFrom !== undefined) updateData.indexFrom = indexFrom;
      if (indexTo !== undefined) updateData.indexTo = indexTo;
      if (courseRepName !== undefined) updateData.courseRepName = courseRepName;
      if (allowedPhoneNumbers !== undefined) {
        // Normalize phone numbers - trim and ensure they're strings
        updateData.allowedPhoneNumbers = Array.isArray(allowedPhoneNumbers)
          ? allowedPhoneNumbers.map(num => String(num).trim()).filter(num => num.length > 0)
          : [];
      }

      // Handle temporary vs permanent edits
      if (editType === 'temporary') {
        // Get current course to save as original values
        const currentCourse = await Course.findById(courseId);
        if (currentCourse) {
          // Save current values as original (only if not already saved)
          // If originalValues already exists, keep it (don't overwrite)
          if (!currentCourse.originalValues) {
            updateData.originalValues = {
              courseName: currentCourse.courseName,
              courseCode: currentCourse.courseCode,
              days: currentCourse.days,
              startTime: currentCourse.startTime,
              endTime: currentCourse.endTime,
              dayTimes: currentCourse.dayTimes,
              venue: currentCourse.venue,
              creditHours: currentCourse.creditHours,
              indexFrom: currentCourse.indexFrom,
              indexTo: currentCourse.indexTo,
              courseRepName: currentCourse.courseRepName,
            };
          }
          // Set expiration to 24 hours from now
          const expirationDate = new Date();
          expirationDate.setHours(expirationDate.getHours() + 24);
          updateData.temporaryEditExpiresAt = expirationDate;
        }
      } else {
        // Permanent edit - clear temporary edit fields and apply changes permanently
        updateData.temporaryEditExpiresAt = null;
        updateData.originalValues = null;
      }

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

/**
 * @route   POST /api/courses/:id/students
 * @desc    Add a student to a course by phone number (Creator only)
 * @access  Private (course_rep)
 */
router.post(
  '/:id/students',
  authenticate,
  authorize('course_rep'),
  [
    body('phoneNumber')
      .trim()
      .notEmpty()
      .withMessage('Phone number is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const courseId = req.params.id;
      const { phoneNumber } = req.body;

      // Check if user is creator
      if (!(await Course.isCreator(courseId, req.user.id))) {
        return res.status(403).json({
          success: false,
          message: 'You can only add students to courses you created',
        });
      }

      // Find student by phone number
      const student = await User.findOne({ 
        phoneNumber: phoneNumber.trim(),
        role: 'student'
      });

      if (!student) {
        return res.status(404).json({
          success: false,
          message: 'Student not found with this phone number',
        });
      }

      // Check if already enrolled
      if (await Enrollment.isEnrolled(student._id, courseId)) {
        return res.status(409).json({
          success: false,
          message: 'Student is already enrolled in this course',
        });
      }

      // Enroll student
      await Enrollment.enroll(student._id, courseId);

      // Get course for notification
      const course = await Course.findById(courseId);

      // Send notification to student
      await Notification.create({
        userId: student._id,
        title: 'Course Enrollment',
        message: `You have been enrolled in ${course.courseName}`,
        type: 'announcement',
        courseId: courseId,
      });

      res.status(201).json({
        success: true,
        message: `Successfully added ${student.full_name} to the course`,
        data: {
          student: {
            id: student._id,
            full_name: student.full_name,
            phone_number: student.phoneNumber,
            student_id: student.studentId,
          },
        },
      });
    } catch (error) {
      console.error('Add student to course error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add student to course',
      });
    }
  }
);

/**
 * @route   DELETE /api/courses/:id/students/:studentId
 * @desc    Remove a student from a course (Creator only)
 * @access  Private (course_rep)
 */
router.delete(
  '/:id/students/:studentId',
  authenticate,
  authorize('course_rep'),
  async (req, res) => {
    try {
      const { id: courseId, studentId } = req.params;

      // Check if user is creator
      if (!(await Course.isCreator(courseId, req.user.id))) {
        return res.status(403).json({
          success: false,
          message: 'You can only remove students from courses you created',
        });
      }

      // Check if student is enrolled
      if (!(await Enrollment.isEnrolled(studentId, courseId))) {
        return res.status(404).json({
          success: false,
          message: 'Student is not enrolled in this course',
        });
      }

      // Remove enrollment
      await Enrollment.unenroll(studentId, courseId);

      // Get course and student for notification
      const course = await Course.findById(courseId);
      const student = await User.findById(studentId);

      // Send notification to student
      if (student) {
        await Notification.create({
          userId: studentId,
          title: 'Course Unenrollment',
          message: `You have been removed from ${course.courseName}`,
          type: 'announcement',
          courseId: courseId,
        });
      }

      res.json({
        success: true,
        message: 'Student removed from course successfully',
      });
    } catch (error) {
      console.error('Remove student from course error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to remove student from course',
      });
    }
  }
);

module.exports = router;
