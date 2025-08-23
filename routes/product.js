const express = require('express');
const { body, validationResult, query } = require('express-validator');
const mongoose = require('mongoose');

// Assuming Product.js model is correctly imported and defined.
const Product = require('../models/Product');
const Pharmacy = require('../models/Pharmacy');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();


// --- Helper Functions ---
// --- Validation Middlewares (Re-used) ---
const validateProduct = [
    body('name').notEmpty().withMessage('Product name is required.'),
    body('nameAr').notEmpty().withMessage('Arabic product name is required.'),
    body('category').notEmpty().withMessage('Category is required.'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number.'),
    body('pharmacyId').isMongoId().withMessage('Valid pharmacy ID is required.'),
    body('description').notEmpty().withMessage('Product description is required.'),
    body('descriptionAr').notEmpty().withMessage('Arabic product description is required.'),
    body('manufacturer').notEmpty().withMessage('Manufacturer is required.'),
    body('manufacturerAr').notEmpty().withMessage('Arabic manufacturer name is required.'),
    body('activeIngredient').notEmpty().withMessage('Active ingredient is required.'),
    body('activeIngredientAr').notEmpty().withMessage('Arabic active ingredient is required.'),
    body('packSize').notEmpty().withMessage('Pack size is required.'),
    body('packSizeAr').notEmpty().withMessage('Arabic pack size is required.'),
    body('expiryDate').isISO8601().withMessage('Valid expiry date is required.'),
    body('batchNumber').notEmpty().withMessage('Batch number is required.'),
    body('barcode').notEmpty().withMessage('Barcode is required.'),
    body('availability.quantity').isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer.'),
    body('delivery.estimatedDeliveryTime').notEmpty().withMessage('Estimated delivery time is required.'),
    body('delivery.deliveryFee').isFloat({ min: 0 }).withMessage('Delivery fee must be a non-negative number.')
];

const validateProductUpdate = [
    body('name').optional().notEmpty().withMessage('Product name cannot be empty.'),
    body('nameAr').optional().notEmpty().withMessage('Arabic product name cannot be empty.'),
    body('category').optional().notEmpty().withMessage('Category cannot be empty.'),
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number.'),
    body('availability.quantity').optional().isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer.')
];
const buildProductQuery = (queryParams) => {
    const {
        search, category, categories, form, page = 1, limit = 20, sortBy = 'name',
        cityId, governorateId, pharmacyId, inStockOnly, prescriptionOnly,
        minRating, minPrice, maxPrice, language, cityName, excludeIds, productType
    } = queryParams;

    let query = { isActive: true };

    if (search) {
        if (language === 'ar') {
            query.$or = [
                { nameAr: new RegExp(search, 'i') },
                { descriptionAr: new RegExp(search, 'i') },
                { pharmacyAr: new RegExp(search, 'i') },
                { manufacturerAr: new RegExp(search, 'i') },
                { activeIngredientAr: new RegExp(search, 'i') }
            ];
        } else {
            query.$or = [
                { name: new RegExp(search, 'i') },
                { genericName: new RegExp(search, 'i') },
                { brand: new RegExp(search, 'i') },
                { category: new RegExp(search, 'i') },
                { description: new RegExp(search, 'i') }
            ];
            // Add text search if available in the model
            // query.$text = { $search: search };
        }
    }

    // Combine category and categories filter
    if (category && category !== 'all') {
        query.category = new RegExp(category, 'i');
    } else if (categories) {
        // const categoryArray = Array.isArray(categories) ? categories : categories.split(',');
        // query.category = { $in: categoryArray };
        query.category = new RegExp(category, 'i');
    }

    if (form) {
        query.form = new RegExp(form, 'i');
    }

    // Location filters
    if (cityName) {
        const cityNameArray = Array.isArray(cityName) ? cityName : cityName.split(',');
        query.cityName = { $in: cityNameArray };
    } else if (cityId) {
        query.cityId = cityId;
    } else if (governorateId) {
        query.governorateId = governorateId;
    }

    // Pharmacy filters
    if (pharmacyId) {
        query.pharmacyId = pharmacyId;
        query.inStock = true;
        query['availability.quantity'] = { $gt: 0 };
    }

    if (excludeIds) {
        const idsArray = excludeIds.split(',').filter(id => mongoose.Types.ObjectId.isValid(id));
        if (idsArray.length > 0) {
            query._id = { $nin: idsArray };
        }
    }

    // Stock and Prescription filters
    if (inStockOnly === 'true') {
        query.inStock = true;
        query['availability.quantity'] = { $gt: 0 };
    }
    
    if (prescriptionOnly === 'true') {
        query.prescription = true;
    } else if (prescriptionOnly === 'false') {
        query.prescription = false;
    }

    // Price and Rating filters
    if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) query.price.$gte = parseFloat(minPrice);
        if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }
    
    if (minRating) {
        query.rating = { $gte: parseFloat(minRating) };
    }
    if (productType){
        query.productType = productType
    }
    return query;
};

