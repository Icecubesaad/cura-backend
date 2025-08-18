const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema({
  name: { type: String, required: true },
  genericName: { type: String, required: true },
  brand: { type: String, required: true },
  category: { type: String, required: true },
  form: { 
    type: String, 
    enum: ['tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops', 'inhaler', 'other'],
    required: true 
  },
  strength: { type: String, required: true }, // e.g., "500mg", "10ml"
  description: String,
  sideEffects: [String],
  contraindications: [String],
  dosageInstructions: String,
  image: String,
  requiresPrescription: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Index for search functionality
medicineSchema.index({ 
  name: 'text', 
  genericName: 'text', 
  brand: 'text', 
  category: 'text' 
});

module.exports = mongoose.model('Medicine', medicineSchema);