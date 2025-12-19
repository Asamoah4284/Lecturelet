# Moolre SMS Integration - Configuration Guide

This guide provides step-by-step instructions for integrating Moolre SMS service into your codebase.

## Prerequisites

- Node.js backend with `node-fetch` or similar HTTP client
- Moolre API account and credentials
- Environment variables setup (`.env` file)

## Step 1: Install Dependencies

Ensure you have `node-fetch` installed:

```bash
npm install node-fetch
```

## Step 2: Configure Environment Variables

Add the following to your `.env` file:

```env
MOOLRE_API_KEY=your_moolre_api_key_here
MOOLRE_SENDER_ID=Your Company Name
```

**Note:** 
- `MOOLRE_API_KEY` is required (get this from your Moolre dashboard)
- `MOOLRE_SENDER_ID` is optional (defaults to "Asarion Inc" if not set)

## Step 3: Create SMS Service File

Create a file `services/smsService.js` with the following structure:

### Core Configuration

```javascript
const fetch = require('node-fetch');

// Moolre SMS API configuration
const MOOLRE_API_URL = 'https://api.moolre.com/open/sms/send';
const MOOLRE_API_KEY = process.env.MOOLRE_API_KEY;
const MOOLRE_SENDER_ID = process.env.MOOLRE_SENDER_ID || 'Your Default Sender ID';
```

### Phone Number Formatting Function

```javascript
/**
 * Format phone number for Moolre API (remove + sign, keep country code)
 * Handles formats: +233XXXXXXXXX, 233XXXXXXXXX, 0XXXXXXXXX
 * Converts to: 233XXXXXXXXX (country code format)
 */
const formatPhoneForMoolre = (phoneNumber) => {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    throw new Error('Valid phone number is required');
  }

  // Clean phone number (remove spaces, dashes, etc.)
  const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');
  
  // Remove + sign if present
  let formattedPhone = cleanPhone.startsWith('+') ? cleanPhone.substring(1) : cleanPhone;
  
  // Ensure phone number has country code
  if (formattedPhone.startsWith('0')) {
    // Replace leading 0 with 233 for Ghana (adjust country code as needed)
    formattedPhone = '233' + formattedPhone.substring(1);
  } else if (!formattedPhone.startsWith('233')) {
    // Add 233 if no country code (adjust country code as needed)
    formattedPhone = '233' + formattedPhone;
  }
  
  return formattedPhone;
};
```

### Basic SMS Sending Function

```javascript
/**
 * Send SMS via Moolre API
 * @param {string} phoneNumber - Recipient phone number
 * @param {string} message - SMS message content
 * @returns {Promise<Object>} - API response with success status
 */
const sendSMS = async (phoneNumber, message) => {
  try {
    // Validate API key
    if (!MOOLRE_API_KEY) {
      throw new Error('MOOLRE_API_KEY environment variable is not set');
    }

    // Format phone number for Moolre API
    const formattedPhone = formatPhoneForMoolre(phoneNumber);

    // Prepare API request payload according to Moolre API spec
    const payload = {
      type: 1,
      senderid: MOOLRE_SENDER_ID,
      messages: [
        {
          recipient: formattedPhone,
          message: message
        }
      ]
    };

    // Send SMS via Moolre API
    const response = await fetch(MOOLRE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-VASKEY': MOOLRE_API_KEY
      },
      body: JSON.stringify(payload)
    });

    // Parse response
    const responseData = await response.json();

    if (!response.ok) {
      throw new Error(`SMS API error: ${response.status} - ${responseData.message || 'Unknown error'}`);
    }

    // Check if SMS was sent successfully (Moolre API uses status: 1 for success)
    if (responseData.status !== 1) {
      throw new Error(`SMS sending failed: ${responseData.message || 'Unknown error'}`);
    }

    return {
      success: true,
      message: 'SMS sent successfully',
      data: responseData
    };

  } catch (error) {
    console.error('SMS sending failed:', error.message);
    return {
      success: false,
      message: error.message,
      error: error
    };
  }
};

module.exports = {
  sendSMS,
  formatPhoneForMoolre
};
```

## Step 4: Update Country Code (If Needed)

If you're not using Ghana (+233), update the country code in the `formatPhoneForMoolre` function:

- Replace `'233'` with your country code (e.g., `'234'` for Nigeria, `'254'` for Kenya)
- Update both occurrences in the function

## Step 5: Test the Integration

Create a test file `scripts/testSMS.js`:

```javascript
require('dotenv').config();
const { sendSMS } = require('../services/smsService');

async function testSMS() {
  const testPhone = '233XXXXXXXXX'; // Replace with your test phone number
  const testMessage = 'Test SMS from Moolre integration';

  console.log('Sending test SMS...');
  const result = await sendSMS(testPhone, testMessage);

  if (result.success) {
    console.log('✅ SMS sent successfully!');
    console.log('Response:', result.data);
  } else {
    console.log('❌ SMS sending failed:', result.message);
  }
}

testSMS();
```

Run the test:

```bash
node scripts/testSMS.js
```

## Step 6: API Response Format

Moolre API returns:
- **Success:** `{ status: 1, message: "Success", ... }`
- **Failure:** `{ status: 0, message: "Error message", ... }`

## Important Notes

1. **API Key Security:** Never commit your `MOOLRE_API_KEY` to version control. Always use environment variables.

2. **Phone Number Format:** Moolre expects phone numbers in international format without the `+` sign (e.g., `233XXXXXXXXX`).

3. **Error Handling:** The service returns `{ success: boolean, message: string }` format, so handle errors gracefully in your controllers.

4. **Rate Limiting:** Be aware of Moolre's rate limits and implement appropriate throttling if needed.

5. **Message Length:** Keep SMS messages concise (typically 160 characters for single SMS).

## Troubleshooting

- **"MOOLRE_API_KEY environment variable is not set"**: Check your `.env` file and ensure it's loaded (use `dotenv` package).
- **"SMS sending failed"**: Verify your API key is valid and has sufficient credits.
- **Phone number errors**: Ensure phone numbers are in the correct format (country code without + sign).

