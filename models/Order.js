const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    productNameAr: String,
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    prescription: { type: Boolean, default: false },
    category: String,
    manufacturer: String,
    image: String,
    activeIngredient: String,
    strength: String,
    dosage: String,
    instructions: String,
    // Vendor specific fields
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { _id: true });

const deliveryAddressSchema = new mongoose.Schema({
    street: { type: String, required: true },
    area: String,
    city: { type: String, required: true },
    governorate: { type: String, required: true },
    phone: String,
    notes: String
}, { _id: false });

const statusHistorySchema = new mongoose.Schema({
    status: { 
        type: String, 
        enum: ['pending', 'confirmed', 'preparing', 'ready', 'out-for-delivery', 'delivered', 'cancelled', 'refunded'],
        required: true 
    },
    timestamp: { type: Date, default: Date.now },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedByName: String,
    userRole: { type: String, enum: ['customer', 'pharmacy', 'vendor', 'admin', 'delivery'] },
    notes: String,
    location: {
        lat: Number,
        lng: Number
    }
}, { _id: true });

const orderSchema = new mongoose.Schema({
    orderNumber: { type: String, required: true, unique: true },
    
    // Customer Information
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true },
    customerEmail: String,
    
    // Order Details
    status: { 
        type: String, 
        enum: ['pending', 'confirmed', 'preparing', 'ready', 'out-for-delivery', 'delivered', 'cancelled', 'refunded'],
        default: 'pending'
    },
    priority: { 
        type: String, 
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal'
    },
    
    // Financial Information
    totalAmount: { type: Number, required: true },
    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    
    // Payment Information
    paymentMethod: { 
        type: String, 
        enum: ['cash', 'card', 'wallet', 'bank_transfer'],
        required: true 
    },
    paymentStatus: { 
        type: String, 
        enum: ['pending', 'paid', 'failed', 'refunded', 'partial'],
        default: 'pending'
    },
    paymentReference: String,
    
    // Order Items
    items: [orderItemSchema],
    
    // Delivery Information
    deliveryAddress: deliveryAddressSchema,
    estimatedDeliveryTime: String,
    actualDeliveryTime: Date,
    deliveryInstructions: String,
    
    // Fulfillment Information
    pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    pharmacyName: String,
    pharmacyPhone: String,
    pharmacyCity: String,
    
    // Vendor Information (for B2B orders)
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    vendorName: String,
    
    // Prescription Information
    prescriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription' },
    prescriptionRequired: { type: Boolean, default: false },
    prescriptionVerified: { type: Boolean, default: false },
    
    // Assignment Information
    isAssigned: { type: Boolean, default: false },
    assignedAt: Date,
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    acceptedAt: Date,
    rejectedAt: Date,
    rejectionReason: String,
    preparationTime: Number, // in minutes
    
    // Order Management
    statusHistory: [statusHistorySchema],
    notes: String,
    pharmacyNotes: String,
    vendorNotes: String,
    internalNotes: String,
    
    // Cancellation and Refund
    cancelReason: String,
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    refundAmount: Number,
    refundReason: String,
    refundProcessedAt: Date,
    
    // Return Information
    returnInfo: {
        id: String,
        status: { 
            type: String, 
            enum: ['requested', 'approved', 'rejected', 'processing', 'completed']
        },
        refundAmount: Number,
        reason: String,
        requestedAt: Date,
        processedAt: Date
    },
    
    // Location Information
    cityId: String,
    cityName: String,
    governorateId: String,
    governorateName: String,
    
    // Tracking Information
    trackingNumber: String,
    deliveryPartnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    
    // Order Type Classification
    orderType: {
        type: String,
        enum: ['pharmacy', 'vendor', 'prescription', 'regular'],
        default: 'regular'
    },
    
    // Delivery and Time Management
    scheduledDeliveryDate: Date,
    isUrgent: { type: Boolean, default: false },
    isExpress: { type: Boolean, default: false },
    
    // Rating and Feedback
    customerRating: Number,
    customerFeedback: String,
    pharmacyRating: Number,
    deliveryRating: Number
}, {
    timestamps: true
});

// Indexes
orderSchema.index({ orderNumber: 1 }, { unique: true });
orderSchema.index({ customerId: 1 });
orderSchema.index({ pharmacyId: 1 });
orderSchema.index({ vendorId: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ priority: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ cityId: 1 });
orderSchema.index({ orderType: 1 });
orderSchema.index({ isAssigned: 1 });
orderSchema.index({ prescriptionRequired: 1 });
orderSchema.index({ 'deliveryAddress.city': 1 });

// Compound indexes for common queries
orderSchema.index({ pharmacyId: 1, status: 1 });
orderSchema.index({ customerId: 1, status: 1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ pharmacyId: 1, isAssigned: 1 });

// Pre-save middleware to generate order number
orderSchema.pre('save', async function(next) {
    if (this.isNew && !this.orderNumber) {
        const count = await mongoose.model('Order').countDocuments();
        this.orderNumber = `ORD${Date.now()}${String(count + 1).padStart(4, '0')}`;
    }
    
    // Add status history entry if status changed
    if (this.isModified('status') && !this.isNew) {
        this.statusHistory.push({
            status: this.status,
            timestamp: new Date(),
            notes: 'Status updated'
        });
    }
    
    next();
});

// Methods
orderSchema.methods.canBeCancelled = function() {
    return ['pending', 'confirmed'].includes(this.status);
};

orderSchema.methods.canBeRefunded = function() {
    return ['delivered'].includes(this.status) && this.paymentStatus === 'paid';
};

orderSchema.methods.calculateTotals = function() {
    this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
    this.totalAmount = this.subtotal + this.deliveryFee - this.discount + (this.taxAmount || 0);
};

orderSchema.methods.addStatusUpdate = function(status, updatedBy, notes = '') {
    this.status = status;
    this.statusHistory.push({
        status,
        timestamp: new Date(),
        updatedBy,
        notes
    });
};

module.exports = mongoose.model('Order', orderSchema);