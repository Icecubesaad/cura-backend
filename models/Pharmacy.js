// models/Pharmacy.js
const mongoose = require('mongoose');

const pharmacySchema = new mongoose.Schema({
  // Owner information
  owner: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  
  // Basic Information
  name: { 
    type: String, 
    required: true,
    trim: true,
    index: true
  },
  
  nameAr: { 
    type: String, 
    trim: true,
    index: true
  },
  
  licenseNumber: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    uppercase: true
  },
  
  // Location Information
  cityId: {
    type: String,
    required: true,
  },
  
  cityName: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  
  governorateId: {
    type: String,
    required: true,
    index: true
  },
  
  // Contact Information
  phone: { 
    type: String, 
    required: true,
    trim: true
  },
  
  email: { 
    type: String, 
    required: true,
    lowercase: true,
    trim: true
  },
  
  website: {
    type: String,
    trim: true
  },
  
  // Address Information
  address: {
    street: { 
      type: String, 
      required: true,
      trim: true
    },
    area: {
      type: String,
      trim: true
    },
    city: { 
      type: String, 
      required: true,
      trim: true,
      index: true
    },
    state: { 
      type: String, 
      required: true,
      trim: true,
      index: true
    },
    zipCode: { 
      type: String, 
      required: true,
      trim: true
    },
    country: { 
      type: String, 
      required: true,
      default: 'Egypt',
      trim: true
    },
    landmark: {
      type: String,
      trim: true
    }
  },
  
  addressAr: {
    type: String,
    trim: true
  },
  
  // Coordinates (matching frontend interface)
  coordinates: {
    lat: {
      type: Number,
      min: -90,
      max: 90,
      required: true
    },
    lng: {
      type: Number,
      min: -180,
      max: 180,
      required: true
    }
  },
  
  // Operating Hours (simplified version matching frontend)
  workingHours: {
    open: {
      type: String,
      default: '09:00'
    },
    close: {
      type: String,
      default: '22:00'
    },
    is24Hours: {
      type: Boolean,
      default: false
    }
  },
  
  // Detailed Operating Hours (keeping the original structure)
  operatingHours: {
    monday: { 
      isOpen: { type: Boolean, default: true },
      open: { type: String, default: '09:00' }, 
      close: { type: String, default: '22:00' },
      breakTime: {
        start: String,
        end: String
      }
    },
    tuesday: { 
      isOpen: { type: Boolean, default: true },
      open: { type: String, default: '09:00' }, 
      close: { type: String, default: '22:00' },
      breakTime: {
        start: String,
        end: String
      }
    },
    wednesday: { 
      isOpen: { type: Boolean, default: true },
      open: { type: String, default: '09:00' }, 
      close: { type: String, default: '22:00' },
      breakTime: {
        start: String,
        end: String
      }
    },
    thursday: { 
      isOpen: { type: Boolean, default: true },
      open: { type: String, default: '09:00' }, 
      close: { type: String, default: '22:00' },
      breakTime: {
        start: String,
        end: String
      }
    },
    friday: { 
      isOpen: { type: Boolean, default: true },
      open: { type: String, default: '09:00' }, 
      close: { type: String, default: '22:00' },
      breakTime: {
        start: String,
        end: String
      }
    },
    saturday: { 
      isOpen: { type: Boolean, default: true },
      open: { type: String, default: '09:00' }, 
      close: { type: String, default: '22:00' },
      breakTime: {
        start: String,
        end: String
      }
    },
    sunday: { 
      isOpen: { type: Boolean, default: false },
      open: { type: String, default: '10:00' }, 
      close: { type: String, default: '20:00' },
      breakTime: {
        start: String,
        end: String
      }
    }
  },
  
  // Services offered
  services: [{
    type: String,
    enum: [
      'prescription_filling', 'otc_medicines', 'health_consultation',
      'blood_pressure_check', 'diabetes_monitoring', 'vaccination',
      'home_delivery', 'online_ordering', 'medication_review',
      'health_screening', 'first_aid', 'medical_devices', 'child_friendly'
    ]
  }],
  
  // Specialties (added to match frontend)
  specialties: [{
    type: String,
    enum: [
      'pediatric', 'geriatric', 'oncology', 'cardiology',
      'diabetes_care', 'mental_health', 'dermatology',
      'pain_management', 'women_health', 'chronic_disease', 'family_medicine'
    ]
  }],
  
  // Specializations (keeping original structure)
  specializations: [{
    type: String,
    enum: [
      'pediatric', 'geriatric', 'oncology', 'cardiology',
      'diabetes_care', 'mental_health', 'dermatology',
      'pain_management', 'women_health', 'chronic_disease', 'family_medicine'
    ]
  }],
  
  // Staff Information
  staff: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    role: {
      type: String,
      enum: ['pharmacist', 'assistant', 'technician', 'manager'],
      required: true
    },
    licenseNumber: {
      type: String,
      trim: true
    },
    qualification: {
      type: String,
      trim: true
    },
    experience: {
      type: Number,
      min: 0
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  
  // Rating and Reviews
  rating: { 
    type: Number, 
    default: 0, 
    min: 0, 
    max: 5,
    index: true
  },
  
  totalRatings: { 
    type: Number, 
    default: 0
  },
  
  reviewCount: { 
    type: Number, 
    default: 0
  },
  
  ratingBreakdown: {
    five: { type: Number, default: 0 },
    four: { type: Number, default: 0 },
    three: { type: Number, default: 0 },
    two: { type: Number, default: 0 },
    one: { type: Number, default: 0 }
  },
  
  // Reviews
  reviews: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    aspects: {
      service: { type: Number, min: 1, max: 5 },
      price: { type: Number, min: 1, max: 5 },
      availability: { type: Number, min: 1, max: 5 },
      cleanliness: { type: Number, min: 1, max: 5 }
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    helpfulCount: {
      type: Number,
      default: 0
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Business Information
  establishedYear: {
    type: Number,
    min: 1900,
    max: new Date().getFullYear()
  },
  
  chainName: {
    type: String,
    trim: true
  },
  
  isChain: {
    type: Boolean,
    default: false
  },
  
  // Insurance and Payments
  acceptedInsurance: [{
    provider: String,
    coverage: String,
    copayAmount: Number
  }],
  
  paymentMethods: [{
    type: String,
    enum: ['cash', 'credit_card', 'debit_card', 'mobile_payment', 'insurance', 'installments']
  }],
  
  // Delivery Information (updated to match frontend)
  deliveryService: {
    type: Boolean,
    default: false
  },
  
  deliveryTime: {
    type: String,
    default: '30-60 minutes'
  },
  
  deliveryFee: {
    type: Number,
    default: 0
  },
  
  minOrderAmount: {
    type: Number,
    default: 0
  },
  
  // Detailed delivery info (keeping original structure)
  deliveryDetails: {
    available: {
      type: Boolean,
      default: false
    },
    radius: {
      type: Number, // in kilometers
      default: 5
    },
    fee: {
      type: Number,
      default: 0
    },
    freeDeliveryThreshold: {
      type: Number,
      default: 200
    },
    estimatedTime: {
      type: String,
      default: '30-60 minutes'
    },
    emergencyDelivery: {
      type: Boolean,
      default: false
    }
  },
  
  // Commission (added for frontend)
  commission: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  // Images and Media
  images: {
    logo: String,
    storefront: [String],
    interior: [String],
    certificate: [String],
    staff: [String]
  },
  
  // Status and Verification
  isActive: { 
    type: Boolean, 
    default: true,
    index: true
  },
  
  isVerified: { 
    type: Boolean, 
    default: false,
    index: true
  },
  
  verificationStatus: {
    type: String,
    enum: ['pending', 'in_review', 'verified', 'rejected', 'suspended'],
    default: 'pending'
  },
  
  verifiedAt: Date,
  
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Product Statistics (for frontend compatibility)
  productCount: {
    type: Number,
    default: 0
  },
  
  hasProducts: {
    type: Boolean,
    default: false
  },
  
  productStatistics: {
    totalProducts: {
      type: Number,
      default: 0
    },
    inStockProducts: {
      type: Number,
      default: 0
    },
    averageRating: {
      type: Number,
      default: 0
    },
    categoryCount: {
      type: Number,
      default: 0
    }
  },
  
  // Business Metrics
  metrics: {
    totalOrders: {
      type: Number,
      default: 0
    },
    completedOrders: {
      type: Number,
      default: 0
    },
    cancelledOrders: {
      type: Number,
      default: 0
    },
    averageOrderValue: {
      type: Number,
      default: 0
    },
    totalRevenue: {
      type: Number,
      default: 0
    },
    customerCount: {
      type: Number,
      default: 0
    },
    repeatCustomers: {
      type: Number,
      default: 0
    }
  },
  
  // Operational Status
  currentStatus: {
    type: String,
    enum: ['open', 'closed', 'busy', 'emergency_only', 'maintenance'],
    default: 'open'
  },
  
  statusMessage: {
    type: String,
    trim: true,
    maxlength: 200
  },
  
  // Features and Amenities
  features: [{
    type: String,
    enum: [
      'parking_available', 'wheelchair_accessible', 'drive_through',
      '24_hours', 'online_consultation', 'prescription_reminder',
      'loyalty_program', 'senior_discount', 'student_discount',
      'insurance_billing', 'compounding_service', 'medical_equipment_rental', 
      'child_friendly', 'family_discount'
    ]
  }],
  
  // Communication Preferences
  notifications: {
    email: {
      type: Boolean,
      default: true
    },
    sms: {
      type: Boolean,
      default: true
    },
    push: {
      type: Boolean,
      default: true
    },
    lowStock: {
      type: Boolean,
      default: true
    },
    newOrders: {
      type: Boolean,
      default: true
    },
    reviews: {
      type: Boolean,
      default: true
    }
  },
  
  // Emergency Contact
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String
  },
  
  // Social Media
  socialMedia: {
    facebook: String,
    instagram: String,
    twitter: String,
    linkedin: String,
    whatsapp: String
  },
  
  // Compliance and Certifications
  certifications: [{
    name: {
      type: String,
      required: true
    },
    issuedBy: String,
    issueDate: Date,
    expiryDate: Date,
    certificateNumber: String,
    documentUrl: String
  }],
  
  // Inventory Preferences
  inventorySettings: {
    autoReorder: {
      type: Boolean,
      default: false
    },
    reorderThreshold: {
      type: Number,
      default: 10
    },
    preferredSuppliers: [{
      name: String,
      contactInfo: String,
      rating: {
        type: Number,
        min: 1,
        max: 5
      }
    }],
    inventoryMethod: {
      type: String,
      enum: ['fifo', 'lifo', 'weighted_average'],
      default: 'fifo'
    }
  },
  
  // Analytics tracking
  analytics: {
    totalViews: {
      type: Number,
      default: 0
    },
    monthlyViews: {
      type: Number,
      default: 0
    },
    searchAppearances: {
      type: Number,
      default: 0
    },
    clickThroughRate: {
      type: Number,
      default: 0
    },
    lastAnalyticsReset: {
      type: Date,
      default: Date.now
    }
  },
  
  // Administrative
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Suspension/Ban information
  suspensionInfo: {
    isSuspended: {
      type: Boolean,
      default: false
    },
    suspendedAt: Date,
    suspendedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    suspensionReason: String,
    suspensionEndDate: Date
  }
}, {
  timestamps: true,
  indexes: [
    { owner: 1 },
    { cityId: 1, governorateId: 1 },
    { 'address.city': 1, 'address.state': 1 },
    { isActive: 1, isVerified: 1 },
    { rating: -1 },
    { coordinates: '2dsphere' },
    { licenseNumber: 1 },
    { services: 1 },
    { specializations: 1 },
    { specialties: 1 }
  ]
});

// Text index for search functionality
pharmacySchema.index({
  name: 'text',
  nameAr: 'text',
  'address.street': 'text',
  'address.area': 'text',
  'address.city': 'text',
  addressAr: 'text',
  chainName: 'text',
  services: 'text',
  specializations: 'text',
  specialties: 'text'
});

// Geospatial index for location-based searches
pharmacySchema.index({ coordinates: '2dsphere' });

// Virtual for full address
pharmacySchema.virtual('fullAddress').get(function() {
  const addr = this.address;
  return `${addr.street}${addr.area ? ', ' + addr.area : ''}, ${addr.city}, ${addr.state} ${addr.zipCode}`;
});

// Virtual for completion percentage
pharmacySchema.virtual('profileCompletion').get(function() {
  let completedFields = 0;
  const totalFields = 15;
  
  if (this.name) completedFields++;
  if (this.phone) completedFields++;
  if (this.email) completedFields++;
  if (this.address && this.address.street) completedFields++;
  if (this.address && this.address.city) completedFields++;
  if (this.operatingHours) completedFields++;
  if (this.services && this.services.length > 0) completedFields++;
  if (this.images && this.images.logo) completedFields++;
  if (this.images && this.images.storefront && this.images.storefront.length > 0) completedFields++;
  if (this.staff && this.staff.length > 0) completedFields++;
  if (this.establishedYear) completedFields++;
  if (this.paymentMethods && this.paymentMethods.length > 0) completedFields++;
  if (this.certifications && this.certifications.length > 0) completedFields++;
  if (this.coordinates && this.coordinates.lat) completedFields++;
  if (this.nameAr) completedFields++;
  
  return Math.round((completedFields / totalFields) * 100);
});

// Virtual for current operating status
pharmacySchema.virtual('isCurrentlyOpen').get(function() {
  if (!this.isActive) return false;
  
  if (this.workingHours && this.workingHours.is24Hours) return true;
  
  const now = new Date();
  const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
  const currentTime = now.toTimeString().slice(0, 5);
  
  const todayHours = this.operatingHours[currentDay];
  if (!todayHours || !todayHours.isOpen) return false;
  
  return currentTime >= todayHours.open && currentTime <= todayHours.close;
});

// Virtual for average rating display
pharmacySchema.virtual('averageRatingDisplay').get(function() {
  return this.rating ? this.rating.toFixed(1) : 'No ratings yet';
});

// Pre-save middleware to update calculated fields
pharmacySchema.pre('save', function(next) {
  // Update rating when reviews change
  if (this.reviews && this.reviews.length > 0) {
    const totalRating = this.reviews.reduce((sum, review) => sum + review.rating, 0);
    this.rating = totalRating / this.reviews.length;
    this.totalRatings = this.reviews.length;
    this.reviewCount = this.reviews.length;
    
    // Update rating breakdown
    this.ratingBreakdown = { five: 0, four: 0, three: 0, two: 0, one: 0 };
    this.reviews.forEach(review => {
      switch(review.rating) {
        case 5: this.ratingBreakdown.five++; break;
        case 4: this.ratingBreakdown.four++; break;
        case 3: this.ratingBreakdown.three++; break;
        case 2: this.ratingBreakdown.two++; break;
        case 1: this.ratingBreakdown.one++; break;
      }
    });
  }
  
  // Sync delivery information
  if (this.deliveryDetails) {
    this.deliveryService = this.deliveryDetails.available;
    this.deliveryTime = this.deliveryDetails.estimatedTime;
    this.deliveryFee = this.deliveryDetails.fee;
    this.minOrderAmount = this.deliveryDetails.freeDeliveryThreshold;
  }
  
  // Ensure specialties and specializations are synced
  if (this.specializations && this.specializations.length > 0 && (!this.specialties || this.specialties.length === 0)) {
    this.specialties = this.specializations;
  }
  
  next();
});

// Instance method to add a review
pharmacySchema.methods.addReview = function(userId, rating, comment, aspects = {}) {
  this.reviews.push({
    user: userId,
    rating,
    comment,
    aspects,
    isVerified: false
  });
  
  return this.save();
};

// Instance method to update metrics
pharmacySchema.methods.updateMetrics = function(orderData) {
  if (orderData.type === 'completed') {
    this.metrics.completedOrders++;
    this.metrics.totalRevenue += orderData.amount;
    this.metrics.averageOrderValue = this.metrics.totalRevenue / this.metrics.completedOrders;
  } else if (orderData.type === 'cancelled') {
    this.metrics.cancelledOrders++;
  }
  
  this.metrics.totalOrders = this.metrics.completedOrders + this.metrics.cancelledOrders;
  
  return this.save();
};

// Instance method to update product statistics
pharmacySchema.methods.updateProductStatistics = function(stats) {
  this.productStatistics = { ...this.productStatistics, ...stats };
  this.productCount = stats.totalProducts || this.productCount;
  this.hasProducts = this.productCount > 0;
  
  return this.save();
};

// Instance method to increment view count
pharmacySchema.methods.incrementViewCount = function() {
  this.analytics.totalViews++;
  this.analytics.monthlyViews++;
  return this.save();
};

// Static method to find nearby pharmacies
pharmacySchema.statics.findNearby = function(lat, lng, maxDistance = 10000) {
  return this.find({
    coordinates: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [lng, lat]
        },
        $maxDistance: maxDistance
      }
    },
    isActive: true,
    isVerified: true
  });
};

