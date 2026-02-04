import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AppState, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CourseProvider } from './context/CourseContext';
import { OfflineProvider } from './context/OfflineContext';
import OfflineBadge from './components/OfflineBadge';
import AppNavigator from './navigation/AppNavigator';
import {
  initializeNotifications,
  setupNotificationListeners,
  isPushNotification,
  requestNotificationPermissions,
  createNotificationChannel,
  displayRandomSoundNotification
} from './services/notificationService';
import { syncAndScheduleReminders, validateAndRescheduleReminders, handleCourseUpdate } from './services/localReminderService';

export default function App() {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // CRITICAL: Initialize notification handler and permissions IMMEDIATELY
    // This must happen before any conditional logic for production push notifications to work
    const initNotificationSystem = async () => {
      try {
        // Create Android notification channel first (required for Android 8.0+)
        await createNotificationChannel();

        // Request permissions early (even if user isn't logged in yet)
        // This ensures push tokens can be generated in production builds
        await requestNotificationPermissions();

        // Check if user is logged in
        const token = await AsyncStorage.getItem('@auth_token');
        if (token) {
          // User is logged in, register push token and sync reminders
          await initializeNotifications();

          // Sync and schedule local reminder notifications
          await syncAndScheduleReminders();

          // Validate existing notifications
          await validateAndRescheduleReminders();
        }
      } catch (error) {
        console.error('Error initializing notification system:', error);
      }
    };

    initNotificationSystem();

    // Set up notification listeners (must be set up immediately for production)
    const cleanup = setupNotificationListeners(
      async (notification) => {
        console.log('Notification received:', notification);

        // Handle Data-Only message manually to play random sound
        // Data-only messages (handled by expo-notifications in foreground/background) might have null title/body
        // or trigger this listener.
        const content = notification.request?.content || {};
        const data = content.data || {};

        // If it looks like a data message (title null/missing) OR we want to force random sound for specific types
        // The user said: "Use DATA-ONLY Firebase messages... Manually display the notification... Assign the randomly selected channelId"
        if ((!content.title && Object.keys(data).length > 0) || data.forceRandomSound) {
          console.log('Detected Data-Only message, triggering manual display with Random Sound');
          await displayRandomSoundNotification(
            data.title || 'New Notification',
            data.body || 'You have a new update',
            data
          );
          // We might want to stop here so we don't handle it twice if logic overlaps?
          // Assuming data messages don't trigger the default system alert if title is null.
        }

        // If it's a push notification about a course update, reschedule local reminders
        if (isPushNotification(notification)) {
          if (data.type === 'course_update' && data.courseId) {
            // Course was updated, reschedule reminders for that course
            await handleCourseUpdate(data.courseId);
          }
        }
      },
      (response) => {
        console.log('Notification tapped:', response);
        // You can navigate to a specific screen based on notification data
        // const { courseId, type } = response.notification.request.content.data;
      }
    );

    // Handle app state changes (foreground/background)
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground
        console.log('App has come to the foreground, syncing reminders...');
        try {
          const token = await AsyncStorage.getItem('@auth_token');
          if (token) {
            // Re-register push token when app comes to foreground (ensures it's up to date)
            await initializeNotifications(true);

            // Validate and reschedule if needed
            await validateAndRescheduleReminders();
            // Sync to get any course updates
            await syncAndScheduleReminders();
          }
        } catch (error) {
          console.error('Error syncing reminders on app resume:', error);
        }
      }

      appState.current = nextAppState;
    });

    return () => {
      if (cleanup) cleanup();
      subscription.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <OfflineProvider>
        <View style={{ flex: 1 }}>
          <OfflineBadge />
          <CourseProvider>
            <AppNavigator />
            <StatusBar style="auto" />
          </CourseProvider>
        </View>
      </OfflineProvider>
    </SafeAreaProvider>
  );
}






