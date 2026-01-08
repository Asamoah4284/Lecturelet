import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from '../config/api';
import Button from '../components/Button';
import { initializeNotifications } from '../services/notificationService';
import { getTrialStatus, hasActiveAccess } from '../utils/trialHelpers';

const StudentAddCourseScreen = ({ navigation }) => {
  const [uniqueCode, setUniqueCode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [course, setCourse] = useState(null);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState('');
  const [hasPaid, setHasPaid] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [trialStatus, setTrialStatus] = useState(null);
  const [enrollmentCount, setEnrollmentCount] = useState(0);
  const [showTrialInfoModal, setShowTrialInfoModal] = useState(false);

  const formatDays = (days) => {
    if (!days || !Array.isArray(days)) return 'N/A';
    return days.join(', ');
  };

  const formatTime = (startTime, endTime) => {
    if (!startTime || !endTime) return 'N/A';
    return `${startTime} - ${endTime}`;
  };

  // Load auth and Access status on mount and when screen comes into focus
  useEffect(() => {
    loadAuthStatus();
    loadUserData();
    loadEnrollmentCount();
    const unsubscribe = navigation.addListener('focus', () => {
      loadAuthStatus();
      loadUserData();
      loadEnrollmentCount();
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
      const userDataString = await AsyncStorage.getItem('@user_data');
      if (userDataString) {
        const userData = JSON.parse(userDataString);
        setHasPaid(userData.payment_status === true);
        const status = getTrialStatus(userData);
        setTrialStatus(status);
      } else {
        setTrialStatus(null);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      setTrialStatus(null);
    }
  };

  const loadEnrollmentCount = async () => {
    try {
      const token = await AsyncStorage.getItem('@auth_token');
      if (!token) {
        setEnrollmentCount(0);
        return;
      }

      const response = await fetch(getApiUrl('enrollments/my-courses'), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setEnrollmentCount(data.data.courses?.length || 0);
      } else {
        setEnrollmentCount(0);
      }
    } catch (error) {
      console.error('Error loading enrollment count:', error);
      setEnrollmentCount(0);
    }
  };

  const handleSubmitCode = async () => {
    if (!uniqueCode.trim()) {
      Alert.alert('Validation Error', 'Please enter a course code');
      return;
    }

    setLoading(true);
    setError('');
    setCourse(null);
    setIsEnrolled(false);

    try {
      const token = await AsyncStorage.getItem('@auth_token');
      const headers = {
        'Content-Type': 'application/json',
      };
      
      // Add auth header only if token exists (for guest preview)
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(getApiUrl(`courses/code/${uniqueCode.trim().toUpperCase()}`), {
        method: 'GET',
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle validation errors
        if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
          const errorMessages = data.errors.map(err => err.message || err.msg).join(', ');
          throw new Error(errorMessages || data.message || 'Validation failed');
        }
        throw new Error(data.message || 'Course not found. Please check the code and try again.');
      }

      if (data.success && data.data) {
        setCourse(data.data.course);
        setIsEnrolled(data.data.isEnrolled || false);
        if (data.data.isEnrolled) {
          Alert.alert('Already Enrolled', 'You are already enrolled in this course.');
        }
      } else {
        throw new Error('Failed to fetch course details.');
      }
    } catch (err) {
      setError(err.message || 'An error occurred. Please try again.');
      Alert.alert('Error', err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async () => {
    if (!course || !uniqueCode.trim()) {
      return;
    }

    // Check if user is authenticated (guest mode check)
    if (!isAuthenticated) {
      Alert.alert(
        'Sign Up Required',
        'You need to create an account to enroll in courses. Would you like to sign up now?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Sign Up',
            onPress: () => navigation.navigate('Signup'),
          },
        ]
      );
      return;
    }

    // Check if user has active access (payment OR active trial)
    const userDataString = await AsyncStorage.getItem('@user_data');
    let userData = null;
    if (userDataString) {
      userData = JSON.parse(userDataString);
    }

    const hasAccess = hasActiveAccess(
      userData?.payment_status || false,
      userData?.trial_end_date
    );

    // If no access and has enrollments, trial expired - require payment
    if (!hasAccess && enrollmentCount > 0) {
      Alert.alert(
        'Trial Expired',
        'Your 7-day free trial has ended. Please make a payment to continue enrolling in courses and receiving notifications.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Make Payment',
            onPress: () => navigation.navigate('Settings'),
          },
        ]
      );
      return;
    }

    // If no access and no enrollments, trial will start automatically on enrollment
    // (handled by backend)

    setEnrolling(true);
    setError('');

    try {
      const token = await AsyncStorage.getItem('@auth_token');
      if (!token) {
        throw new Error('Not authenticated. Please log in again.');
      }

      const response = await fetch(getApiUrl('enrollments/join'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          uniqueCode: uniqueCode.trim().toUpperCase(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle validation errors
        if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
          const errorMessages = data.errors.map(err => err.message || err.msg).join(', ');
          throw new Error(errorMessages || data.message || 'Validation failed');
        }
        throw new Error(data.message || 'Failed to enroll in course. Please try again.');
      }

      if (data.success) {
        // Register push token after successful enrollment
        await initializeNotifications();
        
        // Reload user data to get updated trial status
        if (data.data?.trial?.started) {
          // Fetch updated user profile
          try {
            const profileResponse = await fetch(getApiUrl('auth/profile'), {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            });
            const profileData = await profileResponse.json();
            if (profileData.success && profileData.data?.user) {
              await AsyncStorage.setItem('@user_data', JSON.stringify(profileData.data.user));
              loadUserData();
            }
          } catch (err) {
            console.error('Error updating user data:', err);
          }
        }
        
        Alert.alert(
          'Success',
          data.message || 'Successfully enrolled in course!',
          [
            {
              text: 'OK',
              onPress: () => {
                // Navigate to courses screen to show the newly enrolled course
                navigation.navigate('StudentCourses');
              },
            },
          ]
        );
      } else {
        throw new Error(data.message || 'Failed to enroll in course.');
      }
    } catch (err) {
      setError(err.message || 'An error occurred. Please try again.');
      Alert.alert('Enrollment Failed', err.message || 'An error occurred. Please try again.');
    } finally {
      setEnrolling(false);
    }
  };

  const handleAddCourse = () => {
    // Handle add course action
    console.log('Adding course');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* Blue Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Course</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Enter Unique Course Code Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Enter Unique Course Code</Text>
          <Text style={styles.sectionDescription}>
            Enter the unique course code provided by your course representative
          </Text>
          <View style={styles.codeInputContainer}>
            <TextInput
              style={styles.codeInput}
              placeholder="Enter unique code (e.g., 12345)"
              value={uniqueCode}
              onChangeText={setUniqueCode}
              placeholderTextColor="#9ca3af"
              maxLength={5}
            />
            <TouchableOpacity
              style={[styles.submitCodeButton, loading && styles.submitCodeButtonDisabled]}
              onPress={handleSubmitCode}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#6b7280" />
              ) : (
                <Ionicons name="arrow-forward" size={20} color="#6b7280" />
              )}
            </TouchableOpacity>
          </View>
          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </View>

        {/* Course Details Card */}
        {course && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Course Details</Text>
            <View style={styles.courseCard}>
              <View style={styles.courseContent}>
                <View style={styles.courseHeader}>
                  <View style={styles.courseIconContainer}>
                    <Ionicons name="book" size={24} color="#2563eb" />
                  </View>
                  <View style={styles.courseInfo}>
                    <Text style={styles.courseName}>{course.course_name}</Text>
                    <Text style={styles.courseCode}>{course.course_code}</Text>
                  </View>
                  <View style={styles.codeBadge}>
                    <Text style={styles.codeBadgeText}>{course.unique_code}</Text>
                  </View>
                </View>
                <View style={styles.courseDetails}>
                  <View style={styles.detailRow}>
                    <Ionicons name="time-outline" size={16} color="#6b7280" />
                    <Text style={styles.detailText}>
                      {formatTime(course.start_time, course.end_time)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="calendar-outline" size={16} color="#6b7280" />
                    <Text style={styles.detailText}>{formatDays(course.days)}</Text>
                  </View>
                  {course.venue && (
                    <View style={styles.detailRow}>
                      <Ionicons name="location-outline" size={16} color="#6b7280" />
                      <Text style={styles.detailText}>{course.venue}</Text>
                    </View>
                  )}
                  {course.creator_name && (
                    <View style={styles.detailRow}>
                      <Ionicons name="person-outline" size={16} color="#6b7280" />
                      <Text style={styles.detailText}>Rep: {course.creator_name}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.courseFooter}>
                  <View style={styles.studentCount}>
                    <Ionicons name="people-outline" size={16} color="#6b7280" />
                    <Text style={styles.studentCountText}>
                      {course.student_count || 0} {course.student_count === 1 ? 'student' : 'students'}
                    </Text>
                  </View>
                </View>
              </View>
              {/* Trial or Payment Message */}
              {!isAuthenticated ? null : !hasActiveAccess(hasPaid, trialStatus?.trialEndDate) && enrollmentCount > 0 ? (
                <View style={styles.paymentMessageContainer}>
                  <Ionicons name="alert-circle-outline" size={20} color="#f59e0b" />
                  <View style={styles.paymentMessageTextContainer}>
                    <Text style={styles.paymentMessageTitle}>Trial Expired</Text>
                    <Text style={styles.paymentMessageText}>
                      Your 7-day free trial has ended. Make a payment to continue enrolling and receiving notifications.
                    </Text>
                  </View>
                </View>
              ) : !hasActiveAccess(hasPaid, trialStatus?.trialEndDate) && enrollmentCount === 0 ? (
                <View style={styles.trialMessageContainer}>
                  <Ionicons name="gift-outline" size={20} color="#2563eb" />
                  <View style={styles.trialMessageTextContainer}>
                    <Text style={styles.trialMessageTitle}>Start Your 7-Day Free Trial</Text>
                    <Text style={styles.trialMessageText}>
                      Enroll now to start your free trial. After 7 days, payment is required to continue receiving notifications.
                    </Text>
                    <TouchableOpacity
                      style={styles.trialInfoLink}
                      onPress={() => setShowTrialInfoModal(true)}
                    >
                      <Text style={styles.trialInfoLinkText}>Learn more about the trial</Text>
                      <Ionicons name="chevron-forward" size={16} color="#2563eb" />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
              <Button
                title={
                  !isAuthenticated
                    ? 'Sign Up to Enroll'
                    : enrolling
                    ? 'Enrolling...'
                    : isEnrolled
                    ? 'Already Enrolled'
                    : !hasActiveAccess(hasPaid, trialStatus?.trialEndDate) && enrollmentCount === 0
                    ? 'Start Your 7-Day Free Trial'
                    : !hasActiveAccess(hasPaid, trialStatus?.trialEndDate) && enrollmentCount > 0
                    ? 'Payment Required'
                    : 'Enroll in Course'
                }
                onPress={
                  !isAuthenticated
                    ? () => navigation.navigate('Signup')
                    : !hasActiveAccess(hasPaid, trialStatus?.trialEndDate) && enrollmentCount > 0
                    ? () => navigation.navigate('Settings')
                    : handleEnroll
                }
                variant={
                  !isAuthenticated || (!hasActiveAccess(hasPaid, trialStatus?.trialEndDate) && enrollmentCount > 0)
                    ? 'secondary'
                    : 'primary'
                }
                style={styles.enrollButton}
                disabled={enrolling || isEnrolled}
              />
            </View>
          </View>
        )}

  
      </ScrollView>

      {/* Trial Info Modal */}
      <Modal
        visible={showTrialInfoModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTrialInfoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>7-Day Free Trial</Text>
              <TouchableOpacity
                onPress={() => setShowTrialInfoModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.trialInfoSection}>
                <View style={styles.trialInfoIconContainer}>
                  <Ionicons name="gift" size={48} color="#2563eb" />
                </View>
                <Text style={styles.trialInfoHeading}>What's Included</Text>
                <Text style={styles.trialInfoText}>
                  Your 7-day free trial gives you full access to:
                </Text>
                <View style={styles.trialFeaturesList}>
                  <View style={styles.trialFeatureItem}>
                    <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                    <Text style={styles.trialFeatureText}>Enroll in unlimited courses</Text>
                  </View>
                  <View style={styles.trialFeatureItem}>
                    <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                    <Text style={styles.trialFeatureText}>Receive push notifications</Text>
                  </View>
                  <View style={styles.trialFeatureItem}>
                    <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                    <Text style={styles.trialFeatureText}>Access all course materials</Text>
                  </View>
                  <View style={styles.trialFeatureItem}>
                    <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                    <Text style={styles.trialFeatureText}>View schedules and timetables</Text>
                  </View>
                </View>
              </View>

              <View style={styles.trialInfoSection}>
                <Text style={styles.trialInfoHeading}>After 7 Days</Text>
                <Text style={styles.trialInfoText}>
                  Once your trial ends, you'll need to make a payment (GH₵20) to continue:
                </Text>
                <View style={styles.trialWarningList}>
                  <View style={styles.trialWarningItem}>
                    <Ionicons name="notifications-off" size={20} color="#f59e0b" />
                    <Text style={styles.trialWarningText}>Notifications will stop</Text>
                  </View>
                  <View style={styles.trialWarningItem}>
                    <Ionicons name="lock-closed" size={20} color="#f59e0b" />
                    <Text style={styles.trialWarningText}>Home screen will be locked</Text>
                  </View>
                  <View style={styles.trialWarningItem}>
                    <Ionicons name="ban" size={20} color="#f59e0b" />
                    <Text style={styles.trialWarningText}>Cannot enroll in new courses</Text>
                  </View>
                </View>
                <Text style={styles.trialInfoNote}>
                  Make a payment before your trial ends to avoid any interruption in service.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button
                title="Got It"
                onPress={() => setShowTrialInfoModal(false)}
                variant="primary"
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2563eb',
  },
  header: {
    backgroundColor: '#2563eb',
    paddingTop: Platform.OS === 'android' ? 28 : 0,
    paddingBottom: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 12,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  headerSpacer: {
    width: 36,
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 18,
  },
  codeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  codeInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1f2937',
  },
  submitCodeButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  submitCodeButtonDisabled: {
    opacity: 0.6,
  },
  errorContainer: {
    marginTop: 12,
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 8,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
    textAlign: 'center',
  },
  courseCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  courseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  courseIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  courseInfo: {
    flex: 1,
  },
  courseName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  courseCode: {
    fontSize: 13,
    color: '#6b7280',
  },
  codeBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  codeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  courseDetails: {
    marginBottom: 16,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    color: '#6b7280',
  },
  courseFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  studentCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  studentCountText: {
    fontSize: 13,
    color: '#6b7280',
  },
  enrollButton: {
    marginTop: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1f2937',
    padding: 0,
  },
  searchHint: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
  },
  bottomButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  addCourseButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCourseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  paymentMessageContainer: {
    flexDirection: 'row',
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    alignItems: 'flex-start',
    gap: 10,
  },
  paymentMessageTextContainer: {
    flex: 1,
  },
  paymentMessageTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 4,
  },
  paymentMessageText: {
    fontSize: 12,
    color: '#78350f',
    lineHeight: 16,
  },
  courseContent: {
    position: 'relative',
    minHeight: 200,
  },
  courseContentBlurred: {
    opacity: 0.25,
  },
  blurOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  blurMessageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  blurMessageTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  blurMessageText: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 18,
  },
  trialMessageContainer: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#93c5fd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    alignItems: 'flex-start',
    gap: 10,
  },
  trialMessageTextContainer: {
    flex: 1,
  },
  trialMessageTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 4,
  },
  trialMessageText: {
    fontSize: 12,
    color: '#1e3a8a',
    lineHeight: 16,
    marginBottom: 8,
  },
  trialInfoLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trialInfoLinkText: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  trialInfoSection: {
    marginBottom: 24,
  },
  trialInfoIconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  trialInfoHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  trialInfoText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  trialFeaturesList: {
    gap: 10,
    marginBottom: 8,
  },
  trialFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trialFeatureText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  trialWarningList: {
    gap: 10,
    marginBottom: 12,
  },
  trialWarningItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trialWarningText: {
    fontSize: 14,
    color: '#92400e',
    flex: 1,
  },
  trialInfoNote: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 8,
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  modalButton: {
    width: '100%',
  },
});

export default StudentAddCourseScreen;

