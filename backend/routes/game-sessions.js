import express from 'express'
import gamesessionsController from '../controllers/gamesessionsController.js'

const router = express.Router()

router.post('/', gamesessionsController.uploadGameSession)
router.post('/:gra_id/submit-game-session', gamesessionsController.submitGameSessionToGameRoom)

export default router