const fetch = require('node-fetch');
const { SmsLog } = require('../models');

// Moolre SMS API configuration
const MOOLRE_API_URL = 'https://api.moolre.com/open/sms/send';
const MOOLRE_API_KEY = process.env.MOOLRE_API_KEY;
const MOOLRE_SENDER_ID = process.env.MOOLRE_SENDER_ID || 'LectureLet';

// Weekly SMS limit per student
const WEEKLY_SMS_LIMIT = 5;

/**
 * Format phone number for Moolre API (remove + sign, keep country code)
 * Handles formats: +233XXXXXXXXX, 233XXXXXXXXX, 0XXXXXXXXX
 * Converts to: 233XXXXXXXXX (country code format)
 */
const formatPhoneForMoolre = (phoneNumber) => {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    throw new Error('Valid phone number is required');
  }

  // Clean phone number (remove spaces, dashes, etc.)
  const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');
  
  // Remove + sign if present
  let formattedPhone = cleanPhone.startsWith('+') ? cleanPhone.substring(1) : cleanPhone;
  
  // Ensure phone number has country code
  if (formattedPhone.startsWith('0')) {
    // Replace leading 0 with 233 for Ghana (adjust country code as needed)
    formattedPhone = '233' + formattedPhone.substring(1);
  } else if (!formattedPhone.startsWith('233')) {
    // Add 233 if no country code (adjust country code as needed)
    formattedPhone = '233' + formattedPhone;
  }
  
  return formattedPhone;
};

/**
 * Send SMS via Moolre API
 * @param {string} phoneNumber - Recipient phone number
 * @param {string} message - SMS message content
 * @param {Object} options - Additional options
 * @param {ObjectId} options.userId - User ID for tracking and limit checking
 * @param {string} options.type - SMS type (announcement, course_update, assignment, quiz, tutorial)
 * @param {ObjectId} options.courseId - Course ID (optional)
 * @returns {Promise<Object>} - API response with success status
 */
const sendSMS = async (phoneNumber, message, options = {}) => {
  try {
    // Validate API key
    if (!MOOLRE_API_KEY) {
      console.warn('MOOLRE_API_KEY environment variable is not set. SMS will not be sent.');
      return {
        success: false,
        message: 'SMS service not configured',
        error: 'MOOLRE_API_KEY not set'
      };
    }

    // Check weekly SMS limit if userId is provided
    if (options.userId) {
      const hasExceeded = await SmsLog.hasExceededWeeklyLimit(options.userId, WEEKLY_SMS_LIMIT);
      if (hasExceeded) {
        console.log(`SMS limit exceeded for user ${options.userId}. Weekly limit: ${WEEKLY_SMS_LIMIT}`);
        return {
          success: false,
          message: `Weekly SMS limit of ${WEEKLY_SMS_LIMIT} messages exceeded`,
          error: 'WEEKLY_LIMIT_EXCEEDED',
          limitExceeded: true
        };
      }
    }

    // Format phone number for Moolre API
    const formattedPhone = formatPhoneForMoolre(phoneNumber);

    // Prepare API request payload according to Moolre API spec
    const payload = {
      type: 1,
      senderid: MOOLRE_SENDER_ID,
      messages: [
        {
          recipient: formattedPhone,
          message: message
        }
      ]
    };

    // Send SMS via Moolre API
    const response = await fetch(MOOLRE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-VASKEY': MOOLRE_API_KEY
      },
      body: JSON.stringify(payload)
    });

    // Parse response
    const responseData = await response.json();

    if (!response.ok) {
      throw new Error(`SMS API error: ${response.status} - ${responseData.message || 'Unknown error'}`);
    }

    // Check if SMS was sent successfully (Moolre API uses status: 1 for success)
    if (responseData.status !== 1) {
      throw new Error(`SMS sending failed: ${responseData.message || 'Unknown error'}`);
    }

    // Log SMS if userId is provided
    if (options.userId) {
      try {
        await SmsLog.logSms({
          userId: options.userId,
          phoneNumber: formattedPhone,
          message,
          type: options.type || 'announcement',
          courseId: options.courseId || null
        });
      } catch (logError) {
        // Don't fail SMS sending if logging fails, but log the error
        console.error('Failed to log SMS:', logError);
      }
    }

    return {
      success: true,
      message: 'SMS sent successfully',
      data: responseData
    };

  } catch (error) {
    console.error('SMS sending failed:', error.message);
    return {
      success: false,
      message: error.message,
      error: error
    };
  }
};

/**
 * Send SMS to multiple recipients
 * @param {Array<{phoneNumber: string, message: string, userId?: ObjectId, type?: string, courseId?: ObjectId}>} recipients - Array of recipient objects
 * @returns {Promise<Object>} - Result with success count and failures
 */
const sendBulkSMS = async (recipients) => {
  if (!MOOLRE_API_KEY) {
    console.warn('MOOLRE_API_KEY not configured. Skipping SMS sending.');
    return {
      sent: 0,
      failed: recipients.length,
      errors: recipients.map(() => 'SMS service not configured'),
      limitExceeded: 0
    };
  }

  const results = await Promise.allSettled(
    recipients.map(recipient => 
      sendSMS(
        recipient.phoneNumber, 
        recipient.message,
        {
          userId: recipient.userId,
          type: recipient.type || 'announcement',
          courseId: recipient.courseId
        }
      )
    )
  );

  const sent = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
  const limitExceeded = results.filter(r => r.status === 'fulfilled' && r.value.limitExceeded).length;
  const failed = results.length - sent - limitExceeded;
  const errors = results
    .map((r, i) => {
      if (r.status === 'rejected') return `Recipient ${i}: ${r.reason.message}`;
      if (!r.value.success && !r.value.limitExceeded) return `Recipient ${i}: ${r.value.message}`;
      if (r.value.limitExceeded) return `Recipient ${i}: Weekly SMS limit exceeded`;
      return null;
    })
    .filter(e => e !== null);

  return {
    sent,
    failed,
    limitExceeded,
    errors
  };
};

module.exports = {
  sendSMS,
  sendBulkSMS,
  formatPhoneForMoolre
};

