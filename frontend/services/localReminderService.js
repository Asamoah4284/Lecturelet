import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from '../config/api';

// Import sound files to ensure they're bundled with the app
// These are required so Expo includes them in the build
require('../assets/sounds/r1.wav');
require('../assets/sounds/r2.wav');
require('../assets/sounds/r3.wav');

const NOTIFICATION_PREFIX = 'local_reminder_';
const SCHEDULED_NOTIFICATIONS_KEY = '@scheduled_reminders';
const LAST_SYNC_KEY = '@last_reminder_sync';

/**
 * Get day name from date
 * @param {Date} date - Date object
 * @returns {string} Day name
 */
const getDayName = (date) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
};

/**
 * Parse time string (e.g., "10:00 AM" or "14:30") to Date object
 * @param {string} timeStr - Time string
 * @param {Date} date - Date object to set time on
 * @returns {Date|null} Date object with time set, or null if invalid
 */
const parseTime = (timeStr, date) => {
  if (!timeStr) return null;
  
  try {
    // Try to parse as 12-hour format (e.g., "10:00 AM")
    const time12Hour = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (time12Hour) {
      let hours = parseInt(time12Hour[1], 10);
      const minutes = parseInt(time12Hour[2], 10);
      const ampm = time12Hour[3].toUpperCase();
      
      if (ampm === 'PM' && hours !== 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
      
      const result = new Date(date);
      result.setHours(hours, minutes, 0, 0);
      return result;
    }
    
    // Try to parse as 24-hour format (e.g., "14:30")
    const time24Hour = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (time24Hour) {
      const hours = parseInt(time24Hour[1], 10);
      const minutes = parseInt(time24Hour[2], 10);
      
      const result = new Date(date);
      result.setHours(hours, minutes, 0, 0);
      return result;
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing time:', timeStr, error);
    return null;
  }
};

/**
 * Calculate the next occurrence of a class for the next 7 days
 * @param {Object} course - Course object
 * @param {Date} fromDate - Date to calculate from (default: now)
 * @returns {Array<{date: Date, courseId: string, courseName: string}>} Array of upcoming class occurrences
 */
const calculateUpcomingClasses = (course, fromDate = new Date()) => {
  try {
    const days = course.days || [];
    if (days.length === 0) return [];
    
    const dayTimes = course.day_times || course.dayTimes || {};
    const hasDayTimes = Object.keys(dayTimes).length > 0;
    
    const upcomingClasses = [];
    
    // Check next 7 days
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(fromDate);
      checkDate.setDate(checkDate.getDate() + i);
      const dayName = getDayName(checkDate);
      
      if (!days.includes(dayName)) continue;
      
      let startTime = null;
      
      // Use dayTimes if available, otherwise fall back to course startTime
      if (hasDayTimes && dayTimes[dayName]) {
        startTime = parseTime(dayTimes[dayName].startTime, checkDate);
      } else {
        startTime = parseTime(course.start_time || course.startTime, checkDate);
      }
      
      // Only include future classes
      if (startTime && startTime.getTime() > fromDate.getTime()) {
        upcomingClasses.push({
          date: startTime,
          courseId: course.id || course._id,
          courseName: course.course_name || course.courseName,
          updatedAt: course.updated_at || course.updatedAt,
          indexFrom: course.index_from || course.indexFrom,
          indexTo: course.index_to || course.indexTo,
        });
      }
    }
    
    return upcomingClasses;
  } catch (error) {
    console.error('Error calculating upcoming classes:', error);
    return [];
  }
};

/**
 * Generate notification identifier
 * @param {string} courseId - Course ID
 * @param {Date} classDate - Class date/time
 * @returns {string} Notification identifier
 */
const generateNotificationId = (courseId, classDate) => {
  const timestamp = classDate.getTime();
  return `${NOTIFICATION_PREFIX}${courseId}_${timestamp}`;
};

/**
 * Cancel all local reminder notifications for a specific course
 * @param {string} courseId - Course ID
 * @returns {Promise<void>}
 */
export const cancelCourseReminders = async (courseId) => {
  try {
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    
    for (const notification of scheduledNotifications) {
      if (notification.identifier.startsWith(NOTIFICATION_PREFIX)) {
        const data = notification.content.data || {};
        if (data.courseId === courseId || notification.identifier.includes(`_${courseId}_`)) {
          await Notifications.cancelScheduledNotificationAsync(notification.identifier);
          console.log(`Cancelled reminder notification: ${notification.identifier}`);
        }
      }
    }
    
    // Update stored notifications cache
    const stored = await AsyncStorage.getItem(SCHEDULED_NOTIFICATIONS_KEY);
    if (stored) {
      const notifications = JSON.parse(stored);
      const filtered = notifications.filter(
        (n) => !n.identifier.includes(`_${courseId}_`)
      );
      await AsyncStorage.setItem(SCHEDULED_NOTIFICATIONS_KEY, JSON.stringify(filtered));
    }
  } catch (error) {
    console.error('Error cancelling course reminders:', error);
  }
};

/**
 * Schedule a local reminder notification
 * @param {Object} params - Notification parameters
 * @param {string} params.courseId - Course ID
 * @param {string} params.courseName - Course name
 * @param {Date} params.classDate - Class start date/time
 * @param {Date} params.reminderDate - When to show the reminder
 * @param {number} params.reminderMinutes - Minutes before class
 * @param {string} params.indexFrom - Index from (optional)
 * @param {string} params.indexTo - Index to (optional)
 * @returns {Promise<string|null>} Notification identifier or null if failed
 */
const scheduleReminderNotification = async ({
  courseId,
  courseName,
  classDate,
  reminderDate,
  reminderMinutes,
  indexFrom,
  indexTo,
}) => {
  try {
    // Don't schedule if reminder time is in the past
    if (reminderDate.getTime() <= new Date().getTime()) {
      console.log(`Skipping reminder for ${courseName} - reminder time is in the past`);
      return null;
    }
    
    const identifier = generateNotificationId(courseId, classDate);
    
    // Cancel any existing notification with same identifier
    await Notifications.cancelScheduledNotificationAsync(identifier);
    
    // Format index range
    let indexRangeText = '';
    if (indexFrom && indexTo) {
      indexRangeText = ` Index: ${indexFrom} - ${indexTo}.`;
    } else if (indexFrom) {
      indexRangeText = ` Index: ${indexFrom}.`;
    }
    
    // Get user's preferred notification sound
    const soundPreference = await getNotificationSound();
    
    // Map sound preference to notification sound value
    // For Expo notifications:
    // - iOS: Can use system sound names or custom sound files (Asset URI)
    // - Android: Requires custom sound files in assets (Asset URI)
    // - Use false for silent
    let notificationSound = true; // Default to system sound
    
    if (soundPreference === 'none') {
      notificationSound = false; // Silent - no sound
    } else if (soundPreference === 'default') {
      notificationSound = true; // System default sound
    } else if (soundPreference === 'r1' || soundPreference === 'r2' || soundPreference === 'r3') {
      // For Expo notifications, use just the filename (without path)
      // Files in assets/sounds/ are automatically bundled to res/raw/ on Android
      // and to the app bundle on iOS during build
      // The filename must match exactly (case-sensitive)
      const soundFileName = `${soundPreference}.wav`;
      console.log(`Using custom sound for notification: ${soundFileName}`);
      notificationSound = soundFileName;
    } else {
      // Fallback to default system sound for unknown preferences
      notificationSound = true;
    }
    
    const notificationContent = {
      title: 'Class Reminder',
      body: `Your next class, ${courseName}, starts in ${reminderMinutes} minutes.${indexRangeText}`,
      data: {
        type: 'class_reminder',
        courseId: courseId.toString(),
        courseName,
        source: 'local',
        classDate: classDate.toISOString(),
      },
      sound: notificationSound, // true = plays default system sound loudly
      priority: Notifications.AndroidNotificationPriority.HIGH,
    };
    
    const trigger = {
      date: reminderDate,
    };
    
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: notificationContent,
      trigger,
      identifier,
    });
    
    console.log(`Scheduled reminder notification: ${identifier} for ${reminderDate.toISOString()}`);
    
    // Store in cache
    const stored = await AsyncStorage.getItem(SCHEDULED_NOTIFICATIONS_KEY);
    const notifications = stored ? JSON.parse(stored) : [];
    notifications.push({
      identifier,
      courseId: courseId.toString(),
      classDate: classDate.toISOString(),
      reminderDate: reminderDate.toISOString(),
      courseName,
    });
    await AsyncStorage.setItem(SCHEDULED_NOTIFICATIONS_KEY, JSON.stringify(notifications));
    
    return identifier;
  } catch (error) {
    console.error('Error scheduling reminder notification:', error);
    return null;
  }
};

