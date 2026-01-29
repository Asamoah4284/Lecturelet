/**
 * Firebase Cloud Messaging (FCM) Push Notification Service
 * Replaces Expo push notifications with FCM
 */

const { messaging } = require('../../config/firebase');
const { getActiveTokens } = require('../firestore/deviceTokens');

/** Returns true if token is an Expo push token (FCM cannot deliver to these). */
const isExpoPushToken = (token) =>
  typeof token === 'string' && (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['));

/**
 * Send push notification to a single device
 * @param {string} fcmToken - FCM token
 * @param {string} title - Notification title
 * @param {string} body - Notification body/message
 * @param {Object} data - Additional data to include
 * @returns {Promise<Object>} Result object with success status
 */
const sendPushNotification = async (fcmToken, title, body, data = {}) => {
  const token = typeof fcmToken === 'string' ? fcmToken.trim() : '';
  if (!token) {
    return { success: false, error: 'Empty token', shouldRemoveToken: true };
  }
  if (isExpoPushToken(token)) {
    console.warn('Rejecting Expo push token (use native FCM token):', token.substring(0, 25) + '...');
    return { success: false, error: 'Expo push token not supported; use native FCM token', shouldRemoveToken: true };
  }

  try {
    const message = {
      token,
      notification: {
        title,
        body,
      },
      data: {
        ...Object.keys(data).reduce((acc, key) => {
          acc[key] = String(data[key]);
          return acc;
        }, {}),
        type: data.type || 'lecture_reminder',
      },
      android: {
        priority: 'high',
        notification: {
          sound: data.sound || 'default',
          channelId: 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: data.sound || 'default',
            badge: data.badge !== undefined ? data.badge : 1,
          },
        },
      },
    };

    const response = await messaging.send(message);
    console.log('Successfully sent FCM message:', response);

    return {
      success: true,
      messageId: response,
    };
  } catch (error) {
    const code = error.code || error.errorInfo?.code;
    console.error('Error sending FCM notification:', code, error.message);

    // Deactivate token for any token-related error so we stop retrying
    const tokenErrorCodes = [
      'messaging/invalid-registration-token',
      'messaging/registration-token-not-registered',
      'messaging/invalid-argument',           // e.g. "not a valid FCM registration token"
      'messaging/mismatched-credential',      // SenderId mismatch (wrong Firebase project)
    ];
    if (tokenErrorCodes.includes(code)) {
      return {
        success: false,
        error: error.message,
        shouldRemoveToken: true,
      };
    }

    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Send push notifications to multiple devices
 * @param {Array<{pushToken: string, title: string, body: string, data?: Object}>} notifications - Array of notification objects
 * @returns {Promise<Object>} Result object with success status and details
 */
const sendBulkPushNotifications = async (notifications) => {
  if (!notifications || notifications.length === 0) {
    return {
      success: false,
      error: 'No notifications provided',
      sent: 0,
      failed: 0,
    };
  }

  const results = {
    sent: 0,
    failed: 0,
    errors: [],
    tokensToRemove: [],
  };

  // Send notifications in batches (FCM allows up to 500 per batch)
  const batchSize = 500;
  for (let i = 0; i < notifications.length; i += batchSize) {
    const batch = notifications.slice(i, i + batchSize);
    
    const messages = batch.map(notif => ({
      token: notif.pushToken,
      notification: {
        title: notif.title,
        body: notif.body,
      },
      data: {
        ...Object.keys(notif.data || {}).reduce((acc, key) => {
          acc[key] = String(notif.data[key]);
          return acc;
        }, {}),
        type: notif.data?.type || 'lecture_reminder',
      },
      android: {
        priority: 'high',
        notification: {
          sound: notif.data?.sound || 'default',
          channelId: 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: notif.data?.sound || 'default',
            badge: notif.data?.badge !== undefined ? notif.data.badge : 1,
          },
        },
      },
    }));

    try {
      // Use sendEachForMulticast (sendMulticast was deprecated in firebase-admin v11+)
      const multicastMessage = {
        tokens: messages.map(m => m.token),
        notification: {
          title: messages[0].notification.title,
          body: messages[0].notification.body,
        },
        data: messages[0].data,
        android: messages[0].android,
        apns: messages[0].apns,
      };
      const response = await messaging.sendEachForMulticast(multicastMessage);

      // Process results (same BatchResponse shape: responses array)
      response.responses.forEach((resp, idx) => {
        if (resp.success) {
          results.sent++;
        } else {
          results.failed++;
          results.errors.push({
            token: messages[idx].token,
            error: resp.error?.message || 'Unknown error',
          });

          // Mark invalid tokens for removal
          if (resp.error?.code === 'messaging/invalid-registration-token' ||
              resp.error?.code === 'messaging/registration-token-not-registered') {
            results.tokensToRemove.push(messages[idx].token);
          }
        }
      });
    } catch (error) {
      console.error('Error sending FCM batch:', error);
      results.failed += batch.length;
      results.errors.push({
        batch: i,
        error: error.message,
      });
    }
  }

  return {
    success: results.failed === 0,
    sent: results.sent,
    failed: results.failed,
    errors: results.errors.length > 0 ? results.errors : undefined,
    tokensToRemove: results.tokensToRemove,
  };
};

/**
 * Send push notifications to all devices for a user
 * @param {string} userId - User ID
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Additional data
 * @returns {Promise<Object>} Result object
 */
const sendToUser = async (userId, title, body, data = {}) => {
  const deviceTokens = await getActiveTokens(userId);
  
  if (deviceTokens.length === 0) {
    return {
      success: false,
      error: 'No active device tokens found',
      sent: 0,
    };
  }

  const notifications = deviceTokens.map(token => ({
    pushToken: token.pushToken,
    title,
    body,
    data,
  }));

  return sendBulkPushNotifications(notifications);
};

module.exports = {
  sendPushNotification,
  sendBulkPushNotifications,
  sendToUser,
};
