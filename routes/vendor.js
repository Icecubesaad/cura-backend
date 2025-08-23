const express = require('express');
const router = express.Router();
const Vendor = require('../models/Vendor');
const Product = require('../models/Product');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// GET all vendors with filters
router.get('/', async (req, res) => {
  try {
    const { 
      vendorType, 
      cityId, 
      governorateId,
      isActive = 'true',
      isVerified,
      page = 1, 
      limit = 20,
      search 
    } = req.query;
    
    let query = {};
    
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (isVerified !== undefined) query.isVerified = isVerified === 'true';
    if (vendorType) query.vendorType = vendorType;
    if (cityId) query['address.cityId'] = cityId;
    if (governorateId) query['address.governorateId'] = governorateId;
    
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { vendorName: searchRegex },
        { vendorNameAr: searchRegex },
        { vendorCode: searchRegex },
        { phone: searchRegex },
        { email: searchRegex }
      ];
    }

    const vendors = await Vendor.find(query)
      .sort({ rating: -1, vendorName: 1 })
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

// GET vendor by ID
router.get('/:id', async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    
    if (!vendor) {
      return res.status(404).json({ success: false, error: 'Vendor not found' });
    }

    res.json({ success: true, data: vendor });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET vendors by product
router.get('/product/:productName', async (req, res) => {
  try {
    const { productName } = req.params;
    const { cityId } = req.query;
    
    let query = {
      isActive: true,
      isVerified: true,
      'products.productName': new RegExp(productName, 'i'),
      'products.inStock': true
    };

    if (cityId) {
      query['address.cityId'] = cityId;
    }

    const vendors = await Vendor.find(query).sort({ rating: -1 });
    
    // Filter and format vendor data to include only the requested product
    const vendorProductInfo = vendors.map(vendor => {
      const product = vendor.products.find(p => 
        p.productName.toLowerCase().includes(productName.toLowerCase()) && 
        p.inStock && p.isActive
      );
      
      if (!product) return null;
      
      return {
        vendorId: vendor._id,
        vendorName: vendor.vendorName,
        vendorNameAr: vendor.vendorNameAr,
        vendorType: vendor.vendorType,
        cityId: vendor.address.cityId,
        cityName: vendor.address.cityName,
        governorateId: vendor.address.governorateId,
        price: product.price,
        originalPrice: product.originalPrice,
        inStock: product.inStock,
        deliveryTime: product.deliveryTime,
        deliveryFee: product.deliveryFee,
        minimumOrderQuantity: product.minimumOrderQuantity,
        bulkPricing: product.bulkPricing,
        rating: vendor.rating,
        reviewCount: vendor.reviewCount,
        specialOffers: product.specialOffers
      };
    }).filter(Boolean);

    res.json({ success: true, data: vendorProductInfo });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET vendors by city
router.get('/city/:cityId', async (req, res) => {
  try {
    const vendors = await Vendor.find({
      'address.cityId': req.params.cityId,
      isActive: true,
      isVerified: true
    }).sort({ rating: -1 });

    res.json({ success: true, data: vendors });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET vendors by type
router.get('/type/:vendorType', async (req, res) => {
  try {
    const vendors = await Vendor.find({
      vendorType: req.params.vendorType,
      isActive: true,
      isVerified: true
    }).sort({ rating: -1 });

    res.json({ success: true, data: vendors });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET best price vendor for a product
router.get('/best-price/:productName', async (req, res) => {
  try {
    const { productName } = req.params;
    const { cityId } = req.query;
    
    let query = {
      isActive: true,
      isVerified: true,
      'products.productName': new RegExp(productName, 'i'),
      'products.inStock': true
    };

    if (cityId) {
      query['address.cityId'] = cityId;
    }

    const vendors = await Vendor.find(query);
    
    let bestVendor = null;
    let bestPrice = Infinity;
    
    vendors.forEach(vendor => {
      const product = vendor.products.find(p => 
        p.productName.toLowerCase().includes(productName.toLowerCase()) && 
        p.inStock && p.isActive
      );
      
      if (product && product.price < bestPrice) {
        bestPrice = product.price;
        bestVendor = {
          vendorId: vendor._id,
          vendorName: vendor.vendorName,
          vendorType: vendor.vendorType,
          cityId: vendor.address.cityId,
          cityName: vendor.address.cityName,
          price: product.price,
          deliveryTime: product.deliveryTime,
          deliveryFee: product.deliveryFee,
          rating: vendor.rating
        };
      }
    });

    if (!bestVendor) {
      return res.status(404).json({ 
        success: false, 
        error: 'No vendors found for this product' 
      });
    }

    res.json({ success: true, data: bestVendor });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET vendor statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const totalVendors = await Vendor.countDocuments();
    const activeVendors = await Vendor.countDocuments({ isActive: true });
    
    const [ratingStats, typeStats, cityStats] = await Promise.all([
      Vendor.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: null, averageRating: { $avg: '$rating' } } }
      ]),
      Vendor.aggregate([
        { $group: { _id: '$vendorType', count: { $sum: 1 } } }
      ]),
      Vendor.aggregate([
        { $group: { _id: '$address.cityName', count: { $sum: 1 } } }
      ])
    ]);

    // Count total products across all vendors
    const totalProducts = await Vendor.aggregate([
      { $project: { productCount: { $size: '$products' } } },
      { $group: { _id: null, totalProducts: { $sum: '$productCount' } } }
    ]);

    const stats = {
      totalVendors,
      activeVendors,
      averageRating: ratingStats[0]?.averageRating || 0,
      totalProducts: totalProducts[0]?.totalProducts || 0,
      byType: typeStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byCity: cityStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {})
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Vendor management routes (require authentication)

// POST create vendor (admin only)
router.post('/', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
  try {
    const vendor = new Vendor(req.body);
    await vendor.save();

    res.status(201).json({ success: true, data: vendor });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT update vendor (vendor owner or admin)
router.put('/:id', authenticateToken, authorizeRoles(['vendor', 'admin']), async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    
    if (!vendor) {
      return res.status(404).json({ success: false, error: 'Vendor not found' });
    }

    // Check ownership (vendors can only update their own data)
    if (req.user.role === 'vendor' && vendor.owner?.toString() !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        error: 'Not authorized to update this vendor' 
      });
    }

    const updatedVendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.json({ success: true, data: updatedVendor });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST add product to vendor
router.post('/:id/products', authenticateToken, authorizeRoles(['vendor', 'admin']), async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    
    if (!vendor) {
      return res.status(404).json({ success: false, error: 'Vendor not found' });
    }

    // Check ownership
    if (req.user.role === 'vendor' && vendor.owner?.toString() !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        error: 'Not authorized to modify this vendor' 
      });
    }

    vendor.addProduct(req.body);
    await vendor.save();

    res.status(201).json({ 
      success: true, 
      data: vendor.products[vendor.products.length - 1] 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT update vendor product
router.put('/:id/products/:productId', authenticateToken, authorizeRoles(['vendor', 'admin']), async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    
    if (!vendor) {
      return res.status(404).json({ success: false, error: 'Vendor not found' });
    }

    // Check ownership
    if (req.user.role === 'vendor' && vendor.owner?.toString() !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        error: 'Not authorized to modify this vendor' 
      });
    }

    const product = vendor.getProductById(req.params.productId);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    Object.assign(product, { ...req.body, lastUpdated: new Date() });
    await vendor.save();

    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT update product stock
router.put('/:id/products/:productId/stock', authenticateToken, authorizeRoles(['vendor', 'admin']), async (req, res) => {
  try {
    const { newQuantity } = req.body;
    const vendor = await Vendor.findById(req.params.id);
    
    if (!vendor) {
      return res.status(404).json({ success: false, error: 'Vendor not found' });
    }

    // Check ownership
    if (req.user.role === 'vendor' && vendor.owner?.toString() !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        error: 'Not authorized to modify this vendor' 
      });
    }

    const success = vendor.updateProductStock(req.params.productId, newQuantity);
    
    if (!success) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    await vendor.save();

    const updatedProduct = vendor.getProductById(req.params.productId);
    res.json({ success: true, data: updatedProduct });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE remove product from vendor
router.delete('/:id/products/:productId', authenticateToken, authorizeRoles(['vendor', 'admin']), async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    
    if (!vendor) {
      return res.status(404).json({ success: false, error: 'Vendor not found' });
    }

    // Check ownership
    if (req.user.role === 'vendor' && vendor.owner?.toString() !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        error: 'Not authorized to modify this vendor' 
      });
    }

    vendor.removeProduct(req.params.productId);
    await vendor.save();

    res.json({ success: true, message: 'Product removed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET vendor's active products
router.get('/:id/products/active', async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    
    if (!vendor) {
      return res.status(404).json({ success: false, error: 'Vendor not found' });
    }

    const activeProducts = vendor.getActiveProducts();
    res.json({ success: true, data: activeProducts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT update vendor performance metrics (internal use)
router.put('/:id/metrics', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    
    if (!vendor) {
      return res.status(404).json({ success: false, error: 'Vendor not found' });
    }

    vendor.updatePerformanceMetrics(req.body);
    vendor.onTimeDeliveryRate = vendor.calculateOnTimeDeliveryRate();
    
    await vendor.save();

    res.json({ success: true, data: vendor });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE vendor (admin only)
router.delete('/:id', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
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

module.exports = router;