/**
 * Fetch enrolled courses from server
 * @returns {Promise<Array>} Array of enrolled courses
 */
const fetchEnrolledCourses = async () => {
  try {
    const token = await AsyncStorage.getItem('@auth_token');
    if (!token) {
      console.log('No auth token found, cannot fetch courses');
      return [];
    }
    
    const response = await fetch(getApiUrl('enrollments/my-courses'), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      return data.data.courses || [];
    } else {
      console.error('Failed to fetch courses:', data.message);
      return [];
    }
  } catch (error) {
    console.error('Error fetching enrolled courses:', error);
    return [];
  }
};

/**
 * Get user's reminder preference
 * @returns {Promise<number>} Reminder minutes (default: 15)
 */
const getUserReminderPreference = async () => {
  try {
    const userDataString = await AsyncStorage.getItem('@user_data');
    if (userDataString) {
      const userData = JSON.parse(userDataString);
      return userData.reminder_minutes || 15;
    }
    return 15;
  } catch (error) {
    console.error('Error getting reminder preference:', error);
    return 15;
  }
};

/**
 * Get user's notification sound preference
 * @returns {Promise<string>} Notification sound (default: 'default')
 */
const getNotificationSound = async () => {
  try {
    // First try to get from AsyncStorage (direct storage)
    const storedSound = await AsyncStorage.getItem('@notification_sound');
    if (storedSound) {
      return storedSound;
    }
    
    // Fall back to user data
    const userDataString = await AsyncStorage.getItem('@user_data');
    if (userDataString) {
      const userData = JSON.parse(userDataString);
      return userData.notification_sound || 'default';
    }
    return 'default';
  } catch (error) {
    console.error('Error getting notification sound preference:', error);
    return 'default';
  }
};

