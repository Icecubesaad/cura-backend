const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// GET all orders with filters
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      status, 
      priority, 
      paymentMethod, 
      paymentStatus,
      orderType,
      page = 1, 
      limit = 20,
      startDate,
      endDate 
    } = req.query;
    
    let query = {};
    
    // Role-based filtering
    if (req.user.role === 'customer') {
      query.customerId = req.user.id;
    } else if (req.user.role === 'pharmacy') {
      query.pharmacyId = req.user.id;
    } else if (req.user.role === 'vendor') {
      query.vendorId = req.user.id;
    }

    // Apply filters
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (paymentMethod) query.paymentMethod = paymentMethod;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (orderType) query.orderType = orderType;

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const orders = await Order.find(query)
      .populate('customerId', 'name phone email')
      .populate('pharmacyId', 'businessName phone')
      .populate('vendorId', 'vendorName phone')
      .populate('items.productId', 'name image category')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      data: orders,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: orders.length,
        totalRecords: total
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET order by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customerId', 'name phone email addresses')
      .populate('pharmacyId', 'businessName phone address')
      .populate('vendorId', 'vendorName phone address')
      .populate('items.productId', 'name image category manufacturer')
      .populate('prescriptionId');

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // Check authorization
    const isAuthorized = 
      req.user.role === 'admin' ||
      order.customerId._id.toString() === req.user.id ||
      order.pharmacyId?.toString() === req.user.id ||
      order.vendorId?.toString() === req.user.id;

    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: 'Not authorized to view this order' });
    }

    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET orders by customer
