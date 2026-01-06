import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import Button from '../components/Button';
import { getApiUrl } from '../config/api';

const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const DAY_ABBREVIATIONS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const AddCourseScreen = ({ navigation, route }) => {
  const editingCourse = route.params?.course;
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [editType, setEditType] = useState('permanent'); // 'temporary' or 'permanent'
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Helper to get field value handling both camelCase and snake_case
  const getField = (camelCase, snakeCase) => {
    return editingCourse?.[camelCase] || editingCourse?.[snakeCase] || '';
  };

  const [courseName, setCourseName] = useState(getField('courseName', 'course_name'));
  const [courseCode, setCourseCode] = useState(getField('courseCode', 'course_code'));
  const [selectedDays, setSelectedDays] = useState(() => {
    const days = editingCourse?.days || (editingCourse?.day ? [editingCourse.day] : []);
    return Array.isArray(days) ? days : [];
  });
  
  // Store times per day: { Monday: { startTime: '9:00 AM', endTime: '10:30 AM' }, ... }
  const [dayTimes, setDayTimes] = useState(() => {
    // Check for dayTimes first (from backend as day_times or dayTimes)
    if (editingCourse?.dayTimes && Object.keys(editingCourse.dayTimes).length > 0) {
      return editingCourse.dayTimes;
    }
    if (editingCourse?.day_times && Object.keys(editingCourse.day_times).length > 0) {
      return editingCourse.day_times;
    }
    // For backward compatibility, if there's a single startTime/endTime, use it for all days
    const startTime = editingCourse?.startTime || editingCourse?.start_time;
    const endTime = editingCourse?.endTime || editingCourse?.end_time;
    if (startTime && endTime) {
      const times = {};
      const days = editingCourse?.days || (editingCourse?.day ? [editingCourse.day] : []);
      if (Array.isArray(days) && days.length > 0) {
        days.forEach(day => {
          times[day] = {
            startTime: startTime,
            endTime: endTime,
          };
        });
      }
      return times;
    }
    return {};
  });
  
  const [venue, setVenue] = useState(
    editingCourse?.venue || editingCourse?.location || ''
  );
  const [creditHours, setCreditHours] = useState(
    getField('creditHours', 'credit_hours')
  );
  const [indexFrom, setIndexFrom] = useState(
    getField('indexFrom', 'index_from')
  );
  const [indexTo, setIndexTo] = useState(
    getField('indexTo', 'index_to')
  );
  const [courseRepresentativeName, setCourseRepresentativeName] = useState(
    getField('courseRepresentativeName', 'course_rep_name')
  );
  
  // Time picker states - track which day and which time (start/end) is being edited
  const [timePickerState, setTimePickerState] = useState({
    show: false,
    day: null,
    type: null, // 'start' or 'end'
  });
  
  const parseTime = (timeString) => {
    if (!timeString) return null;
    // Handle formats like "9:00 AM", "09:00", "9:00"
    const timeMatch = timeString.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      const ampm = timeMatch[3]?.toUpperCase();
      
      if (ampm === 'PM' && hours !== 12) {
        hours += 12;
      } else if (ampm === 'AM' && hours === 12) {
        hours = 0;
      }
      
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      return date;
    }
    return null;
  };

  const getTimeDate = (day, type) => {
    const timeString = dayTimes[day]?.[type === 'start' ? 'startTime' : 'endTime'];
    if (timeString) {
      const parsed = parseTime(timeString);
      if (parsed) return parsed;
    }
    // Default times
    const date = new Date();
    if (type === 'start') {
      date.setHours(9, 0, 0, 0);
    } else {
      date.setHours(10, 30, 0, 0);
    }
    return date;
  };
  
  const [currentTimeDate, setCurrentTimeDate] = useState(() => {
    const date = new Date();
    date.setHours(9, 0, 0, 0);
    return date;
  });

  useEffect(() => {
    const loadAuthStatus = async () => {
      try {
        const token = await AsyncStorage.getItem('@auth_token');
        setIsAuthenticated(!!token);
      } catch (error) {
        console.error('Error loading auth status:', error);
        setIsAuthenticated(false);
      }
    };

    loadAuthStatus();
  }, []);

  useEffect(() => {
    if (editingCourse) {
      navigation.setOptions({ title: 'Edit Course' });
      
      // Update form fields when editingCourse is available
      setCourseName(editingCourse.courseName || editingCourse.course_name || '');
      setCourseCode(editingCourse.courseCode || editingCourse.course_code || '');
      
      const days = editingCourse.days || (editingCourse.day ? [editingCourse.day] : []);
      setSelectedDays(Array.isArray(days) ? days : []);
      
      // Update dayTimes - check for day_times (backend format) or dayTimes
      if (editingCourse.dayTimes && Object.keys(editingCourse.dayTimes).length > 0) {
        setDayTimes(editingCourse.dayTimes);
      } else if (editingCourse.day_times && Object.keys(editingCourse.day_times).length > 0) {
        setDayTimes(editingCourse.day_times);
      } else {
        // For backward compatibility, if there's a single startTime/endTime, use it for all days
        const startTime = editingCourse.startTime || editingCourse.start_time;
        const endTime = editingCourse.endTime || editingCourse.end_time;
        if (startTime && endTime && Array.isArray(days) && days.length > 0) {
          const times = {};
          days.forEach(day => {
            times[day] = {
              startTime: startTime,
              endTime: endTime,
            };
          });
          setDayTimes(times);
        }
      }
      
      setVenue(editingCourse.venue || editingCourse.location || '');
      setCreditHours(editingCourse.creditHours || editingCourse.credit_hours || '');
      setIndexFrom(editingCourse.indexFrom || editingCourse.index_from || '');
      setIndexTo(editingCourse.indexTo || editingCourse.index_to || '');
      setCourseRepresentativeName(
        editingCourse.courseRepresentativeName || 
        editingCourse.courseRepName || 
        editingCourse.course_rep_name ||
        editingCourse.courseRepName ||
        ''
      );
    }
  }, [editingCourse, navigation]);

  const requireAuthToPublish = () => {
    Alert.alert(
      'Sign Up Required',
      'You can fill this form in preview mode, but you need an account to publish a course.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Up', onPress: () => navigation.navigate('Signup') },
      ]
    );
  };

  const toggleDay = (dayIndex) => {
    const day = DAYS[dayIndex];
    setSelectedDays((prev) => {
      if (prev.includes(day)) {
        // Remove day and its times
        const newDays = prev.filter((d) => d !== day);
        setDayTimes((prevTimes) => {
          const newTimes = { ...prevTimes };
          delete newTimes[day];
          return newTimes;
        });
        return newDays;
      } else {
        // Add day - use existing time if available, otherwise use default
        const newDays = [...prev, day];
        setDayTimes((prevTimes) => {
          // If day already has times, keep them; otherwise use default or first day's time
          if (prevTimes[day] && prevTimes[day].startTime && prevTimes[day].endTime) {
            return prevTimes; // Day already has times
          }
          
          // Try to use first selected day's time as default, or use hardcoded default
          const defaultStart = prev.length > 0 && prevTimes[prev[0]]?.startTime 
            ? prevTimes[prev[0]].startTime 
            : '9:00 AM';
          const defaultEnd = prev.length > 0 && prevTimes[prev[0]]?.endTime 
            ? prevTimes[prev[0]].endTime 
            : '10:30 AM';
          
          return {
            ...prevTimes,
            [day]: {
              startTime: defaultStart,
              endTime: defaultEnd,
            },
          };
        });
        return newDays;
      }
    });
  };

  const formatTime = (date) => {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const minutesStr = minutes.toString().padStart(2, '0');
    return `${hours}:${minutesStr} ${ampm}`;
  };

  const openTimePicker = (day, type) => {
    const timeDate = getTimeDate(day, type);
    setCurrentTimeDate(timeDate);
    setTimePickerState({
      show: true,
      day,
      type,
    });
  };

  const handleTimeChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setTimePickerState({ show: false, day: null, type: null });
    }
    if (selectedDate && timePickerState.day && timePickerState.type) {
      const formattedTime = formatTime(selectedDate);
      setDayTimes((prev) => {
        const day = timePickerState.day;
        return {
          ...prev,
          [day]: {
            ...prev[day],
            [timePickerState.type === 'start' ? 'startTime' : 'endTime']: formattedTime,
          },
        };
      });
      if (Platform.OS === 'ios') {
        setTimePickerState({ show: false, day: null, type: null });
      }
    } else if (Platform.OS === 'ios') {
      setTimePickerState({ show: false, day: null, type: null });
    }
  };

  const validateForm = () => {
    if (!courseName.trim()) {
      Alert.alert('Validation Error', 'Please enter a course name');
      return false;
    }
    if (!courseCode.trim()) {
      Alert.alert('Validation Error', 'Please enter a course code');
      return false;
    }
    if (selectedDays.length === 0) {
      Alert.alert('Validation Error', 'Please select at least one lecture day');
      return false;
    }
    // Validate that each selected day has times
    for (const day of selectedDays) {
      const dayTime = dayTimes[day];
      if (!dayTime || !dayTime.startTime || !dayTime.endTime) {
        Alert.alert('Validation Error', `Please set times for ${day}`);
        return false;
      }
    }
    return true;
  };

  const copyToClipboard = async (text) => {
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert('Copied!', 'Course code copied to clipboard', [
        { text: 'OK' }
      ]);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      Alert.alert('Error', 'Failed to copy code. Please try selecting the text manually.');
    }
  };


  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Get auth token
      const token = await AsyncStorage.getItem('@auth_token');
      if (!token) {
        requireAuthToPublish();
        return;
      }

      // Get first day's time for backward compatibility
      const firstDay = selectedDays[0];
      const firstDayTime = dayTimes[firstDay] || { startTime: '', endTime: '' };

      const courseData = {
        courseName: courseName.trim(),
        courseCode: courseCode.trim(),
        days: selectedDays,
        dayTimes: dayTimes, // New structure with times per day
        startTime: firstDayTime.startTime, // Keep for backward compatibility
        endTime: firstDayTime.endTime, // Keep for backward compatibility
        venue: venue.trim(),
        creditHours: creditHours.trim(),
        indexFrom: indexFrom.trim(),
        indexTo: indexTo.trim(),
        courseRepName: courseRepresentativeName.trim(),
        ...(editingCourse && { editType }), // Include edit type when editing
      };

      if (editingCourse) {
        // Update existing course
        const response = await fetch(getApiUrl(`courses/${editingCourse.id}`), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(courseData),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Failed to update course');
        }

        Alert.alert('Success', 'Course updated successfully', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        // Create new course
        const response = await fetch(getApiUrl('courses'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(courseData),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Failed to create course');
        }

        if (data.success && data.data?.course) {
          const uniqueCode = data.data.course.unique_code || data.data.course.uniqueCode;
          setGeneratedCode(uniqueCode);
          setShowCodeModal(true);
        } else {
          throw new Error('Failed to create course');
        }
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to save course. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* Blue Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 24) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {editingCourse ? 'Edit Course' : 'Create Course'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
      

        {/* Form Title and Description */}
        <View style={styles.formHeader}>
          <Text style={styles.formTitle}>Create New Course</Text>
          <Text style={styles.formDescription}>
            Fill in the details to create a new course
          </Text>
        </View>

        {!isAuthenticated && !editingCourse && (
          <View style={styles.guestBanner}>
            <Ionicons name="information-circle-outline" size={18} color="#2563eb" />
            <Text style={styles.guestBannerText}>
              Preview mode: you can fill the form, but you need an account to publish.
            </Text>
          </View>
        )}

        {/* Form Fields */}
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Course Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Introduction to Computer Science"
              value={courseName}
              onChangeText={setCourseName}
              placeholderTextColor="#9ca3af"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Course Code</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., CS101"
              value={courseCode}
              onChangeText={setCourseCode}
              placeholderTextColor="#9ca3af"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Lecture Days</Text>
            <View style={styles.daysGrid}>
              {DAY_ABBREVIATIONS.map((dayAbbr, index) => {
                const day = DAYS[index];
                const isSelected = selectedDays.includes(day);
                return (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayButton,
                      isSelected && styles.dayButtonSelected,
                    ]}
                    onPress={() => toggleDay(index)}
                  >
                    <Text
                      style={[
                        styles.dayButtonText,
                        isSelected && styles.dayButtonTextSelected,
                      ]}
                    >
                      {dayAbbr}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Time selection for each selected day */}
          {selectedDays.length > 0 && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Time Range for Each Day</Text>
              {selectedDays.map((day) => {
                const dayTime = dayTimes[day] || { startTime: '', endTime: '' };
                return (
                  <View key={day} style={styles.dayTimeContainer}>
                    <Text style={styles.dayTimeLabel}>{day}</Text>
                    <View style={styles.timeRangeContainer}>
                      <TouchableOpacity
                        style={styles.timeField}
                        onPress={() => openTimePicker(day, 'start')}
                      >
                        <Ionicons name="time-outline" size={18} color="#6b7280" />
                        <Text 
                          style={[styles.timeFieldText, !dayTime.startTime && styles.timeFieldPlaceholder]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {dayTime.startTime || 'Start time'}
                        </Text>
                        <Ionicons name="chevron-down" size={18} color="#9ca3af" />
                      </TouchableOpacity>
                      <Text style={styles.timeSeparator}>-</Text>
                      <TouchableOpacity
                        style={styles.timeField}
                        onPress={() => openTimePicker(day, 'end')}
                      >
                        <Ionicons name="time-outline" size={18} color="#6b7280" />
                        <Text 
                          style={[styles.timeFieldText, !dayTime.endTime && styles.timeFieldPlaceholder]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {dayTime.endTime || 'End time'}
                        </Text>
                        <Ionicons name="chevron-down" size={18} color="#9ca3af" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
              {timePickerState.show && (
                <DateTimePicker
                  value={currentTimeDate}
                  mode="time"
                  is24Hour={false}
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleTimeChange}
                />
              )}
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Venue</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Room A1"
              value={venue}
              onChangeText={setVenue}
              placeholderTextColor="#9ca3af"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Credit Hours</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 3"
              value={creditHours}
              onChangeText={setCreditHours}
              keyboardType="numeric"
              placeholderTextColor="#9ca3af"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Index Number Range</Text>
            <View style={styles.indexRangeContainer}>
              <View style={[styles.inputGroup, styles.indexInput]}>
                <Text style={styles.label}>From</Text>
                <TextInput
                  style={styles.indexInputField}
                  placeholder="e.g., PS/CSC/23/001"
                  value={indexFrom}
                  onChangeText={setIndexFrom}
                  placeholderTextColor="#9ca3af"
                />
              </View>
              <View style={[styles.inputGroup, styles.indexInput]}>
                <Text style={styles.label}>To</Text>
                <TextInput
                  style={styles.indexInputField}
                  placeholder="e.g., PS/CSC/23/300"
                  value={indexTo}
                  onChangeText={setIndexTo}
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Course Representative Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Evans Ansah"
              value={courseRepresentativeName}
              onChangeText={setCourseRepresentativeName}
              placeholderTextColor="#9ca3af"
            />
          </View>

          {/* Edit Type Selector - Only show when editing */}
          {editingCourse && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Edit Type</Text>
              <Text style={styles.editTypeDescription}>
                Choose whether this change is temporary (resets after 24 hours) or permanent
              </Text>
              <View style={styles.editTypeContainer}>
                <TouchableOpacity
                  style={[
                    styles.editTypeOption,
                    editType === 'temporary' && styles.editTypeOptionActive,
                  ]}
                  onPress={() => setEditType('temporary')}
                >
                  <View style={styles.editTypeRadio}>
                    {editType === 'temporary' && <View style={styles.editTypeRadioInner} />}
                  </View>
                  <View style={styles.editTypeContent}>
                    <Text style={[
                      styles.editTypeTitle,
                      editType === 'temporary' && styles.editTypeTitleActive,
                    ]}>
                      Temporary Edit
                    </Text>
                    <Text style={styles.editTypeSubtitle}>
                      Changes will reset to original values after 24 hours
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.editTypeOption,
                    editType === 'permanent' && styles.editTypeOptionActive,
                  ]}
                  onPress={() => setEditType('permanent')}
                >
                  <View style={styles.editTypeRadio}>
                    {editType === 'permanent' && <View style={styles.editTypeRadioInner} />}
                  </View>
                  <View style={styles.editTypeContent}>
                    <Text style={[
                      styles.editTypeTitle,
                      editType === 'permanent' && styles.editTypeTitleActive,
                    ]}>
                      Permanent Edit
                    </Text>
                    <Text style={styles.editTypeSubtitle}>
                      Changes will be saved permanently
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <Button
            title={
              loading
                ? editingCourse
                  ? 'Updating...'
                  : 'Creating...'
                : editingCourse
                ? 'Update Course'
                : isAuthenticated
                ? 'Create Course'
                : 'Sign Up to Publish'
            }
            onPress={() => {
              if (!editingCourse && !isAuthenticated) {
                requireAuthToPublish();
                return;
              }
              handleSave();
            }}
            variant="primary"
            style={styles.saveButton}
            disabled={loading}
          />
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Course Code Modal */}
      <Modal
        visible={showCodeModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCodeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
              <Text style={styles.modalTitle}>Course Created!</Text>
              <Text style={styles.modalSubtitle}>
                Share this code with students to enroll
              </Text>
            </View>

            <View style={styles.codeContainer}>
              <Text style={styles.codeLabel}>Course Code</Text>
              <TouchableOpacity
                style={styles.codeBox}
                onPress={() => copyToClipboard(generatedCode)}
              >
                <Text style={styles.codeText} selectable={true}>{generatedCode}</Text>
                <Ionicons name="copy-outline" size={20} color="#2563eb" />
              </TouchableOpacity>
              <Text style={styles.codeHint}>Tap to copy or select the code</Text>
            </View>

            <Button
              title="Done"
              onPress={() => {
                setShowCodeModal(false);
                navigation.goBack();
              }}
              variant="primary"
              style={styles.modalButton}
            />
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
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  headerSpacer: {
    width: 36,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    paddingBottom: 32,
    flexGrow: 1,
  },
  brandingSection: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 16,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#f97316',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 18,
  },
  logoDot: {
    color: '#ffffff',
    fontSize: 10,
    marginHorizontal: 6,
  },
  appName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  formHeader: {
    paddingHorizontal: 24,
    paddingTop: 14,
    marginBottom: 24,
  },
  guestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 24,
    marginBottom: 16,
  },
  guestBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#1e40af',
    fontWeight: '500',
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  formDescription: {
    fontSize: 12,
    color: '#6b7280',
  },
  form: {
    paddingHorizontal: 24,
    gap: 20,
  },
  inputGroup: {
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1f2937',
  },
  timeRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  indexRangeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  indexInput: {
    flex: 1,
    marginBottom: 0,
  },
  indexInputField: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    color: '#1f2937',
  },
  timeField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 6,
    minHeight: 44,
    maxHeight: 44,
  },
  timeFieldText: {
    flex: 1,
    fontSize: 14,
    color: '#1f2937',
    flexShrink: 1,
  },
  timeFieldPlaceholder: {
    color: '#9ca3af',
  },
  timeSeparator: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '600',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minWidth: 60,
    alignItems: 'center',
  },
  dayButtonSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  dayButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  dayButtonTextSelected: {
    color: '#ffffff',
  },
  editTypeDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 12,
    lineHeight: 18,
  },
  editTypeContainer: {
    gap: 12,
  },
  editTypeOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  editTypeOptionActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  editTypeRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#9ca3af',
    marginRight: 12,
    marginTop: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editTypeRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563eb',
  },
  editTypeContent: {
    flex: 1,
  },
  editTypeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  editTypeTitleActive: {
    color: '#2563eb',
  },
  editTypeSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
  },
  saveButton: {
    marginTop: 8,
    width: '100%',
  },
  dayTimeContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  dayTimeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
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
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 12,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  codeContainer: {
    width: '100%',
    marginBottom: 24,
  },
  codeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
    textAlign: 'center',
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    borderColor: '#2563eb',
    borderStyle: 'dashed',
    gap: 12,
  },
  codeText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#2563eb',
    letterSpacing: 4,
  },
  codeHint: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
  },
  modalButton: {
    width: '100%',
  },
});

export default AddCourseScreen;
