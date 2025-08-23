// Updated Product.js model (or rename to Medicine.js)
const mongoose = require('mongoose');

const packagingOptionSchema = new mongoose.Schema({
    type: { type: String, enum: ['blister', 'box', 'bottle', 'tube', 'vial', 'ampoule'], required: true },
    name: { type: String, required: true },
    nameAr: String,
    unitsPerPackage: { type: Number, required: true },
    description: String,
    descriptionAr: String,
    price: { type: Number, required: true }
}, { _id: false });

const alternativeSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: { type: String, required: true },
    nameAr: String,
    genericName: String,
    activeIngredient: String,
    activeIngredientAr: String,
    strength: String,
    form: String,
    manufacturer: String,
    manufacturerAr: String,
    description: String,
    descriptionAr: String,
    advantages: [String],
    considerations: [String],
    equivalentDose: String,
    priceRange: {
        min: Number,
        max: Number
    },
    averagePrice: Number,
    pharmacyCount: Number,
    availability: { type: String, enum: ['in-stock', 'low-stock', 'out-of-stock'] },
    image: String
}, { _id: false });

const pharmacyStockSchema = new mongoose.Schema({
    pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    pharmacyName: String,
    pharmacyNameAr: String,
    inStock: { type: Boolean, default: false },
    stockLevel: { 
        type: String, 
        enum: ['high', 'medium', 'low', 'critical', 'out'],
        default: 'out'
    },
    stockQuantity: { type: Number, default: 0 },
    price: { type: Number, required: true },
    originalPrice: Number,
    discount: Number,
    lastUpdated: { type: Date, default: Date.now },
    reorderLevel: Number,
    maxStock: Number,
    supplier: String,
    batchNumber: String,
    expiryDate: Date,
    bulkPricing: [{
        quantity: Number,
        price: Number
    }],
    // Pharmacy-specific delivery info
    deliveryAvailable: { type: Boolean, default: true },
    deliveryTime: { type: String, default: '30-60 minutes' },
    deliveryFee: { type: Number, default: 0 }
}, { _id: false });

// NEW: Vendor Stock Schema
const vendorStockSchema = new mongoose.Schema({
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    vendorName: String,
    vendorNameAr: String,
    inStock: { type: Boolean, default: false },
    stockQuantity: { type: Number, default: 0 },
    price: { type: Number, required: true },
    originalPrice: Number,
    discount: Number,
    minimumOrderQuantity: { type: Number, default: 1 },
    maximumOrderQuantity: Number,
    deliveryTime: { type: String, default: '1-2 days' },
    deliveryFee: { type: Number, default: 0 },
    bulkPricing: [{
        quantity: Number,
        price: Number,
        discountPercentage: Number
    }],
    specialOffers: [String],
    lastUpdated: { type: Date, default: Date.now },
    supplier: String,
    batchNumber: String,
    expiryDate: Date,
    isActive: { type: Boolean, default: true }
}, { _id: false });

const productSchema = new mongoose.Schema({
    // Basic Information
    name: { type: String, required: true },
    nameAr: String,
    genericName: String,
    
    // Medical Information
    activeIngredient: { type: String, required: true },
    activeIngredientAr: String,
    strength: String,
    form: String, // tablet, capsule, syrup, injection, cream
    dosage: String,
    dosageAr: String,
    route: String, // oral, topical, injection
    
    // Classification
    category: { type: String, required: true },
    subcategory: String,
    therapeuticClass: String,
    
    // Prescription Information
    requiresPrescription: { type: Boolean, default: false },
    prescriptionClass: { type: String, enum: ['A', 'B', 'C'] },
    controlledSubstance: { type: Boolean, default: false },
    
    // Product Details
    manufacturer: { type: String, required: true },
    manufacturerAr: String,
    packSize: String,
    packSizeAr: String,
    unit: String, // tablets, capsules, ml, grams
    barcode: String,
    registrationNumber: String,
    
    // Medical Information
    indication: [String],
    frequency: String,
    duration: String,
    instructions: String,
    timing: [String],
    foodInstructions: String,
    specialInstructions: [String],
    warnings: [String],
    sideEffects: [String],
    contraindications: [String],
    drugInteractions: [String],
    storageInstructions: String,
    
    // Content and Media
    description: String,
    descriptionAr: String,
    image: String,
    images: [String],
    
    // UPDATED: Both Pharmacy and Vendor Availability
    pharmacyStocks: [pharmacyStockSchema],
    vendorStocks: [vendorStockSchema], // NEW
    
    // Alternatives
    alternatives: [alternativeSchema],
    genericAlternatives: [alternativeSchema],
    brandAlternatives: [alternativeSchema],
    strengthAlternatives: [alternativeSchema],
    
    // Packaging
    packagingOptions: [packagingOptionSchema],
    
    // Search and Classification
    keywords: [String],
    tags: [String],
    searchTerms: [String],
    
    // UPDATED: Enhanced Pricing Summary (calculated fields)
    // Pharmacy pricing
    pharmacyAveragePrice: Number,
    pharmacyLowestPrice: Number,
    pharmacyHighestPrice: Number,
    totalPharmacies: { type: Number, default: 0 },
    pharmacyAvailabilityPercentage: Number,
    
    // Vendor pricing
    vendorAveragePrice: Number,
    vendorLowestPrice: Number,
    vendorHighestPrice: Number,
    totalVendors: { type: Number, default: 0 },
    vendorAvailabilityPercentage: Number,
    
    // Overall pricing (combines both pharmacy and vendor)
    overallAveragePrice: Number,
    overallLowestPrice: Number,
    overallHighestPrice: Number,
    overallAvailabilityPercentage: Number,
    overallAvailability: { 
        type: String, 
        enum: ['in-stock', 'low-stock', 'out-of-stock'],
        default: 'out-of-stock'
    },
    
    // Product Status
    isActive: { type: Boolean, default: true },
    isPopular: { type: Boolean, default: false },
    salesRank: Number,
    approvalDate: Date,
    expiryWarningDays: { type: Number, default: 90 },
    
    // NEW: Master Database Management
    masterDatabaseId: { type: String, unique: true }, // Global unique ID
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Database manager who added it
    isGloballyAvailable: { type: Boolean, default: true },
    approvalStatus: { 
        type: String, 
        enum: ['pending', 'approved', 'rejected'],
        default: 'approved' 
    },
    
    // Ratings and Reviews
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    
    // Location Association (for legacy compatibility)
    cityId: String,
    cityName: String,
    governorateId: String
}, {
    timestamps: true
});