router.get('/customer/:customerId', authenticateToken, authorizeRoles(['admin', 'pharmacy', 'vendor']), async (req, res) => {
  try {
    let query = { customerId: req.params.customerId };

    // Additional role-based filtering
    if (req.user.role === 'pharmacy') {
      query.pharmacyId = req.user.id;
    } else if (req.user.role === 'vendor') {
      query.vendorId = req.user.id;
    }

    const orders = await Order.find(query)
      .populate('pharmacyId', 'businessName')
      .populate('vendorId', 'vendorName')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET pending orders (for assignment)
router.get('/pending/unassigned', authenticateToken, authorizeRoles(['pharmacy', 'vendor', 'admin']), async (req, res) => {
  try {
    let query = {
      status: 'pending',
      isAssigned: false
    };

    // Filter by city for pharmacy/vendor
    if (req.user.role !== 'admin') {
      query.cityId = req.user.cityId;
    }

    const orders = await Order.find(query)
      .populate('customerId', 'name phone')
      .populate('items.productId', 'name category')
      .sort({ priority: -1, createdAt: 1 });

    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST create new order (customer only)
router.post('/', authenticateToken, authorizeRoles(['customer']), async (req, res) => {
  try {
    const {
      items,
      deliveryAddress,
      paymentMethod,
      pharmacyId,
      vendorId,
      prescriptionId,
      priority = 'normal',
      deliveryInstructions,
      orderType = 'regular'
    } = req.body;

    // Calculate totals
    let subtotal = 0;
    const processedItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(400).json({ 
          success: false, 
          error: `Product ${item.productId} not found` 
        });
      }

      const totalPrice = item.quantity * item.unitPrice;
      subtotal += totalPrice;

      processedItems.push({
        ...item,
        productName: product.name,
        productNameAr: product.nameAr,
        totalPrice,
        category: product.category,
        manufacturer: product.manufacturer,
        image: product.image,
        activeIngredient: product.activeIngredient,
        prescription: product.requiresPrescription,
        pharmacyId: pharmacyId || null,
        vendorId: vendorId || null
      });
    }

    // Calculate delivery fee (simplified)
    const deliveryFee = subtotal >= 200 ? 0 : 15;
    const taxAmount = subtotal * 0.14; // 14% VAT
    const totalAmount = subtotal + deliveryFee + taxAmount;

    const orderData = {
      customerId: req.user.id,
      customerName: req.user.name,
      customerPhone: req.user.phone,
      customerEmail: req.user.email,
      items: processedItems,
      subtotal,
      deliveryFee,
      taxAmount,
      totalAmount,
      deliveryAddress,
      paymentMethod,
      pharmacyId,
      vendorId,
      prescriptionId,
      priority,
      deliveryInstructions,
      orderType,
      cityId: deliveryAddress.city,
      governorateId: deliveryAddress.governorate,
      prescriptionRequired: processedItems.some(item => item.prescription)
    };

    const order = new Order(orderData);
    await order.save();

    // Populate for response
    await order.populate([
      { path: 'customerId', select: 'name phone email' },
      { path: 'items.productId', select: 'name image' }
    ]);

    res.status(201).json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT update order status
router.put('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status, notes } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // Check authorization
    const canUpdate = 
      req.user.role === 'admin' ||
      (req.user.role === 'customer' && order.customerId.toString() === req.user.id && ['cancelled'].includes(status)) ||
      (req.user.role === 'pharmacy' && order.pharmacyId?.toString() === req.user.id) ||
      (req.user.role === 'vendor' && order.vendorId?.toString() === req.user.id);

    if (!canUpdate) {
      return res.status(403).json({ success: false, error: 'Not authorized to update this order' });
    }

    // Validate status transition
    const validTransitions = {
      'pending': ['confirmed', 'cancelled'],
      'confirmed': ['preparing', 'cancelled'],
      'preparing': ['ready', 'cancelled'],
      'ready': ['out-for-delivery'],
      'out-for-delivery': ['delivered'],
      'delivered': ['refunded'],
      'cancelled': [],
      'refunded': []
    };

    if (!validTransitions[order.status]?.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: `Cannot transition from ${order.status} to ${status}` 
      });
    }

    order.addStatusUpdate(status, req.user.id, notes);

    // Set timestamps for specific statuses
    if (status === 'delivered') {
      order.actualDeliveryTime = new Date();
    } else if (status === 'confirmed') {
      order.acceptedAt = new Date();
    }

    await order.save();

    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT assign order to pharmacy/vendor
router.put('/:id/assign', authenticateToken, authorizeRoles(['pharmacy', 'vendor', 'admin']), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (order.isAssigned) {
      return res.status(400).json({ success: false, error: 'Order is already assigned' });
    }

    const assigneeId = req.user.role === 'admin' ? req.body.assigneeId : req.user.id;
    const assigneeName = req.user.role === 'admin' ? req.body.assigneeName : req.user.businessName || req.user.name;

    // Assign based on user role
    if (req.user.role === 'pharmacy' || req.body.assigneeType === 'pharmacy') {
      order.pharmacyId = assigneeId;
      order.pharmacyName = assigneeName;
    } else if (req.user.role === 'vendor' || req.body.assigneeType === 'vendor') {
      order.vendorId = assigneeId;
      order.vendorName = assigneeName;
    }

    order.isAssigned = true;
    order.assignedAt = new Date();
    order.assignedTo = assigneeId;
    order.status = 'confirmed';

    order.addStatusUpdate('confirmed', req.user.id, 'Order assigned and confirmed');

    await order.save();

    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT update order items (pharmacy/vendor only, before preparing)
router.put('/:id/items', authenticateToken, authorizeRoles(['pharmacy', 'vendor', 'admin']), async (req, res) => {
  try {
    const { items } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // Check authorization
    const canUpdate = 
      req.user.role === 'admin' ||
      order.pharmacyId?.toString() === req.user.id ||
      order.vendorId?.toString() === req.user.id;

    if (!canUpdate) {
      return res.status(403).json({ success: false, error: 'Not authorized to update this order' });
    }

    // Only allow updates before preparing
    if (!['pending', 'confirmed'].includes(order.status)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot update items after order preparation has started' 
      });
    }

    // Recalculate totals
    let subtotal = 0;
    const processedItems = items.map(item => {
      const totalPrice = item.quantity * item.unitPrice;
      subtotal += totalPrice;
      return { ...item, totalPrice };
    });

    const deliveryFee = subtotal >= 200 ? 0 : 15;
    const taxAmount = subtotal * 0.14;
    const totalAmount = subtotal + deliveryFee + taxAmount;

    order.items = processedItems;
    order.subtotal = subtotal;
    order.deliveryFee = deliveryFee;
    order.taxAmount = taxAmount;
    order.totalAmount = totalAmount;

    order.addStatusUpdate(order.status, req.user.id, 'Order items updated');

    await order.save();

    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT cancel order
router.put('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // Check if order can be cancelled
    if (!order.canBeCancelled()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Order cannot be cancelled at this stage' 
      });
    }

    // Check authorization
    const canCancel = 
      req.user.role === 'admin' ||
      order.customerId.toString() === req.user.id ||
      order.pharmacyId?.toString() === req.user.id ||
      order.vendorId?.toString() === req.user.id;

    if (!canCancel) {
      return res.status(403).json({ success: false, error: 'Not authorized to cancel this order' });
    }

    order.status = 'cancelled';
    order.cancelReason = reason;
    order.cancelledBy = req.user.id;
    order.addStatusUpdate('cancelled', req.user.id, reason || 'Order cancelled');

    await order.save();

    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET order analytics
router.get('/analytics/summary', authenticateToken, authorizeRoles(['admin', 'pharmacy', 'vendor']), async (req, res) => {
  try {
    let matchQuery = {};

    // Role-based filtering
    if (req.user.role === 'pharmacy') {
      matchQuery.pharmacyId = req.user.id;
    } else if (req.user.role === 'vendor') {
      matchQuery.vendorId = req.user.id;
    }

    const analytics = await Order.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          averageOrderValue: { $avg: '$totalAmount' },
          completedOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          },
          pendingOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          }
        }
      }
    ]);

    const statusBreakdown = await Order.aggregate([
      { $match: matchQuery },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const paymentBreakdown = await Order.aggregate([
      { $match: matchQuery },
      { $group: { _id: '$paymentMethod', count: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } }
    ]);

    const result = {
      summary: analytics[0] || {
        totalOrders: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        pendingOrders: 0
      },
      statusBreakdown: statusBreakdown.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      paymentBreakdown: paymentBreakdown.reduce((acc, item) => {
        acc[item._id] = { count: item.count, revenue: item.revenue };
        return acc;
      }, {})
    };

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE order (admin only)
router.delete('/:id', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    res.json({ success: true, message: 'Order deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;