/**
 * Firestore Feedback Service
 * Handles feedback submissions (userId is Firebase UID string)
 */

const { firestore } = require('../../config/firebase');
const admin = require('firebase-admin');

const COLLECTION = 'feedback';

/**
 * Create a feedback document
 * @param {string} userId - Firebase Auth UID (string)
 * @param {Object} data - { message }
 * @returns {Promise<Object>} Created feedback document
 */
async function createFeedback(userId, data) {
  const ref = firestore.collection(COLLECTION).doc();
  const doc = {
    userId,
    message: (data.message || '').trim(),
    status: 'pending',
    adminNotes: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await ref.set(doc);
  return getFeedbackById(ref.id);
}

/**
 * Get feedback by document ID
 * @param {string} id - Document ID
 * @returns {Promise<Object|null>}
 */
async function getFeedbackById(id) {
  const ref = firestore.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data();
  return {
    id: snap.id,
    ...data,
    createdAt: data.createdAt?.toDate?.() || data.createdAt,
    updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
  };
}

/**
 * Get feedback documents for a user, sorted by createdAt desc
 * @param {string} userId - Firebase Auth UID
 * @returns {Promise<Array>}
 */
async function getFeedbackByUserId(userId) {
  const ref = firestore.collection(COLLECTION);
  const snapshot = await ref
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      message: data.message,
      status: data.status || 'pending',
      createdAt: data.createdAt?.toDate?.() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
    };
  });
}

module.exports = {
  createFeedback,
  getFeedbackById,
  getFeedbackByUserId,
};
