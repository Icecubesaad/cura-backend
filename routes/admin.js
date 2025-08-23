const express = require('express');
const User = require('../models/User');
const Pharmacy = require('../models/Pharmacy');
const Vendor = require('../models/Vendor');
const Order = require('../models/Order');
const Product = require('../models/Product')
const Prescription = require('../models/Prescription');
const { auth, authorize } = require('../middleware/auth');
const { uploadMedicine, deleteImage } = require('../config/cloudinary');

const router = express.Router();

// Generate referral code for doctors
const generateReferralCode = () => {
  return Math.random().toString(36).substr(2, 8).toUpperCase();
};

// Create accounts (doctors, prescription readers, etc.)
router.post('/create-account', auth, authorize('admin'), async (req, res) => {
  try {
    const { name, email, password, phone, role, additionalInfo } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const userData = { name, email, password, phone, role };

    // Generate referral code for doctors
    if (role === 'doctor') {
      userData.referralCode = generateReferralCode();
    }

    // Add additional info to address if provided
    if (additionalInfo && additionalInfo.address) {
      userData.address = additionalInfo.address;
    }

    const user = new User(userData);
    await user.save();

    res.status(201).json({
      message: 'Account created successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        referralCode: user.referralCode
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all users by role
router.get('/users/:role', auth, authorize('admin'), async (req, res) => {
  try {
    const { role } = req.params;
    const { page = 1, limit = 20, search } = req.query;

    let query = { role };
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: page
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Toggle user status (activate/deactivate)
router.put('/users/:userId/toggle-status', auth, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({ 
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: user.isActive
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add medicine to big database with image upload
router.post('/medicines', auth, authorize('admin'), uploadMedicine.single('medicineImage'), async (req, res) => {
  try {
    const medicineData = req.body;

    // Handle image upload
    if (req.file) {
      medicineData.image = {
        url: req.file.path,
        publicId: req.file.filename
      };
    }

    const medicine = new Product(medicineData);
    await medicine.save();

    res.status(201).json({ message: 'Medicine added successfully', medicine });
  } catch (error) {
    // Clean up uploaded image if database save fails
    if (req.file) {
      try {
        await deleteImage(req.file.filename);
      } catch (cleanupError) {
        console.error('Error cleaning up uploaded image:', cleanupError);
      }
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update medicine with optional image update
router.put('/medicines/:id', auth, authorize('admin'), uploadMedicine.single('medicineImage'), async (req, res) => {
  try {
    const medicine = await Product.findById(req.params.id);
    if (!medicine) {
      return res.status(404).json({ message: 'Medicine not found' });
    }

    // Update basic fields
    Object.keys(req.body).forEach(key => {
      if (key !== 'image') {
        medicine[key] = req.body[key];
      }
    });

    // Handle new image upload
    if (req.file) {
      // Delete old image if exists
      if (medicine.image?.publicId) {
        try {
          await deleteImage(medicine.image.publicId);
        } catch (error) {
          console.error('Error deleting old medicine image:', error);
        }
      }

      // Set new image
      medicine.image = {
        url: req.file.path,
        publicId: req.file.filename
      };
    }

    await medicine.save();

    res.json({ message: 'Medicine updated successfully', medicine });
  } catch (error) {
    // Clean up uploaded image if database save fails
    if (req.file) {
      try {
        await deleteImage(req.file.filename);
      } catch (cleanupError) {
        console.error('Error cleaning up uploaded image:', cleanupError);
      }
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete medicine image
router.delete('/medicines/:id/image', auth, authorize('admin'), async (req, res) => {
  try {
    const medicine = await Product.findById(req.params.id);
    if (!medicine) {
      return res.status(404).json({ message: 'Medicine not found' });
    }

    if (!medicine.image?.publicId) {
      return res.status(400).json({ message: 'No image to delete' });
    }

    // Delete from Cloudinary
    await deleteImage(medicine.image.publicId);

    // Remove from medicine document
    medicine.image = undefined;
    await medicine.save();

    res.json({ message: 'Medicine image deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete medicine completely
router.delete('/medicines/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const medicine = await Product.findById(req.params.id);
    if (!medicine) {
      return res.status(404).json({ message: 'Medicine not found' });
    }

    // Delete image from Cloudinary if exists
    if (medicine.image?.publicId) {
      try {
        await deleteImage(medicine.image.publicId);
      } catch (error) {
        console.error('Error deleting medicine image:', error);
      }
    }

    await Product.findByIdAndDelete(req.params.id);

    res.json({ message: 'Medicine deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Bulk upload medicines with images (for CSV imports, etc.)
router.post('/medicines/bulk-upload', auth, authorize('admin'), uploadMedicine.array('images'), async (req, res) => {
  try {
    const { medicines } = req.body; // Array of medicine data
    let parsedMedicines;

    try {
      parsedMedicines = JSON.parse(medicines);
    } catch (error) {
      return res.status(400).json({ message: 'Invalid medicines data format' });
    }

    const results = {
      success: [],
      failed: [],
      total: parsedMedicines.length
    };

    // Map images by their original names or indices
    const imageMap = new Map();
    if (req.files) {
      req.files.forEach((file, index) => {
        imageMap.set(file.originalname, {
          url: file.path,
          publicId: file.filename
        });
        imageMap.set(index.toString(), {
          url: file.path,
          publicId: file.filename
        });
      });
    }

    for (let i = 0; i < parsedMedicines.length; i++) {
      try {
        const medicineData = parsedMedicines[i];

        // Assign image if available
        if (medicineData.imageIndex !== undefined) {
          const image = imageMap.get(medicineData.imageIndex.toString());
          if (image) {
            medicineData.image = image;
          }
        } else if (medicineData.imageName) {
          const image = imageMap.get(medicineData.imageName);
          if (image) {
            medicineData.image = image;
          }
        }

        const medicine = new Product(medicineData);
        await medicine.save();
        
        results.success.push({
          index: i,
          name: medicine.name,
          id: medicine._id
        });
      } catch (error) {
        results.failed.push({
          index: i,
          name: parsedMedicines[i].name || 'Unknown',
          error: error.message
        });
      }
    }

    res.json({
      message: 'Bulk upload completed',
      results
    });
  } catch (error) {
    // Clean up all uploaded images if bulk operation fails
    if (req.files) {
      for (const file of req.files) {
        try {
          await deleteImage(file.filename);
        } catch (cleanupError) {
          console.error('Error cleaning up uploaded image:', cleanupError);
        }
      }
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Verify pharmacy
router.put('/pharmacies/:id/verify', auth, authorize('admin'), async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) {
      return res.status(404).json({ message: 'Pharmacy not found' });
    }

    pharmacy.isVerified = true;
    await pharmacy.save();

    res.json({ message: 'Pharmacy verified successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Verify vendor
router.put('/vendors/:id/verify', auth, authorize('admin'), async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    vendor.isVerified = true;
    await vendor.save();

    res.json({ message: 'Vendor verified successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Dashboard statistics
router.get('/dashboard-stats', auth, authorize('admin'), async (req, res) => {
  try {
    const [
      totalUsers,
      totalPharmacies,
      totalVendors,
      totalMedicines,
      totalOrders,
      totalPrescriptions,
      recentOrders,
      pendingPrescriptions
    ] = await Promise.all([
      User.countDocuments({ role: { $in: ['customer', 'pharmacy', 'vendor', 'doctor'] } }),
      Pharmacy.countDocuments(),
      Vendor.countDocuments(),
      Product.countDocuments({ isActive: true }),
      Order.countDocuments(),
      Prescription.countDocuments(),
      Order.find().populate('customer', 'name profileImage').sort({ createdAt: -1 }).limit(10),
      Prescription.find({ status: { $in: ['uploaded', 'reading'] } })
        .populate('customer', 'name profileImage').sort({ createdAt: -1 }).limit(10)
    ]);

    const stats = {
      totalUsers,
      totalPharmacies,
      totalVendors,
      totalMedicines,
      totalOrders,
      totalPrescriptions,
      recentOrders,
      pendingPrescriptions
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all orders (admin view)
router.get('/orders', auth, authorize('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    let query = {};

    if (status) {
      query.overallStatus = status;
    }

    const orders = await Order.find(query)
      .populate('customer', 'name email phone profileImage')
      .populate('items.medicine', 'name brand image')
      .populate('pharmacyOrders.pharmacy', 'name')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Order.countDocuments(query);

    res.json({
      orders,
      totalPages: Math.ceil(total / limit),
      currentPage: page
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all prescriptions (admin view)
router.get('/prescriptions', auth, authorize('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    let query = {};

    if (status) {
      query.status = status;
    }

    const prescriptions = await Prescription.find(query)
      .populate('customer', 'name email phone profileImage')
      .populate('prescriptionReader', 'name profileImage')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Prescription.countDocuments(query);

    res.json({
      prescriptions,
      totalPages: Math.ceil(total / limit),
      currentPage: page
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Admin: Get user credit statistics
router.get('/credits/stats', auth, authorize('admin'), async (req, res) => {
  try {
    const stats = await User.aggregate([
      { $match: { role: 'customer' } },
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          totalCredits: { $sum: '$credits' },
          averageCredits: { $avg: '$credits' },
          maxCredits: { $max: '$credits' },
          usersWithCredits: {
            $sum: {
              $cond: [{ $gt: ['$credits', 0] }, 1, 0]
            }
          }
        }
      }
    ]);

    // Get top credit holders
    const topUsers = await User.find({ role: 'customer' })
      .sort({ credits: -1 })
      .limit(10)
      .select('name email credits profileImage');

    res.json({
      stats: stats[0] || {
        totalUsers: 0,
        totalCredits: 0,
        averageCredits: 0,
        maxCredits: 0,
        usersWithCredits: 0
      },
      topUsers
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;