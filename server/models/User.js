const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 20
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    balance: {
        type: Number,
        default: 1000,
        min: 0
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    lastLogin: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    gamesPlayed: {
        type: Number,
        default: 0
    },
    totalWagered: {
        type: Number,
        default: 0
    },
    totalWon: {
        type: Number,
        default: 0
    }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        logger.error(`Password hashing error: ${error}`);
        next(error);
    }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Virtual for win rate
userSchema.virtual('winRate').get(function() {
    return this.gamesPlayed > 0 ? (this.totalWon / this.totalWagered * 100).toFixed(2) : 0;
});

userSchema.methods.deductBalance = async function(amount) {
  if (this.balance < amount) {
    throw new Error('Insufficient balance');
  }
  this.balance -= amount;
  await this.save();
};

userSchema.methods.creditBalance = async function(amount) {
  this.balance += amount;
  await this.save();
};

const User = mongoose.model('User', userSchema);

module.exports = User;