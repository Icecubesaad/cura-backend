const bcrypt = require("bcryptjs");
const mongoose = require('mongoose');



const getHash = async () => {
  const hashedPassword = await bcrypt.hash("password123", 10);
};

const usersData = [
  {
    firstName: "Ahmed",
    lastName: "Hassan",
    email: "ahmed.customer@test.com",
    password: getHash(),
    phone: "+201234567890",
    whatsapp: "+201234567890",
    role: "customer",
    address: "123 Main Street, Cairo, Egypt",
    credits: 100,
    creditHistory: [
      {
        type: "bonus",
        amount: 100,
        description: "Welcome bonus credits",
        createdAt: new Date(),
      },
    ],
  },
  {
    firstName: "Dr. Mona",
    lastName: "Ali",
    email: "mona.pharmacy@test.com",
    password: getHash(),
    phone: "+201234567891",
    whatsapp: "+201234567891",
    role: "pharmacy",
    address: "456 Pharmacy Street, Alexandria, Egypt",
    pharmacyId: "PH001",
    doctorLicense: "DL12345",
  },
  {
    firstName: "Omar",
    lastName: "Mohamed",
    email: "omar.vendor@test.com",
    password: getHash(),
    phone: "+201234567892",
    whatsapp: "+201234567892",
    role: "vendor",
    address: "789 Business Avenue, Giza, Egypt",
    vendorId: "VD001",
  },
  {
    firstName: "Sara",
    lastName: "Ahmed",
    email: "sara.admin@test.com",
    password: getHash(),
    phone: "+201234567893",
    whatsapp: "+201234567893",
    role: "admin",
    address: "321 Admin Building, Cairo, Egypt",
  },
];



module.exports = {
  productsData,
  usersData,
  medicineData
}