import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

const StudentAddCourseScreen = ({ navigation }) => {
  const [uniqueCode, setUniqueCode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const handleSubmitCode = () => {
    // Handle unique code submission
    console.log('Submitting code:', uniqueCode);
  };

  const handleAddCourse = () => {
    // Handle add course action
    console.log('Adding course');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* Blue Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Course</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Enter Unique Course Code Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Enter Unique Course Code</Text>
          <Text style={styles.sectionDescription}>
            Enter the unique course code provided by your course representative
          </Text>
          <View style={styles.codeInputContainer}>
            <TextInput
              style={styles.codeInput}
              placeholder="Enter unique code (e.g., ABC123)"
              value={uniqueCode}
              onChangeText={setUniqueCode}
              placeholderTextColor="#9ca3af"
            />
            <TouchableOpacity
              style={styles.submitCodeButton}
              onPress={handleSubmitCode}
            >
              <Ionicons name="arrow-forward" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Courses Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Search Courses</Text>
          <Text style={styles.sectionDescription}>
            Search by course name, unique code, or course representative
          </Text>
          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={20} color="#9ca3af" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search courses..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#9ca3af"
            />
          </View>
          <Text style={styles.searchHint}>Type to search for available courses</Text>
        </View>
      </ScrollView>

      {/* Bottom Add Course Button */}
      <View style={styles.bottomButtonContainer}>
        <TouchableOpacity style={styles.addCourseButton} onPress={handleAddCourse}>
          <Text style={styles.addCourseButtonText}>Add Course</Text>
        </TouchableOpacity>
      </View>
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
    fontSize: 14,
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
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 18,
  },
  codeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  codeInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1f2937',
  },
  submitCodeButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1f2937',
    padding: 0,
  },
  searchHint: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
  },
  bottomButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  addCourseButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCourseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
});

export default StudentAddCourseScreen;

