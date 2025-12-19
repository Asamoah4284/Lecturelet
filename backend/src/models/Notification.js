const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['lecture_reminder', 'course_update', 'announcement', 'system'],
    default: 'system'
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    default: null
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for faster queries
notificationSchema.index({ userId: 1, createdAt: -1 });

/**
 * Create notifications for all students in a course
 */
notificationSchema.statics.createForCourse = async function(courseId, { title, message, type = 'course_update', senderName = null }) {
  const Enrollment = mongoose.model('Enrollment');
  const User = mongoose.model('User');
  const enrollments = await Enrollment.find({ courseId }).populate('userId', 'fullName');
  
  // Create personalized notifications for each student
  const notifications = [];
  for (const enrollment of enrollments) {
    const student = enrollment.userId;
    const studentName = student?.fullName || 'Student';
    // Use student's name instead of sender's name
    const personalizedMessage = `Hi ${studentName}, ${message}`;
    
    notifications.push({
      userId: enrollment.userId._id || enrollment.userId,
      title,
      message: personalizedMessage,
      type,
      courseId
    });
  }
  
  await this.insertMany(notifications);
  return enrollments.length;
};

/**
 * Get all notifications for a user
 */
notificationSchema.statics.getByUser = function(userId, { limit = 50, unreadOnly = false } = {}) {
  const query = { userId };
  if (unreadOnly) {
    query.isRead = false;
  }
  
  return this.find(query)
    .populate('courseId', 'courseName')
    .sort({ createdAt: -1 })
    .limit(limit);
};

/**
 * Mark notification as read
 */
notificationSchema.statics.markAsRead = function(id, userId) {
  return this.updateOne({ _id: id, userId }, { isRead: true });
};

/**
 * Mark all notifications as read for a user
 */
notificationSchema.statics.markAllAsRead = function(userId) {
  return this.updateMany({ userId, isRead: false }, { isRead: true });
};

/**
 * Get unread count for a user
 */
notificationSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({ userId, isRead: false });
};

/**
 * Delete all notifications for a user
 */
notificationSchema.statics.deleteAllForUser = function(userId) {
  return this.deleteMany({ userId });
};

/**
 * Transform to expected API format
 */
notificationSchema.methods.toJSON = function() {
  return {
    id: this._id,
    user_id: this.userId,
    title: this.title,
    message: this.message,
    type: this.type,
    course_id: this.courseId,
    course_name: this.courseId?.courseName,
    is_read: this.isRead,
    created_at: this.createdAt
  };
};

module.exports = mongoose.model('Notification', notificationSchema);
