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
  const [todaySchedule, setTodaySchedule] = useState([]);
  const [upcomingQuizzes, setUpcomingQuizzes] = useState([]);
  const [loadingQuizzes, setLoadingQuizzes] = useState(false);
  const { unreadCount } = useUnreadNotifications(navigation);
  const [loading, setLoading] = useState(true);

  // Load user data and schedule on mount
  useEffect(() => {
    loadUserData();
    loadTodaySchedule();
    loadUpcomingQuizzes();
  }, []);

  // Reload schedule when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadTodaySchedule();
      loadUpcomingQuizzes();
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

  const loadTodaySchedule = async () => {
    try {
      const token = await AsyncStorage.getItem('@auth_token');
      if (!token) {
        setLoading(false);
        return;
      }

      // Get today's date in the format needed
      const today = new Date();
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const todayDayName = dayNames[today.getDay()];
      const todayDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      // Fetch enrolled courses
      const coursesResponse = await fetch(getApiUrl('enrollments/my-courses'), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const coursesData = await coursesResponse.json();
      const courses = coursesData.success ? (coursesData.data.courses || []) : [];
      setEnrolledCourses(courses);

      // Build today's schedule from courses and their activities
      const scheduleItems = [];

      // Add regular lectures for today
      courses.forEach((course) => {
        const courseDays = course.days || [];
        if (Array.isArray(courseDays) && courseDays.includes(todayDayName)) {
          scheduleItems.push({
            id: `lecture-${course.id || course._id}`,
            type: 'lecture',
            courseCode: course.course_code || course.courseCode,
            courseName: course.course_name || course.courseName,
            startTime: course.start_time || course.startTime,
            endTime: course.end_time || course.endTime,
            venue: course.venue,
            creditHours: course.credit_hours || course.creditHours,
            instructor: course.course_rep_name || course.courseRepName,
            uniqueCode: course.unique_code || course.uniqueCode,
            courseId: course.id || course._id,
          });
        }
      });

      // TODO: Fetch quizzes, tutorials, and assignments for today
      // For now, we'll just show lectures. The API endpoints can be added later:
      // - getApiUrl('quizzes/today')
      // - getApiUrl('tutorials/today')
      // - getApiUrl('assignments/today')

      // Sort by start time
      scheduleItems.sort((a, b) => {
        const timeA = a.startTime || '';
        const timeB = b.startTime || '';
        return timeA.localeCompare(timeB);
      });

      setTodaySchedule(scheduleItems);
    } catch (error) {
      console.error('Error loading schedule:', error);
      setTodaySchedule([]);
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

  const getCurrentDayName = () => {
    const date = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
  };

  const formatTime = (startTime, endTime) => {
    if (!startTime || !endTime) return 'N/A';
    return `${startTime} - ${endTime}`;
  };

  const formatTimeDisplay = (startTime, endTime) => {
    if (!startTime) return 'N/A';
    if (!endTime) return startTime;
    return `${startTime}-${endTime}`;
  };

  // Parse date from DD/MM/YYYY format
  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day);
  };

  // Check if a date is today or in the future
  const isUpcoming = (dateStr) => {
    const quizDate = parseDate(dateStr);
    if (!quizDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    quizDate.setHours(0, 0, 0, 0);
    return quizDate >= today;
  };

  // Load upcoming quizzes for all enrolled courses
  const loadUpcomingQuizzes = async () => {
    try {
      setLoadingQuizzes(true);
      const token = await AsyncStorage.getItem('@auth_token');
      if (!token) {
        setLoadingQuizzes(false);
        return;
      }

      // Get enrolled courses first
      const coursesResponse = await fetch(getApiUrl('enrollments/my-courses'), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const coursesData = await coursesResponse.json();
      const courses = coursesData.success ? (coursesData.data.courses || []) : [];

      if (courses.length === 0) {
        setUpcomingQuizzes([]);
        setLoadingQuizzes(false);
        return;
      }

      // Fetch quizzes for each enrolled course
      const allQuizzes = [];
      for (const course of courses) {
        const courseId = course.id || course._id;
        if (!courseId) continue;

        try {
          const quizzesResponse = await fetch(getApiUrl(`quizzes/course/${courseId}`), {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          const quizzesData = await quizzesResponse.json();
          if (quizzesData.success && quizzesData.data.quizzes) {
            allQuizzes.push(...quizzesData.data.quizzes);
          }
        } catch (error) {
          console.error(`Error fetching quizzes for course ${courseId}:`, error);
        }
      }

      // Filter for upcoming quizzes and sort by date
      const upcoming = allQuizzes
        .filter((quiz) => isUpcoming(quiz.date))
        .map((quiz) => ({
          id: quiz.id || quiz._id,
          type: 'quiz',
          quizName: quiz.quiz_name || quiz.quizName,
          date: quiz.date,
          time: quiz.time,
          venue: quiz.venue,
          topic: quiz.topic,
          courseCode: quiz.course_code || quiz.courseCode,
          courseName: quiz.course_name || quiz.courseName,
          courseId: quiz.course_id || quiz.courseId,
        }))
        .sort((a, b) => {
          const dateA = parseDate(a.date);
          const dateB = parseDate(b.date);
          if (!dateA || !dateB) return 0;
          return dateA - dateB;
        });

      setUpcomingQuizzes(upcoming);
    } catch (error) {
      console.error('Error loading upcoming quizzes:', error);
      setUpcomingQuizzes([]);
    } finally {
      setLoadingQuizzes(false);
    }
  };

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

        {/* Upcoming Quizzes Section */}
        {upcomingQuizzes.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Upcoming Quizzes</Text>
                <Text style={styles.dayName}>{upcomingQuizzes.length} quiz{upcomingQuizzes.length !== 1 ? 'zes' : ''} scheduled</Text>
              </View>
            </View>
            <View style={styles.quizzesList}>
              {upcomingQuizzes.slice(0, 3).map((quiz) => (
                <TouchableOpacity
                  key={quiz.id}
                  style={styles.quizCard}
                  activeOpacity={0.8}
                >
                  <View style={styles.quizCardLeftBorder} />
                  <View style={styles.quizCardContent}>
                    <View style={styles.quizLeftColumn}>
                      <View style={styles.quizBadgeContainer}>
                        <View style={styles.quizBadge}>
                          <Text style={styles.quizBadgeText}>QUIZ</Text>
                        </View>
                      </View>
                      <Text style={styles.quizDate}>{quiz.date}</Text>
                      <Text style={styles.quizTime}>{quiz.time}</Text>
                    </View>
                    <View style={styles.quizRightColumn}>
                      <Text style={styles.quizName}>{quiz.quizName}</Text>
                      <Text style={styles.quizCourseCode}>{quiz.courseCode}</Text>
                      <Text style={styles.quizCourseName}>{quiz.courseName}</Text>
                      <View style={styles.quizBadgesRow}>
                        {quiz.venue && (
                          <View style={styles.venueBadge}>
                            <Ionicons name="location-outline" size={12} color="#2563eb" />
                            <Text style={styles.venueBadgeText}>{quiz.venue}</Text>
                          </View>
                        )}
                        {quiz.topic && (
                          <View style={styles.topicBadge}>
                            <Ionicons name="document-text-outline" size={12} color="#10b981" />
                            <Text style={styles.topicBadgeText}>{quiz.topic}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            {upcomingQuizzes.length > 3 && (
              <TouchableOpacity
                style={styles.viewMoreButton}
                onPress={() => navigation.navigate('StudentCourses')}
              >
                <Text style={styles.viewMoreText}>View All {upcomingQuizzes.length} Quizzes</Text>
                <Ionicons name="chevron-forward" size={16} color="#2563eb" />
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Today's Schedule</Text>
            <Text style={styles.dayName}>{getCurrentDayName()}</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('StudentTimetable')}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>

        {/* Schedule List or Empty State */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loadingText}>Loading schedule...</Text>
          </View>
        ) : todaySchedule.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <View style={styles.documentIcon}>
                <Ionicons name="calendar-outline" size={60} color="#ffffff" />
              </View>
            </View>
            <Text style={styles.emptyTitle}>No Schedule for Today</Text>
            <Text style={styles.emptyDescription}>
              You don't have any classes or activities scheduled for today.
            </Text>
          </View>
        ) : (
          <View style={styles.scheduleList}>
            {todaySchedule.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.scheduleCard}
                activeOpacity={0.8}
              >
                <View style={styles.scheduleCardLeftBorder} />
                <View style={styles.scheduleCardContent}>
                  <View style={styles.scheduleLeftColumn}>
                    <Text style={styles.scheduleTime}>
                      {formatTimeDisplay(item.startTime, item.endTime)}
                    </Text>
                    {item.type === 'quiz' && (
                      <View style={styles.quizBadge}>
                        <Text style={styles.quizBadgeText}>QUIZ</Text>
                      </View>
                    )}
                    {item.type === 'tutorial' && (
                      <View style={styles.tutorialBadge}>
                        <Text style={styles.tutorialBadgeText}>TUTORIAL</Text>
                      </View>
                    )}
                    {item.type === 'assignment' && (
                      <View style={styles.assignmentBadge}>
                        <Text style={styles.assignmentBadgeText}>ASSIGNMENT</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.scheduleRightColumn}>
                    <Text style={styles.scheduleCourseCode}>{item.courseCode}</Text>
                    <Text style={styles.scheduleCourseName}>{item.courseName}</Text>
                    <View style={styles.scheduleBadgesRow}>
                      {item.venue && (
                        <View style={styles.venueBadge}>
                          <Ionicons name="location-outline" size={12} color="#2563eb" />
                          <Text style={styles.venueBadgeText}>{item.venue}</Text>
                        </View>
                      )}
                      {item.creditHours && (
                        <View style={styles.creditsBadge}>
                          <Text style={styles.creditsBadgeText}>{item.creditHours} Credits</Text>
                        </View>
                      )}
                      {item.duration && (
                        <View style={styles.durationBadge}>
                          <Text style={styles.durationBadgeText}>{item.duration}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.scheduleDetailsRow}>
                      {item.instructor && (
                        <Text style={styles.scheduleDetailText}>Instructor: {item.instructor}</Text>
                      )}
                      {item.uniqueCode && (
                        <Text style={styles.scheduleDetailText}>Code: {item.uniqueCode}</Text>
                      )}
                      {item.date && (
                        <Text style={styles.scheduleDetailText}>Date: {item.date}</Text>
                      )}
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
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
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  dayName: {
    fontSize: 14,
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
  scheduleList: {
    gap: 12,
  },
  scheduleCard: {
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
  scheduleCardLeftBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#60a5fa',
  },
  scheduleCardContent: {
    flexDirection: 'row',
    padding: 16,
    paddingLeft: 20,
  },
  scheduleLeftColumn: {
    width: 80,
    alignItems: 'flex-start',
  },
  scheduleTime: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  quizBadge: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
  },
  quizBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  tutorialBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
  },
  tutorialBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  assignmentBadge: {
    backgroundColor: '#f97316',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
  },
  assignmentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  scheduleRightColumn: {
    flex: 1,
  },
  scheduleCourseCode: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  scheduleCourseName: {
    fontSize: 14,
    fontWeight: '400',
    color: '#111827',
    marginBottom: 8,
  },
  scheduleBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  venueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  venueBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563eb',
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
    color: '#10b981',
  },
  durationBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  durationBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563eb',
  },
  scheduleDetailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scheduleDetailText: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '400',
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
  quizzesList: {
    gap: 12,
    marginBottom: 24,
  },
  quizCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  quizCardLeftBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#2563eb',
  },
  quizCardContent: {
    flexDirection: 'row',
    padding: 16,
    paddingLeft: 20,
  },
  quizLeftColumn: {
    width: 100,
    alignItems: 'flex-start',
  },
  quizBadgeContainer: {
    marginBottom: 8,
  },
  quizDate: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  quizTime: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6b7280',
  },
  quizRightColumn: {
    flex: 1,
  },
  quizName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  quizCourseCode: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
    marginBottom: 2,
  },
  quizCourseName: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6b7280',
    marginBottom: 8,
  },
  quizBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  topicBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  topicBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10b981',
  },
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginBottom: 24,
  },
  viewMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
    marginRight: 4,
  },
});

export default StudentHomeScreen;


