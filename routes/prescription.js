const express = require('express');
const router = express.Router();
const Prescription = require('../models/Prescription');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const multer = require('multer');

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/prescriptions/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only images and PDFs are allowed'), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Workflow configuration
const PRESCRIPTION_WORKFLOW_STEPS = {
  submitted: {
    status: 'submitted',
    title: 'Prescription Submitted',
    allowedRoles: ['customer'],
    nextSteps: ['reviewing', 'approved', 'cancelled', 'suspended'],
    estimatedDuration: 0,
  },
  reviewing: {
    status: 'reviewing',
    title: 'Under Review',
    allowedRoles: ['prescription-reader', 'pharmacy', 'admin'],
    nextSteps: ['approved', 'rejected', 'suspended'],
    estimatedDuration: 2,
  },
  approved: {
    status: 'approved',
    title: 'Prescription Approved',
    allowedRoles: ['prescription-reader', 'pharmacy', 'admin'],
    nextSteps: ['cancelled'],
    estimatedDuration: 0,
  },
  rejected: {
    status: 'rejected',
    title: 'Prescription Rejected',
    allowedRoles: ['prescription-reader', 'pharmacy', 'admin'],
    nextSteps: ['submitted'],
    estimatedDuration: 0,
  },
  cancelled: {
    status: 'cancelled',
    title: 'Cancelled',
    allowedRoles: ['customer', 'pharmacy', 'admin'],
    nextSteps: [],
    estimatedDuration: 0,
  },
  suspended: {
    status: 'suspended',
    title: 'Suspended',
    allowedRoles: ['prescription-reader', 'pharmacy', 'admin'],
    nextSteps: ['reviewing', 'approved', 'rejected'],
    estimatedDuration: 4,
  }
};

const URGENCY_TIME_MULTIPLIERS = {
  routine: 1.5,
  normal: 1.0,
  urgent: 0.5
};

// Helper functions
const calculateEstimatedCompletion = (currentStatus, urgency, startTime = new Date()) => {
  const step = PRESCRIPTION_WORKFLOW_STEPS[currentStatus];
  const baseHours = step.estimatedDuration;
  const multiplier = URGENCY_TIME_MULTIPLIERS[urgency];
  const adjustedHours = baseHours * multiplier;

  const completion = new Date(startTime);
  completion.setHours(completion.getHours() + adjustedHours);
  return completion;
};

const canTransitionTo = (currentStatus, newStatus, userRole) => {
  const currentStep = PRESCRIPTION_WORKFLOW_STEPS[currentStatus];
  const newStep = PRESCRIPTION_WORKFLOW_STEPS[newStatus];

  return currentStep.nextSteps.includes(newStatus) && 
         newStep.allowedRoles.includes(userRole);
};

// GET all prescriptions
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, urgency, customerId, assignedReaderId, page = 1, limit = 20 } = req.query;
    
    let query = {};
    
    // Role-based filtering
    if (req.user.role === 'customer') {
      query.customerId = req.user.id;
    } else if (req.user.role === 'prescription-reader') {
      query.assignedReaderId = req.user.id;
    } else if (req.user.role === 'pharmacy') {
      query.assignedPharmacyId = req.user.id;
    }

    // Apply filters
    if (status) query.currentStatus = status;
    if (urgency) query.urgency = urgency;
    if (customerId && ['admin', 'prescription-reader'].includes(req.user.role)) {
      query.customerId = customerId;
    }
    if (assignedReaderId && req.user.role === 'admin') {
      query.assignedReaderId = assignedReaderId;
    }

    const prescriptions = await Prescription.find(query)
      .populate('customerId', 'name phone email')
      .populate('assignedPharmacyId', 'businessName phone')
      .populate('assignedReaderId', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Prescription.countDocuments(query);

    res.json({
      success: true,
      data: prescriptions,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: prescriptions.length,
        totalRecords: total
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET prescription by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.id)
      .populate('customerId', 'name phone email')
      .populate('assignedPharmacyId', 'businessName phone')
      .populate('assignedReaderId', 'name');

    if (!prescription) {
      return res.status(404).json({ success: false, error: 'Prescription not found' });
    }

    // Check authorization
    const isAuthorized = 
      req.user.role === 'admin' ||
      prescription.customerId._id.toString() === req.user.id ||
      prescription.assignedPharmacyId?.toString() === req.user.id ||
      prescription.assignedReaderId?.toString() === req.user.id;

    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: 'Not authorized to view this prescription' });
    }

    res.json({ success: true, data: prescription });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET prescriptions by customer ID
