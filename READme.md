# Multivendor Pharmacy Backend

A comprehensive Express.js backend for a multivendor pharmacy application with MongoDB integration.

## Features

- **User Management**: Customers, Pharmacies, Vendors, Doctors, Prescription Readers, Admin
- **Medicine Database**: Large centralized medicine database
- **Prescription Workflow**: Upload → Reading → Processing → Ordering
- **Real-time Notifications**: Socket.io integration
- **Order Management**: Multi-pharmacy orders with payment integration
- **Inventory Management**: Pharmacy stock management
- **Referral System**: Doctor referral tracking

## Project Structure

```
├── models/
│   ├── User.js              # User accounts (all roles)
│   ├── Medicine.js          # Medicine database
│   ├── Pharmacy.js          # Pharmacy profiles & inventory
│   ├── Vendor.js            # Vendor profiles & products
│   ├── Prescription.js      # Prescription workflow
│   └── Order.js             # Order management
├── routes/
│   ├── auth.js              # Authentication routes
│   ├── users.js             # User profile management
│   ├── medicines.js         # Medicine database access
│   ├── pharmacies.js        # Pharmacy operations
│   ├── prescriptions.js     # Prescription workflow
│   ├── orders.js            # Order processing
│   └── admin.js             # Admin operations
├── middleware/
│   └── auth.js              # Authentication middleware
├── uploads/                 # File uploads directory
└── server.js               # Main server file
```

## Installation

1. **Clone and install dependencies:**
```bash
npm install
```

2. **Create environment file:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Create upload directories:**
```bash
mkdir -p uploads/prescriptions
mkdir -p uploads/medicines
mkdir -p uploads/profiles
```

4. **Start MongoDB:**
```bash
# Make sure MongoDB is running
mongod
```

5. **Run the application:**
```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Medicine Management
- `GET /api/medicines` - Get all medicines (with search/filter)
- `GET /api/medicines/:id` - Get medicine with pharmacy availability
- `GET /api/medicines/search/alternatives` - Search for alternatives

### Prescription Workflow
- `POST /api/prescriptions/upload` - Upload prescription (customer)
- `GET /api/prescriptions/queue` - Get prescription queue (readers)
- `PUT /api/prescriptions/:id/start-reading` - Start reading prescription
- `PUT /api/prescriptions/:id/process` - Process prescription with medicines
- `GET /api/prescriptions/my-prescriptions` - Customer prescriptions

### Pharmacy Operations
- `POST /api/pharmacies/profile` - Create/update pharmacy profile
- `POST /api/pharmacies/inventory` - Add medicine to inventory
- `GET /api/pharmacies/inventory` - Get pharmacy inventory
- `GET /api/pharmacies/search` - Search pharmacies

### Order Management
- `POST /api/orders/create` - Create order from prescription
- `POST /api/orders/:id/confirm-payment` - Confirm payment
- `GET /api/orders/my-orders` - Customer orders
- `GET /api/orders/pharmacy-orders` - Pharmacy orders
- `PUT /api/orders/pharmacy-orders/:id/status` - Update order status

### Admin Operations
- `POST /api/admin/create-account` - Create staff accounts
- `GET /api/admin/users/:role` - Get users by role
- `POST /api/admin/medicines` - Add medicines to database
- `PUT /api/admin/pharmacies/:id/verify` - Verify pharmacy
- `GET /api/admin/dashboard-stats` - Dashboard statistics

## Key Workflow

### Prescription Processing Flow

1. **Customer uploads prescription images**
2. **Prescription goes to reader queue**
3. **Prescription reader starts reading**
4. **Reader selects medicines from big database**
5. **Reader adds alternatives and instructions**
6. **Prescription marked as processed**
7. **Customer selects medicines and pharmacies**
8. **Order created with payment**
9. **Inventory updated, pharmacies notified**
10. **Pharmacies process and deliver orders**

### User Roles

- **Customer**: Upload prescriptions, place orders
- **Pharmacy**: Manage inventory, process orders
- **Vendor**: Sell non-medicine products
- **Doctor**: Referral system only (marketing affiliate)
- **Prescription Reader**: Process prescription images
- **Admin**: Manage all aspects of the system

## Real-time Features

- New prescription notifications to readers
- Order status updates to customers
- New order notifications to pharmacies

## Payment Integration

- Stripe integration for payments
- Support for COD (Cash on Delivery)
- Order confirmation after payment

## Database Models

### Key Features:
- **Medicine availability tracking** per pharmacy
- **Expiry date management** for inventory
- **Multi-pharmacy order support**
- **Real-time inventory updates**
- **Referral tracking** for doctors

## Environment Variables

See `.env.example` for all required environment variables including:
- MongoDB connection
- JWT secret
- Payment gateway keys
- File upload settings

## Deployment

The application is ready for deployment with:
- Docker support (create Dockerfile as needed)
- Environment-based configuration
- Production-ready error handling
- CORS configuration for frontend integration

## Security Features

- JWT-based authentication
- Role-based authorization
- Password hashing with bcrypt
- Input validation
- File upload restrictions