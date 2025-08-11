const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { logger } = require('../utils/logger');
const { generateToken } = require('../utils/helpers');

/**
 * Register a new user
 */
exports.register = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Check if user exists
        let user = await User.findOne({ $or: [{ username }, { email }] });
        if (user) {
            return res.status(400).json({ 
                error: user.username === username 
                    ? 'Username already exists' 
                    : 'Email already registered' 
            });
        }

        // Create new user
        user = new User({
            username,
            email,
            password
        });

        await user.save();

        // Generate token
        const token = generateToken(user._id);

        // Set cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        logger.info(`New user registered: ${username}`);

        res.json({
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                balance: user.balance,
                isAdmin: user.isAdmin
            }
        });

    } catch (error) {
        logger.error(`Registration error: ${error.message}`);
        res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Login user
 */
exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Find user
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        // Generate token
        const token = generateToken(user._id);

        // Set cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        logger.info(`User logged in: ${username}`);

        res.json({
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                balance: user.balance,
                isAdmin: user.isAdmin
            }
        });

    } catch (error) {
        logger.error(`Login error: ${error.message}`);
        res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Logout user
 */
exports.logout = (req, res) => {
    try {
        res.clearCookie('token');
        logger.info(`User logged out: ${req.user.username}`);
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        logger.error(`Logout error: ${error.message}`);
        res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Check authentication status
 */
exports.checkAuthStatus = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json({ user });
    } catch (error) {
        logger.error(`Auth status check error: ${error.message}`);
        res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Get user profile
 */
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select('-password')
            .lean();
            
        // Add stats
        const stats = {
            gamesPlayed: user.gamesPlayed,
            totalWagered: user.totalWagered,
            totalWon: user.totalWon,
            winRate: user.gamesPlayed > 0 
                ? (user.totalWon / user.totalWagered * 100).toFixed(2) 
                : 0
        };

        res.json({
            user,
            stats
        });
    } catch (error) {
        logger.error(`Get profile error: ${error.message}`);
        res.status(500).json({ error: 'Server error' });
    }
};