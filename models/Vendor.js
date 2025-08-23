const mongoose = require('mongoose');

const bulkPricingSchema = new mongoose.Schema({
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    discountPercentage: Number
}, { _id: false });

const vendorProductSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    sku: String,
    price: { type: Number, required: true },
    originalPrice: Number,
    inStock: { type: Boolean, default: true },
    stockQuantity: { type: Number, default: 0 },
    minimumOrderQuantity: { type: Number, default: 1 },
    maximumOrderQuantity: Number,
    bulkPricing: [bulkPricingSchema],
    deliveryTime: String, // e.g., "1-2 days"
    deliveryFee: { type: Number, default: 0 },
    specialOffers: [String],
    lastUpdated: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true }
}, { _id: true });

const vendorSchema = new mongoose.Schema({
    // Basic Information
    vendorCode: { type: String, unique: true },
    vendorName: { type: String, required: true },
    vendorNameAr: String,
    
    // Business Information
    vendorType: { 
        type: String, 
        enum: ['manufacturer', 'distributor', 'wholesaler', 'importer', 'retailer'],
        required: true 
    },
    businessLicense: String,
    taxNumber: String,
    registrationNumber: String,
    
    // Contact Information
    contactPerson: String,
    email: { type: String, required: true },
    phone: { type: String, required: true },
    alternatePhone: String,
    website: String,
    
    // Address Information
    address: {
        street: { type: String, required: true },
        area: String,
        cityId: { type: String, required: true },
        cityName: { type: String, required: true },
        governorateId: { type: String, required: true },
        governorateName: String,
        postalCode: String,
        country: { type: String, default: 'Egypt' }
    },
    coordinates: {
        lat: Number,
        lng: Number
    },
    
    // Business Details
    establishedYear: Number,
    specializations: [String], // e.g., ['antibiotics', 'vitamins', 'medical_devices']
    certifications: [String], // e.g., ['ISO 9001', 'GMP', 'FDA']
    serviceAreas: [String], // Cities/Governorates they serve
    
    // Products and Pricing
    products: [vendorProductSchema],
    totalProducts: { type: Number, default: 0 },
    
    // Business Terms
    paymentTerms: String, // e.g., "Net 30", "Cash on Delivery"
    minimumOrderValue: { type: Number, default: 0 },
    creditLimit: Number,
    discountPolicy: String,
    returnPolicy: String,
    warrantyTerms: String,
    
    // Performance Metrics
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    completedOrders: { type: Number, default: 0 },
    averageDeliveryTime: Number, // in days
    onTimeDeliveryRate: { type: Number, default: 0 }, // percentage
    qualityScore: { type: Number, default: 0 },
    
    // Financial Information
    commission: { type: Number, default: 0 }, // percentage
    monthlyRevenue: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    outstandingBalance: { type: Number, default: 0 },
    
    // Status and Verification
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    verifiedAt: Date,
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    
    // Operational Information
    workingHours: {
        monday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
        tuesday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
        wednesday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
        thursday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
        friday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
        saturday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
        sunday: { open: String, close: String, isClosed: { type: Boolean, default: true } }
    },
    holidaySchedule: [{ 
        date: Date, 
        name: String, 
        isClosed: { type: Boolean, default: true } 
    }],
    
    // Delivery and Logistics
    hasOwnDelivery: { type: Boolean, default: false },
    deliveryPartners: [String],
    deliveryZones: [String], // Areas they deliver to
    expressDeliveryAvailable: { type: Boolean, default: false },
    
    // Integration and API
    apiIntegrationEnabled: { type: Boolean, default: false },
    apiKey: String,
    webhookUrl: String,
    
    // Compliance and Documentation
    documents: [{
        type: { type: String, enum: ['license', 'certificate', 'insurance', 'contract', 'other'] },
        name: String,
        url: String,
        expiryDate: Date,
        uploadedAt: { type: Date, default: Date.now }
    }],
    
    // Notes and Comments
    notes: String,
    internalNotes: String, // Admin only
    
    // Relationship Management
    accountManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    contractStartDate: Date,
    contractEndDate: Date,
    nextReviewDate: Date,
    
    // Performance Tracking
    lastOrderDate: Date,
    lastPaymentDate: Date,
    lastContactDate: Date,
    
    // Alerts and Notifications
    lowStockThreshold: { type: Number, default: 10 },
    notificationPreferences: {
        orderUpdates: { type: Boolean, default: true },
        stockAlerts: { type: Boolean, default: true },
        paymentReminders: { type: Boolean, default: true },
        promotional: { type: Boolean, default: false }
    }
}, {
    timestamps: true
});

