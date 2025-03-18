import express from 'express'
import gameroomController from '../controllers/gameroomController.js'

const router = express.Router()

// these will be called by the GRA
router.post('/:gra_id/available', gameroomController.isAvailable)   
router.get('/:gra_id/is-upcoming-game-session', gameroomController.isUpcomingGameSession)
// this is called by the frontend
router.get('/:gra_id/status', gameroomController.getStatus)
router.post('/:gra_id/toggle-room', gameroomController.toggleRoom)

export default router