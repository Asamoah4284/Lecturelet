const express = require('express');
const { body, param } = require('express-validator');
const { Notification, Course, User } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

/**
 * @route   GET /api/notifications
 * @desc    Get all notifications for current user
 * @access  Private
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { limit, unreadOnly } = req.query;
    
    const notifications = await Notification.getByUser(req.user.id, {
      limit: limit ? parseInt(limit) : 50,
      unreadOnly: unreadOnly === 'true',
    });

    const unreadCount = await Notification.getUnreadCount(req.user.id);

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
        count: notifications.length,
      },
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
    });
  }
});

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get unread notification count
 * @access  Private
 */
router.get('/unread-count', authenticate, async (req, res) => {
  try {
    const count = await Notification.getUnreadCount(req.user.id);

    res.json({
      success: true,
      data: {
        count,
      },
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unread count',
    });
  }
});

/**
 * @route   POST /api/notifications/send
 * @desc    Send notification to all students in a course (Course Rep only)
 * @access  Private (course_rep)
 */
router.post(
  '/send',
  authenticate,
  authorize('course_rep'),
  [
    body('courseId')
      .notEmpty()
      .withMessage('Course ID is required'),
    body('title')
      .trim()
      .notEmpty()
      .withMessage('Title is required'),
    body('message')
      .trim()
      .notEmpty()
      .withMessage('Message is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const { courseId, title, message } = req.body;

      // Verify course belongs to user
      if (!(await Course.isCreator(courseId, req.user.id))) {
        return res.status(403).json({
          success: false,
          message: 'You can only send notifications for your own courses',
        });
      }

      const count = await Notification.createForCourse(courseId, {
        title,
        message,
        type: 'announcement',
      });

      res.status(201).json({
        success: true,
        message: `Notification sent to ${count} students`,
        data: {
          recipientCount: count,
        },
      });
    } catch (error) {
      console.error('Send notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send notification',
      });
    }
  }
);

/**
 * @route   PUT /api/notifications/:id/read
 * @desc    Mark a notification as read
 * @access  Private
 */
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    await Notification.markAsRead(req.params.id, req.user.id);

    res.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
    });
  }
});

/**
 * @route   PUT /api/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.put('/read-all', authenticate, async (req, res) => {
  try {
    await Notification.markAllAsRead(req.user.id);

    res.json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notifications as read',
    });
  }
});

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete a notification
 * @access  Private
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await Notification.deleteOne({ _id: req.params.id, userId: req.user.id });

    res.json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
    });
  }
});

/**
 * @route   DELETE /api/notifications
 * @desc    Delete all notifications for current user
 * @access  Private
 */
router.delete('/', authenticate, async (req, res) => {
  try {
    await Notification.deleteAllForUser(req.user.id);

    res.json({
      success: true,
      message: 'All notifications deleted',
    });
  } catch (error) {
    console.error('Delete all notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notifications',
    });
  }
});

/**
 * @route   POST /api/notifications/register-token
 * @desc    Register or update push notification token for current user
 * @access  Private
 */
router.post(
  '/register-token',
  authenticate,
  [
    body('pushToken')
      .trim()
      .notEmpty()
      .withMessage('Push token is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const { pushToken } = req.body;
      // req.user.id is the string ID from toPublicJSON()
      const user = await User.findById(req.user.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      await user.updatePushToken(pushToken);

      res.json({
        success: true,
        message: 'Push token registered successfully',
      });
    } catch (error) {
      console.error('Register push token error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to register push token',
      });
    }
  }
);

/**
 * @route   DELETE /api/notifications/token
 * @desc    Remove push notification token for current user
 * @access  Private
 */
router.delete('/token', authenticate, async (req, res) => {
  try {
    // req.user.id is the string ID from toPublicJSON()
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    await user.updatePushToken(null);

    res.json({
      success: true,
      message: 'Push token removed successfully',
    });
  } catch (error) {
    console.error('Remove push token error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove push token',
    });
  }
});

module.exports = router;
