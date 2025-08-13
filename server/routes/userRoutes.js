const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const { logger } = require('../utils/logger');

router.post('/add-xp', authenticate, async (req, res) => {
    try {
        const { xp } = req.body;

        // Validate that XP is a number
        if (typeof xp !== 'number' || isNaN(xp)) {
            return res.status(400).json({ error: 'XP must be a valid number' });
        }

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const result = await user.addXP(xp);
        
        res.json({
            user: {
                username: user.username,
                balance: user.balance,
                progress: user.progress
            },
            leveledUp: result.leveledUp,
            newLevel: result.newLevel
        });
    } catch (error) {
        console.error(`XP update error: ${error}`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;