const buildSortQuery = (sortBy) => {
    switch (sortBy) {
        case 'price-low':
            return { price: 1 };
        case 'price-high':
            return { price: -1 };
        case 'rating':
            return { rating: -1, reviews: -1 };
        case 'newest':
            return { createdAt: -1 };
        case 'popular':
            return { viewCount: -1, rating: -1 }; // Assuming viewCount exists
        case 'name-desc':
            return { name: -1 };
        case 'category':
            return { category: 1, name: 1 };
        case 'availability':
            return { 'inStock': -1, 'availability.quantity': -1 };
        case 'name':
        default:
            return { name: 1 };
    }
};

// --- Route: GET /api/products ---
// This is the primary route for listing and searching products.
router.get('/', async (req, res) => {
    try {
        console.log('request recieved to get all the medicines')
        const { page = 1, limit = 20, sortBy = 'name', language = 'en' } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const query = buildProductQuery(req.query);
        const sortQuery = buildSortQuery(sortBy);
        console.log('query: ', req.query, query)
        const products = await Product.find(query)
            .sort(sortQuery)
            .skip(skip)
            .limit(parseInt(limit))
            .populate('pharmacyId', 'name nameAr address phone rating deliveryService');

        const totalProducts = await Product.countDocuments(query);
        // console.log('products : ', products)
        res.json({
            products,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(totalProducts / parseInt(limit)),
            totalResults: totalProducts,
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({
            message: 'Server error while fetching products',
            error: error.message
        });
    }
});
router.get('/search', async (req, res) => {
    try {
        const { page = 1, limit = 20, sortBy = 'name' } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const query = buildProductQuery(req.query);
        const sortQuery = buildSortQuery(sortBy);

        const products = await Product.find(query)
            .sort(sortQuery)
            .skip(skip)
            .limit(parseInt(limit))
            .populate('pharmacyId', 'name nameAr address phone rating deliveryService');

        const totalProducts = await Product.countDocuments(query);

        res.json({
            products,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(totalProducts / parseInt(limit)),
            totalResults: totalProducts,
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({
            message: 'Server error while fetching products',
            error: error.message
        });
    }
});
// --- Route: GET /api/products/related/:id ---
// Fetches related products based on properties of a single product.
router.get('/related/:id', async (req, res) => {
    try {
        const productId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ message: 'Invalid product ID format' });
        }

        const currentProduct = await Product.findOne({ _id: productId, isActive: true });

        if (!currentProduct) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const {
            category, activeIngredient, brand,
            form, prescription, tags = []
        } = currentProduct;

        const relatedProducts = await Product.aggregate([
            { $match: { _id: { $ne: currentProduct._id }, isActive: true } },
            {
                $addFields: {
                    similarityScore: {
                        $add: [
                            { $cond: [{ $eq: ['$category', category] }, 10, 0] },
                            { $cond: [{ $eq: ['$activeIngredient', activeIngredient] }, 8, 0] },
                            { $cond: [{ $eq: ['$brand', brand] }, 5, 0] },
                            { $cond: [{ $eq: ['$form', form] }, 4, 0] },
                            { $cond: [{ $eq: ['$prescription', prescription] }, 3, 0] },
                            {
                                $min: [
                                    {
                                        $size: {
                                            $setIntersection: [
                                                { $ifNull: ['$tags', []] },
                                                tags
                                            ]
                                        }
                                    },
                                    5
                                ]
                            }
                        ]
                    }
                }
            },
            { $match: { similarityScore: { $gt: 0 } } },
            { $sort: { similarityScore: -1, rating: -1, reviews: -1 } },
            { $limit: 12 }
        ]);

        const categorizedResults = {
            sameCategory: relatedProducts.filter(product => product.category === category).slice(0, 4),
            sameActiveIngredient: relatedProducts.filter(product => product.activeIngredient === activeIngredient).slice(0, 4),
            sameBrand: relatedProducts.filter(product => product.brand === brand).slice(0, 3),
            similar: relatedProducts.filter(product => product.similarityScore < 10 && product.similarityScore > 0).slice(0, 3)
        };

        res.json({
            currentProduct,
            relatedProducts,
            categorizedResults,
            total: relatedProducts.length
        });

    } catch (error) {
        console.error('Error fetching related products:', error);
        res.status(500).json({
            message: 'Server error while fetching related products',
            error: error.message
        });
    }
});

// --- Route: GET /api/products/search/alternatives ---
// Search for alternative medicines.
router.get('/search/alternatives', auth, authorize(['prescription_reader', 'admin']), async (req, res) => {
    try {
        const { search, excludeIds, limit = 50 } = req.query;
        let query = { isActive: true };

        if (search) {
            query.$or = [
                { name: new RegExp(search, 'i') },
                { genericName: new RegExp(search, 'i') },
                { brand: new RegExp(search, 'i') },
                { description: new RegExp(search, 'i') }
            ];
        }

        if (excludeIds) {
            const idsArray = excludeIds.split(',').filter(id => mongoose.Types.ObjectId.isValid(id));
            if (idsArray.length > 0) {
                query._id = { $nin: idsArray };
            }
        }

        const medicines = await Product.find(query)
            .limit(parseInt(limit))
            .sort({ name: 1 })
            .select('name genericName brand strength form category image prescription description rating reviews price availability delivery');

        res.json(medicines);
    } catch (error) {
        console.error('Error searching alternatives:', error);
        res.status(500).json({
            message: 'Server error while searching alternatives',
            error: error.message
        });
    }
});


// --- Route: GET /api/products/meta/categories ---
// Get all distinct product categories.
router.get('/meta/categories', async (req, res) => {
    try {
        const categories = await Product.distinct('category', { isActive: true });
        const validCategories = categories.filter(cat => cat && cat.trim() !== '').sort();
        res.json(validCategories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({
            message: 'Server error while fetching categories',
            error: error.message
        });
    }
});

// --- Route: GET /api/products/meta/statistics ---
// Get various statistics about products (admin only).
router.get('/meta/statistics', auth, authorize(['admin']), async (req, res) => {
    try {
        const stats = await Product.aggregate([
            {
                $group: {
                    _id: null,
                    totalProducts: { $sum: 1 },
                    activeProducts: {
                        $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
                    },
                    prescriptionProducts: {
                        $sum: { $cond: [{ $eq: ['$prescription', true] }, 1, 0] }
                    },
                    inStockProducts: {
                        $sum: { $cond: [{ $eq: ['$inStock', true] }, 1, 0] }
                    }
                }
            }
        ]);

        const categoryStats = await Product.aggregate([
            { $match: { isActive: true } },
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 },
                    available: { $sum: { $cond: [{ $eq: ['$inStock', true] }, 1, 0] } }
                }
            },
            { $sort: { count: -1 } }
        ]);

        res.json({
            overview: stats[0] || {},
            categoryBreakdown: categoryStats
        });
    } catch (error) {
        console.error('Error fetching statistics:', error);
        res.status(500).json({
            message: 'Server error while fetching statistics',
            error: error.message
        });
    }
});

