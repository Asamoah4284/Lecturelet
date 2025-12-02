import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Switch,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Button from '../components/Button';

const SettingsScreen = ({ navigation }) => {
  const [dailyNotifications, setDailyNotifications] = useState(true);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      
      {/* Blue Header */}
      <View style={styles.header} />

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* User Header Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>A</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>agcdjue</Text>
            <Text style={styles.profileEmail}>agbemaflec918@gmail.com</Text>
            <Text style={styles.profileRole}>Course Representative</Text>
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('RoleSelect')}>
            <View style={styles.settingLeft}>
              <Ionicons name="person-outline" size={20} color="#6b7280" />
              <Text style={styles.settingLabel}>Change Role</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="notifications-outline" size={20} color="#6b7280" />
              <Text style={styles.settingLabel}>Daily Notifications</Text>
            </View>
            <Switch
              value={dailyNotifications}
              onValueChange={setDailyNotifications}
              trackColor={{ false: '#d1d5db', true: '#22c55e' }}
              thumbColor="#ffffff"
            />
          </View>
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>

          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="help-circle-outline" size={20} color="#6b7280" />
              <Text style={styles.settingLabel}>Help & Support</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="shield-outline" size={20} color="#6b7280" />
              <Text style={styles.settingLabel}>Privacy Policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* Logout Button + Version */}
        <TouchableOpacity style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>Version 1.0.0</Text>
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
        <TouchableOpacity style={styles.navItem}>
          <View style={styles.navIconContainer}>
            <Ionicons name="settings" size={24} color="#2563eb" />
            <Ionicons name="arrow-up" size={12} color="#2563eb" style={styles.navIconArrow} />
          </View>
          <Text style={[styles.navLabel, styles.navLabelActive]}>Settings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f9fafb',
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
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 0,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarInitial: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 2,
  },
  profileRole: {
    fontSize: 11,
    color: '#2563eb',
    fontWeight: '500',
  },
  section: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  settingLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
  },
  logoutButton: {
    marginTop: 24,
    marginHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ef4444',
  },
  versionText: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 11,
    color: '#9ca3af',
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

export default SettingsScreen;

