const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['customer', 'pharmacy', 'vendor', 'doctor', 'admin', 'prescription_reader'], 
    required: true 
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  isActive: { type: Boolean, default: true },
  referralCode: { type: String, unique: true, sparse: true }, // For doctors
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // For customers referred by doctors
  profileImage: String,
  
  // Credit system - only for customers
  credits: { 
    type: Number, 
    default: 0,
    min: 0
  },
  
  // Credit transaction history
  creditHistory: [{
    type: { 
      type: String, 
      enum: ['earned', 'used', 'refund', 'bonus'],
      required: true 
    },
    amount: { type: Number, required: true },
    description: String,
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function(password) {
  return bcrypt.compare(password, this.password);
};

// Method to add credits
userSchema.methods.addCredits = function(amount, type, description, orderId = null) {
  this.credits += amount;
  this.creditHistory.push({
    type,
    amount,
    description,
    orderId
  });
};

// Method to use credits
userSchema.methods.useCredits = function(amount, description, orderId = null) {
  if (this.credits < amount) {
    throw new Error('Insufficient credits');
  }
  this.credits -= amount;
  this.creditHistory.push({
    type: 'used',
    amount: -amount,
    description,
    orderId
  });
};

module.exports = mongoose.model('User', userSchema);