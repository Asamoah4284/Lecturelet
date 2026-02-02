/**
 * Authentication Routes
 * Handles Firebase Authentication (email/password)
 * 
 * IMPORTANT: We maintain API compatibility by:
 * 1. Storing password hash in Firestore for server-side verification
 * 2. Creating Firebase Auth users with Admin SDK
 * 3. Returning custom tokens that clients exchange for ID tokens
 */

const express = require('express');
const { body } = require('express-validator');
const bcrypt = require('bcryptjs');
const { auth, admin } = require('../config/firebase');
const { 
  createUser, 
  getUserByPhoneNumber, 
  phoneNumberExists,
  updateUser,
  getUserById,
  deleteUser,
  startTrial,
  toPublicJSON,
} = require('../services/firestore/users');
const { initializeColleges, getActiveColleges, collegeExists } = require('../services/firestore/colleges');
const { getCoursesByCreator } = require('../services/firestore/courses');
const { deleteAllForUser } = require('../services/firestore/enrollments');
const { deleteAllForUser: deleteAllNotifications } = require('../services/firestore/notifications');
const { createOrUpdate: createPhoneVerification, getByPhone: getPhoneVerification, markVerified: markPhoneVerified } = require('../services/firestore/phoneVerifications');
const { createOrUpdate: createPasswordResetToken, getByPhone: getPasswordResetToken, deleteByPhone: deletePasswordResetToken } = require('../services/firestore/passwordResetTokens');
const { sendSMS } = require('../utils/smsService');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');

/** Normalize phone to digits only (for storage/lookup) */
function normalizePhoneDigits(phone) {
  return (phone || '').trim().replace(/\D/g, '');
}

const router = express.Router();

/** Verification valid for 10 minutes; signup must complete within 15 minutes of verify */
const CODE_EXPIRY_MINUTES = 10;
const VERIFIED_VALID_MINUTES = 15;

/**
 * @route   POST /api/auth/send-verification-code
 * @desc    Send SMS verification code to phone (for signup)
 * @access  Public
 */
router.post(
  '/send-verification-code',
  [
    body('phoneNumber')
      .trim()
      .notEmpty()
      .withMessage('Phone number is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const rawPhone = req.body.phoneNumber.trim();
      const normalizedPhone = rawPhone.replace(/[\s\-\(\)\+]/g, '').trim();
      const phoneDigits = normalizePhoneDigits(normalizedPhone);
      if (phoneDigits.length < 10) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid phone number',
        });
      }

      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

      await createPhoneVerification(normalizedPhone, code, expiresAt);

      const message = `Your LectureLet verification code is ${code}. Valid for ${CODE_EXPIRY_MINUTES} minutes.`;
      const smsResult = await sendSMS(normalizedPhone, message);

      if (!smsResult.success) {
        return res.status(503).json({
          success: false,
          message: 'Could not send SMS. Please check the number and try again.',
        });
      }

      res.json({
        success: true,
        message: 'Verification code sent',
      });
    } catch (error) {
      console.error('Send verification code error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send verification code. Please try again.',
      });
    }
  }
);

/**
 * @route   POST /api/auth/verify-phone
 * @desc    Verify phone with SMS code (must be done before signup)
 * @access  Public
 */
router.post(
  '/verify-phone',
  [
    body('phoneNumber')
      .trim()
      .notEmpty()
      .withMessage('Phone number is required'),
    body('code')
      .trim()
      .notEmpty()
      .withMessage('Verification code is required')
      .isLength({ min: 6, max: 6 })
      .withMessage('Code must be 6 digits'),
  ],
  validate,
  async (req, res) => {
    try {
      const rawPhone = req.body.phoneNumber.trim();
      const normalizedPhone = rawPhone.replace(/[\s\-\(\)\+]/g, '').trim();
      const code = req.body.code.trim();

      const record = await getPhoneVerification(normalizedPhone);
      if (!record) {
        return res.status(400).json({
          success: false,
          message: 'No verification found for this number. Please request a new code.',
        });
      }

      const expiresAt = record.expiresAt?.toDate ? record.expiresAt.toDate() : record.expiresAt;
      if (expiresAt && new Date() > expiresAt) {
        return res.status(400).json({
          success: false,
          message: 'Verification code has expired. Please request a new code.',
        });
      }

      if (record.code !== code) {
        return res.status(400).json({
          success: false,
          message: 'Invalid verification code.',
        });
      }

      await markPhoneVerified(normalizedPhone, new Date());

      res.json({
        success: true,
        message: 'Phone number verified',
      });
    } catch (error) {
      console.error('Verify phone error:', error);
      res.status(500).json({
        success: false,
        message: 'Verification failed. Please try again.',
      });
    }
  }
);

