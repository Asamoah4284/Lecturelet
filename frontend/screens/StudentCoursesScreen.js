import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from '../config/api';
import Button from '../components/Button';

const StudentCoursesScreen = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Load courses on mount
  useEffect(() => {
    loadCourses();
  }, []);

  // Reload courses when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadCourses();
    });
    return unsubscribe;
  }, [navigation]);

  const loadCourses = async () => {
    try {
      const token = await AsyncStorage.getItem('@auth_token');
      if (!token) {
        setLoading(false);
        setError('Not authenticated. Please log in again.');
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
        setError('');
      } else {
        setError(data.message || 'Failed to load courses');
        setEnrolledCourses([]);
      }
    } catch (err) {
      console.error('Error loading courses:', err);
      setError('An error occurred. Please try again.');
      setEnrolledCourses([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadCourses();
  };

  const formatDays = (days) => {
    if (!days || !Array.isArray(days)) return 'N/A';
    return days.join(', ');
  };

  const formatTime = (startTime, endTime) => {
    if (!startTime || !endTime) return 'N/A';
    return `${startTime} - ${endTime}`;
  };

  const handleUnenroll = (course) => {
    const courseName = course.course_name || course.courseName || 'this course';
    const courseId = course.id || course._id;

    Alert.alert(
      'Unenroll from Course',
      `Are you sure you want to unenroll from ${courseName}? You will no longer receive notifications for this course.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Unenroll',
          style: 'destructive',
          onPress: () => performUnenroll(courseId, courseName),
        },
      ]
    );
  };

  const performUnenroll = async (courseId, courseName) => {
    try {
      const token = await AsyncStorage.getItem('@auth_token');
      if (!token) {
        Alert.alert('Error', 'Not authenticated. Please log in again.');
        return;
      }

      const response = await fetch(getApiUrl(`enrollments/${courseId}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        Alert.alert('Success', data.message || `Successfully unenrolled from ${courseName}`);
        // Reload courses list
        loadCourses();
      } else {
        Alert.alert('Error', data.message || 'Failed to unenroll from course. Please try again.');
      }
    } catch (error) {
      console.error('Unenroll error:', error);
      Alert.alert('Error', 'An error occurred. Please try again.');
    }
  };

  // Filter courses based on search query
  const filteredCourses = enrolledCourses.filter((course) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      (course.course_name && course.course_name.toLowerCase().includes(query)) ||
      (course.course_code && course.course_code.toLowerCase().includes(query)) ||
      (course.unique_code && course.unique_code.toLowerCase().includes(query)) ||
      (course.course_rep_name && course.course_rep_name.toLowerCase().includes(query))
    );
  });

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      
      {/* Blue Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Courses</Text>
        <TouchableOpacity
          style={styles.timetableButton}
          onPress={() => navigation.navigate('StudentTimetable')}
        >
          <Ionicons name="calendar-outline" size={20} color="#ffffff" />
          <Text style={styles.timetableButtonText}>Timetable</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color="#9ca3af" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search your enrolled courses..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9ca3af"
          />
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('StudentAddCourse')}
        >
          <Ionicons name="add" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* My Courses Section */}
        <Text style={styles.sectionTitle}>My Courses</Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loadingText}>Loading courses...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <Button
              title="Retry"
              onPress={loadCourses}
              variant="primary"
              style={styles.retryButton}
            />
          </View>
        ) : filteredCourses.length > 0 ? (
          <View style={styles.coursesList}>
            {filteredCourses.map((course) => {
              const creditHours = course.credit_hours || course.creditHours || '0';
              const studentRange = course.index_from && course.index_to 
                ? `${course.index_from} - ${course.index_to}`
                : course.index_from || 'N/A';
              const instructorName = course.course_rep_name || course.courseRepName || course.creator_name || 'N/A';

              return (
                <View key={course.id || course._id} style={styles.courseCardWrapper}>
                  <View style={styles.courseCard}>
                    <View style={styles.courseCardLeftBorder} />
                    <View style={styles.courseCardContent}>
                      <View style={styles.courseHeader}>
                        <View style={styles.courseTitleSection}>
                          <Text style={styles.courseCodeText}>{course.course_code || course.courseCode}</Text>
                          <Text style={styles.courseNameText}>{course.course_name || course.courseName}</Text>
                        </View>
                        <View style={styles.creditsBadge}>
                          <Text style={styles.creditsBadgeText}>{creditHours} Credits</Text>
                        </View>
                      </View>
                      <View style={styles.courseDetails}>
                        <View style={styles.detailRow}>
                          <Ionicons name="time-outline" size={16} color="#6b7280" />
                          <Text style={styles.detailText}>
                            {formatTime(course.start_time || course.startTime, course.end_time || course.endTime)}
                          </Text>
                        </View>
                        {course.venue && (
                          <View style={styles.detailRow}>
                            <Ionicons name="location-outline" size={16} color="#6b7280" />
                            <Text style={styles.detailText}>{course.venue}</Text>
                          </View>
                        )}
                        <View style={styles.detailRow}>
                          <Ionicons name="calendar-outline" size={16} color="#6b7280" />
                          <Text style={styles.detailText}>{formatDays(course.days)}</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Ionicons name="book-outline" size={16} color="#6b7280" />
                          <Text style={styles.detailText}>By {instructorName}</Text>
                        </View>
                      </View>
                      <View style={styles.courseFooter}>
                        <View style={styles.studentRangeBadge}>
                          <Text style={styles.studentRangeText}>{studentRange}</Text>
                        </View>
                        <View style={styles.codeBadgeContainer}>
                          <Text style={styles.codeLabel}>CODE</Text>
                          <Text style={styles.codeValue}>{course.unique_code || course.uniqueCode}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.unenrollButton}
                    onPress={() => handleUnenroll(course)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={16} color="#f87171" />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ) : searchQuery.trim() ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No Courses Found</Text>
            <Text style={styles.emptyDescription}>
              No courses match your search query. Try a different search term.
            </Text>
          </View>
        ) : (
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
              style={styles.addCourseButton}
            />
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('StudentHome')}
        >
          <Ionicons name="home-outline" size={24} color="#6b7280" />
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <View style={styles.activeNavItemContainer}>
            <View style={styles.activeNavBorder}>
              <Ionicons name="book" size={24} color="#2563eb" />
            </View>
            <Text style={[styles.navLabel, styles.navLabelActive]}>Courses</Text>
          </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  timetableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  timetableButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  searchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: '#ffffff',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1f2937',
    padding: 0,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 20,
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
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  addCourseButton: {
    minWidth: 160,
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
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  errorText: {
    fontSize: 14,
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    minWidth: 120,
  },
  coursesList: {
    gap: 16,
  },
  courseCardWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  courseCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  courseCardLeftBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    backgroundColor: '#60a5fa',
  },
  courseCardContent: {
    padding: 12,
    paddingLeft: 16,
  },
  courseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  courseTitleSection: {
    flex: 1,
  },
  courseCodeText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  courseNameText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#111827',
  },
  creditsBadge: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  creditsBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
  },
  courseDetails: {
    marginBottom: 8,
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 12,
    color: '#6b7280',
  },
  courseFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  studentRangeBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  studentRangeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563eb',
  },
  codeBadgeContainer: {
    alignItems: 'flex-end',
  },
  codeLabel: {
    fontSize: 9,
    fontWeight: '400',
    color: '#9ca3af',
    marginBottom: 2,
  },
  codeValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563eb',
    letterSpacing: 0.5,
  },
  unenrollButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
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
  activeNavItemContainer: {
    alignItems: 'center',
  },
  activeNavBorder: {
    marginBottom: 4,
  },
  navLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  navLabelActive: {
    color: '#111827',
    fontWeight: '600',
  },
});

export default StudentCoursesScreen;

