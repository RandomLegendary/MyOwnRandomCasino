const express = require('express');
const router = express.Router();
const User = require('../models/User');

const DAILY_AMOUNT = 1000;
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours in ms

// Middleware: assume req.user is set (replace with your auth)
function requireAuth(req, res, next) {
  if (!req.user || !req.user.id) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

router.post('/claim-daily', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).exec();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const now = Date.now();
    const last = user.lastDaily ? user.lastDaily.getTime() : 0;

    if (last && (now - last) < COOLDOWN_MS) {
      const nextAvailable = new Date(last + COOLDOWN_MS).toISOString();
      const msLeft = (last + COOLDOWN_MS) - now;
      return res.status(429).json({
        error: 'Cooldown',
        nextAvailable,
        msLeft
      });
    }

    // Give the money
    user.balance = (user.balance || 0) + DAILY_AMOUNT;
    user.lastDaily = new Date(now);
    await user.save();

    return res.json({
      success: true,
      added: DAILY_AMOUNT,
      balance: user.balance,
      lastDaily: user.lastDaily
    });
  } catch (err) {
    console.error('claim-daily error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