// --- Route: GET /api/products/:id ---
// Get a single product by ID.
router.get('/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid product ID format' });
        }

        const product = await Product.findOne({
            _id: req.params.id,
            isActive: true
        }).populate('pharmacyId', 'name nameAr address phone rating deliveryService operatingHours');

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        
        // Add related products and other details as needed
        // This part can be handled by a separate call from the frontend or an aggregated pipeline here.

        res.json(product);
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({
            message: 'Server error while fetching product',
            error: error.message
        });
    }
});

// --- Route: POST /api/products ---
// Create a new product (admin or pharmacy owner).
router.post('/', auth, authorize(['pharmacy', 'admin']), validateProduct, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const pharmacy = await Pharmacy.findOne({
            _id: req.body.pharmacyId,
            owner: req.user._id
        });

        if (!pharmacy && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Pharmacy not found or not owned by user.' });
        }

        const existingProduct = await Product.findOne({
            barcode: req.body.barcode,
            isActive: true
        });

        if (existingProduct) {
            return res.status(400).json({ message: 'Product with this barcode already exists.' });
        }

        const productData = {
            ...req.body,
            pharmacy: pharmacy.name,
            pharmacyAr: pharmacy.nameAr || pharmacy.name,
            cityId: pharmacy.address.cityId || 'default-city',
            cityName: pharmacy.address.city,
            governorateId: pharmacy.address.governorateId || 'default-governorate',
            createdBy: req.user._id
        };

        const product = new Product(productData);
        await product.save();

        res.status(201).json({
            message: 'Product created successfully',
            product
        });
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({
            message: 'Server error while creating product',
            error: error.message
        });
    }
});

