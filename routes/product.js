const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// GET all products with filters
router.get('/', async (req, res) => {
  try {
    const {
      cityIds,
      categories,
      priceMin,
      priceMax,
      inStockOnly,
      prescriptionOnly,
      minRating,
      pharmacyIds,
      search,
      language = 'en',
      sortBy = 'name'
    } = req.query;

    let query = { isActive: true };
    
    // Search functionality
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { name: searchRegex },
        { nameAr: searchRegex },
        { manufacturer: searchRegex },
        { activeIngredient: searchRegex },
        { keywords: { $in: [searchRegex] } },
        { tags: { $in: [searchRegex] } }
      ];
    }

    // Category filter
    if (categories) {
      const categoryArray = Array.isArray(categories) ? categories : categories.split(',');
      query.category = { $in: categoryArray };
    }

    // Price range filter
    if (priceMin || priceMax) {
      query.averagePrice = {};
      if (priceMin) query.averagePrice.$gte = parseFloat(priceMin);
      if (priceMax) query.averagePrice.$lte = parseFloat(priceMax);
    }

    // Prescription filter
    if (prescriptionOnly === 'true') {
      query.requiresPrescription = true;
    }

    // Rating filter
    if (minRating) {
      query.rating = { $gte: parseFloat(minRating) };
    }

    // Pharmacy filter
    if (pharmacyIds) {
      const pharmacyArray = Array.isArray(pharmacyIds) ? pharmacyIds : pharmacyIds.split(',');
      query['pharmacyStocks.pharmacyId'] = { $in: pharmacyArray };
    }

    // Stock filter
    if (inStockOnly === 'true' || pharmacyIds) {
      query['pharmacyStocks.inStock'] = true;
    }

    // City filter
    if (cityIds) {
      const cityArray = Array.isArray(cityIds) ? cityIds : cityIds.split(',');
      query['pharmacyStocks.pharmacyId'] = {
        $in: await getUsersByCity(cityArray)
      };
    }

    // Sorting
    let sortOption = {};
    switch (sortBy) {
      case 'price-low':
        sortOption.averagePrice = 1;
        break;
      case 'price-high':
        sortOption.averagePrice = -1;
        break;
      case 'rating':
        sortOption.rating = -1;
        break;
      case 'reviews':
        sortOption.reviewCount = -1;
        break;
      case 'name-desc':
        sortOption.name = -1;
        break;
      case 'newest':
        sortOption.createdAt = -1;
        break;
      default:
        sortOption.name = 1;
    }

    const products = await Product.find(query)
      .populate('pharmacyStocks.pharmacyId', 'businessName cityId')
      .sort(sortOption);

    res.json({
      success: true,
      data: products,
      total: products.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET product by ID
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('pharmacyStocks.pharmacyId', 'businessName phone cityId coordinates');
    
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET products by city
router.get('/city/:cityId', async (req, res) => {
  try {
    const { cityId } = req.params;
    const products = await Product.find({
      isActive: true,
      'pharmacyStocks.inStock': true
    }).populate({
      path: 'pharmacyStocks.pharmacyId',
      match: { cityId: cityId },
      select: 'businessName cityId'
    });

    const filteredProducts = products.filter(product => 
      product.pharmacyStocks.some(stock => stock.pharmacyId && stock.inStock)
    );

    res.json({ success: true, data: filteredProducts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET products by pharmacy
router.get('/pharmacy/:pharmacyId', async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    const { inStockOnly } = req.query;
    
    let query = {
      isActive: true,
      'pharmacyStocks.pharmacyId': pharmacyId
    };

    if (inStockOnly === 'true') {
      query['pharmacyStocks.inStock'] = true;
    }

    const products = await Product.find(query)
      .populate('pharmacyStocks.pharmacyId', 'businessName');

    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET available products
router.get('/available/all', async (req, res) => {
  try {
    const products = await Product.find({
      isActive: true,
      'pharmacyStocks.inStock': true
    }).populate('pharmacyStocks.pharmacyId', 'businessName cityId');

    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET popular products
router.get('/popular/all', async (req, res) => {
  try {
    const products = await Product.find({
      isActive: true,
      isPopular: true
    }).sort({ salesRank: 1 }).limit(20);

    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST create product (pharmacy, vendor, admin)
router.post('/', authenticateToken, authorizeRoles(['pharmacy', 'vendor', 'admin']), async (req, res) => {
  try {
    const productData = {
      ...req.body,
      createdBy: req.user.id
    };

    const product = new Product(productData);
    await product.save();

    res.status(201).json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT update product (pharmacy, vendor, admin)
router.put('/:id', authenticateToken, authorizeRoles(['pharmacy', 'vendor', 'admin']), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    // Check ownership for non-admin users
    if (req.user.role !== 'admin') {
      const hasStock = product.pharmacyStocks.some(stock => 
        stock.pharmacyId.toString() === req.user.id
      );
      if (!hasStock) {
        return res.status(403).json({ success: false, error: 'Not authorized to update this product' });
      }
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user.id },
      { new: true, runValidators: true }
    );

    res.json({ success: true, data: updatedProduct });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT update stock for specific pharmacy
router.put('/:id/stock', authenticateToken, authorizeRoles(['pharmacy', 'vendor', 'admin']), async (req, res) => {
  try {
    const { stockQuantity, price, inStock } = req.body;
    const pharmacyId = req.user.role === 'admin' ? req.body.pharmacyId : req.user.id;

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const stockIndex = product.pharmacyStocks.findIndex(
      stock => stock.pharmacyId.toString() === pharmacyId
    );

    if (stockIndex === -1) {
      // Add new stock entry
      product.pharmacyStocks.push({
        pharmacyId,
        stockQuantity,
        price,
        inStock: inStock !== undefined ? inStock : stockQuantity > 0,
        lastUpdated: new Date()
      });
    } else {
      // Update existing stock
      const stock = product.pharmacyStocks[stockIndex];
      stock.stockQuantity = stockQuantity !== undefined ? stockQuantity : stock.stockQuantity;
      stock.price = price !== undefined ? price : stock.price;
      stock.inStock = inStock !== undefined ? inStock : stockQuantity > 0;
      stock.lastUpdated = new Date();
    }

    product.updatePricingSummary();
    await product.save();

    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE product (pharmacy, vendor, admin)
router.delete('/:id', authenticateToken, authorizeRoles(['pharmacy', 'vendor', 'admin']), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    // Check ownership for non-admin users
    if (req.user.role !== 'admin') {
      const hasStock = product.pharmacyStocks.some(stock => 
        stock.pharmacyId.toString() === req.user.id
      );
      if (!hasStock) {
        return res.status(403).json({ success: false, error: 'Not authorized to delete this product' });
      }
    }

    if (req.user.role === 'admin') {
      // Admin can permanently delete
      await Product.findByIdAndDelete(req.params.id);
    } else {
      // Pharmacy/vendor can only deactivate
      product.isActive = false;
      await product.save();
    }

    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper function to get user IDs by city
async function getUsersByCity(cityIds) {
  const User = require('../models/User');
  const users = await User.find({
    cityId: { $in: cityIds },
    role: { $in: ['pharmacy', 'vendor'] }
  }).select('_id');
  return users.map(user => user._id);
}

module.exports = router;