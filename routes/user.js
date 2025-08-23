const express = require('express');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const { auth, authorize } = require('../middleware/auth');
const { uploadProfile, uploadVendorProduct, deleteImage, extractPublicId } = require('../config/cloudinary');

const router = express.Router();

// Upload profile image
router.post('/upload-profile-image', auth, uploadProfile.single('profileImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete old profile image if exists
    if (user.profileImage?.publicId) {
      try {
        await deleteImage(user.profileImage.publicId);
      } catch (error) {
        console.error('Error deleting old profile image:', error);
      }
    }

    // Update user with new profile image
    user.profileImage = {
      url: req.file.path,
      publicId: req.file.filename
    };

    await user.save();

    res.json({
      message: 'Profile image uploaded successfully',
      profileImage: user.profileImage
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete profile image
router.delete('/profile-image', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.profileImage?.publicId) {
      return res.status(400).json({ message: 'No profile image to delete' });
    }

    // Delete from Cloudinary
    await deleteImage(user.profileImage.publicId);

    // Remove from user document
    user.profileImage = undefined;
    await user.save();

    res.json({ message: 'Profile image deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update user profile - now includes WhatsApp
router.put('/profile', auth, async (req, res) => {
  try {
    console.log('request recieved')
    const { name, phone, whatsapp, address } = req.body;
    
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (whatsapp) user.whatsapp = whatsapp;
    if (address) user.address = address;

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        whatsapp: user.whatsapp,
        address: user.address,
        role: user.role,
        profileImage: user.profileImage,
        credits: user.role === 'customer' ? user.credits : undefined,
        // Include role-specific fields
        permissions: user.role === 'app-services' ? user.permissions : undefined,
        doctorLicense: user.role === 'doctor' ? user.doctorLicense : undefined,
        readerLicense: user.role === 'prescription-reader' ? user.readerLicense : undefined,
        pharmacyId: user.role === 'pharmacy' ? user.pharmacyId : undefined,
        vendorId: user.role === 'vendor' ? user.vendorId : undefined
      }
    });
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user profile - enhanced to include all role-specific data
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      whatsapp: user.whatsapp,
      address: user.address,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      profileImage: user.profileImage,
      credits: user.role === 'customer' ? user.credits : undefined,
      // Include role-specific fields
      permissions: user.role === 'app-services' ? user.permissions : undefined,
      doctorLicense: user.role === 'doctor' ? user.doctorLicense : undefined,
      readerLicense: user.role === 'prescription-reader' ? user.readerLicense : undefined,
      pharmacyId: user.role === 'pharmacy' ? user.pharmacyId : undefined,
      vendorId: user.role === 'vendor' ? user.vendorId : undefined,
      referralCode: user.role === 'doctor' ? user.referralCode : undefined
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user credits and history
router.get('/credits', auth, authorize('customer'), async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('creditHistory.orderId', 'orderNumber')
      .select('credits creditHistory');

    res.json({
      credits: user.credits,
      history: user.creditHistory
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 50) // Limit to recent 50 transactions
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Admin: Add credits to user (bonus credits)
router.post('/credits/add', auth, authorize('admin'), async (req, res) => {
  try {
    const { userId, amount, description = 'Admin bonus credits' } = req.body;

    if (amount <= 0) {
      return res.status(400).json({ message: 'Amount must be greater than 0' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role !== 'customer') {
      return res.status(400).json({ message: 'Credits can only be added to customer accounts' });
    }

    user.addCredits(amount, 'bonus', description);
    await user.save();

    res.json({ 
      message: 'Credits added successfully',
      newBalance: user.credits 
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Admin: Get all users with filtering
router.get('/admin/users', auth, authorize('admin'), async (req, res) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    
    let query = {};
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: users.length,
        totalUsers: total
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// App Services: Get users for customer service
router.get('/app-services/users', auth, authorize('app-services'), async (req, res) => {
  try {
    const { search, role = 'customer' } = req.query;
    
    let query = { role };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('name email phone whatsapp address isActive createdAt credits')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ users });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update user permissions (for app-services users)
router.put('/app-services/permissions/:userId', auth, authorize('admin'), async (req, res) => {
  try {
    const { permissions } = req.body;
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role !== 'app-services') {
      return res.status(400).json({ message: 'User must have app-services role' });
    }

    user.permissions = permissions;
    await user.save();

    res.json({ 
      message: 'Permissions updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create/Update vendor profile
router.post('/vendor-profile', auth, authorize('vendor'), async (req, res) => {
  try {
    const { businessName, businessLicense, address, phone, email } = req.body;

    let vendor = await Vendor.findOne({ owner: req.user._id });

    if (vendor) {
      // Update existing vendor
      vendor.businessName = businessName;
      vendor.businessLicense = businessLicense;
      vendor.address = address;
      vendor.phone = phone;
      vendor.email = email;
    } else {
      // Create new vendor
      vendor = new Vendor({
        owner: req.user._id,
        businessName,
        businessLicense,
        address,
        phone,
        email
      });
    }

    await vendor.save();
    res.json({ message: 'Vendor profile saved successfully', vendor });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Business license already exists' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add product to vendor catalog with images
router.post('/vendor-products', auth, authorize('vendor'), uploadVendorProduct.array('images', 5), async (req, res) => {
  try {
    const { name, category, description, price, quantity } = req.body;

    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) {
      return res.status(400).json({ message: 'Vendor profile not found' });
    }

    // Process uploaded images
    const images = req.files ? req.files.map(file => ({
      url: file.path,
      publicId: file.filename
    })) : [];

    vendor.products.push({
      name,
      category,
      description,
      price: parseFloat(price),
      quantity: parseInt(quantity),
      images
    });

    await vendor.save();
    res.json({ message: 'Product added successfully', images: images.length });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update vendor product (including images)
router.put('/vendor-products/:productId', auth, authorize('vendor'), uploadVendorProduct.array('images', 5), async (req, res) => {
  try {
    const { name, category, description, price, quantity, isActive, removeImages } = req.body;

    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) {
      return res.status(400).json({ message: 'Vendor profile not found' });
    }

    const product = vendor.products.id(req.params.productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Update basic fields
    if (name) product.name = name;
    if (category) product.category = category;
    if (description) product.description = description;
    if (price) product.price = parseFloat(price);
    if (quantity !== undefined) product.quantity = parseInt(quantity);
    if (isActive !== undefined) product.isActive = JSON.parse(isActive);

    // Handle image removal
    if (removeImages) {
      const imagesToRemove = JSON.parse(removeImages);
      for (const publicId of imagesToRemove) {
        try {
          await deleteImage(publicId);
          product.images = product.images.filter(img => img.publicId !== publicId);
        } catch (error) {
          console.error('Error removing image:', error);
        }
      }
    }

    // Handle new images
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => ({
        url: file.path,
        publicId: file.filename
      }));
      product.images.push(...newImages);
    }

    await vendor.save();
    res.json({ message: 'Product updated successfully', imagesCount: product.images.length });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get vendor products
router.get('/vendor-products', auth, authorize('vendor'), async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) {
      return res.status(400).json({ message: 'Vendor profile not found' });
    }

    res.json({ products: vendor.products });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete vendor product (including images)
router.delete('/vendor-products/:productId', auth, authorize('vendor'), async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) {
      return res.status(400).json({ message: 'Vendor profile not found' });
    }

    const product = vendor.products.id(req.params.productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Delete all product images from Cloudinary
    for (const image of product.images) {
      if (image.publicId) {
        try {
          await deleteImage(image.publicId);
        } catch (error) {
          console.error('Error deleting product image:', error);
        }
      }
    }

    // Remove product from vendor
    vendor.products.pull(req.params.productId);
    await vendor.save();

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get vendor profile
router.get('/vendor-profile', auth, authorize('vendor'), async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id })
      .populate('owner', 'name email phone whatsapp profileImage');

    if (!vendor) {
      return res.status(400).json({ message: 'Vendor profile not found' });
    }

    res.json(vendor);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Search vendors and their products (public)
router.get('/vendors/search', async (req, res) => {
  try {
    const { search, category, city, state } = req.query;
    let query = { isActive: true, isVerified: true };

    if (city) query['address.city'] = new RegExp(city, 'i');
    if (state) query['address.state'] = new RegExp(state, 'i');

    const vendors = await Vendor.find(query)
      .populate('owner', 'name profileImage')
      .select('businessName address phone products rating');

    // Filter products if search or category specified
    if (search || category) {
      vendors.forEach(vendor => {
        vendor.products = vendor.products.filter(product => {
          let matches = product.isActive;
          
          if (search) {
            matches = matches && (
              product.name.toLowerCase().includes(search.toLowerCase()) ||
              product.description.toLowerCase().includes(search.toLowerCase())
            );
          }
          
          if (category) {
            matches = matches && product.category.toLowerCase() === category.toLowerCase();
          }
          
          return matches;
        });
      });
    }

    res.json(vendors);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get doctor referrals (for doctors to track their referrals)
router.get('/doctor-referrals', auth, authorize('doctor'), async (req, res) => {
  try {
    const referrals = await User.find({ 
      referredBy: req.user._id,
      role: 'customer'
    }).select('name email phone whatsapp createdAt credits profileImage');

    res.json({
      referralCode: req.user.referralCode,
      totalReferrals: referrals.length,
      referrals
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all pharmacies (for app-services coordination)
router.get('/pharmacies', auth, authorize(['admin', 'app-services']), async (req, res) => {
  try {
    const pharmacies = await User.find({ 
      role: 'pharmacy',
      isActive: true 
    }).select('name email phone whatsapp pharmacyId address isActive createdAt');

    res.json({ pharmacies });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get app-services team members (for admin)
router.get('/app-services/team', auth, authorize('admin'), async (req, res) => {
  try {
    const team = await User.find({ 
      role: 'app-services',
      isActive: true 
    }).select('name email phone permissions isActive createdAt');

    res.json({ team });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Switch user role (development only - remove in production)
router.post('/switch-role', auth, async (req, res) => {
  try {
    const { role } = req.body;
    
    // Validate role
    const validRoles = [
      'customer', 'admin', 'pharmacy', 'doctor', 
      'prescription-reader', 'database-input', 'vendor', 'app-services'
    ];
    
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role specified' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.role = role;
    await user.save();

    res.json({
      message: 'Role switched successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        isActive: user.isActive,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;