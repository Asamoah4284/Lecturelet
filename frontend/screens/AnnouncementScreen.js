import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from '../config/api';
import Button from '../components/Button';

const AnnouncementScreen = ({ navigation, route }) => {
  const { course } = route.params || {};
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [isClassCancelled, setIsClassCancelled] = useState(false);

  const handleSendAnnouncement = async () => {
    // Validation
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title for the announcement');
      return;
    }

    if (!message.trim()) {
      Alert.alert('Error', 'Please enter a message for the announcement');
      return;
    }

    if (!course) {
      Alert.alert('Error', 'Course information is missing');
      return;
    }

    try {
      setSending(true);
      const token = await AsyncStorage.getItem('@auth_token');
      if (!token) {
        Alert.alert('Error', 'Authentication required');
        return;
      }

      const courseId = course.id || course._id;
      const response = await fetch(getApiUrl('notifications/send'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          courseId,
          title: title.trim(),
          message: message.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        Alert.alert(
          'Success',
          `Announcement sent to ${data.data.recipientCount} students`,
          [
            {
              text: 'OK',
              onPress: () => {
                // Clear form and go back
                setTitle('');
                setMessage('');
                navigation.goBack();
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', data.message || 'Failed to send announcement');
      }
    } catch (error) {
      console.error('Error sending announcement:', error);
      Alert.alert('Error', 'Failed to send announcement. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const courseName = course?.course_name || course?.courseName || 'Course';
  const courseCode = course?.course_code || course?.courseCode || '';

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Send Announcement</Text>
          <Text style={styles.headerSubtitle}>
            {courseCode} - {courseName}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formContainer}>
          {/* Quick Action Tags */}
          <View style={styles.tagsContainer}>
            <Text style={styles.tagsLabel}>Quick Actions:</Text>
            <TouchableOpacity
              style={styles.tagButton}
              onPress={() => {
                setIsClassCancelled(true);
                setTitle('Class Cancelled');
                setMessage(`The ${courseName} class has been cancelled. Go and sleep, UCC is stressful 😂💔`);
              }}
            >
              <Ionicons name="close-circle" size={16} color="#ef4444" />
              <Text style={styles.tagText}>Class Cancelled</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={[styles.input, isClassCancelled && styles.inputDisabled]}
              placeholder="Enter announcement title"
              placeholderTextColor="#9ca3af"
              value={title}
              onChangeText={setTitle}
              maxLength={100}
              editable={!isClassCancelled}
            />
            <Text style={styles.charCount}>{title.length}/100</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Message *</Text>
            <TextInput
              style={[styles.input, styles.textArea, isClassCancelled && styles.inputDisabled]}
              placeholder="Enter your announcement message"
              placeholderTextColor="#9ca3af"
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
              maxLength={1000}
              editable={!isClassCancelled}
            />
            <Text style={styles.charCount}>{message.length}/1000</Text>
          </View>

          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={20} color="#2563eb" />
            <Text style={styles.infoText}>
              This announcement will be sent to all students enrolled in this course.
            </Text>
          </View>

          <Button
            title={sending ? 'Sending...' : 'Send Announcement'}
            onPress={handleSendAnnouncement}
            variant="primary"
            disabled={sending || !title.trim() || !message.trim()}
            style={styles.sendButton}
          />
        </View>
      </ScrollView>
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
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#dbeafe',
  },
  content: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollContent: {
    padding: 20,
  },
  formContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
  },
  inputDisabled: {
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
    opacity: 0.7,
  },
  textArea: {
    minHeight: 120,
    paddingTop: 12,
  },
  charCount: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'right',
    marginTop: 4,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#1e40af',
    lineHeight: 18,
  },
  sendButton: {
    marginTop: 8,
  },
  tagsContainer: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tagsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    alignSelf: 'flex-start',
  },
  tagText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#dc2626',
  },
});

export default AnnouncementScreen;

