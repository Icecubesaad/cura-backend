const express = require('express');
const { body, validationResult, check } = require('express-validator');
const Pharmacy = require('../models/Pharmacy');
const Product = require('../models/Product');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// --- Validation Middlewares ---

// Validation for pharmacy profile creation/update
const validatePharmacyProfile = [
    body('name').notEmpty().withMessage('Pharmacy name is required.'),
    body('licenseNumber').notEmpty().withMessage('License number is required.'),
    body('address.city').notEmpty().withMessage('City is required.'),
    body('address.state').notEmpty().withMessage('State is required.'),
    body('address.country').notEmpty().withMessage('Country is required.'),
    body('phone').isMobilePhone().withMessage('A valid phone number is required.'),
    body('email').isEmail().withMessage('A valid email is required.')
];

// Validation for medicine inventory update/creation
const validateInventory = [
    body('medicineId').isMongoId().withMessage('A valid medicine ID is required.'),
    body('quantity').isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer.'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a non-negative number.'),
];

// --- Helper Functions ---

// Helper function to build the search query object
const buildSearchQuery = async(req) => {
    const { city, state, lat, lng, services, specializations, medicineId, cityId, productId } = req.query;
    let query = {
        isActive: true,
        isVerified: true,
        verificationStatus: 'verified'
    };

    // Handle the cityId parameter
    if (cityId) {
        // Assuming a City model or lookup table to translate cityId to city name
        // This is a conceptual addition, you would need to implement the lookup logic
        // For now, we'll assume the cityId is a valid city name for demonstration
        query['address.city'] = new RegExp(cityId, 'i');
    } else {
        if (city) query['address.city'] = new RegExp(city, 'i');
    }

    if (state) query['address.state'] = new RegExp(state, 'i');
    if (services) query.services = { $in: services.split(',') };
    if (specializations) query.specializations = { $in: specializations.split(',') };

    // Geolocation-based search logic
    if (lat && lng) {
        // This is a placeholder. A proper geo-spatial query would be needed here.
        // E.g., using a 2dsphere index with $near
        console.log(`Searching near lat: ${lat}, lng: ${lng}`);
    }

    // Enhanced: Search for pharmacies that have specific products
    if (productId) {
        query._id = {
            $in: await Product.find({
                _id: productId,
                isActive: true,
                inStock: true,
                'availability.quantity': { $gt: 0 }
            }).distinct('pharmacyId')
        };
    }

    // Legacy support for medicineId
    if (medicineId) {
        // This logic searches for pharmacies that have a specific medicine in their inventory
        query._id = {
            $in: await Product.find({
                medicineId,
                stockQuantity: { $gt: 0 }
            }).distinct('pharmacyId')
        };
    }

    return query;
};


// --- API Routes ---

// Create/Update pharmacy profile
router.post('/profile', auth, authorize(['pharmacy', 'admin']), validatePharmacyProfile, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const {
            name, nameAr, licenseNumber, address, phone, email, website,
            operatingHours, services, specializations, establishedYear,
            chainName, isChain, deliveryService, paymentMethods,
            features, emergencyContact, socialMedia
        } = req.body;

        const updatedData = {
            name, nameAr, licenseNumber, address, phone, email, website,
            operatingHours, services, specializations, establishedYear,
            chainName, isChain, deliveryService, paymentMethods,
            features, emergencyContact, socialMedia,
            updatedBy: req.user._id,
        };

        const pharmacy = await Pharmacy.findOneAndUpdate(
            { owner: req.user._id },
            { $set: updatedData },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        res.status(200).json({
            message: 'Pharmacy profile created/updated successfully',
            pharmacy,
        });
    } catch (error) {
        console.error('Error creating/updating pharmacy profile:', error);
        res.status(500).json({
            message: 'Server error while creating/updating pharmacy profile',
            error: error.message,
        });
    }
});

