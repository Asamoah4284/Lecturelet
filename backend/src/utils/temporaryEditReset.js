const { Course } = require('../models');

/**
 * Reset temporary edits that have expired (older than 24 hours)
 * This should be called periodically (e.g., every hour via cron job)
 */
const resetExpiredTemporaryEdits = async () => {
  try {
    const resetCount = await Course.resetExpiredTemporaryEdits();
    if (resetCount > 0) {
      console.log(`Reset ${resetCount} expired temporary course edits`);
    }
    return resetCount;
  } catch (error) {
    console.error('Error resetting expired temporary edits:', error);
    throw error;
  }
};

/**
 * Start a periodic job to reset expired temporary edits
 * Runs every hour
 */
const startTemporaryEditResetJob = () => {
  // Run immediately on startup
  resetExpiredTemporaryEdits();
  
  // Then run every hour (3600000 milliseconds)
  setInterval(() => {
    resetExpiredTemporaryEdits();
  }, 60 * 60 * 1000); // 1 hour
  
  console.log('Temporary edit reset job started (runs every hour)');
};

module.exports = {
  resetExpiredTemporaryEdits,
  startTemporaryEditResetJob,
};

