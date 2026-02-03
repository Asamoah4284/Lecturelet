/**
 * Firestore Alerts Service
 * TradingView-style alerts: condition-based, trigger once per condition.
 */

const { firestore } = require('../../config/firebase');
const admin = require('firebase-admin');

const ALERTS_COLLECTION = 'alerts';
const ALLOWED_SOUND_IDS = ['default', 'r1', 'r2', 'r3', 'none'];

/**
 * Get Android FCM channel ID for a sound preference (must match app's notification channels).
 * @param {string} soundId - 'default' | 'r1' | 'r2' | 'r3' | 'none'
 * @returns {string}
 */
function getChannelIdForSound(soundId) {
  if (!soundId || soundId === 'default') return 'default';
  if (soundId === 'none') return 'default_silent';
  if (['r1', 'r2', 'r3'].includes(soundId)) return `default_${soundId}`;
  return 'default';
}

/**
 * Get FCM sound filename for payload. Android: filename in res/raw; iOS: filename in bundle.
 * Use lowercase; fallback to 'default' if invalid.
 * @param {string} soundId - User preference: 'default' | 'r1' | 'r2' | 'r3' | 'none'
 * @returns {string} - 'default' | 'r1.wav' | 'r2.wav' | 'r3.wav' | null (silent)
 */
function getSoundFilenameForPayload(soundId) {
  if (!soundId || soundId === 'none') return null;
  if (soundId === 'default') return 'default';
  if (soundId === 'r1') return 'r1.wav';
  if (soundId === 'r2') return 'r2.wav';
  if (soundId === 'r3') return 'r3.wav';
  return 'default';
}

/**
 * Create an alert
 * @param {string} userId - Firestore user ID
 * @param {Object} params - { conditionType, threshold, symbol, title?, body? }
 * @returns {Promise<Object>}
 */
async function createAlert(userId, params) {
  const ref = firestore.collection(ALERTS_COLLECTION).doc();
  const now = admin.firestore.FieldValue.serverTimestamp();
  const doc = {
    userId,
    conditionType: params.conditionType || 'value_above',
    threshold: params.threshold,
    symbol: (params.symbol || '').toString().trim() || null,
    title: params.title || 'Alert',
    body: params.body || null,
    triggeredAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(doc);
  return { id: ref.id, ...doc };
}

/**
 * Get active (not yet triggered) alerts for a user
 * @param {string} userId
 * @returns {Promise<Array>}
 */
async function getActiveAlertsByUser(userId) {
  const snapshot = await firestore
    .collection(ALERTS_COLLECTION)
    .where('userId', '==', userId)
    .where('triggeredAt', '==', null)
    .get();
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Get all active alerts (for scheduled evaluator) — no user filter
 * @returns {Promise<Array>}
 */
async function getAllActiveAlerts() {
  const snapshot = await firestore
    .collection(ALERTS_COLLECTION)
    .where('triggeredAt', '==', null)
    .get();
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Mark alert as triggered (single-fire). Uses transaction to avoid double-send.
 * @param {string} alertId
 * @returns {Promise<boolean>} - true if was active and is now marked triggered; false if already triggered
 */
async function markAlertTriggered(alertId) {
  const ref = firestore.collection(ALERTS_COLLECTION).doc(alertId);
  return firestore.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists || doc.data().triggeredAt) return false;
    tx.update(ref, {
      triggeredAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return true;
  });
}

/**
 * Get alert by ID
 * @param {string} alertId
 * @returns {Promise<Object|null>}
 */
async function getAlertById(alertId) {
  const doc = await firestore.collection(ALERTS_COLLECTION).doc(alertId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

module.exports = {
  ALERTS_COLLECTION,
  ALLOWED_SOUND_IDS,
  getChannelIdForSound,
  getSoundFilenameForPayload,
  createAlert,
  getActiveAlertsByUser,
  getAllActiveAlerts,
  markAlertTriggered,
  getAlertById,
};
