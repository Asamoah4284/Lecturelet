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

/**
 * Create Android notification channel (required for Android 8.0+)
 * This must be called before any notifications can be displayed
 */
export const createNotificationChannel = async () => {
  if (Platform.OS === 'android') {
    try {
      // Check if channel already exists
      const channels = await Notifications.getNotificationChannelsAsync();
      const channelExists = channels.some(channel => channel.id === 'default');
      
      if (!channelExists) {
        // Create the default notification channel
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Lecture Reminders',
          description: 'Notifications for upcoming lectures and course updates',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#2563eb',
          sound: 'default',
          enableVibrate: true,
          showBadge: true,
        });
        console.log('Android notification channel created successfully');
      } else {
        console.log('Android notification channel already exists');
      }
    } catch (error) {
      console.error('Error creating Android notification channel:', error);
    }
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
      // Request permissions with all required options for iOS (alert, badge, sound)
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowAnnouncements: false,
        },
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
 * Get the Expo push token for this device
 * @returns {Promise<string|null>} Push token or null if unavailable
 */
export const getPushToken = async () => {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('Notification permissions not granted');
      return null;
    }

    // Try to get projectId from various sources (CRITICAL for production builds)
    let projectId = null;
    
    // Try EAS config first (production builds)
    if (Constants.easConfig?.projectId) {
      projectId = Constants.easConfig.projectId;
      console.log('Using projectId from Constants.easConfig:', projectId);
    }
    // Try app.json extra config (most common in production)
    else if (Constants.expoConfig?.extra?.eas?.projectId) {
      projectId = Constants.expoConfig.extra.eas.projectId;
      console.log('Using projectId from Constants.expoConfig.extra.eas:', projectId);
    }
    // Try direct extra config
    else if (Constants.expoConfig?.extra?.projectId) {
      projectId = Constants.expoConfig.extra.projectId;
      console.log('Using projectId from Constants.expoConfig.extra:', projectId);
    }
    // Try manifest (for Expo Go/development)
    else if (Constants.expoConfig?.projectId) {
      projectId = Constants.expoConfig.projectId;
      console.log('Using projectId from Constants.expoConfig:', projectId);
    }
    // Try manifest2 (for newer Expo versions)
    else if (Constants.manifest2?.extra?.eas?.projectId) {
      projectId = Constants.manifest2.extra.eas.projectId;
      console.log('Using projectId from Constants.manifest2:', projectId);
    }

    // Build token options - projectId is REQUIRED for production builds
    const tokenOptions = {};
    if (projectId) {
      tokenOptions.projectId = projectId;
    } else {
      console.warn(
        '⚠️ No projectId found! Push notifications may not work in production builds. ' +
        'Ensure your app.json has the projectId configured in extra.eas.projectId'
      );
    }

    console.log('Requesting Expo push token with options:', { projectId: tokenOptions.projectId || 'none' });
    const tokenData = await Notifications.getExpoPushTokenAsync(tokenOptions);

    if (tokenData?.data) {
      console.log('✅ Push token obtained successfully');
      return tokenData.data;
    } else {
      console.error('❌ Push token data is empty');
      return null;
    }
  } catch (error) {
    console.error('Error getting push token:', error);
    
    // If it's a projectId error, provide helpful message
    if (error.message && (error.message.includes('projectId') || error.message.includes('Project ID'))) {
      console.error(
        '❌ Push notifications require a projectId for production builds. ' +
        'Please ensure your app.json has the projectId configured in extra.eas.projectId. ' +
        'Current projectId from config:', Constants.expoConfig?.extra?.eas?.projectId || 'NOT FOUND'
      );
      return null;
    }
    
    // For other errors, try one more time with minimal options (may work in some cases)
    try {
      console.log('Attempting fallback method for push token...');
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId || undefined,
      });
      if (tokenData?.data) {
        console.log('✅ Push token obtained via fallback method');
        return tokenData.data;
      }
    } catch (retryError) {
      console.error('Fallback method also failed:', retryError);
    }
    
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

      const response = await fetch(getApiUrl('notifications/register-token'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ pushToken: token }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Store token locally to avoid re-registering unnecessarily
        await AsyncStorage.setItem('@push_token', token);
        console.log('Push token registered successfully');
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
export const initializeNotifications = async (forceRegister = false) => {
  try {
    console.log('🔔 Initializing notifications...');
    
    // Create Android notification channel first (critical for Android 8.0+)
    await createNotificationChannel();
    
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