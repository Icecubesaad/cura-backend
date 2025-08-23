const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Pharmacy = require('../models/Pharmacy');
const { authenticateToken, rateLimit } = require('../middleware/auth');

// Apply stricter rate limiting for auth routes
router.use(rateLimit(20, 15 * 60 * 1000)); // 20 requests per 15 minutes

// POST register user
router.post('/register', async (req, res) => {
  try {
    const {
      name,
      nameAr,
      email,
      phone,
      password,
      role = 'customer',
      dateOfBirth,
      gender,
      addresses,
      businessName,
      businessNameAr,
      businessType,
      licenseNumber,
      taxNumber,
      cityId,
      governorateId,
      coordinates,
      businessAddress,
      workingHours,
      specialties,
      features
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { phone }] 
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User with this email or phone already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user data
    const userData = {
      name,
      nameAr,
      email,
      phone,
      password: hashedPassword,
      role,
      dateOfBirth,
      gender,
      addresses,
      businessName,
      businessNameAr,
      businessType,
      licenseNumber,
      taxNumber,
      cityId,
      governorateId,
      coordinates,
      businessAddress,
      workingHours,
      specialties,
      features
    };

    const user = new User(userData);
    await user.save();

    // If pharmacy role, create pharmacy profile
    if (role === 'pharmacy') {
      const pharmacyData = {
        owner: user._id,
        name: businessName,
        nameAr: businessNameAr,
        licenseNumber,
        cityId,
        cityName: businessAddress?.city || '',
        governorateId,
        phone,
        email,
        address: businessAddress,
        coordinates,
        workingHours: workingHours || { open: '09:00', close: '22:00', is24Hours: false },
        specialties: specialties || [],
        features: features || [],
        deliveryService: false,
        createdBy: user._id
      };

      const pharmacy = new Pharmacy(pharmacyData);
      await pharmacy.save();
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: userResponse,
        token,
        expiresIn: '7d'
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST login user
router.post('/login', async (req, res) => {
  try {
    const { email, password, rememberMe = false } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Account is deactivated. Please contact support'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // Generate JWT token
    const expiresIn = rememberMe ? '30d' : '7d';
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn }
    );

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    // Get additional profile data based on role
    let additionalData = {};
    if (user.role === 'pharmacy') {
      additionalData.pharmacy = await Pharmacy.findOne({ owner: user._id });
    }

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userResponse,
        ...additionalData,
        token,
        expiresIn
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
});

// POST refresh token
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    // Generate new token
    const token = jwt.sign(
      { id: req.user._id, role: req.user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      data: {
        token,
        expiresIn: '7d'
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Token refresh failed'
    });
  }
});

// GET current user profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get additional profile data based on role
    let additionalData = {};
    if (user.role === 'pharmacy') {
      additionalData.pharmacy = await Pharmacy.findOne({ owner: user._id });
    }

    res.json({
      success: true,
      data: {
        user,
        ...additionalData
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get user profile'
    });
  }
});

// PUT update user profile
router.put('/me', authenticateToken, async (req, res) => {
  try {
    const updateData = { ...req.body };
    
    // Remove sensitive fields that shouldn't be updated via this route
    delete updateData.password;
    delete updateData.role;
    delete updateData.isActive;
    delete updateData.isVerified;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
});

// PUT change password
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'All password fields are required'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'New password and confirmation do not match'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters long'
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedNewPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to change password'
    });
  }
});

// POST logout (client-side mainly, but we can blacklist tokens if needed)
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // In a production app, you might want to blacklist the token
    // For now, we'll just send a success response
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
});

// POST forgot password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if email exists or not
      return res.json({
        success: true,
        message: 'If the email exists, a reset link has been sent'
      });
    }

    // In a real app, you would:
    // 1. Generate a reset token
    // 2. Save it to the database with expiration
    // 3. Send email with reset link
    
    // For now, just return success
    res.json({
      success: true,
      message: 'If the email exists, a reset link has been sent'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to process password reset request'
    });
  }
});

// POST reset password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    if (!token || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Passwords do not match'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long'
      });
    }

    // In a real app, you would:
    // 1. Verify the reset token
    // 2. Check if it's not expired
    // 3. Find the user and update password
    
    res.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to reset password'
    });
  }
});

// POST verify email
router.post('/verify-email', authenticateToken, async (req, res) => {
  try {
    const { verificationCode } = req.body;

    if (!verificationCode) {
      return res.status(400).json({
        success: false,
        error: 'Verification code is required'
      });
    }

    // In a real app, you would verify the code
    // For now, just mark as verified
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { 
        isVerified: true,
        emailVerifiedAt: new Date()
      },
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Email verified successfully',
      data: { user }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Email verification failed'
    });
  }
});

// POST resend verification email
router.post('/resend-verification', authenticateToken, async (req, res) => {
  try {
    // In a real app, you would send a new verification email
    
    res.json({
      success: true,
      message: 'Verification email sent'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to send verification email'
    });
  }
});

// GET check email availability
router.get('/check-email/:email', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    
    res.json({
      success: true,
      data: {
        available: !user,
        email: req.params.email
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to check email availability'
    });
  }
});

// GET check phone availability
router.get('/check-phone/:phone', async (req, res) => {
  try {
    const user = await User.findOne({ phone: req.params.phone });
    
    res.json({
      success: true,
      data: {
        available: !user,
        phone: req.params.phone
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to check phone availability'
    });
  }
});

module.exports = router;