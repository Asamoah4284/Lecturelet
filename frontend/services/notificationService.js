import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from '../config/api';

// Configure how notifications are handled when app is in foreground
// This is critical for iOS to show notifications as banners and on lock screen
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // For iOS, ensure all presentation options are enabled
    if (Platform.OS === 'ios') {
      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      };
    }
    // For Android, use default behavior
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    };
  },
});

import { NOTIFICATION_SOUND_FILES } from '../config/notificationSounds';

const ANDROID_CHANNEL_DEFAULT = 'default';
const ANDROID_CHANNEL_R1 = 'lecturelet_r1_channel';
const ANDROID_CHANNEL_R2 = 'lecturelet_r2_channel';
const ANDROID_CHANNEL_R3 = 'lecturelet_r3_channel';
const ANDROID_CHANNEL_SILENT = 'default_silent';

const CHANNEL_OPTIONS_SOUND = {
  name: 'Lecture Reminders',
  description: 'Notifications for upcoming lectures and course updates',
  importance: Notifications.AndroidImportance.MAX,
  vibrationPattern: [0, 250, 250, 250],
  lightColor: '#2563eb',
  sound: 'default',
  enableVibrate: true,
  showBadge: true,
  lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  bypassDnd: true,
};

/**
 * Get Android channel ID for a sound preference (so the notification actually plays sound)
 */
export const getChannelIdForSound = (soundPreference) => {
  if (Platform.OS !== 'android') return null;
  switch (soundPreference) {
    case 'r1': return ANDROID_CHANNEL_R1;
    case 'r2': return ANDROID_CHANNEL_R2;
    case 'r3': return ANDROID_CHANNEL_R3;
    case 'none': return ANDROID_CHANNEL_SILENT;
    case 'default':
    default: return ANDROID_CHANNEL_DEFAULT;
  }
};

/**
 * Create Android notification channels (required for Android 8.0+)
 * Sound only plays if the notification uses a channel that has sound configured.
 * @param {boolean} forceRecreate - If true, delete and recreate the default channel (fixes "shows but no sound")
 */
export const createNotificationChannel = async (forceRecreate = false) => {
  if (Platform.OS !== 'android') return;
  try {
    const channels = await Notifications.getNotificationChannelsAsync() || [];
    const channelIds = new Set(channels.map((c) => c.id));

    // When forceRecreate, delete default and custom channels so they are recreated with correct sound
    const toRecreate = [ANDROID_CHANNEL_DEFAULT, ANDROID_CHANNEL_R1, ANDROID_CHANNEL_R2, ANDROID_CHANNEL_R3];
    if (forceRecreate) {
      for (const id of toRecreate) {
        if (channelIds.has(id)) {
          try {
            await Notifications.deleteNotificationChannelAsync(id);
          } catch (e) {
            // Ignore if delete fails (e.g. API not available)
          }
          channelIds.delete(id);
        }
      }
    }

    if (!channelIds.has(ANDROID_CHANNEL_DEFAULT)) {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_DEFAULT, CHANNEL_OPTIONS_SOUND);
      console.log('Android notification channel (default) created');
    }

    const customSoundChannels = [
      { id: ANDROID_CHANNEL_R1, sound: 'r1.wav', name: 'LectureLet Alert 1' },
      { id: ANDROID_CHANNEL_R2, sound: 'r2.wav', name: 'LectureLet Alert 2' },
      { id: ANDROID_CHANNEL_R3, sound: 'r3.wav', name: 'LectureLet Alert 3' },
    ];
    for (const ch of customSoundChannels) {
      // Channels are created in Native code (MainApplication.kt) for reliability on startup.
      // We checks here just in case, but usually existing channels persist.
      if (!channelIds.has(ch.id)) {
        await Notifications.setNotificationChannelAsync(ch.id, {
          ...CHANNEL_OPTIONS_SOUND,
          name: ch.name,
          sound: ch.sound, // Base filename e.g. 'r1.wav'
        });
      }
    }

    if (!channelIds.has(ANDROID_CHANNEL_SILENT)) {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_SILENT, {
        name: 'Lecture Reminders (Silent)',
        description: 'Notifications without sound',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563eb',
        sound: null,
        enableVibrate: true,
        showBadge: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }
  } catch (error) {
    console.error('Error creating Android notification channel:', error);
  }
};

/**
 * Request notification permissions from the user
 * @returns {Promise<boolean>} True if permissions granted, false otherwise
 */
