const express = require('express');
const { body } = require('express-validator');
const { User, College, Course, Enrollment, Notification } = require('../models');
const { authenticate, generateToken } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

/**
 * @route   POST /api/auth/login
 * @desc    Login user with phone number and password
 * @access  Public
 */
router.post(
  '/login',
  [
    body('phoneNumber')
      .trim()
      .notEmpty()
      .withMessage('Phone number is required'),
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const { phoneNumber, password } = req.body;

      // Find user by phone number
      const user = await User.findByPhoneNumber(phoneNumber);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid phone number or password',
        });
      }

      // Verify password
      const isPasswordValid = user.verifyPassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid phone number or password',
        });
      }

      // Generate token
      const token = generateToken(user._id);

      // Return user data (without password)
      res.json({
        success: true,
        message: 'Login successful',
        data: {
          token,
          user: user.toPublicJSON(),
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to login. Please try again.',
      });
    }
  }
);

/**
 * @route   POST /api/auth/signup
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  '/signup',
  [
    body('phoneNumber')
      .trim()
      .notEmpty()
      .withMessage('Phone number is required'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
    body('fullName')
      .trim()
      .notEmpty()
      .withMessage('Full name is required'),
    body('role')
      .isIn(['student', 'course_rep'])
      .withMessage('Role must be either student or course_rep'),
    body('studentId')
      .optional()
      .trim(),
    body('college')
      .optional()
      .trim(),
  ],
  validate,
  async (req, res) => {
    try {
      const { phoneNumber, password, fullName, role, studentId, college } = req.body;

      // Validate college if provided
      if (college) {
        const collegeExists = await College.findOne({ 
          name: college.trim(), 
          isActive: true 
        });
        if (!collegeExists) {
          return res.status(400).json({
            success: false,
            message: 'Invalid college selection',
          });
        }
      }

      // Check if phone number already exists
      const phoneExists = await User.phoneNumberExists(phoneNumber);
      if (phoneExists) {
        return res.status(409).json({
          success: false,
          message: 'Phone number already registered',
        });
      }

      // Create new user
      const user = new User({
        phoneNumber: phoneNumber.trim(),
        password,
        fullName: fullName.trim(),
        role,
        studentId: studentId ? studentId.trim() : null,
        college: college || null,
      });

      await user.save();

      // Generate token
      const token = generateToken(user._id);

      // Return user data (without password)
      res.status(201).json({
        success: true,
        message: 'Account created successfully',
        data: {
          token,
          user: user.toPublicJSON(),
        },
      });
    } catch (error) {
      console.error('Signup error:', error);
      
      // Handle duplicate key error (MongoDB)
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'Phone number already registered',
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to create account. Please try again.',
      });
    }
  }
);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authenticate, async (req, res) => {
  try {
    // req.user.id is the string ID from toPublicJSON()
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    
    res.json({
      success: true,
      data: {
        user: user.toPublicJSON(),
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
    });
  }
});

/**
 * @route   PUT /api/auth/profile
 * @desc    Update current user profile
 * @access  Private
 */
router.put(
  '/profile',
  authenticate,
  [
    body('notificationsEnabled').optional().isBoolean(),
    body('reminderMinutes').optional().isInt({ min: 0, max: 120 }),
  ],
  validate,
  async (req, res) => {
    try {
      // req.user.id is the string ID from toPublicJSON()
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      const { notificationsEnabled, reminderMinutes } = req.body;

      if (notificationsEnabled !== undefined) {
        user.notificationsEnabled = notificationsEnabled;
      }
      if (reminderMinutes !== undefined) {
        user.reminderMinutes = reminderMinutes;
      }

      await user.save();

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: user.toPublicJSON(),
        },
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update profile',
      });
    }
  }
);

/**
 * @route   GET /api/auth/colleges
 * @desc    Get list of available colleges from database
 * @access  Public
 */
router.get('/colleges', async (req, res) => {
  try {
    const colleges = await College.find({ isActive: true })
      .sort({ name: 1 })
      .select('name -_id');

    const collegeNames = colleges.map(college => college.name);

    res.json({
      success: true,
      data: {
        colleges: collegeNames,
      },
    });
  } catch (error) {
    console.error('Get colleges error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch colleges',
    });
  }
});

/**
 * @route   DELETE /api/auth/account
 * @desc    Delete current user account and all associated data
 * @access  Private
 */
router.delete('/account', authenticate, async (req, res) => {
  try {
    // req.user.id is the string ID from toPublicJSON()
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if user is a course_rep with created courses
    if (user.role === 'course_rep') {
      const coursesCreated = await Course.findByCreator(req.user.id);
      if (coursesCreated && coursesCreated.length > 0) {
        return res.status(403).json({
          success: false,
          message: 'Cannot delete account. Please delete or transfer ownership of your courses first.',
        });
      }
    }

    // Delete all enrollments for this user
    await Enrollment.deleteMany({ userId: req.user.id });

    // Delete all notifications for this user
    await Notification.deleteAllForUser(req.user.id);

    // Delete the user account
    await User.findByIdAndDelete(req.user.id);

    res.json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete account. Please try again.',
    });
  }
});

module.exports = router;
