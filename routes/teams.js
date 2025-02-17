const express = require('express');
const router = express.Router();
const teamsController = require('../controllers/teamsController');

router.get('/:team_id', teamsController.getTeam);
router.post('/', teamsController.createTeam);

module.exports = router;