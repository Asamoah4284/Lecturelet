import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Animated,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Button from '../components/Button';
import { getApiUrl } from '../config/api';

const CoursesScreen = ({ navigation }) => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingCourseId, setDeletingCourseId] = useState(null);
  const [expandedCourseId, setExpandedCourseId] = useState(null);

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

  const handleDeleteCourse = (course) => {
    const courseName = course.course_name || course.courseName;
    const courseId = course.id || course._id;

    Alert.alert(
      'Delete Course',
      `Are you sure you want to delete "${courseName}"? This action cannot be undone and will remove all enrolled students.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => confirmDeleteCourse(courseId),
        },
      ]
    );
  };

  const confirmDeleteCourse = async (courseId) => {
    try {
      setDeletingCourseId(courseId);
      const token = await AsyncStorage.getItem('@auth_token');
      if (!token) {
        Alert.alert('Error', 'Authentication required');
        return;
      }

      const response = await fetch(getApiUrl(`courses/${courseId}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        Alert.alert('Success', 'Course deleted successfully');
        // Reload courses after deletion
        loadCourses();
      } else {
        Alert.alert('Error', data.message || 'Failed to delete course');
      }
    } catch (error) {
      console.error('Error deleting course:', error);
      Alert.alert('Error', 'Failed to delete course. Please try again.');
    } finally {
      setDeletingCourseId(null);
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

  const toggleActivityBadges = (courseId) => {
    setExpandedCourseId(expandedCourseId === courseId ? null : courseId);
  };

  // Animated Activity Badges Component
  const AnimatedActivityBadges = ({ isExpanded, navigation, course }) => {
    // Individual animated values for each badge
    const quizFade = useRef(new Animated.Value(0)).current;
    const quizTranslateY = useRef(new Animated.Value(-10)).current;
    const quizScale = useRef(new Animated.Value(0.9)).current;

    const tutorialFade = useRef(new Animated.Value(0)).current;
    const tutorialTranslateY = useRef(new Animated.Value(-10)).current;
    const tutorialScale = useRef(new Animated.Value(0.9)).current;

    const assignmentFade = useRef(new Animated.Value(0)).current;
    const assignmentTranslateY = useRef(new Animated.Value(-10)).current;
    const assignmentScale = useRef(new Animated.Value(0.9)).current;

    useEffect(() => {
      if (isExpanded) {
        // Reset all animations
        quizFade.setValue(0);
        quizTranslateY.setValue(-10);
        quizScale.setValue(0.9);
        tutorialFade.setValue(0);
        tutorialTranslateY.setValue(-10);
        tutorialScale.setValue(0.9);
        assignmentFade.setValue(0);
        assignmentTranslateY.setValue(-10);
        assignmentScale.setValue(0.9);

        // Animate Quiz first (no delay)
        Animated.parallel([
          Animated.timing(quizFade, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(quizTranslateY, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(quizScale, {
            toValue: 1,
            tension: 50,
            friction: 7,
            useNativeDriver: true,
          }),
        ]).start();

        // Animate Tutorial second (100ms delay)
        setTimeout(() => {
          Animated.parallel([
            Animated.timing(tutorialFade, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(tutorialTranslateY, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.spring(tutorialScale, {
              toValue: 1,
              tension: 50,
              friction: 7,
              useNativeDriver: true,
            }),
          ]).start();
        }, 100);

        // Animate Assignment third (200ms delay)
        setTimeout(() => {
          Animated.parallel([
            Animated.timing(assignmentFade, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(assignmentTranslateY, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.spring(assignmentScale, {
              toValue: 1,
              tension: 50,
              friction: 7,
              useNativeDriver: true,
            }),
          ]).start();
        }, 200);
      } else {
        // Collapse all at once (reverse order for smooth exit)
        Animated.parallel([
          Animated.timing(assignmentFade, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(assignmentTranslateY, {
            toValue: -10,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(assignmentScale, {
            toValue: 0.9,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(tutorialFade, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(tutorialTranslateY, {
            toValue: -10,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(tutorialScale, {
            toValue: 0.9,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(quizFade, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(quizTranslateY, {
            toValue: -10,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(quizScale, {
            toValue: 0.9,
            duration: 150,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }, [isExpanded]);

    return (
      <View style={styles.activityBadgesContainer}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            if (isExpanded) {
              navigation.navigate('CreateQuiz', { course });
            }
          }}
          disabled={!isExpanded}
        >
          <Animated.View
            style={[
              styles.activityBadge,
              styles.quizBadge,
              {
                opacity: quizFade,
                transform: [
                  { translateY: quizTranslateY },
                  { scale: quizScale },
                ],
              },
            ]}
            pointerEvents={isExpanded ? 'auto' : 'none'}
          >
            <Ionicons name="checkmark-circle-outline" size={14} color="#3b82f6" />
            <Text style={[styles.activityBadgeText, { color: '#3b82f6' }]}>Quiz</Text>
          </Animated.View>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            if (isExpanded) {
              navigation.navigate('CreateTutorial', { course });
            }
          }}
          disabled={!isExpanded}
        >
          <Animated.View
            style={[
              styles.activityBadge,
              styles.tutorialBadge,
              {
                opacity: tutorialFade,
                transform: [
                  { translateY: tutorialTranslateY },
                  { scale: tutorialScale },
                ],
              },
            ]}
            pointerEvents={isExpanded ? 'auto' : 'none'}
          >
            <Ionicons name="school-outline" size={14} color="#10b981" />
            <Text style={[styles.activityBadgeText, { color: '#10b981' }]}>Tutorial</Text>
          </Animated.View>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            if (isExpanded) {
              navigation.navigate('CreateAssignment', { course });
            }
          }}
          disabled={!isExpanded}
        >
          <Animated.View
            style={[
              styles.activityBadge,
              styles.assignmentBadge,
              {
                opacity: assignmentFade,
                transform: [
                  { translateY: assignmentTranslateY },
                  { scale: assignmentScale },
                ],
              },
            ]}
            pointerEvents={isExpanded ? 'auto' : 'none'}
          >
            <Ionicons name="document-text-outline" size={14} color="#f97316" />
            <Text style={[styles.activityBadgeText, { color: '#f97316' }]}>Assignment</Text>
          </Animated.View>
        </TouchableOpacity>
      </View>
    );
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
        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Courses</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('AddCourse')}
          >
            <Ionicons name="add" size={24} color="#2563eb" />
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
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
            {courses.map((course) => {
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
                dayTimes: course.day_times || course.dayTimes,
              };
              
              const courseId = course.id || course._id;
              const isDeleting = deletingCourseId === courseId;

              const creditHours = course.credit_hours || course.creditHours || '0';
              const studentRange = course.index_from && course.index_to 
                ? `${course.index_from} - ${course.index_to}`
                : course.index_from || 'N/A';
              const instructorName = course.course_rep_name || course.courseRepName || 'N/A';
              const isExpanded = expandedCourseId === courseId;

              return (
                <View key={courseId} style={styles.courseCardWrapper}>
                  <View style={styles.courseCard}>
                    <View style={styles.courseCardLeftBorder} />
                    <View style={styles.courseContent}>
                      <View style={styles.courseHeader}>
                        <View style={styles.courseTitleSection}>
                          <Text style={styles.courseCodeText}>{course.course_code || course.courseCode}</Text>
                          <Text style={styles.courseNameText}>{course.course_name || course.courseName}</Text>
                        </View>
                        <View style={styles.topRightSection}>
                          <View style={styles.creditsBadge}>
                            <Text style={styles.creditsBadgeText}>{creditHours} Credits</Text>
                          </View>
                        </View>
                      </View>
                      <AnimatedActivityBadges 
                        isExpanded={isExpanded} 
                        navigation={navigation}
                        course={course}
                      />
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
                  <View style={styles.actionButtonsContainer}>
                    <TouchableOpacity
                      style={styles.actionButtonAdd}
                      onPress={() => toggleActivityBadges(courseId)}
                    >
                      <Ionicons 
                        name={isExpanded ? "remove" : "add"} 
                        size={20} 
                        color="#ffffff" 
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButtonEdit}
                      onPress={() => navigation.navigate('AddCourse', { course: courseForEdit })}
                    >
                      <Ionicons name="create-outline" size={18} color="#2563eb" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButtonDelete, isDeleting && styles.deleteButtonDisabled]}
                      onPress={() => handleDeleteCourse(course)}
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <ActivityIndicator size="small" color="#ef4444" />
                      ) : (
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
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
          onPress={() => navigation.navigate('CourseRep')}
        >
          <Ionicons name="home-outline" size={24} color="#6b7280" />
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <View style={styles.navIconContainer}>
            <Ionicons name="book" size={24} color="#2563eb" />
            <Ionicons name="arrow-up" size={12} color="#2563eb" style={styles.navIconArrow} />
          </View>
          <Text style={[styles.navLabel, styles.navLabelActive]}>Courses</Text>
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
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
    gap: 16,
  },
  courseCardWrapper: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'center',
  },
  courseCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  courseCardLeftBorder: {
    width: 4,
    backgroundColor: '#2563eb',
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  courseContent: {
    flex: 1,
    padding: 16,
    paddingLeft: 20,
    position: 'relative',
  },
  courseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
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
  topRightSection: {
    alignItems: 'flex-end',
    gap: 8,
  },
  creditsBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  creditsBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6b7280',
  },
  activityBadgesContainer: {
    position: 'absolute',
    right: 16,
    top: 50,
    flexDirection: 'column',
    gap: 6,
    zIndex: 1,
    alignItems: 'flex-end',
  },
  activityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  activityBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  quizBadge: {
    backgroundColor: '#dbeafe',
    borderColor: '#3b82f6',
    width: 65,
  },
  tutorialBadge: {
    backgroundColor: '#d1fae5',
    borderColor: '#10b981',
    width: 85,
  },
  assignmentBadge: {
    backgroundColor: '#fed7aa',
    borderColor: '#f97316',
    width: 105,
  },
  courseDetails: {
    marginBottom: 12,
    gap: 6,
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
    marginTop: 8,
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
  actionButtonsContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    gap: 8,
  },
  actionButtonAdd: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  actionButtonEdit: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  actionButtonDelete: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  deleteButtonDisabled: {
    opacity: 0.6,
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
});

export default CoursesScreen;



