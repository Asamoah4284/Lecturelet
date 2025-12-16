/**
 * Script to drop the email index from the users collection
 * Run this once to remove the old email index after removing email field from schema
 * 
 * Usage: node src/database/dropEmailIndex.js
 */

const mongoose = require('mongoose');
const config = require('../config');

async function dropEmailIndex() {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.database.uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // Get all indexes
    const indexes = await usersCollection.indexes();
    console.log('Current indexes:', indexes.map(idx => idx.name));

    // Check if email_1 index exists
    const emailIndex = indexes.find(idx => idx.name === 'email_1');
    
    if (emailIndex) {
      console.log('📧 Found email_1 index, dropping it...');
      await usersCollection.dropIndex('email_1');
      console.log('✅ Successfully dropped email_1 index');
    } else {
      console.log('ℹ️  email_1 index not found (may have already been dropped)');
    }

    // Show updated indexes
    const updatedIndexes = await usersCollection.indexes();
    console.log('Updated indexes:', updatedIndexes.map(idx => idx.name));

    await mongoose.connection.close();
    console.log('✅ Connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the script
dropEmailIndex();









