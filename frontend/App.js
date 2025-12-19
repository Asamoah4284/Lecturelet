import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CourseProvider } from './context/CourseContext';
import AppNavigator from './navigation/AppNavigator';
import { initializeNotifications, setupNotificationListeners, isPushNotification } from './services/notificationService';
import { syncAndScheduleReminders, validateAndRescheduleReminders, handleCourseUpdate } from './services/localReminderService';

export default function App() {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // Initialize notifications on app launch
    const initNotifications = async () => {
      try {
        // Check if user is logged in
        const token = await AsyncStorage.getItem('@auth_token');
        if (token) {
          // User is logged in, initialize notifications
          await initializeNotifications();
          
          // Sync and schedule local reminder notifications
          await syncAndScheduleReminders();
          
          // Validate existing notifications
          await validateAndRescheduleReminders();
        }
      } catch (error) {
        console.error('Error initializing notifications:', error);
      }
    };

    initNotifications();

    // Set up notification listeners
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






