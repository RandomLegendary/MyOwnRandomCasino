const mongoose = require('mongoose');
const { logger } = require('../utils/logger');

const connectDB = async () => {
    try {
        mongoose.connection.on('connecting', () => {
            logger.info('Connecting to MongoDB...');
        });

        mongoose.connection.on('connected', () => {
            logger.info('MongoDB connected');
        });

        mongoose.connection.on('disconnected', () => {
            logger.error('MongoDB disconnected! Attempting to reconnect...');
        });

        mongoose.connection.on('error', (err) => {
            logger.error(`MongoDB connection error: ${err}`);
        });

        await mongoose.connect(process.env.MONGODB_URI, { // Remove the fallback to localhost
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            retryWrites: true,
            retryReads: true
        });
        
        logger.info(`MongoDB Connected: ${mongoose.connection.host}`);
    } catch (error) {
        logger.error(`Database connection error: ${error.message}`);
        process.exit(1); // Exit process with failure
    }
};

module.exports = connectDB;