const winston = require('winston');
const { combine, timestamp, printf, colorize } = winston.format;
const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

// Custom log format
const logFormat = printf(({ level, message, timestamp }) => {
    return `${timestamp} [${level}]: ${message}`;
});

// Logger for general application logs
const logger = winston.createLogger({
    level: 'info',
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
    ),
    transports: [
        new winston.transports.File({ 
            filename: path.join(logDir, 'error.log'), 
            level: 'error',
            maxsize: 5 * 1024 * 1024, // 5MB
            maxFiles: 5
        }),
        new winston.transports.File({ 
            filename: path.join(logDir, 'combined.log'),
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5
        }),
        new winston.transports.Console({
            format: combine(
                colorize(),
                timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                logFormat
            )
        })
    ],
    exceptionHandlers: [
        new winston.transports.File({ 
            filename: path.join(logDir, 'exceptions.log'),
            maxsize: 5 * 1024 * 1024
        })
    ],
    rejectionHandlers: [
        new winston.transports.File({ 
            filename: path.join(logDir, 'rejections.log'),
            maxsize: 5 * 1024 * 1024
        })
    ]
});

// Logger for game events (separate file)
const gameLogger = winston.createLogger({
    level: 'info',
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
    ),
    transports: [
        new winston.transports.File({
            filename: path.join(logDir, 'games.log'),
            maxsize: 10 * 1024 * 1024,
            maxFiles: 5
        })
    ]
});

// Logger for admin actions (separate file)
const adminLogger = winston.createLogger({
    level: 'info',
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
    ),
    transports: [
        new winston.transports.File({
            filename: path.join(logDir, 'admin.log'),
            maxsize: 5 * 1024 * 1024,
            maxFiles: 3
        })
    ]
});

// Logger for security events (separate file)
const securityLogger = winston.createLogger({
    level: 'info',
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
    ),
    transports: [
        new winston.transports.File({
            filename: path.join(logDir, 'security.log'),
            maxsize: 5 * 1024 * 1024,
            maxFiles: 3
        })
    ]
});

module.exports = {
    logger,
    gameLogger,
    adminLogger,
    securityLogger
};