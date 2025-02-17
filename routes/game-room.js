const express = require('express');
const router = express.Router();
const gameroomController = require('../controllers/gameroomController');

router.get('/:gra_id/available', gameroomController.isAvailable);
router.get('/:gra_id/is-upcoming-game-session', gameroomController.isUpcomingGameSession);

module.exports = router;