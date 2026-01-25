require('dotenv').config();
const { sendSMS } = require('./src/utils/smsService');

async function test() {
    const number = process.argv[2] || '0542343069';
    console.log(`🚀 Starting manual SMS test...`);
    console.log('--- DEBUG INFO ---');
    console.log('MOOLRE_API_KEY Type:', typeof process.env.MOOLRE_API_KEY);
    console.log('MOOLRE_API_KEY Value:', '|' + process.env.MOOLRE_API_KEY + '|');
    console.log('MOOLRE_API_KEY Length:', process.env.MOOLRE_API_KEY ? process.env.MOOLRE_API_KEY.length : 0);
    console.log('--- END DEBUG ---');

    const result = await sendSMS(number, 'Manual Test: LectureLet SMS system is now LIVE!');

    if (result.success) {
        console.log('✅ SUCCESS');
    } else {
        console.log('❌ FAILED:', result.message);
    }
}

test();
