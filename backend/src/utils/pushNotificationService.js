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
    const message = {
      to: pushToken,
      sound: 'default',
      title: title,
      body: body,
      data: {
        ...data,
        type: data.type || 'lecture_reminder',
      },
      priority: 'high',
      channelId: 'default',
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
    const messages = validNotifications.map((notif) => ({
      to: notif.pushToken,
      sound: 'default',
      title: notif.title,
      body: notif.body,
      data: {
        ...notif.data,
        type: notif.data?.type || 'lecture_reminder',
      },
      priority: 'high',
      channelId: 'default',
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