/** Reset code valid for 15 minutes */
const RESET_CODE_EXPIRY_MINUTES = 15;

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Send SMS reset code to registered phone number
 * @access  Public
 */
router.post(
  '/forgot-password',
  [
    body('phoneNumber')
      .trim()
      .notEmpty()
      .withMessage('Phone number is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const rawPhone = req.body.phoneNumber.trim();
      const normalizedPhone = rawPhone.replace(/[\s\-\(\)\+]/g, '').trim();
      const phoneDigits = normalizePhoneDigits(normalizedPhone);
      if (phoneDigits.length < 10) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid phone number',
        });
      }

      const userDoc = await getUserByPhoneNumber(normalizedPhone);
      if (!userDoc) {
        return res.status(404).json({
          success: false,
          message: 'No account found with this phone number',
        });
      }

      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + RESET_CODE_EXPIRY_MINUTES * 60 * 1000);
      await createPasswordResetToken(normalizedPhone, code, expiresAt);

      const message = `Your LectureLet password reset code is ${code}. Valid for ${RESET_CODE_EXPIRY_MINUTES} minutes.`;
      const smsResult = await sendSMS(normalizedPhone, message);

      if (!smsResult.success) {
        return res.status(503).json({
          success: false,
          message: 'Could not send SMS. Please check the number and try again.',
        });
      }

      res.json({
        success: true,
        message: 'Reset code sent to your phone',
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send reset code. Please try again.',
      });
    }
  }
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password using SMS code
 * @access  Public
 */
