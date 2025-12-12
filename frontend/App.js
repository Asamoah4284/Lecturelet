import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CourseProvider } from './context/CourseContext';
import AppNavigator from './navigation/AppNavigator';
import { initializeNotifications, setupNotificationListeners } from './services/notificationService';

export default function App() {
  useEffect(() => {
    // Initialize notifications on app launch
    const initNotifications = async () => {
      try {
        // Check if user is logged in
        const token = await AsyncStorage.getItem('@auth_token');
        if (token) {
          // User is logged in, initialize notifications
          await initializeNotifications();
        }
      } catch (error) {
        console.error('Error initializing notifications:', error);
      }
    };

    initNotifications();

    // Set up notification listeners
    const cleanup = setupNotificationListeners(
      (notification) => {
        console.log('Notification received:', notification);
      },
      (response) => {
        console.log('Notification tapped:', response);
        // You can navigate to a specific screen based on notification data
        // const { courseId, type } = response.notification.request.content.data;
      }
    );

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  return (
    <CourseProvider>
      <AppNavigator />
      <StatusBar style="auto" />
    </CourseProvider>
  );
}






