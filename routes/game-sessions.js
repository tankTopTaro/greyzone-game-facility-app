const express = require('express');
const router = express.Router();
const gamesessionsController = require('../controllers/gamesessionsController');

router.post('/', gamesessionsController.uploadGameSession);

module.exports = router;