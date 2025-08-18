const express = require('express');
const Order = require('../models/Order');
const Prescription = require('../models/Prescription');
const Pharmacy = require('../models/Pharmacy');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// Create order from processed prescription with credit system
router.post('/create', auth, authorize('customer'), async (req, res) => {
  try {
    const { prescriptionId, selectedMedicines, deliveryAddress, useCredits = 0 } = req.body;

    const prescription = await Prescription.findById(prescriptionId)
      .populate('medicines.medicine');

    if (!prescription || prescription.customer.toString() !== req.user._id.toString()) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    if (prescription.status !== 'processed') {
      return res.status(400).json({ message: 'Prescription is not ready for ordering' });
    }

    // Get user with credits
    const customer = await User.findById(req.user._id);
    
    // Validate credit usage
    if (useCredits > customer.credits) {
      return res.status(400).json({ message: 'Insufficient credits' });
    }

    // Build order items and group by pharmacy
    const pharmacyOrdersMap = new Map();
    let totalAmount = 0;
    const orderItems = [];

    for (const selectedMedicine of selectedMedicines) {
      const { medicineId, pharmacyId, quantity } = selectedMedicine;

      // Find the pharmacy and check inventory
      const pharmacy = await Pharmacy.findById(pharmacyId);
      if (!pharmacy) {
        return res.status(404).json({ message: `Pharmacy not found for medicine ${medicineId}` });
      }

      const inventoryItem = pharmacy.inventory.find(
        item => item.medicine.toString() === medicineId && 
                item.quantity >= quantity && 
                item.expiryDate > new Date()
      );

      if (!inventoryItem) {
        return res.status(400).json({ 
          message: `Medicine not available or insufficient quantity at selected pharmacy` 
        });
      }

      const itemTotal = inventoryItem.price * quantity;
      totalAmount += itemTotal;

      const orderItem = {
        medicine: medicineId,
        pharmacy: pharmacyId,
        quantity,
        price: inventoryItem.price,
        totalPrice: itemTotal
      };

      orderItems.push(orderItem);

      // Group by pharmacy
      if (!pharmacyOrdersMap.has(pharmacyId)) {
        pharmacyOrdersMap.set(pharmacyId, {
          pharmacy: pharmacyId,
          items: [],
          subtotal: 0
        });
      }

      const pharmacyOrder = pharmacyOrdersMap.get(pharmacyId);
      pharmacyOrder.items.push({
        medicine: medicineId,
        quantity,
        price: inventoryItem.price,
        totalPrice: itemTotal
      });
      pharmacyOrder.subtotal += itemTotal;
    }

    const pharmacyOrders = Array.from(pharmacyOrdersMap.values());
    
    // Calculate final amount after credits
    const finalAmount = Math.max(0, totalAmount - useCredits);

    // Create order
    const order = new Order({
      customer: req.user._id,
      prescription: prescriptionId,
      items: orderItems,
      pharmacyOrders,
      totalAmount,
      creditsUsed: useCredits,
      finalAmount,
      deliveryAddress,
      paymentStatus: finalAmount === 0 ? 'paid' : 'pending'
    });

    await order.save();

    // Use credits if any
    if (useCredits > 0) {
      customer.useCredits(useCredits, `Used for order ${order.orderNumber}`, order._id);
      await customer.save();
    }

    // Update prescription status
    prescription.status = 'ready_for_order';
    await prescription.save();

    res.status(201).json({
      message: 'Order created successfully',
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        creditsUsed: order.creditsUsed,
        finalAmount: order.finalAmount
      }
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update order status after payment (e.g., Cash on Delivery)
router.post('/:orderId/confirm-payment', auth, authorize('customer'), async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order || order.customer.toString() !== req.user._id.toString()) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ message: 'Payment already confirmed' });
    }

    // Update order payment status
    order.paymentStatus = 'paid';
    order.overallStatus = 'processing';
    await order.save();

    // Update pharmacy inventories
    for (const item of order.items) {
      const pharmacy = await Pharmacy.findById(item.pharmacy);
      const inventoryItem = pharmacy.inventory.find(
        inv => inv.medicine.toString() === item.medicine.toString()
      );
      
      if (inventoryItem && inventoryItem.quantity >= item.quantity) {
        inventoryItem.quantity -= item.quantity;
        await pharmacy.save();
      }
    }

    // Award credits (5% of total amount as example)
    const customer = await User.findById(req.user._id);
    const creditsEarned = Math.floor(order.totalAmount * 0.05);
    if (creditsEarned > 0) {
      customer.addCredits(creditsEarned, 'earned', `Earned from order ${order.orderNumber}`, order._id);
      await customer.save();
    }

    // Notify pharmacies about new orders
    const io = req.app.get('io');
    for (const pharmacyOrder of order.pharmacyOrders) {
      io.to(`pharmacy_${pharmacyOrder.pharmacy}`).emit('new_order', {
        orderId: order._id,
        orderNumber: order.orderNumber,
        customer: req.user.name,
        items: pharmacyOrder.items,
        subtotal: pharmacyOrder.subtotal
      });
    }

    res.json({ 
      message: 'Payment confirmed and order processed',
      creditsEarned
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Request return for order items
router.post('/:orderId/return-request', auth, authorize('customer'), async (req, res) => {
  try {
    const { items, reason } = req.body; // items: [{ itemId, quantity, reason }]
    
    const order = await Order.findById(req.params.orderId)
      .populate('items.medicine', 'name brand');
      
    if (!order || order.customer.toString() !== req.user._id.toString()) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.overallStatus !== 'delivered') {
      return res.status(400).json({ message: 'Can only return delivered orders' });
    }

    // Check if return window is valid (e.g., within 7 days)
    const deliveredDate = order.updatedAt;
    const daysSinceDelivery = (new Date() - deliveredDate) / (1000 * 60 * 60 * 24);
    if (daysSinceDelivery > 7) {
      return res.status(400).json({ message: 'Return window has expired (7 days)' });
    }

    // Validate items and calculate refund
    let refundAmount = 0;
    const validItems = [];

    for (const returnItem of items) {
      const orderItem = order.items.id(returnItem.itemId);
      if (!orderItem) {
        return res.status(400).json({ message: 'Invalid item ID' });
      }

      if (orderItem.returnStatus !== 'not_returned') {
        return res.status(400).json({ message: `Item ${orderItem.medicine.name} already has a return request` });
      }

      if (returnItem.quantity > orderItem.quantity) {
        return res.status(400).json({ message: 'Return quantity cannot exceed ordered quantity' });
      }

      const itemRefund = (orderItem.price * returnItem.quantity);
      refundAmount += itemRefund;

      validItems.push({
        itemId: returnItem.itemId,
        quantity: returnItem.quantity,
        reason: returnItem.reason || reason
      });

      // Update item return status
      orderItem.returnStatus = 'return_requested';
      orderItem.returnRequestedAt = new Date();
      orderItem.returnReason = returnItem.reason || reason;
    }

    // Add return request to order
    order.returnRequests.push({
      items: validItems,
      refundAmount
    });

    await order.save();

    // Notify admin about return request
    const io = req.app.get('io');
    io.to('admin').emit('return_request', {
      orderId: order._id,
      orderNumber: order.orderNumber,
      customer: req.user.name,
      refundAmount,
      items: validItems.length
    });

    res.json({ 
      message: 'Return request submitted successfully',
      refundAmount,
      returnRequestId: order.returnRequests[order.returnRequests.length - 1]._id
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Process return request (Admin only)
router.put('/return-requests/:returnRequestId/process', auth, authorize('admin'), async (req, res) => {
  try {
    const { orderId, status, adminNotes } = req.body; // status: 'approved' or 'rejected'
    
    const order = await Order.findById(orderId)
      .populate('customer', 'name email credits');
      
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const returnRequest = order.returnRequests.id(req.params.returnRequestId);
    if (!returnRequest) {
      return res.status(404).json({ message: 'Return request not found' });
    }

    if (returnRequest.status !== 'pending') {
      return res.status(400).json({ message: 'Return request already processed' });
    }

    returnRequest.status = status;
    returnRequest.processedAt = new Date();
    returnRequest.adminNotes = adminNotes;

    if (status === 'approved') {
      // Add credits to customer account as refund
      const customer = await User.findById(order.customer._id);
      customer.addCredits(
        returnRequest.refundAmount, 
        'refund', 
        `Refund for returned items from order ${order.orderNumber}`,
        order._id
      );
      await customer.save();

      // Update item return status
      for (const returnItem of returnRequest.items) {
        const orderItem = order.items.id(returnItem.itemId);
        orderItem.returnStatus = 'returned';
      }

      // Update payment status if partially refunded
      const hasNonReturnedItems = order.items.some(item => item.returnStatus === 'not_returned');
      if (!hasNonReturnedItems) {
        order.paymentStatus = 'refunded';
      } else {
        order.paymentStatus = 'partially_refunded';
      }
    } else {
      // Reset item return status for rejected returns
      for (const returnItem of returnRequest.items) {
        const orderItem = order.items.id(returnItem.itemId);
        orderItem.returnStatus = 'not_returned';
        orderItem.returnRequestedAt = undefined;
        orderItem.returnReason = undefined;
      }
    }

    await order.save();

    // Notify customer
    const io = req.app.get('io');
    io.to(`customer_${order.customer._id}`).emit('return_processed', {
      orderId: order._id,
      orderNumber: order.orderNumber,
      status,
      refundAmount: status === 'approved' ? returnRequest.refundAmount : 0,
      message: `Your return request has been ${status}`
    });

    res.json({ 
      message: `Return request ${status} successfully`,
      refundAmount: status === 'approved' ? returnRequest.refundAmount : 0
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get customer orders
router.get('/my-orders', auth, authorize('customer'), async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.user._id })
      .populate('items.medicine', 'name brand strength')
      .populate('pharmacyOrders.pharmacy', 'name address')
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get customer credits and history
router.get('/my-credits', auth, authorize('customer'), async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('creditHistory.orderId', 'orderNumber')
      .select('credits creditHistory');

    res.json({
      credits: user.credits,
      history: user.creditHistory.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get return requests (Admin)
router.get('/return-requests', auth, authorize('admin'), async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query;
    
    const orders = await Order.find({
      'returnRequests.status': status
    })
    .populate('customer', 'name email phone')
    .populate('items.medicine', 'name brand')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ 'returnRequests.requestedAt': -1 });

    // Filter and format return requests
    const returnRequests = [];
    orders.forEach(order => {
      order.returnRequests.forEach(request => {
        if (request.status === status) {
          returnRequests.push({
            _id: request._id,
            order: {
              _id: order._id,
              orderNumber: order.orderNumber,
              customer: order.customer
            },
            items: request.items,
            refundAmount: request.refundAmount,
            status: request.status,
            requestedAt: request.requestedAt,
            processedAt: request.processedAt,
            adminNotes: request.adminNotes
          });
        }
      });
    });

    res.json({ returnRequests });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get pharmacy orders
router.get('/pharmacy-orders', auth, authorize('pharmacy'), async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findOne({ owner: req.user._id });
    if (!pharmacy) {
      return res.status(400).json({ message: 'Pharmacy profile not found' });
    }

    const orders = await Order.find({
      'pharmacyOrders.pharmacy': pharmacy._id,
      paymentStatus: 'paid'
    })
    .populate('customer', 'name phone email')
    .populate('items.medicine', 'name brand strength')
    .sort({ createdAt: -1 });

    // Filter to show only this pharmacy's orders
    const pharmacyOrders = orders.map(order => {
      const pharmacyOrder = order.pharmacyOrders.find(
        po => po.pharmacy.toString() === pharmacy._id.toString()
      );
      
      return {
        ...order.toObject(),
        pharmacyOrder,
        items: order.items.filter(item => 
          item.pharmacy.toString() === pharmacy._id.toString()
        )
      };
    });

    res.json(pharmacyOrders);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update pharmacy order status
router.put('/pharmacy-orders/:orderId/status', auth, authorize('pharmacy'), async (req, res) => {
  try {
    const { status, estimatedDelivery } = req.body;
    
    const pharmacy = await Pharmacy.findOne({ owner: req.user._id });
    if (!pharmacy) {
      return res.status(400).json({ message: 'Pharmacy profile not found' });
    }

    const order = await Order.findById(req.params.orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Update pharmacy order status
    const pharmacyOrder = order.pharmacyOrders.find(
      po => po.pharmacy.toString() === pharmacy._id.toString()
    );

    if (!pharmacyOrder) {
      return res.status(404).json({ message: 'Pharmacy order not found' });
    }

    pharmacyOrder.status = status;
    if (estimatedDelivery) {
      pharmacyOrder.estimatedDelivery = estimatedDelivery;
    }

    // Update overall order status based on all pharmacy orders
    const allStatuses = order.pharmacyOrders.map(po => po.status);
    if (allStatuses.every(s => s === 'delivered')) {
      order.overallStatus = 'delivered';
    } else if (allStatuses.some(s => s === 'dispatched')) {
      order.overallStatus = 'dispatched';
    } else if (allStatuses.every(s => ['ready', 'dispatched', 'delivered'].includes(s))) {
      order.overallStatus = 'ready';
    }

    await order.save();

    // Notify customer
    const io = req.app.get('io');
    io.to(`customer_${order.customer}`).emit('order_update', {
      orderId: order._id,
      pharmacyName: pharmacy.name,
      status,
      message: `Your order status has been updated to: ${status}`
    });

    res.json({ message: 'Order status updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;