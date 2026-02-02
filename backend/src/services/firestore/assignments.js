/**
 * Firestore Assignments Service
 * Handles assignment CRUD for courses stored in Firestore (Firestore courseId)
 */

const { firestore } = require('../../config/firebase');
const admin = require('firebase-admin');

const ASSIGNMENTS_COLLECTION = 'assignments';

const toIso = (v) => {
  if (!v) return undefined;
  if (typeof v === 'string') return v;
  if (v.toDate && typeof v.toDate === 'function') return v.toDate().toISOString();
  if (v.toISOString && typeof v.toISOString === 'function') return v.toISOString();
  return undefined;
};

const toApiShape = (id, data) => ({
  id,
  assignment_name: data.assignmentName,
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

const createAssignment = async (input) => {
  const ref = firestore.collection(ASSIGNMENTS_COLLECTION).doc();
  const now = admin.firestore.FieldValue.serverTimestamp();
  const doc = {
    courseId: input.courseId,
    assignmentName: (input.assignmentName || '').trim(),
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

const getAssignmentsByCourseId = async (courseId) => {
  const snapshot = await firestore
    .collection(ASSIGNMENTS_COLLECTION)
    .where('courseId', '==', courseId)
    .get();
  const items = snapshot.docs.map((d) => {
    const data = d.data();
    return { id: d.id, ...data };
  });
  items.sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() ?? a.createdAt ?? 0;
    const tb = b.createdAt?.toMillis?.() ?? b.createdAt ?? 0;
    return tb - ta;
  });
  return items.map((q) => toApiShape(q.id, q));
};

const getAssignmentsByCreator = async (userId) => {
  const snapshot = await firestore
    .collection(ASSIGNMENTS_COLLECTION)
    .where('createdBy', '==', userId)
    .get();
  const items = snapshot.docs.map((d) => {
    const data = d.data();
    return { id: d.id, ...data };
  });
  items.sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() ?? a.createdAt ?? 0;
    const tb = b.createdAt?.toMillis?.() ?? b.createdAt ?? 0;
    return tb - ta;
  });
  return items.map((q) => toApiShape(q.id, q));
};

module.exports = {
  createAssignment,
  getAssignmentsByCourseId,
  getAssignmentsByCreator,
};
