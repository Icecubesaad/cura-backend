const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
    street: { type: String, required: true },
    area: String,
    city: { type: String, required: true },
    governorate: { type: String, required: true },
    phone: String,
    notes: String,
    isDefault: { type: Boolean, default: false }
}, { _id: false });

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    nameAr: String,
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    password: { type: String, required: true },
    role: { 
        type: String, 
        enum: ['customer', 'pharmacy', 'vendor', 'admin', 'prescription-reader'],
        required: true 
    },
    
    // Customer specific fields
    dateOfBirth: Date,
    gender: { type: String, enum: ['male', 'female'] },
    addresses: [addressSchema],
    preferredLanguage: { type: String, enum: ['en', 'ar'], default: 'en' },
    
    // Pharmacy/Vendor specific fields
    businessName: String,
    businessNameAr: String,
    businessType: {
        type: String,
        enum: ['manufacturer', 'distributor', 'wholesaler', 'importer', 'retailer', 'pharmacy']
    },
    licenseNumber: String,
    taxNumber: String,
    cityId: String,
    governorateId: String,
    coordinates: {
        lat: Number,
        lng: Number
    },
    businessAddress: addressSchema,
    workingHours: {
        open: String,
        close: String,
        is24Hours: { type: Boolean, default: false }
    },
    specialties: [String],
    features: [String],
    commission: { type: Number, default: 0 },
    
    // Common fields
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    profileImage: String,
    lastLoginAt: Date,
    emailVerifiedAt: Date,
    phoneVerifiedAt: Date
}, {
    timestamps: true
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ role: 1 });
userSchema.index({ cityId: 1 });
userSchema.index({ businessType: 1 });
userSchema.index({ isActive: 1 });

module.exports = mongoose.model('User', userSchema);