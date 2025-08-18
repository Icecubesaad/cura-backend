const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  prescriptionImages: [{ type: String, required: true }],
  status: { 
    type: String, 
    enum: ['uploaded', 'reading', 'processed', 'ready_for_order'], 
    default: 'uploaded' 
  },
  prescriptionReader: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  readingStartedAt: Date,
  processedAt: Date,
  
  // Processed prescription data
  medicines: [{
    medicine: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine' },
    dosage: String,
    frequency: String,
    duration: String,
    instructions: String,
    alternatives: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Medicine' }]
  }],
  
  readerNotes: String,
  isUrgent: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Prescription', prescriptionSchema);