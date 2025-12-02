import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import WelcomeScreen from '../screens/WelcomeScreen';
import CourseListScreen from '../screens/CourseListScreen';
import AddCourseScreen from '../screens/AddCourseScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SignupScreen from '../screens/SignupScreen';
import LoginScreen from '../screens/LoginScreen';
import RoleSelectScreen from '../screens/RoleSelectScreen';
import CourseRepScreen from '../screens/CourseRepScreen';
import CoursesScreen from '../screens/CoursesScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import StudentAddCourseScreen from '../screens/StudentAddCourseScreen';
import StudentCoursesScreen from '../screens/StudentCoursesScreen';
import StudentHomeScreen from '../screens/StudentHomeScreen';

const Stack = createStackNavigator();

const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Welcome"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#6366f1',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen
          name="Welcome"
          component={WelcomeScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="CourseList"
          component={CourseListScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Signup"
          component={SignupScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="RoleSelect"
          component={RoleSelectScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="CourseRep"
          component={CourseRepScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Courses"
          component={CoursesScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AddCourse"
          component={AddCourseScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="StudentAddCourse"
          component={StudentAddCourseScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="StudentCourses"
          component={StudentCoursesScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="StudentHome"
          component={StudentHomeScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ title: 'Profile' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;

