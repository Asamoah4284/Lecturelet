import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from '../config/api';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Request notification permissions from the user
 * @returns {Promise<boolean>} True if permissions granted, false otherwise
 */
export const requestNotificationPermissions = async () => {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
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

    // Try to get projectId from various sources
    let projectId = null;
    
    // Try EAS config first (production)
    if (Constants.easConfig?.projectId) {
      projectId = Constants.easConfig.projectId;
    }
    // Try app.json extra config
    else if (Constants.expoConfig?.extra?.eas?.projectId) {
      projectId = Constants.expoConfig.extra.eas.projectId;
    }
    // Try direct extra config
    else if (Constants.expoConfig?.extra?.projectId) {
      projectId = Constants.expoConfig.extra.projectId;
    }
    // Try manifest (for Expo Go/development)
    else if (Constants.expoConfig?.projectId) {
      projectId = Constants.expoConfig.projectId;
    }

    // Build token options
    const tokenOptions = {};
    if (projectId) {
      tokenOptions.projectId = projectId;
    } else {
      // For development/Expo Go, try using experienceId as fallback
      const experienceId = Constants.expoConfig?.slug || Constants.manifest?.slug;
      if (experienceId) {
        // In Expo Go, we can use the experienceId
        // But for push tokens, we still need projectId for production
        console.log('No projectId found, attempting without it (may work in Expo Go)');
      }
    }

    const tokenData = await Notifications.getExpoPushTokenAsync(tokenOptions);

    return tokenData.data;
  } catch (error) {
    console.error('Error getting push token:', error);
    
    // If it's a projectId error and we're in development, provide helpful message
    if (error.message && error.message.includes('projectId')) {
      console.warn(
        'Push notifications require a projectId. ' +
        'For development with Expo Go, you may need to configure EAS. ' +
        'For production, ensure your app.json has the projectId configured.'
      );
      
      // In some cases, Expo Go might work without projectId
      // Try one more time with empty options
      try {
        console.log('Attempting fallback method...');
        const tokenData = await Notifications.getExpoPushTokenAsync({
          // Leave empty - may work in some Expo versions
        });
        return tokenData.data;
      } catch (retryError) {
        console.error('Fallback also failed:', retryError);
        return null;
      }
    }
    
    return null;
  }
};

/**
 * Register push token with the backend
 * @param {string} token - Expo push token
 * @returns {Promise<boolean>} True if registration successful
 */
export const registerPushToken = async (token) => {
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
      console.error('Failed to register push token:', data.message);
      return false;
    }
  } catch (error) {
    console.error('Error registering push token:', error);
    return false;
  }
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
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('Notification permissions not granted');
      return false;
    }

    const token = await getPushToken();
    if (!token) {
      console.log('Failed to get push token');
      return false;
    }

    // Check if token has changed (unless forced to register)
    if (!forceRegister) {
      const storedToken = await AsyncStorage.getItem('@push_token');
      if (storedToken === token) {
        console.log('Push token unchanged, skipping registration');
        return true;
      }
    }

    const registered = await registerPushToken(token);
    return registered;
  } catch (error) {
    console.error('Error initializing notifications:', error);
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

