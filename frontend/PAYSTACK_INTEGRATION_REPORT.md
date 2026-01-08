# Paystack Payment Integration Implementation Report

## Overview
This document provides a comprehensive guide for implementing Paystack payment integration in a React Native (Expo) application, based on the implementation in the As-market project. The integration is used for seller subscription payments and promotional package purchases.

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Dependencies & Installation](#dependencies--installation)
3. [Configuration](#configuration)
4. [Frontend Implementation](#frontend-implementation)
5. [Backend Implementation](#backend-implementation)
6. [Payment Flow](#payment-flow)
7. [Key Components](#key-components)
8. [API Endpoints](#api-endpoints)
9. [Error Handling](#error-handling)
10. [Testing Considerations](#testing-considerations)

---

## Architecture Overview

The Paystack integration follows a two-phase payment flow:
1. **Initialization Phase**: Frontend requests payment initialization from backend, which creates a Paystack transaction and returns a reference
2. **Verification Phase**: After user completes payment in Paystack popup, frontend verifies payment with backend, which confirms with Paystack API

### Technology Stack
- **Frontend**: React Native with Expo
- **Payment Library**: `react-native-paystack-webview` (v4.0.3)
- **Backend**: Node.js/Express
- **Payment Gateway**: Paystack API

---

## Dependencies & Installation

### Frontend Dependencies

Install the following package in your React Native/Expo project:

```bash
npm install react-native-paystack-webview@^4.0.3
```

**Required Dependencies** (likely already installed in Expo projects):
- `expo-constants` - For accessing environment variables
- `@react-native-async-storage/async-storage` - For storing user data/tokens
- `react-native-webview` - Required by paystack-webview (usually auto-installed)

### Backend Dependencies

No additional packages required beyond standard Node.js modules:
- `https` (built-in) - For making Paystack API requests
- `crypto` (built-in) - For webhook signature validation

### Expo Configuration

Add the package to your `expo.doctor` exclusions in `package.json`:

```json
{
  "expo": {
    "doctor": {
      "reactNativeDirectoryCheck": {
        "exclude": [
          "react-native-paystack-webview"
        ]
      }
    }
  }
}
```

---

## Configuration

### 1. Paystack Account Setup

1. Create a Paystack account at https://paystack.com
2. Obtain your API keys:
   - **Public Key** (starts with `pk_test_` or `pk_live_`)
   - **Secret Key** (starts with `sk_test_` or `sk_live_`)

### 2. Frontend Configuration

#### app.json Configuration

Add Paystack public key to your `app.json`:

```json
{
  "expo": {
    "extra": {
      "PAYSTACK_PUBLIC_KEY": "pk_live_your_public_key_here"
    }
  }
}
```

#### API Configuration File (`config/api.js`)

Create a configuration file to access the Paystack key:

```javascript
import Constants from 'expo-constants';

// Get Paystack public key from environment
export const PAYSTACK_PUBLIC_KEY = Constants.expoConfig?.extra?.PAYSTACK_PUBLIC_KEY;

// Validate required configuration
if (!PAYSTACK_PUBLIC_KEY) {
  console.warn('PAYSTACK_PUBLIC_KEY is not configured. Payment functionality may not work properly.');
}

export const API_BASE_URL = Constants.expoConfig?.extra?.API_URL;
```

### 3. Backend Configuration

#### Environment Variables

Add to your `.env` file:

```env
PAYSTACK_SECRET_KEY=sk_live_your_secret_key_here
FRONTEND_URL=https://your-frontend-url.com
```

#### CORS Configuration

Ensure Paystack API is allowed in CORS (if applicable):

```javascript
// In server.js or CORS config
app.use(cors({
  origin: ['your-frontend-url', 'https://api.paystack.co']
}));
```

---

## Frontend Implementation

### 1. Accesscreen Component Structure

The main Accesscreen (`PromoteStoreScreen.js`) follows this structure:

```javascript
import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { Paystack } from 'react-native-paystack-webview';
import { PAYSTACK_PUBLIC_KEY, API_BASE_URL } from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PromoteStoreScreen = () => {
  // State management
  const [showPayment, setShowPayment] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');

  // Payment initialization handler
  const handlePlanSelection = async (plan) => {
    // 1. Validate user email
    if (!userEmail) {
      Alert.alert('Email Required', 'Please ensure your email is set in your profile.');
      return;
    }

    // 2. Get authentication token
    const token = await AsyncStorage.getItem('userToken');
    if (!token) {
      Alert.alert('Authentication Required', 'Please log in to proceed.');
      return;
    }

    // 3. Parse price (remove currency symbol, convert to number)
    const packagePrice = parseFloat(plan.price.replace('GH₵', ''));

    // 4. Initialize payment with backend
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/store-promotions/initialize-payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          packageId: plan.id,
          packageName: plan.name,
          packagePrice: packagePrice,
          packageFeatures: plan.features,
          packageType: 'subscription', // or 'promo'
          duration: '1 month', // or plan duration
          email: userEmail
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // 5. Set payment data and show Paystack modal
        setPaymentData({
          ...data,
          plan: plan,
          packageData: data.packageData
        });
        setShowPayment(true);
      } else {
        Alert.alert('Payment Initialization Failed', data.error || 'Failed to initialize payment.');
      }
    } catch (error) {
      console.error('Payment initialization error:', error);
      Alert.alert('Error', 'Network error. Please check your connection.');
    }
  };

  // Accessuccess handler
  const handlePaymentSuccess = async (response) => {
    setShowPayment(false);
    setIsProcessingPayment(true);
    
    try {
      const token = await AsyncStorage.getItem('userToken');
      
      // Extract payment reference from Paystack response
      const paymentReference = response?.data?.transactionRef?.reference || 
                               response?.transactionRef?.reference || 
                               response?.reference;
      
      if (!paymentReference) {
        throw new Error('No payment reference received from Paystack');
      }

      // Verify payment with backend
      const verifyResponse = await fetch(`${API_BASE_URL}/api/v1/store-promotions/verify-payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reference: paymentReference,
          packageData: paymentData.packageData
        }),
      });

      const verifyData = await verifyResponse.json();

      if (verifyResponse.ok && verifyData.success) {
        Alert.alert(
          'Accessuccessful! 🎉',
          `${paymentData.plan.name} has been activated successfully!`,
          [{ text: 'Continue', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert('Payment Verification Failed', verifyData.error || 'Payment verification failed.');
      }
    } catch (error) {
      console.error('Payment verification error:', error);
      Alert.alert('Error', 'Payment was successful but verification failed. Please contact support.');
    } finally {
      setIsProcessingPayment(false);
      setPaymentData(null);
    }
  };

  // Payment cancel handler
  const handlePaymentCancel = () => {
    setShowPayment(false);
    setPaymentData(null);
    setSelectedPlan(null);
  };

  return (
    <View>
      {/* Your plan selection UI */}
      
      {/* Paystack Payment Modal */}
      {showPayment && paymentData && (
        <Modal visible={showPayment} animationType="slide">
          <View style={styles.paymentContainer}>
            <View style={styles.paymentHeader}>
              <TouchableOpacity onPress={handlePaymentCancel}>
                <Text>Close</Text>
              </TouchableOpacity>
              <Text style={styles.paymentTitle}>Complete Payment</Text>
            </View>
            
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentPlanName}>{paymentData.plan.name}</Text>
              <Text style={styles.paymentAmount}>
                GH₵{paymentData.plan.price.replace('GH₵', '')}
              </Text>
              <Text style={styles.paymentEmail}>{userEmail}</Text>
            </View>

            <Paystack
              paystackKey={PAYSTACK_PUBLIC_KEY}
              amount={parseFloat(paymentData.plan.price.replace('GH₵', ''))}
              billingEmail={userEmail}
              billingName={userName}
              activityIndicatorColor="#5D3FD3"
              onCancel={handlePaymentCancel}
              onSuccess={handlePaymentSuccess}
              onError={(error) => {
                console.error('Paystack error:', error);
                Alert.alert(
                  'Payment Error',
                  'There was an error processing your payment. Please try again.',
                  [{ text: 'OK', onPress: handlePaymentCancel }]
                );
              }}
              autoStart={true}
              channels={["card", "bank", "ussd", "qr", "mobile_money"]}
              currency="GHS"
              reference={paymentData.reference}
              refundable={true}
              style={styles.paystackContainer}
            />
          </View>
        </Modal>
      )}

      {/* Processing overlay */}
      {isProcessingPayment && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" />
          <Text>Verifying your payment...</Text>
        </View>
      )}
    </View>
  );
};
```

### 2. Paystack Component Props

Key props for the `<Paystack>` component:

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `paystackKey` | string | Yes | Your Paystack public key |
| `amount` | number | Yes | Amount in currency units (e.g., 7.99 for GH₵7.99) |
| `billingEmail` | string | Yes | Customer email address |
| `billingName` | string | No | Customer name |
| `reference` | string | Yes | Unique transaction reference from backend |
| `currency` | string | Yes | Currency code (e.g., "GHS") |
| `onSuccess` | function | Yes | Callback when Accessucceeds |
| `onCancel` | function | Yes | Callback when user cancels |
| `onError` | function | No | Callback for payment errors |
| `autoStart` | boolean | No | Auto-start payment (default: false) |
| `channels` | array | No | Payment channels to enable |
| `activityIndicatorColor` | string | No | Loading indicator color |
| `refundable` | boolean | No | Allow refunds (default: false) |

### 3. Payment Modal Styling

The payment modal should be full-screen with:
- Header with close button
- Payment information display (plan name, amount, email)
- Paystack component container (flex: 1)

```javascript
const styles = StyleSheet.create({
  paymentContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  paymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  paymentInfo: {
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  paystackContainer: {
    flex: 1,
  },
});
```

---

## Backend Implementation

### 1. Payment Initialization Endpoint

**Route**: `POST /api/v1/store-promotions/initialize-payment`

**Controller Implementation** (`promotionController.js`):

```javascript
const https = require('https');

exports.initializeSubscriptionPayment = asyncHandler(async (req, res) => {
  const { packageId, packageName, packagePrice, packageFeatures, packageType, duration, email } = req.body;
  const userId = req.user._id;

  // Validate required fields
  if (!packageId || !packageName || !packagePrice || !email) {
    return res.status(400).json({
      success: false,
      error: 'All package details and email are required'
    });
  }

  try {
    // Convert price to pesewas (Paystack uses smallest currency unit)
    const amountInPesewas = Math.round(packagePrice * 100);
    
    // Generate unique reference
    const reference = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Prepare Paystack API request
    const options = {
      hostname: 'api.paystack.co',
      port: 443,
      path: '/transaction/initialize',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    const paystackReq = https.request(options, paystackRes => {
      let data = '';

      paystackRes.on('data', (chunk) => {
        data += chunk;
      });

      paystackRes.on('end', async () => {
        try {
          const response = JSON.parse(data);
          
          if (!response.status) {
            throw new Error(response.message || 'Payment initialization failed');
          }

          // Return Paystack response with package data
          res.json({
            success: true,
            ...response.data,
            reference: reference,
            packageData: {
              packageId,
              packageName,
              packagePrice,
              packageFeatures,
              packageType,
              duration,
              userId: userId.toString()
            }
          });
        } catch (error) {
          console.error('Error processing Paystack response:', error);
          res.status(500).json({
            success: false,
            error: 'Failed to initialize payment',
            details: error.message
          });
        }
      });
    });

    paystackReq.on('error', (error) => {
      res.status(500).json({
        success: false,
        error: 'Payment initialization failed',
        details: error.message
      });
    });

    // Send payment data to Paystack
    const paymentData = JSON.stringify({
      email,
      amount: amountInPesewas,
      currency: 'GHS',
      callback_url: `${process.env.FRONTEND_URL}/payment/subscription-callback`,
      reference: reference,
      metadata: {
        userId: userId.toString(),
        packageId: packageId,
        packageType: packageType,
        packageName: packageName,
        packagePrice: packagePrice,
        duration: duration
      }
    });

    paystackReq.write(paymentData);
    paystackReq.end();
  } catch (error) {
    console.error('Payment initialization error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize payment',
      details: error.message
    });
  }
});
```

### 2. Payment Verification Endpoint

**Route**: `POST /api/v1/store-promotions/verify-payment`

**Controller Implementation**:

```javascript
exports.verifySubscriptionPayment = asyncHandler(async (req, res) => {
  const { reference, packageData } = req.body;

  if (!reference || !packageData) {
    return res.status(400).json({
      success: false,
      error: 'Payment reference and package data are required'
    });
  }

  try {
    // Verify payment with Paystack
    const options = {
      hostname: 'api.paystack.co',
      port: 443,
      path: `/transaction/verify/${reference}`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
      }
    };

    const paystackReq = https.request(options, paystackRes => {
      let data = '';

      paystackRes.on('data', (chunk) => {
        data += chunk;
      });

      paystackRes.on('end', async () => {
        try {
          const response = JSON.parse(data);
          
          if (response.status && response.data.status === 'success') {
            // Accessuccessful - create promotion request/subscription
            
            // Example: Create promotion request
            const promotionRequest = await PromotionRequest.create({
              userId: packageData.userId,
              packageType: packageData.packageType,
              packageId: packageData.packageId,
              packageName: packageData.packageName,
              packagePrice: packageData.packagePrice,
              packageFeatures: packageData.packageFeatures,
              duration: packageData.duration,
              paymentStatus: 'paid',
              paymentReference: reference,
              paymentProviderReference: reference,
              paymentAmount: packageData.packagePrice,
              paymentCurrency: 'GHS',
              approvalStatus: packageData.packageType === 'promo' ? 'approved' : 'pending'
            });

            // Update seller subscription if applicable
            if (packageData.packageType === 'subscription') {
              // Update subscription logic here
              await updateSubscriptionPlan(
                packageData.userId, 
                packageData.packageId, 
                endDate
              );
            }

            res.json({
              success: true,
              message: 'Payment verified successfully',
              promotionRequest: promotionRequest
            });
          } else {
            res.status(400).json({
              success: false,
              error: 'Payment verification failed',
              details: response.message || 'Payment was not successful'
            });
          }
        } catch (error) {
          console.error('Error processing Paystack verification response:', error);
          res.status(500).json({
            success: false,
            error: 'Failed to verify payment',
            details: error.message
          });
        }
      });
    });

    paystackReq.on('error', (error) => {
      res.status(500).json({
        success: false,
        error: 'Payment verification failed',
        details: error.message
      });
    });

    paystackReq.end();
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify payment',
      details: error.message
    });
  }
});
```

### 3. Routes Setup

**File**: `routes/promotionRoutes.js`

```javascript
const express = require('express');
const router = express.Router();
const promotionController = require('../controllers/promotionController');
const { protect } = require('../middleware/auth');

// Payment initialization
router.post('/initialize-payment', protect, promotionController.initializeSubscriptionPayment);

// Payment verification
router.post('/verify-payment', protect, promotionController.verifySubscriptionPayment);

module.exports = router;
```

**Server Setup** (`server.js`):

```javascript
const promotionRoutes = require('./routes/promotionRoutes');
app.use('/api/v1/store-promotions', promotionRoutes);
```

---

## Payment Flow

### Complete Payment Flow Diagram

```
┌─────────────┐
│   User      │
│  Selects    │
│   Plan      │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────┐
│  Frontend: handlePlanSelection() │
│  1. Validate email               │
│  2. Get auth token               │
│  3. Parse price                  │
└──────┬───────────────────────────┘
       │
       │ POST /initialize-payment
       ▼
┌─────────────────────────────────┐
│  Backend: initializePayment()    │
│  1. Generate reference           │
│  2. Convert to pesewas           │
│  3. Call Paystack API            │
│  4. Return reference + data       │
└──────┬───────────────────────────┘
       │
       │ Response with reference
       ▼
┌─────────────────────────────────┐
│  Frontend: Show Paystack Modal   │
│  - Set showPayment = true         │
│  - Render <Paystack> component   │
└──────┬───────────────────────────┘
       │
       │ User completes payment
       ▼
┌─────────────────────────────────┐
│  Paystack: onSuccess callback    │
│  - Extract reference              │
│  - Call handlePaymentSuccess()    │
└──────┬───────────────────────────┘
       │
       │ POST /verify-payment
       ▼
┌─────────────────────────────────┐
│  Backend: verifyPayment()        │
│  1. Verify with Paystack API     │
│  2. Create promotion/subscription │
│  3. Update seller profile        │
│  4. Return success response      │
└──────┬───────────────────────────┘
       │
       │ Success response
       ▼
┌─────────────────────────────────┐
│  Frontend: Show success alert    │
│  - Navigate back                 │
│  - Refresh data                  │
└─────────────────────────────────┘
```

### Step-by-Step Flow

1. **User Action**: User selects a subscription plan or promotional package
2. **Frontend Validation**: 
   - Check if user email exists
   - Verify authentication token
   - Parse price from plan object
3. **Payment Initialization**:
   - Frontend sends POST request to `/api/v1/store-promotions/initialize-payment`
   - Backend generates unique reference
   - Backend calls Paystack API to initialize transaction
   - Backend returns reference and package data to frontend
4. **Paystack Modal Display**:
   - Frontend sets `showPayment` state to `true`
   - Modal renders with `<Paystack>` component
   - Component auto-starts payment flow
5. **User Payment**:
   - User selects payment method (card, bank, mobile money, etc.)
   - User completes payment in Paystack interface
6. **Accessuccess**:
   - Paystack calls `onSuccess` callback
   - Frontend extracts payment reference
   - Frontend calls `/api/v1/store-promotions/verify-payment`
7. **Payment Verification**:
   - Backend verifies payment with Paystack API
   - Backend creates promotion request/subscription record
   - Backend updates seller profile
   - Backend returns success response
8. **Completion**:
   - Frontend shows success alert
   - Frontend navigates back to previous screen
   - Frontend refreshes subscription data

---

## Key Components

### 1. Paystack Component Wrapper (Optional)

You can create a reusable wrapper component:

**File**: `components/PaystackPayment.js`

```javascript
import React from 'react';
import { Modal } from 'react-native';
import { Paystack } from 'react-native-paystack-webview';
import { PAYSTACK_PUBLIC_KEY } from '../config/api';

const PaystackPayment = ({ 
  isVisible, 
  amount, 
  email, 
  onCancel, 
  onSuccess,
  reference,
  publicKey = PAYSTACK_PUBLIC_KEY
}) => {
  return (
    <Modal visible={isVisible} animationType="slide">
      <Paystack
        paystackKey={publicKey}
        amount={amount}
        billingEmail={email}
        activityIndicatorColor="green"
        onCancel={onCancel}
        onSuccess={onSuccess}
        autoStart={true}
        reference={reference}
        channels={["card", "bank", "ussd", "qr", "mobile_money"]}
        currency="GHS"
      />
    </Modal>
  );
};

export default PaystackPayment;
```

### 2. Price Parsing Utility

```javascript
// Helper function to parse price
const parsePrice = (priceString) => {
  // Remove currency symbol and parse
  return parseFloat(priceString.replace(/[^\d.]/g, ''));
};

// Example: parsePrice('GH₵7.99') returns 7.99
```

### 3. Reference Extraction Utility

```javascript
// Helper function to extract reference from Paystack response
const extractPaymentReference = (response) => {
  return response?.data?.transactionRef?.reference || 
         response?.transactionRef?.reference || 
         response?.reference;
};
```

---

## API Endpoints

### Frontend API Calls

| Endpoint | Method | Purpose | Request Body |
|----------|--------|---------|--------------|
| `/api/v1/store-promotions/initialize-payment` | POST | Initialize payment | `{ packageId, packageName, packagePrice, packageFeatures, packageType, duration, email }` |
| `/api/v1/store-promotions/verify-payment` | POST | Verify payment | `{ reference, packageData }` |
| `/api/v1/store-promotions/initialize-upgrade` | POST | Initialize plan upgrade | `{ newPlanId, email }` |
| `/api/v1/store-promotions/verify-upgrade` | POST | Verify upgrade payment | `{ reference, upgradeData }` |

### Backend Paystack API Calls

| Paystack Endpoint | Method | Purpose |
|-------------------|--------|---------|
| `https://api.paystack.co/transaction/initialize` | POST | Initialize transaction |
| `https://api.paystack.co/transaction/verify/{reference}` | GET | Verify transaction |

---

## Error Handling

### Frontend Error Handling

1. **Network Errors**:
```javascript
try {
  const response = await fetch(url, options);
  // Handle response
} catch (error) {
  Alert.alert('Error', 'Network error. Please check your connection.');
}
```

2. **Payment Initialization Errors**:
```javascript
if (!response.ok || !data.success) {
  Alert.alert('Payment Initialization Failed', data.error || 'Failed to initialize payment.');
}
```

3. **Payment Verification Errors**:
```javascript
if (!verifyResponse.ok || !verifyData.success) {
  Alert.alert('Payment Verification Failed', verifyData.error || 'Payment verification failed.');
}
```

4. **Paystack Component Errors**:
```javascript
<Paystack
  onError={(error) => {
    console.error('Paystack error:', error);
    Alert.alert('Payment Error', 'There was an error processing your payment.');
  }}
/>
```

### Backend Error Handling

1. **Validation Errors**:
```javascript
if (!packageId || !packagePrice || !email) {
  return res.status(400).json({
    success: false,
    error: 'All required fields must be provided'
  });
}
```

2. **Paystack API Errors**:
```javascript
paystackReq.on('error', (error) => {
  res.status(500).json({
    success: false,
    error: 'Payment initialization failed',
    details: error.message
  });
});
```

3. **Payment Verification Errors**:
```javascript
if (response.status && response.data.status === 'success') {
  // Success handling
} else {
  res.status(400).json({
    success: false,
    error: 'Payment verification failed'
  });
}
```

---

## Testing Considerations

### 1. Test Mode

Use Paystack test keys for development:
- Test Public Key: `pk_test_...`
- Test Secret Key: `sk_test_...`

### 2. Test Cards

Paystack provides test cards for testing:
- **Successful Payment**: `4084084084084081`
- **Insufficient Funds**: `5060666666666666666`
- **Incorrect PIN**: `5060666666666666666` (enter wrong PIN 3 times)

### 3. Testing Checklist

- [ ] Payment initialization succeeds
- [ ] Paystack modal appears correctly
- [ ] Payment can be cancelled
- [ ] Accessuccess callback works
- [ ] Payment reference is extracted correctly
- [ ] Payment verification succeeds
- [ ] Subscription/promotion is created after payment
- [ ] Error handling works for network failures
- [ ] Error handling works for failed payments
- [ ] User sees appropriate success/error messages

### 4. Common Issues & Solutions

**Issue**: Paystack modal doesn't appear
- **Solution**: Check that `showPayment` state is `true` and `paymentData` is set

**Issue**: "Invalid public key" error
- **Solution**: Verify `PAYSTACK_PUBLIC_KEY` is correctly set in `app.json` and accessed via `Constants.expoConfig`

**Issue**: Accessucceeds but verification fails
- **Solution**: Check that reference is correctly extracted and passed to verification endpoint

**Issue**: Amount mismatch
- **Solution**: Ensure price is converted to pesewas (multiply by 100) in backend, but passed as regular amount in frontend Paystack component

---

## Important Notes

### Amount Handling

- **Backend**: Convert to pesewas (smallest currency unit) when calling Paystack API
  - Example: GH₵7.99 → 799 pesewas
- **Frontend**: Pass amount in regular currency units to Paystack component
  - Example: `amount={7.99}` (not `799`)

### Reference Generation

- Generate unique references on backend
- Format: `sub_${timestamp}_${randomString}`
- Store reference with payment data for verification

### Security Considerations

1. **Never expose secret keys** in frontend code
2. **Always verify payments** on backend before granting access
3. **Validate webhook signatures** if using webhooks
4. **Use HTTPS** for all API calls
5. **Sanitize user input** before sending to Paystack

### Currency Support

The implementation uses GHS (Ghana Cedis). To use other currencies:
1. Change `currency: "GHS"` to your currency code
2. Update amount conversion logic if needed
3. Update currency symbol in UI

---

## Summary

This implementation provides a complete Paystack payment integration for React Native/Expo applications. Key points:

1. **Frontend**: Uses `react-native-paystack-webview` component in a modal
2. **Backend**: Initializes and verifies payments via Paystack API
3. **Flow**: Two-phase process (initialize → verify)
4. **Security**: Secret keys on backend, public keys on frontend
5. **Error Handling**: Comprehensive error handling at each step

The integration supports subscription plans and promotional packages, with automatic subscription upgrades and promotion request creation upon successful payment verification.
