const express = require('express');
const https = require('https');
const crypto = require('crypto');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { updateUser: updateFirestoreUser } = require('../services/firestore/users');
const paymentsFirestore = require('../services/firestore/payments');
const validate = require('../middleware/validate');

const router = express.Router();

// Fixed payment amount - SECURITY: This is the only source of truth for payment amount
// Frontend cannot manipulate this value
const FIXED_PAYMENT_AMOUNT = 25; // GHS 25
const PAYMENT_CURRENCY = 'GHS';

/**
 * @route   POST /api/payments/initialize-payment
 * @desc    Initialize Paystack payment
 * @access  Private
 */
router.post(
  '/initialize-payment',
  authenticate,
  [
    // Note: We don't validate amount from frontend - we use fixed backend amount for security
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    // Currency is also fixed, but we accept it for compatibility (will be ignored)
    body('currency')
      .optional()
      .isIn(['GHS', 'NGN', 'USD'])
      .withMessage('Invalid currency'),
  ],
  validate,
  async (req, res) => {
    try {
      const { email } = req.body;
      const userId = req.user.id;

      // SECURITY: Use fixed amount from backend - ignore any amount sent from frontend
      const amount = FIXED_PAYMENT_AMOUNT;
      const currency = PAYMENT_CURRENCY;

      console.log(`Initializing payment: Amount=${amount} ${currency} for user=${userId}, email=${email}`);

      // Validate Paystack secret key is configured
      if (!process.env.PAYSTACK_SECRET_KEY) {
        return res.status(500).json({
          success: false,
          error: 'Payment service is not configured. Please contact support.',
          message: 'PAYSTACK_SECRET_KEY is missing on the server.',
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

            // Create payment record in Firestore
            await paymentsFirestore.create({
              userId,
              email,
              amount,
              currency,
              reference,
              accessCode: response.data.access_code,
              authorizationUrl: response.data.authorization_url,
              status: 'pending',
              metadata: { userId, amount, currency, fixedAmount: true },
            });

            // Return Paystack response with reference
            // Note: We return the fixed amount so frontend can display it
            res.json({
              success: true,
              reference: reference,
              access_code: response.data.access_code,
              authorization_url: response.data.authorization_url,
              amount: amount, // Fixed amount from backend
              currency: currency, // Fixed currency from backend
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
 * Helper function to verify and process successful payment
 * This is used by both webhook and manual verification
 */
const processSuccessfulPayment = async (reference, userId = null) => {
  try {
    const payment = await paymentsFirestore.getByReference(reference);
    if (!payment) {
      console.error(`Payment record not found for reference: ${reference}`);
      return { success: false, error: 'Payment record not found' };
    }

    if (payment.status === 'success') {
      console.log(`Payment ${reference} already verified`);
      return { success: true, alreadyVerified: true, payment };
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

    return new Promise((resolve) => {
      const paystackReq = https.request(options, (paystackRes) => {
        let data = '';
        
        console.log(`Paystack API response status: ${paystackRes.statusCode} for reference ${reference}`);

        paystackRes.on('data', (chunk) => {
          data += chunk;
        });

        paystackRes.on('end', async () => {
          try {
            const response = JSON.parse(data);
            console.log(`Paystack verification response for ${reference}:`, {
              status: response.status,
              dataStatus: response.data?.status,
              message: response.message
            });

            if (response.status && response.data && response.data.status === 'success') {
              // Successful
              console.log(`Payment ${reference} verified as successful by Paystack`);
              
              // SECURITY: Verify the amount paid matches our expected fixed amount
              const paidAmount = response.data.amount / 100; // Convert from pesewas to GHS
              const expectedAmount = payment.amount;
              
              if (Math.abs(paidAmount - expectedAmount) > 0.01) {
                console.error(`Amount mismatch for payment ${reference}: Expected ${expectedAmount}, Paid ${paidAmount}`);
                resolve({
                  success: false,
                  error: 'Payment amount mismatch',
                  details: `Expected amount ${expectedAmount} ${payment.currency}, but received ${paidAmount} ${payment.currency}`,
                });
                return;
              }
              
              try {
                await paymentsFirestore.update(reference, {
                  status: 'success',
                  paidAt: new Date(),
                  gatewayResponse: JSON.stringify(response.data),
                });
                console.log(`Payment ${reference} status updated to 'success' in Firestore`);
              } catch (saveError) {
                console.error(`Error saving payment ${reference}:`, saveError);
                resolve({
                  success: false,
                  error: 'Failed to save payment status',
                  details: saveError.message,
                });
                return;
              }
              const updatedPayment = await paymentsFirestore.getByReference(reference);

              // Update user Access status in Firestore (userId is Firebase UID)
              const userIdToUpdate = userId || payment.userId;
              if (userIdToUpdate) {
                try {
                  await updateFirestoreUser(userIdToUpdate, { paymentStatus: true });
                  console.log(`Access status updated for user: ${userIdToUpdate}`);
                } catch (userError) {
                  console.error(`Error updating user Access status for ${userIdToUpdate}:`, userError);
                  // Don't fail the whole process if user update fails
                }
              }

              resolve({
                success: true,
                message: 'Payment verified and processed successfully',
                payment: updatedPayment,
              });
            } else {
              console.log(`Payment ${reference} verification returned:`, {
                status: response.status,
                dataStatus: response.data?.status,
                message: response.message
              });
              const newStatus = (response.data && response.data.status === 'failed') ? 'failed' : payment.status;
              await paymentsFirestore.update(reference, {
                status: newStatus,
                gatewayResponse: JSON.stringify(response),
              });

              resolve({
                success: false,
                error: 'Payment verification failed',
                details: response.message || response.data?.gateway_response || 'Payment was not successful',
              });
            }
          } catch (error) {
            console.error('Error processing Paystack verification response:', error);
            console.error('Response data:', data);
            resolve({
              success: false,
              error: 'Failed to verify payment',
              details: error.message,
            });
          }
        });
      });

      paystackReq.on('error', (error) => {
        console.error('Paystack API error:', error);
        resolve({
          success: false,
          error: 'Payment verification failed',
          details: error.message,
        });
      });

      paystackReq.end();
    });
  } catch (error) {
    console.error('Error in processSuccessfulPayment:', error);
    return {
      success: false,
      error: 'Failed to process payment',
      details: error.message,
    };
  }
};

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
    // Note: Amount is optional and ignored - we verify against the amount stored in the payment record
  ],
  validate,
  async (req, res) => {
    try {
      const { reference } = req.body; // Ignore amount from frontend for security
      const userId = req.user.id;

      // Validate Paystack secret key is configured
      if (!process.env.PAYSTACK_SECRET_KEY) {
        return res.status(500).json({
          success: false,
          error: 'Payment service is not configured. Please contact support.',
          message: 'PAYSTACK_SECRET_KEY is missing on the server.',
        });
      }

      const payment = await paymentsFirestore.getByReference(reference);
      if (!payment) {
        return res.status(404).json({
          success: false,
          error: 'Payment record not found',
        });
      }

      // Verify payment belongs to user (userId is string/Firebase UID)
      if (payment.userId && String(payment.userId) !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized access to payment record',
        });
      }

      // Use the shared payment processing function
      const result = await processSuccessfulPayment(reference, userId);

      if (result.success) {
        res.json({
          success: true,
          message: 'Payment verified successfully',
          data: {
            reference: reference,
            amount: result.payment.amount,
            currency: result.payment.currency,
            status: 'success',
            paidAt: result.payment.paidAt,
          },
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error || 'Payment verification failed',
          details: result.details,
        });
      }
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

/**
 * @route   POST /api/payments/webhook
 * @desc    Paystack webhook endpoint for automatic payment verification
 * @access  Public (Paystack calls this endpoint)
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // Verify webhook signature from Paystack
    // req.body is a Buffer when using express.raw()
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(req.body)
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      console.error('Invalid webhook signature');
      return res.status(400).json({ success: false, error: 'Invalid signature' });
    }

    // Parse the JSON body
    const event = JSON.parse(req.body.toString());

    // Handle successful payment event
    if (event.event === 'charge.success' || event.event === 'transaction.success') {
      const reference = event.data.reference;
      console.log(`Webhook received: payment success for reference ${reference}`);

      // Process payment automatically
      const result = await processSuccessfulPayment(reference);

      if (result.success) {
        console.log(`Payment ${reference} automatically verified via webhook`);
        return res.status(200).json({ success: true, message: 'Payment processed' });
      } else {
        console.error(`Failed to process payment ${reference}:`, result.error);
        return res.status(400).json({ success: false, error: result.error });
      }
    }

    // Acknowledge other events
    return res.status(200).json({ success: true, message: 'Event received' });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }
});

module.exports = router;


