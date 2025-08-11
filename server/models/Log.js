const mongoose = require('mongoose');
const { logger } = require('../utils/logger');

const logSchema = new mongoose.Schema({
    action: {
        type: String,
        required: true,
        enum: [
            'login',
            'logout',
            'game_start',
            'game_lost', 
            'game_won',  
            'cash_out',
            'register',
            'admin_action',
            'balance_adjust'
        ]
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    ipAddress: {
        type: String
    },
    userAgent: {
        type: String
    },
    details: {
        type: Object
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Indexes for query optimization
logSchema.index({ action: 1 });
logSchema.index({ userId: 1 });
logSchema.index({ createdAt: -1 });

// Static method for admin to query logs
logSchema.statics.getAdminLogs = async function(filter = {}, limit = 100) {
    try {
        return await this.find(filter)
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('userId', 'username email')
            .lean();
    } catch (error) {
        logger.error(`Error fetching admin logs: ${error}`);
        throw error;
    }
};

const Log = mongoose.model('Log', logSchema);

module.exports = Log;