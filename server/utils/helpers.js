const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Generate JWT token
 */
const generateToken = (userId) => {
    return jwt.sign(
        { userId },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
};

/**
 * Generate random string (for salts, etc.)
 */
const generateRandomString = (length = 32) => {
    return crypto.randomBytes(Math.ceil(length / 2))
        .toString('hex')
        .slice(0, length);
};

/**
 * Generate a Mines game grid
 */
const generateGameGrid = (size, mineCount) => {
    // Create empty grid
    const grid = Array(size).fill().map(() => Array(size).fill(false));
    const minePositions = [];
    
    // Place mines randomly
    let minesPlaced = 0;
    while (minesPlaced < mineCount) {
        const row = Math.floor(Math.random() * size);
        const col = Math.floor(Math.random() * size);
        
        if (!grid[row][col]) {
            grid[row][col] = true;
            minePositions.push({ row, col });
            minesPlaced++;
        }
    }
    
    return { grid, minePositions };
};

/**
 * Calculate potential payout multiplier
 */
const calculateMultiplier = (revealedCells, totalCells, mineCount) => {
    const safeCells = totalCells - mineCount;
    const riskFactor = (revealedCells / safeCells) * 2.5; // Base risk factor
    
    // Add some randomness to make it more exciting
    const randomFactor = 0.8 + Math.random() * 0.4;
    
    // Base multiplier formula
    let multiplier = 1 + (riskFactor * randomFactor);
    
    // Ensure minimum and maximum bounds
    multiplier = Math.max(1.0, Math.min(multiplier, 25.0));
    
    return parseFloat(multiplier.toFixed(2));
};

/**
 * Format currency consistently
 */
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
};

/**
 * Validate and sanitize input
 */
const sanitizeInput = (input) => {
    if (typeof input === 'string') {
        // Remove potentially harmful characters
        return input.replace(/[<>"'`$\\]/g, '');
    }
    return input;
};

/**
 * Simple rate limiter for game actions
 */
const createRateLimiter = (windowMs, maxRequests) => {
    const requests = new Map();
    
    return (userId) => {
        const currentTime = Date.now();
        const userRequests = requests.get(userId) || [];
        
        // Remove old requests
        const recentRequests = userRequests.filter(time => 
            currentTime - time < windowMs
        );
        
        if (recentRequests.length >= maxRequests) {
            return false; // Limit exceeded
        }
        
        recentRequests.push(currentTime);
        requests.set(userId, recentRequests);
        return true; // Within limit
    };
};

/**
 * Generate a unique game ID
 */
const generateGameId = () => {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substr(2, 5);
    return `game_${timestamp}_${randomStr}`;
};

/**
 * Calculate house edge on a bet
 */
const calculateHouseEdge = (betAmount, potentialWin) => {
    const edge = ((betAmount - potentialWin) / betAmount) * 100;
    return Math.max(0, edge.toFixed(2)); // Ensure non-negative
};

module.exports = {
    generateToken,
    generateRandomString,
    generateGameGrid,
    calculateMultiplier,
    formatCurrency,
    sanitizeInput,
    createRateLimiter,
    generateGameId,
    calculateHouseEdge
};