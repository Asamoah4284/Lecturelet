import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Linking,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { getApiUrl } from '../config/api';

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const StudentTimetableScreen = ({ navigation }) => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadCourses();
  }, []);

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
        setCourses([]);
        return;
      }

      const response = await fetch(getApiUrl('enrollments/my-courses'), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setCourses(data.data.courses || []);
      } else {
        setCourses([]);
      }
    } catch (error) {
      console.error('Error loading timetable:', error);
      setCourses([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadCourses();
  };

  const exportTimetable = async () => {
    Alert.alert('Coming soon', 'Export of timetable to PDF is coming soon.');
  };

  const formatTime = (start, end) => {
    if (!start || !end) return 'Time not set';
    return `${start} - ${end}`;
  };

  const groupedSchedule = useMemo(() => {
    const byDay = DAYS_OF_WEEK.map((day) => ({
      day,
      classes: [],
    }));
    const unscheduled = [];

    courses.forEach((course) => {
      if (Array.isArray(course.days) && course.days.length > 0) {
        course.days.forEach((day) => {
          const targetDay = byDay.find(
            (entry) => entry.day.toLowerCase() === String(day).toLowerCase()
          );
          if (targetDay) {
            targetDay.classes.push(course);
          } else if (!unscheduled.includes(course)) {
            unscheduled.push(course);
          }
        });
      } else {
        unscheduled.push(course);
      }
    });

    return { byDay, unscheduled };
  }, [courses]);

  const renderCourseBlock = (course) => (
    <View key={course.id || course._id} style={styles.courseBlock}>
      <Text style={styles.blockTime}>
        {formatTime(course.start_time || course.startTime, course.end_time || course.endTime)}
      </Text>
      <Text style={styles.blockName} numberOfLines={1}>
        {course.course_name || course.courseName || 'Course'}
      </Text>
      {course.venue ? (
        <Text style={styles.blockVenue} numberOfLines={1}>
          {course.venue}
        </Text>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Timetable</Text>
        <TouchableOpacity onPress={exportTimetable} style={styles.exportButton}>
          <Ionicons name="download-outline" size={20} color="#ffffff" />
          <Text style={styles.exportText}>Export</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loadingText}>Building your timetable...</Text>
          </View>
        ) : courses.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color="#2563eb" />
            <Text style={styles.emptyTitle}>No Enrolled Courses</Text>
            <Text style={styles.emptyDescription}>
              Enroll in courses to see them arranged in your timetable.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate('StudentAddCourse')}
            >
              <Text style={styles.primaryButtonText}>Add a Course</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.pageTitle}>
              <Text style={styles.timetableTitle}>Weekly Timetable</Text>
              <Text style={styles.timetableSub}>
                {courses.length} {courses.length === 1 ? 'course enrolled' : 'courses enrolled'}
              </Text>
            </View>

            <View style={styles.weekWrapper}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tableScroll}
              >
                <View>
                  <View style={styles.headerRow}>
                    {groupedSchedule.byDay.map((dayBlock) => (
                      <View key={`${dayBlock.day}-hdr`} style={styles.headerCell}>
                        <Text style={styles.headerCellText}>{dayBlock.day.slice(0, 3)}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.bodyRow}>
                    {groupedSchedule.byDay.map((dayBlock) => (
                      <View key={`${dayBlock.day}-body`} style={styles.bodyCell}>
                        {dayBlock.classes.length === 0 ? (
                          <Text style={styles.noClassText}>No classes</Text>
                        ) : (
                          dayBlock.classes.map((course) => renderCourseBlock(course))
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              </ScrollView>
              <Text style={styles.swipeHint}>Swipe to view the full week</Text>
              <Text style={styles.tapHint}>Tap on any course block to see details</Text>
            </View>

            {groupedSchedule.unscheduled.length > 0 && (
              <View style={styles.unscheduledCard}>
                <View style={styles.unscheduledHeader}>
                  <Ionicons name="alert-circle-outline" size={18} color="#f59e0b" />
                  <Text style={styles.unscheduledTitle}>Unscheduled</Text>
                </View>
                <Text style={styles.unscheduledHint}>
                  These courses do not yet have days set.
                </Text>
                {groupedSchedule.unscheduled.map((course) => (
                  <View key={course.id || course._id} style={styles.unscheduledRow}>
                    <Text style={styles.unscheduledCode}>
                      {course.course_code || course.courseCode || 'Code'}
                    </Text>
                    <Text style={styles.unscheduledName} numberOfLines={1}>
                      {course.course_name || course.courseName || 'Course'}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('StudentHome')}>
          <Ionicons name="home-outline" size={24} color="#6b7280" />
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('StudentCourses')}>
          <Ionicons name="book-outline" size={24} color="#6b7280" />
          <Text style={styles.navLabel}>Courses</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Notifications')}>
          <Ionicons name="notifications-outline" size={24} color="#6b7280" />
          <Text style={styles.navLabel}>Notifications</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Settings')}>
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
    backgroundColor: '#ffffff',
  },
  header: {
    backgroundColor: '#2563eb',
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    gap: 6,
  },
  exportText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 90,
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 12,
    marginBottom: 6,
  },
  emptyDescription: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  pageTitle: {
    alignItems: 'center',
    marginBottom: 16,
  },
  timetableTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  timetableSub: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  weekWrapper: {
    marginBottom: 8,
  },
  tableScroll: {
    paddingRight: 6,
  },
  headerRow: {
    flexDirection: 'row',
  },
  bodyRow: {
    flexDirection: 'row',
  },
  headerCell: {
    width: 150,
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#1d4ed8',
  },
  headerCellText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  bodyCell: {
    width: 150,
    minHeight: 90,
    padding: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderTopWidth: 0,
  },
  noClassText: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  courseBlock: {
    backgroundColor: '#e8f5ff',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#22c1dc',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  blockTime: {
    fontSize: 9,
    color: '#2563eb',
    fontWeight: '700',
    marginBottom: 2,
    flexShrink: 1,
  },
  blockName: {
    fontSize: 11,
    color: '#111827',
    marginTop: 1,
  },
  blockVenue: {
    fontSize: 10,
    color: '#475569',
    marginTop: 2,
  },
  blockTag: {
    fontSize: 10,
    color: '#1d4ed8',
    fontWeight: '700',
    marginTop: 3,
  },
  swipeHint: {
    marginTop: 4,
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center',
  },
  tapHint: {
    marginTop: 2,
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center',
  },
  unscheduledCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  unscheduledHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  unscheduledTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#b45309',
  },
  unscheduledHint: {
    fontSize: 12,
    color: '#92400e',
    marginBottom: 8,
  },
  unscheduledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#fed7aa',
  },
  unscheduledCode: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400e',
  },
  unscheduledName: {
    fontSize: 12,
    color: '#92400e',
    flex: 1,
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
    paddingHorizontal: 12,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navItem: {
    alignItems: 'center',
    flex: 1,
  },
  navLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  navLabelActive: {
    color: '#111827',
    fontWeight: '600',
  },
  activeNavItemContainer: {
    alignItems: 'center',
  },
  activeNavBorder: {
    marginBottom: 4,
  },
});

export default StudentTimetableScreen;

