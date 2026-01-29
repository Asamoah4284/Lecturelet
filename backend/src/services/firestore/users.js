/**
 * Firestore Users Service
 * Handles all user-related Firestore operations
 */

const { firestore } = require('../../config/firebase');
const admin = require('firebase-admin');

const USERS_COLLECTION = 'users';

/**
 * Create a user document in Firestore
 * @param {string} userId - Firebase Auth UID
 * @param {Object} userData - User data to store
 * @returns {Promise<Object>} Created user document
 */
const createUser = async (userId, userData) => {
  const userRef = firestore.collection(USERS_COLLECTION).doc(userId);
  
  const userDoc = {
    ...userData,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await userRef.set(userDoc);
  return getUserById(userId);
};

/**
 * Get user by ID
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} User document or null
 */
const getUserById = async (userId) => {
  const userRef = firestore.collection(USERS_COLLECTION).doc(userId);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    return null;
  }

  return {
    id: userDoc.id,
    ...userDoc.data(),
  };
};

/**
 * Get user by phone number
 * @param {string} phoneNumber - Phone number
 * @returns {Promise<Object|null>} User document or null
 */
const getUserByPhoneNumber = async (phoneNumber) => {
  const usersRef = firestore.collection(USERS_COLLECTION);
  const snapshot = await usersRef
    .where('phoneNumber', '==', phoneNumber.trim())
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const userDoc = snapshot.docs[0];
  return {
    id: userDoc.id,
    ...userDoc.data(),
  };
};

/**
 * Check if phone number exists
 * @param {string} phoneNumber - Phone number to check
 * @returns {Promise<boolean>} True if exists
 */
const phoneNumberExists = async (phoneNumber) => {
  const user = await getUserByPhoneNumber(phoneNumber);
  return !!user;
};

/**
 * Update user document
 * @param {string} userId - User ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated user document
 */
const updateUser = async (userId, updates) => {
  const userRef = firestore.collection(USERS_COLLECTION).doc(userId);
  
  await userRef.update({
    ...updates,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return getUserById(userId);
};

/**
 * Delete user document
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
const deleteUser = async (userId) => {
  const userRef = firestore.collection(USERS_COLLECTION).doc(userId);
  await userRef.delete();
};

/**
 * Transform user document to public JSON format (matches MongoDB schema output)
 * @param {Object} userDoc - User document from Firestore
 * @returns {Object} Public user JSON (excludes password hash)
 */
const toPublicJSON = (userDoc) => {
  if (!userDoc) return null;

  const now = new Date();
  const trialEndDate = userDoc.trialEndDate?.toDate?.() || userDoc.trialEndDate;
  const trialActive = trialEndDate && now < trialEndDate;
  let daysRemaining = null;

  if (trialActive && trialEndDate) {
    const diffTime = trialEndDate.getTime() - now.getTime();
    daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // Exclude passwordHash from public JSON
  const { passwordHash, ...publicData } = userDoc;

  return {
    id: userDoc.id || publicData.id,
    phone_number: userDoc.phoneNumber,
    full_name: userDoc.fullName,
    role: userDoc.role,
    student_id: userDoc.studentId,
    college: userDoc.college,
    notifications_enabled: userDoc.notificationsEnabled ?? true,
    reminder_minutes: userDoc.reminderMinutes ?? 15,
    notification_sound: userDoc.notificationSound || 'default',
    payment_status: userDoc.paymentStatus ?? false,
    trial_start_date: userDoc.trialStartDate?.toDate?.() || userDoc.trialStartDate,
    trial_end_date: trialEndDate,
    trial_active: trialActive,
    days_remaining: daysRemaining,
    created_at: userDoc.createdAt?.toDate?.() || userDoc.createdAt,
    updated_at: userDoc.updatedAt?.toDate?.() || userDoc.updatedAt,
  };
};

/**
 * Check if user has active access (payment OR active trial)
 * @param {Object} userDoc - User document
 * @returns {boolean} True if has active access
 */
const hasActiveAccess = (userDoc) => {
  if (userDoc.paymentStatus) return true;
  
  const trialEndDate = userDoc.trialEndDate?.toDate?.() || userDoc.trialEndDate;
  if (!trialEndDate) return false;
  
  return new Date() < trialEndDate;
};

/**
 * Start 7-day free trial for user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Updated user document
 */
const startTrial = async (userId) => {
  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + 7);

  return updateUser(userId, {
    trialStartDate: admin.firestore.Timestamp.fromDate(now),
    trialEndDate: admin.firestore.Timestamp.fromDate(trialEnd),
  });
};

/**
 * Update push token for user
 * @param {string} userId - User ID
 * @param {string} pushToken - Push token (can be null)
 * @returns {Promise<Object>} Updated user document
 */
const updatePushToken = async (userId, pushToken) => {
  return updateUser(userId, { pushToken: pushToken || null });
};

module.exports = {
  createUser,
  getUserById,
  getUserByPhoneNumber,
  phoneNumberExists,
  updateUser,
  deleteUser,
  toPublicJSON,
  hasActiveAccess,
  startTrial,
  updatePushToken,
};