// Update medicine inventory (Legacy support)
router.post('/inventory', auth, authorize(['pharmacy']), validateInventory, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { medicineId, quantity, price, expiryDate, batchNumber } = req.body;
        const pharmacy = await Pharmacy.findOne({ owner: req.user._id });

        if (!pharmacy) {
            return res.status(400).json({ message: 'Pharmacy profile not found' });
        }

        const inventory = await Product.findOneAndUpdate(
            {
                medicineId,
                pharmacyId: pharmacy._id,
                batchNumber: batchNumber || 'default'
            },
            {
                $set: {
                    stockQuantity: quantity,
                    price,
                    expiryDate,
                    updatedBy: req.user._id
                },
                $setOnInsert: {
                    createdBy: req.user._id,
                    pharmacyId: pharmacy._id,
                    medicineId,
                    batchNumber: batchNumber || 'default'
                }
            },
            {
                new: true,
                upsert: true
            }
        );

        res.json({
            message: 'Medicine added/updated in inventory successfully',
            inventory
        });
    } catch (error) {
        console.error('Error updating inventory:', error);
        res.status(500).json({
            message: 'Server error while updating inventory',
            error: error.message
        });
    }
});

// Get medicine inventory for a pharmacy (Legacy support)
router.get('/inventory/:id', auth, async (req, res) => {
    try {
        const pharmacyId = req.params.id;
        const inventories = await Product.find({ pharmacyId }).populate('medicineId');
        res.json(inventories);
    } catch (error) {
        console.error('Error fetching inventory:', error);
        res.status(500).json({
            message: 'Server error while fetching inventory',
            error: error.message
        });
    }
});

