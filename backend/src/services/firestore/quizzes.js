/**
 * Firestore Quizzes Service
 * Handles quiz CRUD for courses stored in Firestore (Firestore courseId)
 */

const { firestore } = require('../../config/firebase');
const admin = require('firebase-admin');

const QUIZZES_COLLECTION = 'quizzes';

const toIso = (v) => {
  if (!v) return undefined;
  if (typeof v === 'string') return v;
  if (v.toDate && typeof v.toDate === 'function') return v.toDate().toISOString();
  if (v.toISOString && typeof v.toISOString === 'function') return v.toISOString();
  return undefined;
};

/**
 * Map Firestore quiz doc to API shape (matches Mongoose Quiz.toJSON)
 */
const toApiShape = (id, data) => ({
  id,
  quiz_name: data.quizName,
  date: data.date,
  time: data.time,
  venue: data.venue,
  topic: data.topic ?? null,
  course_id: data.courseId,
  course_code: data.courseCode,
  course_name: data.courseName,
  created_by: data.createdBy,
  created_at: toIso(data.createdAt),
  updated_at: toIso(data.updatedAt),
});

/**
 * Create a quiz (for Firestore courses)
 * @param {Object} input - { courseId, quizName, date, time, venue, topic?, courseCode, courseName, createdBy }
 * @returns {Promise<Object>} Created quiz in API shape
 */
const createQuiz = async (input) => {
  const ref = firestore.collection(QUIZZES_COLLECTION).doc();
  const now = admin.firestore.FieldValue.serverTimestamp();
  const doc = {
    courseId: input.courseId,
    quizName: (input.quizName || '').trim(),
    date: input.date,
    time: input.time,
    venue: (input.venue || '').trim(),
    topic: input.topic ? String(input.topic).trim() : null,
    courseCode: (input.courseCode || '').trim(),
    courseName: (input.courseName || '').trim(),
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(doc);
  const snap = await ref.get();
  const data = snap.data();
  const createdAt = data.createdAt?.toDate?.() ?? new Date();
  const updatedAt = data.updatedAt?.toDate?.() ?? new Date();
  return toApiShape(snap.id, { ...data, createdAt, updatedAt });
};

/**
 * Get all quizzes for a course (Firestore courseId)
 * @param {string} courseId - Firestore course ID
 * @returns {Promise<Array<Object>>} Quizzes in API shape, newest first
 */
const getQuizzesByCourseId = async (courseId) => {
  const snapshot = await firestore
    .collection(QUIZZES_COLLECTION)
    .where('courseId', '==', courseId)
    .get();

  const quizzes = snapshot.docs.map((d) => {
    const data = d.data();
    return { id: d.id, ...data };
  });
  quizzes.sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() ?? a.createdAt ?? 0;
    const tb = b.createdAt?.toMillis?.() ?? b.createdAt ?? 0;
    return tb - ta;
  });
  return quizzes.map((q) => toApiShape(q.id, q));
};

/**
 * Get all quizzes created by a user (for course rep "my quizzes" list)
 * @param {string} userId - User ID (Firestore/Mongo user id)
 * @returns {Promise<Array<Object>>} Quizzes in API shape, newest first
 */
const getQuizzesByCreator = async (userId) => {
  const snapshot = await firestore
    .collection(QUIZZES_COLLECTION)
    .where('createdBy', '==', userId)
    .get();

  const quizzes = snapshot.docs.map((d) => {
    const data = d.data();
    return { id: d.id, ...data };
  });
  quizzes.sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() ?? a.createdAt ?? 0;
    const tb = b.createdAt?.toMillis?.() ?? b.createdAt ?? 0;
    return tb - ta;
  });
  return quizzes.map((q) => toApiShape(q.id, q));
};

/**
 * Get a single quiz by ID (Firestore document ID)
 */
const getQuizById = async (quizId) => {
  const doc = await firestore.collection(QUIZZES_COLLECTION).doc(quizId).get();
  if (!doc.exists) return null;
  const data = doc.data();
  return { id: doc.id, ...data };
};

/**
 * Update a quiz by ID (Firestore document ID)
 */
const updateQuiz = async (quizId, updates) => {
  const ref = firestore.collection(QUIZZES_COLLECTION).doc(quizId);
  const doc = await ref.get();
  if (!doc.exists) return null;

  const cleanPayload = {};
  if (updates.quizName !== undefined) cleanPayload.quizName = updates.quizName.trim();
  if (updates.date !== undefined) cleanPayload.date = updates.date;
  if (updates.time !== undefined) cleanPayload.time = updates.time;
  if (updates.venue !== undefined) cleanPayload.venue = updates.venue.trim();
  if (updates.topic !== undefined) cleanPayload.topic = updates.topic ? updates.topic.trim() : null;

  cleanPayload.updatedAt = admin.firestore.FieldValue.serverTimestamp();
  await ref.update(cleanPayload);

  const updated = await ref.get();
  const data = updated.data();
  return { id: updated.id, ...data };
};

module.exports = {
  createQuiz,
  getQuizzesByCourseId,
  getQuizzesByCreator,
  getQuizById,
  updateQuiz,
};
