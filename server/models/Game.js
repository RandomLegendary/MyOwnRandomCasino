const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  betAmount: {
    type: Number,
    required: true
  },
  winAmount: {
    type: Number,
    default: 0
  },
  mineCount: {
    type: Number,
    required: true
  },
  multiplier: {
    type: Number,
    default: 1.0
  },
  status: {
  type: String,
  enum: ['pending', 'active', 'in_progress', 'won', 'lost', 'cashed_out'],
  default: 'pending'
  },
  minePositions: [{
    row: { type: Number, required: true },
    col: { type: Number, required: true }
  }],
  cashoutMultiplier: {
    type: Number
  },
  revealedCells: [{
    row: { type: Number, required: true },
    col: { type: Number, required: true }
  }],
  gridSize: {
    type: Number,
    default: 5
  }
}, {
  timestamps: true
});

// Static method to create and initialize a new game
gameSchema.statics.createNewGame = async function(userId, betAmount, mineCount) {
  const gridSize = 5;
  
  // Generate mine positions
  const minePositions = [];
  while (minePositions.length < mineCount) {
    const row = Math.floor(Math.random() * gridSize);
    const col = Math.floor(Math.random() * gridSize);
    
    if (!minePositions.some(mine => mine.row === row && mine.col === col)) {
    minePositions.push({ row, col });
    }
  }

  // Create and save the new game
  const game = new this({
    userId,
    betAmount,
    mineCount,
    minePositions,
    gridSize,
    status: 'active',
    multiplier: 1.0,
    revealedCells: []
  });

  await game.save();
  return game;
};


// Instance method to reveal a cell
gameSchema.methods.revealCell = function(row, col) {
  if (this.status !== 'active') {
    throw new Error('Game is not active');
  }

  // Check if already revealed
  if (this.revealedCells.some(cell => cell.row === row && cell.col === col)) {
    return { alreadyRevealed: true };
  }

  // Add to revealed cells
  this.revealedCells.push({ row, col });

  // Check if it's a mine
  if (this.minePositions.some(mine => mine.row === row && mine.col === col)) {
    this.status = 'lost';
    this.winAmount = 0;
    return { gameOver: true, result: 'lost' };
  }

  // Update multiplier
  this.multiplier = 1.0 + (0.2 * this.revealedCells.length);

  return {
    gameOver: false,
    multiplier: this.multiplier,
    revealedCells: this.revealedCells
  };
};

// Instance method to cash out
gameSchema.methods.cashOut = function() {
  if (this.status !== 'active') {
    throw new Error('Game is not active');
  }

  this.status = 'cashed_out';
  this.cashoutMultiplier = this.multiplier;
  this.winAmount = this.betAmount * this.multiplier;

  return {
    gameOver: true,
    result: 'cashed_out',
    winAmount: this.winAmount
  };
};

// Add index for faster queries
gameSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Game', gameSchema);