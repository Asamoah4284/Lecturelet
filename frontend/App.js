import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CourseProvider } from './context/CourseContext';
import AppNavigator from './navigation/AppNavigator';
import { 
  initializeNotifications, 
  setupNotificationListeners, 
  isPushNotification,
  requestNotificationPermissions,
  createNotificationChannel 
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
        
        // If it's a push notification about a course update, reschedule local reminders
        if (isPushNotification(notification)) {
          const data = notification.request?.content?.data || {};
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
    <CourseProvider>
      <AppNavigator />
      <StatusBar style="auto" />
    </CourseProvider>
  );
}






