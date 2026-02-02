/**
 * Send immediate in-app + FCM push notifications to all enrolled students in a course.
 * Use when a course rep creates/edits a quiz, tutorial, assignment, or announcement
 * so enrolled users get a pop-up like the class reminder.
 */

const { getEnrollmentsForCourse } = require('../services/firestore/enrollments');
const { getUserById, hasActiveAccess } = require('../services/firestore/users');
const { createNotifications } = require('../services/firestore/notifications');
const { getActiveTokens } = require('../services/firestore/deviceTokens');
const { sendBulkPushNotifications } = require('../services/fcm/pushNotificationService');

/**
 * Notify all enrolled users in a course (in-app + push).
 * @param {string} courseId - Course ID
 * @param {Object} options - { title, message, type, data, courseName }
 * @returns {Promise<{ inAppCount: number, pushCount: number }>}
 */
const notifyEnrolledUsers = async (courseId, options) => {
  const { title, message, type = 'announcement', data = {}, courseName = '' } = options;

  const notifications = [];
  const pushNotifications = [];
  const tokensByUser = {};

  const enrollments = await getEnrollmentsForCourse(courseId);
  if (!enrollments.length) {
    return { inAppCount: 0, pushCount: 0 };
  }

  for (const enrollment of enrollments) {
    const student = enrollment.userId;
    const studentId = student?.id || enrollment.userId;
    if (!studentId) continue;

    const fullUserDoc = await getUserById(studentId);
    if (!fullUserDoc) continue;

    const studentName = fullUserDoc.fullName || 'Student';
    const personalizedMessage = message.includes(studentName) ? message : `Hi ${studentName}, ${message}`;

    notifications.push({
      userId: studentId,
      title,
      message: personalizedMessage,
      type,
      courseId,
    });

    if (hasActiveAccess(fullUserDoc) && fullUserDoc.notificationsEnabled) {
      if (!tokensByUser[studentId]) {
        const tokens = await getActiveTokens(studentId);
        tokensByUser[studentId] = tokens.map((t) => ({ pushToken: t.pushToken, platform: t.platform }));
      }
      const userTokens = tokensByUser[studentId] || [];
      const soundFile =
        fullUserDoc.notificationSound && fullUserDoc.notificationSound !== 'default'
          ? `${fullUserDoc.notificationSound}.wav`
          : 'default';

      userTokens.forEach((device) => {
        pushNotifications.push({
          pushToken: device.pushToken,
          title,
          body: personalizedMessage,
          data: {
            type: type,
            courseId: String(courseId),
            courseName: courseName || '',
            sound: soundFile,
            ...Object.keys(data).reduce((acc, k) => {
              acc[k] = String(data[k]);
              return acc;
            }, {}),
          },
        });
      });
    }
  }

  if (notifications.length > 0) {
    await createNotifications(notifications);
  }

  if (pushNotifications.length > 0) {
    try {
      const result = await sendBulkPushNotifications(pushNotifications);
      console.log(
        `Enrolled users notified: ${pushNotifications.length} push (${result.sent || 0} ok, ${result.failed || 0} failed)`
      );
    } catch (err) {
      console.error('Error sending push to enrolled users:', err);
    }
  }

  return {
    inAppCount: notifications.length,
    pushCount: pushNotifications.length,
  };
};

module.exports = { notifyEnrolledUsers };
