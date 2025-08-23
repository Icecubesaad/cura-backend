const mongoose = require('mongoose');

const packagingOptionSchema = new mongoose.Schema({
    type: { type: String, enum: ['blister', 'box'], required: true },
    name: { type: String, required: true },
    unitsPerPackage: { type: Number, required: true },
    description: String,
    price: { type: Number, required: true }
}, { _id: false });

const alternativeSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: { type: String, required: true },
    genericName: String,
    activeIngredient: String,
    strength: String,
    form: String,
    manufacturer: String,
    description: String,
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
    inStock: { type: Boolean, default: false },
    stockLevel: { 
        type: String, 
        enum: ['high', 'medium', 'low', 'critical', 'out'],
        default: 'out'
    },
    stockQuantity: { type: Number, default: 0 },
    price: { type: Number, required: true },
    originalPrice: Number,
    lastUpdated: { type: Date, default: Date.now },
    reorderLevel: Number,
    maxStock: Number,
    supplier: String,
    batchNumber: String,
    expiryDate: Date,
    bulkPricing: [{
        quantity: Number,
        price: Number
    }]
}, { _id: false });

const productSchema = new mongoose.Schema({
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
    
    // Images and Media
    image: String,
    images: [String],
    
    // Pharmacy Availability and Pricing
    pharmacyStocks: [pharmacyStockSchema],
    
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
    
    // Pricing Summary (calculated fields)
    averagePrice: Number,
    lowestPrice: Number,
    highestPrice: Number,
    availabilityPercentage: Number,
    totalPharmacies: { type: Number, default: 0 },
    
    // Product Status
    isActive: { type: Boolean, default: true },
    isPopular: { type: Boolean, default: false },
    salesRank: Number,
    approvalDate: Date,
    expiryWarningDays: { type: Number, default: 90 },
    
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

// Indexes
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
productSchema.index({ 'pharmacyStocks.pharmacyId': 1 });
productSchema.index({ 'pharmacyStocks.inStock': 1 });

// Virtual for pharmacy mapping (compatibility with existing interface)
productSchema.virtual('pharmacyMapping').get(function() {
    return {
        medicineId: this._id,
        pharmacyStocks: this.pharmacyStocks,
        totalPharmacies: this.totalPharmacies,
        averagePrice: this.averagePrice,
        lowestPrice: this.lowestPrice,
        highestPrice: this.highestPrice,
        availabilityPercentage: this.availabilityPercentage,
        lastPriceUpdate: this.updatedAt
    };
});

// Methods to update pricing summary
productSchema.methods.updatePricingSummary = function() {
    const inStockPharmacies = this.pharmacyStocks.filter(stock => stock.inStock);
    
    if (inStockPharmacies.length === 0) {
        this.averagePrice = 0;
        this.lowestPrice = 0;
        this.highestPrice = 0;
        this.availabilityPercentage = 0;
    } else {
        const prices = inStockPharmacies.map(stock => stock.price);
        this.averagePrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
        this.lowestPrice = Math.min(...prices);
        this.highestPrice = Math.max(...prices);
        this.availabilityPercentage = (inStockPharmacies.length / this.pharmacyStocks.length) * 100;
    }
    
    this.totalPharmacies = this.pharmacyStocks.length;
};

// Pre-save middleware to update pricing summary
productSchema.pre('save', function() {
    this.updatePricingSummary();
});

module.exports = mongoose.model('Product', productSchema);