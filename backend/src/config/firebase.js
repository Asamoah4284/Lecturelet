/**
 * Firebase Configuration
 * Initializes Firebase Admin SDK for backend operations
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin SDK
let firebaseInitialized = false;

const initializeFirebase = () => {
  if (firebaseInitialized) {
    return admin;
  }

  try {
    // Try to load service account key from environment variable or file
    let serviceAccount;
    
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      // Service account key provided as environment variable (JSON string)
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    } else {
      // Try to load from file (relative to backend directory)
      const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 
        path.join(__dirname, '../../lecturelet-c03be-firebase-adminsdk-fbsvc-b73708ead1.json');
      
      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccountData = fs.readFileSync(serviceAccountPath, 'utf8');
        serviceAccount = JSON.parse(serviceAccountData);
      } else {
        throw new Error('Firebase service account key not found. Please set FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_SERVICE_ACCOUNT_PATH');
      }
    }

    const projectId = serviceAccount.project_id || 'lecturelet-c03be';
    // Default Storage bucket: newer projects use .firebasestorage.app, older use .appspot.com
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`;

    // Initialize Firebase Admin
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
      storageBucket,
    });

    firebaseInitialized = true;
    console.log('✅ Firebase Admin SDK initialized successfully');
    
    return admin;
  } catch (error) {
    console.error('❌ Firebase initialization error:', error.message);
    throw error;
  }
};

// Initialize on module load
const adminInstance = initializeFirebase();

// Export Firebase services
const authService = adminInstance.auth();
const firestoreService = adminInstance.firestore();
const messagingService = adminInstance.messaging();
const storageService = adminInstance.storage();

module.exports = {
  admin: adminInstance,
  auth: authService,
  firestore: firestoreService,
  messaging: messagingService,
  storage: storageService,
  initializeFirebase,
};
