const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Generate referral code for doctors
const generateReferralCode = () => {
  return Math.random().toString(36).substr(2, 8).toUpperCase();
};

// Register
router.post('/register', [
  body('firstName').notEmpty().withMessage('Name is required'),
  body('lastName').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').notEmpty().withMessage('Phone is required'),
  body('role').isIn(['customer', 'pharmacy', 'vendor']).withMessage('Invalid role')
], async (req, res) => {
  try {
    console.log('request recieved')
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('error with validaiton', errors)
      return res.status(400).json({ errors: errors.array() });
    }

    const { firstName, lastName, email, password, phone, role, whatsapp } = req.body;
    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('user already exist')
      return res.status(400).json({ message: 'User already exists' });
    }

    const userData = { firstName, lastName, whatsapp, email, password, phone, role };

    // If customer used a referral code, find the referring doctor
    // if (role === 'customer' && referralCode) {
    //   const referringDoctor = await User.findOne({ referralCode, role: 'doctor' });
    //   if (referringDoctor) {
    //     userData.referredBy = referringDoctor._id;
    //   }
    // }

    const user = new User(userData);
    await user.save();

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '7d' }
    );
    console.log(user)
    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.firstName + " " + user.lastName,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage,
        phone:user.phone,
        whatsappNumber:user.whatsapp,
        credits: user.role === 'customer' ? user.credits : undefined
      }
    });
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(400).json({ message: 'Account is deactivated' });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      user: {
        id: user._id,
        name: user.firstName+ " " + user.lastName,
        phone:user.phone,
        whatsappNumber:user.whatsapp,
        email: user.email,
        role: user.role,
        referralCode: user.referralCode,
        profileImage: user.profileImage,
        credits: user.role === 'customer' ? user.credits : undefined
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      referralCode: user.referralCode,
      phone: user.phone,
      address: user.address,
      profileImage: user.profileImage,
      credits: user.role === 'customer' ? user.credits : undefined,
      isActive: user.isActive
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Change password
router.put('/change-password', auth, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Forgot password (basic implementation - you may want to integrate email service)
router.post('/forgot-password', [
  body('email').isEmail().withMessage('Valid email is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if email exists for security
      return res.json({ message: 'If this email exists, a password reset link has been sent' });
    }

    // In a real application, you would:
    // 1. Generate a reset token
    // 2. Save it to the user with expiration
    // 3. Send email with reset link
    // For now, just return success message

    res.json({ message: 'If this email exists, a password reset link has been sent' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Verify referral code
router.get('/verify-referral/:code', async (req, res) => {
  try {
    const { code } = req.params;

    const doctor = await User.findOne({ 
      referralCode: code, 
      role: 'doctor',
      isActive: true 
    }).select('name profileImage');

    if (!doctor) {
      return res.status(404).json({ message: 'Invalid referral code' });
    }

    res.json({ 
      message: 'Valid referral code',
      doctor: {
        name: doctor.name,
        profileImage: doctor.profileImage
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;