router.post(
  '/reset-password',
  [
    body('phoneNumber')
      .trim()
      .notEmpty()
      .withMessage('Phone number is required'),
    body('code')
      .trim()
      .notEmpty()
      .withMessage('Reset code is required')
      .isLength({ min: 6, max: 6 })
      .withMessage('Code must be 6 digits'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
  ],
  validate,
  async (req, res) => {
    try {
      const rawPhone = req.body.phoneNumber.trim();
      const normalizedPhone = rawPhone.replace(/[\s\-\(\)\+]/g, '').trim();
      const { code, newPassword } = req.body;

      const record = await getPasswordResetToken(normalizedPhone);
      if (!record) {
        return res.status(400).json({
          success: false,
          message: 'No reset request found. Please request a new code.',
        });
      }

      const expiresAt = record.expiresAt?.toDate ? record.expiresAt.toDate() : record.expiresAt;
      if (expiresAt && new Date() > expiresAt) {
        return res.status(400).json({
          success: false,
          message: 'Reset code has expired. Please request a new code.',
        });
      }

      if (record.code !== code.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid reset code.',
        });
      }

      const userDoc = await getUserByPhoneNumber(normalizedPhone);
      if (!userDoc) {
        return res.status(404).json({
          success: false,
          message: 'Account not found.',
        });
      }

      const passwordHash = bcrypt.hashSync(newPassword, 10);
      const email = `${normalizedPhone}@lecturelet.app`;

      await updateUser(userDoc.id, { passwordHash });

      try {
        await auth.updateUser(userDoc.id, { password: newPassword });
      } catch (firebaseError) {
        console.error('Firebase updateUser error:', firebaseError);
        return res.status(500).json({
          success: false,
          message: 'Failed to update password. Please try again.',
        });
      }

      await deletePasswordResetToken(normalizedPhone);

      res.json({
        success: true,
        message: 'Password updated successfully. You can log in with your new password.',
      });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reset password. Please try again.',
      });
    }
  }
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user with phone number and password
 * @access  Public
 * 
 * Note: This endpoint verifies credentials and returns a custom token.
 * Client should exchange this for an ID token using Firebase SDK.
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
      const normalizedPhone = phoneNumber.trim();

      // Find user by phone number in Firestore
      const userDoc = await getUserByPhoneNumber(normalizedPhone);
      if (!userDoc) {
        return res.status(401).json({
          success: false,
          message: 'Invalid phone number or password',
        });
      }

      // Verify password hash stored in Firestore
      if (!userDoc.passwordHash) {
        return res.status(401).json({
          success: false,
          message: 'Invalid phone number or password',
        });
      }

      const isPasswordValid = bcrypt.compareSync(password, userDoc.passwordHash);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid phone number or password',
        });
      }

      // Firebase Auth uses email format: phone@lecturelet.app
      const email = `${normalizedPhone}@lecturelet.app`;

      try {
        // Verify user exists in Firebase Auth and get their UID
        let firebaseUser;
        try {
          firebaseUser = await auth.getUserByEmail(email);
        } catch (error) {
          if (error.code === 'auth/user-not-found') {
            return res.status(401).json({
              success: false,
              message: 'Invalid phone number or password',
            });
          }
          throw error;
        }

        // Create a custom token with role claim
        const customToken = await auth.createCustomToken(firebaseUser.uid, {
          role: userDoc.role,
        });

        // Return user data with custom token
        // Client should use Firebase SDK to sign in with custom token
        res.json({
          success: true,
          message: 'Login successful',
          data: {
            token: customToken, // Custom token - client exchanges for ID token
            user: toPublicJSON(userDoc),
          },
        });
      } catch (firebaseError) {
        console.error('Firebase Auth error:', firebaseError);
        return res.status(401).json({
          success: false,
          message: 'Invalid phone number or password',
        });
      }
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
 * @desc    Register a new user with Firebase Auth
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
    body('program')
      .optional()
      .trim(),
  ],
  validate,
  async (req, res) => {
    try {
      const { phoneNumber, password, fullName, role, studentId, college, program } = req.body;
      const normalizedPhone = phoneNumber.trim();
      // Will hold the created Firebase Auth user so we can clean it up on failure
      let firebaseUser = null;

      // Normalize college value
      let normalizedCollege = null;
      if (college && college.trim() && college.trim() !== 'None') {
        normalizedCollege = college.trim();

        // Validate college exists
        const exists = await collegeExists(normalizedCollege);
        if (!exists) {
          return res.status(400).json({
            success: false,
            message: 'Invalid college selection',
          });
        }
      }

      // Check if phone number already exists
      const phoneExists = await phoneNumberExists(normalizedPhone);
      if (phoneExists) {
        return res.status(409).json({
          success: false,
          message: 'Phone number already registered',
        });
      }

      // Require phone to be verified via SMS before signup
      const verification = await getPhoneVerification(normalizedPhone);
      const rawVerifiedAt = verification?.verifiedAt;
      const verifiedAt = rawVerifiedAt
        ? (typeof rawVerifiedAt.toDate === 'function' ? rawVerifiedAt.toDate() : rawVerifiedAt)
        : null;
      if (!verification || !verification.verified || !verifiedAt) {
        return res.status(400).json({
          success: false,
          message: 'Please verify your phone number with the SMS code first.',
        });
      }
      const verifiedAgeMinutes = (Date.now() - verifiedAt.getTime()) / (60 * 1000);
      if (verifiedAgeMinutes > VERIFIED_VALID_MINUTES) {
        return res.status(400).json({
          success: false,
          message: 'Phone verification expired. Please verify your number again.',
        });
      }

      // Hash password for storage in Firestore
      const passwordHash = bcrypt.hashSync(password, 10);

      // Create Firebase Auth user (using phone as email)
      const email = `${normalizedPhone}@lecturelet.app`;
      try {
        // Create user with Admin SDK
        firebaseUser = await auth.createUser({
          email,
          password, // Firebase Auth will hash this
          emailVerified: false,
          disabled: false,
        });
      } catch (firebaseError) {
        if (firebaseError.code === 'auth/email-already-exists') {
          return res.status(409).json({
            success: false,
            message: 'Phone number already registered',
          });
        }
        throw firebaseError;
      }

      // Create user document in Firestore (with password hash for server-side verification)
      const userRole = role === 'rep' ? 'course_rep' : role;
      const userDoc = await createUser(firebaseUser.uid, {
        phoneNumber: normalizedPhone,
        passwordHash, // Store hash for server-side verification
        fullName: fullName.trim(),
        role: userRole,
        studentId: studentId ? studentId.trim() : null,
        college: normalizedCollege,
        program: program ? program.trim() : null,
        notificationsEnabled: true,
        reminderMinutes: 15,
        notificationSound: 'default',
        paymentStatus: false,
        trialStartDate: null,
        trialEndDate: null,
      });

      // Set custom claims for role-based access
      await auth.setCustomUserClaims(firebaseUser.uid, {
        role: userRole,
      });

      // Create custom token (client will exchange for ID token)
      const customToken = await auth.createCustomToken(firebaseUser.uid, {
        role: userRole,
      });

      // Return user data (without password)
      res.status(201).json({
        success: true,
        message: 'Account created successfully',
        data: {
          token: customToken, // Custom token - client exchanges for ID token
          user: toPublicJSON(userDoc),
        },
      });
    } catch (error) {
      console.error('Signup error:', error);

      // Clean up Firebase Auth user if Firestore creation failed
      if (firebaseUser && firebaseUser.uid) {
        try {
          await auth.deleteUser(firebaseUser.uid);
        } catch (deleteError) {
          console.error('Error cleaning up Firebase user:', deleteError);
        }
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
    const userDoc = await getUserById(req.user.id);
    if (!userDoc) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      data: {
        user: toPublicJSON(userDoc),
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
    body('notificationSound').optional().isString(),
    body('role').optional().isIn(['student', 'course_rep']),
  ],
  validate,
  async (req, res) => {
    try {
      const userDoc = await getUserById(req.user.id);
      if (!userDoc) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      const { notificationsEnabled, reminderMinutes, notificationSound, role } = req.body;
      const updates = {};

      if (notificationsEnabled !== undefined) {
        updates.notificationsEnabled = notificationsEnabled;
      }
      if (reminderMinutes !== undefined) {
        updates.reminderMinutes = reminderMinutes;
      }
      if (notificationSound !== undefined) {
        updates.notificationSound = notificationSound;
      }
      if (role !== undefined) {
        const normalizedRole = role === 'rep' ? 'course_rep' : role;
        updates.role = normalizedRole;
        
        // Update custom claims
        await auth.setCustomUserClaims(req.user.id, {
          role: normalizedRole,
        });
      }

      const updatedUser = await updateUser(req.user.id, updates);

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: toPublicJSON(updatedUser),
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
 * @desc    Get list of available colleges
 * @access  Public
 */
router.get('/colleges', async (req, res) => {
  try {
    // Ensure colleges are initialized
    await initializeColleges();
    
    const colleges = await getActiveColleges();

    res.json({
      success: true,
      data: {
        colleges,
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
    const userDoc = await getUserById(req.user.id);
    if (!userDoc) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if user is a course_rep with created courses
    if (userDoc.role === 'course_rep') {
      const coursesCreated = await getCoursesByCreator(req.user.id);
      if (coursesCreated && coursesCreated.length > 0) {
        return res.status(403).json({
          success: false,
          message: 'Cannot delete account. Please delete or transfer ownership of your courses first.',
        });
      }
    }

    // Delete all enrollments for this user
    await deleteAllForUser(req.user.id);

    // Delete all notifications for this user
    await deleteAllNotifications(req.user.id);

    // Delete user document from Firestore
    await deleteUser(req.user.id);

    // Delete Firebase Auth user
    await auth.deleteUser(req.user.id);

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
