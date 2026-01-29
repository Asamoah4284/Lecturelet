const { resetExpiredTemporaryEdits } = require('../services/firestore/courses');

/**
 * Reset temporary edits that have expired (older than 24 hours)
 * This should be called periodically (e.g., every hour via cron job)
 */
const resetExpiredTemporaryEditsJob = async () => {
  try {
    const resetCount = await resetExpiredTemporaryEdits();
    if (resetCount > 0) {
      console.log(`Reset ${resetCount} expired temporary course edits`);
    }
    return resetCount;
  } catch (error) {
    // Don't crash the server if index isn't created yet
    console.error('Error resetting expired temporary edits:', error.message);
    return 0;
  }
};

/**
 * Start a periodic job to reset expired temporary edits
 * Runs every hour
 */
const startTemporaryEditResetJob = () => {
  // Run immediately on startup
  resetExpiredTemporaryEditsJob();
  
  // Then run every hour (3600000 milliseconds)
  setInterval(() => {
    resetExpiredTemporaryEditsJob();
  }, 60 * 60 * 1000); // 1 hour
  
  console.log('Temporary edit reset job started (runs every hour)');
};

module.exports = {
  resetExpiredTemporaryEdits: resetExpiredTemporaryEditsJob,
  startTemporaryEditResetJob,
};
