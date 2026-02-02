import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  TextInput,
  Platform,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Button from '../components/Button';
import { getApiUrl, PAYSTACK_PUBLIC_KEY } from '../config/api';
import { initializeNotifications, removePushToken } from '../services/notificationService';
import { syncAndScheduleReminders, cancelAllReminders } from '../services/localReminderService';
import { getTrialStatus } from '../utils/trialHelpers';
import * as Notifications from 'expo-notifications';
import {
  NOTIFICATION_SOUND_IDS,
  getSoundFileName,
} from '../config/notificationSounds';

// Bundle sound files from assets/sounds (used by notification channels + preview)
require('../assets/sounds/r1.wav');
require('../assets/sounds/r2.wav');
require('../assets/sounds/r3.wav');

const SettingsContent = ({ navigation }) => {
  const webViewRef = useRef(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [reminderMinutes, setReminderMinutes] = useState('15');
  const [notificationSound, setNotificationSound] = useState('default');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPhoneNumber, setUserPhoneNumber] = useState('');
  const [userRole, setUserRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [trialStatus, setTrialStatus] = useState(null);
  const [showSoundPicker, setShowSoundPicker] = useState(false);

  // Accesstates
  const [showPayment, setShowPayment] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentEmail, setPaymentEmail] = useState('');
  const FIXED_PAYMENT_AMOUNT = 25; // Fixed payment amount in GHS

  // Feedback states
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Load user data on mount
  useEffect(() => {
    loadAuthStatus();
    loadUserData();
  }, []);

  // Reload user data when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadAuthStatus();
      loadUserData();
    });
    return unsubscribe;
  }, [navigation]);

  const loadAuthStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('@auth_token');
      setIsAuthenticated(!!token);
    } catch (error) {
      console.error('Error loading auth status:', error);
      setIsAuthenticated(false);
    }
  };

  const loadUserData = async () => {
    try {
      const token = await AsyncStorage.getItem('@auth_token');
      if (!token) {
        // Guest mode - set defaults
        setUserName('Guest');
        setUserPhoneNumber('');
        setUserRole('');
        setNotificationsEnabled(false);
        setReminderMinutes('15');
        setPaymentStatus(false);
        // Load sound preference even for guests (stored locally)
        const storedSound = await AsyncStorage.getItem('@notification_sound');
        if (storedSound) {
          setNotificationSound(storedSound);
        }
        return;
      }

      // Load from AsyncStorage first for quick display
      const userDataString = await AsyncStorage.getItem('@user_data');
      if (userDataString) {
        const userData = JSON.parse(userDataString);
        if (userData.full_name) {
          setUserName(userData.full_name);
        }
        if (userData.email) {
          setUserEmail(userData.email);
        }
        if (userData.phone_number) {
          setUserPhoneNumber(userData.phone_number);
        }
        if (userData.role) {
          setUserRole(userData.role);
        }
        if (userData.notifications_enabled !== undefined) {
          setNotificationsEnabled(userData.notifications_enabled);
        }
        if (userData.reminder_minutes !== undefined) {
          setReminderMinutes(String(userData.reminder_minutes));
        }
        if (userData.notification_sound !== undefined) {
          setNotificationSound(userData.notification_sound);
        } else {
          // Load from AsyncStorage if not in user data
          const storedSound = await AsyncStorage.getItem('@notification_sound');
          if (storedSound) {
            setNotificationSound(storedSound);
          }
        }
        if (userData.payment_status !== undefined) {
          setPaymentStatus(userData.payment_status);
        }
        // Load trial status
        const status = getTrialStatus(userData);
        setTrialStatus(status);
      }

      // Fetch latest from backend
      const response = await fetch(getApiUrl('auth/profile'), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (response.ok && data.success && data.data.user) {
        const user = data.data.user;
        setNotificationsEnabled(user.notifications_enabled ?? true);
        setReminderMinutes(String(user.reminder_minutes ?? 15));
        setPaymentStatus(user.payment_status ?? false);
        // Load notification sound from user data or fallback to AsyncStorage
        if (user.notification_sound !== undefined) {
          setNotificationSound(user.notification_sound);
        } else {
          const storedSound = await AsyncStorage.getItem('@notification_sound');
          if (storedSound) {
            setNotificationSound(storedSound);
          }
        }
        // Update trial status
        const status = getTrialStatus(user);
        setTrialStatus(status);
        // Update AsyncStorage with latest user data including Access status and trial info
        await AsyncStorage.setItem('@user_data', JSON.stringify(user));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  // Helper function to save notification preferences (used for auto-save)
  const saveNotificationPreference = async (enabled, minutes, sound) => {
    if (!isAuthenticated) return;

    try {
      const token = await AsyncStorage.getItem('@auth_token');
      if (!token) return;

      const reminderMinutesNum = typeof minutes === 'string' ? parseInt(minutes, 10) : minutes;
      if (isNaN(reminderMinutesNum) || reminderMinutesNum < 0 || reminderMinutesNum > 120) {
        return; // Invalid value, don't save
      }

      const response = await fetch(getApiUrl('auth/profile'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          notificationsEnabled: enabled,
          reminderMinutes: reminderMinutesNum,
          notificationSound: notificationSound,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Update local storage
        const userDataString = await AsyncStorage.getItem('@user_data');
        if (userDataString) {
          const userData = JSON.parse(userDataString);
          userData.notifications_enabled = enabled;
          userData.reminder_minutes = reminderMinutesNum;
          userData.notification_sound = notificationSound;
          await AsyncStorage.setItem('@user_data', JSON.stringify(userData));
        }

        // Also store notification sound separately for easy access
        await AsyncStorage.setItem('@notification_sound', notificationSound);

        // Initialize or remove notifications based on preference
        if (enabled) {
          // Recreate Android notification channel with new sound preference
          const { createNotificationChannel } = require('../services/notificationService');
          await createNotificationChannel(true); // Force recreate to update sound

          await initializeNotifications();
          // Rebuild local reminder notifications with new preference (will use new sound)
          await syncAndScheduleReminders(reminderMinutesNum);
        } else {
          await removePushToken();
          // Cancel all local reminders if notifications are disabled
          await cancelAllReminders();
        }
      }
    } catch (error) {
      console.error('Error auto-saving notification preference:', error);
      // Don't show alert for auto-save failures to avoid interrupting user
    }
  };

  const handleSaveSettings = async () => {
    if (!isAuthenticated) {
      Alert.alert('Sign Up Required', 'Please sign up to save settings.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Up', onPress: () => navigation.navigate('Signup') },
      ]);
      return;
    }

    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('@auth_token');
      if (!token) {
        Alert.alert('Error', 'Not authenticated. Please log in again.');
        return;
      }

      const reminderMinutesNum = parseInt(reminderMinutes, 10);
      if (isNaN(reminderMinutesNum) || reminderMinutesNum < 0 || reminderMinutesNum > 120) {
        Alert.alert('Error', 'Reminder minutes must be between 0 and 120');
        return;
      }

      // Save notification preferences (this will also handle notification setup)
      await saveNotificationPreference(notificationsEnabled, reminderMinutesNum, notificationSound);

      Alert.alert('Success', 'Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };


  const getInitial = () => {
    if (userName) {
      return userName.charAt(0).toUpperCase();
    }
    return 'U';
  };

  const getRoleDisplayName = (role) => {
    if (role === 'course_rep') {
      return 'Course Representative';
    } else if (role === 'student') {
      return 'Student';
    }
    return role;
  };

  const handleLogout = () => {
    if (!isAuthenticated) {
      Alert.alert('Sign Up Required', 'Please sign up to access account features.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Up', onPress: () => navigation.navigate('Signup') },
      ]);
      return;
    }

    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear authentication data
              await AsyncStorage.removeItem('@auth_token');
              await AsyncStorage.removeItem('@user_data');

              // Reset navigation stack straight to LectureLet home (skip animation screen)
              navigation.reset({
                index: 0,
                routes: [{ name: 'StudentHome' }],
              });
            } catch (error) {
              console.error('Error during logout:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    if (!isAuthenticated) {
      Alert.alert('Sign Up Required', 'Please sign up to access account features.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Up', onPress: () => navigation.navigate('Signup') },
      ]);
      return;
    }

    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone. All your data, enrollments, and notifications will be permanently deleted.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('@auth_token');
              if (!token) {
                Alert.alert('Error', 'Not authenticated. Please log in again.');
                return;
              }

              const response = await fetch(getApiUrl('auth/account'), {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`,
                },
              });

              const data = await response.json();

              if (response.ok && data.success) {
                // Clear authentication data
                await AsyncStorage.removeItem('@auth_token');
                await AsyncStorage.removeItem('@user_data');

                // Cancel all local reminders
                await cancelAllReminders();

                // Remove push token
                await removePushToken();

                Alert.alert(
                  'Account Deleted',
                  'Your account has been successfully deleted.',
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        // Reset navigation stack to StudentHome
                        navigation.reset({
                          index: 0,
                          routes: [{ name: 'StudentHome' }],
                        });
                      },
                    },
                  ]
                );
              } else {
                Alert.alert('Error', data.message || 'Failed to delete account. Please try again.');
              }
            } catch (error) {
              console.error('Error deleting account:', error);
              Alert.alert('Error', 'Failed to delete account. Please check your connection and try again.');
            }
          },
        },
      ]
    );
  };

  // Payment initialization handler
  const handleInitializePayment = async () => {
    if (!isAuthenticated) {
      Alert.alert('Sign Up Required', 'Please sign up to make a payment.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Up', onPress: () => navigation.navigate('Signup') },
      ]);
      return;
    }

    // Check if Paystack is configured
    if (!PAYSTACK_PUBLIC_KEY) {
      Alert.alert(
        'Configuration Error',
        'Paystack is not configured. Please ensure PAYSTACK_PUBLIC_KEY is set in app.json and restart the app.\n\nIf you just added the key, please:\n1. Stop the Expo server\n2. Run: npx expo start --clear\n3. Reload the app'
      );
      console.error('PAYSTACK_PUBLIC_KEY is missing. Current value:', PAYSTACK_PUBLIC_KEY);
      return;
    }

    // Use payment email if provided, otherwise fall back to userEmail from profile
    const emailToUse = paymentEmail.trim() || userEmail;

    // Validate email
    if (!emailToUse) {
      Alert.alert('Email Required', 'Please enter your email address to proceed with payment.');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailToUse)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    // Get authentication token
    const token = await AsyncStorage.getItem('@auth_token');
    if (!token) {
      Alert.alert('Authentication Required', 'Please log in to proceed.');
      return;
    }

    try {
      setIsProcessingPayment(true);

      // Initialize payment with backend
      const response = await fetch(getApiUrl('payments/initialize-payment'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: FIXED_PAYMENT_AMOUNT,
          email: emailToUse,
          currency: 'GHS',
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Store payment data and show WebView with authorization_url
        // SECURITY: Use amount from backend response, not the one we sent
        setPaymentData({
          reference: data.reference,
          authorizationUrl: data.authorization_url || data.data?.authorization_url,
          amount: data.amount || FIXED_PAYMENT_AMOUNT, // Use backend amount for security
          email: emailToUse,
        });
        setShowPayment(true);
      } else {
        Alert.alert('Payment Initialization Failed', data.error || data.message || 'Failed to initialize payment.');
        setIsProcessingPayment(false);
      }
    } catch (error) {
      console.error('Payment initialization error:', error);
      Alert.alert('Error', 'Network error. Please check your connection.');
      setIsProcessingPayment(false);
    }
  };

  // Handle WebView navigation to detect payment completion
  const handleWebViewNavigationStateChange = async (navState) => {
    const { url, loading } = navState;
    console.log('WebView navigation:', { url, loading });

    // Only process when page has finished loading
    if (!loading && url) {
      // Paystack success redirect URLs
      const isPaystackSuccess = url === 'https://standard.paystack.co/close' ||
        url.includes('standard.paystack.co/close') ||
        (url.includes('checkout.paystack.com') && (url.includes('success') || url.includes('close')));

      // Other success indicators
      const isSuccess = url.includes('callback') ||
        url.includes('success') ||
        url.includes('verify') ||
        url.includes('transaction/verify') ||
        url.match(/\/success/i);

      // Cancel indicators (but not the Paystack close URL)
      const isCancel = (url.includes('cancel') || url.match(/\/cancel/i)) &&
        !url.includes('standard.paystack.co/close') &&
        !url.includes('checkout.paystack.com');

      if (isPaystackSuccess || (isSuccess && !isCancel)) {
        console.log('Payment completed detected via navigation, verifying automatically...');
        // Close payment modal immediately
        setShowPayment(false);
        setIsProcessingPayment(true);
        // Verify payment immediately - Paystack has already processed it
        await verifyPayment();
      } else if (isCancel) {
        console.log('Payment cancelled detected');
        handlePaymentCancel();
      }
    }
  };

  // Handle should start load with request (more reliable for navigation detection)
  const handleShouldStartLoadWithRequest = (request) => {
    const { url } = request;
    console.log('WebView should start load:', url);

    // Allow navigation to proceed
    return true;
  };

  // Verify payment with backend
  const verifyPayment = async () => {
    try {
      const token = await AsyncStorage.getItem('@auth_token');

      if (!paymentData?.reference) {
        console.error('No payment reference available for verification');
        throw new Error('No payment reference available');
      }

      console.log('Verifying payment with reference:', paymentData.reference);
      console.log('Payment data:', paymentData);

      // Verify payment with backend - add retry logic with delays
      let verifyResponse;
      let verifyData;
      let retries = 3;
      let delay = 1000; // Start with 1 second delay

      while (retries > 0) {
        try {
          verifyResponse = await fetch(getApiUrl('payments/verify-payment'), {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              reference: paymentData.reference,
              // Note: Amount is not sent - backend verifies against stored payment record
            }),
          });

          verifyData = await verifyResponse.json();
          console.log('Verification response:', verifyData);

          if (verifyResponse.ok && verifyData.success) {
            break; // Success, exit retry loop
          } else if (retries > 1) {
            // Wait before retrying
            console.log(`Verification failed, retrying in ${delay}ms... (${retries - 1} retries left)`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff
            retries--;
            continue;
          } else {
            break; // No more retries
          }
        } catch (fetchError) {
          console.error('Fetch error during verification:', fetchError);
          if (retries > 1) {
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
            retries--;
            continue;
          } else {
            throw fetchError;
          }
        }
      }

      if (verifyResponse.ok && verifyData.success) {
        console.log('Payment verified successfully!');

        // Update Access status immediately for instant UI feedback
        setPaymentStatus(true);

        // Update AsyncStorage immediately with Access status
        const userDataString = await AsyncStorage.getItem('@user_data');
        if (userDataString) {
          const userData = JSON.parse(userDataString);
          userData.payment_status = true;
          await AsyncStorage.setItem('@user_data', JSON.stringify(userData));
        }

        // Update user data from backend to reflect Access status (this will refresh the UI)
        await loadUserData();

        // Clear payment data
        setPaymentData(null);
        setIsProcessingPayment(false);

        Alert.alert(
          'Accessuccessful! 🎉',
          `Your payment of GH₵${paymentData.amount} has been processed successfully! Your Access status has been updated.`,
          [{
            text: 'OK',
            onPress: () => {
              // Access status is already updated, UI will show "Paid" status
            }
          }]
        );
      } else {
        console.error('Payment verification failed after retries:', verifyData);
        setIsProcessingPayment(false);
        Alert.alert(
          'Payment Verification Failed',
          verifyData.error || verifyData.message || verifyData.details || 'Payment verification failed. The payment may still be processing. Please check your Access status in a few moments.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Try Again',
              onPress: async () => {
                setIsProcessingPayment(true);
                await verifyPayment();
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Payment verification error:', error);
      setIsProcessingPayment(false);
      Alert.alert(
        'Error',
        'Payment verification failed. Please check your connection and try again. If the payment was successful, it will be verified automatically.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Retry',
            onPress: async () => {
              setIsProcessingPayment(true);
              await verifyPayment();
            }
          }
        ]
      );
    }
  };

  // Payment cancel handler
  const handlePaymentCancel = () => {
    setShowPayment(false);
    setIsProcessingPayment(false);
    setPaymentData(null);
    // Don't clear paymentEmail so user doesn't have to re-enter if they try again
  };

  /**
   * Handles feedback submission
   */
  /**
   * Preview the selected notification sound by triggering a test notification
   */
  const previewNotificationSound = async () => {
    try {
      // Get the current sound preference
      const soundPreference = notificationSound;

      // Map sound preference to notification sound value
      let notificationSoundValue = true; // Default to system sound

      if (soundPreference === 'none') {
        notificationSoundValue = false; // Silent
      } else if (soundPreference === 'default') {
        notificationSoundValue = true; // System default sound
      } else if (NOTIFICATION_SOUND_IDS.includes(soundPreference)) {
        const soundFileName = getSoundFileName(soundPreference);
        if (soundFileName) {
          console.log(`Using custom sound from sounds folder: ${soundFileName}`);
          notificationSoundValue = soundFileName;
        } else {
          notificationSoundValue = true;
        }
      } else {
        // Fallback to default
        notificationSoundValue = true;
      }

      // Check permissions
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please enable notification permissions to preview sounds.',
          [{ text: 'OK' }]
        );
        return;
      }

      const { createNotificationChannel, getChannelIdForSound } = require('../services/notificationService');
      await createNotificationChannel(true);

      const channelId = getChannelIdForSound(soundPreference);
      const trigger = Platform.OS === 'android' && channelId
        ? { seconds: 2, channelId }
        : { seconds: 2 };

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Sound Preview 🔊',
          body: soundPreference === 'none'
            ? 'This is a silent notification (no sound)'
            : `This is how your ${soundPreference} notification will sound - Listen for the sound!`,
          sound: notificationSoundValue,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger,
      });
    } catch (error) {
      console.error('Error previewing notification sound:', error);
      Alert.alert('Error', 'Failed to preview sound. Please try again.');
    }
  };

  const handleSubmitFeedback = async () => {
    if (!isAuthenticated) {
      Alert.alert('Sign Up Required', 'Please sign up to submit feedback.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Up', onPress: () => navigation.navigate('Signup') },
      ]);
      return;
    }

    if (feedbackMessage.trim().length < 10) {
      Alert.alert('Invalid Feedback', 'Please provide at least 10 characters of feedback.');
      return;
    }

    setSubmittingFeedback(true);
    try {
      const token = await AsyncStorage.getItem('@auth_token');
      if (!token) {
        Alert.alert('Error', 'Not authenticated. Please log in again.');
        return;
      }

      const response = await fetch(getApiUrl('feedback'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: feedbackMessage.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        Alert.alert('Thank You!', data.message || 'Your feedback has been submitted successfully.');
        setFeedbackMessage('');
        setShowFeedbackModal(false);
      } else {
        Alert.alert('Error', data.message || 'Failed to submit feedback. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      Alert.alert('Error', 'Failed to submit feedback. Please check your connection and try again.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  // Handle WebView message from Paystack (if using postMessage)
  const handleWebViewMessage = async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.status === 'success') {
        console.log('Accessuccess message received, verifying automatically...');
        // Close payment modal immediately
        setShowPayment(false);
        setIsProcessingPayment(true);
        // Verify payment automatically - no manual intervention needed
        await verifyPayment();
      } else if (data.status === 'cancel') {
        handlePaymentCancel();
      }
    } catch (error) {
      // Not a JSON message, ignore
    }
  };


  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />

      {/* Blue Header */}
      <View style={styles.header} />

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* User Header Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>{isAuthenticated ? getInitial() : 'G'}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{isAuthenticated ? (userName || 'User') : 'Guest'}</Text>
            <Text style={styles.profileEmail}>
              {isAuthenticated ? (userPhoneNumber || 'No phone number') : 'Preview mode - Sign up to continue'}
            </Text>
            <Text style={styles.profileRole}>
              {isAuthenticated ? getRoleDisplayName(userRole) : 'Guest User'}
            </Text>
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => {
              if (isAuthenticated) {
                navigation.navigate('RoleSelect');
              } else {
                Alert.alert('Sign Up Required', 'Please sign up to change your role.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Sign Up', onPress: () => navigation.navigate('Signup') },
                ]);
              }
            }}
          >
            <View style={styles.settingLeft}>
              <Ionicons name="person-outline" size={20} color="#6b7280" />
              <Text style={styles.settingLabel}>Change Role</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="notifications-outline" size={20} color="#6b7280" />
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Enable Notifications</Text>
                <Text style={styles.settingDescription}>
                  Receive reminders about upcoming lectures
                </Text>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={async (value) => {
                if (!isAuthenticated) {
                  Alert.alert('Sign Up Required', 'Please sign up to enable notifications.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Sign Up', onPress: () => navigation.navigate('Signup') },
                  ]);
                } else {
                  setNotificationsEnabled(value);
                  // Auto-save notification preference
                  await saveNotificationPreference(value, reminderMinutes, notificationSound);
                }
              }}
              trackColor={{ false: '#d1d5db', true: '#22c55e' }}
              thumbColor="#ffffff"
              disabled={!isAuthenticated}
            />
          </View>

          {notificationsEnabled && (
            <>
              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <Ionicons name="time-outline" size={20} color="#6b7280" />
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Remind me before (minutes)</Text>
                    <Text style={styles.settingDescription}>
                      How many minutes before class to receive reminder
                    </Text>
                  </View>
                </View>
                <TextInput
                  style={[styles.reminderInput, !isAuthenticated && styles.disabledInput]}
                  value={reminderMinutes}
                  onChangeText={(text) => {
                    if (isAuthenticated) {
                      setReminderMinutes(text);
                    } else {
                      Alert.alert('Sign Up Required', 'Please sign up to change reminder settings.', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Sign Up', onPress: () => navigation.navigate('Signup') },
                      ]);
                    }
                  }}
                  onBlur={async () => {
                    if (isAuthenticated) {
                      const reminderMinutesNum = parseInt(reminderMinutes, 10);
                      if (!isNaN(reminderMinutesNum) && reminderMinutesNum >= 0 && reminderMinutesNum <= 120) {
                        // Auto-save reminder minutes when user finishes editing
                        await saveNotificationPreference(notificationsEnabled, reminderMinutesNum, notificationSound);
                      }
                    }
                  }}
                  keyboardType="numeric"
                  placeholder="15"
                  placeholderTextColor="#9ca3af"
                  maxLength={3}
                  editable={isAuthenticated}
                />
              </View>

              <TouchableOpacity
                style={[styles.settingItem, !isAuthenticated && styles.disabledSettingItem]}
                onPress={() => {
                  if (isAuthenticated) {
                    setShowSoundPicker(true);
                  } else {
                    Alert.alert('Sign Up Required', 'Please sign up to change notification sound.', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Sign Up', onPress: () => navigation.navigate('Signup') },
                    ]);
                  }
                }}
                disabled={!isAuthenticated}
              >
                <View style={styles.settingLeft}>
                  <Ionicons name="musical-notes-outline" size={20} color="#6b7280" />
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Notification Sound</Text>
                    <Text style={styles.settingDescription}>
                      Choose your preferred notification sound
                    </Text>
                  </View>
                </View>
                <View style={styles.soundValueContainer}>
                  <Text style={styles.soundValueText}>
                    {notificationSound === 'default' ? 'Default' :
                      notificationSound === 'r1' ? 'Sound 1' :
                        notificationSound === 'r2' ? 'Sound 2' :
                          notificationSound === 'r3' ? 'Sound 3' :
                            notificationSound === 'none' ? 'None' : notificationSound}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                </View>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Save Settings Button — after notification sound */}
        {isAuthenticated ? (
          <Button
            title={saving ? "Saving..." : "Save Settings"}
            onPress={handleSaveSettings}
            variant="primary"
            style={styles.saveButton}
            disabled={saving}
          />
        ) : (
          <View style={styles.guestPromptContainer}>
            <Text style={styles.guestPromptText}>Sign up to save settings and access all features</Text>
            <Button
              title="Sign Up"
              onPress={() => navigation.navigate('Signup')}
              variant="primary"
              style={styles.signUpButton}
            />
          </View>
        )}

        {/* Accessection - Only show for authenticated students (hide for guests + course reps) */}
        {isAuthenticated && userRole === 'student' && userRole !== 'course_rep' && userRole !== '' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account Services</Text>

            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <Text style={styles.settingDescription}>
                  Lecturelet provides optional administrative and communication services such as SMS notifications, account handling, and data management related to institutional use.
                </Text>
              </View>
            </View>

            <View style={styles.paymentEmailContainer}>
              <Text style={styles.paymentEmailLabel}>Email Address</Text>
              <TextInput
                style={[styles.paymentEmailInput, !isAuthenticated && styles.disabledInput]}
                value={paymentEmail}
                onChangeText={(text) => {
                  if (isAuthenticated) {
                    setPaymentEmail(text);
                  }
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={userEmail || "Enter your email address"}
                placeholderTextColor="#9ca3af"
                editable={isAuthenticated}
              />
              {userEmail && (
                <Text style={styles.paymentEmailHint}>
                  Using profile email: {userEmail}
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.payButton, (isProcessingPayment || !isAuthenticated) && styles.payButtonDisabled]}
              onPress={handleInitializePayment}
              disabled={isProcessingPayment || !isAuthenticated}
            >
              {isProcessingPayment ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.payButtonText}>Get Access</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Help Us Get Better Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Help Us Get Better</Text>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => {
              if (isAuthenticated) {
                setShowFeedbackModal(true);
              } else {
                Alert.alert('Sign Up Required', 'Please sign up to submit feedback.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Sign Up', onPress: () => navigation.navigate('Signup') },
                ]);
              }
            }}
          >
            <View style={styles.settingLeft}>
              <Ionicons name="chatbubble-ellipses-outline" size={20} color="#6b7280" />
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Share Your Feedback</Text>
                <Text style={styles.settingDescription}>
                  Tell us how we can improve the app
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>

          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="help-circle-outline" size={20} color="#6b7280" />
              <Text style={styles.settingLabel}>Help & Support</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="shield-outline" size={20} color="#6b7280" />
              <Text style={styles.settingLabel}>Privacy Policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* Logout Button + Version */}
        {isAuthenticated && (
          <>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.deleteAccountButton} onPress={handleDeleteAccount}>
              <Ionicons name="trash-outline" size={16} color="#ef4444" style={styles.deleteAccountIcon} />
              <Text style={styles.deleteAccountText}>Delete Account</Text>
            </TouchableOpacity>
          </>
        )}

        <Text style={styles.versionText}>Version 1.0.0</Text>
      </ScrollView>

      {/* Feedback Modal */}
      <Modal
        visible={showFeedbackModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFeedbackModal(false)}
      >
        <View style={styles.feedbackModalOverlay}>
          <View style={styles.feedbackModalContent}>
            <View style={styles.feedbackModalHeader}>
              <Text style={styles.feedbackModalTitle}>Help Us Get Better</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowFeedbackModal(false);
                  setFeedbackMessage('');
                }}
                style={styles.feedbackModalCloseButton}
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.feedbackModalBody}>
              <Text style={styles.feedbackModalDescription}>
                We value your opinion! Share your thoughts, suggestions, or report any issues you've encountered. Your feedback helps us make LectureLet better for everyone.
              </Text>

              <View style={styles.feedbackInputContainer}>
                <Text style={styles.feedbackInputLabel}>Your Feedback</Text>
                <TextInput
                  style={styles.feedbackInput}
                  placeholder="Tell us what you think... (minimum 10 characters)"
                  placeholderTextColor="#9ca3af"
                  value={feedbackMessage}
                  onChangeText={setFeedbackMessage}
                  multiline
                  numberOfLines={8}
                  textAlignVertical="top"
                  maxLength={2000}
                  editable={!submittingFeedback}
                />
                <Text style={styles.feedbackCharCount}>
                  {feedbackMessage.length}/2000 characters
                </Text>
              </View>
            </ScrollView>

            <View style={styles.feedbackModalFooter}>
              <TouchableOpacity
                style={[
                  styles.feedbackCancelButton,
                  submittingFeedback && styles.feedbackButtonDisabled,
                ]}
                onPress={() => {
                  setShowFeedbackModal(false);
                  setFeedbackMessage('');
                }}
                disabled={submittingFeedback}
              >
                <Text style={styles.feedbackCancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.feedbackSubmitButton,
                  (submittingFeedback || feedbackMessage.trim().length < 10) &&
                  styles.feedbackButtonDisabled,
                ]}
                onPress={handleSubmitFeedback}
                disabled={submittingFeedback || feedbackMessage.trim().length < 10}
              >
                {submittingFeedback ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.feedbackSubmitButtonText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Notification Sound Picker Modal */}
      <Modal
        visible={showSoundPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSoundPicker(false)}
      >
        <View style={styles.soundPickerOverlay}>
          <View style={styles.soundPickerContent}>
            <View style={styles.soundPickerHeader}>
              <Text style={styles.soundPickerTitle}>Select Notification Sound</Text>
              <View style={styles.soundPickerHeaderRight}>
                <TouchableOpacity
                  onPress={previewNotificationSound}
                  style={styles.previewButton}
                >
                  <Ionicons name="play-circle-outline" size={20} color="#2563eb" />
                  <Text style={styles.previewButtonText}>Preview</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowSoundPicker(false)}
                  style={styles.soundPickerCloseButton}
                >
                  <Ionicons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={styles.soundPickerBody}>
              {[
                { value: 'default', label: 'Default', icon: 'notifications-outline', soundFile: null },
                { value: 'r1', label: 'Sound 1', icon: 'musical-notes', soundFile: require('../assets/sounds/r1.wav') },
                { value: 'r2', label: 'Sound 2', icon: 'volume-high', soundFile: require('../assets/sounds/r2.wav') },
                { value: 'r3', label: 'Sound 3', icon: 'radio-button-on', soundFile: require('../assets/sounds/r3.wav') },
                { value: 'none', label: 'None (Silent)', icon: 'volume-mute', soundFile: null },
              ].map((sound) => (
                <TouchableOpacity
                  key={sound.value}
                  style={[
                    styles.soundOption,
                    notificationSound === sound.value && styles.soundOptionSelected,
                  ]}
                  onPress={async () => {
                    setNotificationSound(sound.value);
                    // Auto-save notification sound preference
                    if (isAuthenticated) {
                      // Store sound preference locally
                      await AsyncStorage.setItem('@notification_sound', sound.value);
                      // Update user data in AsyncStorage
                      const userDataString = await AsyncStorage.getItem('@user_data');
                      if (userDataString) {
                        const userData = JSON.parse(userDataString);
                        userData.notification_sound = sound.value;
                        await AsyncStorage.setItem('@user_data', JSON.stringify(userData));
                      }
                      // Recreate Android notification channel with new sound preference
                      if (notificationsEnabled) {
                        const { createNotificationChannel } = require('../services/notificationService');
                        await createNotificationChannel(true); // Force recreate to update sound
                        // Auto-save to backend
                        await saveNotificationPreference(notificationsEnabled, reminderMinutes, sound.value);
                      }
                    }
                    // Don't close immediately - let user preview if they want
                    // User can close manually or use preview button
                  }}
                >
                  <View style={styles.soundOptionLeft}>
                    <Ionicons
                      name={sound.icon}
                      size={20}
                      color={notificationSound === sound.value ? '#2563eb' : '#6b7280'}
                    />
                    <Text
                      style={[
                        styles.soundOptionLabel,
                        notificationSound === sound.value && styles.soundOptionLabelSelected,
                      ]}
                    >
                      {sound.label}
                    </Text>
                  </View>
                  {notificationSound === sound.value && (
                    <Ionicons name="checkmark-circle" size={24} color="#2563eb" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Paystack Payment WebView Modal */}
      {showPayment && paymentData?.authorizationUrl && (
        <Modal
          visible={showPayment}
          animationType="slide"
          onRequestClose={handlePaymentCancel}
        >
          <SafeAreaView style={styles.paymentContainer}>
            <View style={styles.paymentHeader}>
              <TouchableOpacity onPress={handlePaymentCancel} style={styles.paymentCloseButton}>
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
              <Text style={styles.paymentTitle}>Get Access</Text>
              <View style={styles.paymentCloseButton} />
            </View>

            <WebView
              ref={webViewRef}
              source={{ uri: paymentData.authorizationUrl }}
              style={styles.paystackContainer}
              onNavigationStateChange={handleWebViewNavigationStateChange}
              onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
              onMessage={handleWebViewMessage}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              allowsBackForwardNavigationGestures={true}
              renderLoading={() => (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#2563eb" />
                  <Text style={styles.loadingText}>Loading payment page...</Text>
                </View>
              )}
              onError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.error('WebView error:', nativeEvent);
                Alert.alert(
                  'Payment Error',
                  'There was an error loading the payment page. Please try again.',
                  [{ text: 'OK', onPress: handlePaymentCancel }]
                );
              }}
              injectedJavaScript={`
                (function() {
                  var verificationSent = false;
                  
                  // Monitor for Paystack payment completion
                  window.addEventListener('message', function(event) {
                    if (event.data && event.data.status && !verificationSent) {
                      verificationSent = true;
                      window.ReactNativeWebView.postMessage(JSON.stringify(event.data));
                    }
                  });
                  
                  // Check current URL and page content for success indicators
                  function checkUrl() {
                    if (verificationSent) return;
                    
                    var url = window.location.href;
                    var bodyText = document.body ? document.body.innerText.toLowerCase() : '';
                    var bodyHTML = document.body ? document.body.innerHTML.toLowerCase() : '';
                    
                    // Paystack success redirect URLs
                    if (url === 'https://standard.paystack.co/close' || 
                        url.includes('standard.paystack.co/close') ||
                        url.includes('checkout.paystack.com') && (url.includes('success') || url.includes('close'))) {
                      verificationSent = true;
                      window.ReactNativeWebView.postMessage(JSON.stringify({status: 'success', source: 'url'}));
                      return;
                    }
                    
                    // Check for success text in page content (Paystack success page)
                    if (bodyText.includes('Accessuccessful') || 
                        bodyText.includes('transaction successful') ||
                        bodyText.includes('you paid') ||
                        bodyHTML.includes('Accessuccessful') ||
                        bodyHTML.includes('transaction successful') ||
                        document.querySelector('[class*="success"]') ||
                        document.querySelector('[id*="success"]')) {
                      verificationSent = true;
                      window.ReactNativeWebView.postMessage(JSON.stringify({status: 'success', source: 'content'}));
                      return;
                    }
                    
                    // Other success indicators in URL
                    if (url.includes('success') || 
                        url.includes('callback') || 
                        url.includes('verify') ||
                        url.includes('transaction/verify')) {
                      verificationSent = true;
                      window.ReactNativeWebView.postMessage(JSON.stringify({status: 'success', source: 'url-pattern'}));
                    }
                  }
                  
                  // Check immediately
                  checkUrl();
                  
                  // Check on load
                  if (document.readyState === 'complete') {
                    setTimeout(checkUrl, 500);
                  } else {
                    window.addEventListener('load', function() {
                      setTimeout(checkUrl, 500);
                    });
                  }
                  
                  // Monitor URL changes
                  var originalPushState = history.pushState;
                  var originalReplaceState = history.replaceState;
                  
                  history.pushState = function() {
                    originalPushState.apply(history, arguments);
                    setTimeout(checkUrl, 200);
                  };
                  
                  history.replaceState = function() {
                    originalReplaceState.apply(history, arguments);
                    setTimeout(checkUrl, 200);
                  };
                  
                  // Monitor hash changes
                  window.addEventListener('hashchange', function() {
                    setTimeout(checkUrl, 200);
                  });
                  
                  // Monitor popstate (back/forward navigation)
                  window.addEventListener('popstate', function() {
                    setTimeout(checkUrl, 200);
                  });
                  
                  // Periodic check for success indicators (every 500ms for faster detection)
                  setInterval(checkUrl, 500);
                })();
              `}
            />
          </SafeAreaView>
        </Modal>
      )}

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => {
            const homeScreen = !isAuthenticated
              ? 'CourseRep'
              : userRole === 'course_rep'
                ? 'CourseRep'
                : 'StudentHome';
            navigation.navigate(homeScreen);
          }}
        >
          <Ionicons name="home-outline" size={24} color="#6b7280" />
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('Courses')}
        >
          <Ionicons name="book-outline" size={24} color="#6b7280" />
          <Text style={styles.navLabel}>Lectures</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('Notifications')}
        >
          <Ionicons name="notifications-outline" size={24} color="#6b7280" />
          <Text style={styles.navLabel}>Notifications</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <View style={styles.navIconContainer}>
            <Ionicons name="settings" size={24} color="#2563eb" />
            <Ionicons name="arrow-up" size={12} color="#2563eb" style={styles.navIconArrow} />
          </View>
          <Text style={[styles.navLabel, styles.navLabelActive]}>Settings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const SettingsScreen = (props) => {
  return <SettingsContent {...props} />;
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#2563eb',
  },
  header: {
    backgroundColor: '#2563eb',
    paddingTop: Platform.OS === 'android' ? 28 : 0,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  headerText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 0,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarInitial: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 2,
  },
  profileRole: {
    fontSize: 11,
    color: '#2563eb',
    fontWeight: '500',
  },
  section: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
  },
  settingDescription: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  reminderInput: {
    width: 80,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    fontSize: 12,
    color: '#111827',
    textAlign: 'center',
    backgroundColor: '#ffffff',
    fontWeight: '600',
  },
  saveButton: {
    marginTop: 24,
    marginHorizontal: 20,
  },
  logoutButton: {
    marginTop: 24,
    marginHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ef4444',
  },
  deleteAccountButton: {
    marginTop: 12,
    marginHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  deleteAccountIcon: {
    marginRight: 4,
  },
  deleteAccountText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ef4444',
  },
  versionText: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 11,
    color: '#9ca3af',
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
    paddingBottom: 20,
    paddingHorizontal: 16,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navItem: {
    alignItems: 'center',
    flex: 1,
  },
  navIconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  navIconArrow: {
    position: 'absolute',
    top: -4,
    right: -10,
  },
  navLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  navLabelActive: {
    color: '#2563eb',
    fontWeight: '600',
  },
  paymentContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  paymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'android' ? 20 : 50,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  paymentCloseButton: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  paymentInfo: {
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  paymentAmountLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  paymentAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  paymentEmail: {
    fontSize: 14,
    color: '#6b7280',
  },
  paystackContainer: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  payButton: {
    marginTop: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButtonDisabled: {
    opacity: 0.6,
  },
  payButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  paymentEmailContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 8,
  },
  paymentEmailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  paymentEmailInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  paymentEmailHint: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 6,
    fontStyle: 'italic',
  },
  paymentStatusPaid: {
    color: '#22c55e',
    fontWeight: '500',
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  paidBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  feedbackModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  feedbackModalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  feedbackModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  feedbackModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  feedbackModalCloseButton: {
    padding: 4,
  },
  feedbackModalBody: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  feedbackModalDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 20,
  },
  feedbackInputContainer: {
    marginBottom: 16,
  },
  feedbackInputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
    marginBottom: 8,
  },
  feedbackInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#f9fafb',
    minHeight: 150,
    maxHeight: 300,
  },
  feedbackCharCount: {
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'right',
    marginTop: 6,
  },
  feedbackModalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 12,
  },
  feedbackCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackCancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  feedbackSubmitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackSubmitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  feedbackButtonDisabled: {
    opacity: 0.5,
  },
  trialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  trialBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  trialInfoCard: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#93c5fd',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  trialInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  trialInfoCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e40af',
  },
  trialInfoCardText: {
    fontSize: 13,
    color: '#1e3a8a',
    lineHeight: 18,
    marginBottom: 8,
  },
  trialInfoList: {
    marginTop: 8,
    gap: 8,
  },
  trialInfoListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trialInfoListItemText: {
    fontSize: 13,
    color: '#1e3a8a',
    flex: 1,
  },
  disabledInput: {
    backgroundColor: '#f3f4f6',
    opacity: 0.6,
  },
  guestPromptContainer: {
    marginTop: 24,
    marginHorizontal: 20,
    padding: 20,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    alignItems: 'center',
  },
  guestPromptText: {
    fontSize: 14,
    color: '#1e40af',
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '500',
  },
  signUpButton: {
    minWidth: 200,
  },
  guestPaymentPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  guestPaymentPromptText: {
    flex: 1,
    fontSize: 12,
    color: '#1e40af',
    fontWeight: '500',
  },
  soundValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  soundValueText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  disabledSettingItem: {
    opacity: 0.6,
  },
  soundPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  soundPickerContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  soundPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  soundPickerHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
  },
  previewButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
  },
  soundPickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  soundPickerCloseButton: {
    padding: 4,
  },
  soundPickerBody: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  soundOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: '#f9fafb',
  },
  soundOptionSelected: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#2563eb',
  },
  soundOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  soundOptionLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  soundOptionLabelSelected: {
    color: '#2563eb',
    fontWeight: '600',
  },
  soundPickerFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  soundPickerDoneButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soundPickerDoneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default SettingsScreen;

