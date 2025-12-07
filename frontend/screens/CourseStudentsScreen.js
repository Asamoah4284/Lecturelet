import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from '../config/api';
import Button from '../components/Button';

const CourseStudentsScreen = ({ navigation, route }) => {
  const course = route.params?.course;
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [addingStudent, setAddingStudent] = useState(false);
  const [removingStudentId, setRemovingStudentId] = useState(null);

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      const token = await AsyncStorage.getItem('@auth_token');
      if (!token) {
        setError('Not authenticated. Please log in again.');
        setLoading(false);
        return;
      }

      const response = await fetch(getApiUrl(`courses/${course.id || course._id}/students`), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStudents(data.data.students || []);
        setError('');
      } else {
        setError(data.message || 'Failed to load students');
        setStudents([]);
      }
    } catch (err) {
      console.error('Error loading students:', err);
      setError('An error occurred. Please try again.');
      setStudents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadStudents();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleAddStudent = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Validation Error', 'Please enter a phone number');
      return;
    }

    setAddingStudent(true);

    try {
      const token = await AsyncStorage.getItem('@auth_token');
      if (!token) {
        Alert.alert('Error', 'Not authenticated. Please log in again.');
        return;
      }

      const response = await fetch(getApiUrl(`courses/${course.id || course._id}/students`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        Alert.alert('Success', data.message || 'Student added successfully');
        setPhoneNumber('');
        setShowAddModal(false);
        loadStudents(); // Refresh the list
      } else {
        Alert.alert('Error', data.message || 'Failed to add student');
      }
    } catch (err) {
      console.error('Error adding student:', err);
      Alert.alert('Error', 'An error occurred. Please try again.');
    } finally {
      setAddingStudent(false);
    }
  };

  const handleRemoveStudent = (studentId, studentName) => {
    Alert.alert(
      'Remove Student',
      `Are you sure you want to remove ${studentName} from this course?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemovingStudentId(studentId);
            try {
              const token = await AsyncStorage.getItem('@auth_token');
              if (!token) {
                Alert.alert('Error', 'Not authenticated. Please log in again.');
                return;
              }

              const response = await fetch(
                getApiUrl(`courses/${course.id || course._id}/students/${studentId}`),
                {
                  method: 'DELETE',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                  },
                }
              );

              const data = await response.json();

              if (response.ok && data.success) {
                Alert.alert('Success', 'Student removed successfully');
                loadStudents(); // Refresh the list
              } else {
                Alert.alert('Error', data.message || 'Failed to remove student');
              }
            } catch (err) {
              console.error('Error removing student:', err);
              Alert.alert('Error', 'An error occurred. Please try again.');
            } finally {
              setRemovingStudentId(null);
            }
          },
        },
      ]
    );
  };

  // Filter students based on search query
  const filteredStudents = students.filter((student) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      (student.full_name && student.full_name.toLowerCase().includes(query)) ||
      (student.phone_number && student.phone_number.includes(query)) ||
      (student.student_id && student.student_id.toLowerCase().includes(query))
    );
  });

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      
      {/* Blue Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Enrolled Students</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {course?.course_name || course?.courseName || 'Course'}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Search Bar and Add Button */}
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={20} color="#9ca3af" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search students..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#9ca3af"
            />
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddModal(true)}
          >
            <Ionicons name="add" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Student Count */}
        <View style={styles.countContainer}>
          <View style={styles.countCard}>
            <Ionicons name="people" size={24} color="#2563eb" />
            <View style={styles.countTextContainer}>
              <Text style={styles.countNumber}>
                {searchQuery.trim() ? filteredStudents.length : students.length}
              </Text>
              <Text style={styles.countLabel}>
                {searchQuery.trim()
                  ? `${filteredStudents.length === 1 ? 'Student' : 'Students'} Found`
                  : `${students.length === 1 ? 'Student' : 'Students'} Enrolled`}
              </Text>
            </View>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loadingText}>Loading students...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={48} color="#dc2626" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={loadStudents}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : students.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="people-outline" size={80} color="#d1d5db" />
            </View>
            <Text style={styles.emptyTitle}>No Students Enrolled</Text>
            <Text style={styles.emptyDescription}>
              No students have enrolled in this course yet. Share the course code with students to get started.
            </Text>
          </View>
        ) : filteredStudents.length === 0 && searchQuery.trim() ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No Students Found</Text>
            <Text style={styles.emptyDescription}>
              No students match your search query. Try a different search term.
            </Text>
          </View>
        ) : (
          <View style={styles.studentsList}>
            {filteredStudents.map((student, index) => {
              // Generate a color based on index for variety
              const colors = [
                { border: '#3b82f6', bg: '#eff6ff', avatar: '#dbeafe', avatarBorder: '#3b82f6' }, // Blue
                { border: '#10b981', bg: '#ecfdf5', avatar: '#d1fae5', avatarBorder: '#10b981' }, // Green
                { border: '#f59e0b', bg: '#fffbeb', avatar: '#fde68a', avatarBorder: '#f59e0b' }, // Amber
                { border: '#8b5cf6', bg: '#f5f3ff', avatar: '#e9d5ff', avatarBorder: '#8b5cf6' }, // Purple
                { border: '#ef4444', bg: '#fef2f2', avatar: '#fecaca', avatarBorder: '#ef4444' }, // Red
                { border: '#06b6d4', bg: '#ecfeff', avatar: '#a5f3fc', avatarBorder: '#06b6d4' }, // Cyan
              ];
              const colorScheme = colors[index % colors.length];
              return (
              <View 
                key={student.id || index} 
                style={[styles.studentCard, { borderLeftColor: colorScheme.border, backgroundColor: colorScheme.bg }]}
              >
                <View style={styles.studentNumber}>
                  <Text style={styles.studentNumberText}>#{index + 1}</Text>
                </View>
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName} numberOfLines={1}>
                    {student.full_name || 'Unknown Student'}
                  </Text>
                  <View style={styles.studentMetaRow}>
                    {student.student_id && (
                      <View style={styles.metaItem}>
                        <Ionicons name="id-card-outline" size={12} color="#6b7280" />
                        <Text style={styles.metaText}>{student.student_id}</Text>
                      </View>
                    )}
                    <View style={styles.metaItem}>
                      <Ionicons name="call-outline" size={12} color="#6b7280" />
                      <Text style={styles.metaText} numberOfLines={1}>
                        {student.phone_number || 'N/A'}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.enrollmentDate}>
                  <Ionicons name="calendar-outline" size={14} color="#6b7280" />
                  <Text style={styles.enrollmentDateText}>
                    {formatDate(student.enrolled_at)}
                  </Text>
                </View>
              
              </View>
            );
            })}
          </View>
        )}
      </ScrollView>

      {/* Add Student Modal */}
      <Modal
        visible={showAddModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Student</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  setShowAddModal(false);
                  setPhoneNumber('');
                }}
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalDescription}>
              Enter the phone number of the student you want to add to this course.
            </Text>
            <View style={styles.modalInputContainer}>
              <Text style={styles.modalLabel}>Phone Number</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter phone number"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                placeholderTextColor="#9ca3af"
                autoFocus
              />
            </View>
            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                onPress={() => {
                  setShowAddModal(false);
                  setPhoneNumber('');
                }}
                variant="secondary"
                style={styles.modalCancelButton}
                disabled={addingStudent}
              />
              <Button
                title={addingStudent ? 'Adding...' : 'Add Student'}
                onPress={handleAddStudent}
                variant="primary"
                style={styles.modalAddButton}
                disabled={addingStudent}
              />
            </View>
          </View>
        </View>
      </Modal>
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
  },
  backButton: {
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  headerSubtitle: {
    color: '#bfdbfe',
    fontSize: 13,
  },
  headerSpacer: {
    width: 36,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  countContainer: {
    marginBottom: 24,
  },
  countCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  countTextContainer: {
    marginLeft: 12,
  },
  countNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2563eb',
  },
  countLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
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
    marginTop: 12,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
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
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  studentsList: {
    gap: 10,
  },
  studentCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 70,
    borderLeftWidth: 4,
  },
  studentNumber: {
    backgroundColor: '#fef3c7',
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#fbbf24',
  },
  studentNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#d97706',
  },
  studentInfo: {
    flex: 1,
    marginRight: 8,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  studentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  metaText: {
    fontSize: 11,
    color: '#0369a1',
    fontWeight: '500',
    maxWidth: 120,
  },
  enrollmentDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: 4,
    backgroundColor: '#f0fdf4',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  enrollmentDateText: {
    fontSize: 11,
    color: '#166534',
    fontWeight: '500',
  },
  removeButton: {
    padding: 6,
    marginLeft: 8,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  searchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
    lineHeight: 20,
  },
  modalInputContainer: {
    marginBottom: 24,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
    marginBottom: 8,
  },
  modalInput: {
    height: 44,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    fontSize: 14,
    color: '#111827',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
  },
  modalAddButton: {
    flex: 1,
  },
});

export default CourseStudentsScreen;

