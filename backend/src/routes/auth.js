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
    body('phoneNumber')
      .trim()
      .notEmpty()
      .withMessage('Phone number is required')
      .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/)
      .withMessage('Please provide a valid phone number'),
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
      const { phoneNumber, password, fullName, role, studentId } = req.body;

      // Trim phone number
      const trimmedPhoneNumber = phoneNumber?.trim();

      // Check if phone number already exists
      if (await User.phoneNumberExists(trimmedPhoneNumber)) {
        return res.status(409).json({
          success: false,
          message: 'Phone number already registered',
        });
      }

      // Create user
      const userData = {
        phoneNumber: trimmedPhoneNumber,
        password,
        fullName: fullName?.trim(),
        role: role || 'student',
      };
      
      // Only include studentId if provided
      if (studentId?.trim()) {
        userData.studentId = studentId.trim();
      }
      
      const user = await User.create(userData);

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
      
      // Handle duplicate key error (MongoDB unique constraint)
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        
        // If it's the old email index, provide a helpful message
        if (field === 'email') {
          console.error('Email index still exists in database. Please drop the email_1 index.');
          return res.status(500).json({
            success: false,
            message: 'Database configuration error. Please contact administrator.',
          });
        }
        
        const fieldName = field === 'phoneNumber' ? 'phone number' : field;
        return res.status(409).json({
          success: false,
          message: `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} already exists`,
        });
      }
      
      // Handle Mongoose validation errors
      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors,
        });
      }
      
      // Return more specific error message in development
      const errorMessage = process.env.NODE_ENV === 'development' 
        ? error.message 
        : 'Failed to create account';
      
      res.status(500).json({
        success: false,
        message: errorMessage,
        ...(process.env.NODE_ENV === 'development' && { error: error.stack }),
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

      // Find user by phone number (includes password)
      const user = await User.findByPhoneNumber(phoneNumber);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid phone number or password',
        });
      }

      // Verify password
      if (!user.verifyPassword(password)) {
        return res.status(401).json({
          success: false,
          message: 'Invalid phone number or password',
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

/**
 * @route   POST /api/auth/payment
 * @desc    Process payment and update user payment status
 * @access  Private
 */
router.post(
  '/payment',
  authenticate,
  async (req, res) => {
    try {
      // Update user payment status to paid
      const updatedUser = await User.findByIdAndUpdate(
        req.user.id,
        { paymentStatus: true },
        { new: true }
      ).select('-password');

      res.json({
        success: true,
        message: 'Payment processed successfully',
        data: {
          user: updatedUser.toPublicJSON(),
        },
      });
    } catch (error) {
      console.error('Payment processing error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process payment',
      });
    }
  }
);

module.exports = router;
