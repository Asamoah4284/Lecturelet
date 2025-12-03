/**
 * Database Initialization Script
 * Connects to MongoDB for LecturerLet application
 */

require('dotenv').config();
const connectDB = require('../config/database');

// Import models to ensure indexes are created
require('../models/User');
require('../models/Course');
require('../models/Enrollment');
require('../models/Notification');

const initializeDatabase = async () => {
  console.log('🚀 Initializing MongoDB database...');
  
  try {
    await connectDB();
    console.log('✅ MongoDB connected successfully');
    console.log('✅ All model indexes will be created automatically');
    console.log('🎉 Database initialization complete!');
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  initializeDatabase().then(() => {
    process.exit(0);
  });
}

module.exports = initializeDatabase;
