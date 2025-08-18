const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  prescription: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription' },
  orderNumber: { type: String, unique: true, required: true },
  
  items: [{
    medicine: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true },
    pharmacy: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true },
    totalPrice: { type: Number, required: true }
  }],
  
  // Group items by pharmacy for separate processing
  pharmacyOrders: [{
    pharmacy: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', required: true },
    items: [{
      medicine: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true },
      quantity: { type: Number, required: true },
      price: { type: Number, required: true },
      totalPrice: { type: Number, required: true }
    }],
    subtotal: { type: Number, required: true },
    status: { 
      type: String, 
      enum: ['pending', 'confirmed', 'preparing', 'ready', 'dispatched', 'delivered', 'cancelled'],
      default: 'pending' 
    },
    estimatedDelivery: Date
  }],
  
  totalAmount: { type: Number, required: true },
  paymentStatus: { 
    type: String, 
    enum: ['pending', 'paid', 'failed', 'refunded'], 
    default: 'pending' 
  },
  paymentId: String,
  
  deliveryAddress: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true }
  },
  
  overallStatus: { 
    type: String, 
    enum: ['pending', 'processing', 'partially_ready', 'ready', 'dispatched', 'delivered', 'cancelled'],
    default: 'pending' 
  }
}, { timestamps: true });

// Auto-generate order number
orderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    const count = await mongoose.model('Order').countDocuments();
    this.orderNumber = `ORD${Date.now()}${count + 1}`;
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);