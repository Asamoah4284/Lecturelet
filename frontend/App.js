import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { CourseProvider } from './context/CourseContext';
import AppNavigator from './navigation/AppNavigator';

export default function App() {
  return (
    <CourseProvider>
      <AppNavigator />
      <StatusBar style="auto" />
    </CourseProvider>
  );
}

