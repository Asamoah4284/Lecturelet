const { DeviceToken } = require('../models');

/**
 * Clean up inactive device tokens older than specified days
 * This prevents the database from growing indefinitely with old tokens
 * @param {Number} daysOld - Delete tokens inactive for this many days (default: 30)
 * @returns {Promise<Object>} Result object with success status and deleted count
 */
const cleanupInactiveTokens = async (daysOld = 30) => {
    try {
        console.log(`Starting device token cleanup (tokens inactive for ${daysOld}+ days)...`);

        const deletedCount = await DeviceToken.cleanupOldTokens(daysOld);

        console.log(`✅ Device token cleanup complete: ${deletedCount} tokens deleted`);

        return {
            success: true,
            deletedCount,
            message: `Cleaned up ${deletedCount} inactive device tokens`
        };
    } catch (error) {
        console.error('❌ Error cleaning up device tokens:', error);
        return {
            success: false,
            error: error.message,
            deletedCount: 0
        };
    }
};

/**
 * Get statistics about device tokens
 * Useful for monitoring and analytics
 * @returns {Promise<Object>} Statistics object
 */
const getDeviceTokenStats = async () => {
    try {
        const totalActive = await DeviceToken.countDocuments({ isActive: true });
        const totalInactive = await DeviceToken.countDocuments({ isActive: false });
        const iosCount = await DeviceToken.countDocuments({ platform: 'ios', isActive: true });
        const androidCount = await DeviceToken.countDocuments({ platform: 'android', isActive: true });

        // Get token age distribution
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const activeRecent = await DeviceToken.countDocuments({
            isActive: true,
            lastUsed: { $gte: thirtyDaysAgo }
        });

        const activeOld = await DeviceToken.countDocuments({
            isActive: true,
            lastUsed: { $lt: thirtyDaysAgo }
        });

        return {
            total: totalActive + totalInactive,
            active: totalActive,
            inactive: totalInactive,
            platforms: {
                ios: iosCount,
                android: androidCount
            },
            activeRecent,  // Used in last 30 days
            activeOld,     // Not used in 30+ days (candidates for cleanup)
            timestamp: new Date()
        };
    } catch (error) {
        console.error('Error getting device token stats:', error);
        return { error: error.message };
    }
};

/**
 * Start the device token cleanup job
 * Runs periodically to remove old inactive tokens
 */
const startDeviceTokenCleanupJob = () => {
    // Run first cleanup after 1 minute (allow server to fully start)
    setTimeout(async () => {
        console.log('🧹 Running initial device token cleanup...');
        await cleanupInactiveTokens(30);
    }, 60000); // 1 minute delay

    // Then run cleanup every 24 hours (86400000 milliseconds)
    setInterval(async () => {
        console.log('🧹 Running scheduled device token cleanup...');
        await cleanupInactiveTokens(30);

        // Also log statistics
        const stats = await getDeviceTokenStats();
        console.log('📊 Device Token Statistics:', stats);
    }, 24 * 60 * 60 * 1000); // 24 hours

    console.log('✅ Device token cleanup job started (runs daily at 3 AM)');
};

module.exports = {
    cleanupInactiveTokens,
    getDeviceTokenStats,
    startDeviceTokenCleanupJob,
};
