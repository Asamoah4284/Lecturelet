import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import Button from '../components/Button';
import { getApiUrl } from '../config/api';

const CourseRepScreen = ({ navigation }) => {
  const [userName, setUserName] = useState('Course Rep');
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [notificationType, setNotificationType] = useState(null); // 'quiz' or 'assignment'
  const [quizTitle, setQuizTitle] = useState('');
  const [quizDate, setQuizDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [quizTime, setQuizTime] = useState('');
  const [quizVenue, setQuizVenue] = useState('');
  const [assignmentTitle, setAssignmentTitle] = useState('');
  const [assignmentDescription, setAssignmentDescription] = useState('');
  const [sendingNotification, setSendingNotification] = useState(false);

  // Load user data and courses on mount
  useEffect(() => {
    loadUserData();
    loadCourses();
  }, []);

  // Reload courses when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadCourses();
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
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadCourses = async () => {
    try {
      const token = await AsyncStorage.getItem('@auth_token');
      if (!token) {
        setLoading(false);
        return;
      }

      // Check user role before making API call
      const userDataString = await AsyncStorage.getItem('@user_data');
      if (userDataString) {
        const userData = JSON.parse(userDataString);
        if (userData.role !== 'course_rep') {
          // User is not a course rep, don't make the API call
          setLoading(false);
          setRefreshing(false);
          return;
        }
      }

      const response = await fetch(getApiUrl('courses/my-courses'), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setCourses(data.data.courses || []);
      } else {
        // Only log error if it's not a permission error (403)
        if (response.status !== 403) {
          console.error('Error loading courses:', data.message);
        }
      }
    } catch (error) {
      console.error('Error loading courses:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadCourses();
  };

  const handleNotificationPress = (course) => {
    setSelectedCourse(course);
    setShowNotificationModal(true);
    setNotificationType(null);
    // Reset form fields
    setQuizTitle('');
    setQuizDate(new Date());
    setQuizTime('');
    setQuizVenue('');
    setAssignmentTitle('');
    setAssignmentDescription('');
    setShowDatePicker(false);
  };

  const closeNotificationModal = () => {
    setShowNotificationModal(false);
    setSelectedCourse(null)
    setNotificationType(null);
    setQuizTitle('');
    setQuizDate(new Date());
    setQuizTime('');
    setQuizVenue('');
    setAssignmentTitle('');
    setAssignmentDescription('');
    setShowDatePicker(false);
  };

  const formatDate = (date) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const dayName = days[date.getDay()];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    return `${dayName}, ${month} ${day}, ${year}`;
  };

  const formatDateShort = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || quizDate;
    setShowDatePicker(Platform.OS === 'ios');
    
    if (Platform.OS === 'android') {
      if (event.type === 'set' && selectedDate) {
        setQuizDate(selectedDate);
      }
      setShowDatePicker(false);
    } else {
      // iOS
      if (selectedDate) {
        setQuizDate(selectedDate);
      }
    }
  };

  const sendNotification = async () => {
    if (!selectedCourse) return;

    let title = '';
    let message = '';

    if (notificationType === 'quiz') {
      if (!quizTitle.trim() || !quizTime.trim() || !quizVenue.trim()) {
        Alert.alert('Error', 'Please fill in all quiz fields');
        return;
      }
      title = `Quiz: ${quizTitle}`;
      const formattedDate = formatDate(quizDate);
      message = `A quiz has been scheduled for ${quizTitle}.\n\nDate: ${formattedDate}\nTime: ${quizTime}\nVenue: ${quizVenue}`;
    } else if (notificationType === 'assignment') {
      if (!assignmentTitle.trim() || !assignmentDescription.trim()) {
        Alert.alert('Error', 'Please fill in all assignment fields');
        return;
      }
      title = `Assignment: ${assignmentTitle}`;
      message = assignmentDescription;
    } else {
      Alert.alert('Error', 'Please select a notification type');
      return;
    }

    try {
      setSendingNotification(true);
      const token = await AsyncStorage.getItem('@auth_token');
      if (!token) {
        Alert.alert('Error', 'Authentication required');
        return;
      }

      const courseId = selectedCourse.id || selectedCourse._id;
      const response = await fetch(getApiUrl('notifications/send'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          courseId,
          title,
          message,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        Alert.alert(
          'Success',
          `Notification sent to ${data.data.recipientCount} students`,
          [
            {
              text: 'OK',
              onPress: closeNotificationModal,
            },
          ]
        );
      } else {
        Alert.alert('Error', data.message || 'Failed to send notification');
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      Alert.alert('Error', 'Failed to send notification. Please try again.');
    } finally {
      setSendingNotification(false);
    }
  };

  const formatDays = (days) => {
    if (!days || !Array.isArray(days)) return 'N/A';
    return days.join(', ');
  };

  const formatTime = (startTime, endTime) => {
    if (!startTime || !endTime) return 'N/A';
    return `${startTime} - ${endTime}`;
  };

  // Get current date
  const getCurrentDate = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = days[date.getDay()];
    return `${year}-${month}-${day} • ${dayName}`;
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      
      {/* Blue Header */}
      <View style={styles.header} />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Greeting Section */}
        <View style={styles.greetingRow}>
          <View style={styles.greetingLeft}>
            <Text style={styles.greeting}>Hello, {userName}</Text>
            <Text style={styles.roleText}>Course Representative</Text>
            <View style={styles.dateRow}>
              <Ionicons name="calendar-outline" size={16} color="#2563eb" style={styles.calendarIcon} />
              <Text style={styles.dateText}>{getCurrentDate()}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('AddCourse')}>
            <Ionicons name="add" size={28} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Published Courses</Text>
          {courses.length > 0 && (
            <TouchableOpacity onPress={() => navigation.navigate('Courses')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Loading State */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loadingText}>Loading courses...</Text>
          </View>
        ) : courses.length > 0 ? (
          /* Courses List */
          <View style={styles.coursesList}>
            {courses.slice(0, 5).map((course) => {
              // Map backend field names to frontend format
              const courseForEdit = {
                id: course.id || course._id,
                courseName: course.course_name || course.courseName,
                courseCode: course.course_code || course.courseCode,
                days: course.days || [],
                startTime: course.start_time || course.startTime,
                endTime: course.end_time || course.endTime,
                venue: course.venue,
                creditHours: course.credit_hours || course.creditHours,
                indexFrom: course.index_from || course.indexFrom,
                indexTo: course.index_to || course.indexTo,
                courseRepName: course.course_rep_name || course.courseRepName,
                uniqueCode: course.unique_code || course.uniqueCode,
                dayTimes: course.day_times || course.dayTimes, // Per-day times from backend
              };
              
              return (
                <View key={course.id || course._id} style={styles.courseCardContainer}>
                  <View style={styles.courseCard}>
                    <View style={styles.courseCardContent}>
                      <View style={styles.courseIconContainer}>
                        <Ionicons name="book" size={20} color="#2563eb" />
                      </View>
                      <View style={styles.courseInfo}>
                        <Text style={styles.courseName} numberOfLines={1}>
                          {course.course_name || course.courseName}
                        </Text>
                        <Text style={styles.courseCode}>{course.course_code || course.courseCode}</Text>
                      </View>
                      <View style={styles.codeBadge}>
                        <Text style={styles.codeBadgeText}>{course.unique_code || course.uniqueCode}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => navigation.navigate('AddCourse', { course: courseForEdit })}
                    >
                      <Ionicons name="create-outline" size={18} color="#2563eb" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.notificationButton}
                      onPress={() => handleNotificationPress(course)}
                    >
                      <Ionicons name="notifications-outline" size={18} color="#2563eb" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
            {courses.length > 5 && (
              <TouchableOpacity
                style={styles.seeMoreButton}
                onPress={() => navigation.navigate('Courses')}
              >
                <Text style={styles.seeMoreText}>
                  View all {courses.length} courses
                </Text>
                <Ionicons name="chevron-forward" size={20} color="#2563eb" />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          /* Empty State */
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <View style={styles.documentIcon}>
                <Ionicons name="document-text" size={60} color="#ffffff" />
                <View style={styles.questionMarkContainer}>
                  <Ionicons name="help-circle" size={32} color="#ffffff" />
                </View>
              </View>
            </View>
            <Text style={styles.emptyTitle}>No Courses Published</Text>
            <Text style={styles.emptyDescription}>
              You haven't published any courses yet. Create your first course to get started.
            </Text>
            <Button
              title="Create Course"
              onPress={() => navigation.navigate('AddCourse')}
              variant="primary"
              style={styles.createButton}
            />
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.replace('CourseRep')}
        >
          <View style={styles.navIconContainer}>
            <Ionicons name="home" size={24} color="#2563eb" />
            <Ionicons name="arrow-up" size={12} color="#2563eb" style={styles.navIconArrow} />
          </View>
          <Text style={[styles.navLabel, styles.navLabelActive]}>Home</Text>
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
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('Settings')}
        >
          <Ionicons name="settings-outline" size={24} color="#6b7280" />
          <Text style={styles.navLabel}>Settings</Text>
        </TouchableOpacity>
      </View>

      {/* Notification Modal */}
      <Modal
        visible={showNotificationModal}
        transparent={true}
        animationType="slide"
        onRequestClose={closeNotificationModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Send Notification</Text>
              <TouchableOpacity onPress={closeNotificationModal}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {!notificationType ? (
              <View style={styles.notificationTypeContainer}>
                <Text style={styles.modalSubtitle}>
                  Select notification type for {selectedCourse?.course_name || selectedCourse?.courseName}
                </Text>
                <TouchableOpacity
                  style={styles.typeButton}
                  onPress={() => setNotificationType('quiz')}
                  activeOpacity={0.7}
                >
                  <View style={styles.typeButtonCard}>
                    <View style={[styles.typeButtonIcon, styles.quizIconContainer]}>
                      <Ionicons name="document-text" size={22} color="#ffffff" />
                    </View>
                    <View style={styles.typeButtonContent}>
                      <Text style={styles.typeButtonTitle}>Quiz</Text>
                      <Text style={styles.typeButtonDescription}>
                        Notify students about an upcoming quiz with date, time, and venue
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.typeButton}
                  onPress={() => setNotificationType('assignment')}
                  activeOpacity={0.7}
                >
                  <View style={styles.typeButtonCard}>
                    <View style={[styles.typeButtonIcon, styles.assignmentIconContainer]}>
                      <Ionicons name="clipboard" size={22} color="#ffffff" />
                    </View>
                    <View style={styles.typeButtonContent}>
                      <Text style={styles.typeButtonTitle}>Assignment</Text>
                      <Text style={styles.typeButtonDescription}>
                        Notify students about a new assignment
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                  </View>
                </TouchableOpacity>
              </View>
            ) : notificationType === 'quiz' ? (
              <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
                <Text style={styles.formLabel}>Quiz Title *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g., Midterm Exam, Chapter 5 Quiz"
                  value={quizTitle}
                  onChangeText={setQuizTitle}
                  placeholderTextColor="#9ca3af"
                />

                <Text style={styles.formLabel}>Date *</Text>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <View style={styles.datePickerContent}>
                    <Ionicons name="calendar-outline" size={20} color="#2563eb" />
                    <Text style={styles.datePickerText}>
                      {formatDate(quizDate)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                </TouchableOpacity>
                {showDatePicker && (
                  <View>
                    <DateTimePicker
                      value={quizDate}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'inline' : 'default'}
                      onChange={handleDateChange}
                      minimumDate={new Date()}
                    />
                    {Platform.OS === 'ios' && (
                      <TouchableOpacity
                        style={styles.iosDatePickerDoneButton}
                        onPress={() => setShowDatePicker(false)}
                      >
                        <Text style={styles.iosDatePickerDoneText}>Done</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                <Text style={styles.formLabel}>Time *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g., 10:00 AM - 11:30 AM"
                  value={quizTime}
                  onChangeText={setQuizTime}
                  placeholderTextColor="#9ca3af"
                />

                <Text style={styles.formLabel}>Venue *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g., SWLT, 18"
                  value={quizVenue}
                  onChangeText={setQuizVenue}
                  placeholderTextColor="#9ca3af"
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setNotificationType(null)}
                  >
                    <Text style={styles.cancelButtonText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sendButton, sendingNotification && styles.sendButtonDisabled]}
                    onPress={sendNotification}
                    disabled={sendingNotification}
                  >
                    {sendingNotification ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.sendButtonText}>Send Notification</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : (
              <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
                <Text style={styles.formLabel}>Assignment Title *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g., Assignment 1, Project Submission"
                  value={assignmentTitle}
                  onChangeText={setAssignmentTitle}
                  placeholderTextColor="#9ca3af"
                />

                <Text style={styles.formLabel}>Description *</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Enter assignment details, requirements, and due date..."
                  value={assignmentDescription}
                  onChangeText={setAssignmentDescription}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  placeholderTextColor="#9ca3af"
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setNotificationType(null)}
                  >
                    <Text style={styles.cancelButtonText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sendButton, sendingNotification && styles.sendButtonDisabled]}
                    onPress={sendNotification}
                    disabled={sendingNotification}
                  >
                    {sendingNotification ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.sendButtonText}>Send Notification</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  greetingLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  roleText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calendarIcon: {
    marginRight: 6,
  },
  dateText: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '500',
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  seeAllText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIconContainer: {
    marginBottom: 20,
  },
  documentIcon: {
    width: 100,
    height: 120,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    position: 'relative',
  },
  questionMarkContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  createButton: {
    minWidth: 160,
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
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  coursesList: {
    gap: 12,
  },
  courseCardContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 12,
  },
  courseCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  courseCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  courseIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  courseInfo: {
    flex: 1,
    marginRight: 8,
  },
  courseName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  courseCode: {
    fontSize: 11,
    color: '#6b7280',
  },
  codeBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  codeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563eb',
    letterSpacing: 0.5,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  notificationButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
    textAlign: 'center',
  },
  notificationTypeContainer: {
    padding: 20,
  },
  typeButton: {
    marginBottom: 12,
  },
  typeButtonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  typeButtonIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  quizIconContainer: {
    backgroundColor: '#2563eb',
  },
  assignmentIconContainer: {
    backgroundColor: '#10b981',
  },
  typeButtonContent: {
    flex: 1,
  },
  typeButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  typeButtonDescription: {
    fontSize: 12,
    color: '#6b7280',
  },
  formContainer: {
    padding: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    marginTop: 12,
  },
  textInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 8,
  },
  textArea: {
    height: 120,
    paddingTop: 12,
  },
  datePickerButton: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  datePickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  datePickerText: {
    fontSize: 14,
    color: '#111827',
    marginLeft: 10,
  },
  iosDatePickerDoneButton: {
    alignSelf: 'flex-end',
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 12,
  },
  iosDatePickerDoneText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  sendButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  seeMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  seeMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
});

export default CourseRepScreen;

