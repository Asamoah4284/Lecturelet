import React, { useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import CourseCard from '../components/CourseCard';
import Button from '../components/Button';
import CourseContext from '../context/CourseContext';

const CourseListScreen = ({ navigation }) => {
  const { courses, loading, deleteCourse } = useContext(CourseContext);

  const handleDelete = (courseId) => {
    Alert.alert(
      'Delete Course',
      'Are you sure you want to delete this course?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteCourse(courseId),
        },
      ]
    );
  };

  const handleEdit = (course) => {
    navigation.navigate('AddCourse', { course });
  };

  const renderCourse = ({ item }) => (
    <CourseCard
      course={item}
      onPress={() => handleEdit(item)}
      onDelete={handleDelete}
    />
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading your courses...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const hasCourses = courses.length > 0;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />

      {/* Top header area */}
      <View style={styles.headerArea}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>L</Text>
          <Ionicons name="notifications-outline" size={16} color="#ffffff" style={styles.logoIcon} />
          <Text style={styles.logoText}>L</Text>
        </View>
        <Text style={styles.title}>LectureLet</Text>
        <Text style={styles.subtitle}>
          Manage and track all your lectures in one place.
        </Text>
      </View>

      {/* White content card */}
      <View style={styles.cardArea}>
        {hasCourses ? (
          <>
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={styles.cardTitle}>Current timetable</Text>
                <Text style={styles.cardSubtitle}>
                  {courses.length} {courses.length === 1 ? 'course' : 'courses'} scheduled
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => navigation.navigate('AddCourse')}
                style={styles.addLinkButton}
              >
                <Text style={styles.addLinkText}>+ Add course</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={courses}
              renderItem={renderCourse}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
            />
          </>
        ) : (
          <>
            <View style={styles.featuresTopSpacer} />

            <View style={styles.featureRow}>
              <View style={[styles.featureIcon, styles.featureIconBlue]}>
                <Ionicons name="book-outline" size={24} color="#2563eb" />
              </View>
              <View style={styles.featureTextArea}>
                <Text style={styles.featureTitle}>Course Management</Text>
                <Text style={styles.featureBody}>
                  Easily manage and track all your courses in one place.
                </Text>
              </View>
            </View>

            <View style={styles.featureRow}>
              <View style={[styles.featureIcon, styles.featureIconOrange]}>
                <Ionicons name="notifications-outline" size={24} color="#f97316" />
              </View>
              <View style={styles.featureTextArea}>
                <Text style={styles.featureTitle}>Smart Notifications</Text>
                <Text style={styles.featureBody}>
                  Get reminders before your lectures start.
                </Text>
              </View>
            </View>

            <View style={styles.featureRow}>
              <View style={[styles.featureIcon, styles.featureIconGreen]}>
                <Ionicons name="calendar-outline" size={24} color="#10b981" />
              </View>
              <View style={styles.featureTextArea}>
                <Text style={styles.featureTitle}>Timetable View</Text>
                <Text style={styles.featureBody}>
                  View your week in a clean, organized timetable.
                </Text>
              </View>
            </View>

            <Button
              title="Get Started"
              onPress={() => navigation.navigate('Signup')}
              variant="primary"
              style={styles.primaryCta}
            />

            
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#020617',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#9ca3af',
  },
  headerArea: {
    paddingTop: 32,
    paddingBottom: 32,
    paddingHorizontal: 24,
    backgroundColor: '#111827',
    alignItems: 'center',
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#f97316',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 20,
  },
  logoIcon: {
    marginHorizontal: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#f9fafb',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  cardArea: {
    flex: 1,
    backgroundColor: '#f9fafb',
    marginTop: 32,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  featuresTopSpacer: {
    height: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  addLinkButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#e5edff',
  },
  addLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
  },
  listContent: {
    paddingBottom: 24,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  featureIconBlue: {
    backgroundColor: '#e0f2fe',
  },
  featureIconOrange: {
    backgroundColor: '#ffedd5',
  },
  featureIconGreen: {
    backgroundColor: '#dcfce7',
  },
  featureEmoji: {
    fontSize: 22,
  },
  featureTextArea: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  featureBody: {
    fontSize: 13,
    color: '#6b7280',
  },
  primaryCta: {
    marginTop: 8,
    marginBottom: 12,
  },
  secondaryLinkWrapper: {
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryLinkText: {
    fontSize: 13,
    color: '#6b7280',
  },
  secondaryLinkStrong: {
    color: '#2563eb',
    fontWeight: '600',
  },
});

export default CourseListScreen;

