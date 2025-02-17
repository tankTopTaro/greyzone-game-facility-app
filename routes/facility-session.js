const express = require('express');
const router = express.Router();
const facilitySessionController = require('../controllers/facilitysessionController');

router.post('/create', facilitySessionController.createFacilitySession);

module.exports = router;