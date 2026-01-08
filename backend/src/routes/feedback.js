const express = require('express');
const { body } = require('express-validator');
const { Feedback } = require('../models');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

/**
 * @route   POST /api/feedback
 * @desc    Submit user feedback
 * @access  Private
 */
router.post(
  '/',
  authenticate,
  [
    body('message')
      .trim()
      .notEmpty()
      .withMessage('Feedback message is required')
      .isLength({ min: 10 })
      .withMessage('Feedback message must be at least 10 characters')
      .isLength({ max: 2000 })
      .withMessage('Feedback message must not exceed 2000 characters'),
  ],
  validate,
  async (req, res) => {
    try {
      const { message } = req.body;

      const feedback = new Feedback({
        userId: req.user.id,
        message: message.trim(),
      });

      await feedback.save();

      res.status(201).json({
        success: true,
        message: 'Thank you for your feedback! We appreciate your input.',
        data: {
          feedback: {
            id: feedback._id.toString(),
            message: feedback.message,
            status: feedback.status,
            created_at: feedback.createdAt,
          },
        },
      });
    } catch (error) {
      console.error('Submit feedback error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to submit feedback. Please try again.',
      });
    }
  }
);

/**
 * @route   GET /api/feedback/my-feedback
 * @desc    Get user's feedback history
 * @access  Private
 */
router.get('/my-feedback', authenticate, async (req, res) => {
  try {
    const feedbacks = await Feedback.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .select('message status createdAt updatedAt');

    res.json({
      success: true,
      data: {
        feedbacks: feedbacks.map(fb => ({
          id: fb._id.toString(),
          message: fb.message,
          status: fb.status,
          created_at: fb.createdAt,
          updated_at: fb.updatedAt,
        })),
      },
    });
  } catch (error) {
    console.error('Get feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feedback history',
    });
  }
});

module.exports = router;







