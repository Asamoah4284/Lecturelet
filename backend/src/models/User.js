const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['student', 'course_rep'],
    default: 'student'
  },
  studentId: {
    type: String,
    default: null
  },
  notificationsEnabled: {
    type: Boolean,
    default: true
  },
  reminderMinutes: {
    type: Number,
    default: 15
  },
  pushToken: {
    type: String,
    default: null,
    trim: true
  },
  paymentStatus: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = bcrypt.hashSync(this.password, 10);
  next();
});

// Instance method to verify password
userSchema.methods.verifyPassword = function(plainPassword) {
  return bcrypt.compareSync(plainPassword, this.password);
};

// Static method to find by phone number (includes password for auth)
userSchema.statics.findByPhoneNumber = function(phoneNumber) {
  return this.findOne({ phoneNumber: phoneNumber.trim() });
};

// Static method to check if phone number exists
userSchema.statics.phoneNumberExists = async function(phoneNumber) {
  const user = await this.findOne({ phoneNumber: phoneNumber.trim() });
  return !!user;
};

/**
 * Update push token for the user
 */
userSchema.methods.updatePushToken = function(pushToken) {
  this.pushToken = pushToken || null;
  return this.save();
};

// Transform output to match expected format
userSchema.methods.toPublicJSON = function() {
  return {
    id: this._id.toString(),
    phone_number: this.phoneNumber,
    full_name: this.fullName,
    role: this.role,
    student_id: this.studentId,
    notifications_enabled: this.notificationsEnabled,
    reminder_minutes: this.reminderMinutes,
    payment_status: this.paymentStatus,
    created_at: this.createdAt,
    updated_at: this.updatedAt
  };
};

module.exports = mongoose.model('User', userSchema);
