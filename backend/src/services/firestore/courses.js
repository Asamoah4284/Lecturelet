/**
 * Firestore Courses Service
 * Handles all course-related Firestore operations
 */

const { firestore } = require('../../config/firebase');
const admin = require('firebase-admin');

const COURSES_COLLECTION = 'courses';

/**
 * Generate a unique 5-digit course code
 * @returns {Promise<string>} Unique code
 */
const generateUniqueCode = async () => {
  let code;
  let exists = true;
  
  while (exists) {
    code = String(Math.floor(10000 + Math.random() * 90000));
    const existing = await getCourseByUniqueCode(code);
    exists = !!existing;
  }
  
  return code;
};

/**
 * Create a new course
 * @param {Object} courseData - Course data
 * @returns {Promise<Object>} Created course document
 */
const createCourse = async (courseData) => {
  const uniqueCode = await generateUniqueCode();
  
  const courseRef = firestore.collection(COURSES_COLLECTION).doc();
  const courseDoc = {
    ...courseData,
    uniqueCode,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    temporaryEditExpiresAt: null,
    originalValues: null,
  };

  await courseRef.set(courseDoc);
  return getCourseById(courseRef.id);
};

/**
 * Get course by ID
 * @param {string} courseId - Course ID
 * @returns {Promise<Object|null>} Course document or null
 */
const getCourseById = async (courseId) => {
  const courseRef = firestore.collection(COURSES_COLLECTION).doc(courseId);
  const courseDoc = await courseRef.get();

  if (!courseDoc.exists) {
    return null;
  }

  return {
    id: courseDoc.id,
    ...courseDoc.data(),
  };
};

/**
 * Get course by unique code
 * @param {string} uniqueCode - Unique 5-digit code
 * @returns {Promise<Object|null>} Course document or null
 */
const getCourseByUniqueCode = async (uniqueCode) => {
  const coursesRef = firestore.collection(COURSES_COLLECTION);
  const snapshot = await coursesRef
    .where('uniqueCode', '==', uniqueCode.toUpperCase())
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const courseDoc = snapshot.docs[0];
  return {
    id: courseDoc.id,
    ...courseDoc.data(),
  };
};

/**
 * Get all courses created by a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of course documents
 */
const getCoursesByCreator = async (userId) => {
  const coursesRef = firestore.collection(COURSES_COLLECTION);
  const snapshot = await coursesRef
    .where('createdBy', '==', userId)
    .orderBy('createdAt', 'desc')
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));
};

/**
 * Search courses by name, code, or rep name
 * @param {string} query - Search query
 * @returns {Promise<Array>} Array of matching courses
 */
const searchCourses = async (query) => {
  const coursesRef = firestore.collection(COURSES_COLLECTION);
  const snapshot = await coursesRef.get();

  const queryLower = query.toLowerCase();
  const matches = snapshot.docs
    .map(doc => ({
      id: doc.id,
      ...doc.data(),
    }))
    .filter(course => {
      const courseName = (course.courseName || '').toLowerCase();
      const courseCode = (course.courseCode || '').toLowerCase();
      const repName = (course.courseRepName || '').toLowerCase();
      const uniqueCode = (course.uniqueCode || '').toLowerCase();
      
      return courseName.includes(queryLower) ||
             courseCode.includes(queryLower) ||
             repName.includes(queryLower) ||
             uniqueCode.includes(queryLower);
    })
    .sort((a, b) => (a.courseName || '').localeCompare(b.courseName || ''));

  return matches;
};

/**
 * Check if user is the creator of a course
 * @param {string} courseId - Course ID
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if user is creator
 */
const isCreator = async (courseId, userId) => {
  const course = await getCourseById(courseId);
  return course && course.createdBy === userId;
};

/**
 * Update course document
 * @param {string} courseId - Course ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated course document
 */
const updateCourse = async (courseId, updates) => {
  const courseRef = firestore.collection(COURSES_COLLECTION).doc(courseId);
  
  await courseRef.update({
    ...updates,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return getCourseById(courseId);
};

/**
 * Delete course document
 * @param {string} courseId - Course ID
 * @returns {Promise<void>}
 */
const deleteCourse = async (courseId) => {
  const courseRef = firestore.collection(COURSES_COLLECTION).doc(courseId);
  await courseRef.delete();
};

/**
 * Reset temporary edits that have expired
 * @returns {Promise<number>} Number of courses reset
 */
const resetExpiredTemporaryEdits = async () => {
  try {
    const now = admin.firestore.Timestamp.now();
    const coursesRef = firestore.collection(COURSES_COLLECTION);
    
    // Query only by expiration time (single field query - no index needed)
    // Then filter for originalValues in memory
    const snapshot = await coursesRef
      .where('temporaryEditExpiresAt', '<=', now)
      .get();

    let resetCount = 0;
    const batches = []; // Firestore batches are limited to 500 operations
    let currentBatch = firestore.batch();
    let batchSize = 0;

    snapshot.docs.forEach(doc => {
      const course = doc.data();
      // Filter in memory for originalValues
      if (course.originalValues && course.temporaryEditExpiresAt) {
        // Create new batch if current one is full (500 operations limit)
        if (batchSize >= 500) {
          batches.push(currentBatch);
          currentBatch = firestore.batch();
          batchSize = 0;
        }
        
        currentBatch.update(doc.ref, {
          ...course.originalValues,
          temporaryEditExpiresAt: null,
          originalValues: null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        batchSize++;
        resetCount++;
      }
    });

    // Add the last batch if it has operations
    if (batchSize > 0) {
      batches.push(currentBatch);
    }

    // Commit all batches
    if (batches.length > 0) {
      await Promise.all(batches.map(batch => batch.commit()));
    }

    return resetCount;
  } catch (error) {
    // If index error, log and return 0 (don't crash the server)
    if (error.code === 9 || error.message?.includes('index')) {
      console.warn('⚠️ Firestore index not created yet. Temporary edit reset skipped. Create the index or it will be created automatically.');
      return 0;
    }
    throw error;
  }
};

/**
 * Transform course document to JSON format (matches MongoDB schema output)
 * @param {Object} courseDoc - Course document from Firestore
 * @returns {Object} Course JSON
 */
const toJSON = (courseDoc) => {
  if (!courseDoc) return null;

  return {
    id: courseDoc.id,
    unique_code: courseDoc.uniqueCode,
    course_name: courseDoc.courseName,
    course_code: courseDoc.courseCode,
    days: courseDoc.days || [],
    start_time: courseDoc.startTime,
    end_time: courseDoc.endTime,
    day_times: courseDoc.dayTimes || {},
    day_venues: courseDoc.dayVenues || {},
    venue: courseDoc.venue,
    credit_hours: courseDoc.creditHours,
    index_from: courseDoc.indexFrom,
    index_to: courseDoc.indexTo,
    course_rep_name: courseDoc.courseRepName,
    created_by: courseDoc.createdBy,
    created_at: courseDoc.createdAt?.toDate?.() || courseDoc.createdAt,
    updated_at: courseDoc.updatedAt?.toDate?.() || courseDoc.updatedAt,
    allowed_phone_numbers: courseDoc.allowedPhoneNumbers || [],
  };
};

module.exports = {
  generateUniqueCode,
  createCourse,
  getCourseById,
  getCourseByUniqueCode,
  getCoursesByCreator,
  searchCourses,
  isCreator,
  updateCourse,
  deleteCourse,
  resetExpiredTemporaryEdits,
  toJSON,
};