// Updated Indexes
productSchema.index({ name: 1 });
productSchema.index({ nameAr: 1 });
productSchema.index({ category: 1 });
productSchema.index({ activeIngredient: 1 });
productSchema.index({ manufacturer: 1 });
productSchema.index({ barcode: 1 }, { unique: true, sparse: true });
productSchema.index({ requiresPrescription: 1 });
productSchema.index({ tags: 1 });
productSchema.index({ keywords: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ masterDatabaseId: 1 }, { unique: true, sparse: true });
productSchema.index({ addedBy: 1 });
productSchema.index({ approvalStatus: 1 });

// Pharmacy stock indexes
productSchema.index({ 'pharmacyStocks.pharmacyId': 1 });
productSchema.index({ 'pharmacyStocks.inStock': 1 });

// Vendor stock indexes (NEW)
productSchema.index({ 'vendorStocks.vendorId': 1 });
productSchema.index({ 'vendorStocks.inStock': 1 });

// Compound indexes
productSchema.index({ category: 1, requiresPrescription: 1 });
productSchema.index({ isActive: 1, approvalStatus: 1 });

// UPDATED: Enhanced pricing summary calculation
productSchema.methods.updatePricingSummary = function() {
    // Calculate pharmacy pricing
    const inStockPharmacies = this.pharmacyStocks.filter(stock => stock.inStock);
    if (inStockPharmacies.length === 0) {
        this.pharmacyAveragePrice = 0;
        this.pharmacyLowestPrice = 0;
        this.pharmacyHighestPrice = 0;
        this.pharmacyAvailabilityPercentage = 0;
    } else {
        const pharmacyPrices = inStockPharmacies.map(stock => stock.price);
        this.pharmacyAveragePrice = pharmacyPrices.reduce((sum, price) => sum + price, 0) / pharmacyPrices.length;
        this.pharmacyLowestPrice = Math.min(...pharmacyPrices);
        this.pharmacyHighestPrice = Math.max(...pharmacyPrices);
        this.pharmacyAvailabilityPercentage = (inStockPharmacies.length / this.pharmacyStocks.length) * 100;
    }
    this.totalPharmacies = this.pharmacyStocks.length;
    
    // Calculate vendor pricing
    const inStockVendors = this.vendorStocks.filter(stock => stock.inStock && stock.isActive);
    if (inStockVendors.length === 0) {
        this.vendorAveragePrice = 0;
        this.vendorLowestPrice = 0;
        this.vendorHighestPrice = 0;
        this.vendorAvailabilityPercentage = 0;
    } else {
        const vendorPrices = inStockVendors.map(stock => stock.price);
        this.vendorAveragePrice = vendorPrices.reduce((sum, price) => sum + price, 0) / vendorPrices.length;
        this.vendorLowestPrice = Math.min(...vendorPrices);
        this.vendorHighestPrice = Math.max(...vendorPrices);
        this.vendorAvailabilityPercentage = (inStockVendors.length / this.vendorStocks.length) * 100;
    }
    this.totalVendors = this.vendorStocks.length;
    
    // Calculate overall pricing (combines both)
    const allPrices = [
        ...inStockPharmacies.map(s => s.price),
        ...inStockVendors.map(s => s.price)
    ];
    
    if (allPrices.length === 0) {
        this.overallAveragePrice = 0;
        this.overallLowestPrice = 0;
        this.overallHighestPrice = 0;
        this.overallAvailabilityPercentage = 0;
        this.overallAvailability = 'out-of-stock';
    } else {
        this.overallAveragePrice = allPrices.reduce((sum, price) => sum + price, 0) / allPrices.length;
        this.overallLowestPrice = Math.min(...allPrices);
        this.overallHighestPrice = Math.max(...allPrices);
        
        const totalStocks = this.pharmacyStocks.length + this.vendorStocks.length;
        const inStockCount = inStockPharmacies.length + inStockVendors.length;
        this.overallAvailabilityPercentage = totalStocks > 0 ? (inStockCount / totalStocks) * 100 : 0;
        
        // Determine overall availability status
        if (this.overallAvailabilityPercentage === 0) {
            this.overallAvailability = 'out-of-stock';
        } else if (this.overallAvailabilityPercentage < 30) {
            this.overallAvailability = 'low-stock';
        } else {
            this.overallAvailability = 'in-stock';
        }
    }
};