// --- Route: PUT /api/products/:id ---
// Update a product (admin or pharmacy owner).
router.put('/:id', auth, authorize(['pharmacy', 'admin']), validateProductUpdate, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid product ID format' });
        }

        const product = await Product.findOne({
            _id: req.params.id,
            isActive: true
        }).populate('pharmacyId');

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        if (req.user.role !== 'admin' && product.pharmacyId.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Access denied. Not authorized to update this product.' });
        }

        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id,
            {
                ...req.body,
                updatedBy: req.user._id
            },
            { new: true, runValidators: true }
        );

        res.json({
            message: 'Product updated successfully',
            product: updatedProduct
        });
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({
            message: 'Server error while updating product',
            error: error.message
        });
    }
});

// --- Route: DELETE /api/products/:id ---
// Soft delete a product (admin or pharmacy owner).
router.delete('/:id', auth, authorize(['pharmacy', 'admin']), async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid product ID format' });
        }

        const product = await Product.findOne({
            _id: req.params.id,
            isActive: true
        }).populate('pharmacyId');

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        if (req.user.role !== 'admin' && product.pharmacyId.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Access denied.' });
        }

        await Product.findByIdAndUpdate(req.params.id, {
            isActive: false,
            updatedBy: req.user._id
        });

        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({
            message: 'Server error while deleting product',
            error: error.message
        });
    }
});
// Corrected endpoints that match the Product model schema

// Get medicine categories - ✅ CORRECT (category field exists in model)
router.get('/meta/categories', async (req, res) => {
    try {
      const categories = await Product.distinct('category', { isActive: true });
      
      const validCategories = categories
        .filter(cat => cat && cat.trim() !== '')
        .sort();
  
      res.json(validCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ 
        message: 'Server error while fetching categories', 
        error: error.message 
      });
    }
});

// CORRECTED: Get medicine forms - ❌ ISSUE: 'form' field doesn't exist in Product model
// The model has 'packSize' and 'packSizeAr' instead
router.get('/meta/forms', async (req, res) => {
    try {
      // Changed from 'form' to 'packSize' which exists in the model
      const forms = await Product.distinct('packSize', { isActive: true });
      
      const validForms = forms
        .filter(form => form && form.trim() !== '')
        .sort();
  
      res.json(validForms);
    } catch (error) {
      console.error('Error fetching forms:', error);
      res.status(500).json({ 
        message: 'Server error while fetching forms', 
        error: error.message 
      });
    }
});

