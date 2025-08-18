const express = require('express');
const User = require('../models/User');
const Medicine = require('../models/Medicine');
const Pharmacy = require('../models/Pharmacy');
const Vendor = require('../models/Vendor');
const Order = require('../models/Order');
const Prescription = require('../models/Prescription');
const { auth, authorize } = require('../middleware/auth');

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

// Add medicine to big database
router.post('/medicines', auth, authorize('admin'), async (req, res) => {
  try {
    const medicineData = req.body;
    const medicine = new Medicine(medicineData);
    await medicine.save();

    res.status(201).json({ message: 'Medicine added successfully', medicine });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update medicine
router.put('/medicines/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const medicine = await Medicine.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!medicine) {
      return res.status(404).json({ message: 'Medicine not found' });
    }

    res.json({ message: 'Medicine updated successfully', medicine });
  } catch (error) {
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
      Medicine.countDocuments({ isActive: true }),
      Order.countDocuments(),
      Prescription.countDocuments(),
      Order.find().populate('customer', 'name').sort({ createdAt: -1 }).limit(10),
      Prescription.find({ status: { $in: ['uploaded', 'reading'] } })
        .populate('customer', 'name').sort({ createdAt: -1 }).limit(10)
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
      .populate('customer', 'name email phone')
      .populate('items.medicine', 'name brand')
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
      .populate('customer', 'name email phone')
      .populate('prescriptionReader', 'name')
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

module.exports = router;