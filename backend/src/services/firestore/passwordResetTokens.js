/**
 * Firestore Password Reset Tokens Service
 * Stores SMS reset codes for forgot-password flow
 */

const { firestore } = require('../../config/firebase');
const admin = require('firebase-admin');

const COLLECTION = 'passwordResetTokens';

function phoneToDocId(phone) {
  return (phone || '').replace(/\D/g, '');
}

/**
 * Create or overwrite reset token (code + expiry)
 * @param {string} phone - Normalized phone
 * @param {string} code - 6-digit code
 * @param {Date} expiresAt - Expiry time
 */
async function createOrUpdate(phone, code, expiresAt) {
  const id = phoneToDocId(phone);
  if (!id) throw new Error('Invalid phone number');
  const ref = firestore.collection(COLLECTION).doc(id);
  await ref.set({
    phone: phone.trim(),
    code,
    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Get reset token record by phone
 * @param {string} phone - Phone number
 * @returns {Promise<Object|null>}
 */
async function getByPhone(phone) {
  const id = phoneToDocId(phone);
  if (!id) return null;
  const ref = firestore.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data();
  return {
    id: snap.id,
    ...data,
    expiresAt: data.expiresAt?.toDate?.() || data.expiresAt,
  };
}

/**
 * Delete reset token after successful reset
 * @param {string} phone - Phone number
 */
async function deleteByPhone(phone) {
  const id = phoneToDocId(phone);
  if (!id) return;
  const ref = firestore.collection(COLLECTION).doc(id);
  await ref.delete();
}

module.exports = {
  createOrUpdate,
  getByPhone,
  deleteByPhone,
};
