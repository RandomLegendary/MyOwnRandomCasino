const { logger } = require('../utils/logger');

module.exports = (err, req, res, next) => {
    // Log the error details
    logger.error(`Error: ${err.message}`);
    logger.error(`Stack: ${err.stack}`);
    
    // Determine the status code - default to 500 if not set
    const statusCode = err.statusCode || 500;
    
    // Prepare error response
    const errorResponse = {
        error: {
            message: err.message || 'Internal Server Error',
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack }) // Only show stack in development
        }
    };

    // Special handling for validation errors
    if (err.name === 'ValidationError') {
        errorResponse.error.details = err.errors;
        return res.status(400).json(errorResponse);
    }

    // Special handling for MongoDB duplicate key errors
    if (err.code === 11000) {
        errorResponse.error.message = 'Duplicate field value entered';
        const field = Object.keys(err.keyValue)[0];
        errorResponse.error.field = field;
        return res.status(400).json(errorResponse);
    }

    // Special handling for JWT errors
    if (err.name === 'JsonWebTokenError') {
        errorResponse.error.message = 'Invalid token';
        return res.status(401).json(errorResponse);
    }

    if (err.name === 'TokenExpiredError') {
        errorResponse.error.message = 'Token expired';
        return res.status(401).json(errorResponse);
    }

    // Default error handling
    res.status(statusCode).json(errorResponse);
};