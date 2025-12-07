const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  }
}, {
  timestamps: { createdAt: 'enrolledAt', updatedAt: false }
});

// Ensure a user can only enroll in a course once
enrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true });

/**
 * Enroll a student in a course
 */
enrollmentSchema.statics.enroll = async function(userId, courseId) {
  try {
    const enrollment = await this.create({ userId, courseId });
    return enrollment.populate(['userId', 'courseId']);
  } catch (error) {
    if (error.code === 11000) {
      throw new Error('Already enrolled in this course');
    }
    throw error;
  }
};

/**
 * Get all courses a student is enrolled in
 */
enrollmentSchema.statics.getStudentCourses = async function(userId) {
  const enrollments = await this.find({ userId })
    .populate({
      path: 'courseId',
      populate: { path: 'createdBy', select: 'fullName' }
    })
    .sort({ enrolledAt: -1 });
  
  return enrollments.map(e => ({
    ...e.courseId.toJSON(),
    enrolled_at: e.enrolledAt
  }));
};

/**
 * Get all students enrolled in a course
 */
enrollmentSchema.statics.getCourseStudents = async function(courseId) {
  const enrollments = await this.find({ courseId })
    .populate('userId', 'fullName phoneNumber studentId')
    .sort({ enrolledAt: 1 });
  
  return enrollments.map(e => ({
    id: e.userId._id,
    full_name: e.userId.fullName,
    phone_number: e.userId.phoneNumber,
    student_id: e.userId.studentId,
    enrolled_at: e.enrolledAt
  }));
};

/**
 * Check if student is enrolled in a course
 */
enrollmentSchema.statics.isEnrolled = async function(userId, courseId) {
  const enrollment = await this.findOne({ userId, courseId });
  return !!enrollment;
};

/**
 * Unenroll from a course
 */
enrollmentSchema.statics.unenroll = function(userId, courseId) {
  return this.deleteOne({ userId, courseId });
};

/**
 * Get enrollment count for a course
 */
enrollmentSchema.statics.getCount = function(courseId) {
  return this.countDocuments({ courseId });
};

module.exports = mongoose.model('Enrollment', enrollmentSchema);
