# Remaining Routes Migration Guide

## Overview
The following routes still use MongoDB models and need to be migrated to Firestore:

1. **payments.js** - Uses `Payment` and `User` models
2. **quizzes.js** - Uses `Quiz`, `Course`, `Enrollment`, `Notification`, `User` models
3. **assignments.js** - Uses `Assignment`, `Course`, `Enrollment`, `Notification`, `User` models
4. **tutorials.js** - Uses `Tutorial`, `Course`, `Enrollment`, `Notification`, `User` models
5. **feedback.js** - Uses `Feedback` model

## Migration Steps

### 1. Create Firestore Services

For each model, create a Firestore service file:

#### `backend/src/services/firestore/payments.js`
```javascript
const { firestore } = require('../../config/firebase');
const admin = require('firebase-admin');

const PAYMENTS_COLLECTION = 'payments';

const createPayment = async (paymentData) => {
  // Implementation
};

const getPaymentById = async (paymentId) => {
  // Implementation
};

const getPaymentsByUser = async (userId) => {
  // Implementation
};

// ... other methods
```

#### Similar services needed for:
- `quizzes.js`
- `assignments.js`
- `tutorials.js`
- `feedback.js`

### 2. Update Route Files

Replace MongoDB model imports with Firestore service imports:

**Before:**
```javascript
const { Payment, User } = require('../models');
```

**After:**
```javascript
const { createPayment, getPaymentById, getPaymentsByUser } = require('../services/firestore/payments');
const { getUserById } = require('../services/firestore/users');
```

### 3. Update Route Handlers

Replace Mongoose queries with Firestore service calls:

**Before:**
```javascript
const payment = await Payment.create({ ... });
```

**After:**
```javascript
const payment = await createPayment({ ... });
```

## Priority

These routes are **secondary features** and can be migrated after core functionality is tested:

1. ✅ **Core Features (COMPLETED)**:
   - Authentication
   - Courses
   - Enrollments
   - Notifications

2. ⚠️ **Secondary Features (PENDING)**:
   - Payments
   - Quizzes
   - Assignments
   - Tutorials
   - Feedback

## Notes

- All these routes depend on core services (users, courses, enrollments) which are already migrated
- The migration pattern is the same as what was done for courses/enrollments/notifications
- Consider creating Firestore services for these models following the same pattern

## Quick Migration Template

For each route file:

1. **Replace imports:**
```javascript
// OLD
const { ModelName } = require('../models');

// NEW
const { 
  createModelName,
  getModelNameById,
  // ... other methods
} = require('../services/firestore/modelName');
```

2. **Replace queries:**
```javascript
// OLD
const item = await ModelName.findById(id);
const items = await ModelName.find({ userId });
await ModelName.create(data);
await ModelName.findByIdAndUpdate(id, updates);
await ModelName.findByIdAndDelete(id);

// NEW
const item = await getModelNameById(id);
const items = await getModelNamesByUser(userId);
await createModelName(data);
await updateModelName(id, updates);
await deleteModelName(id);
```

3. **Update references:**
- Replace `item._id` with `item.id`
- Replace `item.toJSON()` with `toJSON(item)` if using transform functions
- Update populate() calls to manual joins using Firestore services
