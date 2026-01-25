const { User, Enrollment, DeviceToken, Course } = require('../models');

/**
 * Diagnose notification issues for a specific course
 * Shows exactly why each student does or doesn't receive push notifications
 * 
 * @param {String} courseId - MongoDB course ID
 * @returns {Promise<Object>} Diagnostic statistics
 */
const diagnoseNotificationIssues = async (courseId) => {
    try {
        console.log('\n🔍 NOTIFICATION DIAGNOSTIC REPORT');
        console.log('═'.repeat(70));
        console.log(`Course ID: ${courseId}\n`);

        const course = await Course.findById(courseId);
        if (!course) {
            console.log('❌ Course not found');
            return { error: 'Course not found' };
        }

        console.log(`📚 Course: ${course.courseName} (${course.courseCode || 'N/A'})`);

        const enrollments = await Enrollment.find({ courseId })
            .populate('userId', 'fullName pushToken notificationsEnabled paymentStatus trialEndDate');

        console.log(`👥 Total enrolled students: ${enrollments.length}\n`);
        console.log('═'.repeat(70));

        if (enrollments.length === 0) {
            console.log('ℹ️  No students enrolled in this course.');
            return { total: 0 };
        }

        let stats = {
            total: enrollments.length,
            hasActiveAccess: 0,
            noActiveAccess: 0,
            notificationsEnabled: 0,
            notificationsDisabled: 0,
            hasDeviceTokens: 0,
            noDeviceTokens: 0,
            hasOldPushToken: 0,
            wouldReceivePush: 0,
            wouldNotReceivePush: 0,
            issues: {
                noAccess: [],
                notificationsOff: [],
                noTokens: [],
                needsMigration: []
            }
        };

        for (const enrollment of enrollments) {
            const student = enrollment.userId;
            if (!student) {
                console.log('⚠️  Student record missing for enrollment');
                continue;
            }

            const fullUser = await User.findById(student._id);
            if (!fullUser) {
                console.log(`⚠️  Full user record not found for ${student._id}`);
                continue;
            }

            const hasActiveAccess = fullUser.hasActiveAccess();
            const deviceTokens = await DeviceToken.find({
                userId: student._id,
                isActive: true
            });

            // Update stats
            if (hasActiveAccess) stats.hasActiveAccess++;
            else {
                stats.noActiveAccess++;
                stats.issues.noAccess.push(student.fullName);
            }

            if (student.notificationsEnabled) stats.notificationsEnabled++;
            else {
                stats.notificationsDisabled++;
                stats.issues.notificationsOff.push(student.fullName);
            }

            if (deviceTokens.length > 0) stats.hasDeviceTokens++;
            else {
                stats.noDeviceTokens++;
                stats.issues.noTokens.push(student.fullName);
            }

            if (student.pushToken) {
                stats.hasOldPushToken++;
                if (deviceTokens.length === 0) {
                    stats.issues.needsMigration.push(student.fullName);
                }
            }

            const wouldReceive = hasActiveAccess && student.notificationsEnabled && deviceTokens.length > 0;
            if (wouldReceive) stats.wouldReceivePush++;
            else stats.wouldNotReceivePush++;

            // Detailed log for each student
            console.log(`\n📊 ${student.fullName}:`);
            console.log(`   ├─ Active Access: ${hasActiveAccess ? '✅ YES' : '❌ NO'} ${!hasActiveAccess ? `(Trial: ${fullUser.isTrialActive() ? 'Active' : 'Expired'}, Paid: ${fullUser.paymentStatus})` : ''}`);
            console.log(`   ├─ Notifications Enabled: ${student.notificationsEnabled ? '✅ YES' : '❌ NO'}`);
            console.log(`   ├─ Device Tokens: ${deviceTokens.length > 0 ? `✅ ${deviceTokens.length} device(s)` : '❌ None'}`);
            console.log(`   ├─ Old Push Token: ${student.pushToken ? '✅ Yes (needs migration)' : '❌ No'}`);
            console.log(`   └─ **WILL RECEIVE PUSH**: ${wouldReceive ? '✅ YES' : '❌ NO'}`);

            if (!wouldReceive) {
                console.log(`\n   ⚠️  BLOCKING ISSUES:`);
                if (!hasActiveAccess) {
                    console.log(`      ❌ No active access (trial expired: ${fullUser.trialEndDate ? fullUser.trialEndDate.toISOString() : 'N/A'}, not paid)`);
                }
                if (!student.notificationsEnabled) {
                    console.log(`      ❌ Notifications disabled in app settings`);
                }
                if (deviceTokens.length === 0) {
                    console.log(`      ❌ No device tokens registered (user needs to login)`);
                    if (student.pushToken) {
                        console.log(`         💡 Has old token - run migration script!`);
                    }
                }
            }
        }

        // Summary
        console.log('\n' + '═'.repeat(70));
        console.log('📊 SUMMARY STATISTICS');
        console.log('═'.repeat(70));
        console.log(`Total Students:           ${stats.total}`);
        console.log(`─`.repeat(70));
        console.log(`✅ Has Active Access:      ${stats.hasActiveAccess} (${Math.round(stats.hasActiveAccess / stats.total * 100)}%)`);
        console.log(`❌ No Active Access:       ${stats.noActiveAccess} (${Math.round(stats.noActiveAccess / stats.total * 100)}%)`);
        console.log(`─`.repeat(70));
        console.log(`✅ Notifications Enabled:  ${stats.notificationsEnabled}`);
        console.log(`❌ Notifications Disabled: ${stats.notificationsDisabled}`);
        console.log(`─`.repeat(70));
        console.log(`✅ Has Device Tokens:      ${stats.hasDeviceTokens}`);
        console.log(`❌ No Device Tokens:       ${stats.noDeviceTokens}`);
        console.log(`─`.repeat(70));
        console.log(`Has Old Push Token:       ${stats.hasOldPushToken}`);
        console.log(`═`.repeat(70));
        console.log(`\n🎯 FINAL RESULT:`);
        console.log(`   ✅ WOULD RECEIVE PUSH:     ${stats.wouldReceivePush} students (${Math.round(stats.wouldReceivePush / stats.total * 100)}%)`);
        console.log(`   ❌ WOULD NOT RECEIVE PUSH: ${stats.wouldNotReceivePush} students (${Math.round(stats.wouldNotReceivePush / stats.total * 100)}%)`);
        console.log('═'.repeat(70));

        // Recommendations
        console.log('\n💡 RECOMMENDED ACTIONS:\n');

        if (stats.issues.needsMigration.length > 0) {
            console.log(`1. 🔄 RUN MIGRATION SCRIPT (${stats.issues.needsMigration.length} users need it):`);
            console.log(`   node src/utils/migrateTokens.js\n`);
        }

        if (stats.issues.noAccess.length > 0) {
            console.log(`2. 📅 EXTEND TRIAL PERIOD (${stats.issues.noAccess.length} users have no access):`);
            console.log(`   db.users.updateMany({ paymentStatus: false }, { $set: { trialEndDate: new Date(Date.now() + 30*24*60*60*1000) } })\n`);
        }

        if (stats.issues.noTokens.length > 0) {
            console.log(`3. 📱 ASK USERS TO RE-LOGIN (${stats.issues.noTokens.length} users have no tokens):`);
            console.log(`   Send in-app message asking them to logout and login again\n`);
        }

        if (stats.issues.notificationsOff.length > 0) {
            console.log(`4. 🔔 ASK USERS TO ENABLE NOTIFICATIONS (${stats.issues.notificationsOff.length} users disabled them):`);
            console.log(`   Send in-app message or prompt to enable notifications\n`);
        }

        console.log('═'.repeat(70));

        return stats;

    } catch (error) {
        console.error('❌ Error diagnosing notifications:', error);
        return { error: error.message };
    }
};

