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

        await mongoose.connect(process.env.MONGODB_URI, {
              useNewUrlParser: true,
              useUnifiedTopology: true,
              poolSize: 50, // Increase connection pool size
              socketTimeoutMS: 30000, // 30 seconds
              connectTimeoutMS: 30000,
              serverSelectionTimeoutMS: 30000
            });
        
        logger.info(`MongoDB Connected: ${mongoose.connection.host}`);
    } catch (error) {
        logger.error(`Database connection error: ${error.message}`);
        process.exit(1); // Exit process with failure
    }
};

module.exports = connectDB;
