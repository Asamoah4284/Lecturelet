const express = require('express');
const { body } = require('express-validator');
const { User } = require('../models');
const { authenticate, generateToken } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

/**
 * @route   POST /api/auth/signup
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  '/signup',
  [
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
    body('fullName')
      .trim()
      .notEmpty()
      .withMessage('Full name is required'),
    body('role')
      .optional()
      .isIn(['student', 'course_rep'])
      .withMessage('Role must be either student or course_rep'),
  ],
  validate,
  async (req, res) => {
    try {
      const { email, password, fullName, role, studentId } = req.body;

      // Check if email already exists
      if (await User.emailExists(email)) {
        return res.status(409).json({
          success: false,
          message: 'Email already registered',
        });
      }

      // Create user
      const user = await User.create({
        email,
        password,
        fullName,
        role: role || 'student',
        studentId,
      });

      // Generate token
      const token = generateToken(user._id);

      res.status(201).json({
        success: true,
        message: 'Account created successfully',
        data: {
          user: user.toPublicJSON(),
          token,
        },
      });
    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create account',
      });
    }
  }
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user and return token
 * @access  Public
 */
router.post(
  '/login',
  [
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail(),
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      // Find user by email (includes password)
      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
      }

      // Verify password
      if (!user.verifyPassword(password)) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
      }

      // Generate token
      const token = generateToken(user._id);

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: user.toPublicJSON(),
          token,
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Login failed',
      });
    }
  }
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      user: req.user,
    },
  });
});

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put(
  '/profile',
  authenticate,
  [
    body('fullName').optional().trim().notEmpty().withMessage('Full name cannot be empty'),
    body('studentId').optional().trim(),
    body('role')
      .optional()
      .isIn(['student', 'course_rep'])
      .withMessage('Role must be either student or course_rep'),
    body('notificationsEnabled').optional().isBoolean(),
    body('reminderMinutes').optional().isInt({ min: 5, max: 60 }),
  ],
  validate,
  async (req, res) => {
    try {
      const { fullName, studentId, role, notificationsEnabled, reminderMinutes } = req.body;

      const updateData = {};
      if (fullName !== undefined) updateData.fullName = fullName;
      if (studentId !== undefined) updateData.studentId = studentId;
      if (role !== undefined) updateData.role = role;
      if (notificationsEnabled !== undefined) updateData.notificationsEnabled = notificationsEnabled;
      if (reminderMinutes !== undefined) updateData.reminderMinutes = reminderMinutes;

      const updatedUser = await User.findByIdAndUpdate(
        req.user.id,
        updateData,
        { new: true }
      ).select('-password');

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: updatedUser.toPublicJSON(),
        },
      });
    } catch (error) {
      console.error('Profile update error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update profile',
      });
    }
  }
);

/**
 * @route   PUT /api/auth/password
 * @desc    Update user password
 * @access  Private
 */
router.put(
  '/password',
  authenticate,
  [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('New password must be at least 6 characters'),
  ],
  validate,
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      // Get user with password
      const user = await User.findById(req.user.id);

      // Verify current password
      if (!user.verifyPassword(currentPassword)) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect',
        });
      }

      // Update password
      user.password = newPassword;
      await user.save();

      res.json({
        success: true,
        message: 'Password updated successfully',
      });
    } catch (error) {
      console.error('Password update error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update password',
      });
    }
  }
);

module.exports = router;
