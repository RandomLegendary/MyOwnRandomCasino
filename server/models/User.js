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
        min: 0,
    },
    lastDaily: { 
        type: Date,
         default: null
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
    },
    progress: {
    daily: {
        quests: {
            type: [
                {
                    id: { type: Number, required: true },
                    description: { type: String, required: true },
                    current: { type: Number, default: 0 },
                    goal: { type: Number, required: true },
                    completed: { type: Boolean, default: false }
                }
            ],
        },
        completed: { type: Number, default: 0 },
        claimedToday: { type: Boolean, default: false },
        lastClaimed: { type: Date, default: null }
    },
    level: {
        current: { type: Number, default: 1 },
        xp: { type: Number, default: 0 },
        nextLevelXp: { type: Number, default: 500 }
    }
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

userSchema.methods.addXP = async function(xpToAdd) {
    this.progress.level.xp += xpToAdd;
    
    // Check for level up
    while (this.progress.level.xp >= this.progress.level.nextLevelXp) {
        this.progress.level.xp -= this.progress.level.nextLevelXp;
        this.progress.level.current++;
        this.progress.level.nextLevelXp = this.calculateNextLevelXP();
        
        // Add level-up reward
        this.balance += this.calculateLevelReward();
    }
    
    await this.save();
    return { leveledUp: true, newLevel: this.progress.level.current };
};

userSchema.methods.calculateNextLevelXP = function() {
    // Example: 500 XP for level 1, 1000 for level 2, 1500 for level 3, etc.
    return 500 * this.progress.level.current;
};

userSchema.methods.calculateLevelReward = function() {
    // Example: $1000 per level
    return 1000;
};


const User = mongoose.model('User', userSchema);

module.exports = User;
