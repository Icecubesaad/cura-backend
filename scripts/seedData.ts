const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Import models
const User = require('../models/User');
const Pharmacy = require('../models/Pharmacy');
const Vendor = require('../models/Vendor');
const Order = require('../models/Order');
const Product = require('../models/Product');
const City = require('../models/City')
// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect('mongodb+srv://saadqad418:pharmacy@cluster0.unjjgnx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Clear existing data
const clearDatabase = async () => {
  try {
    await User.deleteMany({});
    await Pharmacy.deleteMany({});
    await Vendor.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});
    console.log('Database cleared successfully');
  } catch (error) {
    console.error('Error clearing database:', error);
  }
};

// Create users
const createUsers = async () => {
  try {
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    const users = [
      {
        firstName: 'Ahmed',
        lastName: 'Hassan',
        email: 'ahmed.customer@test.com',
        password: hashedPassword,
        phone: '+201234567890',
        whatsapp: '+201234567890',
        role: 'customer',
        address: '123 Main Street, Cairo, Egypt',
        credits: 100,
        creditHistory: [
          {
            type: 'bonus',
            amount: 100,
            description: 'Welcome bonus credits',
            createdAt: new Date()
          }
        ]
      },
      {
        firstName: 'Dr. Mona',
        lastName: 'Ali',
        email: 'mona.pharmacy@test.com',
        password: hashedPassword,
        phone: '+201234567891',
        whatsapp: '+201234567891',
        role: 'pharmacy',
        address: '456 Pharmacy Street, Alexandria, Egypt',
        pharmacyId: 'PH001',
        doctorLicense: 'DL12345'
      },
      {
        firstName: 'Omar',
        lastName: 'Mohamed',
        email: 'omar.vendor@test.com',
        password: hashedPassword,
        phone: '+201234567892',
        whatsapp: '+201234567892',
        role: 'vendor',
        address: '789 Business Avenue, Giza, Egypt',
        vendorId: 'VD001'
      },
      {
        firstName: 'Sara',
        lastName: 'Ahmed',
        email: 'sara.admin@test.com',
        password: hashedPassword,
        phone: '+201234567893',
        whatsapp: '+201234567893',
        role: 'prescription-reader',
        address: '321 Admin Building, Cairo, Egypt'
      }
    ];

    const createdUsers = await User.insertMany(users);
    console.log('Users created successfully:', createdUsers.length);
    return createdUsers;
  } catch (error) {
    console.error('Error creating users:', error);
    throw error;
  }
};

// Create pharmacy
// Create pharmacy
const createPharmacy = async (pharmacyOwner) => {
  try {
    const pharmacy = new Pharmacy({
      owner: pharmacyOwner._id,
      name: 'Al-Shifa Pharmacy',
      licenseNumber: 'PH2024001',
      cityId: 'Ismail',
      cityName: 'ismailia-city',
      phone: '+201234567891',
      email: 'info@alshifa-pharmacy.com',
      website: 'www.alshifa-pharmacy.com',
      
      // ADD THESE MISSING REQUIRED FIELDS AT ROOT LEVEL
      coordinates: {
        lat: 31.2001,
        lng: 29.9187
      },
      governorateId: 'GOV-123', // This was missing completely
      
      address: {
        street: '456 Pharmacy Street',
        area: 'Smouha',
        city: 'Alexandria',
        state: 'Alexandria Governorate',
        zipCode: '21500',
        country: 'Egypt',
        // Remove coordinates from here if they're required at root level
        // coordinates: {
        //   lat: 31.2001,
        //   lng: 29.9187
        // },
        landmark: 'Near Carrefour Mall'
      },
      
      operatingHours: {
        monday: { isOpen: true, open: '09:00', close: '22:00' },
        tuesday: { isOpen: true, open: '09:00', close: '22:00' },
        wednesday: { isOpen: true, open: '09:00', close: '22:00' },
        thursday: { isOpen: true, open: '09:00', close: '22:00' },
        friday: { isOpen: true, open: '09:00', close: '22:00' },
        saturday: { isOpen: true, open: '09:00', close: '22:00' },
        sunday: { isOpen: false, open: '10:00', close: '20:00' }
      },
      services: [
        'prescription_filling', 'otc_medicines', 'health_consultation',
        'blood_pressure_check', 'home_delivery', 'online_ordering'
      ],
      specializations: [
        'family_medicine', 'diabetes_care', 'pediatric'
      ],
      staff: [
        {
          name: 'Dr. Mona Ali',
          role: 'pharmacist',
          licenseNumber: 'PH12345',
          qualification: 'PharmD',
          experience: 8,
          isActive: true
        },
        {
          name: 'Ahmed Mahmoud',
          role: 'assistant',
          qualification: 'Pharmacy Technician',
          experience: 3,
          isActive: true
        }
      ],
      rating: 4.5,
      totalRatings: 120,
      ratingBreakdown: {
        five: 70,
        four: 30,
        three: 15,
        two: 3,
        one: 2
      },
      establishedYear: 2015,
      paymentMethods: ['cash', 'credit_card', 'mobile_payment'],
      deliveryService: true,
      features: [
        'parking_available', 'wheelchair_accessible', '24_hours',
        'online_consultation', 'loyalty_program'
      ],
      isActive: true,
      isVerified: true,
      verificationStatus: 'verified',
      verifiedAt: new Date(),
      currentStatus: 'open'
    });

    const createdPharmacy = await pharmacy.save();
    console.log('Pharmacy created successfully');
    return createdPharmacy;
  } catch (error) {
    console.error('Error creating pharmacy:', error);
    throw error;
  }
};

