const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');

router.post('/claim-daily', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const now = new Date();

        // If it's a new day, reset quests
        if (!user.progress.daily.lastClaimed || !isSameDay(now, new Date(user.progress.daily.lastClaimed))) {
            user.progress.daily.quests = getDefaultDailyQuests();
            user.progress.daily.claimedToday = false;
            user.progress.daily.completed = 0;
        }

        // Prevent double claim
        if (user.progress.daily.claimedToday && isSameDay(now, new Date(user.progress.daily.lastClaimed))) {
            return res.status(400).json({ 
                success: false, 
                message: 'Already claimed daily reward today' 
            });
        }

        // Check if all quests are completed
        const allCompleted = user.progress.daily.quests.every(q => q.completed);
        if (!allCompleted) {
            return res.status(400).json({
                success: false,
                message: 'Complete all daily quests first!'
            });
        }

        // Mark claim
        user.progress.daily.claimedToday = true;
        user.progress.daily.lastClaimed = now;
        user.progress.daily.completed += 1;

        // Weekly streak
        const dayOfWeek = now.getDay();
        user.progress.weekly.streak[dayOfWeek] = true;
        user.progress.weekly.lastUpdated = now;

        const weeklyCompleted = checkWeeklyCompletion(user.progress.weekly.streak);
        if (weeklyCompleted) {
            user.progress.weekly.completed = (user.progress.weekly.completed || 0) + 1;
            resetWeeklyStreak(user.progress.weekly);
        }

        // Add XP & handle level ups
        user.progress.level.xp += 50;
        while (user.progress.level.xp >= user.progress.level.nextLevelXp) {
            user.progress.level.xp -= user.progress.level.nextLevelXp;
            user.progress.level.current += 1;
            user.progress.level.nextLevelXp = Math.floor(user.progress.level.nextLevelXp * 1.5);
        }

        await user.save();
        res.json({ 
            success: true, 
            progress: user.progress,
            leveledUp: weeklyCompleted
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Default quests
function getDefaultDailyQuests() {
    return [
        { id: 1, description: 'Play 20 Games', current: 0, goal: 20, completed: false },
        { id: 2, description: 'Bet more than $1000', current: 0, goal: 1, completed: false },
        { id: 3, description: 'Win $2000', current: 0, goal: 1, completed: false },
        { id: 4, description: 'Click on 50 safe spaces', current: 0, goal: 50, completed: false }
    ];
}

function isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
}

function checkWeeklyCompletion(streak) {
    return streak.every(day => day === true);
}

function resetWeeklyStreak(weeklyProgress) {
    weeklyProgress.streak = new Array(7).fill(false);
}
