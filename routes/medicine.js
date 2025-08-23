const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// GET medicine by ID with full details
router.get('/:id', async (req, res) => {
  try {
    const medicine = await Product.findById(req.params.id)
      .populate('pharmacyStocks.pharmacyId', 'businessName phone cityId coordinates rating');
    
    if (!medicine) {
      return res.status(404).json({ success: false, error: 'Medicine not found' });
    }

    // Transform to match frontend interface
    const extendedMedicine = {
      id: medicine._id,
      name: medicine.name,
      genericName: medicine.genericName,
      activeIngredient: medicine.activeIngredient,
      category: medicine.category,
      manufacturer: medicine.manufacturer,
      requiresPrescription: medicine.requiresPrescription,
      keywords: medicine.keywords || [],
      searchTerms: medicine.searchTerms || [],
      isPopular: medicine.isPopular,
      salesRank: medicine.salesRank,
      alternatives: medicine.alternatives || [],
      pharmacyMapping: {
        medicineId: medicine._id,
        pharmacyStocks: medicine.pharmacyStocks,
        totalPharmacies: medicine.totalPharmacies,
        averagePrice: medicine.averagePrice,
        lowestPrice: medicine.lowestPrice,
        highestPrice: medicine.highestPrice,
        availabilityPercentage: medicine.availabilityPercentage,
        lastPriceUpdate: medicine.updatedAt
      }
    };

    res.json({ success: true, data: extendedMedicine });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET all alternatives for a medicine
router.get('/:id/alternatives', async (req, res) => {
  try {
    const medicine = await Product.findById(req.params.id);
    if (!medicine) {
      return res.status(404).json({ success: false, error: 'Medicine not found' });
    }

    res.json({ 
      success: true, 
      data: medicine.alternatives || [] 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET pharmacy stock information for a medicine
router.get('/:id/stocks', async (req, res) => {
  try {
    const medicine = await Product.findById(req.params.id)
      .populate('pharmacyStocks.pharmacyId', 'businessName phone cityId coordinates');
    
    if (!medicine) {
      return res.status(404).json({ success: false, error: 'Medicine not found' });
    }

    res.json({ 
      success: true, 
      data: medicine.pharmacyStocks 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET available pharmacies for a medicine (in stock only)
router.get('/:id/available-pharmacies', async (req, res) => {
  try {
    const medicine = await Product.findById(req.params.id)
      .populate('pharmacyStocks.pharmacyId', 'businessName phone cityId coordinates');
    
    if (!medicine) {
      return res.status(404).json({ success: false, error: 'Medicine not found' });
    }

    const availableStocks = medicine.pharmacyStocks.filter(
      stock => stock.inStock && stock.stockQuantity > 0
    );

    res.json({ 
      success: true, 
      data: availableStocks 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET medicine pricing information
router.get('/:id/pricing', async (req, res) => {
  try {
    const medicine = await Product.findById(req.params.id);
    if (!medicine) {
      return res.status(404).json({ success: false, error: 'Medicine not found' });
    }

    const pricingInfo = {
      averagePrice: medicine.averagePrice || 0,
      lowestPrice: medicine.lowestPrice || 0,
      highestPrice: medicine.highestPrice || 0,
      availabilityPercentage: medicine.availabilityPercentage || 0
    };

    res.json({ 
      success: true, 
      data: pricingInfo 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET search medicines by various criteria
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const searchRegex = new RegExp(query, 'i');

    const medicines = await Product.find({
      isActive: true,
      $or: [
        { name: searchRegex },
        { genericName: searchRegex },
        { activeIngredient: searchRegex },
        { keywords: { $in: [searchRegex] } },
        { searchTerms: { $in: [searchRegex] } }
      ]
    }).populate('pharmacyStocks.pharmacyId', 'businessName cityId');

    res.json({ 
      success: true, 
      data: medicines,
      total: medicines.length 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET medicines by category
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const medicines = await Product.find({
      isActive: true,
      category: new RegExp(category, 'i')
    }).populate('pharmacyStocks.pharmacyId', 'businessName cityId');

    res.json({ 
      success: true, 
      data: medicines,
      total: medicines.length 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET popular medicines
router.get('/popular/all', async (req, res) => {
  try {
    const medicines = await Product.find({
      isActive: true,
      isPopular: true
    }).sort({ salesRank: 1 }).limit(20)
      .populate('pharmacyStocks.pharmacyId', 'businessName cityId');

    res.json({ 
      success: true, 
      data: medicines,
      total: medicines.length 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET check if medicine requires prescription
router.get('/:id/requires-prescription', async (req, res) => {
  try {
    const medicine = await Product.findById(req.params.id);
    if (!medicine) {
      return res.status(404).json({ success: false, error: 'Medicine not found' });
    }

    res.json({ 
      success: true, 
      data: { requiresPrescription: medicine.requiresPrescription || false }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET stock level for a medicine at a specific pharmacy
router.get('/:id/pharmacy/:pharmacyId/stock', async (req, res) => {
  try {
    const { id: medicineId, pharmacyId } = req.params;
    const medicine = await Product.findById(medicineId)
      .populate('pharmacyStocks.pharmacyId', 'businessName');

    if (!medicine) {
      return res.status(404).json({ success: false, error: 'Medicine not found' });
    }

    const stock = medicine.pharmacyStocks.find(
      stock => stock.pharmacyId._id.toString() === pharmacyId
    );

    if (!stock) {
      return res.status(404).json({ success: false, error: 'Stock not found for this pharmacy' });
    }

    res.json({ success: true, data: stock });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT update stock quantity for a medicine at a pharmacy
router.put('/:id/pharmacy/:pharmacyId/stock', authenticateToken, authorizeRoles(['pharmacy', 'admin']), async (req, res) => {
  try {
    const { id: medicineId, pharmacyId } = req.params;
    const { newQuantity } = req.body;

    // Check authorization
    if (req.user.role !== 'admin' && req.user.id !== pharmacyId) {
      return res.status(403).json({ success: false, error: 'Not authorized to update this stock' });
    }

    const medicine = await Product.findById(medicineId);
    if (!medicine) {
      return res.status(404).json({ success: false, error: 'Medicine not found' });
    }

    const stockIndex = medicine.pharmacyStocks.findIndex(
      stock => stock.pharmacyId.toString() === pharmacyId
    );

    if (stockIndex === -1) {
      return res.status(404).json({ success: false, error: 'Stock not found for this pharmacy' });
    }

    const stock = medicine.pharmacyStocks[stockIndex];
    stock.stockQuantity = newQuantity;
    stock.lastUpdated = new Date();

    // Update stock level based on quantity
    if (newQuantity === 0) {
      stock.stockLevel = 'out';
      stock.inStock = false;
    } else if (newQuantity <= (stock.reorderLevel || 10)) {
      stock.stockLevel = 'critical';
      stock.inStock = true;
    } else if (newQuantity <= (stock.reorderLevel || 10) * 2) {
      stock.stockLevel = 'low';
      stock.inStock = true;
    } else if (newQuantity <= (stock.maxStock || 100) * 0.7) {
      stock.stockLevel = 'medium';
      stock.inStock = true;
    } else {
      stock.stockLevel = 'high';
      stock.inStock = true;
    }

    medicine.updatePricingSummary();
    await medicine.save();

    res.json({ success: true, data: stock });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET medicines that need restocking
router.get('/restock/needed', authenticateToken, authorizeRoles(['pharmacy', 'admin']), async (req, res) => {
  try {
    const query = req.user.role === 'admin' 
      ? {} 
      : { 'pharmacyStocks.pharmacyId': req.user.id };

    const medicines = await Product.find({
      isActive: true,
      ...query
    }).populate('pharmacyStocks.pharmacyId', 'businessName');

    const needingRestock = [];
    
    medicines.forEach(medicine => {
      medicine.pharmacyStocks.forEach(stock => {
        if (req.user.role === 'admin' || stock.pharmacyId._id.toString() === req.user.id) {
          if (stock.stockQuantity <= (stock.reorderLevel || 10)) {
            needingRestock.push({
              medicine: {
                id: medicine._id,
                name: medicine.name,
                category: medicine.category
              },
              pharmacy: stock
            });
          }
        }
      });
    });

    res.json({ 
      success: true, 
      data: needingRestock,
      total: needingRestock.length 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST add alternative medicine
router.post('/:id/alternatives', authenticateToken, authorizeRoles(['pharmacy', 'admin']), async (req, res) => {
  try {
    const medicine = await Product.findById(req.params.id);
    if (!medicine) {
      return res.status(404).json({ success: false, error: 'Medicine not found' });
    }

    medicine.alternatives.push(req.body);
    await medicine.save();

    res.status(201).json({ success: true, data: medicine.alternatives });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE remove alternative medicine
router.delete('/:id/alternatives/:altId', authenticateToken, authorizeRoles(['pharmacy', 'admin']), async (req, res) => {
  try {
    const medicine = await Product.findById(req.params.id);
    if (!medicine) {
      return res.status(404).json({ success: false, error: 'Medicine not found' });
    }

    medicine.alternatives.pull({ _id: req.params.altId });
    await medicine.save();

    res.json({ success: true, message: 'Alternative removed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;