// Create vendor
const createVendor = async (vendorOwner) => {
  try {
    const vendor = new Vendor({
      owner: vendorOwner._id,
      businessName: 'HealthCare Supplies Co.',
      businessLicense: 'BL2024001',
      address: {
        street: '789 Business Avenue',
        city: 'Giza',
        state: 'Giza Governorate',
        zipCode: '12511',
        country: 'Egypt'
      },
      phone: '+201234567892',
      email: 'info@healthcare-supplies.com',
      products: [
        {
          name: 'Digital Blood Pressure Monitor',
          category: 'Medical Devices',
          description: 'Accurate digital BP monitor with large LCD display',
          price: 450,
          quantity: 25,
          images: [
            {
              url: 'https://example.com/bp-monitor.jpg',
              publicId: 'bp_monitor_001'
            }
          ],
          isActive: true
        },
        {
          name: 'Thermometer Digital',
          category: 'Medical Devices',
          description: 'Fast and accurate digital thermometer',
          price: 85,
          quantity: 50,
          images: [
            {
              url: 'https://example.com/thermometer.jpg',
              publicId: 'thermometer_001'
            }
          ],
          isActive: true
        },
        {
          name: 'First Aid Kit',
          category: 'Medical Supplies',
          description: 'Complete first aid kit for home and travel',
          price: 180,
          quantity: 30,
          images: [
            {
              url: 'https://example.com/first-aid-kit.jpg',
              publicId: 'first_aid_001'
            }
          ],
          isActive: true
        }
      ],
      rating: 4.2,
      totalRatings: 45,
      isVerified: true,
      isActive: true
    });

    const createdVendor = await vendor.save();
    console.log('Vendor created successfully');
    return createdVendor;
  } catch (error) {
    console.error('Error creating vendor:', error);
    throw error;
  }
};
  


