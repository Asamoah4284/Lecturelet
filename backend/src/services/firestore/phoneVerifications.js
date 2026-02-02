/**
 * Firestore Phone Verifications Service
 * Stores SMS verification codes for signup (code, expiry, verified state)
 */

const { firestore } = require('../../config/firebase');
const admin = require('firebase-admin');

const COLLECTION = 'phoneVerifications';

/** Normalize phone to digits-only for use as document ID */
function phoneToDocId(phone) {
  return (phone || '').replace(/\D/g, '');
}

/**
 * Create or overwrite verification record and set code + expiry
 * @param {string} phone - Normalized phone (e.g. 233241234567)
 * @param {string} code - 6-digit code
 * @param {Date} expiresAt - Expiry time
 * @returns {Promise<void>}
 */
async function createOrUpdate(phone, code, expiresAt) {
  const id = phoneToDocId(phone);
  if (!id) throw new Error('Invalid phone number');
  const ref = firestore.collection(COLLECTION).doc(id);
  await ref.set({
    phone: phone.trim(),
    code,
    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    verified: false,
    verifiedAt: null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Get verification record by phone
 * @param {string} phone - Phone number (will be normalized for lookup)
 * @returns {Promise<Object|null>} Document with id and data, or null
 */
async function getByPhone(phone) {
  const id = phoneToDocId(phone);
  if (!id) return null;
  const ref = firestore.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data(), verifiedAt: snap.data().verifiedAt?.toDate?.() || snap.data().verifiedAt };
}

/**
 * Mark phone as verified (after user entered correct code)
 * @param {string} phone - Phone number
 * @param {Date} verifiedAt - Time of verification
 * @returns {Promise<void>}
 */
async function markVerified(phone, verifiedAt) {
  const id = phoneToDocId(phone);
  if (!id) throw new Error('Invalid phone number');
  const ref = firestore.collection(COLLECTION).doc(id);
  await ref.update({
    verified: true,
    verifiedAt: admin.firestore.Timestamp.fromDate(verifiedAt),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

module.exports = {
  createOrUpdate,
  getByPhone,
  markVerified,
  phoneToDocId,
};