/**
 * Check if user has notifications enabled
 * @returns {Promise<boolean>} True if notifications enabled
 */
const areNotificationsEnabled = async () => {
  try {
    const userDataString = await AsyncStorage.getItem('@user_data');
    if (userDataString) {
      const userData = JSON.parse(userDataString);
      return userData.notifications_enabled !== false; // Default to true
    }
    return true;
  } catch (error) {
    console.error('Error checking notification preference:', error);
    return true;
  }
};

/**
 * Sync and schedule local reminder notifications
 * @param {number} customReminderMinutes - Optional custom reminder minutes (for preference changes)
 * @returns {Promise<{scheduled: number, cancelled: number}>} Sync result
 */
export const syncAndScheduleReminders = async (customReminderMinutes = null) => {
  try {
    // Check if notifications are enabled
    const notificationsEnabled = await areNotificationsEnabled();
    if (!notificationsEnabled) {
      console.log('Notifications disabled, skipping reminder sync');
      await cancelAllReminders(); // Cancel all if notifications disabled
      return { scheduled: 0, cancelled: 0 };
    }
    
    // Check permissions
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      console.log('Notification permissions not granted, skipping reminder sync');
      return { scheduled: 0, cancelled: 0 };
    }
    
    // Get reminder preference
    const reminderMinutes = customReminderMinutes !== null 
      ? customReminderMinutes 
      : await getUserReminderPreference();
    
    if (reminderMinutes <= 0) {
      console.log('Reminder minutes is 0 or negative, cancelling all reminders');
      await cancelAllReminders();
      return { scheduled: 0, cancelled: await getScheduledReminderCount() };
    }
    
    // If customReminderMinutes is provided (settings changed), cancel ALL existing reminders first
    // This ensures all reminders are rescheduled with the new time
    if (customReminderMinutes !== null) {
      console.log(`Reminder time changed to ${customReminderMinutes} minutes, cancelling all existing reminders...`);
      await cancelAllReminders();
    }
    
    // Fetch enrolled courses
    const courses = await fetchEnrolledCourses();
    if (courses.length === 0) {
      console.log('No enrolled courses found');
      return { scheduled: 0, cancelled: 0 };
    }
    
    let scheduledCount = 0;
    let cancelledCount = 0;
    const now = new Date();
    
    // Process each course
    for (const course of courses) {
      try {
        // Cancel existing reminders for this course (in case some weren't cancelled above)
        await cancelCourseReminders(course.id || course._id);
        cancelledCount++;
        
        // Calculate upcoming classes
        const upcomingClasses = calculateUpcomingClasses(course, now);
        
        // Schedule reminders for each upcoming class with the current reminder time
        for (const classInfo of upcomingClasses) {
          const reminderDate = new Date(classInfo.date);
          reminderDate.setMinutes(reminderDate.getMinutes() - reminderMinutes);
          
          // Only schedule if reminder time is in the future
          if (reminderDate.getTime() > now.getTime()) {
            const identifier = await scheduleReminderNotification({
              courseId: classInfo.courseId,
              courseName: classInfo.courseName,
              classDate: classInfo.date,
              reminderDate,
              reminderMinutes,
              indexFrom: classInfo.indexFrom,
              indexTo: classInfo.indexTo,
            });
            
            if (identifier) {
              scheduledCount++;
            }
          }
        }
      } catch (error) {
        console.error(`Error processing course ${course.id || course._id}:`, error);
      }
    }
    
    // Clean up past notifications
    await cleanupPastNotifications();
    
    // Update last sync timestamp
    await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    
    console.log(`Reminder sync completed: ${scheduledCount} scheduled, ${cancelledCount} courses processed with ${reminderMinutes} minute reminder`);
    return { scheduled: scheduledCount, cancelled: cancelledCount };
  } catch (error) {
    console.error('Error syncing reminders:', error);
    return { scheduled: 0, cancelled: 0 };
  }
};

