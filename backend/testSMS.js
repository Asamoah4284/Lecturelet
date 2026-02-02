/**
 * Manual SMS test – sends one SMS to the given number (or default).
 * Usage: node testSMS.js [phoneNumber]
 * Example: node testSMS.js
 *          node testSMS.js 0248962044
 *          node testSMS.js 0542343069
 *
 * Default number: 0248962044
 * Ensure .env has MOOLRE_API_KEY set.
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { sendSMS } = require('./src/utils/smsService');

const DEFAULT_NUMBER = '0248962044';
const TEST_MESSAGE = 'LectureLet SMS test – If you received this, the SMS system is working.';

async function run() {
  const number = process.argv[2] || DEFAULT_NUMBER;
  console.log('--- SMS Test ---');
  console.log('Recipient:', number);
  console.log('Message:', TEST_MESSAGE);
  console.log('MOOLRE_API_KEY set:', !!process.env.MOOLRE_API_KEY);
  console.log('----------------\n');

  const result = await sendSMS(number, TEST_MESSAGE);

  if (result.success) {
    console.log('✅ SMS sent successfully');
  } else {
    console.log('❌ SMS failed:', result.message);
  }
  return result;
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
