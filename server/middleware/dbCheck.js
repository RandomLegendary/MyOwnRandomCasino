const { logger } = require('../utils/logger');
const mongoose = require('mongoose');

const dbConnectionCheck = (req, res, next) => {
    const states = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting',
        99: 'uninitialized'
    };
    
    if (mongoose.connection.readyState !== 1) {
        logger.error(`Database connection state: ${states[mongoose.connection.readyState]}`);
        return res.status(503).json({ 
            error: 'Database not available',
            status: states[mongoose.connection.readyState]
        });
    }
    next();
};

module.exports = dbConnectionCheck;