const express = require('express');
const https = require('https');
const { body } = require('express-validator');
const { Payment, User } = require('../models');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

/**
 * @route   POST /api/payments/initialize-payment
 * @desc    Initialize Paystack payment
 * @access  Private
 */
router.post(
  '/initialize-payment',
  authenticate,
  [
    body('amount')
      .isFloat({ min: 0.01 })
      .withMessage('Amount must be a positive number'),
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('currency')
      .optional()
      .isIn(['GHS', 'NGN', 'USD'])
      .withMessage('Invalid currency'),
  ],
  validate,
  async (req, res) => {
    try {
      const { amount, email, currency = 'GHS' } = req.body;
      const userId = req.user.id;

      // Validate Paystack secret key is configured
      if (!process.env.PAYSTACK_SECRET_KEY) {
        return res.status(500).json({
          success: false,
          error: 'Payment service is not configured. Please contact support.',
        });
      }

      // Convert amount to pesewas (Paystack uses smallest currency unit)
      const amountInPesewas = Math.round(amount * 100);

      // Generate unique reference
      const reference = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Prepare Paystack API request
      const options = {
        hostname: 'api.paystack.co',
        port: 443,
        path: '/transaction/initialize',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      };

      const paystackReq = https.request(options, (paystackRes) => {
        let data = '';

        paystackRes.on('data', (chunk) => {
          data += chunk;
        });

        paystackRes.on('end', async () => {
          try {
            const response = JSON.parse(data);

            if (!response.status) {
              throw new Error(response.message || 'Payment initialization failed');
            }

            // Create payment record in database
            const payment = await Payment.create({
              userId: userId,
              email: email,
              amount: amount,
              currency: currency,
              reference: reference,
              accessCode: response.data.access_code,
              authorizationUrl: response.data.authorization_url,
              status: 'pending',
              metadata: {
                userId: userId,
                amount: amount,
                currency: currency,
              },
            });

            // Return Paystack response with reference
            res.json({
              success: true,
              reference: reference,
              access_code: response.data.access_code,
              authorization_url: response.data.authorization_url,
              amount: amount,
              currency: currency,
            });
          } catch (error) {
            console.error('Error processing Paystack response:', error);
            res.status(500).json({
              success: false,
              error: 'Failed to initialize payment',
              details: error.message,
            });
          }
        });
      });

      paystackReq.on('error', (error) => {
        console.error('Paystack API error:', error);
        res.status(500).json({
          success: false,
          error: 'Payment initialization failed',
          details: error.message,
        });
      });

      // Send payment data to Paystack
      const paymentData = JSON.stringify({
        email,
        amount: amountInPesewas,
        currency: currency,
        reference: reference,
        metadata: {
          userId: userId,
          amount: amount,
          currency: currency,
        },
      });

      paystackReq.write(paymentData);
      paystackReq.end();
    } catch (error) {
      console.error('Payment initialization error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to initialize payment',
        details: error.message,
      });
    }
  }
);

/**
 * @route   POST /api/payments/verify-payment
 * @desc    Verify Paystack payment
 * @access  Private
 */
router.post(
  '/verify-payment',
  authenticate,
  [
    body('reference')
      .trim()
      .notEmpty()
      .withMessage('Payment reference is required'),
    body('amount')
      .optional()
      .isFloat({ min: 0.01 })
      .withMessage('Amount must be a positive number'),
  ],
  validate,
  async (req, res) => {
    try {
      const { reference, amount } = req.body;
      const userId = req.user.id;

      // Validate Paystack secret key is configured
      if (!process.env.PAYSTACK_SECRET_KEY) {
        return res.status(500).json({
          success: false,
          error: 'Payment service is not configured. Please contact support.',
        });
      }

      // Find payment record
      const payment = await Payment.findOne({ reference });
      if (!payment) {
        return res.status(404).json({
          success: false,
          error: 'Payment record not found',
        });
      }

      // Verify payment belongs to user
      if (payment.userId && payment.userId.toString() !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized access to payment record',
        });
      }

      // Verify payment with Paystack
      const options = {
        hostname: 'api.paystack.co',
        port: 443,
        path: `/transaction/verify/${reference}`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      };

      const paystackReq = https.request(options, (paystackRes) => {
        let data = '';

        paystackRes.on('data', (chunk) => {
          data += chunk;
        });

        paystackRes.on('end', async () => {
          try {
            const response = JSON.parse(data);

            if (response.status && response.data.status === 'success') {
              // Payment successful
              payment.status = 'success';
              payment.paidAt = new Date();
              payment.gatewayResponse = JSON.stringify(response.data);
              await payment.save();

              // Update user payment status
              const user = await User.findById(userId);
              if (user) {
                user.paymentStatus = true;
                await user.save();
              }

              res.json({
                success: true,
                message: 'Payment verified successfully',
                data: {
                  reference: reference,
                  amount: payment.amount,
                  currency: payment.currency,
                  status: 'success',
                  paidAt: payment.paidAt,
                },
              });
            } else {
              // Payment failed or pending
              payment.status = 'failed';
              payment.gatewayResponse = JSON.stringify(response);
              await payment.save();

              res.status(400).json({
                success: false,
                error: 'Payment verification failed',
                details: response.message || 'Payment was not successful',
              });
            }
          } catch (error) {
            console.error('Error processing Paystack verification response:', error);
            res.status(500).json({
              success: false,
              error: 'Failed to verify payment',
              details: error.message,
            });
          }
        });
      });

      paystackReq.on('error', (error) => {
        console.error('Paystack API error:', error);
        res.status(500).json({
          success: false,
          error: 'Payment verification failed',
          details: error.message,
        });
      });

      paystackReq.end();
    } catch (error) {
      console.error('Payment verification error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to verify payment',
        details: error.message,
      });
    }
  }
);

module.exports = router;