const createProducts = async () => {
  try {
      const allProductsData = [
        // Medicines
        {
            name: "Amoxicillin 500mg",
            nameAr: "أموكسيسيلين ٥٠٠ ملغ",
            category: "antibiotic",
            prescription: true,
            description: "Broad-spectrum antibiotic for bacterial infections",
            descriptionAr: "مضاد حيوي واسع الطيف للعدوى البكتيرية",
            manufacturer: "GlaxoSmithKline",
            manufacturerAr: "جلاكسو سميث كلاين",
            activeIngredient: "Amoxicillin Trihydrate",
            activeIngredientAr: "أموكسيسيلين تريهيدرات",
            dosage: "500mg three times daily",
            dosageAr: "٥٠٠ ملغ ثلاث مرات يومياً",
            packSize: "21 Capsules",
            packSizeAr: "٢١ كبسولة",
            pharmacyId: "PHARM001",
            pharmacy: "Al-Shifa Pharmacy",
            pharmacyAr: "صيدلية الشفاء",
            cityId: "ISM001",
            cityName: "ismailia-city",
            governorateId: "SUE001",
            price: 250,
            originalPrice: 280,
            discount: 10.7,
            inStock: true,
            expiryDate: "2026-03-15",
            batchNumber: "AMX2024001",
            availability: {
                inStock: true,
                quantity: 45,
                lowStockThreshold: 10,
                estimatedRestockDate: null,
            },
            delivery: {
                availableForDelivery: true,
                estimatedDeliveryTime: "2-3 hours",
                deliveryFee: 50,
            },
            image: "/images/amoxicillin-500mg.jpg",
            rating: 4.3,
            reviews: 127,
            barcode: "2323456789012",
            tags: ["antibiotic", "bacterial infection", "prescription"],
            isActive: true,
            productType: "medicine",
        },
        {
            name: "Metformin 850mg",
            nameAr: "ميتفورمين ٨٥٠ ملغ",
            category: "antidiabetic",
            prescription: true,
            description: "Type 2 diabetes management medication",
            descriptionAr: "دواء لإدارة مرض السكري من النوع الثاني",
            manufacturer: "Boehringer Ingelheim",
            manufacturerAr: "بورنجر إنجلهايم",
            activeIngredient: "Metformin Hydrochloride",
            activeIngredientAr: "ميتفورمين هيدروكلوريد",
            dosage: "850mg twice daily with meals",
            dosageAr: "٨٥٠ ملغ مرتين يومياً مع الوجبات",
            packSize: "60 Tablets",
            packSizeAr: "٦٠ حبة",
            pharmacyId: "PHARM003",
            pharmacy: "City Pharmacy",
            pharmacyAr: "صيدلية المدينة",
            cityId: "ISM001",
            cityName: "ismailia-city",
            governorateId: "SUE001",
            price: 420,
            originalPrice: 420,
            discount: 0,
            inStock: true,
            expiryDate: "2026-08-30",
            batchNumber: "MET2024156",
            availability: {
                inStock: true,
                quantity: 28,
                lowStockThreshold: 15,
                estimatedRestockDate: null,
            },
            delivery: {
                availableForDelivery: true,
                estimatedDeliveryTime: "3-4 hours",
                deliveryFee: 75,
            },
            image: "/images/metformin-850mg.jpg",
            rating: 4.1,
            reviews: 89,
            barcode: "6223456789034",
            tags: ["diabetes", "prescription", "blood sugar"],
            isActive: true,
            productType: "medicine",
        },
        {
            name: "Amlodipine 5mg",
            nameAr: "أملوديبين ٥ ملغ",
            category: "antihypertensive",
            prescription: true,
            description: "Calcium channel blocker for high blood pressure",
            descriptionAr: "حاصر قنوات الكالسيوم لارتفاع ضغط الدم",
            manufacturer: "Pfizer",
            manufacturerAr: "فايزر",
            activeIngredient: "Amlodipine Besylate",
            activeIngredientAr: "أملوديبين بيسيلات",
            dosage: "5mg once daily",
            dosageAr: "٥ ملغ مرة واحدة يومياً",
            packSize: "30 Tablets",
            packSizeAr: "٣٠ حبة",
            pharmacyId: "PHARM004",
            pharmacy: "Medicare Pharmacy",
            pharmacyAr: "صيدلية ميديكير",
            cityId: "ISM001",
            cityName: "ismailia-city",
            governorateId: "SUE001",
            price: 315,
            originalPrice: 350,
            discount: 10,
            inStock: false,
            expiryDate: "2026-05-25",
            batchNumber: "AML2024203",
            availability: {
                inStock: false,
                quantity: 0,
                lowStockThreshold: 12,
                estimatedRestockDate: "2025-08-25",
            },
            delivery: {
                availableForDelivery: false,
                estimatedDeliveryTime: "N/A",
                deliveryFee: 0,
            },
            image: "/images/amlodipine-5mg.jpg",
            rating: 4.2,
            reviews: 156,
            barcode: "6223456789056",
            tags: ["blood pressure", "hypertension", "prescription"],
            isActive: true,
            productType: "medicine",
        },
        {
            name: "Loratadine 10mg",
            nameAr: "لوراتادين ١٠ ملغ",
            category: "antihistamine",
            prescription: false,
            description: "24-hour allergy relief, non-drowsy formula",
            descriptionAr: "راحة من الحساسية لمدة ٢٤ ساعة، تركيبة غير منومة",
            manufacturer: "Merck Sharp & Dohme",
            manufacturerAr: "ميرك شارب آند دوم",
            activeIngredient: "Loratadine",
            activeIngredientAr: "لوراتادين",
            dosage: "10mg once daily",
            dosageAr: "١٠ ملغ مرة واحدة يومياً",
            packSize: "14 Tablets",
            packSizeAr: "١٤ حبة",
            pharmacyId: "PHARM008",
            pharmacy: "Health Plus Pharmacy",
            pharmacyAr: "صيدلية هيلث بلس",
            cityId: "ISM001",
            cityName: "ismailia-city",
            governorateId: "SUE001",
            price: 156,
            originalPrice: 175,
            discount: 10.9,
            inStock: true,
            expiryDate: "2026-09-12",
            batchNumber: "LOR2024567",
            availability: {
                inStock: true,
                quantity: 89,
                lowStockThreshold: 30,
                estimatedRestockDate: null,
            },
            delivery: {
                availableForDelivery: false,
                estimatedDeliveryTime: "N/A",
                deliveryFee: 0,
            },
            image: "/images/loratadine-10mg.jpg",
            rating: 4.5,
            reviews: 167,
            barcode: "6223456789090",
            tags: ["allergy", "antihistamine", "non-drowsy", "seasonal"],
            isActive: true,
            productType: "medicine",
        },
        {
            name: "Lactobacillus Complex",
            nameAr: "مركب اللاكتوباسيلس",
            category: "probiotic",
            prescription: false,
            description: "Multi-strain probiotic for digestive health",
            descriptionAr: "بروبيوتيك متعدد السلالات لصحة الجهاز الهضمي",
            manufacturer: "Garden of Life",
            manufacturerAr: "جاردن أوف لايف",
            activeIngredient: "Lactobacillus acidophilus, Bifidobacterium",
            activeIngredientAr: "لاكتوباسيلس أسيدوفيلس، بيفيدوباكتيريوم",
            dosage: "1 capsule daily on empty stomach",
            dosageAr: "كبسولة واحدة يومياً على معدة فارغة",
            packSize: "30 Capsules",
            packSizeAr: "٣٠ كبسولة",
            pharmacyId: "PHARM009",
            pharmacy: "Wellness Pharmacy",
            pharmacyAr: "صيدلية العافية",
            cityId: "ISM001",
            cityName: "ismailia-city",
            governorateId: "SUE001",
            price: 1250,
            originalPrice: 1400,
            discount: 10.7,
            inStock: true,
            expiryDate: "2026-04-20",
            batchNumber: "LAC2024890",
            availability: {
                inStock: true,
                quantity: 19,
                lowStockThreshold: 10,
                estimatedRestockDate: null,
            },
            delivery: {
                availableForDelivery: true,
                estimatedDeliveryTime: "4-6 hours",
                deliveryFee: 100,
            },
            image: "/images/lactobacillus-complex.jpg",
            rating: 4.6,
            reviews: 112,
            barcode: "6223456789101",
            tags: ["probiotic", "digestive health", "gut health", "supplement"],
            isActive: true,
            productType: "medicine",
        },
        {
            name: "Salbutamol Inhaler",
            nameAr: "بخاخ سالبوتامول",
            category: "bronchodilator",
            prescription: true,
            description: "Quick relief for asthma and breathing difficulties",
            descriptionAr: "راحة سريعة للربو وصعوبات التنفس",
            manufacturer: "AstraZeneca",
            manufacturerAr: "أسترازينيكا",
            activeIngredient: "Salbutamol Sulfate",
            activeIngredientAr: "كبريتات السالبوتامول",
            dosage: "1-2 puffs as needed, max 8 per day",
            dosageAr: "١-٢ بخة حسب الحاجة، بحد أقصى ٨ يومياً",
            packSize: "100 Doses Inhaler",
            packSizeAr: "بخاخ ١٠٠ جرعة",
            pharmacyId: "PHARM010",
            pharmacy: "Respiratory Care Pharmacy",
            pharmacyAr: "صيدلية رعاية الجهاز التنفسي",
            cityId: "ISM001",
            cityName: "ismailia-city",
            governorateId: "SUE001",
            price: 485,
            originalPrice: 520,
            discount: 6.7,
            inStock: true,
            expiryDate: "2025-12-08",
            batchNumber: "SAL2024678",
            availability: {
                inStock: true,
                quantity: 14,
                lowStockThreshold: 8,
                estimatedRestockDate: null,
            },
            delivery: {
                availableForDelivery: true,
                estimatedDeliveryTime: "3-5 hours",
                deliveryFee: 80,
            },
            image: "/images/salbutamol-inhaler.jpg",
            rating: 4.8,
            reviews: 234,
            barcode: "6223456789112",
            tags: ["asthma", "bronchodilator", "inhaler", "breathing"],
            isActive: true,
            productType: "medicine",
        },
        {
            name: "Iron + Folic Acid",
            nameAr: "حديد + حمض الفوليك",
            category: "mineral",
            prescription: false,
            description: "Iron supplement with folic acid for anemia prevention",
            descriptionAr: "مكمل الحديد مع حمض الفوليك لمنع فقر الدم",
            manufacturer: "Abbott Laboratories",
            manufacturerAr: "مختبرات أبوت",
            activeIngredient: "Ferrous Sulfate 65mg, Folic Acid 400mcg",
            activeIngredientAr: "كبريتات الحديدوز ٦٥ ملغ، حمض الفوليك ٤٠٠ مكغ",
            dosage: "1 tablet daily with food",
            dosageAr: "حبة واحدة يومياً مع الطعام",
            packSize: "100 Tablets",
            packSizeAr: "١٠٠ حبة",
            pharmacyId: "PHARM003",
            pharmacy: "City Pharmacy",
            pharmacyAr: "صيدلية المدينة",
            cityId: "ISM001",
            cityName: "ismailia-city",
            governorateId: "SUE001",
            price: 320,
            originalPrice: 340,
            discount: 5.9,
            inStock: true,
            expiryDate: "2026-10-05",
            batchNumber: "IRN2024456",
            availability: {
                inStock: true,
                quantity: 76,
                lowStockThreshold: 25,
                estimatedRestockDate: null,
            },
            delivery: {
                availableForDelivery: true,
                estimatedDeliveryTime: "3-4 hours",
                deliveryFee: 75,
            },
            image: "/images/iron-folic-acid.jpg",
            rating: 4.1,
            reviews: 145,
            barcode: "6223456789134",
            tags: ["iron", "folic acid", "anemia", "mineral", "supplement"],
            isActive: true,
            productType: "medicine",
        },
        {
            name: "Zolpidem 10mg",
            nameAr: "زولبيديم ١٠ ملغ",
            category: "sedative",
            prescription: true,
            description: "Short-term treatment for insomnia",
            descriptionAr: "علاج قصير المدى للأرق",
            manufacturer: "Sanofi",
            manufacturerAr: "سانوفي",
            activeIngredient: "Zolpidem Tartrate",
            activeIngredientAr: "تارترات الزولبيديم",
            dosage: "10mg before bedtime",
            dosageAr: "١٠ ملغ قبل النوم",
            packSize: "14 Tablets",
            packSizeAr: "١٤ حبة",
            pharmacyId: "PHARM011",
            pharmacy: "Sleep Care Pharmacy",
            pharmacyAr: "صيدلية رعاية النوم",
            cityId: "ISM001",
            cityName: "ismailia-city",
            governorateId: "SUE001",
            price: 680,
            originalPrice: 750,
            discount: 9.3,
            inStock: false,
            expiryDate: "2025-07-14",
            batchNumber: "ZOL2024123",
            availability: {
                inStock: false,
                quantity: 0,
                lowStockThreshold: 5,
                estimatedRestockDate: "2025-08-28",
            },
            delivery: {
                availableForDelivery: false,
                estimatedDeliveryTime: "N/A",
                deliveryFee: 0,
            },
            image: "/images/zolpidem-10mg.jpg",
            rating: 4.0,
            reviews: 67,
            barcode: "6223456789145",
            tags: ["sleep aid", "insomnia", "controlled", "prescription"],
            isActive: true,
            productType: "medicine",
        },
        // The 5 products from the previous lists
        {
            name: "Panadol Extra",
            nameAr: "بانادول إكسترا",
            category: "otc",
            prescription: false,
            description: "Fast relief from headache and body pain",
            descriptionAr: "راحة سريعة من الصداع وآلام الجسم",
            manufacturer: "GSK Consumer Healthcare",
            manufacturerAr: "جي إس كي للرعاية الصحية",
            activeIngredient: "Paracetamol 500mg + Caffeine 65mg",
            activeIngredientAr: "باراسيتامول ٥٠٠ ملغ + كافيين ٦٥ ملغ",
            dosage: "1-2 tablets every 4-6 hours",
            dosageAr: "١-٢ حبة كل ٤-٦ ساعات",
            packSize: "24 Tablets",
            packSizeAr: "٢٤ حبة",
            pharmacyId: "PHARM002",
            pharmacy: "Dawakhana Pharmacy",
            pharmacyAr: "صيدلية دواخانة",
            cityId: "ISM001",
            cityName: "ismailia-city",
            governorateId: "SUE001",
            price: 85,
            originalPrice: 90,
            discount: 5.6,
            inStock: true,
            expiryDate: "2025-11-20",
            batchNumber: "PND2024078",
            availability: {
                inStock: true,
                quantity: 156,
                lowStockThreshold: 20,
                estimatedRestockDate: null,
            },
            delivery: {
                availableForDelivery: true,
                estimatedDeliveryTime: "1-2 hours",
                deliveryFee: 30,
            },
            image: "/images/panadol-extra.jpg",
            rating: 4.6,
            reviews: 342,
            barcode: "6223456789023",
            tags: ["pain relief", "headache", "otc", "paracetamol"],
            isActive: true,
            productType: "medicine",
        },
        {
            name: "Vitamin D3 2000 IU",
            nameAr: "فيتامين د٣ ٢٠٠٠ وحدة",
            category: "vitamins",
            prescription: false,
            description: "Essential vitamin for bone health and immunity",
            descriptionAr: "فيتامين أساسي لصحة العظام والمناعة",
            manufacturer: "Nature's Bounty",
            manufacturerAr: "نيتشرز باونتي",
            activeIngredient: "Cholecalciferol (Vitamin D3)",
            activeIngredientAr: "كولي كالسيفيرول (فيتامين د٣)",
            dosage: "1 tablet daily with food",
            dosageAr: "حبة واحدة يومياً مع الطعام",
            packSize: "90 Tablets",
            packSizeAr: "٩٠ حبة",
            pharmacyId: "PHARM001",
            pharmacy: "Al-Shifa Pharmacy",
            pharmacyAr: "صيدلية الشفاء",
            cityId: "ISM001",
            cityName: "ismailia-city",
            governorateId: "SUE001",
            price: 180,
            originalPrice: 200,
            discount: 10,
            inStock: true,
            expiryDate: "2027-01-10",
            batchNumber: "VTD2024089",
            availability: {
                inStock: true,
                quantity: 72,
                lowStockThreshold: 20,
                estimatedRestockDate: null,
            },
            delivery: {
                availableForDelivery: true,
                estimatedDeliveryTime: "2-3 hours",
                deliveryFee: 50,
            },
            image: "/images/vitamin-d3-2000iu.jpg",
            rating: 4.5,
            reviews: 203,
            barcode: "6223456789045",
            tags: ["vitamin", "supplement", "bone health", "immunity"],
            isActive: true,
            productType: "medicine",
        },
        {
            name: "Baby Gripe Water",
            nameAr: "ماء غريب للأطفال",
            category: "baby",
            prescription: false,
            description: "Natural relief for infant colic and gas",
            descriptionAr: "راحة طبيعية لمغص الرضع والغازات",
            manufacturer: "Woodward's",
            manufacturerAr: "وودوردز",
            activeIngredient: "Dill Oil, Sodium Bicarbonate",
            activeIngredientAr: "زيت الشبت، بيكربونات الصوديوم",
            dosage: "2.5ml for infants under 6 months",
            dosageAr: "٢.٥ مل للرضع تحت ٦ أشهر",
            packSize: "120ml Bottle",
            packSizeAr: "زجاجة ١٢٠ مل",
            pharmacyId: "PHARM005",
            pharmacy: "Family Care Pharmacy",
            pharmacyAr: "صيدلية رعاية الأسرة",
            cityId: "ISM001",
            cityName: "ismailia-city",
            governorateId: "SUE001",
            price: 125,
            originalPrice: 125,
            discount: 0,
            inStock: true,
            expiryDate: "2026-12-31",
            batchNumber: "BGW2024445",
            availability: {
                inStock: true,
                quantity: 38,
                lowStockThreshold: 15,
                estimatedRestockDate: null,
            },
            delivery: {
                availableForDelivery: true,
                estimatedDeliveryTime: "1-2 hours",
                deliveryFee: 40,
            },
            image: "/images/baby-gripe-water.jpg",
            rating: 4.7,
            reviews: 289,
            barcode: "6223456789067",
            tags: ["baby care", "colic relief", "natural", "infant"],
            isActive: true,
            productType: "medicine",
        },
        {
            name: "Cetaphil Gentle Cleanser",
            nameAr: "سيتافيل منظف لطيف",
            category: "skincare",
            prescription: false,
            description: "Mild, non-alkaline cleanser for sensitive skin",
            descriptionAr: "منظف لطيف غير قلوي للبشرة الحساسة",
            manufacturer: "Galderma",
            manufacturerAr: "جالديرما",
            activeIngredient: "Water, Cetyl Alcohol, Propylene Glycol",
            activeIngredientAr: "ماء، كحول سيتيل، بروبيلين جلايكول",
            dosage: "Apply to wet skin, rinse gently",
            dosageAr: "يطبق على البشرة المبللة، يشطف بلطف",
            packSize: "236ml Bottle",
            packSizeAr: "زجاجة ٢٣٦ مل",
            pharmacyId: "PHARM006",
            pharmacy: "Skin Care Specialists",
            pharmacyAr: "متخصصو العناية بالبشرة",
            cityId: "ISM001",
            cityName: "ismailia-city",
            governorateId: "SUE001",
            price: 895,
            originalPrice: 995,
            discount: 10.1,
            inStock: true,
            expiryDate: "2027-06-15",
            batchNumber: "CTF2024712",
            availability: {
                inStock: true,
                quantity: 23,
                lowStockThreshold: 8,
                estimatedRestockDate: null,
            },
            delivery: {
                availableForDelivery: true,
                estimatedDeliveryTime: "2-4 hours",
                deliveryFee: 60,
            },
            image: "/images/cetaphil-cleanser.jpg",
            rating: 4.4,
            reviews: 178,
            barcode: "6223456789078",
            tags: ["skincare", "cleanser", "sensitive skin", "gentle"],
            isActive: true,
            productType: "product",
        },
        {
            name: "Gaviscon Double Action",
            nameAr: "جافيسكون مفعول مزدوج",
            category: "antacid",
            prescription: false,
            description: "Fast and long-lasting relief from heartburn",
            descriptionAr: "راحة سريعة وطويلة المفعول من حرقة المعدة",
            manufacturer: "Reckitt Benckiser",
            manufacturerAr: "ريكيت بينكيزر",
            activeIngredient: "Sodium Alginate, Sodium Bicarbonate",
            activeIngredientAr: "ألجينات الصوديوم، بيكربونات الصوديوم",
            dosage: "10-20ml after meals and bedtime",
            dosageAr: "١٠-٢٠ مل بعد الوجبات وقبل النوم",
            packSize: "200ml Suspension",
            packSizeAr: "معلق ٢٠٠ مل",
            pharmacyId: "PHARM007",
            pharmacy: "Quick Relief Pharmacy",
            pharmacyAr: "صيدلية الإغاثة السريعة",
            cityId: "ISM001",
            cityName: "ismailia-city",
            governorateId: "SUE001",
            price: 245,
            originalPrice: 270,
            discount: 9.3,
            inStock: true,
            expiryDate: "2026-01-18",
            batchNumber: "GAV2024334",
            availability: {
                inStock: true,
                quantity: 67,
                lowStockThreshold: 25,
                estimatedRestockDate: null,
            },
            delivery: {
                availableForDelivery: true,
                estimatedDeliveryTime: "1-3 hours",
                deliveryFee: 45,
            },
            image: "/images/gaviscon-double-action.jpg",
            rating: 4.3,
            reviews: 94,
            barcode: "6223456789089",
            tags: ["antacid", "heartburn", "indigestion", "otc"],
            isActive: true,
            productType: "medicine",
        },
        {
            name: "Disposable Face Masks (50 Pack)",
            nameAr: "كمامات وجه للاستخدام مرة واحدة (عبوة ٥٠)",
            category: "medical",
            prescription: false,
            description: "Three-ply disposable masks for personal protection",
            descriptionAr: "كمامات ثلاثية الطبقات للاستخدام الشخصي",
            manufacturer: "HealthGuard Medical",
            manufacturerAr: "هيلث جارد للمستلزمات الطبية",
            activeIngredient: "Polypropylene non-woven fabric",
            activeIngredientAr: "قماش بولي بروبيلين غير منسوج",
            dosage: "Wear as needed",
            dosageAr: "تلبس عند الحاجة",
            packSize: "50 pieces",
            packSizeAr: "٥٠ قطعة",
            pharmacyId: "PHARM001",
            pharmacy: "MediSupplies Center",
            pharmacyAr: "مركز المستلزمات الطبية",
            cityId: "ISM001",
            cityName: "ismailia-city",
            governorateId: "SUE001",
            price: 450,
            originalPrice: 500,
            discount: 10,
            inStock: true,
            expiryDate: "2028-01-01",
            batchNumber: "MASK2024998",
            availability: {
                inStock: true,
                quantity: 200,
                lowStockThreshold: 50,
                estimatedRestockDate: null,
            },
            delivery: {
                availableForDelivery: true,
                estimatedDeliveryTime: "3-5 hours",
                deliveryFee: 70,
            },
            image: "/images/face-masks.jpg",
            rating: 4.8,
            reviews: 512,
            barcode: "6223456789156",
            tags: ["medical", "protection", "mask", "supplies"],
            isActive: true,
            productType: "product",
        },
        {
            name: "Tums Ultra Strength",
            nameAr: "تومز قوة فائقة",
            category: "antacid",
            prescription: false,
            description: "Extra strength calcium carbonate for heartburn",
            descriptionAr: "كربونات الكالسيوم فائقة القوة لحرقة المعدة",
            manufacturer: "Haleon",
            manufacturerAr: "هاليون",
            activeIngredient: "Calcium Carbonate 1000mg",
            activeIngredientAr: "كربونات الكالسيوم ١٠٠٠ ملغ",
            dosage: "2-4 tablets as needed",
            dosageAr: "٢-٤ أقراص حسب الحاجة",
            packSize: "72 Chewable Tablets",
            packSizeAr: "٧٢ قرص للمضغ",
            pharmacyId: "PHARM002",
            pharmacy: "Dawakhana Pharmacy",
            pharmacyAr: "صيدلية دواخانة",
            cityId: "ISM001",
            cityName: "ismailia-city",
            governorateId: "SUE001",
            price: 285,
            originalPrice: 300,
            discount: 5,
            inStock: true,
            expiryDate: "2027-03-22",
            batchNumber: "TUM2024789",
            availability: {
                inStock: true,
                quantity: 51,
                lowStockThreshold: 20,
                estimatedRestockDate: null,
            },
            delivery: {
                availableForDelivery: true,
                estimatedDeliveryTime: "1-2 hours",
                deliveryFee: 35,
            },
            image: "/images/tums-ultra-strength.jpg",
            rating: 4.2,
            reviews: 76,
            barcode: "6223456789123",
            tags: ["antacid", "heartburn", "calcium", "chewable"],
            isActive: true,
            productType: "medicine",
        },
        {
            name: "Anti-Dandruff Shampoo",
            nameAr: "شامبو ضد القشرة",
            category: "otc",
            prescription: false,
            description: "A medicated shampoo that effectively controls dandruff and soothes the scalp.",
            descriptionAr: "شامبو علاجي يتحكم بفعالية في القشرة ويلطف فروة الرأس.",
            manufacturer: "Head & Shoulders",
            manufacturerAr: "هيد آند شولدرز",
            activeIngredient: "Pyrithione Zinc",
            activeIngredientAr: "بيريثيون الزنك",
            dosage: "Apply to wet hair, lather, and rinse.",
            dosageAr: "يطبق على الشعر المبلل، يدلك للحصول على رغوة، ثم يشطف.",
            packSize: "400ml Bottle",
            packSizeAr: "زجاجة ٤٠٠ مل",
            pharmacyId: "PHARM001",
            pharmacy: "Hair & Scalp Pharmacy",
            pharmacyAr: "صيدلية الشعر وفروة الرأس",
            cityId: "ISM001",
            cityName: "ismailia-city",
            governorateId: "SUE001",
            price: 650,
            originalPrice: 720,
            discount: 9.7,
            inStock: true,
            expiryDate: "2027-08-30",
            batchNumber: "ADSH2024112",
            availability: {
                inStock: true,
                quantity: 85,
                lowStockThreshold: 20,
                estimatedRestockDate: null,
            },
            delivery: {
                availableForDelivery: true,
                estimatedDeliveryTime: "3-4 hours",
                deliveryFee: 75,
            },
            image: "/images/anti-dandruff-shampoo.jpg",
            rating: 4.5,
            reviews: 310,
            barcode: "1223456789023",
            tags: ["hair", "shampoo", "dandruff", "scalp care"],
            isActive: true,
            productType: "product",
        },
    ];

      const createdProducts = await Product.insertMany(allProductsData);
      console.log('All products created successfully:', createdProducts.length);
      return createdProducts;
  } catch (error) {
      console.error('Error creating all products:', error);
      throw error;
  }
};


