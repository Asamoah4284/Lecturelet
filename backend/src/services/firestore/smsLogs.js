/**
 * Firestore SMS Logs Service
 * Handles SMS logging for audit trail
 */

const { firestore } = require('../../config/firebase');
const admin = require('firebase-admin');

const SMS_LOGS_COLLECTION = 'smsLogs';

/**
 * Log an SMS sent
 * @param {Object} logData - SMS log data
 * @returns {Promise<Object>} Created log document
 */
const logSms = async (logData) => {
  const { userId, phoneNumber, message, type, courseId } = logData;
  
  const logRef = firestore.collection(SMS_LOGS_COLLECTION).doc();
  const logDoc = {
    userId,
    phoneNumber,
    message,
    type: type || 'announcement',
    courseId: courseId || null,
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await logRef.set(logDoc);
  return {
    id: logRef.id,
    ...logDoc,
  };
};

/**
 * Get SMS logs for a user
 * @param {string} userId - User ID
 * @param {Object} options - Query options (limit)
 * @returns {Promise<Array>} Array of SMS log documents
 */
const getSmsLogsByUser = async (userId, options = {}) => {
  const { limit = 50 } = options;
  const logsRef = firestore.collection(SMS_LOGS_COLLECTION);
  const snapshot = await logsRef
    .where('userId', '==', userId)
    .orderBy('sentAt', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));
};

/**
 * Count SMS sent by user in a time period
 * @param {string} userId - User ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<number>} Count of SMS logs
 */
const countSmsByUser = async (userId, startDate, endDate) => {
  const logsRef = firestore.collection(SMS_LOGS_COLLECTION);
  const startTimestamp = admin.firestore.Timestamp.fromDate(startDate);
  const endTimestamp = admin.firestore.Timestamp.fromDate(endDate);
  
  const snapshot = await logsRef
    .where('userId', '==', userId)
    .where('sentAt', '>=', startTimestamp)
    .where('sentAt', '<=', endTimestamp)
    .get();

  return snapshot.size;
};

module.exports = {
  logSms,
  getSmsLogsByUser,
  countSmsByUser,
};
