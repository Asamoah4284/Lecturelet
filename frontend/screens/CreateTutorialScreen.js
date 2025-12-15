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
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Button from '../components/Button';
import { getApiUrl } from '../config/api';

const CreateTutorialScreen = ({ navigation, route }) => {
  const course = route.params?.course;
  const tutorial = route.params?.tutorial; // For edit mode
  const editMode = route.params?.editMode || false;
  const [loading, setLoading] = useState(false);
  const [tutorialName, setTutorialName] = useState('');
  const [topic, setTopic] = useState('');
  const [venue, setVenue] = useState('');

  // Validate course exists
  useEffect(() => {
    if (!course) {
      Alert.alert('Error', 'No course selected. Please go back and select a course.', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    }
  }, [course, navigation]);

  // Load tutorial data if in edit mode
  useEffect(() => {
    if (editMode && tutorial) {
      setTutorialName(tutorial.tutorial_name || tutorial.tutorialName || '');
      setTopic(tutorial.topic || '');
      setVenue(tutorial.venue || '');
      
      // Parse date (format: DD/MM/YYYY)
      if (tutorial.date) {
        const dateParts = tutorial.date.split('/');
        if (dateParts.length === 3) {
          const day = parseInt(dateParts[0], 10);
          const month = parseInt(dateParts[1], 10) - 1; // Month is 0-indexed
          const year = parseInt(dateParts[2], 10);
          setSelectedDate(new Date(year, month, day));
        }
      }
      
      // Parse time (format: HH:MM AM/PM)
      if (tutorial.time) {
        const timeMatch = tutorial.time.match(/(\d+):(\d+)\s*(AM|PM)?/i);
        if (timeMatch) {
          let hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          const period = timeMatch[3];
          
          // Convert to 24-hour format
          if (period) {
            if (period.toUpperCase() === 'PM' && hours !== 12) {
              hours += 12;
            } else if (period.toUpperCase() === 'AM' && hours === 12) {
              hours = 0;
            }
          }
          
          const now = new Date();
          setSelectedTime(new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0));
        }
      }
    }
  }, [editMode, tutorial]);
  
  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // Time picker state
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedTime, setSelectedTime] = useState(new Date());

  const formatDate = (date) => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatTime = (date) => {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutesStr = minutes.toString().padStart(2, '0');
    return `${hours}:${minutesStr} ${ampm}`;
  };

  const handleDateChange = (event, date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (date) {
      setSelectedDate(date);
      if (Platform.OS === 'ios') {
        setShowDatePicker(false);
      }
    }
  };

  const handleTimeChange = (event, date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (date) {
      setSelectedTime(date);
      if (Platform.OS === 'ios') {
        setShowTimePicker(false);
      }
    }
  };

  const validateForm = () => {
    if (!course) {
      Alert.alert('Validation Error', 'No course selected. Please go back and select a course.');
      return false;
    }
    const courseId = course?.id || course?._id;
    if (!courseId) {
      Alert.alert('Validation Error', 'Invalid course. Please go back and try again.');
      return false;
    }
    if (!tutorialName.trim()) {
      Alert.alert('Validation Error', 'Please enter a tutorial name');
      return false;
    }
    if (!venue.trim()) {
      Alert.alert('Validation Error', 'Please enter a venue');
      return false;
    }
    return true;
  };

  const handleCreateTutorial = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const token = await AsyncStorage.getItem('@auth_token');
      if (!token) {
        Alert.alert('Error', 'Not authenticated. Please log in again.');
        navigation.navigate('Login');
        return;
      }

      const courseId = course?.id || course?._id;
      if (!courseId) {
        Alert.alert('Error', 'Invalid course. Please go back and try again.');
        setLoading(false);
        return;
      }

      const tutorialData = {
        tutorialName: tutorialName.trim(),
        date: formatDate(selectedDate),
        time: formatTime(selectedTime),
        venue: venue.trim(),
        topic: topic.trim() || null,
        courseId: courseId,
        courseCode: course?.course_code || course?.courseCode,
        courseName: course?.course_name || course?.courseName,
      };

      const tutorialId = tutorial?.id || tutorial?._id;
      const url = editMode && tutorialId 
        ? getApiUrl(`tutorials/${tutorialId}`)
        : getApiUrl('tutorials/create');
      const method = editMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(tutorialData),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        Alert.alert('Success', editMode ? 'Tutorial updated successfully' : 'Tutorial created successfully', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      } else {
        Alert.alert('Error', data.message || (editMode ? 'Failed to update tutorial' : 'Failed to create tutorial'));
      }
    } catch (error) {
      console.error('Error saving tutorial:', error);
      Alert.alert('Error', editMode ? 'Failed to update tutorial. Please try again.' : 'Failed to create tutorial. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{editMode ? 'Edit Tutorial' : 'Create Tutorial'}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Course Info Display */}
        {course && (
          <View style={styles.courseInfoContainer}>
            <View style={styles.courseInfoHeader}>
              <Ionicons name="book" size={20} color="#2563eb" />
              <Text style={styles.courseInfoTitle}>Course Information</Text>
            </View>
            <View style={styles.courseInfoContent}>
              <Text style={styles.courseInfoLabel}>Course Code:</Text>
              <Text style={styles.courseInfoValue}>
                {course.course_code || course.courseCode || 'N/A'}
              </Text>
            </View>
            <View style={styles.courseInfoContent}>
              <Text style={styles.courseInfoLabel}>Course Name:</Text>
              <Text style={styles.courseInfoValue}>
                {course.course_name || course.courseName || 'N/A'}
              </Text>
            </View>
          </View>
        )}

        {/* Tutorial Name */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Tutorial Name <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Enter tutorial name"
            placeholderTextColor="#9ca3af"
            value={tutorialName}
            onChangeText={setTutorialName}
            autoCapitalize="words"
          />
        </View>

        {/* Date */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Date <Text style={styles.required}>*</Text>
          </Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={[styles.pickerText, !selectedDate && styles.placeholderText]}>
              {selectedDate ? formatDate(selectedDate) : 'Select date'}
            </Text>
            <Ionicons name="calendar-outline" size={20} color="#2563eb" />
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
              minimumDate={new Date()}
            />
          )}
        </View>

        {/* Time */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Time <Text style={styles.required}>*</Text>
          </Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowTimePicker(true)}
          >
            <Text style={[styles.pickerText, !selectedTime && styles.placeholderText]}>
              {selectedTime ? formatTime(selectedTime) : 'Select time'}
            </Text>
            <Ionicons name="time-outline" size={20} color="#2563eb" />
          </TouchableOpacity>
          {showTimePicker && (
            <DateTimePicker
              value={selectedTime}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleTimeChange}
            />
          )}
        </View>

        {/* Venue */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Venue <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Enter venue"
            placeholderTextColor="#9ca3af"
            value={venue}
            onChangeText={setVenue}
            autoCapitalize="words"
          />
        </View>

        {/* Topic (Optional) */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Topic (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter topic"
            placeholderTextColor="#9ca3af"
            value={topic}
            onChangeText={setTopic}
            autoCapitalize="words"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Submit Button */}
        <Button
          title={loading ? (editMode ? 'Updating...' : 'Creating...') : (editMode ? 'Update Tutorial' : 'Create Tutorial')}
          onPress={handleCreateTutorial}
          variant="primary"
          style={styles.submitButton}
          disabled={loading}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2563eb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 28 : 0,
    paddingBottom: 20,
    backgroundColor: '#2563eb',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  courseInfoContainer: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  courseInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  courseInfoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563eb',
  },
  courseInfoContent: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  courseInfoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    width: 100,
  },
  courseInfoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    flex: 1,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  required: {
    color: '#ef4444',
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    minHeight: 48,
  },
  pickerButton: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
  },
  pickerText: {
    fontSize: 16,
    color: '#111827',
  },
  placeholderText: {
    color: '#9ca3af',
  },
  submitButton: {
    marginTop: 10,
  },
});

export default CreateTutorialScreen;

