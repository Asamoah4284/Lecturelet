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
  const [selectedFilter, setSelectedFilter] = useState('courses'); // 'courses', 'quizzes', 'tutorials', 'assignments'
  const [quizzes, setQuizzes] = useState([]);
  const [tutorials, setTutorials] = useState([]);
  const [assignments, setAssignments] = useState([]);

  // Load courses on mount
  useEffect(() => {
    loadCourses();
    loadActivities();
  }, []);

  // Reload courses when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadCourses();
      loadActivities();
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

      // Let backend handle authorization - don't block based on cached role
      // This allows users who just switched roles to access features immediately
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
        // Handle permission errors gracefully
        if (response.status === 403) {
          // User doesn't have course_rep role, show empty state
          setCourses([]);
        } else {
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

  const loadActivities = async () => {
    try {
      const token = await AsyncStorage.getItem('@auth_token');
      if (!token) return;

      // Check user role
      const userDataString = await AsyncStorage.getItem('@user_data');
      if (userDataString) {
        const userData = JSON.parse(userDataString);
        if (userData.role !== 'course_rep') {
          return;
        }
      }

      // Fetch all activities in parallel
      const [quizzesRes, tutorialsRes, assignmentsRes] = await Promise.all([
        fetch(getApiUrl('quizzes/my-quizzes'), {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(getApiUrl('tutorials/my-tutorials'), {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(getApiUrl('assignments/my-assignments'), {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);

      const quizzesData = await quizzesRes.json();
      const tutorialsData = await tutorialsRes.json();
      const assignmentsData = await assignmentsRes.json();

      if (quizzesData.success) {
        setQuizzes(quizzesData.data.quizzes || []);
      }
      if (tutorialsData.success) {
        setTutorials(tutorialsData.data.tutorials || []);
      }
      if (assignmentsData.success) {
        setAssignments(assignmentsData.data.assignments || []);
      }
    } catch (error) {
      console.error('Error loading activities:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadCourses();
    loadActivities();
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

  // Check if activity is more than 12 hours past its scheduled time
  const isActivityExpired = (activity) => {
    try {
      const dateStr = activity.date || activity.due_date || activity.dueDate;
      const timeStr = activity.time;
      
      if (!dateStr) return false; // If no date, don't filter it out
      
      // Parse date (format: DD/MM/YYYY)
      const dateParts = dateStr.split('/');
      if (dateParts.length !== 3) return false;
      
      const day = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10) - 1; // Month is 0-indexed
      const year = parseInt(dateParts[2], 10);
      
      // Parse time (format: HH:MM or HH:MM AM/PM)
      let hours = 0;
      let minutes = 0;
      
      if (timeStr) {
        const timeMatch = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
        if (timeMatch) {
          hours = parseInt(timeMatch[1], 10);
          minutes = parseInt(timeMatch[2], 10);
          const period = timeMatch[3];
          
          // Convert to 24-hour format
          if (period) {
            if (period.toUpperCase() === 'PM' && hours !== 12) {
              hours += 12;
            } else if (period.toUpperCase() === 'AM' && hours === 12) {
              hours = 0;
            }
          }
        }
      }
      
      // Create scheduled datetime
      const scheduledDate = new Date(year, month, day, hours, minutes, 0);
      
      // Get current time
      const now = new Date();
      
      // Calculate 12 hours after scheduled time
      const expiryTime = new Date(scheduledDate.getTime() + 12 * 60 * 60 * 1000);
      
      // Return true if current time is past the expiry time (12 hours after scheduled)
      return now > expiryTime;
    } catch (error) {
      console.error('Error checking activity expiry:', error);
      return false; // If error parsing, don't filter it out
    }
  };

  // Get filtered activities (excluding expired ones)
  const getFilteredQuizzes = () => {
    return quizzes.filter(quiz => !isActivityExpired(quiz));
  };

  const getFilteredTutorials = () => {
    return tutorials.filter(tutorial => !isActivityExpired(tutorial));
  };

  const getFilteredAssignments = () => {
    return assignments.filter(assignment => !isActivityExpired(assignment));
  };

  // Get counts for each filter (only non-expired activities)
  const getFilterCounts = () => {
    const quizCount = getFilteredQuizzes().length;
    const tutorialCount = getFilteredTutorials().length;
    const assignmentCount = getFilteredAssignments().length;
    return { quizCount, tutorialCount, assignmentCount };
  };

  // Filter courses based on selected filter
  const getFilteredCourses = () => {
    if (selectedFilter === 'courses') {
      return courses;
    }

    const courseIds = new Set();
    
    if (selectedFilter === 'quizzes') {
      getFilteredQuizzes().forEach(quiz => {
        const courseId = quiz.course_id?._id || quiz.course_id || quiz.courseId;
        if (courseId) courseIds.add(courseId.toString());
      });
    } else if (selectedFilter === 'tutorials') {
      getFilteredTutorials().forEach(tutorial => {
        const courseId = tutorial.course_id?._id || tutorial.course_id || tutorial.courseId;
        if (courseId) courseIds.add(courseId.toString());
      });
    } else if (selectedFilter === 'assignments') {
      getFilteredAssignments().forEach(assignment => {
        const courseId = assignment.course_id?._id || assignment.course_id || assignment.courseId;
        if (courseId) courseIds.add(courseId.toString());
      });
    }

    return courses.filter(course => {
      const courseId = course.id || course._id;
      return courseIds.has(courseId.toString());
    });
  };

  // Get activities for a specific course (only non-expired)
  const getCourseActivities = (courseId) => {
    const courseIdStr = courseId.toString();
    return {
      quizzes: getFilteredQuizzes().filter(q => {
        const id = q.course_id?._id || q.course_id || q.courseId;
        return id && id.toString() === courseIdStr;
      }),
      tutorials: getFilteredTutorials().filter(t => {
        const id = t.course_id?._id || t.course_id || t.courseId;
        return id && id.toString() === courseIdStr;
      }),
      assignments: getFilteredAssignments().filter(a => {
        const id = a.course_id?._id || a.course_id || a.courseId;
        return id && id.toString() === courseIdStr;
      }),
    };
  };

  // Animated Activity Badges Component
  const AnimatedActivityBadges = ({ isExpanded, navigation, course, courseActivities }) => {
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

    const announcementFade = useRef(new Animated.Value(0)).current;
    const announcementTranslateY = useRef(new Animated.Value(-10)).current;
    const announcementScale = useRef(new Animated.Value(0.9)).current;

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
        announcementFade.setValue(0);
        announcementTranslateY.setValue(-10);
        announcementScale.setValue(0.9);

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

        // Animate Announcement fourth (300ms delay)
        setTimeout(() => {
          Animated.parallel([
            Animated.timing(announcementFade, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(announcementTranslateY, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.spring(announcementScale, {
              toValue: 1,
              tension: 50,
              friction: 7,
              useNativeDriver: true,
            }),
          ]).start();
        }, 300);
      } else {
        // Collapse all at once (reverse order for smooth exit)
        Animated.parallel([
          Animated.timing(announcementFade, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(announcementTranslateY, {
            toValue: -10,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(announcementScale, {
            toValue: 0.9,
            duration: 150,
            useNativeDriver: true,
          }),
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
              if (courseActivities?.quizzes?.length > 0) {
                // Navigate to edit quiz screen or show list
                navigation.navigate('CreateQuiz', { 
                  course, 
                  editMode: true,
                  activities: courseActivities.quizzes 
                });
              } else {
                navigation.navigate('CreateQuiz', { course });
              }
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
            <Text style={[styles.activityBadgeText, { color: '#3b82f6' }]}>
              Quiz {courseActivities?.quizzes?.length > 0 && `(${courseActivities.quizzes.length})`}
            </Text>
          </Animated.View>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            if (isExpanded) {
              if (courseActivities?.tutorials?.length > 0) {
                navigation.navigate('CreateTutorial', { 
                  course, 
                  editMode: true,
                  activities: courseActivities.tutorials 
                });
              } else {
                navigation.navigate('CreateTutorial', { course });
              }
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
            <Text style={[styles.activityBadgeText, { color: '#10b981' }]}>
              Tutorial {courseActivities?.tutorials?.length > 0 && `(${courseActivities.tutorials.length})`}
            </Text>
          </Animated.View>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            if (isExpanded) {
              if (courseActivities?.assignments?.length > 0) {
                navigation.navigate('CreateAssignment', { 
                  course, 
                  editMode: true,
                  activities: courseActivities.assignments 
                });
              } else {
                navigation.navigate('CreateAssignment', { course });
              }
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
            <Text style={[styles.activityBadgeText, { color: '#f97316' }]}>
              Assignment {courseActivities?.assignments?.length > 0 && `(${courseActivities.assignments.length})`}
            </Text>
          </Animated.View>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            if (isExpanded) {
              navigation.navigate('Announcement', { course });
            }
          }}
          disabled={!isExpanded}
        >
          <Animated.View
            style={[
              styles.activityBadge,
              styles.announcementBadge,
              {
                opacity: announcementFade,
                transform: [
                  { translateY: announcementTranslateY },
                  { scale: announcementScale },
                ],
              },
            ]}
            pointerEvents={isExpanded ? 'auto' : 'none'}
          >
            <Ionicons name="megaphone-outline" size={14} color="#8b5cf6" />
            <Text style={[styles.activityBadgeText, { color: '#8b5cf6' }]}>
              Announcement
            </Text>
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
          <Text style={styles.sectionTitle}>My Lectures</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('AddCourse')}
          >
            <Ionicons name="add" size={24} color="#2563eb" />
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Tabs */}
        {!loading && (
          <View style={styles.filterTabsContainer}>
            <TouchableOpacity
              style={[
                styles.filterTab,
                selectedFilter === 'courses' && styles.filterTabActive
              ]}
              onPress={() => setSelectedFilter('courses')}
            >
              <Ionicons name="book-outline" size={14} color={selectedFilter === 'courses' ? '#374151' : '#6b7280'} />
              <Text
                style={[
                  styles.filterTabText,
                  selectedFilter === 'courses' && styles.filterTabTextActive
                ]}
              >
                Courses
              </Text>
              {courses.length > 0 && (
                <View style={styles.filterTabBadge}>
                  <Text style={styles.filterTabBadgeText}>{courses.length}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterTab,
                styles.filterTabQuiz,
                selectedFilter === 'quizzes' && styles.filterTabQuizActive
              ]}
              onPress={() => setSelectedFilter('quizzes')}
            >
              <Ionicons name="checkmark-circle-outline" size={14} color="#3b82f6" />
              <Text
                style={[
                  styles.filterTabText,
                  styles.filterTabTextQuiz,
                  selectedFilter === 'quizzes' && styles.filterTabTextQuizActive
                ]}
              >
                Quiz
              </Text>
              {getFilterCounts().quizCount > 0 && (
                <View style={styles.filterTabBadge}>
                  <Text style={styles.filterTabBadgeText}>{getFilterCounts().quizCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterTab,
                styles.filterTabTutorial,
                selectedFilter === 'tutorials' && styles.filterTabTutorialActive
              ]}
              onPress={() => setSelectedFilter('tutorials')}
            >
              <Ionicons name="school-outline" size={14} color="#10b981" />
              <Text
                style={[
                  styles.filterTabText,
                  styles.filterTabTextTutorial,
                  selectedFilter === 'tutorials' && styles.filterTabTextTutorialActive
                ]}
              >
                Tutorial
              </Text>
              {getFilterCounts().tutorialCount > 0 && (
                <View style={styles.filterTabBadge}>
                  <Text style={styles.filterTabBadgeText}>{getFilterCounts().tutorialCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterTab,
                styles.filterTabAssignment,
                styles.filterTabWide,
                selectedFilter === 'assignments' && styles.filterTabAssignmentActive
              ]}
              onPress={() => setSelectedFilter('assignments')}
            >
              <Ionicons name="document-text-outline" size={14} color="#f97316" />
              <Text
                style={[
                  styles.filterTabText,
                  styles.filterTabTextAssignment,
                  selectedFilter === 'assignments' && styles.filterTabTextAssignmentActive
                ]}
              >
                Assignment
              </Text>
              {getFilterCounts().assignmentCount > 0 && (
                <View style={styles.filterTabBadge}>
                  <Text style={styles.filterTabBadgeText}>{getFilterCounts().assignmentCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Loading State */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loadingText}>Loading courses...</Text>
          </View>
        ) : selectedFilter !== 'courses' ? (
          /* Activities List */
          <View style={styles.activitiesList}>
            {selectedFilter === 'quizzes' && getFilteredQuizzes().length > 0 && getFilteredQuizzes().map((quiz) => (
              <View key={quiz.id || quiz._id} style={styles.activityCard}>
                <View style={styles.activityCardLeftBorder} />
                <View style={styles.activityCardContent}>
                  <View style={styles.activityCardHeader}>
                    <View style={styles.activityTitleSection}>
                      <Text style={styles.activityNameText}>{quiz.quiz_name || quiz.quizName}</Text>
                      <Text style={styles.activityCourseText}>
                        {quiz.course_code || quiz.courseCode} - {quiz.course_name || quiz.courseName}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.activityEditButton}
                      onPress={() => {
                        try {
                          console.log('Edit quiz pressed, quiz data:', JSON.stringify(quiz, null, 2));
                          console.log('Available courses:', courses.length);
                          
                          // Try to find course from courses array
                          let course = courses.find(c => {
                            const courseId = c.id || c._id;
                            const quizCourseId = quiz.course_id?._id || quiz.course_id || quiz.courseId;
                            const match = courseId && quizCourseId && courseId.toString() === quizCourseId.toString();
                            if (match) {
                              console.log('Found course match:', courseId);
                            }
                            return match;
                          });

                          // If course not found, try to construct it from quiz data
                          if (!course) {
                            console.log('Course not found in array, constructing from quiz data');
                            const quizCourseId = quiz.course_id?._id || quiz.course_id || quiz.courseId;
                            if (quizCourseId) {
                              course = {
                                id: quizCourseId,
                                _id: quizCourseId,
                                course_code: quiz.course_code || quiz.courseCode,
                                courseCode: quiz.course_code || quiz.courseCode,
                                course_name: quiz.course_name || quiz.courseName,
                                courseName: quiz.course_name || quiz.courseName,
                              };
                              console.log('Constructed course:', course);
                            }
                          }

                          if (course) {
                            console.log('Navigating to CreateQuiz with:', { 
                              courseId: course.id || course._id,
                              quizId: quiz.id || quiz._id,
                              editMode: true 
                            });
                            navigation.navigate('CreateQuiz', { course, quiz, editMode: true });
                          } else {
                            console.error('Could not find or construct course');
                            Alert.alert('Error', 'Could not find course information. Please try again.');
                          }
                        } catch (error) {
                          console.error('Error navigating to edit quiz:', error);
                          Alert.alert('Error', 'Failed to open quiz editor. Please try again.');
                        }
                      }}
                    >
                      <Ionicons name="create-outline" size={18} color="#2563eb" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.activityDetails}>
                    <View style={styles.detailRow}>
                      <Ionicons name="calendar-outline" size={16} color="#6b7280" />
                      <Text style={styles.detailText}>{quiz.date}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="time-outline" size={16} color="#6b7280" />
                      <Text style={styles.detailText}>{quiz.time}</Text>
                    </View>
                    {quiz.venue && (
                      <View style={styles.detailRow}>
                        <Ionicons name="location-outline" size={16} color="#6b7280" />
                        <Text style={styles.detailText}>{quiz.venue}</Text>
                      </View>
                    )}
                    {quiz.topic && (
                      <View style={styles.detailRow}>
                        <Ionicons name="book-outline" size={16} color="#6b7280" />
                        <Text style={styles.detailText}>{quiz.topic}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            ))}
            {selectedFilter === 'tutorials' && getFilteredTutorials().length > 0 && getFilteredTutorials().map((tutorial) => (
              <View key={tutorial.id || tutorial._id} style={styles.activityCard}>
                <View style={[styles.activityCardLeftBorder, { backgroundColor: '#10b981' }]} />
                <View style={styles.activityCardContent}>
                  <View style={styles.activityCardHeader}>
                    <View style={styles.activityTitleSection}>
                      <Text style={styles.activityNameText}>{tutorial.tutorial_name || tutorial.tutorialName}</Text>
                      <Text style={styles.activityCourseText}>
                        {tutorial.course_code || tutorial.courseCode} - {tutorial.course_name || tutorial.courseName}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.activityEditButton}
                      onPress={() => {
                        try {
                          // Try to find course from courses array
                          let course = courses.find(c => {
                            const courseId = c.id || c._id;
                            const tutorialCourseId = tutorial.course_id?._id || tutorial.course_id || tutorial.courseId;
                            return courseId && tutorialCourseId && courseId.toString() === tutorialCourseId.toString();
                          });

                          // If course not found, try to construct it from tutorial data
                          if (!course) {
                            const tutorialCourseId = tutorial.course_id?._id || tutorial.course_id || tutorial.courseId;
                            if (tutorialCourseId) {
                              course = {
                                id: tutorialCourseId,
                                _id: tutorialCourseId,
                                course_code: tutorial.course_code || tutorial.courseCode,
                                courseCode: tutorial.course_code || tutorial.courseCode,
                                course_name: tutorial.course_name || tutorial.courseName,
                                courseName: tutorial.course_name || tutorial.courseName,
                              };
                            }
                          }

                          if (course) {
                            navigation.navigate('CreateTutorial', { course, tutorial, editMode: true });
                          } else {
                            Alert.alert('Error', 'Could not find course information. Please try again.');
                          }
                        } catch (error) {
                          console.error('Error navigating to edit tutorial:', error);
                          Alert.alert('Error', 'Failed to open tutorial editor. Please try again.');
                        }
                      }}
                    >
                      <Ionicons name="create-outline" size={18} color="#2563eb" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.activityDetails}>
                    <View style={styles.detailRow}>
                      <Ionicons name="calendar-outline" size={16} color="#6b7280" />
                      <Text style={styles.detailText}>{tutorial.date}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="time-outline" size={16} color="#6b7280" />
                      <Text style={styles.detailText}>{tutorial.time}</Text>
                    </View>
                    {tutorial.venue && (
                      <View style={styles.detailRow}>
                        <Ionicons name="location-outline" size={16} color="#6b7280" />
                        <Text style={styles.detailText}>{tutorial.venue}</Text>
                      </View>
                    )}
                    {tutorial.topic && (
                      <View style={styles.detailRow}>
                        <Ionicons name="book-outline" size={16} color="#6b7280" />
                        <Text style={styles.detailText}>{tutorial.topic}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            ))}
            {selectedFilter === 'assignments' && getFilteredAssignments().length > 0 && getFilteredAssignments().map((assignment) => (
              <View key={assignment.id || assignment._id} style={styles.activityCard}>
                <View style={[styles.activityCardLeftBorder, { backgroundColor: '#f97316' }]} />
                <View style={styles.activityCardContent}>
                  <View style={styles.activityCardHeader}>
                    <View style={styles.activityTitleSection}>
                      <Text style={styles.activityNameText}>{assignment.assignment_name || assignment.assignmentName}</Text>
                      <Text style={styles.activityCourseText}>
                        {assignment.course_code || assignment.courseCode} - {assignment.course_name || assignment.courseName}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.activityEditButton}
                      onPress={() => {
                        try {
                          // Try to find course from courses array
                          let course = courses.find(c => {
                            const courseId = c.id || c._id;
                            const assignmentCourseId = assignment.course_id?._id || assignment.course_id || assignment.courseId;
                            return courseId && assignmentCourseId && courseId.toString() === assignmentCourseId.toString();
                          });

                          // If course not found, try to construct it from assignment data
                          if (!course) {
                            const assignmentCourseId = assignment.course_id?._id || assignment.course_id || assignment.courseId;
                            if (assignmentCourseId) {
                              course = {
                                id: assignmentCourseId,
                                _id: assignmentCourseId,
                                course_code: assignment.course_code || assignment.courseCode,
                                courseCode: assignment.course_code || assignment.courseCode,
                                course_name: assignment.course_name || assignment.courseName,
                                courseName: assignment.course_name || assignment.courseName,
                              };
                            }
                          }

                          if (course) {
                            navigation.navigate('CreateAssignment', { course, assignment, editMode: true });
                          } else {
                            Alert.alert('Error', 'Could not find course information. Please try again.');
                          }
                        } catch (error) {
                          console.error('Error navigating to edit assignment:', error);
                          Alert.alert('Error', 'Failed to open assignment editor. Please try again.');
                        }
                      }}
                    >
                      <Ionicons name="create-outline" size={18} color="#2563eb" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.activityDetails}>
                    <View style={styles.detailRow}>
                      <Ionicons name="calendar-outline" size={16} color="#6b7280" />
                      <Text style={styles.detailText}>{assignment.due_date || assignment.dueDate}</Text>
                    </View>
                    {assignment.description && (
                      <View style={styles.detailRow}>
                        <Ionicons name="document-text-outline" size={16} color="#6b7280" />
                        <Text style={styles.detailText} numberOfLines={2}>{assignment.description}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            ))}
            {((selectedFilter === 'quizzes' && getFilteredQuizzes().length === 0) ||
              (selectedFilter === 'tutorials' && getFilteredTutorials().length === 0) ||
              (selectedFilter === 'assignments' && getFilteredAssignments().length === 0)) && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>
                  No {selectedFilter === 'quizzes' ? 'Quizzes' : selectedFilter === 'tutorials' ? 'Tutorials' : 'Assignments'}
                </Text>
                <Text style={styles.emptyDescription}>
                  You haven't created any {selectedFilter === 'quizzes' ? 'quizzes' : selectedFilter === 'tutorials' ? 'tutorials' : 'assignments'} yet.
                </Text>
              </View>
            )}
          </View>
        ) : getFilteredCourses().length > 0 ? (
          /* Courses List */
          <View style={styles.coursesList}>
            {getFilteredCourses().map((course) => {
              const courseActivities = getCourseActivities(course.id || course._id);
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
                        courseActivities={courseActivities}
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
            <Text style={styles.emptyTitle}>No Lectures Published</Text>
            <Text style={styles.emptyDescription}>
              You haven't published any lectures yet. Create your first lecture to get started.
            </Text>
            <Button
              title="Create Lecture"
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
  activitiesList: {
    gap: 16,
  },
  activityCard: {
    flexDirection: 'row',
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
  activityCardLeftBorder: {
    width: 4,
    backgroundColor: '#3b82f6',
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  activityCardContent: {
    flex: 1,
    padding: 16,
    paddingLeft: 20,
  },
  activityCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  activityTitleSection: {
    flex: 1,
  },
  activityNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  activityCourseText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6b7280',
  },
  activityEditButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityDetails: {
    gap: 6,
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
    minWidth: 65,
  },
  tutorialBadge: {
    backgroundColor: '#d1fae5',
    borderColor: '#10b981',
    minWidth: 85,
  },
  assignmentBadge: {
    backgroundColor: '#fed7aa',
    borderColor: '#f97316',
    minWidth: 105,
  },
  announcementBadge: {
    backgroundColor: '#ede9fe',
    borderColor: '#8b5cf6',
    minWidth: 120,
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
  filterTabsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    gap: 5,
    position: 'relative',
    minHeight: 28,
  },
  filterTabWide: {
    flex: 1.3,
  },
  filterTabActive: {
    backgroundColor: '#f3f4f6',
    borderColor: '#d1d5db',
  },
  filterTabQuiz: {
    backgroundColor: '#dbeafe',
    borderColor: '#3b82f6',
  },
  filterTabQuizActive: {
    backgroundColor: '#bfdbfe',
    borderColor: '#2563eb',
  },
  filterTabTutorial: {
    backgroundColor: '#d1fae5',
    borderColor: '#10b981',
  },
  filterTabTutorialActive: {
    backgroundColor: '#a7f3d0',
    borderColor: '#059669',
  },
  filterTabAssignment: {
    backgroundColor: '#fed7aa',
    borderColor: '#f97316',
  },
  filterTabAssignmentActive: {
    backgroundColor: '#fdba74',
    borderColor: '#ea580c',
  },
  filterTabText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6b7280',
  },
  filterTabTextActive: {
    color: '#374151',
    fontWeight: '600',
  },
  filterTabTextQuiz: {
    color: '#3b82f6',
    fontWeight: '500',
  },
  filterTabTextQuizActive: {
    color: '#2563eb',
    fontWeight: '600',
  },
  filterTabTextTutorial: {
    color: '#10b981',
    fontWeight: '500',
  },
  filterTabTextTutorialActive: {
    color: '#059669',
    fontWeight: '600',
  },
  filterTabTextAssignment: {
    color: '#f97316',
    fontWeight: '500',
  },
  filterTabTextAssignmentActive: {
    color: '#ea580c',
    fontWeight: '600',
  },
  filterTabBadge: {
    position: 'absolute',
    top: -4,
    left: -4,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterTabBadgeText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '700',
  },
});

export default CoursesScreen;



