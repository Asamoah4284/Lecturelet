const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  userId: {
    type: String, // Firebase UID from auth (not MongoDB ObjectId)
    required: false,
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  amount: {
    type: Number, // base currency units (e.g., NGN)
    required: true,
  },
  currency: {
    type: String,
    default: 'GHS',
  },
  reference: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  accessCode: {
    type: String,
  },
  authorizationUrl: {
    type: String,
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: 'pending',
  },
  gatewayResponse: {
    type: String,
  },
  paidAt: {
    type: Date,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Payment', paymentSchema);