// ALTERNATIVE: Get medicine dosages (if you want actual medicine forms/dosages)
router.get('/meta/dosages', async (req, res) => {
    try {
      const dosages = await Product.distinct('dosage', { 
        isActive: true,
        dosage: { $exists: true, $ne: null, $ne: '' }
      });
      
      const validDosages = dosages
        .filter(dosage => dosage && dosage.trim() !== '')
        .sort();
  
      res.json(validDosages);
    } catch (error) {
      console.error('Error fetching dosages:', error);
      res.status(500).json({ 
        message: 'Server error while fetching dosages', 
        error: error.message 
      });
    }
});

// CORRECTED: Get medicine statistics - ❌ MULTIPLE ISSUES
router.get('/meta/statistics', auth, authorize(['admin']), async (req, res) => {
    try {
      const stats = await Product.aggregate([
        {
          $group: {
            _id: null,
            totalMedicines: { $sum: 1 },
            activeMedicines: {
              $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
            },
            // CORRECTED: Changed from 'requiresPrescription' to 'prescription'
            prescriptionMedicines: {
              $sum: { $cond: [{ $eq: ['$prescription', true] }, 1, 0] }
            },
            // CORRECTED: Changed from 'availability.inStock' to 'inStock' (top-level field)
            availableMedicines: {
              $sum: { $cond: [{ $eq: ['$inStock', true] }, 1, 0] }
            },
            categories: { $addToSet: '$category' },
            // CORRECTED: Changed from 'form' to 'packSize'
            packSizes: { $addToSet: '$packSize' },
            // ADDED: Include manufacturers and other relevant fields
            manufacturers: { $addToSet: '$manufacturer' },
            averagePrice: { $avg: '$price' },
            totalInventoryValue: { 
              $sum: { $multiply: ['$price', '$availability.quantity'] }
            }
          }
        }
      ]);

      // CORRECTED: Using Product instead of Medicine model
      const categoryStats = await Product.aggregate([
        { $match: { isActive: true } },
        { 
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            // CORRECTED: Using 'inStock' instead of 'availability.inStock'
            available: { $sum: { $cond: [{ $eq: ['$inStock', true] }, 1, 0] } },
            averagePrice: { $avg: '$price' },
            totalQuantity: { $sum: '$availability.quantity' }
          }
        },
        { $sort: { count: -1 } }
      ]);

      // ADDED: Additional useful statistics
      const manufacturerStats = await Product.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: '$manufacturer',
            count: { $sum: 1 },
            available: { $sum: { $cond: [{ $eq: ['$inStock', true] }, 1, 0] } },
            averagePrice: { $avg: '$price' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 } // Top 10 manufacturers
      ]);

      const cityStats = await Product.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: { city: '$cityName', governorate: '$governorateId' },
            count: { $sum: 1 },
            available: { $sum: { $cond: [{ $eq: ['$inStock', true] }, 1, 0] } },
            pharmacies: { $addToSet: '$pharmacyId' }
          }
        },
        {
          $addFields: {
            pharmacyCount: { $size: '$pharmacies' }
          }
        },
        { $sort: { count: -1 } }
      ]);

      res.json({
        overview: stats[0] || {
          totalMedicines: 0,
          activeMedicines: 0,
          prescriptionMedicines: 0,
          availableMedicines: 0,
          categories: [],
          packSizes: [],
          manufacturers: [],
          averagePrice: 0,
          totalInventoryValue: 0
        },
        categoryBreakdown: categoryStats,
        manufacturerBreakdown: manufacturerStats,
        locationBreakdown: cityStats
      });
    } catch (error) {
      console.error('Error fetching statistics:', error);
      res.status(500).json({ 
        message: 'Server error while fetching statistics', 
        error: error.message 
      });
    }
});

// ADDITIONAL USEFUL ENDPOINTS based on the Product model

// Get manufacturers
router.get('/meta/manufacturers', async (req, res) => {
    try {
      const manufacturers = await Product.distinct('manufacturer', { isActive: true });
      
      const validManufacturers = manufacturers
        .filter(manufacturer => manufacturer && manufacturer.trim() !== '')
        .sort();
  
      res.json(validManufacturers);
    } catch (error) {
      console.error('Error fetching manufacturers:', error);
      res.status(500).json({ 
        message: 'Server error while fetching manufacturers', 
        error: error.message 
      });
    }
});

