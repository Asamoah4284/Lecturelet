const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
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

// Static method to find by email (includes password for auth)
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Static method to find by email (public data only)
userSchema.statics.findByEmailPublic = function(email) {
  return this.findOne({ email: email.toLowerCase() })
    .select('-password');
};

// Static method to check if email exists
userSchema.statics.emailExists = async function(email) {
  const user = await this.findOne({ email: email.toLowerCase() });
  return !!user;
};

// Transform output to match expected format
userSchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    email: this.email,
    full_name: this.fullName,
    role: this.role,
    student_id: this.studentId,
    notifications_enabled: this.notificationsEnabled,
    reminder_minutes: this.reminderMinutes,
    created_at: this.createdAt,
    updated_at: this.updatedAt
  };
};

module.exports = mongoose.model('User', userSchema);
