import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOffline } from '../context/OfflineContext';

export default function OfflineBadge() {
  const isOffline = useOffline();
  const insets = useSafeAreaInsets();

  if (!isOffline) return null;

  return (
    <View style={[styles.badge, { paddingTop: Math.max(8, insets.top) }]}>
      <View style={styles.dot} />
      <Text style={styles.text}>Offline</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: '#374151',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fbbf24',
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
});
