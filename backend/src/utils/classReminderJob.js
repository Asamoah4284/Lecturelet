const { User, Enrollment, Course, Notification } = require('../models');
const { sendPushNotification } = require('./pushNotificationService');

// In-memory cache to track sent notifications
// Key format: `${userId}_${courseId}_${dateString}`
// This prevents duplicate notifications for the same class on the same day
const sentNotificationsCache = new Map();

/**
 * Clear old entries from the cache (older than 1 day)
 * This should be called periodically
 */
const clearOldCacheEntries = () => {
  const today = new Date().toDateString();
  const keysToDelete = [];
  
  for (const [key] of sentNotificationsCache) {
    const keyDate = key.split('_').pop();
    if (keyDate !== today) {
      keysToDelete.push(key);
    }
  }
  
  keysToDelete.forEach(key => sentNotificationsCache.delete(key));
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
 * Get day name from date (e.g., "Monday", "Tuesday")
 * @param {Date} date - Date object
 * @returns {string} Day name
 */
const getDayName = (date) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
};

/**
 * Calculate the next occurrence of a class
 * @param {Object} course - Course object
 * @param {Date} fromDate - Date to calculate from (default: now)
 * @returns {Date|null} Next class date/time or null if not found
 */
const calculateNextClassTime = (course, fromDate = new Date()) => {
  try {
    const days = course.days || [];
    if (days.length === 0) return null;
    
    const dayTimes = course.dayTimes || {};
    const hasDayTimes = Object.keys(dayTimes).length > 0;
    
    // Try each day of the week starting from today
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(fromDate);
      checkDate.setDate(checkDate.getDate() + i);
      const dayName = getDayName(checkDate);
      
      if (!days.includes(dayName)) continue;
      
      let startTime = null;
      let endTime = null;
      
      // Use dayTimes if available, otherwise fall back to course startTime/endTime
      if (hasDayTimes && dayTimes[dayName]) {
        startTime = parseTime(dayTimes[dayName].startTime, checkDate);
        endTime = parseTime(dayTimes[dayName].endTime, checkDate);
      } else {
        startTime = parseTime(course.startTime, checkDate);
        endTime = parseTime(course.endTime, checkDate);
      }
      
      // Return the class time if:
      // 1. It's in the future, OR
      // 2. It's within the last 30 minutes (class just started or recently started)
      // This allows notifications even if job runs a bit late
      if (startTime) {
        const timeDiff = startTime.getTime() - fromDate.getTime();
        const thirtyMinutes = 30 * 60 * 1000;
        
        // Future class or class within last 30 minutes
        if (timeDiff >= -thirtyMinutes) {
          return startTime;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error calculating next class time:', error);
    return null;
  }
};

/**
 * Check if notification should be sent for a class
 * @param {Date} classTime - Class start time
 * @param {number} reminderMinutes - Minutes before class to remind
 * @param {Date} now - Current time
 * @returns {boolean} True if notification should be sent
 */
const shouldSendNotification = (classTime, reminderMinutes, now = new Date()) => {
  if (!classTime) return false;
  
  const reminderTime = new Date(classTime);
  reminderTime.setMinutes(reminderTime.getMinutes() - reminderMinutes);
  
  // Calculate time differences
  const timeDiff = reminderTime.getTime() - now.getTime();
  const classTimeDiff = classTime.getTime() - now.getTime();
  const fiveMinutes = 5 * 60 * 1000;
  
  // Send notification if:
  // 1. We're within 5 minutes of the reminder time (before class), OR
  // 2. Class is starting within the next 10 minutes (even if reminder time passed)
  const withinReminderWindow = timeDiff >= 0 && timeDiff <= fiveMinutes;
  const classStartingSoon = classTimeDiff >= 0 && classTimeDiff <= 10 * 60 * 1000;
  
  return withinReminderWindow || classStartingSoon;
};

/**
 * Check if notification was already sent for this class today
 * @param {string} userId - User ID
 * @param {string} courseId - Course ID
 * @returns {boolean} True if already sent
 */
const wasNotificationSent = (userId, courseId) => {
  const today = new Date().toDateString();
  const key = `${userId}_${courseId}_${today}`;
  return sentNotificationsCache.has(key);
};

/**
 * Mark notification as sent for this class today
 * @param {string} userId - User ID
 * @param {string} courseId - Course ID
 */
const markNotificationSent = (userId, courseId) => {
  const today = new Date().toDateString();
  const key = `${userId}_${courseId}_${today}`;
  sentNotificationsCache.set(key, true);
};

/**
 * Process class reminders for all users
 * This is the main function that runs periodically
 */
const processClassReminders = async () => {
  try {
    console.log('Processing class reminders...');
    
    // Clear old cache entries
    clearOldCacheEntries();
    
    // Get all users with notifications enabled and push tokens
    const users = await User.find({
      notificationsEnabled: true,
      pushToken: { $ne: null, $exists: true },
    });
    
    if (users.length === 0) {
      console.log('No users with notifications enabled and push tokens');
      return { processed: 0, sent: 0 };
    }
    
    let totalProcessed = 0;
    let totalSent = 0;
    const now = new Date();
    
    for (const user of users) {
      try {
        // Verify user has push token
        if (!user.pushToken) {
          console.log(`User ${user._id} (${user.fullName}) has no push token, skipping`);
          continue;
        }
        
        // Check if user has active access (payment OR active trial)
        if (!user.hasActiveAccess()) {
          console.log(`User ${user._id} (${user.fullName}) does not have active access (trial expired, no payment), skipping notifications`);
          continue;
        }
        
        // Get all courses the user is enrolled in
        const enrollments = await Enrollment.find({ userId: user._id })
          .populate('courseId');
        
        if (enrollments.length === 0) {
          console.log(`User ${user._id} has no enrolled courses`);
          continue;
        }
        
        console.log(`Processing ${enrollments.length} courses for user ${user._id} (${user.fullName})`);
        
        for (const enrollment of enrollments) {
          const course = enrollment.courseId;
          if (!course) {
            console.log(`Course not found for enrollment ${enrollment._id}`);
            continue;
          }
          
          totalProcessed++;
          
          // Check if notification was already sent today
          if (wasNotificationSent(user._id.toString(), course._id.toString())) {
            console.log(`Notification already sent today for user ${user._id}, course ${course.courseName}`);
            continue;
          }
          
          // Calculate next class time
          const nextClassTime = calculateNextClassTime(course, now);
          if (!nextClassTime) {
            console.log(`No next class time found for user ${user._id}, course ${course.courseName}`, {
              courseDays: course.days,
              courseStartTime: course.startTime,
              courseEndTime: course.endTime,
              dayTimes: course.dayTimes,
              currentTime: now.toISOString(),
              currentDay: now.toLocaleDateString('en-US', { weekday: 'long' }),
              note: 'Class time may be more than 30 minutes in the past, or dayTimes may need updating'
            });
            continue;
          }
          
          console.log(`Found next class time for user ${user._id}, course ${course.courseName}:`, {
            classTime: nextClassTime.toISOString(),
            classTimeLocal: nextClassTime.toLocaleString(),
            currentTime: now.toISOString(),
            timeUntilClass: Math.round((nextClassTime.getTime() - now.getTime()) / 1000 / 60) + ' minutes'
          });
          
          // Check if notification should be sent
          const reminderMinutes = user.reminderMinutes || 15;
          const shouldSend = shouldSendNotification(nextClassTime, reminderMinutes, now);
          
          if (!shouldSend) {
            // Log why notification wasn't sent for debugging
            const reminderTime = new Date(nextClassTime);
            reminderTime.setMinutes(reminderTime.getMinutes() - reminderMinutes);
            const timeUntilClass = nextClassTime.getTime() - now.getTime();
            const timeUntilReminder = reminderTime.getTime() - now.getTime();
            
            console.log(`Skipping notification for user ${user._id}, course ${course.courseName}:`, {
              classTime: nextClassTime.toISOString(),
              reminderTime: reminderTime.toISOString(),
              currentTime: now.toISOString(),
              timeUntilClass: Math.round(timeUntilClass / 1000 / 60) + ' minutes',
              timeUntilReminder: Math.round(timeUntilReminder / 1000 / 60) + ' minutes',
              reminderMinutes: reminderMinutes
            });
            continue;
          }
          
          // Format time for notification
          const timeStr = nextClassTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          });
          
          // Format index range
          let indexRangeText = '';
          if (course.indexFrom && course.indexTo) {
            indexRangeText = ` Index: ${course.indexFrom} - ${course.indexTo}.`;
          } else if (course.indexFrom) {
            indexRangeText = ` Index: ${course.indexFrom}.`;
          }
          
          // Create notification message with user's name
          const venue = course.venue ? ` at ${course.venue}` : '';
          const userName = user.fullName || 'Student';
          const title = 'Class Reminder';
          const body = `Hi ${userName}, your ${course.courseName} class starts in ${reminderMinutes} minutes${venue}. Time: ${timeStr}${indexRangeText}`;
          
          // Send push notification
          console.log(`Attempting to send notification to user ${user._id} for course ${course.courseName}`, {
            pushToken: user.pushToken ? `${user.pushToken.substring(0, 20)}...` : 'MISSING',
            classTime: nextClassTime.toISOString(),
            reminderMinutes: reminderMinutes
          });
          
          const result = await sendPushNotification(
            user.pushToken,
            title,
            body,
            {
              courseId: course._id.toString(),
              courseName: course.courseName,
              type: 'lecture_reminder',
            }
          );
          
          if (result.success) {
            // Save notification to database so it appears in Notifications tab
            try {
              await Notification.create({
                userId: user._id,
                title: title,
                message: body,
                type: 'lecture_reminder',
                courseId: course._id,
                isRead: false,
              });
              console.log(`✅ Saved notification to database for user ${user._id}`);
            } catch (notifError) {
              console.error(`Error saving notification to database:`, notifError);
              // Don't fail the whole process if database save fails
            }
            
            markNotificationSent(user._id.toString(), course._id.toString());
            totalSent++;
            console.log(`✅ Sent reminder to user ${user._id} for course ${course.courseName}`);
          } else {
            console.error(`❌ Failed to send reminder to user ${user._id} for course ${course.courseName}:`, result.error || result.errors);
          }
        }
      } catch (error) {
        console.error(`Error processing reminders for user ${user._id}:`, error);
      }
    }
    
    console.log(`Class reminders processed: ${totalProcessed}, sent: ${totalSent}`);
    return { processed: totalProcessed, sent: totalSent };
  } catch (error) {
    console.error('Error in processClassReminders:', error);
    return { processed: 0, sent: 0, error: error.message };
  }
};

/**
 * Start the class reminder job
 * Runs every 5 minutes
 */
const startClassReminderJob = () => {
  // Run immediately on startup (with a small delay to let server initialize)
  setTimeout(() => {
    processClassReminders();
  }, 30000); // 30 seconds delay
  
  // Then run every 5 minutes (300000 milliseconds)
  setInterval(() => {
    processClassReminders();
  }, 5 * 60 * 1000);
  
  console.log('Class reminder job started (runs every 5 minutes)');
};

module.exports = {
  processClassReminders,
  startClassReminderJob,
  calculateNextClassTime,
  shouldSendNotification,
};

