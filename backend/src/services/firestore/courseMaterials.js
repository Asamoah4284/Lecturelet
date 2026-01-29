/**
 * Firestore Course Materials Service
 * Handles course material metadata (files stored in Firebase Storage)
 *
 * Firestore: create composite index on collection "courseMaterials":
 *   courseId (Ascending), createdAt (Descending)
 * (Console will prompt with a link when the query first runs.)
 */

const { firestore } = require('../../config/firebase');
const admin = require('firebase-admin');

const COLLECTION = 'courseMaterials';

/**
 * List materials for a course
 * @param {string} courseId - Course ID
 * @returns {Promise<Array>} Array of material documents
 */
const listByCourse = async (courseId) => {
  const snapshot = await firestore
    .collection(COLLECTION)
    .where('courseId', '==', courseId)
    .orderBy('createdAt', 'desc')
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      courseId: data.courseId,
      name: data.name,
      storagePath: data.storagePath,
      downloadUrl: data.downloadUrl,
      mimeType: data.mimeType,
      size: data.size,
      uploadedBy: data.uploadedBy,
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? data.createdAt,
    };
  });
};

/**
 * Get a single material by ID
 * @param {string} materialId - Material document ID
 * @returns {Promise<Object|null>} Material or null
 */
const getById = async (materialId) => {
  const doc = await firestore.collection(COLLECTION).doc(materialId).get();
  if (!doc.exists) return null;
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? data.createdAt,
  };
};

/**
 * Create material metadata after file is uploaded to Storage
 * @param {Object} params - courseId, name, storagePath, downloadUrl, mimeType, size, uploadedBy
 * @returns {Promise<Object>} Created material document
 */
const create = async ({ courseId, name, storagePath, downloadUrl, mimeType, size, uploadedBy }) => {
  const ref = firestore.collection(COLLECTION).doc();
  const doc = {
    courseId,
    name,
    storagePath,
    downloadUrl: downloadUrl || null,
    mimeType: mimeType || null,
    size: size || 0,
    uploadedBy,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await ref.set(doc);
  return {
    id: ref.id,
    courseId,
    name,
    storagePath,
    downloadUrl: downloadUrl || null,
    mimeType: mimeType || null,
    size: size || 0,
    uploadedBy,
    createdAt: new Date().toISOString(),
  };
};

/**
 * Delete material document (caller must delete file from Storage separately)
 * @param {string} materialId - Material document ID
 * @returns {Promise<void>}
 */
const remove = async (materialId) => {
  await firestore.collection(COLLECTION).doc(materialId).delete();
};

module.exports = {
  listByCourse,
  getById,
  create,
  remove,
};
