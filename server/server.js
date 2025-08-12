require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const http = require('http'); 

// Import routes
const authRoutes = require('./routes/authRoutes');
const gameRoutes = require('./routes/gameRoutes');
const adminRoutes = require('./routes/adminRoutes');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const { authenticate, isAdmin } = require('./middleware/auth');
const { authenticatePage, isAdminPage } = require('./middleware/authPage');

// Initialize app
const app = express();
const PORT = process.env.PORT || 3000; 

const dailyRoutes = require('./routes/daily');


// Database connection
const connectDB = require('./config/db');

// Create HTTP server
const server = http.createServer(app); // Create server here

// Create WebSocket server
const WebSocket = require('ws');
const wss = new WebSocket.Server({ server }); // Now server is defined


// WebSocket event handlers
wss.on('connection', (ws) => {
  console.log('New WebSocket connection');
  
  ws.on('error', (error) => {
    console.error('WebSocket server error:', error);
  });
});

wss.on('error', (error) => {
  console.error('WebSocket server setup error:', error);
});

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100000000000000, // Increase from 100 to 1000 requests per window
  message: 'Too many requests from this IP, please try again later',
  skip: (req) => {
    // Skip rate limiting for admin routes
    return req.path.startsWith('/admin') && req.user?.isAdmin;
  }
});
app.use(limiter);

// Logging
const accessLogStream = fs.createWriteStream(
    path.join(__dirname, '../logs/access.log'), 
    { flags: 'a' }
);
app.use(morgan('combined', { stream: accessLogStream }));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/api', dailyRoutes);

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/game', gameRoutes);

//Protect Admin
app.get('/admin', authenticate, isAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin.html'));
});


// Serve HTML files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/login.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// 404 handler
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '../public/404.html'));
});

// Error handler
app.use(errorHandler);

// Start server after DB connection
connectDB().then(() => {
  server.listen(PORT, () => { // Use server.listen instead of app.listen
    console.log(`Server running on port ${PORT}`);
    console.log(`WebSocket server running on ws://localhost:${PORT}`);
  });
});
