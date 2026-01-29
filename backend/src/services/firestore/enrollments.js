/**
 * Firestore Enrollments Service
 * Handles all enrollment-related Firestore operations
 */

const { firestore } = require('../../config/firebase');
const admin = require('firebase-admin');
const { getCourseById } = require('./courses');
const { getUserById } = require('./users');

const ENROLLMENTS_COLLECTION = 'enrollments';

/**
 * Create enrollment ID from userId and courseId (for unique constraint)
 * @param {string} userId - User ID
 * @param {string} courseId - Course ID
 * @returns {string} Enrollment ID
 */
const getEnrollmentId = (userId, courseId) => {
  return `${userId}_${courseId}`;
};

/**
 * Enroll a student in a course
 * @param {string} userId - User ID
 * @param {string} courseId - Course ID
 * @returns {Promise<Object>} Enrollment document
 */
const enroll = async (userId, courseId) => {
  const enrollmentId = getEnrollmentId(userId, courseId);
  const enrollmentRef = firestore.collection(ENROLLMENTS_COLLECTION).doc(enrollmentId);
  
  // Check if already enrolled
  const existing = await enrollmentRef.get();
  if (existing.exists) {
    throw new Error('Already enrolled in this course');
  }

  const enrollmentDoc = {
    userId,
    courseId,
    enrolledAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await enrollmentRef.set(enrollmentDoc);
  return getEnrollmentById(enrollmentId);
};

/**
 * Get enrollment by ID
 * @param {string} enrollmentId - Enrollment ID
 * @returns {Promise<Object|null>} Enrollment document or null
 */
const getEnrollmentById = async (enrollmentId) => {
  const enrollmentRef = firestore.collection(ENROLLMENTS_COLLECTION).doc(enrollmentId);
  const enrollmentDoc = await enrollmentRef.get();

  if (!enrollmentDoc.exists) {
    return null;
  }

  return {
    id: enrollmentDoc.id,
    ...enrollmentDoc.data(),
  };
};

/**
 * Get all courses a student is enrolled in
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of course documents with enrollment info
 */
const getStudentCourses = async (userId) => {
  const enrollmentsRef = firestore.collection(ENROLLMENTS_COLLECTION);
  const snapshot = await enrollmentsRef
    .where('userId', '==', userId)
    .orderBy('enrolledAt', 'desc')
    .get();

  const courses = await Promise.all(
    snapshot.docs.map(async (doc) => {
      const enrollment = doc.data();
      const course = await getCourseById(enrollment.courseId);
      if (!course) return null;

      // Get creator info
      const creator = await getUserById(course.createdBy);
      
      return {
        ...course,
        enrolled_at: enrollment.enrolledAt?.toDate?.() || enrollment.enrolledAt,
        creator_name: creator?.fullName,
      };
    })
  );

  return courses.filter(c => c !== null);
};

/**
 * Get all students enrolled in a course
 * @param {string} courseId - Course ID
 * @returns {Promise<Array>} Array of student documents
 */
const getCourseStudents = async (courseId) => {
  const enrollmentsRef = firestore.collection(ENROLLMENTS_COLLECTION);
  const snapshot = await enrollmentsRef
    .where('courseId', '==', courseId)
    .orderBy('enrolledAt', 'asc')
    .get();

  const students = await Promise.all(
    snapshot.docs.map(async (doc) => {
      const enrollment = doc.data();
      const user = await getUserById(enrollment.userId);
      if (!user) return null;

      return {
        id: user.id,
        full_name: user.fullName,
        phone_number: user.phoneNumber,
        student_id: user.studentId,
        enrolled_at: enrollment.enrolledAt?.toDate?.() || enrollment.enrolledAt,
      };
    })
  );

  return students.filter(s => s !== null);
};

/**
 * Check if student is enrolled in a course
 * @param {string} userId - User ID
 * @param {string} courseId - Course ID
 * @returns {Promise<boolean>} True if enrolled
 */
const isEnrolled = async (userId, courseId) => {
  const enrollmentId = getEnrollmentId(userId, courseId);
  const enrollment = await getEnrollmentById(enrollmentId);
  return !!enrollment;
};

/**
 * Unenroll from a course
 * @param {string} userId - User ID
 * @param {string} courseId - Course ID
 * @returns {Promise<void>}
 */
const unenroll = async (userId, courseId) => {
  const enrollmentId = getEnrollmentId(userId, courseId);
  const enrollmentRef = firestore.collection(ENROLLMENTS_COLLECTION).doc(enrollmentId);
  await enrollmentRef.delete();
};

/**
 * Get enrollment count for a course
 * @param {string} courseId - Course ID
 * @returns {Promise<number>} Number of enrollments
 */
const getCount = async (courseId) => {
  const enrollmentsRef = firestore.collection(ENROLLMENTS_COLLECTION);
  const snapshot = await enrollmentsRef
    .where('courseId', '==', courseId)
    .get();

  return snapshot.size;
};

/**
 * Get all enrollments for a course (for notifications)
 * @param {string} courseId - Course ID
 * @returns {Promise<Array>} Array of enrollment documents with user data
 */
const getEnrollmentsForCourse = async (courseId) => {
  const enrollmentsRef = firestore.collection(ENROLLMENTS_COLLECTION);
  const snapshot = await enrollmentsRef
    .where('courseId', '==', courseId)
    .get();

  const enrollments = await Promise.all(
    snapshot.docs.map(async (doc) => {
      const enrollment = doc.data();
      const user = await getUserById(enrollment.userId);
      return {
        userId: user,
        courseId: enrollment.courseId,
        enrolledAt: enrollment.enrolledAt,
      };
    })
  );

  return enrollments.filter(e => e.userId !== null);
};

/**
 * Delete all enrollments for a user
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
const deleteAllForUser = async (userId) => {
  const enrollmentsRef = firestore.collection(ENROLLMENTS_COLLECTION);
  const snapshot = await enrollmentsRef
    .where('userId', '==', userId)
    .get();

  const batch = firestore.batch();
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  await batch.commit();
};

/**
 * Delete all enrollments for a course
 * @param {string} courseId - Course ID
 * @returns {Promise<void>}
 */
const deleteAllForCourse = async (courseId) => {
  const enrollmentsRef = firestore.collection(ENROLLMENTS_COLLECTION);
  const snapshot = await enrollmentsRef
    .where('courseId', '==', courseId)
    .get();

  const batch = firestore.batch();
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  await batch.commit();
};

module.exports = {
  enroll,
  getStudentCourses,
  getCourseStudents,
  isEnrolled,
  unenroll,
  getCount,
  getEnrollmentsForCourse,
  deleteAllForUser,
  deleteAllForCourse,
};
