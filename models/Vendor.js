const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  businessName: { type: String, required: true },
  businessLicense: { type: String, required: true },
  address: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true }
  },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  
  // Products they sell (non-medicines)
  products: [{
    name: { type: String, required: true },
    category: { type: String, required: true },
    description: String,
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 0 },
    images: [String],
    isActive: { type: Boolean, default: true }
  }],
  
  rating: { type: Number, default: 0, min: 0, max: 5 },
  totalRatings: { type: Number, default: 0 },
  isVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Vendor', vendorSchema);