// Function to create Ismailia city document with correct data from other models
const createIsmailiaCity = async () => {
  try {
    // Count pharmacies in Ismailia from the existing data
    const pharmacyCount = await mongoose.model('Pharmacy').countDocuments({
      cityName: 'ismailia-city',
      isActive: true,
      isVerified: true
    });

    // Count doctors (users with role 'doctor') in Ismailia
    const doctorCount = await mongoose.model('User').countDocuments({
      'profile.cityName': 'ismailia-city',
      role: 'doctor',
      isActive: true
    });

    // Create the city object
    const ismailiaCity = {
      nameEn: 'Ismailia City',
      nameAr: 'مدينة الإسماعيلية',
      governorateId: 'GOV-123', // Random governorate ID
      governorateName: 'Ismailia Governorate',
      governorateNameAr: 'محافظة الإسماعيلية',
      coordinates: {
        lat: 30.6038,
        lng: 32.2722
      },
      isEnabled: true,
      pharmacyCount: pharmacyCount || 12, // Use actual count or fallback to 12
      doctorCount: doctorCount || 8, // Use actual count or fallback to 8
      population: 350000,
      area: 1442.87, // Area in square kilometers
      postalCodes: ['41511', '41512', '41513', '41514', '41515'],
      createdBy: new mongoose.Types.ObjectId('66f3c1234567890123456781'), // Admin user ID
      updatedBy: new mongoose.Types.ObjectId('66f3c1234567890123456781'),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log('Ismailia City object created with data:');
    console.log(`- Pharmacy Count: ${ismailiaCity.pharmacyCount}`);
    console.log(`- Doctor Count: ${ismailiaCity.doctorCount}`);
    console.log(`- Population: ${ismailiaCity.population.toLocaleString()}`);
    console.log(`- Coordinates: ${ismailiaCity.coordinates.lat}, ${ismailiaCity.coordinates.lng}`);

    const createdCity = await City.insertMany(ismailiaCity);
      console.log('All citiies created successfully:', createdCity.length);
      return createdCity;

  } catch (error) {
    console.error('Error creating Ismailia city object:', error);
    
    // Return fallback data if database queries fail
    const fallbackCity = {
      nameEn: 'Ismailia City',
      nameAr: 'مدينة الإسماعيلية',
      governorateId: 'GOV-123',
      governorateName: 'Ismailia Governorate',
      governorateNameAr: 'محافظة الإسماعيلية',
      coordinates: {
        lat: 30.6038,
        lng: 32.2722
      },
      isEnabled: true,
      pharmacyCount: 12, // Fallback count
      doctorCount: 8,    // Fallback count
      population: 350000,
      area: 1442.87,
      postalCodes: ['41511', '41512', '41513', '41514', '41515'],
      createdBy: new mongoose.Types.ObjectId('66f3c1234567890123456781'),
      updatedBy: new mongoose.Types.ObjectId('66f3c1234567890123456781'),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log('Using fallback city data');
    return fallbackCity;
  }
};


// Create orders
const createOrders = async (customer, pharmacy, medicines) => {
  try {
    const orders = [];
    
    for (let i = 1; i <= 5; i++) {
      // Select random medicines for each order
      const orderMedicines = medicines.slice(0, Math.floor(Math.random() * 3) + 1);
      
      const items = orderMedicines.map(medicine => {
        const quantity = Math.floor(Math.random() * 3) + 1;
        const price = medicine.price;
        const totalPrice = price * quantity;
        
        return {
          medicine: medicine._id,
          name: medicine.name, // Added for interface compatibility
          image: medicine.image || '', // Added for interface compatibility
          pharmacy: pharmacy._id,
          quantity,
          price,
          totalPrice,
          returnStatus: 'not_returned'
        };
      });
      
      const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
      const creditsUsed = i === 1 ? 25 : 0; // Use credits for first order
      const finalAmount = Math.max(0, subtotal - creditsUsed);
      
      // Create delivery address object
      const deliveryAddress = {
        street: '123 Main Street',
        city: 'Cairo',
        state: 'Cairo Governorate',
        zipCode: '11511',
        country: 'Egypt',
        fullAddress: '123 Main Street, Cairo, Cairo Governorate 11511'
      };
      
      // Determine order status
      const statusOptions = ['pending', 'processing', 'ready', 'delivered', 'delivered'];
      const orderStatus = statusOptions[i - 1] || 'pending';
      
      // Determine if prescription is required (random)
      const prescriptionRequired = Math.random() > 0.6; // 40% chance
      
      const order = {
        customerId: customer._id, // Changed from customer
        prescription: prescriptionRequired ? new mongoose.Types.ObjectId() : undefined,
        prescriptionId: prescriptionRequired ? new mongoose.Types.ObjectId().toString() : undefined,
        orderNumber: `ORD202412${String(i).padStart(3, '0')}`,
        
        items,
        
        pharmacyOrders: [{
          pharmacy: pharmacy._id,
          items: items.map(item => ({
            medicine: item.medicine,
            name: item.name, // Added for interface compatibility
            image: item.image, // Added for interface compatibility
            quantity: item.quantity,
            price: item.price,
            totalPrice: item.totalPrice
          })),
          subtotal,
          status: ['pending', 'confirmed', 'preparing', 'ready', 'delivered'][Math.floor(Math.random() * 5)],
          estimatedDelivery: new Date(Date.now() + (24 * 60 * 60 * 1000 * (i + 1))) // i+1 days from now
        }],
        
        totalAmount: subtotal,
        total: `$${subtotal.toFixed(2)}`, // String version for interface
        creditsUsed,
        finalAmount,
        
        paymentStatus: i <= 3 ? 'paid' : 'pending',
        paymentId: i <= 3 ? `PAY_${Date.now()}_${i}` : null,
        
        deliveryAddress,
        
        // Interface compatibility fields
        pharmacy: pharmacy.name, // Pharmacy name as string
        city: 'Cairo',
        status: orderStatus, // Changed from overallStatus
        date: new Date().toISOString().split('T')[0], // Today's date as string
        estimatedDate: new Date(Date.now() + (24 * 60 * 60 * 1000 * (i + 1))).toISOString().split('T')[0], // Estimated delivery date
        prescriptionRequired,
        
        // Return requests array (empty for new orders)
        returnRequests: [],
        
        // Return info (null for new orders)
        returnInfo: null
      };
      
      orders.push(order);
    }
    
    const createdOrders = await Order.insertMany(orders);
    console.log('Orders created successfully:', createdOrders.length);
    
    // Update customer credits after using some
    // if (creditsUsed > 0) {
    //   customer.credits -= 25;
    //   customer.creditHistory.push({
    //     type: 'used',
    //     amount: -25,
    //     description: 'Credits used for order #ORD202412001',
    //     orderId: createdOrders[0]._id,
    //     createdAt: new Date()
    //   });
    //   await customer.save();
    // }
    
    return createdOrders;
  } catch (error) {
    console.error('Error creating orders:', error);
    throw error;
  }
};

// Main seeder function
const seedDatabase = async () => {
  try {
    console.log('Starting database seeding...');
    
    await connectDB();
    await clearDatabase();
    
    // Create users
    const users = await createUsers();
    const customer = users.find(user => user.role === 'customer');
    const pharmacyOwner = users.find(user => user.role === 'pharmacy');
    const vendorOwner = users.find(user => user.role === 'vendor');
    
    // Create pharmacy
    const pharmacy = await createPharmacy(pharmacyOwner);
    
    // Create vendor
    const vendor = await createVendor(vendorOwner);
    
    // Create medicines
    
    const products = await createProducts();
    const cities = await createIsmailiaCity();
    // Create orders
    const orders = await createOrders(customer, pharmacy, products);
    console.log('\n=== Seeding Summary ===');
    console.log(`✅ Users created: ${users.length}`);
    console.log(`✅ Pharmacy created: 1`);
    console.log(`✅ Vendor created: 1`);
    console.log(`✅ Medicines created: ${products.length}`);
    console.log(`✅ Orders created: ${orders.length}`);
    console.log('city created', cities.length)
    // console.log(`✅ Products created: ${products.length}`);
    console.log('\n=== Login Credentials ===');
    console.log('Customer: ahmed.customer@test.com / password123');
    console.log('Pharmacy: mona.pharmacy@test.com / password123');
    console.log('Vendor: omar.vendor@test.com / password123');
    console.log('Admin: sara.admin@test.com / password123');
    console.log('\n=== Database seeded successfully! ===');
    
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed');
    process.exit(0);
  }
};

// Run seeder
if (require.main === module) {
  seedDatabase();
}

module.exports = {
  seedDatabase,
  createUsers,
  createPharmacy,
  createVendor,
  createOrders
};