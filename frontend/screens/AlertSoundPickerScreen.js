/**
 * Alert Sound Picker Screen
 * TradingView-style: list alert sounds, preview on tap, select one, persist to Firestore via API.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import {
  NOTIFICATION_SOUND_IDS,
  getSoundFileName,
} from '../config/notificationSounds';
import { getApiUrl } from '../config/api';
import { createNotificationChannel, getChannelIdForSound } from '../services/notificationService';

const SOUND_OPTIONS = [
  { value: 'default', label: 'Default', icon: 'notifications-outline' },
  { value: 'r1', label: 'Sound 1', icon: 'musical-notes' },
  { value: 'r2', label: 'Sound 2', icon: 'volume-high' },
  { value: 'r3', label: 'Sound 3', icon: 'radio-button-on' },
  { value: 'none', label: 'None (Silent)', icon: 'volume-mute' },
];

const AlertSoundPickerScreen = ({ navigation }) => {
  const [selectedSound, setSelectedSound] = useState('default');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSavedSound = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('@auth_token');
      const stored = await AsyncStorage.getItem('@notification_sound');
      if (stored) setSelectedSound(stored);
      if (token) {
        const res = await fetch(getApiUrl('auth/profile'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const sound = data.user?.notification_sound ?? data.notification_sound ?? stored;
          if (sound) setSelectedSound(sound);
        }
      }
    } catch (e) {
      console.warn('Load sound preference failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSavedSound();
  }, [loadSavedSound]);

  const previewSound = async (soundValue) => {
    if (soundValue === 'none') return;
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') return;
      await createNotificationChannel(true);
      let soundFile = true;
      if (NOTIFICATION_SOUND_IDS.includes(soundValue)) {
        const fn = getSoundFileName(soundValue);
        soundFile = fn || true;
      }
      const channelId = getChannelIdForSound(soundValue);
      const content = {
        title: 'Alert sound',
        body: soundValue === 'default' ? 'Default' : soundValue,
        sound: soundFile,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        ...(Platform.OS === 'android' && channelId && { channelId }),
      };
      await Notifications.scheduleNotificationAsync({
        content,
        trigger: null, // Immediate delivery on first tap
      });
    } catch (e) {
      console.warn('Preview sound failed', e);
    }
  };

  const selectAndSave = async (soundValue) => {
    setSelectedSound(soundValue);
    setSaving(true);
    try {
      await AsyncStorage.setItem('@notification_sound', soundValue);
      const token = await AsyncStorage.getItem('@auth_token');
      if (token) {
        const res = await fetch(getApiUrl('auth/profile'), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ notificationSound: soundValue }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || 'Save failed');
        }
        const userDataString = await AsyncStorage.getItem('@user_data');
        if (userDataString) {
          const userData = JSON.parse(userDataString);
          userData.notification_sound = soundValue;
          await AsyncStorage.setItem('@user_data', JSON.stringify(userData));
        }
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not save preference.');
    } finally {
      setSaving(false);
    }
  };

  const onPressOption = (soundValue) => {
    previewSound(soundValue);
    selectAndSave(soundValue);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Alert sound</Text>
        <Text style={styles.subtitle}>Tap to preview and select. Used for FCM alerts.</Text>
      </View>
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {SOUND_OPTIONS.map((opt) => {
          const isSelected = selectedSound === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.option, isSelected && styles.optionSelected]}
              onPress={() => onPressOption(opt.value)}
              disabled={saving}
              activeOpacity={0.7}
            >
              <View style={styles.optionLeft}>
                <Ionicons
                  name={opt.icon}
                  size={22}
                  color={isSelected ? '#2563eb' : '#6b7280'}
                />
                <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                  {opt.label}
                </Text>
              </View>
              {isSelected && (
                <Ionicons name="checkmark-circle" size={26} color="#2563eb" />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  optionSelected: {
    backgroundColor: '#eff6ff',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionLabel: {
    fontSize: 16,
    color: '#374151',
  },
  optionLabelSelected: {
    color: '#2563eb',
    fontWeight: '600',
  },
});

export default AlertSoundPickerScreen;
