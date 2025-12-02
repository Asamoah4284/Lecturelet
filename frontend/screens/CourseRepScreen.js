import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Button from '../components/Button';

const CourseRepScreen = ({ navigation }) => {
  // Get current date
  const getCurrentDate = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = days[date.getDay()];
    return `${year}-${month}-${day} • ${dayName}`;
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      
      {/* Blue Header */}
      <View style={styles.header} />

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Greeting Section */}
        <View style={styles.greetingRow}>
          <View style={styles.greetingLeft}>
            <Text style={styles.greeting}>Hello, agcdjue</Text>
            <Text style={styles.roleText}>Course Representative</Text>
            <View style={styles.dateRow}>
              <Ionicons name="calendar-outline" size={16} color="#2563eb" style={styles.calendarIcon} />
              <Text style={styles.dateText}>{getCurrentDate()}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('AddCourse')}>
            <Ionicons name="add" size={28} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Published Courses</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>

        {/* Empty State */}
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
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.replace('CourseRep')}
        >
          <View style={styles.navIconContainer}>
            <Ionicons name="home" size={24} color="#2563eb" />
            <Ionicons name="arrow-up" size={12} color="#2563eb" style={styles.navIconArrow} />
          </View>
          <Text style={[styles.navLabel, styles.navLabelActive]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('Courses')}
        >
          <Ionicons name="book-outline" size={24} color="#6b7280" />
          <Text style={styles.navLabel}>Courses</Text>
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
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  greetingLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  roleText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calendarIcon: {
    marginRight: 6,
  },
  dateText: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '500',
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  seeAllText: {
    fontSize: 14,
    color: '#2563eb',
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

export default CourseRepScreen;

