const mongoose = require('mongoose');

const smsLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  phoneNumber: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['announcement', 'course_update', 'assignment', 'quiz', 'tutorial'],
    default: 'announcement'
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    default: null
  },
  sentAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Compound index for efficient weekly queries
smsLogSchema.index({ userId: 1, sentAt: -1 });

/**
 * Get SMS count for a user in the current week
 * Week starts from Monday
 */
smsLogSchema.statics.getWeeklyCount = async function(userId) {
  const now = new Date();
  const startOfWeek = new Date(now);
  
  // Get Monday of current week (0 = Sunday, 1 = Monday)
  const dayOfWeek = startOfWeek.getDay();
  // Calculate days to subtract to get to Monday
  // If Sunday (0), subtract 6 days; otherwise subtract (dayOfWeek - 1) days
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  startOfWeek.setDate(startOfWeek.getDate() - daysToSubtract);
  startOfWeek.setHours(0, 0, 0, 0);
  
  const count = await this.countDocuments({
    userId,
    sentAt: { $gte: startOfWeek }
  });
  
  return count;
};

/**
 * Check if user has exceeded weekly SMS limit
 * @param {ObjectId} userId - User ID
 * @param {number} limit - Weekly limit (default: 5)
 * @returns {Promise<boolean>} - true if limit exceeded, false otherwise
 */
smsLogSchema.statics.hasExceededWeeklyLimit = async function(userId, limit = 5) {
  const count = await this.getWeeklyCount(userId);
  return count >= limit;
};

/**
 * Log an SMS message
 */
smsLogSchema.statics.logSms = async function({ userId, phoneNumber, message, type = 'announcement', courseId = null }) {
  return await this.create({
    userId,
    phoneNumber,
    message,
    type,
    courseId,
    sentAt: new Date()
  });
};

module.exports = mongoose.model('SmsLog', smsLogSchema);

