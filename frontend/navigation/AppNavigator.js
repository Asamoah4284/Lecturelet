import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import WelcomeScreen from '../screens/WelcomeScreen';
import CourseListScreen from '../screens/CourseListScreen';
import AddCourseScreen from '../screens/AddCourseScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SignupScreen from '../screens/SignupScreen';
import LoginScreen from '../screens/LoginScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import RoleSelectScreen from '../screens/RoleSelectScreen';
import CourseRepScreen from '../screens/CourseRepScreen';
import CoursesScreen from '../screens/CoursesScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import StudentAddCourseScreen from '../screens/StudentAddCourseScreen';
import StudentCoursesScreen from '../screens/StudentCoursesScreen';
import StudentHomeScreen from '../screens/StudentHomeScreen';
import CourseStudentsScreen from '../screens/CourseStudentsScreen';
import StudentTimetableScreen from '../screens/StudentTimetableScreen';
import CreateQuizScreen from '../screens/CreateQuizScreen';
import CreateTutorialScreen from '../screens/CreateTutorialScreen';
import CreateAssignmentScreen from '../screens/CreateAssignmentScreen';
import CourseMaterialsScreen from '../screens/CourseMaterialsScreen';
import AnnouncementScreen from '../screens/AnnouncementScreen';
import AlertSoundPickerScreen from '../screens/AlertSoundPickerScreen';

const Stack = createStackNavigator();

const AppNavigator = () => {
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    const determineInitialRoute = async () => {
      try {
        const token = await AsyncStorage.getItem('@auth_token');
        if (token) {
          const userDataString = await AsyncStorage.getItem('@user_data');
          if (userDataString) {
            const userData = JSON.parse(userDataString);
            if (userData.role === 'course_rep') {
              setInitialRoute('CourseRep');
              return;
            }
          }
          // Default to student home if logged in but no role set
          setInitialRoute('StudentHome');
        } else {
          setInitialRoute('Welcome');
        }
      } catch (err) {
        console.error('Error determining initial route:', err);
        setInitialRoute('Welcome');
      }
    };

    determineInitialRoute();
  }, []);

  // Prevent flicker while figuring out where to send the user
  if (!initialRoute) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialRoute}
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
          options={{ 
            headerShown: false,
            gestureEnabled: false,
            animationEnabled: false,
          }}
        />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ 
            headerShown: false,
            gestureEnabled: false,
            animationEnabled: false,
          }}
        />
        <Stack.Screen
          name="ForgotPassword"
          component={ForgotPasswordScreen}
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
          name="StudentTimetable"
          component={StudentTimetableScreen}
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
        <Stack.Screen
          name="CourseStudents"
          component={CourseStudentsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="CreateQuiz"
          component={CreateQuizScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="CreateTutorial"
          component={CreateTutorialScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="CreateAssignment"
          component={CreateAssignmentScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="CourseMaterials"
          component={CourseMaterialsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Announcement"
          component={AnnouncementScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AlertSoundPicker"
          component={AlertSoundPickerScreen}
          options={{ title: 'Alert sound' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;