// NEW: Methods for managing pharmacy and vendor stocks
productSchema.methods.addPharmacyStock = function(pharmacyData) {
    // Check if pharmacy already has stock for this product
    const existingIndex = this.pharmacyStocks.findIndex(
        stock => stock.pharmacyId.toString() === pharmacyData.pharmacyId.toString()
    );
    
    if (existingIndex >= 0) {
        // Update existing stock
        this.pharmacyStocks[existingIndex] = {
            ...this.pharmacyStocks[existingIndex].toObject(),
            ...pharmacyData,
            lastUpdated: new Date()
        };
    } else {
        // Add new stock
        this.pharmacyStocks.push({
            ...pharmacyData,
            lastUpdated: new Date()
        });
    }
    
    this.updatePricingSummary();
};

productSchema.methods.addVendorStock = function(vendorData) {
    // Check if vendor already has stock for this product
    const existingIndex = this.vendorStocks.findIndex(
        stock => stock.vendorId.toString() === vendorData.vendorId.toString()
    );
    
    if (existingIndex >= 0) {
        // Update existing stock
        this.vendorStocks[existingIndex] = {
            ...this.vendorStocks[existingIndex].toObject(),
            ...vendorData,
            lastUpdated: new Date()
        };
    } else {
        // Add new stock
        this.vendorStocks.push({
            ...vendorData,
            lastUpdated: new Date()
        });
    }
    
    this.updatePricingSummary();
};

productSchema.methods.removePharmacyStock = function(pharmacyId) {
    this.pharmacyStocks = this.pharmacyStocks.filter(
        stock => stock.pharmacyId.toString() !== pharmacyId.toString()
    );
    this.updatePricingSummary();
};

productSchema.methods.removeVendorStock = function(vendorId) {
    this.vendorStocks = this.vendorStocks.filter(
        stock => stock.vendorId.toString() !== vendorId.toString()
    );
    this.updatePricingSummary();
};

productSchema.methods.getAvailabilityForLocation = function(cityId, governorateId) {
    // Filter stocks based on location
    const localPharmacyStocks = this.pharmacyStocks.filter(stock => {
        // This would need to be populated with pharmacy location data
        return stock.inStock;
    });
    
    const localVendorStocks = this.vendorStocks.filter(stock => {
        // This would need to be populated with vendor location data  
        return stock.inStock && stock.isActive;
    });
    
    return {
        pharmacyStocks: localPharmacyStocks,
        vendorStocks: localVendorStocks,
        totalAvailable: localPharmacyStocks.length + localVendorStocks.length,
        lowestPrice: Math.min(
            ...localPharmacyStocks.map(s => s.price),
            ...localVendorStocks.map(s => s.price)
        )
    };
};

// Pre-save middleware to update pricing summary
productSchema.pre('save', function() {
    this.updatePricingSummary();
    
    // Generate master database ID if not exists
    if (this.isNew && !this.masterDatabaseId) {
        this.masterDatabaseId = `MED${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    }
});

// Pre-save middleware to generate master database ID
productSchema.pre('save', async function(next) {
    if (this.isNew && !this.masterDatabaseId) {
        const count = await mongoose.model('Product').countDocuments();
        this.masterDatabaseId = `MED${new Date().getFullYear()}${String(count + 1).padStart(6, '0')}`;
    }
    next();
});

// Virtual for backward compatibility
productSchema.virtual('pharmacyMapping').get(function() {
    return {
        medicineId: this._id,
        pharmacyStocks: this.pharmacyStocks,
        vendorStocks: this.vendorStocks,
        totalPharmacies: this.totalPharmacies,
        totalVendors: this.totalVendors,
        averagePrice: this.overallAveragePrice,
        lowestPrice: this.overallLowestPrice,
        highestPrice: this.overallHighestPrice,
        availabilityPercentage: this.overallAvailabilityPercentage,
        lastPriceUpdate: this.updatedAt
    };
});

module.exports = mongoose.model('Product', productSchema);