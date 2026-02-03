/**
 * Alerts API - TradingView-style alerts (create, list)
 */

const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  createAlert,
  getActiveAlertsByUser,
  getAlertById,
} = require('../services/firestore/alerts');

const router = express.Router();

/**
 * POST /api/alerts
 * Create an alert. Condition evaluated by Cloud Function (evaluateAlerts).
 */
router.post(
  '/',
  authenticate,
  [
    body('conditionType').optional().isIn(['value_above', 'value_below']),
    body('threshold').isNumeric().withMessage('Threshold must be a number'),
    body('symbol').optional().trim().isString(),
    body('title').optional().trim().isString(),
    body('body').optional().trim().isString(),
  ],
  validate,
  async (req, res) => {
    try {
      const { conditionType, threshold, symbol, title, body } = req.body;
      const alert = await createAlert(req.user.id, {
        conditionType: conditionType || 'value_above',
        threshold: Number(threshold),
        symbol: symbol || null,
        title: title || 'Alert',
        body: body || null,
      });
      return res.status(201).json({
        success: true,
        message: 'Alert created',
        alert: { id: alert.id, ...alert },
      });
    } catch (error) {
      console.error('Create alert error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create alert',
      });
    }
  }
);

/**
 * GET /api/alerts
 * List active (not yet triggered) alerts for the current user.
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const alerts = await getActiveAlertsByUser(req.user.id);
    return res.json({
      success: true,
      alerts: alerts.map((a) => ({
        id: a.id,
        conditionType: a.conditionType,
        threshold: a.threshold,
        symbol: a.symbol,
        title: a.title,
        body: a.body,
        createdAt: a.createdAt,
      })),
    });
  } catch (error) {
    console.error('List alerts error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to list alerts',
    });
  }
});

/**
 * GET /api/alerts/:id
 * Get a single alert by ID (must belong to user).
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const alert = await getAlertById(req.params.id);
    if (!alert || alert.userId !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }
    return res.json({
      success: true,
      alert: {
        id: alert.id,
        conditionType: alert.conditionType,
        threshold: alert.threshold,
        symbol: alert.symbol,
        title: alert.title,
        body: alert.body,
        triggeredAt: alert.triggeredAt,
        createdAt: alert.createdAt,
      },
    });
  } catch (error) {
    console.error('Get alert error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get alert',
    });
  }
});

module.exports = router;
