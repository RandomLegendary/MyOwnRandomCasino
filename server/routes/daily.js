const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');

const DAILY_AMOUNT = 1000;
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

router.post('/claim-daily', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).exec();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const now = Date.now();
    const lastDaily = user.lastDaily ? user.lastDaily.getTime() : 0;

    if (lastDaily && (now - lastDaily) < COOLDOWN_MS) {
      const nextAvailable = new Date(lastDaily + COOLDOWN_MS).toISOString();
      const msLeft = (lastDaily + COOLDOWN_MS) - now;

      return res.json({
        success: false,
        error: 'Cooldown',
        nextAvailable,
        msLeft
      });
    }

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


router.get('/daily-status', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const now = Date.now();
    const lastDaily = user.lastDaily ? user.lastDaily.getTime() : 0;

    if (lastDaily && (now - lastDaily) < COOLDOWN_MS) {
      return res.json({
        msLeft: COOLDOWN_MS - (now - lastDaily),
        nextAvailable: new Date(lastDaily + COOLDOWN_MS).toISOString()
      });
    } else {
      return res.json({ msLeft: 0 });
    }
  } catch (err) {
    console.error('daily-status error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});


module.exports = router;
