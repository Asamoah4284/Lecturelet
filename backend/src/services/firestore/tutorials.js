/**
 * Firestore Tutorials Service
 * Handles tutorial CRUD for courses stored in Firestore (Firestore courseId)
 */

const { firestore } = require('../../config/firebase');
const admin = require('firebase-admin');

const TUTORIALS_COLLECTION = 'tutorials';

const toIso = (v) => {
  if (!v) return undefined;
  if (typeof v === 'string') return v;
  if (v.toDate && typeof v.toDate === 'function') return v.toDate().toISOString();
  if (v.toISOString && typeof v.toISOString === 'function') return v.toISOString();
  return undefined;
};

const toApiShape = (id, data) => ({
  id,
  tutorial_name: data.tutorialName,
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

const createTutorial = async (input) => {
  const ref = firestore.collection(TUTORIALS_COLLECTION).doc();
  const now = admin.firestore.FieldValue.serverTimestamp();
  const payload = {
    courseId: input.courseId,
    tutorialName: (input.tutorialName || '').trim(),
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
  await ref.set(payload);
  const snap = await ref.get();
  const data = snap.data();
  const createdAt = data.createdAt?.toDate?.() ?? new Date();
  const updatedAt = data.updatedAt?.toDate?.() ?? new Date();
  return toApiShape(snap.id, { ...data, createdAt, updatedAt });
};

const getTutorialsByCourseId = async (courseId) => {
  const snapshot = await firestore
    .collection(TUTORIALS_COLLECTION)
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

const getTutorialsByCreator = async (userId) => {
  const snapshot = await firestore
    .collection(TUTORIALS_COLLECTION)
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
  createTutorial,
  getTutorialsByCourseId,
  getTutorialsByCreator,
};
