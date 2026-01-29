const fetch = require('node-fetch');
const { logSms } = require('../services/firestore/smsLogs');

const MOOLRE_API_URL = 'https://api.moolre.com/open/sms/send';
const WEEKLY_SMS_LIMIT = 5;

/**
 * Send SMS via Moolre API
 */
const sendSMS = async (phoneNumber, message, options = {}) => {
  try {
    // 💡 AUTO-CLEAN: Remove any hidden spaces or newlines from the key and sender ID
    const rawKey = process.env.MOOLRE_API_KEY || '';
    const apiKey = rawKey.replace(/[\s\n\r]/g, '').trim();

    const rawSender = process.env.MOOLRE_SENDER_ID || 'LectureLet';
    const senderId = rawSender.trim();

    if (!apiKey || apiKey.length < 50) {
      console.error('❌ MOOLRE_API_KEY is missing or too short in .env');
      return { success: false, message: 'SMS service not correctly configured' };
    }

    const formattedPhone = phoneNumber.replace(/[\s\-\(\)\+]/g, '');

    const payload = {
      type: 1,
      senderid: senderId,
      messages: [
        {
          recipient: formattedPhone,
          message: message
        }
      ]
    };

    console.log(`📡 Sending SMS to ${formattedPhone}...`);

    const response = await fetch(MOOLRE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-VASKEY': apiKey  // Header used in your successful Postman test
      },
      body: JSON.stringify(payload)
    });

    const responseData = await response.json();
    console.log('📬 Moolre Response:', JSON.stringify(responseData));

    // Moolre uses status: 1 for success
    if (responseData.status === 1 || responseData.code === 'SMS01' || responseData.message === 'Success') {
      if (options.userId) {
        await logSms({
          userId: options.userId,
          phoneNumber: formattedPhone,
          message,
          type: options.type || 'announcement',
          courseId: options.courseId || null
        });
      }
      return { success: true, message: 'SMS sent successfully', data: responseData };
    } else {
      // API returned status 0 or error code
      throw new Error(responseData.message || responseData.code || 'Authentication Error');
    }

  } catch (error) {
    console.error('❌ SMS sending failed:', error.message);
    return { success: false, message: error.message };
  }
};

const sendBulkSMS = async (recipients) => {
  const results = await Promise.allSettled(
    recipients.map(r => sendSMS(r.phoneNumber, r.message, { userId: r.userId, type: r.type, courseId: r.courseId }))
  );
  const sent = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
  return { sent, total: recipients.length };
};

module.exports = { sendSMS, sendBulkSMS };
