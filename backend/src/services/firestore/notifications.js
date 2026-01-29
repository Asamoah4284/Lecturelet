/**
 * Firestore Notifications Service
 * Handles all notification-related Firestore operations
 */

const { firestore } = require('../../config/firebase');
const admin = require('firebase-admin');
const { getEnrollmentsForCourse } = require('./enrollments');
const { getUserById } = require('./users');

const NOTIFICATIONS_COLLECTION = 'notifications';

/**
 * Create a notification
 * @param {Object} notificationData - Notification data
 * @returns {Promise<Object>} Created notification document
 */
const createNotification = async (notificationData) => {
  const notificationRef = firestore.collection(NOTIFICATIONS_COLLECTION).doc();
  const notificationDoc = {
    ...notificationData,
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await notificationRef.set(notificationDoc);
  return getNotificationById(notificationRef.id);
};

/**
 * Create multiple notifications (batch)
 * @param {Array<Object>} notificationsData - Array of notification data
 * @returns {Promise<Array>} Array of created notification documents
 */
const createNotifications = async (notificationsData) => {
  const batch = firestore.batch();
  const notificationRefs = [];

  notificationsData.forEach((data) => {
    const notificationRef = firestore.collection(NOTIFICATIONS_COLLECTION).doc();
    notificationRefs.push(notificationRef);
    batch.set(notificationRef, {
      ...data,
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  await batch.commit();

  // Fetch created notifications
  const notifications = await Promise.all(
    notificationRefs.map(ref => getNotificationById(ref.id))
  );

  return notifications.filter(n => n !== null);
};

/**
 * Get notification by ID
 * @param {string} notificationId - Notification ID
 * @returns {Promise<Object|null>} Notification document or null
 */
const getNotificationById = async (notificationId) => {
  const notificationRef = firestore.collection(NOTIFICATIONS_COLLECTION).doc(notificationId);
  const notificationDoc = await notificationRef.get();

  if (!notificationDoc.exists) {
    return null;
  }

  return {
    id: notificationDoc.id,
    ...notificationDoc.data(),
  };
};

/**
 * Get all notifications for a user
 * @param {string} userId - User ID
 * @param {Object} options - Query options (limit, unreadOnly)
 * @returns {Promise<Array>} Array of notification documents
 */
const getByUser = async (userId, options = {}) => {
  const { limit = 50, unreadOnly = false } = options;
  let query = firestore.collection(NOTIFICATIONS_COLLECTION)
    .where('userId', '==', userId);

  if (unreadOnly) {
    query = query.where('isRead', '==', false);
  }

  query = query.orderBy('createdAt', 'desc').limit(limit);

  const snapshot = await query.get();
  const notifications = snapshot.docs.map(doc => {
    const data = doc.data();
    
    // Populate course name if courseId exists
    return {
      id: doc.id,
      ...data,
      course_name: data.courseId ? null : undefined, // Will be populated if needed
    };
  });

  // Populate course names
  const notificationsWithCourses = await Promise.all(
    notifications.map(async (notif) => {
      if (notif.courseId) {
        const { getCourseById } = require('./courses');
        const course = await getCourseById(notif.courseId);
        return {
          ...notif,
          course_name: course?.courseName,
        };
      }
      return notif;
    })
  );

  return notificationsWithCourses;
};

/**
 * Mark notification as read
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID (for security)
 * @returns {Promise<void>}
 */
const markAsRead = async (notificationId, userId) => {
  const notificationRef = firestore.collection(NOTIFICATIONS_COLLECTION).doc(notificationId);
  const notification = await getNotificationById(notificationId);

  if (!notification || notification.userId !== userId) {
    throw new Error('Notification not found or access denied');
  }

  await notificationRef.update({
    isRead: true,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
};

/**
 * Mark all notifications as read for a user
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
const markAllAsRead = async (userId) => {
  const notificationsRef = firestore.collection(NOTIFICATIONS_COLLECTION);
  const snapshot = await notificationsRef
    .where('userId', '==', userId)
    .where('isRead', '==', false)
    .get();

  const batch = firestore.batch();
  snapshot.docs.forEach(doc => {
    batch.update(doc.ref, {
      isRead: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  if (snapshot.docs.length > 0) {
    await batch.commit();
  }
};

/**
 * Get unread count for a user
 * @param {string} userId - User ID
 * @returns {Promise<number>} Unread count
 */
const getUnreadCount = async (userId) => {
  const notificationsRef = firestore.collection(NOTIFICATIONS_COLLECTION);
  const snapshot = await notificationsRef
    .where('userId', '==', userId)
    .where('isRead', '==', false)
    .get();

  return snapshot.size;
};

/**
 * Delete notification
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID (for security)
 * @returns {Promise<void>}
 */
const deleteNotification = async (notificationId, userId) => {
  const notificationRef = firestore.collection(NOTIFICATIONS_COLLECTION).doc(notificationId);
  const notification = await getNotificationById(notificationId);

  if (!notification || notification.userId !== userId) {
    throw new Error('Notification not found or access denied');
  }

  await notificationRef.delete();
};

/**
 * Delete all notifications for a user
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
const deleteAllForUser = async (userId) => {
  const notificationsRef = firestore.collection(NOTIFICATIONS_COLLECTION);
  const snapshot = await notificationsRef
    .where('userId', '==', userId)
    .get();

  const batch = firestore.batch();
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });

  if (snapshot.docs.length > 0) {
    await batch.commit();
  }
};

/**
 * Delete all notifications for a course
 * @param {string} courseId - Course ID
 * @returns {Promise<void>}
 */
const deleteAllForCourse = async (courseId) => {
  const notificationsRef = firestore.collection(NOTIFICATIONS_COLLECTION);
  const snapshot = await notificationsRef
    .where('courseId', '==', courseId)
    .get();

  const batch = firestore.batch();
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });

  if (snapshot.docs.length > 0) {
    await batch.commit();
  }
};

/**
 * Create notifications for all students in a course
 * @param {string} courseId - Course ID
 * @param {Object} notificationData - Notification data (title, message, type, senderName)
 * @returns {Promise<number>} Number of notifications created
 */
const createForCourse = async (courseId, notificationData) => {
  const { title, message, type = 'course_update', senderName = null } = notificationData;
  const enrollments = await getEnrollmentsForCourse(courseId);

  const notifications = [];
  for (const enrollment of enrollments) {
    const student = enrollment.userId;
    const studentName = student?.fullName || 'Student';
    const personalizedMessage = `Hi ${studentName}, ${message}`;

    notifications.push({
      userId: student.id,
      title,
      message: personalizedMessage,
      type,
      courseId,
    });
  }

  if (notifications.length > 0) {
    await createNotifications(notifications);
  }

  return notifications.length;
};

/**
 * Transform notification document to JSON format (matches MongoDB schema output)
 * @param {Object} notificationDoc - Notification document from Firestore
 * @returns {Object} Notification JSON
 */
const toJSON = (notificationDoc) => {
  if (!notificationDoc) return null;

  return {
    id: notificationDoc.id,
    user_id: notificationDoc.userId,
    title: notificationDoc.title,
    message: notificationDoc.message,
    type: notificationDoc.type,
    course_id: notificationDoc.courseId,
    course_name: notificationDoc.course_name,
    is_read: notificationDoc.isRead,
    created_at: notificationDoc.createdAt?.toDate?.() || notificationDoc.createdAt,
  };
};

module.exports = {
  createNotification,
  createNotifications,
  getNotificationById,
  getByUser,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  deleteNotification,
  deleteAllForUser,
  deleteAllForCourse,
  createForCourse,
  toJSON,
};
