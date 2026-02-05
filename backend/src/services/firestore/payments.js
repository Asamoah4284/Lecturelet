/**
 * Firestore Payments Service
 * Payment records for Paystack (no MongoDB)
 */

const { firestore } = require('../../config/firebase');
const admin = require('firebase-admin');

const COLLECTION = 'payments';

/**
 * Create a payment record (use reference as document ID for easy lookup)
 * @param {Object} data - { userId, email, amount, currency, reference, accessCode, authorizationUrl, status, metadata }
 * @returns {Promise<Object>} Created payment with id = reference
 */
const create = async (data) => {
  const ref = data.reference;
  if (!ref) throw new Error('reference is required');
  const docRef = firestore.collection(COLLECTION).doc(ref);
  const doc = {
    userId: data.userId || null,
    email: data.email,
    amount: data.amount,
    currency: data.currency || 'GHS',
    reference: ref,
    accessCode: data.accessCode || null,
    authorizationUrl: data.authorizationUrl || null,
    status: data.status || 'pending',
    gatewayResponse: data.gatewayResponse || null,
    paidAt: data.paidAt || null,
    metadata: data.metadata || {},
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await docRef.set(doc);
  return { id: ref, ...doc };
};

/**
 * Get payment by reference
 * @param {string} reference - Paystack reference
 * @returns {Promise<Object|null>} Payment document or null
 */
const getByReference = async (reference) => {
  const docRef = firestore.collection(COLLECTION).doc(reference);
  const snap = await docRef.get();
  if (!snap.exists) return null;
  const d = snap.data();
  const paidAt = d.paidAt?.toDate?.() || d.paidAt;
  const createdAt = d.createdAt?.toDate?.() || d.createdAt;
  const updatedAt = d.updatedAt?.toDate?.() || d.updatedAt;
  return {
    id: snap.id,
    userId: d.userId,
    email: d.email,
    amount: d.amount,
    currency: d.currency,
    reference: d.reference,
    accessCode: d.accessCode,
    authorizationUrl: d.authorizationUrl,
    status: d.status,
    gatewayResponse: d.gatewayResponse,
    paidAt,
    metadata: d.metadata || {},
    createdAt,
    updatedAt,
  };
};

/**
 * Update a payment document
 * @param {string} reference - Payment reference (document ID)
 * @param {Object} updates - Fields to update (e.g. status, paidAt, gatewayResponse)
 * @returns {Promise<Object>} Updated payment
 */
const update = async (reference, updates) => {
  const docRef = firestore.collection(COLLECTION).doc(reference);
  const allowed = ['status', 'paidAt', 'gatewayResponse'];
  const safe = {};
  Object.keys(updates).forEach((k) => {
    if (allowed.includes(k)) safe[k] = updates[k];
  });
  safe.updatedAt = admin.firestore.FieldValue.serverTimestamp();
  await docRef.update(safe);
  return getByReference(reference);
};

module.exports = {
  create,
  getByReference,
  update,
};
