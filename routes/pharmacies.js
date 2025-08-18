const express = require('express');
const Pharmacy = require('../models/Pharmacy');
const Medicine = require('../models/Medicine');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// Create/Update pharmacy profile
router.post('/profile', auth, authorize('pharmacy'), async (req, res) => {
  try {
    const { name, licenseNumber, address, phone, email, operatingHours } = req.body;

    let pharmacy = await Pharmacy.findOne({ owner: req.user._id });

    if (pharmacy) {
      // Update existing pharmacy
      pharmacy.name = name;
      pharmacy.licenseNumber = licenseNumber;
      pharmacy.address = address;
      pharmacy.phone = phone;
      pharmacy.email = email;
      pharmacy.operatingHours = operatingHours;
    } else {
      // Create new pharmacy
      pharmacy = new Pharmacy({
        owner: req.user._id,
        name,
        licenseNumber,
        address,
        phone,
        email,
        operatingHours
      });
    }

    await pharmacy.save();
    res.json({ message: 'Pharmacy profile saved successfully', pharmacy });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'License number already exists' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add medicine to inventory
router.post('/inventory', auth, authorize('pharmacy'), async (req, res) => {
  try {
    const { medicineId, quantity, price, expiryDate, batchNumber } = req.body;

    const pharmacy = await Pharmacy.findOne({ owner: req.user._id });
    if (!pharmacy) {
      return res.status(400).json({ message: 'Pharmacy profile not found' });
    }

    const medicine = await Medicine.findById(medicineId);
    if (!medicine) {
      return res.status(404).json({ message: 'Medicine not found' });
    }

    // Check if medicine already exists in inventory
    const existingInventoryIndex = pharmacy.inventory.findIndex(
      item => item.medicine.toString() === medicineId && item.batchNumber === batchNumber
    );

    if (existingInventoryIndex > -1) {
      // Update existing inventory
      pharmacy.inventory[existingInventoryIndex].quantity += quantity;
      pharmacy.inventory[existingInventoryIndex].price = price;
      pharmacy.inventory[existingInventoryIndex].expiryDate = expiryDate;
    } else {
      // Add new inventory item
      pharmacy.inventory.push({
        medicine: medicineId,
        quantity,
        price,
        expiryDate,
        batchNumber
      });
    }

    await pharmacy.save();
    res.json({ message: 'Medicine added to inventory successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get pharmacy inventory
router.get('/inventory', auth, authorize('pharmacy'), async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findOne({ owner: req.user._id })
      .populate('inventory.medicine', 'name brand strength form category');

    if (!pharmacy) {
      return res.status(400).json({ message: 'Pharmacy profile not found' });
    }

    // Filter out expired medicines
    const activeInventory = pharmacy.inventory.filter(
      item => item.expiryDate > new Date() && item.quantity > 0
    );

    res.json({ inventory: activeInventory });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update inventory item
router.put('/inventory/:itemId', auth, authorize('pharmacy'), async (req, res) => {
  try {
    const { quantity, price, expiryDate } = req.body;
    const { itemId } = req.params;

    const pharmacy = await Pharmacy.findOne({ owner: req.user._id });
    if (!pharmacy) {
      return res.status(400).json({ message: 'Pharmacy profile not found' });
    }

    const inventoryItem = pharmacy.inventory.id(itemId);
    if (!inventoryItem) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    inventoryItem.quantity = quantity;
    inventoryItem.price = price;
    inventoryItem.expiryDate = expiryDate;

    await pharmacy.save();
    res.json({ message: 'Inventory updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get pharmacy profile
router.get('/profile', auth, authorize('pharmacy'), async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findOne({ owner: req.user._id })
      .populate('owner', 'name email phone');

    if (!pharmacy) {
      return res.status(400).json({ message: 'Pharmacy profile not found' });
    }

    res.json(pharmacy);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Search pharmacies by location (public)
router.get('/search', async (req, res) => {
  try {
    const { city, state, medicineId } = req.query;
    let query = { isActive: true, isVerified: true };

    if (city) query['address.city'] = new RegExp(city, 'i');
    if (state) query['address.state'] = new RegExp(state, 'i');

    if (medicineId) {
      query['inventory.medicine'] = medicineId;
      query['inventory.quantity'] = { $gt: 0 };
      query['inventory.expiryDate'] = { $gt: new Date() };
    }

    const pharmacies = await Pharmacy.find(query)
      .populate('owner', 'name')
      .select('name address phone operatingHours rating inventory')
      .sort({ rating: -1 });

    res.json(pharmacies);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all pharmacies (admin)
router.get('/all', auth, authorize('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    let query = {};

    if (status) {
      if (status === 'verified') query.isVerified = true;
      if (status === 'unverified') query.isVerified = false;
      if (status === 'active') query.isActive = true;
      if (status === 'inactive') query.isActive = false;
    }

    const pharmacies = await Pharmacy.find(query)
      .populate('owner', 'name email phone')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Pharmacy.countDocuments(query);

    res.json({
      pharmacies,
      totalPages: Math.ceil(total / limit),
      currentPage: page
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;