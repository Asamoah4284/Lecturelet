import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from '../config/api';
import { initializeNotifications } from '../services/notificationService';

const RoleSelectScreen = ({ navigation, route }) => {
  const [loadingRole, setLoadingRole] = useState(null);
  const [error, setError] = useState('');
  
  // Get signup data from route params if coming from signup
  const signupData = route?.params?.signupData;

  // Disable back navigation when coming from signup
  useEffect(() => {
    if (signupData) {
      navigation.setOptions({
        gestureEnabled: false,
        headerLeft: null,
      });
    }
  }, [signupData, navigation]);

  const handleSelectRole = async (role) => {
    // If coming from signup, create account with selected role
    if (signupData) {
      await createAccountWithRole(role);
    } else {
      // If coming from settings, update role via API
      await updateUserRole(role);
    }
  };

  const updateUserRole = async (role) => {
    setLoadingRole(role);
    setError('');

    try {
      // Get auth token
      const token = await AsyncStorage.getItem('@auth_token');
      if (!token) {
        throw new Error('Not authenticated. Please log in again.');
      }

      // Map UI role to backend role
      const backendRole = role === 'rep' ? 'course_rep' : 'student';

      const response = await fetch(getApiUrl('auth/profile'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          role: backendRole,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update role. Please try again.');
      }

      if (data.success && data.data) {
        // Update stored user data with fresh data from backend
        await AsyncStorage.setItem('@user_data', JSON.stringify(data.data.user));

        // Fetch fresh user data from backend to ensure role is updated
        try {
          const profileResponse = await fetch(getApiUrl('auth/profile'), {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          
          const profileData = await profileResponse.json();
          if (profileResponse.ok && profileData.success && profileData.data.user) {
            // Update with latest user data including role
            await AsyncStorage.setItem('@user_data', JSON.stringify(profileData.data.user));
          }
        } catch (profileError) {
          console.log('Error fetching fresh profile, using data from role update:', profileError);
        }

        // Navigate to appropriate screen based on new role
        const targetScreen = role === 'rep' ? 'CourseRep' : 'StudentHome';
        
        navigation.reset({
          index: 0,
          routes: [{ name: targetScreen }],
        });
      } else {
        throw new Error(data.message || 'Failed to update role. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'An error occurred. Please try again.');
      Alert.alert('Role Update Failed', err.message || 'An error occurred. Please try again.');
    } finally {
      setLoadingRole(null);
    }
  };

  const createAccountWithRole = async (role) => {
    setLoadingRole(role);
    setError('');

    try {
      // Check if signupData exists
      if (!signupData || !signupData.phoneNumber || !signupData.password || !signupData.fullName) {
        throw new Error('Signup data is missing. Please try signing up again.');
      }

      // Map UI role to backend role
      const backendRole = role === 'rep' ? 'course_rep' : 'student';

      const requestBody = {
        phoneNumber: signupData.phoneNumber,
        password: signupData.password,
        fullName: signupData.fullName,
        role: backendRole,
        college: signupData.college || null,
      };

      console.log('Creating account with:', { ...requestBody, password: '***' });

      const response = await fetch(getApiUrl('auth/signup'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        // Log the full error for debugging
        console.error('Signup error response:', {
          status: response.status,
          statusText: response.statusText,
          data: data,
        });
        
        // Handle validation errors
        if (data.errors && Array.isArray(data.errors)) {
          const errorMessages = data.errors.map(err => err.message || err.msg).join(', ');
          throw new Error(errorMessages || data.message || 'Validation failed. Please check your input.');
        }
        
        throw new Error(data.message || data.error || `Account creation failed (${response.status}). Please try again.`);
      }

      if (data.success && data.data) {
        // Store token and user data
        await AsyncStorage.setItem('@auth_token', data.data.token);
        await AsyncStorage.setItem('@user_data', JSON.stringify(data.data.user));

        // Register push token for notifications (if notifications are enabled)
        // Force registration during signup to ensure token is registered with new user account
        if (data.data.user.notifications_enabled !== false) {
          try {
            await initializeNotifications(true); // Force registration for new account
          } catch (notifError) {
            // Don't block signup if notification registration fails
            console.log('Notification registration failed during signup:', notifError);
          }
        }

        // Reset navigation stack to prevent going back to login/signup
        const targetScreen = role === 'rep' ? 'CourseRep' : 'StudentHome';
        
        navigation.reset({
          index: 0,
          routes: [{ name: targetScreen }],
        });
      } else {
        throw new Error(data.message || 'Account creation failed. Please try again.');
      }
    } catch (err) {
      console.error('Signup error:', err);
      const errorMessage = err.message || 'An error occurred. Please try again.';
      setError(errorMessage);
      Alert.alert('Account Creation Failed', errorMessage);
    } finally {
      setLoadingRole(null);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoWrapper}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>L</Text>
            <Ionicons name="notifications-outline" size={16} color="#ffffff" style={styles.logoIcon} />
            <Text style={styles.logoText}>L</Text>
          </View>
        </View>

        {/* Title */}
        <View style={styles.header}>
          <Text style={styles.appName}>LectureLet</Text>
          <Text style={styles.title}>Select Your Role</Text>
          <Text style={styles.subtitle}>
            Choose your role to personalize your experience
          </Text>
        </View>

        {/* Error message */}
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Role cards */}
        <View style={styles.cardContainer}>
          <TouchableOpacity
            style={[styles.roleCard, loadingRole && styles.roleCardDisabled]}
            activeOpacity={0.9}
            onPress={() => handleSelectRole('student')}
            disabled={!!loadingRole}
          >
            {loadingRole === 'student' ? (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="small" color="#0ea5e9" />
              </View>
            ) : null}
            <View style={[styles.roleIconWrapper, styles.roleIconStudent]}>
              <Ionicons name="school-outline" size={24} color="#0ea5e9" />
            </View>
            <View style={styles.roleTextArea}>
              <Text style={styles.roleTitle}>Student</Text>
              <Text style={styles.roleBody}>
                Join courses, view timetables, and receive notifications for
                your lectures.
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.roleCard, loadingRole && styles.roleCardDisabled]}
            activeOpacity={0.9}
            onPress={() => handleSelectRole('rep')}
            disabled={!!loadingRole}
          >
            {loadingRole === 'rep' ? (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="small" color="#f97316" />
              </View>
            ) : null}
            <View style={[styles.roleIconWrapper, styles.roleIconRep]}>
              <Ionicons name="people-outline" size={24} color="#f97316" />
            </View>
            <View style={styles.roleTextArea}>
              <Text style={styles.roleTitle}>Course Representative</Text>
              <Text style={styles.roleBody}>
                Create and manage courses, and generate course codes for
                students.
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.noteText}>
          Note: You can change your role later in the settings.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 32,
  },
  logoWrapper: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#f97316',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 20,
  },
  logoIcon: {
    marginHorizontal: 6,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  appName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  cardContainer: {
    marginTop: 8,
    gap: 16,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 18,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 4,
  },
  roleIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  roleIconStudent: {
    backgroundColor: '#e0f2fe',
  },
  roleIconRep: {
    backgroundColor: '#ffedd5',
  },
  roleIconEmoji: {
    fontSize: 24,
  },
  roleTextArea: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  roleBody: {
    fontSize: 13,
    color: '#6b7280',
  },
  noteText: {
    marginTop: 20,
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
    textAlign: 'center',
  },
  roleCardDisabled: {
    opacity: 0.6,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 20,
    zIndex: 1,
  },
});

export default RoleSelectScreen;


