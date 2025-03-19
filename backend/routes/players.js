import express from 'express'
import playersController from '../controllers/playersController.js'

const router = express.Router()

router.get('/search', playersController.search)
router.get('/active', playersController.getPlayersWithActiveSession)
router.get('/:player_id', playersController.getById)
//router.get('/', playersController.getPlayers)
router.post('/', playersController.create)

export default router