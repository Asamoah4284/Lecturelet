/**
 * Database Seed Script
 * Loads sample data into the LectureLet MongoDB database
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');

// Import models
const User = require('../models/User');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Notification = require('../models/Notification');

/**
 * Sample Users Data
 */
const sampleUsers = [
  {
    email: 'john.doe@university.edu',
    password: 'password123',
    fullName: 'John Doe',
    role: 'course_rep',
    studentId: 'STU001',
    notificationsEnabled: true,
    reminderMinutes: 15
  },
  {
    email: 'jane.smith@university.edu',
    password: 'password123',
    fullName: 'Jane Smith',
    role: 'course_rep',
    studentId: 'STU002',
    notificationsEnabled: true,
    reminderMinutes: 30
  },
  {
    email: 'alice.johnson@university.edu',
    password: 'password123',
    fullName: 'Alice Johnson',
    role: 'student',
    studentId: 'STU003',
    notificationsEnabled: true,
    reminderMinutes: 15
  },
  {
    email: 'bob.williams@university.edu',
    password: 'password123',
    fullName: 'Bob Williams',
    role: 'student',
    studentId: 'STU004',
    notificationsEnabled: true,
    reminderMinutes: 10
  },
  {
    email: 'charlie.brown@university.edu',
    password: 'password123',
    fullName: 'Charlie Brown',
    role: 'student',
    studentId: 'STU005',
    notificationsEnabled: false,
    reminderMinutes: 15
  },
  {
    email: 'diana.ross@university.edu',
    password: 'password123',
    fullName: 'Diana Ross',
    role: 'student',
    studentId: 'STU006',
    notificationsEnabled: true,
    reminderMinutes: 20
  },
  {
    email: 'evan.peters@university.edu',
    password: 'password123',
    fullName: 'Evan Peters',
    role: 'student',
    studentId: 'STU007',
    notificationsEnabled: true,
    reminderMinutes: 15
  },
  {
    email: 'fiona.green@university.edu',
    password: 'password123',
    fullName: 'Fiona Green',
    role: 'student',
    studentId: 'STU008',
    notificationsEnabled: true,
    reminderMinutes: 30
  }
];

/**
 * Sample Courses Data (will be linked to course reps after user creation)
 */
const sampleCourses = [
  {
    courseName: 'Introduction to Computer Science',
    courseCode: 'CS101',
    days: ['Monday', 'Wednesday'],
    startTime: '09:00',
    endTime: '10:30',
    venue: 'Room A101',
    creditHours: '3',
    indexFrom: '001',
    indexTo: '100',
    courseRepName: 'John Doe'
  },
  {
    courseName: 'Data Structures and Algorithms',
    courseCode: 'CS201',
    days: ['Tuesday', 'Thursday'],
    startTime: '11:00',
    endTime: '12:30',
    venue: 'Room B205',
    creditHours: '4',
    indexFrom: '001',
    indexTo: '080',
    courseRepName: 'John Doe'
  },
  {
    courseName: 'Database Management Systems',
    courseCode: 'CS301',
    days: ['Monday', 'Wednesday', 'Friday'],
    startTime: '14:00',
    endTime: '15:00',
    venue: 'Computer Lab 3',
    creditHours: '3',
    indexFrom: '001',
    indexTo: '060',
    courseRepName: 'Jane Smith'
  },
  {
    courseName: 'Web Development Fundamentals',
    courseCode: 'CS250',
    days: ['Tuesday', 'Thursday'],
    startTime: '09:00',
    endTime: '10:30',
    venue: 'Room C102',
    creditHours: '3',
    indexFrom: '001',
    indexTo: '075',
    courseRepName: 'Jane Smith'
  },
  {
    courseName: 'Calculus I',
    courseCode: 'MATH101',
    days: ['Monday', 'Wednesday', 'Friday'],
    startTime: '08:00',
    endTime: '09:00',
    venue: 'Lecture Hall 1',
    creditHours: '4',
    indexFrom: '001',
    indexTo: '200',
    courseRepName: 'John Doe'
  },
  {
    courseName: 'Linear Algebra',
    courseCode: 'MATH201',
    days: ['Tuesday', 'Thursday'],
    startTime: '14:00',
    endTime: '15:30',
    venue: 'Room D301',
    creditHours: '3',
    indexFrom: '001',
    indexTo: '100',
    courseRepName: 'Jane Smith'
  },
  {
    courseName: 'Technical Writing',
    courseCode: 'ENG102',
    days: ['Friday'],
    startTime: '10:00',
    endTime: '12:00',
    venue: 'Room E105',
    creditHours: '2',
    indexFrom: '001',
    indexTo: '050',
    courseRepName: 'John Doe'
  },
  {
    courseName: 'Physics for Engineers',
    courseCode: 'PHY101',
    days: ['Monday', 'Wednesday'],
    startTime: '11:00',
    endTime: '12:30',
    venue: 'Physics Lab',
    creditHours: '4',
    indexFrom: '001',
    indexTo: '090',
    courseRepName: 'Jane Smith'
  }
];

/**
 * Sample Notification Templates
 */
const notificationTemplates = [
  {
    title: 'Welcome to LectureLet!',
    message: 'Thank you for joining LectureLet. Stay updated with your lecture schedules!',
    type: 'system'
  },
  {
    title: 'Lecture Reminder',
    message: 'Your lecture starts in 15 minutes. Don\'t be late!',
    type: 'lecture_reminder'
  },
  {
    title: 'Schedule Change',
    message: 'The lecture venue has been changed. Please check the updated details.',
    type: 'course_update'
  },
  {
    title: 'New Announcement',
    message: 'The course representative has posted a new announcement.',
    type: 'announcement'
  }
];

