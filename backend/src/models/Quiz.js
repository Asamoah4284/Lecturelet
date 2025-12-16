const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema({
  quizName: {
    type: String,
    required: true,
    trim: true
  },
  date: {
    type: String,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  venue: {
    type: String,
    required: true,
    trim: true
  },
  topic: {
    type: String,
    default: null,
    trim: true
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  courseCode: {
    type: String,
    required: true,
    trim: true
  },
  courseName: {
    type: String,
    required: true,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

/**
 * Get all quizzes for a course
 */
quizSchema.statics.findByCourse = function(courseId) {
  return this.find({ courseId })
    .populate('createdBy', 'fullName')
    .sort({ createdAt: -1 });
};

/**
 * Get all quizzes created by a user
 */
quizSchema.statics.findByCreator = function(userId) {
  return this.find({ createdBy: userId })
    .populate('courseId', 'courseName courseCode')
    .sort({ createdAt: -1 });
};

/**
 * Transform to expected API format
 */
quizSchema.methods.toJSON = function() {
  return {
    id: this._id,
    quiz_name: this.quizName,
    date: this.date,
    time: this.time,
    venue: this.venue,
    topic: this.topic,
    course_id: this.courseId,
    course_code: this.courseCode,
    course_name: this.courseName,
    created_by: this.createdBy,
    created_at: this.createdAt,
    updated_at: this.updatedAt
  };
};

module.exports = mongoose.model('Quiz', quizSchema);

