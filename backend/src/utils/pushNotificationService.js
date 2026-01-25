const { Expo } = require('expo-server-sdk');

// Create a new Expo SDK client
const expo = new Expo();

/**
 * Send push notification to a single device
 * @param {string} pushToken - Expo push token
 * @param {string} title - Notification title
 * @param {string} body - Notification body/message
 * @param {Object} data - Additional data to include
 * @returns {Promise<Object>} Result object with success status
 */
const sendPushNotification = async (pushToken, title, body, data = {}) => {
  try {
    // Check that the token is a valid Expo push token
    if (!Expo.isExpoPushToken(pushToken)) {
      console.error(`Invalid Expo push token: ${pushToken}`);
      return {
        success: false,
        error: 'Invalid push token',
      };
    }

    // Construct the message
    // CRITICAL: These fields ensure notifications appear even when screen is off
    const message = {
      to: pushToken,
      sound: 'default', // Required for iOS to show notification when screen is off
      title: title, // Required - must be at root level, not just in data
      body: body, // Required - must be at root level, not just in data
      data: {
        ...data,
        type: data.type || 'lecture_reminder',
      },
      priority: 'high', // High priority ensures notification appears even when screen is off
      channelId: 'default', // Android notification channel
      // iOS-specific fields for proper notification display
      badge: data.badge !== undefined ? data.badge : 1, // Set badge count (iOS)
      subtitle: data.subtitle || undefined, // Optional subtitle for iOS
      categoryId: data.categoryId || 'default', // Category identifier for iOS
      // Android-specific fields for background notifications
      android: {
        priority: 'high', // High priority for Android
        channelId: 'default', // Use the default channel we created
        sound: 'default', // Sound for Android
      },
    };

    // Send the notification
    const chunks = expo.chunkPushNotifications([message]);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('Error sending push notification chunk:', error);
        return {
          success: false,
          error: error.message,
        };
      }
    }

    // Check for errors in tickets
    const errors = [];
    tickets.forEach((ticket, index) => {
      if (ticket.status === 'error') {
        errors.push({
          index,
          error: ticket.message || 'Unknown error',
        });
      }
    });

    if (errors.length > 0) {
      console.error('Push notification errors:', errors);
      return {
        success: false,
        errors,
      };
    }

    return {
      success: true,
      tickets,
    };
  } catch (error) {
    console.error('Error in sendPushNotification:', error);
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
  try {
    // Filter out invalid tokens
    const validNotifications = notifications.filter((notif) =>
      Expo.isExpoPushToken(notif.pushToken)
    );

    if (validNotifications.length === 0) {
      return {
        success: false,
        error: 'No valid push tokens provided',
      };
    }

    // Construct messages
    // CRITICAL: These fields ensure notifications appear even when screen is off
    const messages = validNotifications.map((notif) => ({
      to: notif.pushToken,
      sound: 'default', // Required for iOS to show notification when screen is off
      title: notif.title, // Required - must be at root level
      body: notif.body, // Required - must be at root level
      data: {
        ...notif.data,
        type: notif.data?.type || 'lecture_reminder',
      },
      priority: 'high', // High priority ensures notification appears even when screen is off
      channelId: 'default', // Android notification channel
      // iOS-specific fields for proper notification display
      badge: notif.data?.badge !== undefined ? notif.data.badge : 1,
      subtitle: notif.data?.subtitle || undefined,
      categoryId: notif.data?.categoryId || 'default',
      // Android-specific fields for background notifications
      android: {
        priority: 'high', // High priority for Android
        channelId: 'default', // Use the default channel we created
        sound: 'default', // Sound for Android
      },
    }));

    // Send notifications in chunks
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('Error sending push notification chunk:', error);
        return {
          success: false,
          error: error.message,
        };
      }
    }

    // Check for errors
    const errors = [];
    const successes = [];
    tickets.forEach((ticket, index) => {
      if (ticket.status === 'error') {
        errors.push({
          index,
          token: validNotifications[index].pushToken,
          error: ticket.message || 'Unknown error',
        });
      } else {
        successes.push({
          index,
          token: validNotifications[index].pushToken,
        });
      }
    });

    return {
      success: errors.length === 0,
      sent: successes.length,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('Error in sendBulkPushNotifications:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

module.exports = {
  sendPushNotification,
  sendBulkPushNotifications,
};

