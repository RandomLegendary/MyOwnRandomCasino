const Game = require('../models/Game');
const User = require('../models/User');
const Log = require('../models/Log');
const { logger } = require('../utils/logger');
const { generateGameGrid } = require('../utils/helpers');

// Start a new game
exports.startGame = async (req, res) => {
    try {
        const { betAmount, mineCount } = req.body;
        const userId = req.user.id;
        
        // Validate input
        if (!betAmount || !mineCount || isNaN(betAmount)) {
            return res.status(400).json({ error: 'Invalid input' });
        }
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Check balance
        if (user.balance < betAmount) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }
        
        // Deduct bet amount
        user.balance -= betAmount;
        user.totalWagered += betAmount;
        await user.save();
        
        // Generate game grid
        const { grid, minePositions } = generateGameGrid(5, mineCount);
        
        // Create new game
        const game = new Game({
            userId,
            betAmount,
            mineCount,
            gridSize: 5,
            minePositions,
            status: 'in_progress',
            multiplier: 1.0,
            revealedCells: []
        });
        
        await game.save();
        
        // Log the game start
        await Log.create({
            userId,
            action: 'game_start',
            details: {
                gameId: game._id,
                betAmount,
                mineCount
            }
        });
        
        res.json({
            gameId: game._id,
            balance: user.balance,
            gridSize: 5,
            mineCount,
            multiplier: 1.0,
            revealedCells: []
        });

        
    } catch (error) {
        logger.error(`Game start error: ${error.message}`);
        res.status(500).json({ error: 'Server error' });
    }
};

// Reveal a cell
exports.revealCell = async (req, res) => {
    try {
        const { gameId, row, col } = req.body;
        const userId = req.user.id;
        
        const game = await Game.findById(gameId);
        if (!game || game.userId.toString() !== userId) {
            return res.status(404).json({ error: 'Game not found' });
        }
        
        if (game.status !== 'in_progress') {
            return res.status(400).json({ error: 'Game is not in progress' });
        }
        
        // Check if cell is already revealed
        const isRevealed = game.revealedCells.some(cell => cell.row === row && cell.col === col);

        
        if (isRevealed) {
            return res.status(400).json({ error: 'Cell already revealed' });
        }
        
        // Check if it's a mine
        const isMine = game.minePositions.some(mine => mine.row === row && mine.col === col);


        
        if (isMine) {
        // Game over
        game.status = 'lost';
        game.endTime = new Date();
        
        await game.save();
        
        // Log game loss
        await Log.create({
            userId,
            action: 'game_lost',
            details: {
                gameId: game._id,
                betAmount: game.betAmount,
                multiplier: game.multiplier.toFixed(2)
            }
        });
        
        // Update user stats
        await User.findByIdAndUpdate(userId, {
            $inc: { gamesPlayed: 1 }
        });

        const updatedUser = await User.findById(userId);
        return res.json({
            gameId: game._id,
            betAmount: game.betAmount,
            mineCount: game.mineCount,
            gridSize: game.gridSize,
            multiplier: game.multiplier,
            potentialWin: 0,
            revealedCells: game.revealedCells,
            minePositions: game.minePositions,
            gameOver: true,
            result: 'mine',
            balance: updatedUser.balance
        });
    }
        if (!isMine) {
    // Add this cell to revealedCells
    game.revealedCells.push({ row, col });

    // Update multiplier
    game.multiplier = calculateMultiplier(
        game.revealedCells.length,
        game.gridSize * game.gridSize, // total cells
        game.mineCount
    );

    // Calculate potential win
    const potentialWin = parseFloat((game.betAmount * game.multiplier).toFixed(2));

    await game.save();

    return res.json({
        gameId: game._id,
        betAmount: game.betAmount,
        mineCount: game.mineCount,
        gridSize: game.gridSize,
        multiplier: game.multiplier,
        potentialWin,
        revealedCells: game.revealedCells,
        gameOver: false,
        result: 'safe',
        balance: (await User.findById(userId)).balance
    });
}


            
        } catch (error) {
            logger.error(`Reveal cell error: ${error.message}`);
            res.status(500).json({ error: 'Server error' });
        }
    };

function calculateMultiplier(revealedCellsCount, totalCells, mineCount) {
    // Base growth rate
    const baseRate = 0.1;
    
    // Scale rate based on how dangerous the board is
    const mineFactor = mineCount / totalCells; // higher mine ratio = higher factor
    
    // Growth increases with mineFactor (e.g., 0.2 → +20% faster growth)
    const growthRate = baseRate + (mineFactor * 0.5); // tweak multiplier as needed
    
    return parseFloat((1 + (revealedCellsCount * growthRate)).toFixed(2));
}


// Cash out
exports.cashOut = async (req, res) => {
    try {
        const { gameId } = req.body;
        const userId = req.user.id;
        
        const game = await Game.findById(gameId);
        if (!game || game.userId.toString() !== userId) {
            return res.status(404).json({ error: 'Game not found' });
        }
        
        if (game.status !== 'in_progress') {
            return res.status(400).json({ error: 'Game is not in progress' });
        }
        
        // Calculate win amount
        const winAmount = Number(game.betAmount) * Number(game.multiplier);

        
        // Update game status
        game.status = 'won';
        game.winAmount = winAmount;
        game.endTime = new Date();
        await game.save();
        
        // Update user balance and stats
        const user = await User.findByIdAndUpdate(userId, {
            $inc: { 
                balance: winAmount,
                gamesPlayed: 1,
                totalWon: winAmount
            }
        }, { new: true });
        
        // Log game win
        await Log.create({
            userId,
            action: 'game_won',
            details: {
                gameId: game._id,
                betAmount: game.betAmount,
                winAmount,
                multiplier: game.multiplier.toFixed(2)
            }
        });
        
        res.json({
            success: true,
            winAmount: winAmount.toFixed(2),
            multiplier: game.multiplier.toFixed(2),
            balance: user.balance,
            gameOver: true
        });
        
    } catch (error) {
        logger.error(`Cash out error: ${error.message}`);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get current active game
exports.getActiveGame = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Find the most recent active game for the user
        const game = await Game.findOne({ 
            userId, 
            status: 'in_progress' 
        }).sort({ createdAt: -1 });
        
        if (!game) {
            return res.status(404).json({ error: 'No active game found' });
        }
        
        res.json({
            gameId: game._id,
            betAmount: game.betAmount,
            mineCount: game.mineCount,
            gridSize: game.gridSize,
            multiplier: game.multiplier,
            revealedCells: game.revealedCells,
            status: game.status
        });
        
    } catch (error) {
        logger.error(`Get active game error: ${error.message}`);
        res.status(500).json({ error: 'Server error' });
    }
};