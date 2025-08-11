const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

const gameController = require('../controllers/gameController');

router.use(authenticate);

router.post('/start', gameController.startGame);
router.post('/reveal', gameController.revealCell);
router.post('/cashout', gameController.cashOut);


module.exports = router;