import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from '../config/api';

/**
 * Hook to get unread notification count
 * Updates automatically when screen comes into focus
 */
export const useUnreadNotifications = (navigation) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchUnreadCount = async () => {
    try {
      const token = await AsyncStorage.getItem('@auth_token');
      if (!token) {
        setUnreadCount(0);
        setLoading(false);
        return;
      }

      const response = await fetch(getApiUrl('notifications/unread-count'), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setUnreadCount(data.data.count || 0);
      } else {
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
  }, []);

  // Reload when screen comes into focus
  useEffect(() => {
    if (!navigation) return;
    
    const unsubscribe = navigation.addListener('focus', () => {
      fetchUnreadCount();
    });
    
    return unsubscribe;
  }, [navigation]);

  return { unreadCount, loading, refresh: fetchUnreadCount };
};

