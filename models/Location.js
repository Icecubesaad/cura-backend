const mongoose = require('mongoose');

// Governorate Schema
const governorateSchema = new mongoose.Schema({
    code: { type: String, unique: true, required: true }, // e.g., 'ismailia', 'cairo'
    nameEn: { type: String, required: true },
    nameAr: { type: String, required: true },
    
    // Geographic Information
    coordinates: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
    },
    boundaries: {
        north: Number,
        south: Number,
        east: Number,
        west: Number
    },
    area: Number, // in square kilometers
    
    // Administrative Information
    capitalCity: String,
    region: { 
        type: String, 
        enum: ['Upper Egypt', 'Lower Egypt', 'Cairo Area', 'Canal Zone', 'Sinai', 'Red Sea', 'Western Desert']
    },
    
    // Service Configuration
    isEnabled: { type: Boolean, default: false },
    enabledAt: Date,
    disabledAt: Date,
    enabledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    
    // Statistics
    population: Number,
    cityCount: { type: Number, default: 0 },
    pharmacyCount: { type: Number, default: 0 },
    doctorCount: { type: Number, default: 0 },
    vendorCount: { type: Number, default: 0 },
    
    // Service Metrics
    averageDeliveryTime: Number, // in minutes
    serviceRating: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    
    // Configuration
    deliveryFeeMultiplier: { type: Number, default: 1.0 },
    taxRate: { type: Number, default: 0.14 }, // 14% VAT in Egypt
    currency: { type: String, default: 'EGP' },
    
    // Operational Status
    maintenanceMode: { type: Boolean, default: false },
    maintenanceMessage: String,
    emergencyContactNumber: String,
    
    // Notes
    description: String,
    notes: String,
    adminNotes: String
}, {
    timestamps: true
});

// City Schema
const citySchema = new mongoose.Schema({
    code: { type: String, unique: true, required: true }, // e.g., 'ismailia-city', 'cairo-city'
    nameEn: { type: String, required: true },
    nameAr: { type: String, required: true },
    
    // Geographic Information
    coordinates: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
    },
    boundaries: {
        north: Number,
        south: Number,
        east: Number,
        west: Number
    },
    area: Number, // in square kilometers
    
    // Administrative Hierarchy
    governorateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Governorate', required: true },
    governorateCode: { type: String, required: true },
    governorateName: String,
    governorateNameAr: String,
    
    // City Classification
    type: { 
        type: String, 
        enum: ['capital', 'major_city', 'city', 'town', 'village'],
        default: 'city'
    },
    isCapital: { type: Boolean, default: false }, // Capital of governorate
    
    // Service Configuration
    isEnabled: { type: Boolean, default: false },
    enabledAt: Date,
    disabledAt: Date,
    enabledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    canAddDynamically: { type: Boolean, default: true },
    
    // Population and Demographics
    population: Number,
    populationDensity: Number, // per square kilometer
    
    // Service Statistics
    pharmacyCount: { type: Number, default: 0 },
    doctorCount: { type: Number, default: 0 },
    vendorCount: { type: Number, default: 0 },
    hospitalCount: { type: Number, default: 0 },
    
    // Service Zones (Areas within the city)
    serviceZones: [{
        name: { type: String, required: true },
        nameAr: String,
        boundaries: {
            north: Number,
            south: Number,
            east: Number,
            west: Number
        },
        deliveryFee: { type: Number, default: 0 },
        averageDeliveryTime: Number, // in minutes
        isActive: { type: Boolean, default: true }
    }],
    
    // Delivery Configuration
    baseDeliveryFee: { type: Number, default: 15 },
    freeDeliveryThreshold: { type: Number, default: 200 },
    expressDeliveryFee: { type: Number, default: 25 },
    averageDeliveryTime: { type: Number, default: 45 }, // in minutes
    maxDeliveryDistance: { type: Number, default: 25 }, // in kilometers
    
    // Service Quality Metrics
    serviceRating: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    completedOrders: { type: Number, default: 0 },
    averageOrderValue: { type: Number, default: 0 },
    customerSatisfaction: { type: Number, default: 0 },
    onTimeDeliveryRate: { type: Number, default: 0 },
    
    // Business Hours (City-wide defaults)
    businessHours: {
        pharmacies: {
            open: { type: String, default: '08:00' },
            close: { type: String, default: '22:00' },
            fridayOpen: { type: String, default: '14:00' }, // After Friday prayers
            fridayClose: { type: String, default: '22:00' }
        },
        delivery: {
            open: { type: String, default: '09:00' },
            close: { type: String, default: '21:00' }
        }
    },
    
    // Emergency Services
    emergencyPharmacies: [{
        pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        pharmacyName: String,
        phone: String,
        address: String,
        is24Hours: { type: Boolean, default: false }
    }],
    emergencyContactNumber: String,
    
    // Operational Status
    maintenanceMode: { type: Boolean, default: false },
    maintenanceMessage: String,
    weatherAlerts: [{
        type: { type: String, enum: ['storm', 'flood', 'heat_wave', 'dust_storm'] },
        message: String,
        severity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
        isActive: { type: Boolean, default: true },
        expiresAt: Date,
        createdAt: { type: Date, default: Date.now }
    }],
    
    // Transportation and Logistics
    majorRoads: [String],
    nearbyAirports: [String],
    nearbyHospitals: [{
        name: String,
        nameAr: String,
        address: String,
        phone: String,
        specialties: [String],
        emergencyServices: { type: Boolean, default: true }
    }],
    
    // Economic Information
    averageIncome: Number,
    unemploymentRate: Number,
    costOfLivingIndex: Number,
    
    // Cultural and Language
    primaryLanguage: { type: String, default: 'ar' },
    secondaryLanguages: [String],
    culturalNotes: String,
    
    // Integration and API
    postalCodePattern: String, // Regex pattern for postal codes
    phoneNumberPrefix: String, // Local phone prefix
    
    // Notes and Administration
    description: String,
    establishedDate: Date,
    notes: String,
    adminNotes: String,
    lastDataUpdate: Date
}, {
    timestamps: true
});

