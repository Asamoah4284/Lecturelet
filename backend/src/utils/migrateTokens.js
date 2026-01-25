const { User, DeviceToken } = require('../models');

/**
 * Migrate old User.pushToken values to DeviceToken collection
 * This ensures users who haven't logged in since the multi-device fix still receive notifications
 */
const migrateOldTokens = async () => {
    try {
        console.log('🔄 Starting token migration from User.pushToken to DeviceToken collection...');

        // Find all users with pushToken but check if they already have DeviceToken entries
        const users = await User.find({
            pushToken: { $ne: null, $exists: true }
        });

        if (users.length === 0) {
            console.log('ℹ️  No users with push tokens found. Nothing to migrate.');
            return { success: true, migrated: 0, skipped: 0, errors: 0 };
        }

        console.log(`Found ${users.length} users with push tokens. Checking for migration...`);

        let migrated = 0;
        let skipped = 0; // This might not be incremented directly anymore if registerToken handles existing
        let errors = 0;

        for (const user of users) {
            console.log(`🔍 Processing user: ${user.fullName || user._id} with token: ${user.pushToken ? user.pushToken.substring(0, 15) + '...' : 'NONE'}`);
            try {
                if (!user.pushToken) {
                    console.log(`⚠️  User ${user.fullName || user._id} has no token field, skipping`);
                    skipped++;
                    continue;
                }

                // Detect platform from token format
                const platform = user.pushToken.startsWith('ExponentPushToken[') ? 'ios' : 'android';

                // Use the robust registerToken method which handles updates/migration automatically
                const dt = await DeviceToken.registerToken(
                    user._id.toString(), // Ensure it's a string
                    user.pushToken,
                    platform,
                    { appVersion: 'migrated-from-user-model' }
                );

                if (dt) {
                    console.log(`✅ Migrated/Verified token for user ${user.fullName || user._id} (${platform})`);
                    migrated++;
                } else {
                    console.log(`❌ registerToken returned null for user ${user.fullName || user._id}`);
                    errors++;
                }

            } catch (error) {
                console.error(`❌ Error migrating token for user ${user._id}:`, error.message);
                errors++;
            }
        }

        console.log('\n✅ Token migration complete!');
        console.log('═'.repeat(50));
        console.log(`📊 Results:`);
        console.log(`   Successfully migrated: ${migrated}`);
        console.log(`   Skipped (already exists): ${skipped}`);
        console.log(`   Errors: ${errors}`);
        console.log(`   Total processed: ${users.length}`);
        console.log('═'.repeat(50));

        return { success: true, migrated, skipped, errors, total: users.length };

    } catch (error) {
        console.error('❌ Token migration failed:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Run migration immediately if this file is executed directly
 */
if (require.main === module) {
    const mongoose = require('mongoose');
    require('dotenv').config();

    const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://richardasamoah284_db_user:gTVDa4TlxlE6GFDH@lecturelet.cjanvfa.mongodb.net/LectureLet?retryWrites=true&w=majority';

    console.log('🚀 Starting migration script...\n');

    mongoose.connect(mongoURI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    })
        .then(async () => {
            console.log('📡 Connected to MongoDB\n');
            const result = await migrateOldTokens();

            mongoose.connection.close();

            if (result.success) {
                console.log('\n✅ Migration completed successfully!');
                process.exit(0);
            } else {
                console.log('\n❌ Migration failed:', result.error);
                process.exit(1);
            }
        })
        .catch(err => {
            console.error('❌ MongoDB connection error:', err.message);
            process.exit(1);
        });
}

module.exports = { migrateOldTokens };