export const requestNotificationPermissions = async () => {
  try {
    // Create Android notification channel first (required for Android 8.0+)
    await createNotificationChannel();

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      // Request permissions with all required options
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowAnnouncements: false,
        },
        android: {}, // Requests POST_NOTIFICATIONS on Android 13+
      });
      finalStatus = status;
    }

    // For iOS, also verify that all permission types are granted
    if (Platform.OS === 'ios' && finalStatus === 'granted') {
      const permissions = await Notifications.getPermissionsAsync();
      // Check if all iOS-specific permissions are granted
      if (permissions.ios) {
        const iosPerms = permissions.ios;
        if (!iosPerms.allowAlert || !iosPerms.allowBadge || !iosPerms.allowSound) {
          console.warn('Some iOS notification permissions not fully granted:', iosPerms);
          // Request again with explicit options
          const retryResult = await Notifications.requestPermissionsAsync({
            ios: {
              allowAlert: true,
              allowBadge: true,
              allowSound: true,
              allowAnnouncements: false,
            },
          });
          return retryResult.status === 'granted';
        }
      }
    }

    return finalStatus === 'granted';
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
};

/**
 * Get the native device push token for this device (FCM/APNs)
 * @returns {Promise<string|null>} Push token or null if unavailable
 */
export const getPushToken = async () => {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('Notification permissions not granted');
      return null;
    }

    // Use native device push token (FCM / APNs), not Expo push tokens
    const tokenInfo = await Notifications.getDevicePushTokenAsync();
    const token = tokenInfo?.data || tokenInfo?.token || null;

    if (token) {
      console.log('✅ Device push token obtained successfully');
      return token;
    }

    console.error('❌ Device push token is empty');
    return null;
  } catch (error) {
    console.error('Error getting device push token:', error);
    return null;
  }
};

/**
 * Register push token with the backend
 * @param {string} token - Expo push token
 * @param {number} retries - Number of retry attempts (default: 3)
 * @returns {Promise<boolean>} True if registration successful
 */
export const registerPushToken = async (token, retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const authToken = await AsyncStorage.getItem('@auth_token');
      if (!authToken) {
        console.log('No auth token found, skipping push token registration');
        return false;
      }

      // ✅ NEW: Include platform and app metadata for multi-device tracking
      const payload = {
        pushToken: token,
        platform: Platform.OS,  // 'ios' or 'android'
        appVersion: Constants.expoConfig?.version || '1.0.0',
        expoVersion: Constants.expoConfig?.sdkVersion || 'unknown',
        // deviceId: Constants.deviceId,  // Optional - may not be available on all platforms
      };

      console.log(`Registering push token for platform ${Platform.OS}`);

      const response = await fetch(getApiUrl('notifications/register-token'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Store token locally to avoid unnecessary re-registration
        await AsyncStorage.setItem('@push_token', token);
        console.log('✅ Push token registered successfully:', data.data?.platform);
        return true;
      } else {
        console.error(`Failed to register push token (attempt ${attempt}/${retries}):`, data.message);
        // If it's the last attempt, return false
        if (attempt === retries) {
          return false;
        }
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    } catch (error) {
      console.error(`Error registering push token (attempt ${attempt}/${retries}):`, error);
      // If it's the last attempt, return false
      if (attempt === retries) {
        return false;
      }
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  return false;
};

/**
 * Remove push token from backend (e.g., on logout)
 * @returns {Promise<boolean>} True if removal successful
 */
export const removePushToken = async () => {
  try {
    const authToken = await AsyncStorage.getItem('@auth_token');
    if (!authToken) {
      return false;
    }

    const response = await fetch(getApiUrl('notifications/token'), {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    const data = await response.json();

    if (response.ok && data.success) {
      await AsyncStorage.removeItem('@push_token');
      console.log('Push token removed successfully');
      return true;
    } else {
      console.error('Failed to remove push token:', data.message);
      return false;
    }
  } catch (error) {
    console.error('Error removing push token:', error);
    return false;
  }
};

/**
 * Initialize notifications - request permissions and register token
 * Call this on app launch or after login
 * @param {boolean} forceRegister - Force registration even if token hasn't changed (useful for signup/login)
 * @returns {Promise<boolean>} True if initialization successful
 */
const NOTIFICATION_CHANNEL_SOUND_FIXED_KEY = '@notification_channel_sound_fixed';

export const initializeNotifications = async (forceRegister = false) => {
  try {
    console.log('🔔 Initializing notifications...');

    if (Platform.OS === 'android') {
      const soundFixApplied = await AsyncStorage.getItem(NOTIFICATION_CHANNEL_SOUND_FIXED_KEY);
      if (!soundFixApplied) {
        await createNotificationChannel(true);
        await AsyncStorage.setItem(NOTIFICATION_CHANNEL_SOUND_FIXED_KEY, '1');
      } else {
        await createNotificationChannel();
      }
    } else {
      await createNotificationChannel();
    }

    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('⚠️ Notification permissions not granted');
      return false;
    }

    const token = await getPushToken();
    if (!token) {
      console.error('❌ Failed to get push token - notifications will not work');
      return false;
    }

    console.log('✅ Push token obtained:', token.substring(0, 20) + '...');

    // Check if token has changed (unless forced to register)
    if (!forceRegister) {
      const storedToken = await AsyncStorage.getItem('@push_token');
      if (storedToken === token) {
        console.log('ℹ️ Push token unchanged, but verifying registration with backend...');
        // Still verify with backend even if token hasn't changed
        // This ensures the token is registered after app reinstall or backend issues
        const registered = await registerPushToken(token, 1); // Single attempt for verification
        return registered;
      }
    }

    console.log('📤 Registering push token with backend...');
    const registered = await registerPushToken(token, 3); // 3 retry attempts

    if (registered) {
      console.log('✅ Push token registered successfully with backend');
    } else {
      console.error('❌ Failed to register push token with backend after retries');
    }

    return registered;
  } catch (error) {
    console.error('❌ Error initializing notifications:', error);
    return false;
  }
};

/**
 * Set up notification listeners
 * @param {Function} onNotificationReceived - Callback when notification is received
 * @param {Function} onNotificationTapped - Callback when notification is tapped
 * @returns {Function} Cleanup function to remove listeners
 */
export const setupNotificationListeners = (onNotificationReceived, onNotificationTapped) => {
  // Listener for notifications received while app is in foreground
  const receivedListener = Notifications.addNotificationReceivedListener((notification) => {
    if (onNotificationReceived) {
      onNotificationReceived(notification);
    }
  });

  // Listener for when user taps on a notification
  const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
    if (onNotificationTapped) {
      onNotificationTapped(response);
    }
  });

  // Return cleanup function
  return () => {
    Notifications.removeNotificationSubscription(receivedListener);
    Notifications.removeNotificationSubscription(responseListener);
  };
};

/**
 * Get the last notification response (if app was opened from a notification)
 * @returns {Promise<Notifications.NotificationResponse|null>}
 */
export const getLastNotificationResponse = async () => {
  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    return response;
  } catch (error) {
    console.error('Error getting last notification response:', error);
    return null;
  }
};

