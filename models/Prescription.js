const mongoose = require('mongoose');

const prescriptionFileSchema = new mongoose.Schema({
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    url: { type: String, required: true },
    type: { type: String, enum: ['image', 'pdf'], required: true },
    size: Number,
    uploadedAt: { type: Date, default: Date.now }
}, { _id: true });

const medicationSchema = new mongoose.Schema({
    name: { type: String, required: true },
    dosage: String,
    frequency: String,
    duration: String,
    instructions: String,
    quantity: Number
}, { _id: false });

const processedMedicineSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true },
    dosage: String,
    instructions: String,
    price: Number,
    pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    alternatives: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        productName: String,
        price: Number
    }],
    isAvailable: { type: Boolean, default: true }
}, { _id: true });

const statusHistorySchema = new mongoose.Schema({
    status: { 
        type: String, 
        enum: ['submitted', 'reviewing', 'approved', 'rejected', 'cancelled', 'suspended'],
        required: true 
    },
    timestamp: { type: Date, default: Date.now },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userRole: { 
        type: String, 
        enum: ['customer', 'prescription-reader', 'pharmacy', 'admin'],
        required: true 
    },
    userName: { type: String, required: true },
    notes: String,
    estimatedCompletion: Date
}, { _id: true });

const suspensionDataSchema = new mongoose.Schema({
    category: String,
    reason: String,
    suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    suspendedByName: String,
    suspendedAt: { type: Date, default: Date.now },
    processedMedicines: [processedMedicineSchema],
    processingNotes: String
}, { _id: false });

const prescriptionSchema = new mongoose.Schema({
    // System generated ID will be used as prescription number
    prescriptionNumber: { type: String, unique: true },
    
    // Customer Information
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true },
    
    // Prescription Files
    files: [prescriptionFileSchema],
    
    // Patient Information
    patientName: { type: String, required: true },
    patientAge: Number,
    patientGender: { type: String, enum: ['male', 'female'] },
    patientWeight: Number,
    patientHeight: Number,
    
    // Doctor Information
    doctorName: String,
    doctorSpecialty: String,
    doctorLicense: String,
    hospitalClinic: String,
    prescriptionDate: Date,
    
    // Prescription Details
    medications: [medicationSchema],
    diagnosis: String,
    allergies: [String],
    medicalHistory: [String],
    specialInstructions: String,
    
    // Workflow Information
    urgency: { 
        type: String, 
        enum: ['routine', 'normal', 'urgent'],
        default: 'normal'
    },
    currentStatus: { 
        type: String, 
        enum: ['submitted', 'reviewing', 'approved', 'rejected', 'cancelled', 'suspended'],
        default: 'submitted'
    },
    
    // Assignment Information
    assignedPharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedPharmacistId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedReaderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    
    // Processing Results
    processedMedicines: [processedMedicineSchema],
    rejectionReason: String,
    suspensionData: suspensionDataSchema,
    
    // Delivery Information
    deliveryAddress: String,
    deliveryFee: { type: Number, default: 0 },
    
    // Financial Information
    totalAmount: Number,
    estimatedAmount: Number,
    
    // Timing Information
    estimatedCompletion: Date,
    actualCompletion: Date,
    
    // Status History
    statusHistory: [statusHistorySchema],
    
    // Notes and Comments
    notes: String,
    pharmacyNotes: String,
    readerNotes: String,
    internalNotes: String,
    
    // Location Information
    cityId: String,
    governorateId: String,
    
    // Processing Metadata
    processingStartedAt: Date,
    processingCompletedAt: Date,
    reviewDuration: Number, // in minutes
    
    // Quality Control
    qualityChecked: { type: Boolean, default: false },
    qualityCheckedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    qualityCheckedAt: Date,
    qualityNotes: String,
    
    // Integration with Orders
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    orderCreated: { type: Boolean, default: false }
}, {
    timestamps: true
});

