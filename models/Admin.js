const mongoose = require('mongoose');

const notificationSettingsSchema = new mongoose.Schema({
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: true },
    push: { type: Boolean, default: true },
    inApp: { type: Boolean, default: true }
}, { _id: false });

const deliverySettingsSchema = new mongoose.Schema({
    standardFee: { type: Number, default: 15 },
    expressFeeSurcharge: { type: Number, default: 10 },
    freeDeliveryThreshold: { type: Number, default: 200 },
    maxDeliveryDistance: { type: Number, default: 25 }, // in km
    estimatedDeliveryTime: { type: Number, default: 45 }, // in minutes
    expressDeliveryTime: { type: Number, default: 20 } // in minutes
}, { _id: false });

const paymentSettingsSchema = new mongoose.Schema({
    enabledMethods: {
        cash: { type: Boolean, default: true },
        card: { type: Boolean, default: true },
        wallet: { type: Boolean, default: true },
        bankTransfer: { type: Boolean, default: false }
    },
    processingFees: {
        card: { type: Number, default: 0.025 }, // 2.5%
        wallet: { type: Number, default: 0.01 }, // 1%
        bankTransfer: { type: Number, default: 5 } // flat fee
    },
    minimumOrderAmount: { type: Number, default: 20 },
    maximumOrderAmount: { type: Number, default: 5000 },
    currency: { type: String, default: 'EGP' },
    taxRate: { type: Number, default: 0.14 } // 14% VAT
}, { _id: false });

const businessHoursSchema = new mongoose.Schema({
    day: { type: String, required: true },
    isOpen: { type: Boolean, default: true },
    openTime: String,
    closeTime: String,
    breaks: [{
        startTime: String,
        endTime: String,
        reason: String
    }]
}, { _id: false });

const maintenanceSchema = new mongoose.Schema({
    isActive: { type: Boolean, default: false },
    startTime: Date,
    endTime: Date,
    message: String,
    messageAr: String,
    affectedServices: [String], // ['orders', 'prescriptions', 'payments']
    scheduledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
}, { _id: true });

const featureToggleSchema = new mongoose.Schema({
    name: { type: String, required: true },
    isEnabled: { type: Boolean, default: false },
    description: String,
    rolloutPercentage: { type: Number, default: 0, min: 0, max: 100 },
    enabledFor: [String], // user IDs or roles
    conditions: mongoose.Schema.Types.Mixed,
    lastUpdated: { type: Date, default: Date.now },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { _id: false });

const adminSettingsSchema = new mongoose.Schema({
    // System Information
    systemName: { type: String, default: 'Pharmacy Management System' },
    systemVersion: { type: String, default: '1.0.0' },
    environment: { type: String, enum: ['development', 'staging', 'production'], default: 'development' },
    
    // Location and Service Configuration
    allowCrossCityOrders: { type: Boolean, default: false },
    enabledGovernorateIds: [{ type: String }],
    enabledCityIds: [{ type: String }],
    defaultCity: { type: String, default: 'ismailia-city' },
    canAddNewCities: { type: Boolean, default: true },
    
    // Default system settings
    notificationSettings: { type: notificationSettingsSchema, default: {} },
    deliverySettings: { type: deliverySettingsSchema, default: {} },
    paymentSettings: { type: paymentSettingsSchema, default: {} },
    
    // Maintenance and Features
    maintenance: { type: maintenanceSchema, default: {} },
    featureToggles: [featureToggleSchema],
    
    // Auditing
    lastUpdated: { type: Date, default: Date.now },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

module.exports = mongoose.model('AdminSettings', adminSettingsSchema);