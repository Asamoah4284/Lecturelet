const express = require('express');
const fetch = require('node-fetch');
const { body, param, validationResult } = require('express-validator');
const { Payment } = require('../models');
const { authenticate } = require('../middleware/auth');
const config = require('../config');

const router = express.Router();

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';
// Force NGN (Paystack test accounts often only support NGN)
const DEFAULT_CURRENCY = 'NGN';

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

router.post(
  '/initiate',
  authenticate,
  body('amount').isNumeric().withMessage('Amount is required'),
  body('email').optional().isEmail().withMessage('Invalid email'),
  validate,
  async (req, res) => {
    if (!PAYSTACK_SECRET_KEY) {
      return res.status(500).json({ success: false, message: 'Paystack secret key not configured' });
    }

    try {
      const { amount, email, metadata = {} } = req.body;
      const userEmail = email || req.user?.email;
      if (!userEmail) {
        return res.status(400).json({ success: false, message: 'Email is required for payment' });
      }

      const amountInKobo = Math.round(Number(amount) * 100);
      const initBody = {
        email: userEmail,
        amount: amountInKobo,
        // omit currency to avoid unsupported errors; Paystack defaults to NGN on test
        metadata: {
          userId: req.user?._id,
          name: req.user?.full_name || req.user?.fullName || req.user?.email,
          ...metadata,
        },
      };

      const initResponse = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(initBody),
      });

      const initData = await initResponse.json();
      if (!initResponse.ok || !initData?.data) {
        return res.status(400).json({
          success: false,
          message: initData?.message || 'Unable to initialize payment',
        });
      }

      const { authorization_url, reference, access_code } = initData.data;

      await Payment.create({
        userId: req.user?._id,
        email: userEmail,
        amount: Number(amount),
        currency: DEFAULT_CURRENCY,
        reference,
        accessCode: access_code,
        authorizationUrl: authorization_url,
        status: 'pending',
        metadata: initBody.metadata,
      });

      res.json({
        success: true,
        data: {
          authorizationUrl: authorization_url,
          reference,
          accessCode: access_code,
        },
      });
    } catch (error) {
      console.error('Paystack initiate error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error initializing payment',
      });
    }
  }
);

router.get(
  '/verify/:reference',
  authenticate,
  param('reference').notEmpty().withMessage('Reference is required'),
  validate,
  async (req, res) => {
    if (!PAYSTACK_SECRET_KEY) {
      return res.status(500).json({ success: false, message: 'Paystack secret key not configured' });
    }

    const { reference } = req.params;
    try {
      const verifyResponse = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      });
      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok || !verifyData?.data) {
        return res.status(400).json({
          success: false,
          message: verifyData?.message || 'Unable to verify payment',
        });
      }

      const status = verifyData.data.status;
      const gatewayResponse = verifyData.data.gateway_response;
      const paidAt = verifyData.data.paid_at ? new Date(verifyData.data.paid_at) : undefined;

      await Payment.findOneAndUpdate(
        { reference },
        {
          status: status === 'success' ? 'success' : status === 'failed' ? 'failed' : 'pending',
          gatewayResponse,
          paidAt,
        }
      );

      res.json({
        success: true,
        data: {
          status,
          gatewayResponse,
          paidAt,
          reference,
        },
      });
    } catch (error) {
      console.error('Paystack verify error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error verifying payment',
      });
    }
  }
);

module.exports = router;


