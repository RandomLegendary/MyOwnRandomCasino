const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate, isAdmin } = require('../middleware/auth');
const { validateUserUpdate } = require('../middleware/validation');

// User management
router.get('/users', authenticate, isAdmin, adminController.getAllUsers);
router.get('/users/:id', authenticate, isAdmin, adminController.getUser);
router.put('/users/:id', authenticate, isAdmin, validateUserUpdate, adminController.updateUser);
router.delete('/users/:id', authenticate, isAdmin, adminController.deleteUser);
router.post('/users/:id/balance', authenticate, isAdmin, adminController.adjustBalance);

// Game management
router.get('/games', authenticate, isAdmin, adminController.getAllGames);
router.get('/games/:id', authenticate, isAdmin, adminController.getGame);
router.delete('/games/:id', authenticate, isAdmin, adminController.deleteGame);

// Logs
router.get('/logs', authenticate, isAdmin, adminController.getLogs);
router.get('/logs/user/:userId', authenticate, isAdmin, adminController.getUserLogs);

// System stats
router.get('/stats', authenticate, isAdmin, adminController.getSystemStats);

module.exports = router;