// Indexes
prescriptionSchema.index({ prescriptionNumber: 1 }, { unique: true });
prescriptionSchema.index({ customerId: 1 });
prescriptionSchema.index({ currentStatus: 1 });
prescriptionSchema.index({ urgency: 1 });
prescriptionSchema.index({ assignedPharmacyId: 1 });
prescriptionSchema.index({ assignedReaderId: 1 });
prescriptionSchema.index({ patientName: 1 });
prescriptionSchema.index({ doctorName: 1 });
prescriptionSchema.index({ createdAt: -1 });
prescriptionSchema.index({ estimatedCompletion: 1 });

// Compound indexes
prescriptionSchema.index({ currentStatus: 1, urgency: 1 });
prescriptionSchema.index({ assignedReaderId: 1, currentStatus: 1 });
prescriptionSchema.index({ customerId: 1, currentStatus: 1 });

// Pre-save middleware to generate prescription number
prescriptionSchema.pre('save', async function(next) {
    if (this.isNew && !this.prescriptionNumber) {
        const count = await mongoose.model('Prescription').countDocuments();
        this.prescriptionNumber = `RX${new Date().getFullYear()}${String(count + 1).padStart(6, '0')}`;
    }
    
    // Add status history entry if status changed
    if (this.isModified('currentStatus') && !this.isNew) {
        this.statusHistory.push({
            status: this.currentStatus,
            timestamp: new Date(),
            userId: this.modifiedBy || this.customerId,
            userRole: this.modifiedByRole || 'customer',
            userName: this.modifiedByName || this.customerName,
            notes: 'Status updated'
        });
    }
    
    next();
});

// Methods
prescriptionSchema.methods.canTransitionTo = function(newStatus, userRole) {
    const validTransitions = {
        submitted: ['reviewing', 'approved', 'cancelled', 'suspended'],
        reviewing: ['approved', 'rejected', 'suspended'],
        approved: ['cancelled'],
        rejected: ['submitted'],
        cancelled: [],
        suspended: ['reviewing', 'approved', 'rejected']
    };
    
    const rolePermissions = {
        'customer': ['cancelled'],
        'prescription-reader': ['reviewing', 'approved', 'rejected', 'suspended'],
        'pharmacy': ['reviewing', 'approved', 'rejected', 'suspended'],
        'admin': ['reviewing', 'approved', 'rejected', 'cancelled', 'suspended']
    };
    
    return validTransitions[this.currentStatus]?.includes(newStatus) && 
           rolePermissions[userRole]?.includes(newStatus);
};

prescriptionSchema.methods.updateStatus = function(newStatus, userId, userRole, userName, notes = '') {
    if (!this.canTransitionTo(newStatus, userRole)) {
        throw new Error(`Cannot transition from ${this.currentStatus} to ${newStatus} with role ${userRole}`);
    }
    
    this.currentStatus = newStatus;
    this.statusHistory.push({
        status: newStatus,
        timestamp: new Date(),
        userId,
        userRole,
        userName,
        notes
    });
};

prescriptionSchema.methods.calculateEstimatedCompletion = function() {
    const urgencyMultipliers = {
        routine: 1.5,
        normal: 1.0,
        urgent: 0.5
    };
    
    const baseHours = {
        submitted: 0,
        reviewing: 2,
        approved: 0,
        rejected: 0,
        cancelled: 0,
        suspended: 4
    };
    
    const hours = baseHours[this.currentStatus] * urgencyMultipliers[this.urgency];
    const estimatedCompletion = new Date();
    estimatedCompletion.setHours(estimatedCompletion.getHours() + hours);
    
    return estimatedCompletion;
};

prescriptionSchema.methods.getWorkflowProgress = function() {
    const statusOrder = ['submitted', 'reviewing', 'approved'];
    const currentIndex = statusOrder.indexOf(this.currentStatus);
    
    if (currentIndex === -1) return 0;
    return Math.round((currentIndex / (statusOrder.length - 1)) * 100);
};

module.exports = mongoose.model('Prescription', prescriptionSchema);