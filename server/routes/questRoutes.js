const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');


// Default quests
function getDefaultDailyQuests() {
    return [
        { id: 1, description: 'Play 20 Games', current: 0, goal: 20, completed: false, reward: 200 },
        { id: 2, description: 'Bet more than $1000', current: 0, goal: 1, completed: false, reward: 200 },
        { id: 3, description: 'Win $2000', current: 0, goal: 1, completed: false, reward: 200 },
        { id: 4, description: 'Click on 50 safe spaces', current: 0, goal: 50, completed: false, reward: 200 }
    ];
}


function isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
}

// Reset or initialize daily quests
router.post('/reset-if-needed', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user.progress.daily.quests || user.progress.daily.quests.length === 0) {
            user.progress.daily.quests = getDefaultDailyQuests();
            user.progress.daily.completed = 0;
            user.progress.daily.claimedToday = false;
            user.progress.daily.lastClaimed = null;
            await user.save();
            return res.json({ quests: user.progress.daily.quests });
        }

        if (!isSameDay(new Date(), new Date(user.progress.daily.lastClaimed || 0))) {
            user.progress.daily.quests = getDefaultDailyQuests();
            user.progress.daily.completed = 0;
            user.progress.daily.claimedToday = false;
            user.progress.daily.lastClaimed = new Date();
            await user.save();
        }

        res.json({ quests: user.progress.daily.quests });
    } catch (err) {
        console.error('Quest reset error:', err);
        res.status(500).json({ error: 'Server error resetting quests' });
    }
});

// Update a specific quest progress
router.post('/update-progress', authenticate, async (req, res) => {
    const { questId, increment = 1 } = req.body;

    try {
        const user = await User.findById(req.user.id);

        if (!user.progress.daily.quests) {
            user.progress.daily.quests = getDefaultDailyQuests();
        }

        const quest = user.progress.daily.quests.find(q => q.id === questId);
        if (!quest) return res.status(404).json({ error: 'Quest not found' });

        // Update progress
        quest.current += increment;

        // Mark completed if goal reached
        if (quest.current >= quest.goal && !quest.completed) {
            quest.completed = true;

            // Give reward (money)
            const rewardAmount = quest.reward || 100; // default 100 if not set
            user.balance += rewardAmount;
        }

        await user.save();

        res.json({ quests: user.progress.daily.quests, balance: user.balance });
    } catch (err) {
        console.error('Error updating quest progress:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/level-up', authenticate, async (req, res) => {
    try {
        const { level, moneyReward, xpReward } = req.body;
        const userId = req.user._id;

        // Add money to balance
        await User.findByIdAndUpdate(userId, {
            $inc: { balance: moneyReward }
        });

        // Add XP (which might trigger another level up)
        const user = await User.findById(userId);
        user.progress.level.xp += xpReward;
        
        // Check for additional level ups
        while (user.progress.level.xp >= user.progress.level.nextLevelXp) {
            user.progress.level.xp -= user.progress.level.nextLevelXp;
            user.progress.level.current += 1;
            user.progress.level.nextLevelXp = Math.floor(user.progress.level.nextLevelXp * 1.2);
        }

        await user.save();
        
        res.json({ 
            success: true,
            user: formatUserResponse(user)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
