const express = require('express');
const Medicine = require('../models/Medicine');
const Pharmacy = require('../models/Pharmacy');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// Get all medicines (big database)
router.get('/', async (req, res) => {
  try {
    const { search, category, form, page = 1, limit = 20 } = req.query;
    let query = { isActive: true };

    if (search) {
      query.$text = { $search: search };
    }

    if (category) {
      query.category = category;
    }

    if (form) {
      query.form = form;
    }

    const medicines = await Medicine.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ name: 1 });

    const total = await Medicine.countDocuments(query);

    res.json({
      medicines,
      totalPages: Math.ceil(total / limit),
      currentPage: page
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get medicine by ID with availability in pharmacies
router.get('/:id', async (req, res) => {
  try {
    const medicine = await Medicine.findById(req.params.id);
    if (!medicine) {
      return res.status(404).json({ message: 'Medicine not found' });
    }

    // Find pharmacies that have this medicine in stock
    const pharmacies = await Pharmacy.find({
      'inventory.medicine': medicine._id,
      'inventory.quantity': { $gt: 0 },
      'inventory.expiryDate': { $gt: new Date() },
      isActive: true,
      isVerified: true
    }).populate('owner', 'name email phone')
    .select('name address phone inventory rating');

    // Filter inventory to show only this medicine
    const pharmaciesWithMedicine = pharmacies.map(pharmacy => {
      const medicineInventory = pharmacy.inventory.find(
        item => item.medicine.toString() === medicine._id.toString()
      );
      return {
        ...pharmacy.toObject(),
        inventory: [medicineInventory]
      };
    });

    res.json({
      medicine,
      availableAt: pharmaciesWithMedicine
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Search medicines for alternatives (used by prescription readers)
router.get('/search/alternatives', auth, authorize('prescription_reader'), async (req, res) => {
  try {
    const { search, excludeIds } = req.query;
    let query = { isActive: true };

    if (search) {
      query.$text = { $search: search };
    }

    if (excludeIds) {
      const idsArray = excludeIds.split(',');
      query._id = { $nin: idsArray };
    }

    const medicines = await Medicine.find(query)
      .limit(50)
      .sort({ name: 1 })
      .select('name genericName brand strength form category');

    res.json(medicines);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get medicine categories
router.get('/meta/categories', async (req, res) => {
  try {
    const categories = await Medicine.distinct('category', { isActive: true });
    const forms = await Medicine.distinct('form', { isActive: true });
    
    res.json({ categories, forms });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;