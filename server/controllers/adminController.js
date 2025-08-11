const User = require('../models/User');
const Game = require('../models/Game');
const Log = require('../models/Log');
const { logger } = require('../utils/logger');

/**
 * Get all users (paginated)
 */
exports.getAllUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        
        const query = search 
            ? { 
                $or: [
                    { username: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } }
                ] 
            } 
            : {};
        
        const totalUsers = await User.countDocuments(query);
        const users = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
            
        res.json({
            users,
            currentPage: page,
            totalPages: Math.ceil(totalUsers / limit),
            totalUsers
        });
        
    } catch (error) {
        logger.error(`Get all users error: ${error.message}`);
        res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Get single user
 */
exports.getUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select('-password')
            .lean();
            
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Get user stats
        const gamesPlayed = await Game.countDocuments({ userId: user._id });
        const gamesWon = await Game.countDocuments({ 
            userId: user._id, 
            status: 'won' 
        });
        
        const winRate = gamesPlayed > 0 
            ? (gamesWon / gamesPlayed * 100).toFixed(2) 
            : 0;
            
        res.json({
            user,
            stats: {
                gamesPlayed,
                gamesWon,
                winRate
            }
        });
        
    } catch (error) {
        logger.error(`Get user error: ${error.message}`);
        res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Update user
 */
exports.updateUser = async (req, res) => {
    try {
        const { balance, isAdmin } = req.body;
        
        const updateFields = {};
        if (balance !== undefined) updateFields.balance = balance;
        if (isAdmin !== undefined) updateFields.isAdmin = isAdmin;
        
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { $set: updateFields },
            { new: true, select: '-password' }
        );
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        logger.info(`Admin ${req.user.username} updated user ${user.username}`);
        
        res.json(user);
        
    } catch (error) {
        logger.error(`Update user error: ${error.message}`);
        res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Delete user
 */
exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Also delete user's games and logs
        await Game.deleteMany({ userId: user._id });
        await Log.deleteMany({ userId: user._id });
        
        logger.warn(`Admin ${req.user.username} deleted user ${user.username}`);
        
        res.json({ message: 'User deleted successfully' });
        
    } catch (error) {
        logger.error(`Delete user error: ${error.message}`);
        res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Adjust user balance
 */
exports.adjustBalance = async (req, res) => {
    console.log('Balance adjustment request received:', req.body); // Add this line
    
    try {
        const { operation, amount, reason } = req.body;
        const userId = req.params.id;

        console.log('Validating inputs...'); // Debug log
        if (!['add', 'subtract', 'set'].includes(operation)) {
            console.error('Invalid operation:', operation);
            return res.status(400).json({ 
                success: false,
                error: 'Invalid operation. Valid values: add, subtract, set'
            });
        }

        if (isNaN(amount) || amount <= 0) {
            console.error('Invalid amount:', amount);
            return res.status(400).json({ 
                success: false,
                error: 'Amount must be a positive number'
            });
        }

        console.log('Finding user...'); // Debug log
        const user = await User.findById(userId);
        if (!user) {
            console.error('User not found:', userId);
            return res.status(404).json({ 
                success: false,
                error: 'User not found' 
            });
        }

        console.log('Performing balance operation...'); // Debug log
        let newBalance = user.balance;
        switch (operation) {
            case 'add':
                newBalance += amount;
                break;
            case 'subtract':
                if (user.balance < amount) {
                    console.error('Insufficient balance:', user.balance, amount);
                    return res.status(400).json({ 
                        success: false,
                        error: 'Insufficient balance'
                    });
                }
                newBalance -= amount;
                break;
            case 'set':
                newBalance = amount;
                break;
        }

        console.log('Updating user balance...'); // Debug log
        user.balance = newBalance;
        await user.save();

        console.log('Creating audit log...'); // Debug log
        await Log.create({
            userId: user._id,
            action: 'admin_action',
            details: {
                type: 'balance_adjustment',
                admin: req.user.id,
                operation,
                amount,
                previousBalance: user.balance,
                newBalance,
                reason
            }
        });

        console.log('Balance adjustment successful'); // Debug log
        res.json({
            success: true,
            message: 'Balance updated successfully',
            newBalance
        });

    } catch (error) {
        console.error('Balance adjustment error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Server error during balance adjustment',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};
/**
 * Get all games (paginated)
 */
exports.getAllGames = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const status = req.query.status;
        
        const query = status ? { status } : {};
        
        const totalGames = await Game.countDocuments(query);
        const games = await Game.find(query)
            .populate('userId', 'username')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
            
        res.json({
            games,
            currentPage: page,
            totalPages: Math.ceil(totalGames / limit),
            totalGames
        });
        
    } catch (error) {
        logger.error(`Get all games error: ${error.message}`);
        res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Get single game
 */
exports.getGame = async (req, res) => {
    try {
        const game = await Game.findById(req.params.id)
            .populate('userId', 'username')
            .lean();
            
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }
            
        res.json(game);
        
    } catch (error) {
        logger.error(`Get game error: ${error.message}`);
        res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Delete game
 */
exports.deleteGame = async (req, res) => {
    try {
        const game = await Game.findByIdAndDelete(req.params.id);
        
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }
        
        logger.warn(`Admin ${req.user.username} deleted game ${game._id}`);
        
        res.json({ message: 'Game deleted successfully' });
        
    } catch (error) {
        logger.error(`Delete game error: ${error.message}`);
        res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Get all logs (paginated)
 */
exports.getLogs = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const action = req.query.action;
        
        const query = action ? { action } : {};
        
        const totalLogs = await Log.countDocuments(query);
        const logs = await Log.find(query)
            .populate('userId', 'username')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
            
        res.json({
            logs,
            currentPage: page,
            totalPages: Math.ceil(totalLogs / limit),
            totalLogs
        });
        
    } catch (error) {
        logger.error(`Get logs error: ${error.message}`);
        res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Get logs for specific user
 */
exports.getUserLogs = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        
        const totalLogs = await Log.countDocuments({ userId: req.params.userId });
        const logs = await Log.find({ userId: req.params.userId })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
            
        res.json({
            logs,
            currentPage: page,
            totalPages: Math.ceil(totalLogs / limit),
            totalLogs
        });
        
    } catch (error) {
        logger.error(`Get user logs error: ${error.message}`);
        res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Get system statistics
 */
exports.getSystemStats = async (req, res) => {
    try {
        // User stats
        const totalUsers = await User.countDocuments();
        const newUsersToday = await User.countDocuments({
            createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        });
        
        // Game stats
        const totalGames = await Game.countDocuments();
        const activeGames = await Game.countDocuments({ status: 'in_progress' });
        const totalWagered = await Game.aggregate([
            { $group: { _id: null, total: { $sum: "$betAmount" } } }
        ]);
        
        // Profit stats (assuming house edge of 5%)
        const totalWon = await Game.aggregate([
            { $match: { status: 'won' } },
            { $group: { _id: null, total: { $sum: "$winAmount" } } }
        ]);
        
        const estimatedProfit = totalWagered[0]?.total * 0.05 || 0;
        
        res.json({
            users: {
                total: totalUsers,
                newToday: newUsersToday
            },
            games: {
                total: totalGames,
                active: activeGames,
                totalWagered: totalWagered[0]?.total || 0,
                totalWon: totalWon[0]?.total || 0,
                estimatedProfit
            }
        });
        
    } catch (error) {
        logger.error(`Get system stats error: ${error.message}`);
        res.status(500).json({ error: 'Server error' });
    }
};


exports.updateUser = async (req, res) => {
    try {
        const { username, email, balance, isActive, isAdmin } = req.body;
        
        // Validate inputs
        if (balance && isNaN(balance)) {
            return res.status(400).json({ error: 'Invalid balance value' });
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { 
                username,
                email,
                balance,
                isActive,
                isAdmin 
            },
            { new: true, select: '-password' }
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};