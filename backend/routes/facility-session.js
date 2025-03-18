import express from 'express'
import facilitySessionController from '../controllers/facilitysessionController.js'

const router = express.Router()

router.post('/create', facilitySessionController.createFacilitySession)
router.post('/add-time-credits', facilitySessionController.addTimeCredits)

export default router