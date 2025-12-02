import React, { useState, useEffect, useContext } from 'react';
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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import Button from '../components/Button';
import CourseContext from '../context/CourseContext';

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
  const { addCourse, updateCourse } = useContext(CourseContext);
  const editingCourse = route.params?.course;

  const [courseName, setCourseName] = useState(editingCourse?.courseName || '');
  const [courseCode, setCourseCode] = useState(editingCourse?.courseCode || '');
  const [selectedDays, setSelectedDays] = useState(
    editingCourse?.days || (editingCourse?.day ? [editingCourse.day] : [])
  );
  const [startTime, setStartTime] = useState(editingCourse?.startTime || '');
  const [endTime, setEndTime] = useState(editingCourse?.endTime || '');
  const [venue, setVenue] = useState(editingCourse?.venue || editingCourse?.location || '');
  const [creditHours, setCreditHours] = useState(editingCourse?.creditHours || '');
  const [indexFrom, setIndexFrom] = useState(editingCourse?.indexFrom || '');
  const [indexTo, setIndexTo] = useState(editingCourse?.indexTo || '');
  const [courseRepresentativeName, setCourseRepresentativeName] = useState(
    editingCourse?.courseRepresentativeName || ''
  );
  
  // Time picker states
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  
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
  
  const [startTimeDate, setStartTimeDate] = useState(() => {
    if (editingCourse?.startTime) {
      const parsed = parseTime(editingCourse.startTime);
      if (parsed) return parsed;
    }
    const date = new Date();
    date.setHours(9, 0, 0, 0);
    return date;
  });
  const [endTimeDate, setEndTimeDate] = useState(() => {
    if (editingCourse?.endTime) {
      const parsed = parseTime(editingCourse.endTime);
      if (parsed) return parsed;
    }
    const date = new Date();
    date.setHours(10, 30, 0, 0);
    return date;
  });
  
  // Initialize displayed time from dates if not already set
  useEffect(() => {
    if (!startTime && startTimeDate) {
      setStartTime(formatTime(startTimeDate));
    }
    if (!endTime && endTimeDate) {
      setEndTime(formatTime(endTimeDate));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (editingCourse) {
      navigation.setOptions({ title: 'Edit Course' });
    }
  }, [editingCourse]);

  const toggleDay = (dayIndex) => {
    const day = DAYS[dayIndex];
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
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

  const handleStartTimeChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowStartPicker(false);
    }
    if (selectedDate) {
      setStartTimeDate(selectedDate);
      setStartTime(formatTime(selectedDate));
      if (Platform.OS === 'ios') {
        setShowStartPicker(false);
      }
    } else if (Platform.OS === 'ios') {
      setShowStartPicker(false);
    }
  };

  const handleEndTimeChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowEndPicker(false);
    }
    if (selectedDate) {
      setEndTimeDate(selectedDate);
      setEndTime(formatTime(selectedDate));
      if (Platform.OS === 'ios') {
        setShowEndPicker(false);
      }
    } else if (Platform.OS === 'ios') {
      setShowEndPicker(false);
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
    if (!startTime.trim()) {
      Alert.alert('Validation Error', 'Please enter a start time');
      return false;
    }
    if (!endTime.trim()) {
      Alert.alert('Validation Error', 'Please enter an end time');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    const courseData = {
      courseName: courseName.trim(),
      courseCode: courseCode.trim(),
      days: selectedDays,
      day: selectedDays[0], // Keep for backward compatibility
      startTime: startTime.trim(),
      endTime: endTime.trim(),
      location: venue.trim(),
      venue: venue.trim(),
      creditHours: creditHours.trim(),
      indexFrom: indexFrom.trim(),
      indexTo: indexTo.trim(),
      courseRepresentativeName: courseRepresentativeName.trim(),
    };

    try {
      if (editingCourse) {
        await updateCourse(editingCourse.id, courseData);
        Alert.alert('Success', 'Course updated successfully', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        await addCourse(courseData);
        Alert.alert('Success', 'Course added successfully', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save course. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* Blue Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {editingCourse ? 'Edit Course' : 'Create Course'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
      

        {/* Form Title and Description */}
        <View style={styles.formHeader}>
          <Text style={styles.formTitle}>Create New Course</Text>
          <Text style={styles.formDescription}>
            Fill in the details to create a new course
          </Text>
        </View>

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
            <Text style={styles.label}>Time Range</Text>
            <View style={styles.timeRangeContainer}>
              <TouchableOpacity
                style={styles.timeField}
                onPress={() => setShowStartPicker(true)}
              >
                <Ionicons name="time-outline" size={20} color="#6b7280" />
                <Text style={[styles.timeFieldText, !startTime && styles.timeFieldPlaceholder]}>
                  {startTime || 'Start time'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#9ca3af" />
              </TouchableOpacity>
              <Text style={styles.timeSeparator}>-</Text>
              <TouchableOpacity
                style={styles.timeField}
                onPress={() => setShowEndPicker(true)}
              >
                <Ionicons name="time-outline" size={20} color="#6b7280" />
                <Text style={[styles.timeFieldText, !endTime && styles.timeFieldPlaceholder]}>
                  {endTime || 'End time'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            {showStartPicker && (
              <DateTimePicker
                value={startTimeDate}
                mode="time"
                is24Hour={false}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleStartTimeChange}
              />
            )}
            {showEndPicker && (
              <DateTimePicker
                value={endTimeDate}
                mode="time"
                is24Hour={false}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleEndTimeChange}
              />
            )}
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
                  style={styles.input}
                  placeholder="e.g., 1"
                  value={indexFrom}
                  onChangeText={setIndexFrom}
                  keyboardType="numeric"
                  placeholderTextColor="#9ca3af"
                />
              </View>
              <View style={[styles.inputGroup, styles.indexInput]}>
                <Text style={styles.label}>To</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 13"
                  value={indexTo}
                  onChangeText={setIndexTo}
                  keyboardType="numeric"
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Course Representative Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., gt"
              value={courseRepresentativeName}
              onChangeText={setCourseRepresentativeName}
              placeholderTextColor="#9ca3af"
            />
          </View>

          <Button
            title={editingCourse ? 'Update Course' : 'Create Course'}
            onPress={handleSave}
            variant="primary"
            style={styles.saveButton}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    backgroundColor: '#2563eb',
    paddingTop: 24,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
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
  timeField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  timeFieldText: {
    flex: 1,
    fontSize: 14,
    color: '#1f2937',
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
  saveButton: {
    marginTop: 8,
    width: '100%',
  },
});

export default AddCourseScreen;
