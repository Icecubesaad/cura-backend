const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/multivendor_pharmacy', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Socket.io for real-time notifications
io.on('connection', (socket) => {
  console.log('Client connected');
  
  socket.on('join_room', (room) => {
    socket.join(room);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Make io available to routes
app.set('io', io);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/medicines', require('./routes/medicines'));
app.use('/api/pharmacies', require('./routes/pharmacies'));
app.use('/api/prescriptions', require('./routes/prescriptions'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/admin', require('./routes/admin'));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});