/**
 * Check if a notification is a local reminder notification
 * @param {Object} notification - Notification object
 * @returns {boolean} True if it's a local reminder
 */
export const isLocalReminderNotification = (notification) => {
  const identifier = notification?.request?.identifier || notification?.identifier || '';
  const data = notification?.request?.content?.data || notification?.data || {};

  return identifier.startsWith('local_reminder_') ||
    (data.type === 'class_reminder' && data.source === 'local');
};

/**
 * Check if a notification is a push notification (real-time update)
 * @param {Object} notification - Notification object
 * @returns {boolean} True if it's a push notification
 */

export const isPushNotification = (notification) => {
  const data = notification?.request?.content?.data || notification?.data || {};
  const identifier = notification?.request?.identifier || notification?.identifier || '';

  // Push notifications have types like 'course_update', 'lecture_reminder' (from backend)
  // and don't have the local_reminder_ prefix
  return !identifier.startsWith('local_reminder_') &&
    (data.type === 'course_update' ||
      (data.type === 'lecture_reminder' && data.source !== 'local'));
};

/**
 * Get a random channel ID from r1, r2, r3
 * @returns {string} One of lecturelet_r1_channel, lecturelet_r2_channel, lecturelet_r3_channel
 */
export const getRandomChannelId = () => {
  if (Platform.OS !== 'android') return ANDROID_CHANNEL_DEFAULT;

  const channels = [ANDROID_CHANNEL_R1, ANDROID_CHANNEL_R2, ANDROID_CHANNEL_R3];
  const randomIndex = Math.floor(Math.random() * channels.length);
  return channels[randomIndex];
};

/**
 * Display a notification with a random sound (r1, r2, or r3)
 * Used for handling Data-Only messages
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Additional data
 */


// Fix the issue where channelId isn't passed in displayRandomSoundNotification
// We need to re-implement it to pass channelId correctly
export const displayRandomSoundNotification = async (title, body, data = {}) => {
  try {
    const channelId = getRandomChannelId();
    console.log(`🔊 Displaying notification with random sound channel: ${channelId}`);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: title || 'New Notification',
        body: body || '',
        data: { ...data, _display_channel: channelId },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        color: '#2563eb',
        channelId: channelId, // IMPORTANT: Assign to the random channel
      },
      trigger: null,
    });
  } catch (error) {
    console.error('Error displaying random sound notification:', error);
  }
};