/**
 * Firebase Configuration for Frontend
 * Initializes Firebase SDK for client-side operations
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Firebase configuration from google-services.json
const firebaseConfig = {
  apiKey: "AIzaSyCCV78jiUpr8B39D__U1Rs3CSmzO-su1eI",
  authDomain: "lecturelet-c03be.firebaseapp.com",
  projectId: "lecturelet-c03be",
  storageBucket: "lecturelet-c03be.firebasestorage.app",
  messagingSenderId: "201453130565",
  appId: Platform.OS === 'android' 
    ? "1:201453130565:android:d8b0b98a1b634ea865a42c"
    : undefined, // iOS app ID would go here if needed
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Initialize messaging (FCM) - only available in native builds
let messaging = null;
if (Platform.OS !== 'web') {
  try {
    messaging = getMessaging(app);
  } catch (error) {
    console.warn('Firebase Messaging not available:', error.message);
  }
}

/**
 * Get FCM token for push notifications
 * @returns {Promise<string|null>} FCM token or null if unavailable
 */
export const getFCMToken = async () => {
  if (!messaging) {
    console.warn('Firebase Messaging not initialized');
    return null;
  }

  try {
    // Request permission for notifications
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Notification permission not granted');
      return null;
    }

    // Get FCM token
    const token = await getToken(messaging, {
      vapidKey: process.env.EXPO_PUBLIC_FCM_VAPID_KEY || undefined,
    });

    if (token) {
      console.log('FCM token obtained:', token.substring(0, 20) + '...');
      return token;
    }

    return null;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
};

/**
 * Set up foreground message handler
 * @param {Function} callback - Callback function when message is received
 * @returns {Function} Unsubscribe function
 */
export const onForegroundMessage = (callback) => {
  if (!messaging) {
    return () => {};
  }

  return onMessage(messaging, callback);
};

export default app;
