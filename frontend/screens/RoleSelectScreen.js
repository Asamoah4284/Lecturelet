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

const RoleSelectScreen = ({ navigation }) => {
  const handleSelectRole = (role) => {
    if (role === 'rep') {
      navigation.replace('CourseRep');
    } else {
      navigation.replace('StudentHome');
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoWrapper}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>L</Text>
            <Text style={styles.logoDot}>●</Text>
            <Text style={styles.logoText}>L</Text>
          </View>
        </View>

        {/* Title */}
        <View style={styles.header}>
          <Text style={styles.appName}>LectureLet</Text>
          <Text style={styles.title}>Select Your Role</Text>
          <Text style={styles.subtitle}>
            Choose your role to personalize your experience
          </Text>
        </View>

        {/* Role cards */}
        <View style={styles.cardContainer}>
          <TouchableOpacity
            style={styles.roleCard}
            activeOpacity={0.9}
            onPress={() => handleSelectRole('student')}
          >
            <View style={[styles.roleIconWrapper, styles.roleIconStudent]}>
              <Ionicons name="school-outline" size={24} color="#0ea5e9" />
            </View>
            <View style={styles.roleTextArea}>
              <Text style={styles.roleTitle}>Student</Text>
              <Text style={styles.roleBody}>
                Join courses, view timetables, and receive notifications for
                your lectures.
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.roleCard}
            activeOpacity={0.9}
            onPress={() => handleSelectRole('rep')}
          >
            <View style={[styles.roleIconWrapper, styles.roleIconRep]}>
              <Ionicons name="people-outline" size={24} color="#f97316" />
            </View>
            <View style={styles.roleTextArea}>
              <Text style={styles.roleTitle}>Course Representative</Text>
              <Text style={styles.roleBody}>
                Create and manage courses, and generate course codes for
                students.
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.noteText}>
          Note: You can change your role later in the settings.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 32,
  },
  logoWrapper: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#f97316',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 20,
  },
  logoDot: {
    color: '#ffffff',
    fontSize: 10,
    marginHorizontal: 6,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  appName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  cardContainer: {
    marginTop: 8,
    gap: 16,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 18,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 4,
  },
  roleIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  roleIconStudent: {
    backgroundColor: '#e0f2fe',
  },
  roleIconRep: {
    backgroundColor: '#ffedd5',
  },
  roleIconEmoji: {
    fontSize: 24,
  },
  roleTextArea: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  roleBody: {
    fontSize: 13,
    color: '#6b7280',
  },
  noteText: {
    marginTop: 20,
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
  },
});

export default RoleSelectScreen;


