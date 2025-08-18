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
try {
  const db = mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/multivendor_pharmacy', {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  if(db){
    console.log('database connected')
  }
} catch (error) {
  console.log(error)
}

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
app.use('/api/users', require('./routes/user'));
app.use('/api/medicines', require('./routes/medicine'));
app.use('/api/pharmacies', require('./routes/pharmacies'));
app.use('/api/prescriptions', require('./routes/prescription'));
app.use('/api/orders', require('./routes/order'));
app.use('/api/admin', require('./routes/admin'));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});