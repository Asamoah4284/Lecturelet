/**
 * Database Initialization Script
 * Connects to MongoDB for LectureLet application
 */

require('dotenv').config();
const connectDB = require('../config/database');

// Import models to ensure indexes are created
require('../models/User');
require('../models/Course');
require('../models/Enrollment');
require('../models/Notification');
const College = require('../models/College');

const colleges = [
  'College of Humanities and Legal Studies',
  'College of Education Studies',
  'College of Agricultural and Natural Sciences',
  'College of Health and Allied Sciences',
  'College of Distance Education'
];

const initializeDatabase = async () => {
  console.log('🚀 Initializing MongoDB database...');
  
  try {
    await connectDB();
    console.log('✅ MongoDB connected successfully');
    console.log('✅ All model indexes will be created automatically');
    
    // Ensure colleges are seeded
    console.log('🏛️  Checking colleges...');
    const existingColleges = await College.find({});
    
    if (existingColleges.length === 0) {
      console.log('📝 Seeding colleges...');
      const collegesToInsert = colleges.map(name => ({
        name,
        isActive: true
      }));
      await College.insertMany(collegesToInsert);
      console.log(`✅ Created ${colleges.length} colleges`);
    } else {
      console.log(`✅ Found ${existingColleges.length} existing colleges`);
      
      // Ensure all required colleges exist
      const existingNames = existingColleges.map(c => c.name);
      const missingColleges = colleges.filter(name => !existingNames.includes(name));
      
      if (missingColleges.length > 0) {
        console.log(`📝 Adding ${missingColleges.length} missing colleges...`);
        const collegesToInsert = missingColleges.map(name => ({
          name,
          isActive: true
        }));
        await College.insertMany(collegesToInsert);
        console.log(`✅ Added ${missingColleges.length} colleges`);
      }
    }
    
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
