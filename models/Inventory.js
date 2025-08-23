// models/Inventory.js

const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
    // Arrays to store product IDs, categorized by type
    medicines: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Medicine'
    }],
    products: [{ // General products
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    }],
    
    // Counters for quick reference
    totalMedicines: {
        type: Number,
        default: 0
    },
    totalProducts: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Pre-save middleware to update total counts based on array lengths
inventorySchema.pre('save', function(next) {
    this.totalMedicines = this.medicines.length;
    this.totalProducts = this.products.length;
    next();
});

module.exports = mongoose.model('Inventory', inventorySchema);