// Indexes
vendorSchema.index({ vendorCode: 1 }, { unique: true });
vendorSchema.index({ vendorName: 1 });
vendorSchema.index({ vendorType: 1 });
vendorSchema.index({ 'address.cityId': 1 });
vendorSchema.index({ 'address.governorateId': 1 });
vendorSchema.index({ isActive: 1 });
vendorSchema.index({ isVerified: 1 });
vendorSchema.index({ rating: -1 });
vendorSchema.index({ 'products.productId': 1 });
vendorSchema.index({ 'products.inStock': 1 });
vendorSchema.index({ specializations: 1 });

// Compound indexes
vendorSchema.index({ vendorType: 1, 'address.cityId': 1 });
vendorSchema.index({ isActive: 1, isVerified: 1 });
vendorSchema.index({ 'products.productId': 1, 'products.inStock': 1 });

// Pre-save middleware to generate vendor code
vendorSchema.pre('save', async function(next) {
    if (this.isNew && !this.vendorCode) {
        const count = await mongoose.model('Vendor').countDocuments();
        const typePrefix = {
            manufacturer: 'MFG',
            distributor: 'DIST',
            wholesaler: 'WHS',
            importer: 'IMP',
            retailer: 'RTL'
        };
        this.vendorCode = `${typePrefix[this.vendorType] || 'VND'}${String(count + 1).padStart(6, '0')}`;
    }
    
    // Update total products count
    this.totalProducts = this.products.length;
    
    next();
});

// Methods
vendorSchema.methods.getProductById = function(productId) {
    return this.products.id(productId);
};

vendorSchema.methods.updateProductStock = function(productId, newQuantity) {
    const product = this.getProductById(productId);
    if (product) {
        product.stockQuantity = newQuantity;
        product.inStock = newQuantity > 0;
        product.lastUpdated = new Date();
        return true;
    }
    return false;
};

vendorSchema.methods.addProduct = function(productData) {
    this.products.push({
        ...productData,
        lastUpdated: new Date()
    });
    this.totalProducts = this.products.length;
};

vendorSchema.methods.removeProduct = function(productId) {
    this.products.pull({ _id: productId });
    this.totalProducts = this.products.length;
};

vendorSchema.methods.getActiveProducts = function() {
    return this.products.filter(product => product.isActive && product.inStock);
};

vendorSchema.methods.getBestPriceForProduct = function(productId) {
    const product = this.getProductById(productId);
    if (!product || !product.inStock) return null;
    
    // Return the lowest bulk price if available, otherwise regular price
    if (product.bulkPricing && product.bulkPricing.length > 0) {
        return Math.min(...product.bulkPricing.map(bp => bp.price));
    }
    return product.price;
};

vendorSchema.methods.updatePerformanceMetrics = function(orderData) {
    this.totalOrders += 1;
    if (orderData.status === 'completed') {
        this.completedOrders += 1;
    }
    if (orderData.revenue) {
        this.monthlyRevenue += orderData.revenue;
        this.totalRevenue += orderData.revenue;
    }
    if (orderData.deliveryTime) {
        // Update average delivery time
        this.averageDeliveryTime = this.averageDeliveryTime 
            ? (this.averageDeliveryTime + orderData.deliveryTime) / 2 
            : orderData.deliveryTime;
    }
    this.lastOrderDate = new Date();
};

vendorSchema.methods.calculateOnTimeDeliveryRate = function() {
    if (this.totalOrders === 0) return 0;
    // This would need to be calculated based on actual delivery data
    return (this.completedOrders / this.totalOrders) * 100;
};

module.exports = mongoose.model('Vendor', vendorSchema);