// NEW: Get products for a pharmacy
router.get('/:id/products', async (req, res) => {
    try {
        const { id: pharmacyId } = req.params;
        const { 
            page = 1, 
            limit = 20,
            sortBy = 'name',
            inStockOnly = 'true',
            category,
            search
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        let query = { 
            pharmacyId: pharmacyId, 
            isActive: true 
        };

        if (inStockOnly === 'true') {
            query.inStock = true;
            query['availability.quantity'] = { $gt: 0 };
        }

        if (category) {
            query.category = category;
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { nameAr: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { descriptionAr: { $regex: search, $options: 'i' } },
                { manufacturer: { $regex: search, $options: 'i' } },
                { activeIngredient: { $regex: search, $options: 'i' } }
            ];
        }

        let sortQuery = {};
        switch (sortBy) {
            case 'price-low': sortQuery = { price: 1 }; break;
            case 'price-high': sortQuery = { price: -1 }; break;
            case 'rating': sortQuery = { rating: -1 }; break;
            case 'newest': sortQuery = { createdAt: -1 }; break;
            default: sortQuery = { name: 1 };
        }

        const products = await Product.find(query)
            .sort(sortQuery)
            .skip(skip)
            .limit(parseInt(limit));

        const totalProducts = await Product.countDocuments(query);

        res.json({
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(totalProducts / parseInt(limit)),
            totalResults: totalProducts,
            products
        });
    } catch (error) {
        console.error('Error fetching pharmacy products:', error);
        res.status(500).json({
            message: 'Server error while fetching pharmacy products',
            error: error.message
        });
    }
});

// NEW: Get pharmacy statistics including product count
router.get('/:id/statistics', async (req, res) => {
    try {
        const { id: pharmacyId } = req.params;

        const pharmacy = await Pharmacy.findById(pharmacyId);
        if (!pharmacy) {
            return res.status(404).json({ message: 'Pharmacy not found' });
        }

        const stats = await Product.aggregate([
            { $match: { pharmacyId: pharmacyId, isActive: true } },
            {
                $group: {
                    _id: null,
                    totalProducts: { $sum: 1 },
                    inStockProducts: {
                        $sum: { $cond: [{ $eq: ["$inStock", true] }, 1, 0] }
                    },
                    outOfStockProducts: {
                        $sum: { $cond: [{ $eq: ["$inStock", false] }, 1, 0] }
                    },
                    averagePrice: { $avg: "$price" },
                    totalInventoryValue: {
                        $sum: { $multiply: ["$price", "$availability.quantity"] }
                    }
                }
            }
        ]);

        const categoryStats = await Product.aggregate([
            { $match: { pharmacyId: pharmacyId, isActive: true } },
            {
                $group: {
                    _id: "$category",
                    count: { $sum: 1 },
                    inStock: {
                        $sum: { $cond: [{ $eq: ["$inStock", true] }, 1, 0] }
                    },
                    averagePrice: { $avg: "$price" }
                }
            },
            { $sort: { count: -1 } }
        ]);

        res.json({
            pharmacy: {
                id: pharmacy._id,
                name: pharmacy.name,
                nameAr: pharmacy.nameAr
            },
            general: stats[0] || {
                totalProducts: 0,
                inStockProducts: 0,
                outOfStockProducts: 0,
                averagePrice: 0,
                totalInventoryValue: 0
            },
            categories: categoryStats
        });
    } catch (error) {
        console.error('Error fetching pharmacy statistics:', error);
        res.status(500).json({
            message: 'Server error while fetching pharmacy statistics',
            error: error.message
        });
    }
});

// Search for pharmacies
router.get('/search', async (req, res) => {
    try {
        const { page = 1, limit = 20, sortBy  } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const query = await buildSearchQuery(req);
        let sortQuery = {};

        if (sortBy === 'distance') {
            // This is a placeholder for a complex geo-spatial sort.
            // A proper implementation would require a 2dsphere index and specific aggregation.
            sortQuery = { 'address.city': 1 };
        } else if (sortBy === 'rating') {
            sortQuery = { rating: -1 };
        } else if (sortBy === 'delivery') {
            sortQuery = { deliveryService: -1 };
        } else {
            sortQuery = { name: 1 };
        }

        const pharmacies = await Pharmacy.find(query)
            .sort(sortQuery)
            .skip(skip)
            .limit(parseInt(limit));

        const totalPharmacies = await Pharmacy.countDocuments(query);

        // Enhanced: Add product count for each pharmacy
        const pharmaciesWithProductCount = await Promise.all(
            pharmacies.map(async (pharmacy) => {
                const productCount = await Product.countDocuments({
                    pharmacyId: pharmacy._id,
                    isActive: true,
                    inStock: true
                });
                
                return {
                    ...pharmacy.toObject(),
                    productCount,
                    hasProducts: productCount > 0
                };
            })
        );

        res.json({
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(totalPharmacies / limit),
            totalResults: totalPharmacies,
            pharmacies: pharmaciesWithProductCount,
        });
    } catch (error) {
        console.error('Error searching for pharmacies:', error);
        res.status(500).json({
            message: 'Server error while searching for pharmacies',
            error: error.message,
        });
    }
});

// Get a single pharmacy by its ID
router.get('/:id', async (req, res) => {
    try {
        const pharmacy = await Pharmacy.findById(req.params.id)
            .populate('owner', 'name email');

        if (!pharmacy) {
            return res.status(404).json({ message: 'Pharmacy not found' });
        }

        // Enhanced: Add product statistics to pharmacy details
        const productStats = await Product.aggregate([
            { $match: { pharmacyId: req.params.id, isActive: true } },
            {
                $group: {
                    _id: null,
                    totalProducts: { $sum: 1 },
                    inStockProducts: {
                        $sum: { $cond: [{ $eq: ["$inStock", true] }, 1, 0] }
                    },
                    averageRating: { $avg: "$rating" },
                    categoryCount: { $addToSet: "$category" }
                }
            }
        ]);

        const pharmacyWithStats = {
            ...pharmacy.toObject(),
            productStatistics: productStats[0] ? {
                ...productStats[0],
                categoryCount: productStats[0].categoryCount.length
            } : {
                totalProducts: 0,
                inStockProducts: 0,
                averageRating: 0,
                categoryCount: 0
            }
        };

        res.json(pharmacyWithStats);
    } catch (error) {
        console.error('Error fetching pharmacy by ID:', error);
        res.status(500).json({
            message: 'Server error while fetching pharmacy',
            error: error.message
        });
    }
});

// Enhanced: Get product details from a specific pharmacy
router.get('/:pharmacyId/product/:productId', async (req, res) => {
    try {
        const { pharmacyId, productId } = req.params;

        const pharmacy = await Pharmacy.findById(pharmacyId).select('name nameAr address phone rating deliveryService operatingHours');

        if (!pharmacy) {
            return res.status(404).json({ message: 'Pharmacy not found' });
        }

        const product = await Product.findOne({
            _id: productId,
            pharmacyId: pharmacyId,
            isActive: true
        });

        if (!product) {
            return res.status(404).json({ message: 'Product not available at this pharmacy' });
        }

        res.json({
            pharmacy: {
                id: pharmacy._id,
                name: pharmacy.name,
                nameAr: pharmacy.nameAr,
                address: pharmacy.address,
                phone: pharmacy.phone,
                rating: pharmacy.rating,
                deliveryService: pharmacy.deliveryService,
                operatingHours: pharmacy.operatingHours
            },
            product: {
                id: product._id,
                name: product.name,
                nameAr: product.nameAr,
                price: product.price,
                originalPrice: product.originalPrice,
                availability: product.availability,
                delivery: product.delivery,
                description: product.description,
                descriptionAr: product.descriptionAr,
                manufacturer: product.manufacturer,
                manufacturerAr: product.manufacturerAr,
                activeIngredient: product.activeIngredient,
                activeIngredientAr: product.activeIngredientAr,
                packSize: product.packSize,
                packSizeAr: product.packSizeAr,
                rating: product.rating,
                reviews: product.reviews,
                prescription: product.prescription,
                image: product.image,
                tags: product.tags
            }
        });
    } catch (error) {
        console.error('Error fetching pharmacy product details:', error);
        res.status(500).json({
            message: 'Server error while fetching pharmacy product details',
            error: error.message
        });
    }
});

// Legacy support: Get medicine details from a specific pharmacy
router.get('/:pharmacyId/medicine/:medicineId', async (req, res) => {
    try {
        const { pharmacyId, medicineId } = req.params;
        console.log('request recieved', req.params)
        const pharmacy = await Pharmacy.findById(pharmacyId).select('name address phone rating deliveryService');

        if (!pharmacy) {
            return res.status(404).json({ message: 'Pharmacy not found' });
        }

        const inventory = await Product.findOne({
            pharmacyId: pharmacyId,
            medicineId: medicineId,
            inStock: true,
            stockQuantity: { $gt: 0 }
        }).populate('medicineId', 'name brand image');

        if (!inventory) {
            return res.status(404).json({ message: 'Medicine not available at this pharmacy' });
        }

        res.json({
            pharmacy: {
                id: pharmacy._id,
                name: pharmacy.name,
                address: pharmacy.address,
                phone: pharmacy.phone,
                rating: pharmacy.rating,
                deliveryService: pharmacy.deliveryService
            },
            inventory: {
                price: inventory.price,
                stockQuantity: inventory.stockQuantity,
                stockLevel: inventory.stockLevel,
                hasDelivery: inventory.hasDelivery,
                deliveryTime: inventory.deliveryTime,
                lastUpdated: inventory.lastUpdated
            }
        });
    } catch (error) {
        console.error('Error fetching pharmacy inventory:', error);
        res.status(500).json({
            message: 'Server error while fetching pharmacy inventory',
            error: error.message
        });
    }
});

// NEW: Get nearby pharmacies that have a specific product
router.get('/nearby/product/:productId', async (req, res) => {
    try {
        const { productId } = req.params;
        const { lat, lng, radius = 10, limit = 10 } = req.query;

        // Find all pharmacies that have this product in stock
        const productsInStock = await Product.find({
            _id: productId,
            isActive: true,
            inStock: true,
            'availability.quantity': { $gt: 0 }
        }).populate('pharmacyId');

        if (productsInStock.length === 0) {
            return res.json({
                message: 'Product not available in any nearby pharmacies',
                pharmacies: []
            });
        }

        // If geolocation is provided, you could implement distance calculation
        // For now, we'll return all pharmacies with the product
        const pharmaciesWithProduct = productsInStock.map(product => ({
            pharmacy: product.pharmacyId,
            product: {
                id: product._id,
                price: product.price,
                availability: product.availability,
                delivery: product.delivery
            }
        }));

        res.json({
            totalResults: pharmaciesWithProduct.length,
            pharmacies: pharmaciesWithProduct.slice(0, parseInt(limit))
        });
    } catch (error) {
        console.error('Error finding nearby pharmacies with product:', error);
        res.status(500).json({
            message: 'Server error while finding nearby pharmacies',
            error: error.message
        });
    }
});

module.exports = router;