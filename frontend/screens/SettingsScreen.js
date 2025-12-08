import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Button from '../components/Button';
import { getApiUrl } from '../config/api';
import { PaystackProvider, usePaystack } from 'react-native-paystack-webview';

const PAYSTACK_PUBLIC_KEY = 'pk_test_5fe292bf0df872407adaebe53b5982e173a45f44';
const PAYMENT_CURRENCY = 'NGN';
const PAYMENT_AMOUNT = 15; // Fixed amount (NGN)

const SettingsContent = ({ navigation }) => {
  const [dailyNotifications, setDailyNotifications] = useState(true);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [paymentEmail, setPaymentEmail] = useState('');
  const [userPhoneNumber, setUserPhoneNumber] = useState('');
  const [userRole, setUserRole] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [hasPaid, setHasPaid] = useState(false);

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
      const userDataString = await AsyncStorage.getItem('@user_data');
      if (userDataString) {
        const userData = JSON.parse(userDataString);
        if (userData.full_name) {
          setUserName(userData.full_name);
        }
        if (userData.email) {
          setUserEmail(userData.email);
          setPaymentEmail(userData.email);
        }
        if (userData.phone_number) {
          setUserPhoneNumber(userData.phone_number);
        }
        if (userData.role) {
          setUserRole(userData.role);
        }
        if (userData.payment_status !== undefined) {
          setHasPaid(userData.payment_status === true);
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleMakePayment = async () => {
    const effectiveEmail = (paymentEmail || userEmail || '').trim();
    if (!effectiveEmail) {
      Alert.alert('Payment Error', 'Email is required to start payment. Please enter an email.');
      return;
    }
    setProcessingPayment(true);
    try {
      const token = await AsyncStorage.getItem('@auth_token');
      if (!token) {
        Alert.alert('Payment Error', 'Not authenticated. Please log in again.');
        return;
      }

      const response = await fetch(getApiUrl('payments/initiate'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: PAYMENT_AMOUNT,
          email: effectiveEmail,
          currency: PAYMENT_CURRENCY,
          metadata: {
            phone_number: userPhoneNumber,
            name: userName,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success || !data.data?.authorizationUrl || !data.data?.reference) {
        Alert.alert('Payment Error', data.message || 'Unable to start payment. Please try again.');
        return;
      }

      // Trigger Paystack checkout within app
      checkout({
        email: effectiveEmail,
        amount: PAYMENT_AMOUNT * 100, // Paystack expects lowest currency unit
        reference: data.data.reference,
        metadata: {
          phone_number: userPhoneNumber,
          name: userName,
        },
      });
    } catch (error) {
      console.error('Payment initiation error:', error);
      Alert.alert('Payment Error', 'Something went wrong while starting the payment.');
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleVerifyPayment = async (reference) => {
    if (!reference) {
      Alert.alert('Payment Error', 'Missing payment reference for verification.');
      return;
    }
    try {
      const token = await AsyncStorage.getItem('@auth_token');
      if (!token) {
        Alert.alert('Payment Error', 'Not authenticated. Please log in again.');
        return;
      }
      const verifyResponse = await fetch(getApiUrl(`payments/verify/${reference}`), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const verifyData = await verifyResponse.json();
      if (!verifyResponse.ok || !verifyData.success) {
        Alert.alert('Payment Error', verifyData.message || 'Unable to verify payment.');
        return;
      }

      const status = verifyData.data?.status;
      if (status === 'success') {
        // Persist paid flag locally
        const userDataString = await AsyncStorage.getItem('@user_data');
        if (userDataString) {
          const userData = JSON.parse(userDataString);
          userData.payment_status = true;
          await AsyncStorage.setItem('@user_data', JSON.stringify(userData));
        }
        setHasPaid(true);
        Alert.alert('Payment Successful', 'Your payment was successful.');
      } else {
        Alert.alert('Payment Pending', 'Payment not completed yet. Please try again.');
      }
    } catch (error) {
      console.error('Payment verify error:', error);
      Alert.alert('Payment Error', 'Something went wrong while verifying the payment.');
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

 

  const paystack = usePaystack();

  const checkout = (params) => {
    paystack?.popup?.checkout({
      ...params,
      onCancel: () => {
        setProcessingPayment(false);
      },
      onSuccess: (result) => {
        const ref = result?.reference || result?.transactionRef?.reference || params.reference;
        handleVerifyPayment(ref);
      },
    });
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
              <Text style={styles.settingLabel}>Daily Notifications</Text>
            </View>
            <Switch
              value={dailyNotifications}
              onValueChange={setDailyNotifications}
              trackColor={{ false: '#d1d5db', true: '#22c55e' }}
              thumbColor="#ffffff"
            />
          </View>
        </View>

        {/* Payment Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Make Payment</Text>

          <View style={styles.paymentContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Amount</Text>
              <View style={styles.amountDisplay}>
                <Text style={styles.amountText}>NGN {PAYMENT_AMOUNT.toFixed(2)}</Text>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Payment Email</Text>
              <TextInput
                style={styles.emailInput}
                placeholder="Enter email for receipt"
                value={paymentEmail}
                onChangeText={setPaymentEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.paymentMethodDisplay}>
                <Ionicons name="phone-portrait-outline" size={20} color="#2563eb" />
                <Text style={styles.paymentMethodLabel}>Mobile Money</Text>
              </View>
            </View>

            {hasPaid ? (
              <View style={styles.paidStatusContainer}>
                <View style={styles.paidStatusBadge}>
                  <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                  <Text style={styles.paidStatusText}>Paid</Text>
                </View>
              </View>
            ) : (
              <Button
                title={processingPayment ? 'Processing...' : 'Make Payment'}
                onPress={handleMakePayment}
                variant="primary"
                style={styles.paymentButton}
                disabled={processingPayment}
              />
            )}
          </View>
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
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>Version 1.0.0</Text>
      </ScrollView>

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
  return (
    <PaystackProvider publicKey={PAYSTACK_PUBLIC_KEY} currency={PAYMENT_CURRENCY} defaultChannels={['card']}>
      <SettingsContent {...props} />
    </PaystackProvider>
  );
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
  settingLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
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
    paddingVertical: 8,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 8,
  },
  amountDisplay: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  amountText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  emailInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
  },
  paymentMethodDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
    gap: 8,
  },
  paymentMethodLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2563eb',
  },
  paymentButton: {
    marginTop: 8,
    width: '100%',
  },
  paidStatusContainer: {
    marginTop: 8,
    width: '100%',
  },
  paidStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#22c55e',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  paidStatusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16a34a',
  },
});

export default SettingsScreen;

