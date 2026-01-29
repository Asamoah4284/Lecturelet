/**
 * Firebase Authentication Middleware
 * Verifies Firebase ID tokens and attaches user to request
 */

const { auth } = require('../config/firebase');
const { getUserById, toPublicJSON } = require('../services/firestore/users');

/**
 * Authentication middleware
 * Verifies Firebase ID token and attaches user to request
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    const idToken = authHeader.split(' ')[1];
    
    // Verify Firebase ID token
    const decodedToken = await auth.verifyIdToken(idToken);
    
    // Get user document from Firestore
    const userDoc = await getUserById(decodedToken.uid);
    if (!userDoc) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User not found.',
      });
    }

    // Attach user to request (in MongoDB-compatible format)
    req.user = toPublicJSON(userDoc);
    req.firebaseUser = decodedToken; // Also attach Firebase user for custom claims access
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.',
      });
    }
    
    return res.status(401).json({
      success: false,
      message: 'Invalid token.',
    });
  }
};

/**
 * Optional authentication middleware
 * Attaches user if token is valid, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.split(' ')[1];
      const decodedToken = await auth.verifyIdToken(idToken);
      const userDoc = await getUserById(decodedToken.uid);
      
      if (userDoc) {
        req.user = toPublicJSON(userDoc);
        req.firebaseUser = decodedToken;
      }
    }
    
    next();
  } catch (error) {
    // Token invalid but continue without auth
    next();
  }
};

/**
 * Role-based authorization middleware
 * Checks user role from Firestore (can be enhanced with custom claims)
 */
const authorize = (...roles) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    try {
      // Get fresh user data from Firestore to ensure role is up-to-date
      const userDoc = await getUserById(req.user.id);
      if (!userDoc) {
        return res.status(401).json({
          success: false,
          message: 'User not found.',
        });
      }

      // Update req.user with fresh data
      req.user = toPublicJSON(userDoc);

      // Check role (support both 'course_rep' and 'rep' for compatibility)
      const userRole = userDoc.role === 'rep' ? 'course_rep' : userDoc.role;
      
      if (!roles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Insufficient permissions.',
        });
      }

      next();
    } catch (error) {
      console.error('Authorization error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authorization check failed.',
      });
    }
  };
};

module.exports = {
  authenticate,
  optionalAuth,
  authorize,
};
