import axios from 'axios'
import dbHelpers from "../utils/dbHelpers.js"
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const RFIDS_PATH = path.join(__dirname, '../assets/rfids.json')

const rfidController = {
    gameRoom: (req, res) => {
        const { gra_id } = req.params
        const { rfid_tag } = req.body

        if (!rfid_tag) {
            return res.status(400).send('Missing RFID tag.')
        }

        try {
            const isValid = checkRfidValidity(rfid_tag, 'game-room', gra_id)

            if (isValid) {
                return res.json({ status: "ok", message: `RFID valid at Game Room ${gra_id}` })
            } else {
                return res.status(403).json({ status: "access_denied", message: "RFID not allowed at this game room." })
            }
        } catch (error) {
            console.error("RFID check error:", error)
            return res.status(500).json({ error: "Internal server error." })
        }
    },
    
    booth: async (req, res) => {
        const { booth_id } = req.params
        const { rfid_tag, player } = req.body

        if (!rfid_tag || !player){
            return res.status(400).json({message: 'Missing RFID tag or player data'})
        }

        try {
            const isValid = await checkRfidValidity(rfid_tag, player)

            if (isValid) {
                return res.status(200).json({ message: `RFID valid at Booth ${booth_id}`})
            } else {
                return res.status(403).json('Access denied')
            }
        } catch (error) {
            console.error('RFID check error:', error)
            return res.status(500).json({ error: 'Internal server error' })
        }
    }
}

const checkRfidValidity = async (rfid_tag, player_id)  =>{
    try {
        let rfids = dbHelpers.readDatabase(RFIDS_PATH) || {}

        if (rfids[rfid_tag]) {
            console.log('Found in cache', rfids[rfid_tag])
            return rfids[rfid_tag] === player_id
        }

        try {
            const response = await axios.get(`${process.env.CSA_API_PLAYERS_UR}/${player_id}`)
      
            if (response.status === 200) {
                const playerData = response.data
                const rfidTagFromCSA = playerData.rfid_tag_uid

                rfids[rfid_tag] = player_id
                dbHelpers.writeDatabase(RFIDS_PATH, rfids)

                return rfid_tag === rfidTagFromCSA
            }
          } catch (error) {
            console.error('Server is offline')

            rfids[rfid_tag] = player_id
            dbHelpers.writeDatabase(RFIDS_PATH, rfids)

            return rfids[rfid_tag] === player_id
          }
    } catch (error) {
        console.error('Error checking RFID:', error)
    }

    return false
}

export default rfidController
