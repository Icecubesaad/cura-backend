// First, update package.json dependencies:
// npm install cloudinary multer-storage-cloudinary

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Storage configurations for different image types
const createCloudinaryStorage = (folder) => {
  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: `multivendor-pharmacy/${folder}`,
      allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'webp'],
      transformation: [
        { width: 1000, height: 1000, crop: 'limit' },
        { quality: 'auto' }
      ],
      public_id: (req, file) => {
        const timestamp = Date.now();
        const randomId = Math.round(Math.random() * 1E9);
        return `${folder}_${timestamp}_${randomId}`;
      },
    },
  });
};

// Different storage configurations for different use cases
const profileStorage = createCloudinaryStorage('profiles');
const medicineStorage = createCloudinaryStorage('medicines');
const prescriptionStorage = createCloudinaryStorage('prescriptions');
const vendorProductStorage = createCloudinaryStorage('vendor-products');

// Multer upload configurations
const uploadProfile = multer({ 
  storage: profileStorage,
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1 
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

const uploadMedicine = multer({ 
  storage: medicineStorage,
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1 
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

const uploadPrescription = multer({ 
  storage: prescriptionStorage,
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 10 
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

const uploadVendorProduct = multer({ 
  storage: vendorProductStorage,
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 5 
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Helper function to delete image from Cloudinary
const deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
    throw error;
  }
};

// Helper function to extract public_id from Cloudinary URL
const extractPublicId = (cloudinaryUrl) => {
  if (!cloudinaryUrl) return null;
  
  try {
    const urlParts = cloudinaryUrl.split('/');
    const versionIndex = urlParts.findIndex(part => part.startsWith('v'));
    
    if (versionIndex !== -1 && versionIndex < urlParts.length - 1) {
      const pathAfterVersion = urlParts.slice(versionIndex + 1).join('/');
      return pathAfterVersion.split('.')[0]; // Remove file extension
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting public_id:', error);
    return null;
  }
};

module.exports = {
  cloudinary,
  uploadProfile,
  uploadMedicine,
  uploadPrescription,
  uploadVendorProduct,
  deleteImage,
  extractPublicId
};