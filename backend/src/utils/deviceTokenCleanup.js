const { cleanupOldTokens } = require('../services/firestore/deviceTokens');

/**
 * Clean up inactive device tokens older than specified days
 * This prevents the database from growing indefinitely with old tokens
 * @param {Number} daysOld - Delete tokens inactive for this many days (default: 30)
 * @returns {Promise<Object>} Result object with success status and deleted count
 */
const cleanupInactiveTokens = async (daysOld = 30) => {
    try {
        console.log(`Starting device token cleanup (tokens inactive for ${daysOld}+ days)...`);

        const deletedCount = await cleanupOldTokens(daysOld);

        if (deletedCount > 0) {
            console.log(`✅ Device token cleanup complete: ${deletedCount} tokens deleted`);
        }

        return {
            success: true,
            deletedCount,
            message: `Cleaned up ${deletedCount} inactive device tokens`
        };
    } catch (error) {
        // Don't crash the server if index isn't created yet
        console.warn('⚠️ Device token cleanup skipped:', error.message);
        return {
            success: false,
            error: error.message,
            deletedCount: 0
        };
    }
};

/**
 * Start a periodic job to clean up old device tokens
 * Runs daily at midnight
 */
const startDeviceTokenCleanupJob = () => {
    // Run immediately on startup
    cleanupInactiveTokens();

    // Calculate milliseconds until next midnight
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = midnight.getTime() - now.getTime();

    // Run at midnight, then every 24 hours
    setTimeout(() => {
        cleanupInactiveTokens();
        setInterval(() => {
            cleanupInactiveTokens();
        }, 24 * 60 * 60 * 1000); // 24 hours
    }, msUntilMidnight);

    console.log('Device token cleanup job started (runs daily at midnight)');
};

module.exports = {
    cleanupInactiveTokens,
    startDeviceTokenCleanupJob,
};
