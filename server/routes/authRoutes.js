const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validateRegister, validateLogin } = require('../middleware/validation');
const { authenticate } = require('../middleware/auth');

// Registration
router.post('/register', validateRegister, authController.register);

// Login
router.post('/login', validateLogin, authController.login);

// Logout
router.post('/logout', authenticate, authController.logout);

// Check auth status
router.get('/status', authenticate, authController.checkAuthStatus);

// Get user profile
router.get('/profile', authenticate, authController.getProfile);

module.exports = router;