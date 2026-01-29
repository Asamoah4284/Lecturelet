/**
 * Firestore Device Tokens Service
 * Handles device token management for FCM push notifications
 */

const { firestore } = require('../../config/firebase');
const admin = require('firebase-admin');

const DEVICE_TOKENS_COLLECTION = 'deviceTokens';

/**
 * Register or update a device token
 * @param {string} userId - User ID
 * @param {string} pushToken - FCM push token
 * @param {string} platform - 'ios' or 'android'
 * @param {Object} metadata - Optional metadata (deviceId, appVersion, expoVersion)
 * @returns {Promise<Object>} Registered/updated device token document
 */
const registerToken = async (userId, pushToken, platform, metadata = {}) => {
  // Check if token already exists
  const tokensRef = firestore.collection(DEVICE_TOKENS_COLLECTION);
  const existingSnapshot = await tokensRef
    .where('pushToken', '==', pushToken)
    .limit(1)
    .get();

  if (!existingSnapshot.empty) {
    // Update existing token
    const existingDoc = existingSnapshot.docs[0];
    const existingData = existingDoc.data();
    
    await existingDoc.ref.update({
      userId,
      platform,
      isActive: true,
      lastUsed: admin.firestore.FieldValue.serverTimestamp(),
      appVersion: metadata.appVersion || existingData.appVersion,
      deviceId: metadata.deviceId || existingData.deviceId,
      expoVersion: metadata.expoVersion || existingData.expoVersion,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Updated existing device token for user ${userId}, platform ${platform}`);
    return {
      id: existingDoc.id,
      ...existingDoc.data(),
      userId,
      platform,
    };
  }

  // Create new token
  const tokenRef = firestore.collection(DEVICE_TOKENS_COLLECTION).doc();
  const tokenDoc = {
    userId,
    pushToken,
    platform,
    deviceId: metadata.deviceId || null,
    appVersion: metadata.appVersion || null,
    expoVersion: metadata.expoVersion || null,
    isActive: true,
    lastUsed: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await tokenRef.set(tokenDoc);
  console.log(`Registered new device token for user ${userId}, platform ${platform}`);
  
  return {
    id: tokenRef.id,
    ...tokenDoc,
  };
};

/**
 * Get all active tokens for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of active device tokens
 */
const getActiveTokens = async (userId) => {
  const tokensRef = firestore.collection(DEVICE_TOKENS_COLLECTION);
  const snapshot = await tokensRef
    .where('userId', '==', userId)
    .where('isActive', '==', true)
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    pushToken: doc.data().pushToken,
    platform: doc.data().platform,
    lastUsed: doc.data().lastUsed,
  }));
};

/**
 * Deactivate a specific token
 * @param {string} pushToken - Token to deactivate
 * @returns {Promise<void>}
 */
const deactivateToken = async (pushToken) => {
  const tokensRef = firestore.collection(DEVICE_TOKENS_COLLECTION);
  const snapshot = await tokensRef
    .where('pushToken', '==', pushToken)
    .limit(1)
    .get();

  if (!snapshot.empty) {
    await snapshot.docs[0].ref.update({
      isActive: false,
      lastUsed: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`Deactivated device token: ${pushToken.substring(0, 20)}...`);
  }
};

/**
 * Deactivate all tokens for a user
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
const deactivateAllUserTokens = async (userId) => {
  const tokensRef = firestore.collection(DEVICE_TOKENS_COLLECTION);
  const snapshot = await tokensRef
    .where('userId', '==', userId)
    .where('isActive', '==', true)
    .get();

  const batch = firestore.batch();
  snapshot.docs.forEach(doc => {
    batch.update(doc.ref, {
      isActive: false,
      lastUsed: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  if (snapshot.docs.length > 0) {
    await batch.commit();
    console.log(`Deactivated ${snapshot.docs.length} device tokens for user ${userId}`);
  }
};

/**
 * Clean up old inactive tokens
 * @param {number} daysOld - Delete tokens inactive for this many days (default: 30)
 * @returns {Promise<number>} Number of deleted tokens
 */
const cleanupOldTokens = async (daysOld = 30) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffDate);

    const tokensRef = firestore.collection(DEVICE_TOKENS_COLLECTION);
    
    // Query only by updatedAt (single field - no index needed)
    // Then filter for isActive in memory
    const snapshot = await tokensRef
      .where('updatedAt', '<', cutoffTimestamp)
      .get();

    let deleteCount = 0;
    const batches = [];
    let currentBatch = firestore.batch();
    let batchSize = 0;

    snapshot.docs.forEach(doc => {
      const token = doc.data();
      // Filter in memory for inactive tokens
      if (token.isActive === false) {
        // Create new batch if current one is full (500 operations limit)
        if (batchSize >= 500) {
          batches.push(currentBatch);
          currentBatch = firestore.batch();
          batchSize = 0;
        }
        
        currentBatch.delete(doc.ref);
        batchSize++;
        deleteCount++;
      }
    });

    // Add the last batch if it has operations
    if (batchSize > 0) {
      batches.push(currentBatch);
    }

    // Commit all batches
    if (batches.length > 0) {
      await Promise.all(batches.map(batch => batch.commit()));
    }

    return deleteCount;
  } catch (error) {
    // If index error, log and return 0 (don't crash the server)
    if (error.code === 9 || error.message?.includes('index')) {
      console.warn('⚠️ Firestore index not created yet. Device token cleanup skipped. Create the index or it will be created automatically.');
      return 0;
    }
    throw error;
  }
};

/**
 * Update last used timestamp for a token
 * @param {string} pushToken - Token to update
 * @returns {Promise<void>}
 */
const updateLastUsed = async (pushToken) => {
  const tokensRef = firestore.collection(DEVICE_TOKENS_COLLECTION);
  const snapshot = await tokensRef
    .where('pushToken', '==', pushToken)
    .limit(1)
    .get();

  if (!snapshot.empty) {
    await snapshot.docs[0].ref.update({
      lastUsed: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
};

/**
 * Get device count for a user
 * @param {string} userId - User ID
 * @returns {Promise<number>} Number of active devices
 */
const getDeviceCount = async (userId) => {
  const tokensRef = firestore.collection(DEVICE_TOKENS_COLLECTION);
  const snapshot = await tokensRef
    .where('userId', '==', userId)
    .where('isActive', '==', true)
    .get();

  return snapshot.size;
};

/**
 * Get all devices for a user (for user-facing device management)
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of devices with metadata
 */
const getUserDevices = async (userId) => {
  const tokensRef = firestore.collection(DEVICE_TOKENS_COLLECTION);
  const snapshot = await tokensRef
    .where('userId', '==', userId)
    .where('isActive', '==', true)
    .orderBy('lastUsed', 'desc')
    .get();

  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      platform: data.platform,
      deviceId: data.deviceId,
      appVersion: data.appVersion,
      lastUsed: data.lastUsed?.toDate?.() || data.lastUsed,
      createdAt: data.createdAt?.toDate?.() || data.createdAt,
    };
  });
};

module.exports = {
  registerToken,
  getActiveTokens,
  deactivateToken,
  deactivateAllUserTokens,
  cleanupOldTokens,
  updateLastUsed,
  getDeviceCount,
  getUserDevices,
};