router.get('/customer/:customerId', authenticateToken, authorizeRoles(['admin', 'prescription-reader']), async (req, res) => {
  try {
    const prescriptions = await Prescription.find({ customerId: req.params.customerId })
      .populate('assignedPharmacyId', 'businessName')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: prescriptions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET prescriptions by status
router.get('/status/:status', authenticateToken, async (req, res) => {
  try {
    let query = { currentStatus: req.params.status };

    // Apply role-based filtering
    if (req.user.role === 'customer') {
      query.customerId = req.user.id;
    } else if (req.user.role === 'prescription-reader') {
      query.assignedReaderId = req.user.id;
    } else if (req.user.role === 'pharmacy') {
      query.assignedPharmacyId = req.user.id;
    }

    const prescriptions = await Prescription.find(query)
      .populate('customerId', 'name phone')
      .populate('assignedPharmacyId', 'businessName')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: prescriptions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST create new prescription (customer only)
router.post('/', authenticateToken, authorizeRoles(['customer']), upload.array('files', 5), async (req, res) => {
  try {
    const files = req.files ? req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      url: `/uploads/prescriptions/${file.filename}`,
      type: file.mimetype.startsWith('image/') ? 'image' : 'pdf',
      size: file.size
    })) : [];

    const prescriptionData = {
      ...req.body,
      customerId: req.user.id,
      customerName: req.user.name,
      customerPhone: req.user.phone,
      files,
      currentStatus: 'submitted',
      estimatedCompletion: calculateEstimatedCompletion('submitted', req.body.urgency || 'normal')
    };

    const prescription = new Prescription(prescriptionData);
    await prescription.save();

    res.status(201).json({ success: true, data: prescription });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT update prescription status
router.put('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { newStatus, notes } = req.body;
    const prescription = await Prescription.findById(req.params.id);

    if (!prescription) {
      return res.status(404).json({ success: false, error: 'Prescription not found' });
    }

    // Check if transition is allowed
    if (!canTransitionTo(prescription.currentStatus, newStatus, req.user.role)) {
      return res.status(400).json({ 
        success: false, 
        error: `Cannot transition from ${prescription.currentStatus} to ${newStatus} with role ${req.user.role}` 
      });
    }

    // Update status
    prescription.currentStatus = newStatus;
    prescription.statusHistory.push({
      status: newStatus,
      timestamp: new Date(),
      userId: req.user.id,
      userRole: req.user.role,
      userName: req.user.name,
      notes: notes || `Status updated to ${newStatus}`
    });

    // Update estimated completion if needed
    if (['reviewing', 'submitted'].includes(newStatus)) {
      prescription.estimatedCompletion = calculateEstimatedCompletion(
        newStatus,
        prescription.urgency
      );
    }

    if (newStatus === 'approved') {
      prescription.actualCompletion = new Date();
    }

    await prescription.save();

    res.json({ success: true, data: prescription });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT assign prescription to pharmacy/reader
router.put('/:id/assign', authenticateToken, authorizeRoles(['admin', 'prescription-reader']), async (req, res) => {
  try {
    const { assignedPharmacyId, assignedReaderId, assignedPharmacistId } = req.body;
    
    const prescription = await Prescription.findById(req.params.id);
    if (!prescription) {
      return res.status(404).json({ success: false, error: 'Prescription not found' });
    }

    if (assignedPharmacyId) prescription.assignedPharmacyId = assignedPharmacyId;
    if (assignedReaderId) prescription.assignedReaderId = assignedReaderId;
    if (assignedPharmacistId) prescription.assignedPharmacistId = assignedPharmacistId;

    prescription.statusHistory.push({
      status: prescription.currentStatus,
      timestamp: new Date(),
      userId: req.user.id,
      userRole: req.user.role,
      userName: req.user.name,
      notes: 'Prescription assigned'
    });

    await prescription.save();

    res.json({ success: true, data: prescription });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT add processed medicines
router.put('/:id/medicines', authenticateToken, authorizeRoles(['prescription-reader', 'pharmacy', 'admin']), async (req, res) => {
  try {
    const { processedMedicines } = req.body;
    
    const prescription = await Prescription.findById(req.params.id);
    if (!prescription) {
      return res.status(404).json({ success: false, error: 'Prescription not found' });
    }

    prescription.processedMedicines = processedMedicines;
    prescription.totalAmount = processedMedicines.reduce((sum, med) => sum + (med.price * med.quantity), 0);

    await prescription.save();

    res.json({ success: true, data: prescription });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST search prescriptions
router.post('/search', authenticateToken, async (req, res) => {
  try {
    const { query } = req.body;
    let searchQuery = {};

    // Role-based base query
    if (req.user.role === 'customer') {
      searchQuery.customerId = req.user.id;
    } else if (req.user.role === 'prescription-reader') {
      searchQuery.assignedReaderId = req.user.id;
    } else if (req.user.role === 'pharmacy') {
      searchQuery.assignedPharmacyId = req.user.id;
    }

    // Add search criteria
    if (query) {
      const searchRegex = new RegExp(query, 'i');
      searchQuery.$or = [
        { prescriptionNumber: searchRegex },
        { customerName: searchRegex },
        { customerPhone: searchRegex },
        { patientName: searchRegex },
        { doctorName: searchRegex },
        { hospitalClinic: searchRegex }
      ];
    }

    const prescriptions = await Prescription.find(searchQuery)
      .populate('customerId', 'name phone')
      .populate('assignedPharmacyId', 'businessName')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: prescriptions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET prescription analytics
router.get('/analytics/summary', authenticateToken, authorizeRoles(['admin', 'prescription-reader']), async (req, res) => {
  try {
    const total = await Prescription.countDocuments();
    
    const statusCounts = await Prescription.aggregate([
      { $group: { _id: '$currentStatus', count: { $sum: 1 } } }
    ]);

    const urgencyCounts = await Prescription.aggregate([
      { $group: { _id: '$urgency', count: { $sum: 1 } } }
    ]);

    const completedPrescriptions = await Prescription.find({ 
      currentStatus: 'approved',
      actualCompletion: { $exists: true }
    });

    let averageProcessingTime = 0;
    if (completedPrescriptions.length > 0) {
      const totalTime = completedPrescriptions.reduce((sum, prescription) => {
        const start = new Date(prescription.createdAt).getTime();
        const end = new Date(prescription.actualCompletion).getTime();
        return sum + (end - start);
      }, 0);
      averageProcessingTime = totalTime / completedPrescriptions.length / (1000 * 60 * 60); // Convert to hours
    }

    const approvedCount = await Prescription.countDocuments({ currentStatus: 'approved' });
    const completionRate = total > 0 ? (approvedCount / total) * 100 : 0;

    const analytics = {
      total,
      statusCounts: statusCounts.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      urgencyCounts: urgencyCounts.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      averageProcessingTime,
      completionRate
    };

    res.json({ success: true, data: analytics });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE prescription (admin only)
router.delete('/:id', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
  try {
    const prescription = await Prescription.findByIdAndDelete(req.params.id);
    if (!prescription) {
      return res.status(404).json({ success: false, error: 'Prescription not found' });
    }

    res.json({ success: true, message: 'Prescription deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;