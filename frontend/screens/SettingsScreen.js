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

const SettingsContent = ({ navigation }) => {
  const webViewRef = useRef(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [reminderMinutes, setReminderMinutes] = useState('15');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPhoneNumber, setUserPhoneNumber] = useState('');
  const [userRole, setUserRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(false);
  
  // Payment states
  const [showPayment, setShowPayment] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentEmail, setPaymentEmail] = useState('');
  const FIXED_PAYMENT_AMOUNT = 20; // Fixed payment amount in GHS

  // Feedback states
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Load user data on mount
  useEffect(() => {
    loadUserData();
  }, []);

  // Reload user data when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadUserData();
    });
    return unsubscribe;
  }, [navigation]);

  const loadUserData = async () => {
    try {
      const token = await AsyncStorage.getItem('@auth_token');
      if (!token) return;

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
        if (userData.payment_status !== undefined) {
          setPaymentStatus(userData.payment_status);
        }
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
        // Update AsyncStorage with latest user data including payment status
        await AsyncStorage.setItem('@user_data', JSON.stringify(user));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleSaveSettings = async () => {
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

      const response = await fetch(getApiUrl('auth/profile'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          notificationsEnabled,
          reminderMinutes: reminderMinutesNum,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Update local storage
        const userDataString = await AsyncStorage.getItem('@user_data');
        if (userDataString) {
          const userData = JSON.parse(userDataString);
          userData.notifications_enabled = notificationsEnabled;
          userData.reminder_minutes = reminderMinutesNum;
          await AsyncStorage.setItem('@user_data', JSON.stringify(userData));
        }

        // Initialize or remove notifications based on preference
        if (notificationsEnabled) {
          await initializeNotifications();
          // Rebuild local reminder notifications with new preference
          await syncAndScheduleReminders(reminderMinutesNum);
        } else {
          await removePushToken();
          // Cancel all local reminders if notifications are disabled
          await cancelAllReminders();
        }

        Alert.alert('Success', 'Settings saved successfully');
      } else {
        Alert.alert('Error', data.message || 'Failed to save settings');
      }
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
                routes: [{ name: 'CourseList' }],
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

  // Payment initialization handler
  const handleInitializePayment = async () => {
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
        
        // Update payment status immediately for instant UI feedback
        setPaymentStatus(true);
        
        // Update AsyncStorage immediately with payment status
        const userDataString = await AsyncStorage.getItem('@user_data');
        if (userDataString) {
          const userData = JSON.parse(userDataString);
          userData.payment_status = true;
          await AsyncStorage.setItem('@user_data', JSON.stringify(userData));
        }
        
        // Update user data from backend to reflect payment status (this will refresh the UI)
        await loadUserData();
        
        // Clear payment data
        setPaymentData(null);
        setIsProcessingPayment(false);
        
        Alert.alert(
          'Payment Successful! 🎉',
          `Your payment of GH₵${paymentData.amount} has been processed successfully! Your payment status has been updated.`,
          [{ 
            text: 'OK',
            onPress: () => {
              // Payment status is already updated, UI will show "Paid" status
            }
          }]
        );
      } else {
        console.error('Payment verification failed after retries:', verifyData);
        setIsProcessingPayment(false);
        Alert.alert(
          'Payment Verification Failed', 
          verifyData.error || verifyData.message || verifyData.details || 'Payment verification failed. The payment may still be processing. Please check your payment status in a few moments.',
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
  const handleSubmitFeedback = async () => {
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
        console.log('Payment success message received, verifying automatically...');
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
            <Text style={styles.avatarInitial}>{getInitial()}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{userName || 'User'}</Text>
            <Text style={styles.profileEmail}>{userPhoneNumber || 'No phone number'}</Text>
            <Text style={styles.profileRole}>{getRoleDisplayName(userRole)}</Text>
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('RoleSelect')}>
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
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#d1d5db', true: '#22c55e' }}
              thumbColor="#ffffff"
            />
          </View>

          {notificationsEnabled && (
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
                style={styles.reminderInput}
                value={reminderMinutes}
                onChangeText={setReminderMinutes}
                keyboardType="numeric"
                placeholder="15"
                placeholderTextColor="#9ca3af"
                maxLength={3}
              />
            </View>
          )}
        </View>

        {/* Payment Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment</Text>

          {/* Payment Status */}
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons 
                name={paymentStatus ? "checkmark-circle" : "alert-circle"} 
                size={20} 
                color={paymentStatus ? "#22c55e" : "#f59e0b"} 
              />
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Payment Status</Text>
                <Text style={[styles.settingDescription, paymentStatus && styles.paymentStatusPaid]}>
                  {paymentStatus ? 'Paid' : 'Not Paid - Payment required for course enrollment'}
                </Text>
              </View>
            </View>
            {paymentStatus && (
              <View style={styles.paidBadge}>
                <Ionicons name="checkmark" size={16} color="#ffffff" />
                <Text style={styles.paidBadgeText}>Paid</Text>
              </View>
            )}
          </View>

          {!paymentStatus && (
            <>
              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <Ionicons name="card-outline" size={20} color="#6b7280" />
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Make Payment</Text>
                    <Text style={styles.settingDescription}>
                      Pay GH₵{FIXED_PAYMENT_AMOUNT} for course enrollment and services
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.paymentEmailContainer}>
                <Text style={styles.paymentEmailLabel}>Email Address</Text>
                <TextInput
                  style={styles.paymentEmailInput}
                  value={paymentEmail}
                  onChangeText={setPaymentEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder={userEmail || "Enter your email address"}
                  placeholderTextColor="#9ca3af"
                />
                {userEmail && (
                  <Text style={styles.paymentEmailHint}>
                    Using profile email: {userEmail}
                  </Text>
                )}
              </View>

              <TouchableOpacity
                style={[styles.payButton, isProcessingPayment && styles.payButtonDisabled]}
                onPress={handleInitializePayment}
                disabled={isProcessingPayment}
              >
                {isProcessingPayment ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.payButtonText}>Pay GH₵{FIXED_PAYMENT_AMOUNT}</Text>
                )}
              </TouchableOpacity>
            </>
          )}
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

        {/* Help Us Get Better Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Help Us Get Better</Text>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => setShowFeedbackModal(true)}
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

        {/* Save Settings Button */}
        <Button
          title={saving ? "Saving..." : "Save Settings"}
          onPress={handleSaveSettings}
          variant="primary"
          style={styles.saveButton}
          disabled={saving}
        />

        {/* Logout Button + Version */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

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
              <Text style={styles.paymentTitle}>Complete Payment</Text>
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
                    if (bodyText.includes('payment successful') || 
                        bodyText.includes('transaction successful') ||
                        bodyText.includes('you paid') ||
                        bodyHTML.includes('payment successful') ||
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
            const homeScreen = userRole === 'course_rep' ? 'CourseRep' : 'StudentHome';
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
          <Text style={styles.navLabel}>Courses</Text>
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
});

export default SettingsScreen;

