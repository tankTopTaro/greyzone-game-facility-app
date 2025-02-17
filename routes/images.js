const express = require('express');
const router = express.Router();
const imagesController = require('../controllers/imagesController');

router.get('/players/:player_id.jpg', imagesController.getImages);

module.exports = router;