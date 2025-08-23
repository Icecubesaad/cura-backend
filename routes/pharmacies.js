const express = require('express');
const router = express.Router();
const Pharmacy = require('../models/Pharmacy');
const Product = require('../models/Product');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// GET all pharmacies with filters
router.get('/', async (req, res) => {
  try {
    const { 
      cityId, 
      governorateId,
      specialty,
      isActive = 'true',
      isVerified,
      deliveryAvailable,
      page = 1, 
      limit = 20,
      search,
      language = 'en',
      sortBy = 'rating'
    } = req.query;
    
    let query = {};
    
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (isVerified !== undefined) query.isVerified = isVerified === 'true';
    if (cityId) query.cityId = cityId;
    if (governorateId) query.governorateId = governorateId;
    if (specialty) query.specialties = { $in: [specialty] };
    if (deliveryAvailable === 'true') query.deliveryService = true;
    
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      if (language === 'ar') {
        query.$or = [
          { nameAr: searchRegex },
          { addressAr: searchRegex }
        ];
      } else {
        query.$or = [
          { name: searchRegex },
          { 'address.street': searchRegex },
          { 'address.area': searchRegex },
          { 'address.city': searchRegex }
        ];
      }
    }

    // Sorting
    let sortOption = {};
    switch (sortBy) {
      case 'rating':
        sortOption.rating = -1;
        break;
      case 'name':
        sortOption.name = 1;
        break;
      case 'deliveryFee':
        sortOption.deliveryFee = 1;
        break;
      case 'distance':
        // Would need coordinates for this
        sortOption.name = 1;
        break;
      default:
        sortOption.rating = -1;
    }

    const pharmacies = await Pharmacy.find(query)
      .populate('owner', 'name email phone')
      .sort(sortOption)
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

// GET pharmacy by ID
router.get('/:id', async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id)
      .populate('owner', 'name email phone');
    
    if (!pharmacy) {
      return res.status(404).json({ success: false, error: 'Pharmacy not found' });
    }

    // Increment view count
    pharmacy.incrementViewCount();

    res.json({ success: true, data: pharmacy });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET pharmacies by city
router.get('/city/:cityId', async (req, res) => {
  try {
    const pharmacies = await Pharmacy.findByCity(req.params.cityId);
    res.json({ success: true, data: pharmacies });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET pharmacies by governorate
router.get('/governorate/:governorateId', async (req, res) => {
  try {
    const pharmacies = await Pharmacy.find({
      governorateId: req.params.governorateId,
      isActive: true,
      isVerified: true
    }).sort({ rating: -1 });

    res.json({ success: true, data: pharmacies });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET pharmacies by specialty
router.get('/specialty/:specialty', async (req, res) => {
  try {
    const pharmacies = await Pharmacy.find({
      specialties: { $in: [req.params.specialty] },
      isActive: true,
      isVerified: true
    }).sort({ rating: -1 });

    res.json({ success: true, data: pharmacies });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET nearby pharmacies
router.get('/nearby/location', async (req, res) => {
  try {
    const { lat, lng, maxDistance = 10000 } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ 
        success: false, 
        error: 'Latitude and longitude are required' 
      });
    }

    const pharmacies = await Pharmacy.findNearby(
      parseFloat(lat), 
      parseFloat(lng), 
      parseInt(maxDistance)
    );

    res.json({ success: true, data: pharmacies });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET pharmacies for customer location
router.get('/customer-location/available', async (req, res) => {
  try {
    const { cityId, governorateId } = req.query;
    
    if (!cityId && !governorateId) {
      return res.json({ success: true, data: [] });
    }

    let query = { isActive: true, isVerified: true };
    
    if (cityId) {
      query.cityId = cityId;
    } else if (governorateId) {
      query.governorateId = governorateId;
    }

    const pharmacies = await Pharmacy.find(query)
      .populate('owner', 'name phone')
      .sort({ rating: -1, name: 1 });

    res.json({ success: true, data: pharmacies });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST search pharmacies
router.post('/search', async (req, res) => {
  try {
    const { query, language = 'en' } = req.body;
    
    const pharmacies = await Pharmacy.aggregate([
      {
        $match: {
          isActive: true,
          $text: { $search: query }
        }
      },
      {
        $addFields: {
          score: { $meta: 'textScore' }
        }
      },
      {
        $sort: { score: -1, rating: -1 }
      }
    ]);

    res.json({ success: true, data: pharmacies });
  } catch (error) {
    // Fallback to regex search if text search fails
    try {
      const searchRegex = new RegExp(req.body.query, 'i');
      const pharmacies = await Pharmacy.find({
        isActive: true,
        $or: [
          { name: searchRegex },
          { nameAr: searchRegex },
          { 'address.street': searchRegex },
          { 'address.city': searchRegex }
        ]
      }).sort({ rating: -1 });

      res.json({ success: true, data: pharmacies });
    } catch (fallbackError) {
      res.status(500).json({ success: false, error: fallbackError.message });
    }
  }
});

// GET pharmacy statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const stats = await Pharmacy.getStatistics();
    res.json({ success: true, data: stats[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Pharmacy management routes (require authentication)

// POST create pharmacy (pharmacy owner or admin)
router.post('/', authenticateToken, authorizeRoles(['pharmacy', 'admin']), async (req, res) => {
  try {
    const pharmacyData = {
      ...req.body,
      owner: req.user.role === 'admin' ? req.body.owner : req.user.id,
      createdBy: req.user.id
    };

    // Check if pharmacy already exists for this owner
    if (req.user.role === 'pharmacy') {
      const existingPharmacy = await Pharmacy.findOne({ owner: req.user.id });
      if (existingPharmacy) {
        return res.status(400).json({ 
          success: false, 
          error: 'Pharmacy already exists for this user' 
        });
      }
    }

    const pharmacy = new Pharmacy(pharmacyData);
    await pharmacy.save();

    await pharmacy.populate('owner', 'name email phone');

    res.status(201).json({ success: true, data: pharmacy });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT update pharmacy (owner or admin)
router.put('/:id', authenticateToken, authorizeRoles(['pharmacy', 'admin']), async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    
    if (!pharmacy) {
      return res.status(404).json({ success: false, error: 'Pharmacy not found' });
    }

    // Check ownership
    if (req.user.role === 'pharmacy' && pharmacy.owner.toString() !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        error: 'Not authorized to update this pharmacy' 
      });
    }

    const updatedPharmacy = await Pharmacy.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user.id },
      { new: true, runValidators: true }
    ).populate('owner', 'name email phone');

    res.json({ success: true, data: updatedPharmacy });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST add review to pharmacy
router.post('/:id/reviews', authenticateToken, authorizeRoles(['customer']), async (req, res) => {
  try {
    const { rating, comment, aspects } = req.body;
    const pharmacy = await Pharmacy.findById(req.params.id);
    
    if (!pharmacy) {
      return res.status(404).json({ success: false, error: 'Pharmacy not found' });
    }

    // Check if user already reviewed this pharmacy
    const existingReview = pharmacy.reviews.find(
      review => review.user.toString() === req.user.id
    );

    if (existingReview) {
      return res.status(400).json({ 
        success: false, 
        error: 'You have already reviewed this pharmacy' 
      });
    }

    await pharmacy.addReview(req.user.id, rating, comment, aspects);

    res.status(201).json({ 
      success: true, 
      message: 'Review added successfully',
      data: { rating: pharmacy.rating, reviewCount: pharmacy.reviewCount }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT update pharmacy metrics (internal use)
router.put('/:id/metrics', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    
    if (!pharmacy) {
      return res.status(404).json({ success: false, error: 'Pharmacy not found' });
    }

    await pharmacy.updateMetrics(req.body);

    res.json({ success: true, data: pharmacy });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT update product statistics
router.put('/:id/product-stats', authenticateToken, authorizeRoles(['pharmacy', 'admin']), async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    
    if (!pharmacy) {
      return res.status(404).json({ success: false, error: 'Pharmacy not found' });
    }

    // Check ownership
    if (req.user.role === 'pharmacy' && pharmacy.owner.toString() !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        error: 'Not authorized to update this pharmacy' 
      });
    }

    await pharmacy.updateProductStatistics(req.body);

    res.json({ success: true, data: pharmacy });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE pharmacy (owner or admin)
router.delete('/:id', authenticateToken, authorizeRoles(['pharmacy', 'admin']), async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    
    if (!pharmacy) {
      return res.status(404).json({ success: false, error: 'Pharmacy not found' });
    }

    // Check ownership
    if (req.user.role === 'pharmacy' && pharmacy.owner.toString() !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        error: 'Not authorized to delete this pharmacy' 
      });
    }

    if (req.user.role === 'admin') {
      // Admin can permanently delete
      await Pharmacy.findByIdAndDelete(req.params.id);
    } else {
      // Pharmacy owner can only deactivate
      pharmacy.isActive = false;
      await pharmacy.save();
    }

    res.json({ success: true, message: 'Pharmacy deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;