// Static method to find pharmacies by city
pharmacySchema.statics.findByCity = function(cityId) {
  return this.find({
    cityId: cityId,
    isActive: true,
    isVerified: true
  }).sort({ rating: -1 });
};

// Static method to get pharmacy statistics
pharmacySchema.statics.getStatistics = function() {
  return this.aggregate([
    {
      $group: {
        _id: null,
        totalPharmacies: { $sum: 1 },
        activePharmacies: {
          $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
        },
        verifiedPharmacies: {
          $sum: { $cond: [{ $eq: ['$isVerified', true] }, 1, 0] }
        },
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: '$totalRatings' },
        citiesCovered: { $addToSet: '$cityName' }
      }
    }
  ]);
};

// Transform function for API responses
pharmacySchema.methods.toJSON = function() {
  const pharmacy = this.toObject({ virtuals: true });
  
  // Transform _id to id for frontend compatibility
  if (pharmacy._id) {
    pharmacy.id = pharmacy._id.toString();
    delete pharmacy._id;
  }
  
  // Ensure coordinates structure matches frontend
  if (pharmacy.address && pharmacy.address.coordinates) {
    pharmacy.coordinates = {
      lat: pharmacy.address.coordinates.latitude,
      lng: pharmacy.address.coordinates.longitude
    };
  }
  
  return pharmacy;
};

// Ensure virtuals are included in JSON output
pharmacySchema.set('toJSON', { virtuals: true });
pharmacySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Pharmacy', pharmacySchema);