// Get active ingredients
router.get('/meta/active-ingredients', async (req, res) => {
    try {
      const ingredients = await Product.distinct('activeIngredient', { isActive: true });
      
      const validIngredients = ingredients
        .filter(ingredient => ingredient && ingredient.trim() !== '')
        .sort();
  
      res.json(validIngredients);
    } catch (error) {
      console.error('Error fetching active ingredients:', error);
      res.status(500).json({ 
        message: 'Server error while fetching active ingredients', 
        error: error.message 
      });
    }
});

// Get cities with available products
router.get('/meta/cities', async (req, res) => {
    try {
      const cities = await Product.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: {
              cityId: '$cityId',
              cityName: '$cityName',
              governorateId: '$governorateId'
            },
            productCount: { $sum: 1 },
            availableCount: { $sum: { $cond: [{ $eq: ['$inStock', true] }, 1, 0] } },
            pharmacyCount: { $addToSet: '$pharmacyId' }
          }
        },
        {
          $addFields: {
            pharmacyCount: { $size: '$pharmacyCount' }
          }
        },
        { $sort: { 'productCount': -1 } }
      ]);
  
      res.json(cities);
    } catch (error) {
      console.error('Error fetching cities:', error);
      res.status(500).json({ 
        message: 'Server error while fetching cities', 
        error: error.message 
      });
    }
});

// Get price ranges by category
router.get('/meta/price-ranges', async (req, res) => {
    try {
      const priceRanges = await Product.aggregate([
        { $match: { isActive: true, price: { $gt: 0 } } },
        {
          $group: {
            _id: '$category',
            minPrice: { $min: '$price' },
            maxPrice: { $max: '$price' },
            avgPrice: { $avg: '$price' },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id': 1 } }
      ]);
  
      // Overall price range
      const overallRange = await Product.aggregate([
        { $match: { isActive: true, price: { $gt: 0 } } },
        {
          $group: {
            _id: null,
            minPrice: { $min: '$price' },
            maxPrice: { $max: '$price' },
            avgPrice: { $avg: '$price' }
          }
        }
      ]);

      res.json({
        overall: overallRange[0] || { minPrice: 0, maxPrice: 0, avgPrice: 0 },
        byCategory: priceRanges
      });
    } catch (error) {
      console.error('Error fetching price ranges:', error);
      res.status(500).json({ 
        message: 'Server error while fetching price ranges', 
        error: error.message 
      });
    }
});

// Get stock levels summary
router.get('/meta/stock-summary', auth, authorize(['admin', 'pharmacy']), async (req, res) => {
    try {
      let matchCondition = { isActive: true };
      
      // If pharmacy user, filter by their pharmacy
      if (req.user.role === 'pharmacy') {
        const pharmacy = await Pharmacy.findOne({ owner: req.user._id });
        if (pharmacy) {
          matchCondition.pharmacyId = pharmacy._id;
        }
      }

      const stockSummary = await Product.aggregate([
        { $match: matchCondition },
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            inStock: { $sum: { $cond: [{ $eq: ['$inStock', true] }, 1, 0] } },
            outOfStock: { $sum: { $cond: [{ $eq: ['$inStock', false] }, 1, 0] } },
            lowStock: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$inStock', true] },
                      { $lte: ['$availability.quantity', '$availability.lowStockThreshold'] }
                    ]
                  },
                  1,
                  0
                ]
              }
            },
            totalQuantity: { $sum: '$availability.quantity' },
            averageStockLevel: { $avg: '$availability.quantity' }
          }
        }
      ]);

      res.json(stockSummary[0] || {
        totalProducts: 0,
        inStock: 0,
        outOfStock: 0,
        lowStock: 0,
        totalQuantity: 0,
        averageStockLevel: 0
      });
    } catch (error) {
      console.error('Error fetching stock summary:', error);
      res.status(500).json({ 
        message: 'Server error while fetching stock summary', 
        error: error.message 
      });
    }
});


module.exports = router;