const express = require('express');
const router = express.Router();
const playersController = require('../controllers/playersController');

router.get('/search', playersController.searchPlayers);
router.get('/:player_id', playersController.getPlayer);
router.post('/', playersController.createPlayer);

module.exports = router;