/**
 * Cancel all local reminder notifications
 * @returns {Promise<void>}
 */
export const cancelAllReminders = async () => {
  try {
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    
    for (const notification of scheduledNotifications) {
      if (notification.identifier.startsWith(NOTIFICATION_PREFIX)) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }
    
    await AsyncStorage.removeItem(SCHEDULED_NOTIFICATIONS_KEY);
    console.log('Cancelled all reminder notifications');
  } catch (error) {
    console.error('Error cancelling all reminders:', error);
  }
};

/**
 * Clean up past notifications
 * @returns {Promise<void>}
 */
const cleanupPastNotifications = async () => {
  try {
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    const now = new Date();
    
    for (const notification of scheduledNotifications) {
      if (notification.identifier.startsWith(NOTIFICATION_PREFIX)) {
        const trigger = notification.trigger;
        if (trigger && trigger.date) {
          const triggerDate = new Date(trigger.date);
          // Cancel if notification time has passed
          if (triggerDate.getTime() <= now.getTime()) {
            await Notifications.cancelScheduledNotificationAsync(notification.identifier);
          }
        }
      }
    }
    
    // Update stored cache
    const stored = await AsyncStorage.getItem(SCHEDULED_NOTIFICATIONS_KEY);
    if (stored) {
      const notifications = JSON.parse(stored);
      const valid = notifications.filter((n) => {
        const reminderDate = new Date(n.reminderDate);
        return reminderDate.getTime() > now.getTime();
      });
      await AsyncStorage.setItem(SCHEDULED_NOTIFICATIONS_KEY, JSON.stringify(valid));
    }
  } catch (error) {
    console.error('Error cleaning up past notifications:', error);
  }
};

/**
 * Validate and reschedule missing notifications
 * @returns {Promise<{rescheduled: number}>} Validation result
 */
export const validateAndRescheduleReminders = async () => {
  try {
    const notificationsEnabled = await areNotificationsEnabled();
    if (!notificationsEnabled) {
      return { rescheduled: 0 };
    }
    
    // Get expected notifications from cache
    const stored = await AsyncStorage.getItem(SCHEDULED_NOTIFICATIONS_KEY);
    if (!stored) {
      // No cache, do a full sync
      await syncAndScheduleReminders();
      return { rescheduled: 0 };
    }
    
    const expectedNotifications = JSON.parse(stored);
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    const scheduledIds = new Set(
      scheduledNotifications
        .filter((n) => n.identifier.startsWith(NOTIFICATION_PREFIX))
        .map((n) => n.identifier)
    );
    
    // Check which expected notifications are missing
    const missing = expectedNotifications.filter(
      (expected) => !scheduledIds.has(expected.identifier)
    );
    
    if (missing.length > 0) {
      console.log(`Found ${missing.length} missing notifications, resyncing...`);
      await syncAndScheduleReminders();
      return { rescheduled: missing.length };
    }
    
    return { rescheduled: 0 };
  } catch (error) {
    console.error('Error validating reminders:', error);
    return { rescheduled: 0 };
  }
};

/**
 * Get count of scheduled reminder notifications
 * @returns {Promise<number>} Count of scheduled reminders
 */
const getScheduledReminderCount = async () => {
  try {
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    return scheduledNotifications.filter((n) => n.identifier.startsWith(NOTIFICATION_PREFIX)).length;
  } catch (error) {
    console.error('Error getting scheduled reminder count:', error);
    return 0;
  }
};

/**
 * Handle course update - cancel old reminders and reschedule
 * @param {string} courseId - Course ID that was updated
 * @returns {Promise<void>}
 */
export const handleCourseUpdate = async (courseId) => {
  try {
    console.log(`Handling course update for course ${courseId}`);
    // Cancel existing reminders for this course
    await cancelCourseReminders(courseId);
    // Reschedule with latest course data
    await syncAndScheduleReminders();
  } catch (error) {
    console.error('Error handling course update:', error);
  }
};

