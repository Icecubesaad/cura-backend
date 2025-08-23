const express = require('express');
const router = express.Router();
const { Governorate, City } = require('../models/Location');
const AdminSettings = require('../models/Admin');

// GET all governorates
router.get('/governorates', async (req, res) => {
  try {
    const { enabled } = req.query;
    let query = {};
    
    if (enabled === 'true') {
      query.isEnabled = true;
    }

    const governorates = await Governorate.find(query).sort({ nameEn: 1 });
    res.json({ success: true, data: governorates });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET governorate by ID
router.get('/governorates/:id', async (req, res) => {
  try {
    const governorate = await Governorate.findOne({
      $or: [{ _id: req.params.id }, { code: req.params.id }]
    });

    if (!governorate) {
      return res.status(404).json({ success: false, error: 'Governorate not found' });
    }

    res.json({ success: true, data: governorate });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET enabled governorates
router.get('/governorates/enabled/all', async (req, res) => {
  try {
    const governorates = await Governorate.find({ isEnabled: true }).sort({ nameEn: 1 });
    res.json({ success: true, data: governorates });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET all cities
router.get('/cities', async (req, res) => {
  try {
    const { enabled, governorateId, search, language = 'en' } = req.query;
    let query = {};
    
    if (enabled === 'true') {
      query.isEnabled = true;
    }
    
    if (governorateId) {
      query.governorateId = governorateId;
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      if (language === 'ar') {
        query.$or = [
          { nameAr: searchRegex },
          { governorateNameAr: searchRegex }
        ];
      } else {
        query.$or = [
          { nameEn: searchRegex },
          { governorateName: searchRegex }
        ];
      }
    }

    const cities = await City.find(query)
      .populate('governorateId', 'nameEn nameAr code')
      .sort({ nameEn: 1 });

    res.json({ success: true, data: cities });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET city by ID
router.get('/cities/:id', async (req, res) => {
  try {
    const city = await City.findOne({
      $or: [{ _id: req.params.id }, { code: req.params.id }]
    }).populate('governorateId', 'nameEn nameAr code');

    if (!city) {
      return res.status(404).json({ success: false, error: 'City not found' });
    }

    res.json({ success: true, data: city });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET enabled cities
router.get('/cities/enabled/all', async (req, res) => {
  try {
    const cities = await City.find({ isEnabled: true })
      .populate('governorateId', 'nameEn nameAr code')
      .sort({ nameEn: 1 });

    res.json({ success: true, data: cities });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET cities by governorate
router.get('/cities/governorate/:governorateId', async (req, res) => {
  try {
    const { enabled } = req.query;
    let query = { governorateId: req.params.governorateId };
    
    if (enabled === 'true') {
      query.isEnabled = true;
    }

    const cities = await City.find(query).sort({ nameEn: 1 });
    res.json({ success: true, data: cities });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET enabled cities by governorate
router.get('/cities/governorate/:governorateId/enabled', async (req, res) => {
  try {
    const cities = await City.find({
      governorateId: req.params.governorateId,
      isEnabled: true
    }).sort({ nameEn: 1 });

    res.json({ success: true, data: cities });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST search cities
router.post('/cities/search', async (req, res) => {
  try {
    const { query, enabledCityIds, language = 'en' } = req.body;
    
    let searchQuery = {};
    
    // Filter by enabled cities if provided
    if (enabledCityIds && enabledCityIds.length > 0) {
      searchQuery.code = { $in: enabledCityIds };
    } else {
      searchQuery.isEnabled = true;
    }

    // Add text search
    if (query) {
      const searchRegex = new RegExp(query, 'i');
      if (language === 'ar') {
        searchQuery.$or = [
          { nameAr: searchRegex },
          { governorateNameAr: searchRegex }
        ];
      } else {
        searchQuery.$or = [
          { nameEn: searchRegex },
          { governorateName: searchRegex }
        ];
      }
    }

    const cities = await City.find(searchQuery)
      .populate('governorateId', 'nameEn nameAr code')
      .sort({ nameEn: 1 });

    res.json({ success: true, data: cities });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET location statistics
router.get('/stats', async (req, res) => {
  try {
    const [
      totalGovernorates,
      enabledGovernorates,
      totalCities,
      enabledCities
    ] = await Promise.all([
      Governorate.countDocuments(),
      Governorate.countDocuments({ isEnabled: true }),
      City.countDocuments(),
      City.countDocuments({ isEnabled: true })
    ]);

    // Cities by governorate
    const citiesByGovernorate = await City.aggregate([
      {
        $group: {
          _id: '$governorateId',
          governorateName: { $first: '$governorateName' },
          totalCities: { $sum: 1 },
          enabledCities: {
            $sum: { $cond: [{ $eq: ['$isEnabled', true] }, 1, 0] }
          }
        }
      }
    ]);

    const stats = {
      overview: {
        totalGovernorates,
        enabledGovernorates,
        totalCities,
        enabledCities
      },
      citiesByGovernorate: citiesByGovernorate.reduce((acc, item) => {
        acc[item._id] = {
          name: item.governorateName,
          total: item.totalCities,
          enabled: item.enabledCities
        };
        return acc;
      }, {})
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET admin settings for location management
router.get('/settings/admin', async (req, res) => {
  try {
    const settings = await AdminSettings.findOne();
    
    if (!settings) {
      // Return default settings
      const defaultSettings = {
        allowCrossCityOrders: false,
        enabledGovernorateIds: ['ismailia'],
        enabledCityIds: ['ismailia-city'],
        defaultCity: 'ismailia-city',
        canAddNewCities: true
      };
      return res.json({ success: true, data: defaultSettings });
    }

    const locationSettings = {
      allowCrossCityOrders: settings.allowCrossCityOrders,
      enabledGovernorateIds: settings.enabledGovernorateIds,
      enabledCityIds: settings.enabledCityIds,
      defaultCity: settings.defaultCity,
      canAddNewCities: settings.canAddNewCities
    };

    res.json({ success: true, data: locationSettings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET products for customer location (using admin settings)
router.get('/products/customer-location', async (req, res) => {
  try {
    const { cityId, governorateId } = req.query;
    const Product = require('../models/Product');
    
    if (!cityId && !governorateId) {
      return res.json({ success: true, data: [] });
    }

    let query = { isActive: true };
    
    if (cityId) {
      // Get products available in this specific city
      const User = require('../models/User');
      const pharmaciesInCity = await User.find({
        role: { $in: ['pharmacy', 'vendor'] },
        cityId: cityId,
        isActive: true
      }).select('_id');
      
      const pharmacyIds = pharmaciesInCity.map(p => p._id);
      query['pharmacyStocks.pharmacyId'] = { $in: pharmacyIds };
      query['pharmacyStocks.inStock'] = true;
    } else if (governorateId) {
      // Get products available in this governorate
      const User = require('../models/User');
      const pharmaciesInGovernorate = await User.find({
        role: { $in: ['pharmacy', 'vendor'] },
        governorateId: governorateId,
        isActive: true
      }).select('_id');
      
      const pharmacyIds = pharmaciesInGovernorate.map(p => p._id);
      query['pharmacyStocks.pharmacyId'] = { $in: pharmacyIds };
      query['pharmacyStocks.inStock'] = true;
    }

    const products = await Product.find(query)
      .populate('pharmacyStocks.pharmacyId', 'businessName cityId governorateId')
      .sort({ name: 1 });

    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET pharmacies for customer location
router.get('/pharmacies/customer-location', async (req, res) => {
  try {
    const { cityId, governorateId } = req.query;
    const Pharmacy = require('../models/Pharmacy');
    
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

// GET in-stock products for customer location
router.get('/products/customer-location/in-stock', async (req, res) => {
  try {
    const { cityId, governorateId } = req.query;
    const Product = require('../models/Product');
    
    if (!cityId && !governorateId) {
      return res.json({ success: true, data: [] });
    }

    let query = { 
      isActive: true,
      'pharmacyStocks.inStock': true,
      'pharmacyStocks.stockQuantity': { $gt: 0 }
    };
    
    if (cityId) {
      const User = require('../models/User');
      const pharmaciesInCity = await User.find({
        role: { $in: ['pharmacy', 'vendor'] },
        cityId: cityId,
        isActive: true
      }).select('_id');
      
      const pharmacyIds = pharmaciesInCity.map(p => p._id);
      query['pharmacyStocks.pharmacyId'] = { $in: pharmacyIds };
    } else if (governorateId) {
      const User = require('../models/User');
      const pharmaciesInGovernorate = await User.find({
        role: { $in: ['pharmacy', 'vendor'] },
        governorateId: governorateId,
        isActive: true
      }).select('_id');
      
      const pharmacyIds = pharmaciesInGovernorate.map(p => p._id);
      query['pharmacyStocks.pharmacyId'] = { $in: pharmacyIds };
    }

    const products = await Product.find(query)
      .populate({
        path: 'pharmacyStocks.pharmacyId',
        select: 'businessName cityId governorateId',
        match: { isActive: true }
      })
      .sort({ name: 1 });

    // Filter products to only include those with valid pharmacy stocks
    const filteredProducts = products.filter(product => 
      product.pharmacyStocks.some(stock => 
        stock.pharmacyId && stock.inStock && stock.stockQuantity > 0
      )
    );

    res.json({ success: true, data: filteredProducts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET available pharmacies for customer location
router.get('/pharmacies/customer-location/available', async (req, res) => {
  try {
    const { cityId, governorateId } = req.query;
    const Product = require('../models/Product');
    const User = require('../models/User');
    
    if (!cityId && !governorateId) {
      return res.json({ success: true, data: [] });
    }

    // Get all products first
    const products = await Product.find({
      isActive: true,
      'pharmacyStocks.inStock': true
    });

    // Extract unique pharmacy IDs that have stock
    const pharmacyIds = new Set();
    products.forEach(product => {
      product.pharmacyStocks.forEach(stock => {
        if (stock.inStock && stock.stockQuantity > 0) {
          pharmacyIds.add(stock.pharmacyId.toString());
        }
      });
    });

    // Filter pharmacies by location
    let locationQuery = { isActive: true };
    if (cityId) {
      locationQuery.cityId = cityId;
    } else if (governorateId) {
      locationQuery.governorateId = governorateId;
    }

    const pharmacies = await User.find({
      ...locationQuery,
      _id: { $in: Array.from(pharmacyIds) },
      role: { $in: ['pharmacy', 'vendor'] }
    }).select('_id businessName name phone cityId governorateId');

    res.json({ success: true, data: pharmacies });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET location validation
router.get('/validate', async (req, res) => {
  try {
    const { cityId, governorateId } = req.query;
    
    if (!cityId && !governorateId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Either cityId or governorateId is required' 
      });
    }

    let isValid = false;
    let location = null;

    if (cityId) {
      const city = await City.findOne({ 
        $or: [{ _id: cityId }, { code: cityId }],
        isEnabled: true 
      }).populate('governorateId');
      
      if (city) {
        isValid = true;
        location = {
          type: 'city',
          city: city,
          governorate: city.governorateId
        };
      }
    } else if (governorateId) {
      const governorate = await Governorate.findOne({
        $or: [{ _id: governorateId }, { code: governorateId }],
        isEnabled: true
      });
      
      if (governorate) {
        isValid = true;
        const cities = await City.find({
          governorateId: governorate._id,
          isEnabled: true
        });
        
        location = {
          type: 'governorate',
          governorate: governorate,
          cities: cities
        };
      }
    }

    res.json({ 
      success: true, 
      data: { 
        isValid, 
        location 
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET delivery zones for a city
router.get('/cities/:cityId/delivery-zones', async (req, res) => {
  try {
    const city = await City.findOne({
      $or: [{ _id: req.params.cityId }, { code: req.params.cityId }]
    });

    if (!city) {
      return res.status(404).json({ success: false, error: 'City not found' });
    }

    const deliveryZones = city.serviceZones || [];
    const activeZones = deliveryZones.filter(zone => zone.isActive);

    res.json({ success: true, data: activeZones });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET delivery fee calculation
router.post('/delivery-fee', async (req, res) => {
  try {
    const { cityId, address, orderValue = 0 } = req.body;
    
    const city = await City.findOne({
      $or: [{ _id: cityId }, { code: cityId }]
    });

    if (!city) {
      return res.status(404).json({ success: false, error: 'City not found' });
    }

    // Check if free delivery threshold is met
    if (orderValue >= (city.freeDeliveryThreshold || 200)) {
      return res.json({ 
        success: true, 
        data: { 
          deliveryFee: 0, 
          reason: 'Free delivery threshold met' 
        } 
      });
    }

    // Check service zones for specific delivery fees
    let deliveryFee = city.baseDeliveryFee || 15;
    
    if (address && city.serviceZones && city.serviceZones.length > 0) {
      const zone = city.serviceZones.find(z => 
        z.isActive && 
        z.name.toLowerCase().includes(address.toLowerCase())
      );
      
      if (zone && zone.deliveryFee !== undefined) {
        deliveryFee = zone.deliveryFee;
      }
    }

    res.json({ 
      success: true, 
      data: { 
        deliveryFee,
        baseDeliveryFee: city.baseDeliveryFee || 15,
        freeDeliveryThreshold: city.freeDeliveryThreshold || 200
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;