const mongoose = require('mongoose');

const deviceTokenSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true  // Index for fast lookups
    },
    pushToken: {
        type: String,
        required: true,
        unique: true,  // Prevent duplicate tokens across users
        trim: true
    },
    platform: {
        type: String,
        enum: ['ios', 'android'],
        required: true
    },
    deviceId: {
        type: String,  // Device UUID (optional)
        default: null
    },
    appVersion: {
        type: String,
        default: null
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastUsed: {
        type: Date,
        default: Date.now
    },
    expoVersion: {
        type: String,
        default: null
    }
}, {
    timestamps: true  // createdAt, updatedAt
});

// Indexes for efficient queries
deviceTokenSchema.index({ userId: 1, isActive: 1 });
deviceTokenSchema.index({ lastUsed: 1 });

/**
 * Register or update a device token
 * @param {String} userId - User ID
 * @param {String} pushToken - Expo push token
 * @param {String} platform - 'ios' or 'android'
 * @param {Object} metadata - Optional metadata (deviceId, appVersion, expoVersion)
 * @returns {Promise<DeviceToken>} The registered/updated device token
 */
deviceTokenSchema.statics.registerToken = async function (userId, pushToken, platform, metadata = {}) {
    try {
        // Check if token already exists
        const existing = await this.findOne({ pushToken });

        if (existing) {
            // Update existing token
            existing.userId = userId;  // Update user (in case token moved to new user)
            existing.platform = platform;
            existing.isActive = true;
            existing.lastUsed = new Date();
            existing.appVersion = metadata.appVersion || existing.appVersion;
            existing.deviceId = metadata.deviceId || existing.deviceId;
            existing.expoVersion = metadata.expoVersion || existing.expoVersion;
            await existing.save();
            console.log(`Updated existing device token for user ${userId}, platform ${platform}`);
            return existing;
        }

        // Create new token
        const newToken = await this.create({
            userId,
            pushToken,
            platform,
            deviceId: metadata.deviceId || null,
            appVersion: metadata.appVersion || null,
            expoVersion: metadata.expoVersion || null,
            isActive: true,
            lastUsed: new Date()
        });

        console.log(`Registered new device token for user ${userId}, platform ${platform}`);
        return newToken;
    } catch (error) {
        console.error('Error registering device token:', error);
        throw error;
    }
};

/**
 * Get all active tokens for a user
 * @param {String} userId - User ID
 * @returns {Promise<Array>} Array of active device tokens
 */
deviceTokenSchema.statics.getActiveTokens = async function (userId) {
    return this.find({
        userId,
        isActive: true
    }).select('pushToken platform lastUsed').lean();
};

/**
 * Deactivate a specific token
 * @param {String} pushToken - Token to deactivate
 * @returns {Promise<Object>} Update result
 */
deviceTokenSchema.statics.deactivateToken = async function (pushToken) {
    const result = await this.updateOne(
        { pushToken },
        { isActive: false, lastUsed: new Date() }
    );

    if (result.modifiedCount > 0) {
        console.log(`Deactivated device token: ${pushToken.substring(0, 20)}...`);
    }

    return result;
};

/**
 * Deactivate all tokens for a user
 * @param {String} userId - User ID
 * @returns {Promise<Object>} Update result
 */
deviceTokenSchema.statics.deactivateAllUserTokens = async function (userId) {
    const result = await this.updateMany(
        { userId },
        { isActive: false, lastUsed: new Date() }
    );

    console.log(`Deactivated ${result.modifiedCount} device tokens for user ${userId}`);
    return result;
};

/**
 * Clean up old inactive tokens
 * @param {Number} daysOld - Delete tokens inactive for this many days (default: 30)
 * @returns {Promise<Number>} Number of deleted tokens
 */
deviceTokenSchema.statics.cleanupOldTokens = async function (daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.deleteMany({
        isActive: false,
        updatedAt: { $lt: cutoffDate }
    });

    return result.deletedCount;
};

/**
 * Update last used timestamp for a token
 * @param {String} pushToken - Token to update
 * @returns {Promise<Object>} Update result
 */
deviceTokenSchema.statics.updateLastUsed = async function (pushToken) {
    return this.updateOne(
        { pushToken },
        { lastUsed: new Date() }
    );
};

/**
 * Get device count for a user
 * @param {String} userId - User ID
 * @returns {Promise<Number>} Number of active devices
 */
deviceTokenSchema.statics.getDeviceCount = async function (userId) {
    return this.countDocuments({ userId, isActive: true });
};

/**
 * Get all devices for a user (for user-facing device management)
 * @param {String} userId - User ID
 * @returns {Promise<Array>} Array of devices with metadata
 */
deviceTokenSchema.statics.getUserDevices = async function (userId) {
    return this.find({ userId, isActive: true })
        .select('platform deviceId appVersion lastUsed createdAt')
        .sort({ lastUsed: -1 })
        .lean();
};

module.exports = mongoose.model('DeviceToken', deviceTokenSchema);
