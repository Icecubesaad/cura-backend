const express = require('express');
const multer = require('multer');
const path = require('path');
const Prescription = require('../models/Prescription');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// Configure multer for prescription image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/prescriptions/');
  },
  filename: (req, file, cb) => {
    cb(null, `prescription_${Date.now()}_${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Upload prescription (customer)
router.post('/upload', auth, authorize('customer'), upload.array('prescriptions', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'At least one prescription image is required' });
    }

    const prescriptionImages = req.files.map(file => file.filename);
    const { isUrgent = false } = req.body;

    const prescription = new Prescription({
      customer: req.user._id,
      prescriptionImages,
      isUrgent
    });

    await prescription.save();

    // Emit real-time notification to prescription readers
    const io = req.app.get('io');
    io.to('prescription_readers').emit('new_prescription', {
      id: prescription._id,
      customer: req.user.name,
      isUrgent,
      createdAt: prescription.createdAt
    });

    res.status(201).json({
      message: 'Prescription uploaded successfully',
      prescription: {
        id: prescription._id,
        status: prescription.status,
        images: prescription.prescriptionImages,
        isUrgent: prescription.isUrgent
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get prescription queue (prescription readers)
router.get('/queue', auth, authorize('prescription_reader'), async (req, res) => {
  try {
    const prescriptions = await Prescription.find({
      status: { $in: ['uploaded', 'reading'] }
    })
    .populate('customer', 'name phone email')
    .sort({ isUrgent: -1, createdAt: 1 });

    res.json(prescriptions);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Start reading prescription
router.put('/:id/start-reading', auth, authorize('prescription_reader'), async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.id);
    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    if (prescription.status !== 'uploaded') {
      return res.status(400).json({ message: 'Prescription is not available for reading' });
    }

    prescription.status = 'reading';
    prescription.prescriptionReader = req.user._id;
    prescription.readingStartedAt = new Date();
    
    await prescription.save();

    res.json({ message: 'Prescription reading started', prescription });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Process prescription (add medicines and alternatives)
router.put('/:id/process', auth, authorize('prescription_reader'), async (req, res) => {
  try {
    const { medicines, readerNotes } = req.body;
    
    const prescription = await Prescription.findById(req.params.id);
    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    if (prescription.status !== 'reading' || prescription.prescriptionReader.toString() !== req.user._id.toString()) {
      return res.status(400).json({ message: 'Unauthorized to process this prescription' });
    }

    prescription.medicines = medicines;
    prescription.readerNotes = readerNotes;
    prescription.status = 'processed';
    prescription.processedAt = new Date();
    
    await prescription.save();

    // Notify customer that prescription is ready
    const io = req.app.get('io');
    io.to(`customer_${prescription.customer}`).emit('prescription_processed', {
      prescriptionId: prescription._id,
      message: 'Your prescription has been processed and is ready for ordering'
    });

    res.json({ message: 'Prescription processed successfully', prescription });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get customer's prescriptions
router.get('/my-prescriptions', auth, authorize('customer'), async (req, res) => {
  try {
    const prescriptions = await Prescription.find({ customer: req.user._id })
      .populate('medicines.medicine', 'name brand strength form')
      .populate('medicines.alternatives', 'name brand strength form')
      .sort({ createdAt: -1 });

    res.json(prescriptions);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get specific prescription details
router.get('/:id', auth, async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.id)
      .populate('customer', 'name phone email')
      .populate('prescriptionReader', 'name')
      .populate('medicines.medicine', 'name brand strength form category')
      .populate('medicines.alternatives', 'name brand strength form category');

    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    // Check authorization
    const isCustomer = req.user.role === 'customer' && prescription.customer._id.toString() === req.user._id.toString();
    const isReader = req.user.role === 'prescription_reader';
    const isAdmin = req.user.role === 'admin';

    if (!isCustomer && !isReader && !isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(prescription);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;