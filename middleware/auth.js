const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to authenticate JWT tokens
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'Access token required' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Get user details
    const user = await User.findById(decoded.id).select('-password');
    if (!user || !user.isActive) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid or inactive user' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        error: 'Token expired' 
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid token' 
      });
    }

    return res.status(500).json({ 
      success: false, 
      error: 'Authentication failed' 
    });
  }
};

// Middleware to authorize specific roles
const authorizeRoles = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        error: `Access denied. Required roles: ${allowedRoles.join(', ')}` 
      });
    }

    next();
  };
};

// Middleware for optional authentication (user may or may not be logged in)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findById(decoded.id).select('-password');
    
    if (user && user.isActive) {
      req.user = user;
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
    // If token is invalid, just proceed without user
    req.user = null;
    next();
  }
};

// Middleware to check if user owns the resource or is admin
const checkOwnership = (resourceField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
    }

    // Admin can access everything
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user owns the resource
    const resourceUserId = req.params[resourceField] || req.body[resourceField];
    
    if (!resourceUserId || resourceUserId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. You can only access your own resources' 
      });
    }

    next();
  };
};

// Middleware to validate pharmacy/vendor permissions
const checkBusinessPermission = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
    }

    // Admin has all permissions
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user is pharmacy or vendor
    if (!['pharmacy', 'vendor'].includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Business account required' 
      });
    }

    // Check if account is verified
    if (!req.user.isVerified) {
      return res.status(403).json({ 
        success: false, 
        error: 'Account must be verified to perform this action' 
      });
    }

    next();
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Permission check failed' 
    });
  }
};

// Rate limiting middleware (basic implementation)
const rateLimitMap = new Map();

const rateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  return (req, res, next) => {
    const identifier = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    if (!rateLimitMap.has(identifier)) {
      rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const userLimit = rateLimitMap.get(identifier);
    
    if (now > userLimit.resetTime) {
      userLimit.count = 1;
      userLimit.resetTime = now + windowMs;
      return next();
    }

    if (userLimit.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((userLimit.resetTime - now) / 1000)
      });
    }

    userLimit.count++;
    next();
  };
};

// Middleware to validate request body
const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(detail => detail.message)
      });
    }

    next();
  };
};

// Middleware to log API requests
const logRequests = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      userId: req.user?.id || 'anonymous',
      timestamp: new Date().toISOString()
    };
    
    console.log('API Request:', JSON.stringify(logData));
  });
  
  next();
};

module.exports = {
  authenticateToken,
  authorizeRoles,
  optionalAuth,
  checkOwnership,
  checkBusinessPermission,
  rateLimit,
  validateRequest,
  logRequests
};