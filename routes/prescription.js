const express = require('express');
const Prescription = require('../models/Prescription');
const { auth, authorize } = require('../middleware/auth');
const { uploadPrescription, deleteImage } = require('../config/cloudinary');

const router = express.Router();

// Upload prescription (customer) with Cloudinary
router.post('/upload', auth, authorize('customer'), uploadPrescription.array('prescriptions', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'At least one prescription image is required' });
    }

    // Process uploaded files
    const prescriptionImages = req.files.map(file => ({
      url: file.path,
      publicId: file.filename,
      originalName: file.originalname
    }));

    const { isUrgent = false } = req.body;

    const prescription = new Prescription({
      customer: req.user._id,
      prescriptionImages,
      isUrgent: JSON.parse(isUrgent)
    });

    await prescription.save();

    // Emit real-time notification to prescription readers
    const io = req.app.get('io');
    io.to('prescription_readers').emit('new_prescription', {
      id: prescription._id,
      customer: req.user.name,
      isUrgent: prescription.isUrgent,
      imageCount: prescriptionImages.length,
      createdAt: prescription.createdAt
    });

    res.status(201).json({
      message: 'Prescription uploaded successfully',
      prescription: {
        id: prescription._id,
        status: prescription.status,
        imageCount: prescriptionImages.length,
        isUrgent: prescription.isUrgent
      }
    });
  } catch (error) {
    // Clean up uploaded files if database save fails
    if (req.files) {
      for (const file of req.files) {
        try {
          await deleteImage(file.filename);
        } catch (cleanupError) {
          console.error('Error cleaning up uploaded file:', cleanupError);
        }
      }
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete prescription image (customer only, before processing)
router.delete('/:id/images/:imageIndex', auth, authorize('customer'), async (req, res) => {
  try {
    const { id, imageIndex } = req.params;
    const index = parseInt(imageIndex);

    const prescription = await Prescription.findById(id);
    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    if (prescription.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (prescription.status !== 'uploaded') {
      return res.status(400).json({ message: 'Cannot modify prescription after processing has started' });
    }

    if (index < 0 || index >= prescription.prescriptionImages.length) {
      return res.status(400).json({ message: 'Invalid image index' });
    }

    if (prescription.prescriptionImages.length <= 1) {
      return res.status(400).json({ message: 'Cannot delete the last prescription image' });
    }

    const imageToDelete = prescription.prescriptionImages[index];

    // Delete from Cloudinary
    try {
      await deleteImage(imageToDelete.publicId);
    } catch (error) {
      console.error('Error deleting image from Cloudinary:', error);
    }

    // Remove from prescription
    prescription.prescriptionImages.splice(index, 1);
    await prescription.save();

    res.json({ message: 'Prescription image deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add more prescription images (customer only, before processing)
router.post('/:id/add-images', auth, authorize('customer'), uploadPrescription.array('prescriptions', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'At least one prescription image is required' });
    }

    const prescription = await Prescription.findById(req.params.id);
    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    if (prescription.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (prescription.status !== 'uploaded') {
      return res.status(400).json({ message: 'Cannot modify prescription after processing has started' });
    }

    if (prescription.prescriptionImages.length + req.files.length > 10) {
      return res.status(400).json({ message: 'Maximum 10 images allowed per prescription' });
    }

    // Process new uploaded files
    const newImages = req.files.map(file => ({
      url: file.path,
      publicId: file.filename,
      originalName: file.originalname
    }));

    prescription.prescriptionImages.push(...newImages);
    await prescription.save();

    res.json({ 
      message: 'Images added successfully',
      totalImages: prescription.prescriptionImages.length
    });
  } catch (error) {
    // Clean up uploaded files if database save fails
    if (req.files) {
      for (const file of req.files) {
        try {
          await deleteImage(file.filename);
        } catch (cleanupError) {
          console.error('Error cleaning up uploaded file:', cleanupError);
        }
      }
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get prescription queue (prescription readers)
router.get('/queue', auth, authorize('prescription_reader'), async (req, res) => {
  try {
    const prescriptions = await Prescription.find({
      status: { $in: ['uploaded', 'reading'] }
    })
    .populate('customer', 'name phone email profileImage')
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
      .populate('medicines.medicine', 'name brand strength form image')
      .populate('medicines.alternatives', 'name brand strength form image')
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
      .populate('customer', 'name phone email profileImage')
      .populate('prescriptionReader', 'name profileImage')
      .populate('medicines.medicine', 'name brand strength form category image')
      .populate('medicines.alternatives', 'name brand strength form category image');

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

// Delete prescription (customer only, before processing starts)
router.delete('/:id', auth, authorize('customer'), async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.id);
    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    if (prescription.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (prescription.status !== 'uploaded') {
      return res.status(400).json({ message: 'Cannot delete prescription after processing has started' });
    }

    // Delete all images from Cloudinary
    for (const image of prescription.prescriptionImages) {
      try {
        await deleteImage(image.publicId);
      } catch (error) {
        console.error('Error deleting prescription image:', error);
      }
    }

    // Delete prescription document
    await Prescription.findByIdAndDelete(req.params.id);

    res.json({ message: 'Prescription deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;