// Indexes for Governorate
governorateSchema.index({ code: 1 }, { unique: true });
governorateSchema.index({ nameEn: 1 });
governorateSchema.index({ nameAr: 1 });
governorateSchema.index({ isEnabled: 1 });
governorateSchema.index({ region: 1 });

// Indexes for City
citySchema.index({ code: 1 }, { unique: true });
citySchema.index({ nameEn: 1 });
citySchema.index({ nameAr: 1 });
citySchema.index({ governorateId: 1 });
citySchema.index({ governorateCode: 1 });
citySchema.index({ isEnabled: 1 });
citySchema.index({ type: 1 });
citySchema.index({ isCapital: 1 });

// Compound indexes for City
citySchema.index({ governorateId: 1, isEnabled: 1 });
citySchema.index({ isEnabled: 1, type: 1 });

// Methods for Governorate
governorateSchema.methods.enable = function(userId) {
    this.isEnabled = true;
    this.enabledAt = new Date();
    this.enabledBy = userId;
    this.disabledAt = undefined;
};

governorateSchema.methods.disable = function() {
    this.isEnabled = false;
    this.disabledAt = new Date();
};

governorateSchema.methods.updateStatistics = async function() {
    const City = mongoose.model('City');
    const User = mongoose.model('User');
    const Order = mongoose.model('Order');
    
    // Update city count
    this.cityCount = await City.countDocuments({ governorateId: this._id, isEnabled: true });
    
    // Update pharmacy count
    this.pharmacyCount = await User.countDocuments({ 
        role: 'pharmacy', 
        governorateId: this.code,
        isActive: true 
    });
    
    // Update vendor count
    this.vendorCount = await mongoose.model('Vendor').countDocuments({ 
        'address.governorateId': this.code,
        isActive: true 
    });
    
    // Update order statistics
    const orderStats = await Order.aggregate([
        { $match: { governorateId: this.code } },
        { $group: { 
            _id: null, 
            totalOrders: { $sum: 1 },
            avgDeliveryTime: { $avg: '$actualDeliveryTime' }
        }}
    ]);
    
    if (orderStats.length > 0) {
        this.totalOrders = orderStats[0].totalOrders;
        this.averageDeliveryTime = orderStats[0].avgDeliveryTime;
    }
};

// Methods for City
citySchema.methods.enable = function(userId) {
    this.isEnabled = true;
    this.enabledAt = new Date();
    this.enabledBy = userId;
    this.disabledAt = undefined;
};

citySchema.methods.disable = function() {
    this.isEnabled = false;
    this.disabledAt = new Date();
};

citySchema.methods.addServiceZone = function(zoneData) {
    this.serviceZones.push({
        ...zoneData,
        isActive: true
    });
};

citySchema.methods.updateServiceZone = function(zoneName, updateData) {
    const zone = this.serviceZones.find(z => z.name === zoneName);
    if (zone) {
        Object.assign(zone, updateData);
        return true;
    }
    return false;
};

citySchema.methods.calculateDeliveryFee = function(address, orderValue = 0) {
    // Check if free delivery threshold is met
    if (orderValue >= this.freeDeliveryThreshold) {
        return 0;
    }
    
    // Check service zones for specific delivery fees
    const zone = this.serviceZones.find(z => 
        z.isActive && 
        // This would need proper geometric calculation in real implementation
        z.name.toLowerCase().includes(address.toLowerCase())
    );
    
    return zone ? zone.deliveryFee : this.baseDeliveryFee;
};

citySchema.methods.updateStatistics = async function() {
    const User = mongoose.model('User');
    const Order = mongoose.model('Order');
    
    // Update service provider counts
    this.pharmacyCount = await User.countDocuments({ 
        role: 'pharmacy', 
        cityId: this.code,
        isActive: true 
    });
    
    this.vendorCount = await mongoose.model('Vendor').countDocuments({ 
        'address.cityId': this.code,
        isActive: true 
    });
    
    // Update order statistics
    const orderStats = await Order.aggregate([
        { $match: { cityId: this.code } },
        { $group: { 
            _id: null,
            totalOrders: { $sum: 1 },
            completedOrders: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }},
            avgOrderValue: { $avg: '$totalAmount' },
            avgDeliveryTime: { $avg: '$actualDeliveryTime' }
        }}
    ]);
    
    if (orderStats.length > 0) {
        const stats = orderStats[0];
        this.totalOrders = stats.totalOrders;
        this.completedOrders = stats.completedOrders;
        this.averageOrderValue = stats.avgOrderValue;
        this.averageDeliveryTime = stats.avgDeliveryTime;
        this.onTimeDeliveryRate = this.totalOrders > 0 ? 
            (this.completedOrders / this.totalOrders) * 100 : 0;
    }
};

citySchema.methods.addWeatherAlert = function(alertData) {
    this.weatherAlerts.push({
        ...alertData,
        createdAt: new Date(),
        isActive: true
    });
};

citySchema.methods.clearExpiredAlerts = function() {
    const now = new Date();
    this.weatherAlerts = this.weatherAlerts.filter(alert => 
        alert.isActive && (!alert.expiresAt || alert.expiresAt > now)
    );
};

// Export models
const Governorate = mongoose.model('Governorate', governorateSchema);
const City = mongoose.model('City', citySchema);

module.exports = { Governorate, City };