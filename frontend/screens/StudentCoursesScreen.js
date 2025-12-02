import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Button from '../components/Button';

const StudentCoursesScreen = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  // Mock data - in real app, this would come from context or API
  const enrolledCourses = [];

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      
      {/* Blue Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Courses</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color="#9ca3af" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search your enrolled courses..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9ca3af"
          />
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('StudentAddCourse')}
        >
          <Ionicons name="add" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* My Courses Section */}
        <Text style={styles.sectionTitle}>My Courses</Text>

        {enrolledCourses.length > 0 ? (
          <View>
            {/* Course list would go here */}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <View style={styles.documentIcon}>
                <Ionicons name="document-text" size={60} color="#ffffff" />
                <View style={styles.questionMarkContainer}>
                  <Ionicons name="help-circle" size={32} color="#ffffff" />
                </View>
              </View>
            </View>
            <Text style={styles.emptyTitle}>No Enrolled Courses</Text>
            <Text style={styles.emptyDescription}>
              You haven't enrolled in any courses yet. Add a course to get started.
            </Text>
            <Button
              title="Add Course"
              onPress={() => navigation.navigate('StudentAddCourse')}
              variant="primary"
              style={styles.addCourseButton}
            />
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('StudentHome')}
        >
          <Ionicons name="home-outline" size={24} color="#6b7280" />
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <View style={styles.activeNavItemContainer}>
            <View style={styles.activeNavBorder}>
              <Ionicons name="book" size={24} color="#2563eb" />
            </View>
            <Text style={[styles.navLabel, styles.navLabelActive]}>Courses</Text>
          </View>
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
    backgroundColor: '#ffffff',
  },
  header: {
    backgroundColor: '#2563eb',
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  searchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: '#ffffff',
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 20,
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
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  addCourseButton: {
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
  activeNavItemContainer: {
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#111827',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  activeNavBorder: {
    marginBottom: 4,
  },
  navLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  navLabelActive: {
    color: '#111827',
    fontWeight: '600',
  },
});

export default StudentCoursesScreen;