/**
 * Clear existing data
 */
const clearDatabase = async () => {
  console.log('🗑️  Clearing existing data...');
  await Promise.all([
    User.deleteMany({}),
    Course.deleteMany({}),
    Enrollment.deleteMany({}),
    Notification.deleteMany({})
  ]);
  console.log('✅ Database cleared');
};

/**
 * Seed Users
 */
const seedUsers = async () => {
  console.log('👥 Seeding users...');
  const users = await User.insertMany(sampleUsers);
  console.log(`✅ Created ${users.length} users`);
  return users;
};

/**
 * Seed Courses
 */
const seedCourses = async (users) => {
  console.log('📚 Seeding courses...');
  
  // Get course reps
  const johnDoe = users.find(u => u.email === 'john.doe@university.edu');
  const janeSmith = users.find(u => u.email === 'jane.smith@university.edu');
  
  // Assign courses to course reps
  const coursesWithCreators = await Promise.all(
    sampleCourses.map(async (course) => {
      const uniqueCode = await Course.generateUniqueCode();
      return {
        ...course,
        uniqueCode,
        createdBy: course.courseRepName === 'John Doe' ? johnDoe._id : janeSmith._id
      };
    })
  );
  
  const courses = await Course.insertMany(coursesWithCreators);
  console.log(`✅ Created ${courses.length} courses`);
  return courses;
};

/**
 * Seed Enrollments
 */
const seedEnrollments = async (users, courses) => {
  console.log('📝 Seeding enrollments...');
  
  // Get students (non-course-reps)
  const students = users.filter(u => u.role === 'student');
  
  // Create enrollments - each student enrolls in 3-5 random courses
  const enrollments = [];
  
  for (const student of students) {
    // Randomly select 3-5 courses for this student
    const numCourses = Math.floor(Math.random() * 3) + 3; // 3 to 5
    const shuffledCourses = [...courses].sort(() => Math.random() - 0.5);
    const selectedCourses = shuffledCourses.slice(0, numCourses);
    
    for (const course of selectedCourses) {
      enrollments.push({
        userId: student._id,
        courseId: course._id
      });
    }
  }
  
  // Course reps are also enrolled in their own courses
  const courseReps = users.filter(u => u.role === 'course_rep');
  for (const rep of courseReps) {
    const repCourses = courses.filter(c => c.createdBy.toString() === rep._id.toString());
    for (const course of repCourses) {
      enrollments.push({
        userId: rep._id,
        courseId: course._id
      });
    }
  }
  
  const createdEnrollments = await Enrollment.insertMany(enrollments);
  console.log(`✅ Created ${createdEnrollments.length} enrollments`);
  return createdEnrollments;
};

/**
 * Seed Notifications
 */
const seedNotifications = async (users, courses) => {
  console.log('🔔 Seeding notifications...');
  
  const notifications = [];
  
  for (const user of users) {
    // Welcome notification for all users
    notifications.push({
      userId: user._id,
      title: 'Welcome to LectureLet!',
      message: `Hello ${user.fullName}! Welcome to LectureLet. Stay updated with your lecture schedules.`,
      type: 'system',
      isRead: Math.random() > 0.5
    });
    
    // Add some course-specific notifications
    const randomCourse = courses[Math.floor(Math.random() * courses.length)];
    
    if (Math.random() > 0.3) {
      notifications.push({
        userId: user._id,
        title: 'Lecture Reminder',
        message: `${randomCourse.courseName} starts in 15 minutes at ${randomCourse.venue}.`,
        type: 'lecture_reminder',
        courseId: randomCourse._id,
        isRead: Math.random() > 0.6
      });
    }
    
    if (Math.random() > 0.5) {
      notifications.push({
        userId: user._id,
        title: 'Schedule Update',
        message: `The schedule for ${randomCourse.courseCode} has been updated. Please check the new timings.`,
        type: 'course_update',
        courseId: randomCourse._id,
        isRead: Math.random() > 0.7
      });
    }
    
    if (Math.random() > 0.6) {
      notifications.push({
        userId: user._id,
        title: 'New Announcement',
        message: `The course representative for ${randomCourse.courseName} has posted a new announcement.`,
        type: 'announcement',
        courseId: randomCourse._id,
        isRead: false
      });
    }
  }
  
  const createdNotifications = await Notification.insertMany(notifications);
  console.log(`✅ Created ${createdNotifications.length} notifications`);
  return createdNotifications;
};

/**
 * Main seed function
 */
const seedDatabase = async () => {
  console.log('🌱 Starting database seed...\n');
  
  try {
    await connectDB();
    
    // Clear existing data
    await clearDatabase();
    
    // Seed data
    const users = await seedUsers();
    const courses = await seedCourses(users);
    await seedEnrollments(users, courses);
    await seedNotifications(users, courses);
    
    console.log('\n🎉 Database seeding completed successfully!\n');
    console.log('📋 Summary:');
    console.log('   - Users: 8 (2 course reps, 6 students)');
    console.log('   - Courses: 8');
    console.log('   - Enrollments: varies based on random assignment');
    console.log('   - Notifications: varies based on random generation');
    console.log('\n🔑 Test Credentials:');
    console.log('   Course Rep: john.doe@university.edu / password123');
    console.log('   Course Rep: jane.smith@university.edu / password123');
    console.log('   Student: alice.johnson@university.edu / password123');
    console.log('   (All users have password: password123)\n');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    console.error(error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  seedDatabase().then(() => {
    mongoose.connection.close();
    process.exit(0);
  });
}

module.exports = seedDatabase;








