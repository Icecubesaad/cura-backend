const express = require('express');
const Order = require('../models/Order');
const Prescription = require('../models/Prescription');
const Pharmacy = require('../models/Pharmacy');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// Create order from processed prescription
router.post('/create', auth, authorize('customer'), async (req, res) => {
  try {
    const { prescriptionId, selectedMedicines, deliveryAddress } = req.body;

    const prescription = await Prescription.findById(prescriptionId)
      .populate('medicines.medicine');

    if (!prescription || prescription.customer.toString() !== req.user._id.toString()) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    if (prescription.status !== 'processed') {
      return res.status(400).json({ message: 'Prescription is not ready for ordering' });
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

    // Create order
    const order = new Order({
      customer: req.user._id,
      prescription: prescriptionId,
      items: orderItems,
      pharmacyOrders,
      totalAmount,
      deliveryAddress,
      paymentStatus: 'unpaid' // Set initial payment status
    });

    await order.save();

    // Update prescription status
    prescription.status = 'ready_for_order';
    await prescription.save();

    res.status(201).json({
      message: 'Order created successfully',
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount
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

    res.json({ message: 'Payment confirmed and order processed' });
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