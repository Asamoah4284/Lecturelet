const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  uniqueCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  courseName: {
    type: String,
    required: true,
    trim: true
  },
  courseCode: {
    type: String,
    required: true,
    trim: true
  },
  days: {
    type: [String],
    required: true
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  dayTimes: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  dayVenues: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  venue: {
    type: String,
    default: null
  },
  creditHours: {
    type: String,
    default: null
  },
  indexFrom: {
    type: String,
    default: null
  },
  indexTo: {
    type: String,
    default: null
  },
  courseRepName: {
    type: String,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Temporary edit fields
  temporaryEditExpiresAt: {
    type: Date,
    default: null
  },
  originalValues: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  // Allowed phone numbers for enrollment (whitelist)
  allowedPhoneNumbers: {
    type: [String],
    default: []
  }
}, {
  timestamps: true
});

/**
 * Generate a unique 5-digit course code
 */
courseSchema.statics.generateUniqueCode = async function() {
  let code;
  let exists = true;
  
  while (exists) {
    // Generate a 5-digit number (10000 to 99999)
    code = String(Math.floor(10000 + Math.random() * 90000));
    const existing = await this.findOne({ uniqueCode: code });
    exists = !!existing;
  }
  
  return code;
};

/**
 * Find course by unique code
 */
courseSchema.statics.findByUniqueCode = function(uniqueCode) {
  return this.findOne({ uniqueCode: uniqueCode.toUpperCase() })
    .populate('createdBy', 'fullName');
};

/**
 * Get all courses created by a user (Course Rep)
 */
courseSchema.statics.findByCreator = function(userId) {
  return this.find({ createdBy: userId })
    .sort({ createdAt: -1 });
};

/**
 * Search courses by name, code, or rep name
 */
courseSchema.statics.search = function(query) {
  const searchRegex = new RegExp(query, 'i');
  return this.find({
    $or: [
      { courseName: searchRegex },
      { courseCode: searchRegex },
      { courseRepName: searchRegex },
      { uniqueCode: searchRegex }
    ]
  })
  .populate('createdBy', 'fullName')
  .sort({ courseName: 1 });
};

/**
 * Check if user is the creator of the course
 */
courseSchema.statics.isCreator = async function(courseId, userId) {
  const course = await this.findOne({ _id: courseId, createdBy: userId });
  return !!course;
};

/**
 * Reset temporary edits that have expired
 */
courseSchema.statics.resetExpiredTemporaryEdits = async function() {
  const now = new Date();
  const courses = await this.find({
    temporaryEditExpiresAt: { $lte: now, $ne: null },
    originalValues: { $ne: null }
  });

  for (const course of courses) {
    // Restore original values
    if (course.originalValues) {
      await this.findByIdAndUpdate(course._id, {
        ...course.originalValues,
        temporaryEditExpiresAt: null,
        originalValues: null
      });
    }
  }

  return courses.length;
};

/**
 * Transform to expected API format
 */
courseSchema.methods.toJSON = function() {
  return {
    id: this._id,
    unique_code: this.uniqueCode,
    course_name: this.courseName,
    course_code: this.courseCode,
    days: this.days,
    start_time: this.startTime,
    end_time: this.endTime,
    day_times: this.dayTimes,
    day_venues: this.dayVenues,
    venue: this.venue,
    credit_hours: this.creditHours,
    index_from: this.indexFrom,
    index_to: this.indexTo,
    course_rep_name: this.courseRepName,
    created_by: this.createdBy,
    created_at: this.createdAt,
    updated_at: this.updatedAt,
    allowed_phone_numbers: this.allowedPhoneNumbers || []
  };
};

module.exports = mongoose.model('Course', courseSchema);