/**
 * Diagnose notifications for ALL courses
 */
const diagnoseAllCourses = async () => {
    try {
        const courses = await Course.find();
        console.log(`\n🔍 Diagnosing ${courses.length} courses...\n`);

        const results = [];
        for (const course of courses) {
            const stats = await diagnoseNotificationIssues(course._id);
            results.push({
                courseId: course._id,
                courseName: course.courseName,
                stats
            });
        }

        return results;
    } catch (error) {
        console.error('Error diagnosing all courses:', error);
        throw error;
    }
};

/**
 * Run diagnostic if this file is executed directly
 */
if (require.main === module) {
    const mongoose = require('mongoose');
    require('dotenv').config();

    const courseId = process.argv[2];
    const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://richardasamoah284_db_user:gTVDa4TlxlE6GFDH@lecturelet.cjanvfa.mongodb.net/LectureLet?retryWrites=true&w=majority';

    if (!courseId || courseId === '--all') {
        if (courseId === '--all') {
            console.log('🚀 Running diagnostics for ALL courses...\n');
            mongoose.connect(mongoURI)
                .then(async () => {
                    console.log('📡 Connected to MongoDB\n');
                    await diagnoseAllCourses();
                    mongoose.connection.close();
                    process.exit(0);
                })
                .catch(err => {
                    console.error('❌ MongoDB connection error:', err.message);
                    process.exit(1);
                });
        } else {
            console.log('╔═══════════════════════════════════════════════╗');
            console.log('║   Notification Diagnostic Tool               ║');
            console.log('╚═══════════════════════════════════════════════╝\n');
            console.log('Usage:');
            console.log('  node src/utils/diagnoseNotifications.js <courseId>');
            console.log('  node src/utils/diagnoseNotifications.js --all\n');
            console.log('Example:');
            console.log('  node src/utils/diagnoseNotifications.js 65f8a1234567890abcdef123\n');
            process.exit(1);
        }
    } else {
        mongoose.connect(mongoURI)
            .then(async () => {
                console.log('📡 Connected to MongoDB\n');
                await diagnoseNotificationIssues(courseId);
                mongoose.connection.close();
                process.exit(0);
            })
            .catch(err => {
                console.error('❌ MongoDB connection error:', err.message);
                process.exit(1);
            });
    }
}

module.exports = { diagnoseNotificationIssues, diagnoseAllCourses };
