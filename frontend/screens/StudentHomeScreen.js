import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { getApiUrl } from '../config/api';
import Button from '../components/Button';
import { useUnreadNotifications } from '../hooks/useUnreadNotifications';

const StudentHomeScreen = ({ navigation }) => {
  const [userName, setUserName] = useState('Student');
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const { unreadCount } = useUnreadNotifications(navigation);
  const [loading, setLoading] = useState(true);

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

      const response = await fetch(getApiUrl('enrollments/my-courses'), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setEnrolledCourses(data.data.courses || []);
      } else {
        console.error('Error loading courses:', data.message);
        setEnrolledCourses([]);
      }
    } catch (error) {
      console.error('Error loading courses:', error);
      setEnrolledCourses([]);
    } finally {
      setLoading(false);
    }
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

  const formatDays = (days) => {
    if (!days || !Array.isArray(days)) return 'N/A';
    return days.join(', ');
  };

  const formatTime = (startTime, endTime) => {
    if (!startTime || !endTime) return 'N/A';
    return `${startTime} - ${endTime}`;
  };

  // Show only first 3 courses on home screen
  const displayedCourses = enrolledCourses.slice(0, 3);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      
      {/* Blue Header */}
      <View style={styles.header} />

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Greeting Section */}
        <View style={styles.greetingRow}>
          <View style={styles.greetingLeft}>
            <Text style={styles.greeting}>Hello, {userName}</Text>
            <Text style={styles.roleText}>Student</Text>
            <View style={styles.dateRow}>
              <Ionicons name="calendar-outline" size={16} color="#2563eb" style={styles.calendarIcon} />
              <Text style={styles.dateText}>{getCurrentDate()}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('StudentAddCourse')}
          >
            <Ionicons name="add" size={22} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Timetable Quick Access */}
        <TouchableOpacity
          style={styles.timetableCard}
          onPress={() => navigation.navigate('StudentTimetable')}
          activeOpacity={0.8}
        >
          <View style={styles.timetableCardContent}>
            <View style={styles.timetableIconContainer}>
              <Ionicons name="calendar" size={24} color="#2563eb" />
            </View>
            <View style={styles.timetableTextContainer}>
              <Text style={styles.timetableTitle}>View Timetable</Text>
              <Text style={styles.timetableSubtitle}>See your weekly schedule</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#6b7280" />
          </View>
        </TouchableOpacity>

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Enrolled Courses</Text>
          <TouchableOpacity onPress={() => navigation.navigate('StudentCourses')}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>

        {/* Courses List or Empty State */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loadingText}>Loading courses...</Text>
          </View>
        ) : enrolledCourses.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <View style={styles.documentIcon}>
                <Ionicons name="document-text" size={60} color="#ffffff" />
                <View style={styles.questionMarkContainer}>
                  <Ionicons name="help-circle" size={32} color="#ffffff" />
                </View>
              </View>
            </View>
            <Text style={styles.emptyTitle}>No Enrolled Courses</Text>
            <Text style={styles.emptyDescription}>
              You haven't enrolled in any courses yet. Add a course to get started.
            </Text>
            <Button
              title="Add Course"
              onPress={() => navigation.navigate('StudentAddCourse')}
              variant="primary"
              style={styles.createButton}
            />
          </View>
        ) : (
          <View style={styles.coursesList}>
            {displayedCourses.map((course) => (
              <TouchableOpacity
                key={course.id || course._id}
                style={styles.courseCard}
                activeOpacity={0.8}
              >
                <View style={styles.courseCardContent}>
                  <View style={styles.courseIconContainer}>
                    <Ionicons name="book" size={20} color="#2563eb" />
                  </View>
                  <View style={styles.courseInfo}>
                    <Text style={styles.courseName} numberOfLines={1}>
                      {course.course_name || course.courseName}
                    </Text>
                    <View style={styles.courseMetaRow}>
                      <Text style={styles.courseCode}>
                        {course.course_code || course.courseCode}
                      </Text>
                      <View style={styles.separator} />
                      <View style={styles.timeRow}>
                        <Ionicons name="time-outline" size={12} color="#6b7280" />
                        <Text style={styles.timeText}>
                          {formatTime(course.start_time || course.startTime, course.end_time || course.endTime)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.codeBadge}>
                    <Text style={styles.codeBadgeText}>
                      {course.unique_code || course.uniqueCode}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
            {enrolledCourses.length > 3 && (
              <TouchableOpacity
                style={styles.seeMoreButton}
                onPress={() => navigation.navigate('StudentCourses')}
              >
                <Text style={styles.seeMoreText}>
                  View all {enrolledCourses.length} courses
                </Text>
                <Ionicons name="chevron-forward" size={20} color="#2563eb" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <View style={styles.navIconContainer}>
            <Ionicons name="home" size={24} color="#2563eb" />
            <Ionicons name="arrow-up" size={12} color="#2563eb" style={styles.navIconArrow} />
          </View>
          <Text style={[styles.navLabel, styles.navLabelActive]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('StudentCourses')}
        >
          <Ionicons name="book-outline" size={24} color="#6b7280" />
          <Text style={styles.navLabel}>Courses</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('Notifications')}
        >
          <View style={styles.navIconContainer}>
            <Ionicons name="notifications-outline" size={24} color="#6b7280" />
            {unreadCount > 0 && (
              <View style={styles.navBadgeContainer}>
                <Text style={styles.navBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </View>
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  timetableCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 24,
    shadowColor: '#2563eb',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  timetableCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  timetableIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  timetableTextContainer: {
    flex: 1,
  },
  timetableTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  timetableSubtitle: {
    fontSize: 13,
    color: '#6b7280',
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
    fontSize: 12,
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
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  coursesList: {
    gap: 12,
  },
  courseCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#2563eb',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  courseCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  courseIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  courseInfo: {
    flex: 1,
    marginRight: 8,
  },
  courseName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  courseMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  courseCode: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  separator: {
    width: 1,
    height: 12,
    backgroundColor: '#e5e7eb',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 11,
    color: '#6b7280',
  },
  codeBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    minWidth: 50,
    alignItems: 'center',
  },
  codeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
    letterSpacing: 0.5,
  },
  seeMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  seeMoreText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '600',
    marginRight: 4,
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
  navBadgeContainer: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    zIndex: 1,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  navBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
});

export default StudentHomeScreen;


