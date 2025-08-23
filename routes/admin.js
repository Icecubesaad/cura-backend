const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Pharmacy = require('../models/Pharmacy');
const Vendor = require('../models/Vendor');
const AdminSettings = require('../models/Admin');
const { Governorate, City } = require('../models/Location');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Admin authentication middleware
const adminOnly = [authenticateToken, authorizeRoles(['admin'])];

// =================== USER MANAGEMENT ===================

// GET all users with filters
router.get('/users', ...adminOnly, async (req, res) => {
  try {
    const { role, isActive, isVerified, page = 1, limit = 20, search } = req.query;
    
    let query = {};
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (isVerified !== undefined) query.isVerified = isVerified === 'true';
    
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { businessName: searchRegex }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: users,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: users.length,
        totalRecords: total
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET user by ID
router.get('/users/:id', ...adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Get additional details based on user role
    let additionalData = {};
    if (user.role === 'pharmacy') {
      additionalData.pharmacy = await Pharmacy.findOne({ owner: user._id });
    } else if (user.role === 'vendor') {
      additionalData.vendor = await Vendor.findOne({ owner: user._id });
    }

    res.json({ success: true, data: { ...user.toObject(), ...additionalData } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST create user
router.post('/users', ...adminOnly, async (req, res) => {
  try {
    const userData = { ...req.body };
    
    // Check if email already exists
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'Email already exists' });
    }

    const user = new User(userData);
    await user.save();

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({ success: true, data: userResponse });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT update user
router.put('/users/:id', ...adminOnly, async (req, res) => {
  try {
    const updateData = { ...req.body };
    delete updateData.password; // Prevent password updates through this route

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT activate/deactivate user
router.put('/users/:id/status', ...adminOnly, async (req, res) => {
  try {
    const { isActive } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT verify user
router.put('/users/:id/verify', ...adminOnly, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { 
        isVerified: true,
        emailVerifiedAt: new Date()
      },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE user
router.delete('/users/:id', ...adminOnly, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Also delete related pharmacy/vendor data
    if (user.role === 'pharmacy') {
      await Pharmacy.findOneAndDelete({ owner: user._id });
    } else if (user.role === 'vendor') {
      await Vendor.findOneAndDelete({ owner: user._id });
    }

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =================== PHARMACY MANAGEMENT ===================

// GET all pharmacies
router.get('/pharmacies', ...adminOnly, async (req, res) => {
  try {
    const { isActive, isVerified, cityId, page = 1, limit = 20, search } = req.query;
    
    let query = {};
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (isVerified !== undefined) query.isVerified = isVerified === 'true';
    if (cityId) query.cityId = cityId;
    
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { name: searchRegex },
        { nameAr: searchRegex },
        { phone: searchRegex },
        { email: searchRegex },
        { licenseNumber: searchRegex }
      ];
    }

    const pharmacies = await Pharmacy.find(query)
      .populate('owner', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Pharmacy.countDocuments(query);

    res.json({
      success: true,
      data: pharmacies,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: pharmacies.length,
        totalRecords: total
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT update pharmacy
router.put('/pharmacies/:id', ...adminOnly, async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user.id },
      { new: true, runValidators: true }
    ).populate('owner', 'name email');

    if (!pharmacy) {
      return res.status(404).json({ success: false, error: 'Pharmacy not found' });
    }

    res.json({ success: true, data: pharmacy });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT verify pharmacy
router.put('/pharmacies/:id/verify', ...adminOnly, async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findByIdAndUpdate(
      req.params.id,
      { 
        isVerified: true,
        verifiedAt: new Date(),
        verifiedBy: req.user.id,
        verificationStatus: 'verified'
      },
      { new: true }
    );

    if (!pharmacy) {
      return res.status(404).json({ success: false, error: 'Pharmacy not found' });
    }

    res.json({ success: true, data: pharmacy });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE pharmacy
router.delete('/pharmacies/:id', ...adminOnly, async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findByIdAndDelete(req.params.id);
    if (!pharmacy) {
      return res.status(404).json({ success: false, error: 'Pharmacy not found' });
    }

    res.json({ success: true, message: 'Pharmacy deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =================== VENDOR MANAGEMENT ===================

// GET all vendors
router.get('/vendors', ...adminOnly, async (req, res) => {
  try {
    const { vendorType, isActive, isVerified, page = 1, limit = 20, search } = req.query;
    
    let query = {};
    if (vendorType) query.vendorType = vendorType;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (isVerified !== undefined) query.isVerified = isVerified === 'true';
    
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { vendorName: searchRegex },
        { vendorNameAr: searchRegex },
        { phone: searchRegex },
        { email: searchRegex },
        { vendorCode: searchRegex }
      ];
    }

    const vendors = await Vendor.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Vendor.countDocuments(query);

    res.json({
      success: true,
      data: vendors,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: vendors.length,
        totalRecords: total
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST create vendor
router.post('/vendors', ...adminOnly, async (req, res) => {
  try {
    const vendor = new Vendor(req.body);
    await vendor.save();

    res.status(201).json({ success: true, data: vendor });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT update vendor
router.put('/vendors/:id', ...adminOnly, async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!vendor) {
      return res.status(404).json({ success: false, error: 'Vendor not found' });
    }

    res.json({ success: true, data: vendor });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT verify vendor
router.put('/vendors/:id/verify', ...adminOnly, async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      { 
        isVerified: true,
        verifiedAt: new Date(),
        verifiedBy: req.user.id
      },
      { new: true }
    );

    if (!vendor) {
      return res.status(404).json({ success: false, error: 'Vendor not found' });
    }

    res.json({ success: true, data: vendor });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE vendor
router.delete('/vendors/:id', ...adminOnly, async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndDelete(req.params.id);
    if (!vendor) {
      return res.status(404).json({ success: false, error: 'Vendor not found' });
    }

    res.json({ success: true, message: 'Vendor deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =================== LOCATION MANAGEMENT ===================

// GET all governorates
router.get('/governorates', ...adminOnly, async (req, res) => {
  try {
    const governorates = await Governorate.find().sort({ nameEn: 1 });
    res.json({ success: true, data: governorates });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST create governorate
router.post('/governorates', ...adminOnly, async (req, res) => {
  try {
    const governorate = new Governorate(req.body);
    await governorate.save();

    res.status(201).json({ success: true, data: governorate });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT enable/disable governorate
router.put('/governorates/:id/toggle', ...adminOnly, async (req, res) => {
  try {
    const governorate = await Governorate.findById(req.params.id);
    if (!governorate) {
      return res.status(404).json({ success: false, error: 'Governorate not found' });
    }

    if (governorate.isEnabled) {
      governorate.disable();
    } else {
      governorate.enable(req.user.id);
    }

    await governorate.save();
    res.json({ success: true, data: governorate });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET all cities
router.get('/cities', ...adminOnly, async (req, res) => {
  try {
    const { governorateId } = req.query;
    let query = {};
    if (governorateId) query.governorateId = governorateId;

    const cities = await City.find(query)
      .populate('governorateId', 'nameEn nameAr')
      .sort({ nameEn: 1 });

    res.json({ success: true, data: cities });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST create city
router.post('/cities', ...adminOnly, async (req, res) => {
  try {
    const city = new City({ 
      ...req.body,
      enabledBy: req.user.id 
    });
    await city.save();

    res.status(201).json({ success: true, data: city });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT enable/disable city
router.put('/cities/:id/toggle', ...adminOnly, async (req, res) => {
  try {
    const city = await City.findById(req.params.id);
    if (!city) {
      return res.status(404).json({ success: false, error: 'City not found' });
    }

    if (city.isEnabled) {
      city.disable();
    } else {
      city.enable(req.user.id);
    }

    await city.save();
    res.json({ success: true, data: city });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =================== ADMIN SETTINGS ===================

// GET admin settings
router.get('/settings', ...adminOnly, async (req, res) => {
  try {
    let settings = await AdminSettings.findOne();
    
    if (!settings) {
      // Create default settings if none exist
      settings = new AdminSettings({
        enabledGovernorateIds: ['ismailia'],
        enabledCityIds: ['ismailia-city'],
        defaultCity: 'ismailia-city',
        updatedBy: req.user.id
      });
      await settings.save();
    }

    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT update admin settings
router.put('/settings', ...adminOnly, async (req, res) => {
  try {
    let settings = await AdminSettings.findOne();
    
    if (!settings) {
      settings = new AdminSettings({
        ...req.body,
        updatedBy: req.user.id
      });
    } else {
      Object.assign(settings, {
        ...req.body,
        lastUpdated: new Date(),
        updatedBy: req.user.id
      });
    }

    await settings.save();

    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =================== ANALYTICS AND REPORTS ===================

// GET dashboard analytics
router.get('/analytics/dashboard', ...adminOnly, async (req, res) => {
  try {
    const [
      totalUsers,
      totalPharmacies,
      totalVendors,
      activeUsers,
      verifiedPharmacies,
      verifiedVendors
    ] = await Promise.all([
      User.countDocuments(),
      Pharmacy.countDocuments(),
      Vendor.countDocuments(),
      User.countDocuments({ isActive: true }),
      Pharmacy.countDocuments({ isVerified: true }),
      Vendor.countDocuments({ isVerified: true })
    ]);

    // User distribution by role
    const usersByRole = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    // Recent registrations (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentRegistrations = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    const analytics = {
      overview: {
        totalUsers,
        totalPharmacies,
        totalVendors,
        activeUsers,
        verifiedPharmacies,
        verifiedVendors,
        recentRegistrations
      },
      usersByRole: usersByRole.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      verificationRates: {
        pharmacies: totalPharmacies > 0 ? (verifiedPharmacies / totalPharmacies) * 100 : 0,
        vendors: totalVendors > 0 ? (verifiedVendors / totalVendors) * 100 : 0
      }
    };

    res.json({ success: true, data: analytics });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;