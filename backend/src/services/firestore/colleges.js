/**
 * Firestore Colleges Service
 * Handles college-related Firestore operations
 */

const { firestore } = require('../../config/firebase');
const admin = require('firebase-admin');

const COLLEGES_COLLECTION = 'colleges';

// Default colleges to seed
const DEFAULT_COLLEGES = [
  'College of Humanities and Legal Studies',
  'College of Education Studies',
  'College of Agricultural and Natural Sciences',
  'College of Health and Allied Sciences',
  'College of Distance Education'
];

/**
 * Initialize colleges collection with default colleges
 * @returns {Promise<void>}
 */
const initializeColleges = async () => {
  const collegesRef = firestore.collection(COLLEGES_COLLECTION);
  const snapshot = await collegesRef.get();

  if (snapshot.empty) {
    console.log('📝 Seeding colleges...');
    const batch = firestore.batch();

    DEFAULT_COLLEGES.forEach((name) => {
      const collegeRef = collegesRef.doc();
      batch.set(collegeRef, {
        name,
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();
    console.log(`✅ Created ${DEFAULT_COLLEGES.length} colleges`);
  } else {
    // Ensure all required colleges exist
    const existingColleges = snapshot.docs.map(doc => doc.data().name);
    const missingColleges = DEFAULT_COLLEGES.filter(name => !existingColleges.includes(name));

    if (missingColleges.length > 0) {
      console.log(`📝 Adding ${missingColleges.length} missing colleges...`);
      const batch = firestore.batch();

      missingColleges.forEach((name) => {
        const collegeRef = collegesRef.doc();
        batch.set(collegeRef, {
          name,
          isActive: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      await batch.commit();
      console.log(`✅ Added ${missingColleges.length} colleges`);
    }
  }
};

/**
 * Get all active colleges
 * @returns {Promise<Array>} Array of college names
 */
const getActiveColleges = async () => {
  const collegesRef = firestore.collection(COLLEGES_COLLECTION);
  const snapshot = await collegesRef
    .where('isActive', '==', true)
    .orderBy('name', 'asc')
    .get();

  return snapshot.docs.map(doc => doc.data().name);
};

/**
 * Check if college exists and is active
 * @param {string} collegeName - College name
 * @returns {Promise<boolean>} True if exists and active
 */
const collegeExists = async (collegeName) => {
  const collegesRef = firestore.collection(COLLEGES_COLLECTION);
  const snapshot = await collegesRef
    .where('name', '==', collegeName)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  return !snapshot.empty;
};

module.exports = {
  initializeColleges,
  getActiveColleges,
  collegeExists,
};
