import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  FlatList,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Button from '../components/Button';

const CoursesScreen = ({ navigation }) => {
  // Mock data - in real app, this would come from context or API
  const courses = [];

  const renderCourseItem = ({ item }) => (
    <View style={styles.courseCard}>
      <View style={styles.courseHeader}>
        <View style={styles.courseIconContainer}>
          <Ionicons name="book" size={24} color="#2563eb" />
        </View>
        <View style={styles.courseInfo}>
          <Text style={styles.courseName}>{item.name}</Text>
          <Text style={styles.courseCode}>{item.code}</Text>
        </View>
        <TouchableOpacity>
          <Ionicons name="ellipsis-vertical" size={20} color="#6b7280" />
        </TouchableOpacity>
      </View>
      <View style={styles.courseDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={16} color="#6b7280" />
          <Text style={styles.detailText}>{item.time}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={16} color="#6b7280" />
          <Text style={styles.detailText}>{item.day}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={16} color="#6b7280" />
          <Text style={styles.detailText}>{item.location}</Text>
        </View>
      </View>
      <View style={styles.courseFooter}>
        <View style={styles.studentCount}>
          <Ionicons name="people-outline" size={16} color="#6b7280" />
          <Text style={styles.studentCountText}>{item.students} students</Text>
        </View>
        <TouchableOpacity style={styles.viewButton}>
          <Text style={styles.viewButtonText}>View Details</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      
      {/* Blue Header */}
      <View style={styles.header} />

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {courses.length > 0 ? (
          <FlatList
            data={courses}
            renderItem={renderCourseItem}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="book-outline" size={80} color="#d1d5db" />
            </View>
            <Text style={styles.emptyTitle}>No Courses Yet</Text>
            <Text style={styles.emptyDescription}>
              You haven't created any courses yet. Create your first course to get started.
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
    backgroundColor: '#ffffff',
  },
  header: {
    backgroundColor: '#2563eb',
    paddingTop: 16,
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
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  courseCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  courseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  courseIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  courseInfo: {
    flex: 1,
  },
  courseName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  courseCode: {
    fontSize: 12,
    color: '#6b7280',
  },
  courseDetails: {
    marginBottom: 12,
    gap: 8,
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
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  studentCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  studentCountText: {
    fontSize: 12,
    color: '#6b7280',
  },
  viewButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
  },
  viewButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
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

