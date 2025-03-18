import dbHelpers from "../utils/dbHelpers.js"
import { jobQueue } from "../utils/queue.js"
import path from 'path'
import axios from 'axios'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const gameRoomStatus = {} // Store game room availability
const upcomingGameSessions = {} // Store upcoming sessions per game room

const ROOMS_PATH = path.join(__dirname, '../assets/gra/rooms.json')

const gameroomController = {
  isAvailable: (req, res) => {
    const { gra_id } = req.params

    // Mark game room as available
    gameRoomStatus[gra_id] = true

    res.send(`Game Room ${gra_id} is now available`)
  },

  isUpcomingGameSession: (req, res) => {
    const { gra_id } = req.params

    // Check if there is an upcoming game session
    const hasUpcomingSession = !!upcomingGameSessions[gra_id]

    res.json({ upcomingGameSessions: hasUpcomingSession })
  },

  getStatus: async (req, res) => {
    const { gra_id } = req.params

    try {
      const response = await axios.get(`http://${gra_id}.local:3002/api/room-status`)
      const { enabled } = response.data
      return res.json({ id: gra_id, enabled })
    } catch (error) {
      return res.status(500).json({ error: 'Failed to communicate with game room'})
    }
  },

  toggleRoom: async (req, res) => {
    const { gra_id } = req.params
    const { status } = req.body

    try {
      // Send the status in the payload
      const response = await axios.post(`http://${gra_id}.local:3002/api/toggle-room`, { status });
      const { enabled } = response.data
      return res.json({ id: gra_id, enabled });
    } catch (error) {
        console.error('Error forwarding request:', error.message);
        return res.status(500).json({ error: 'Failed to communicate with game room.' });
    }
  } 
}

export default gameroomController
