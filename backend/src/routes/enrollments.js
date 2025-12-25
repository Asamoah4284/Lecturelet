const express = require('express');
const { body, param } = require('express-validator');
const { Course, Enrollment, Notification, User } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

/**
 * @route   POST /api/enrollments/join
 * @desc    Join a course using unique code (Students only)
 * @access  Private (student)
 */
router.post(
  '/join',
  authenticate,
  authorize('student'),
  [
    body('uniqueCode')
      .trim()
      .isLength({ min: 5, max: 5 })
      .withMessage('Invalid course code format'),
  ],
  validate,
  async (req, res) => {
    try {
      const { uniqueCode } = req.body;

      // Find course by unique code
      const course = await Course.findByUniqueCode(uniqueCode);
      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'Course not found. Please check the code and try again.',
        });
      }

      // Check if already enrolled
      if (await Enrollment.isEnrolled(req.user.id, course._id)) {
        return res.status(409).json({
          success: false,
          message: 'You are already enrolled in this course',
        });
      }

      // Check access and handle trial (only for students)
      if (req.user.role === 'student') {
        const user = await User.findById(req.user.id);
        if (!user) {
          return res.status(404).json({
            success: false,
            message: 'User not found',
          });
        }

        // Check if user has active access (payment OR active trial)
        if (!user.hasActiveAccess()) {
          // Check if this is their first enrollment
          const existingEnrollments = await Enrollment.find({ userId: req.user.id });
          
          if (existingEnrollments.length === 0) {
            // First enrollment - start free trial
            await user.startTrial();
            // Reload user to get updated trial info
            await user.save();
            const updatedUser = await User.findById(req.user.id);
            
            // Create enrollment
            const enrollment = await Enrollment.enroll(req.user.id, course._id);

            // Send notification to course rep
            await Notification.create({
              userId: course.createdBy._id || course.createdBy,
              title: 'New Student Enrolled',
              message: `${req.user.full_name} has enrolled in ${course.courseName}`,
              type: 'announcement',
              courseId: course._id,
            });

            return res.status(201).json({
              success: true,
              message: `Successfully enrolled in ${course.courseName}. Your 7-day free trial has started!`,
              data: {
                course,
                enrollment,
                trial: {
                  started: true,
                  start_date: updatedUser.trialStartDate,
                  end_date: updatedUser.trialEndDate,
                  days_remaining: updatedUser.toPublicJSON().days_remaining,
                },
              },
            });
          } else {
            // Has enrollments but no active access - require payment
            return res.status(403).json({
              success: false,
              message: 'Your free trial has ended. Payment required to continue enrolling in courses.',
            });
          }
        }
      }

      // Create enrollment
      const enrollment = await Enrollment.enroll(req.user.id, course._id);

      // Send notification to course rep
      await Notification.create({
        userId: course.createdBy._id || course.createdBy,
        title: 'New Student Enrolled',
        message: `${req.user.full_name} has enrolled in ${course.courseName}`,
        type: 'announcement',
        courseId: course._id,
      });

      res.status(201).json({
        success: true,
        message: `Successfully enrolled in ${course.courseName}`,
        data: {
          course,
          enrollment,
        },
      });
    } catch (error) {
      console.error('Join course error:', error);
      if (error.message === 'Already enrolled in this course') {
        return res.status(409).json({
          success: false,
          message: error.message,
        });
      }
      res.status(500).json({
        success: false,
        message: 'Failed to join course',
      });
    }
  }
);

/**
 * @route   GET /api/enrollments/my-courses
 * @desc    Get courses enrolled by current student
 * @access  Private (student)
 */
router.get(
  '/my-courses',
  authenticate,
  authorize('student'),
  async (req, res) => {
    try {
      const courses = await Enrollment.getStudentCourses(req.user.id);

      // Get student count for each course
      const coursesWithCount = await Promise.all(
        courses.map(async (course) => {
          const studentCount = await Enrollment.getCount(course.id);
          return {
            ...course,
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
      console.error('Get enrolled courses error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch enrolled courses',
      });
    }
  }
);

/**
 * @route   DELETE /api/enrollments/:courseId
 * @desc    Unenroll from a course (Students only)
 * @access  Private (student)
 */
router.delete(
  '/:courseId',
  authenticate,
  authorize('student'),
  async (req, res) => {
    try {
      const { courseId } = req.params;

      // Check if enrolled
      if (!(await Enrollment.isEnrolled(req.user.id, courseId))) {
        return res.status(404).json({
          success: false,
          message: 'You are not enrolled in this course',
        });
      }

      // Get course name for message
      const course = await Course.findById(courseId);

      // Remove enrollment
      await Enrollment.unenroll(req.user.id, courseId);

      res.json({
        success: true,
        message: `Successfully unenrolled from ${course?.courseName || 'the course'}`,
      });
    } catch (error) {
      console.error('Unenroll error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to unenroll from course',
      });
    }
  }
);

/**
 * @route   GET /api/enrollments/check/:courseId
 * @desc    Check if current user is enrolled in a course
 * @access  Private
 */
router.get(
  '/check/:courseId',
  authenticate,
  async (req, res) => {
    try {
      const { courseId } = req.params;
      const isEnrolled = await Enrollment.isEnrolled(req.user.id, courseId);

      res.json({
        success: true,
        data: {
          isEnrolled,
        },
      });
    } catch (error) {
      console.error('Check enrollment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check enrollment status',
      });
    }
  }
);

module.exports = router;
