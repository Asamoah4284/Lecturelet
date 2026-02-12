/**
 * Firebase Cloud Messaging (FCM) Push Notification Service
 * Replaces Expo push notifications with FCM
 */

const { messaging } = require('../../config/firebase');
const { getActiveTokens } = require('../firestore/deviceTokens');
const { getUserById } = require('../firestore/users');
const { getChannelIdForSound, getSoundFilenameForPayload } = require('../firestore/alerts');

/** Returns true if token is an Expo push token (FCM cannot deliver to these). */
const isExpoPushToken = (token) =>
  typeof token === 'string' && (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['));

/**
 * Derive Android channelId from sound value.
 * Must match app's notification channels (MainApplication.kt / notificationService.js).
 * Accepts: 'r1', 'r1.wav', 'r2', 'r2.wav', 'r3', 'r3.wav', 'default', 'none', etc.
 * Returns: 'lecturelet_r1_channel', 'lecturelet_r2_channel', 'lecturelet_r3_channel', 'default_silent', or 'default'.
 */
const deriveChannelId = (sound) => {
  if (!sound || sound === 'default') return 'default';
  if (sound === 'none') return 'default_silent';
  const base = sound.replace(/\.wav$/i, '');
  if (base === 'r1') return 'lecturelet_r1_channel';
  if (base === 'r2') return 'lecturelet_r2_channel';
  if (base === 'r3') return 'lecturelet_r3_channel';
  return 'default';
};

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
          channelId: deriveChannelId(data.sound), // Use correct channel for custom sound
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

    console.log(`FCM sound: ${data.sound || 'default'}, channelId: ${deriveChannelId(data.sound)}`);
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
    
    // Build individual messages with correct channelId per user's sound preference
    const messages = batch.map(notif => {
      const soundVal = notif.data?.sound || 'default';
      return {
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
            sound: soundVal,
            channelId: deriveChannelId(soundVal), // Correct channel for custom sound
          },
        },
        apns: {
          payload: {
            aps: {
              sound: soundVal,
              badge: notif.data?.badge !== undefined ? notif.data.badge : 1,
            },
          },
        },
      };
    });

    try {
      // Use sendEach so each message uses its own sound/channel (per-user preference)
      const response = await messaging.sendEach(messages);

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

/**
 * Build FCM message with custom notification sound (Android channel + iOS sound).
 * Fallback to default sound if custom sound is invalid.
 * @param {string} token - FCM token
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Data payload (all values stringified)
 * @param {string} soundPreference - User preference: 'default' | 'r1' | 'r2' | 'r3' | 'none'
 * @returns {Object} FCM Message
 */
const buildAlertMessage = (token, title, body, data = {}, soundPreference = 'default') => {
  const soundFile = getSoundFilenameForPayload(soundPreference);
  const channelId = getChannelIdForSound(soundPreference);
  const androidSound = soundFile || 'default';
  const androidChannel = channelId || 'default';
  const apnsSound = soundFile === null ? undefined : (soundFile === 'default' ? 'default' : soundFile);

  const message = {
    token,
    notification: { title, body },
    data: {
      ...Object.keys(data).reduce((acc, key) => {
        acc[key] = String(data[key]);
        return acc;
      }, {}),
      type: data.type || 'alert',
    },
    android: {
      priority: 'high',
      notification: {
        sound: androidSound,
        channelId: androidChannel,
      },
    },
    apns: {
      payload: {
        aps: {
          sound: apnsSound !== undefined ? apnsSound : 'default',
          badge: data.badge !== undefined ? Number(data.badge) : 1,
          'content-available': 0,
        },
      },
      fcmOptions: {},
    },
  };
  return message;
};

/**
 * Send alert push to a user: fetch user's selected sound from Firestore and send FCM with that sound.
 * Works when app is closed; respects Android channels and iOS sound.
 * @param {string} userId - Firestore user ID
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Data payload
 * @returns {Promise<Object>} { success, sent, failed, error? }
 */
const sendAlertToUser = async (userId, title, body, data = {}) => {
  const [user, deviceTokens] = await Promise.all([
    getUserById(userId),
    getActiveTokens(userId),
  ]);
  if (!user) {
    return { success: false, error: 'User not found', sent: 0 };
  }
  if (deviceTokens.length === 0) {
    return { success: false, error: 'No active device tokens', sent: 0 };
  }
  const soundPreference = (user.notificationSound && user.notificationSound.trim()) || 'default';
  const messages = deviceTokens.map((t) =>
    buildAlertMessage(t.pushToken, title, body, data, soundPreference)
  );
  const results = { sent: 0, failed: 0, tokensToRemove: [] };
  for (const msg of messages) {
    try {
      await messaging.send(msg);
      results.sent++;
    } catch (err) {
      results.failed++;
      const code = err.code || err.errorInfo?.code;
      if (['messaging/invalid-registration-token', 'messaging/registration-token-not-registered'].includes(code)) {
        results.tokensToRemove.push(msg.token);
      }
    }
  }
  return {
    success: results.failed === 0,
    sent: results.sent,
    failed: results.failed,
    tokensToRemove: results.tokensToRemove,
  };
};

module.exports = {
  sendPushNotification,
  sendBulkPushNotifications,
  sendToUser,
  buildAlertMessage,
  sendAlertToUser,
};
