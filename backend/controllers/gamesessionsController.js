import { jobQueue } from "../utils/queue.js"
import axios from 'axios'
import path from 'path'
import { fileURLToPath } from 'url'
import dbHelpers from '../utils/dbHelpers.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DB_PATH = path.join(__dirname, '../assets/csa/db.json')
const ROOM_TO_GAME_PATH = path.join(__dirname, '../assets/gra/room-to-game.json')
const CALLS_PATH = path.join(__dirname, '../assets/gra/calls.json')

let facilityInstance = null

const gamesessionsController = {
    setFacilityInstance: (instance) => {
        facilityInstance = instance
    },

    uploadGameSession: async (req, res) => {
        if (!facilityInstance || !facilityInstance.facility_id) {
            return res.status(500).json({ error: "Facility instance is not initialized." })
        }

        const facility_id = facilityInstance.facility_id

        try {
            const { room_type, game_rule, game_level, duration_s_theory, duration_s_actual, game_log, log, is_collaborative, parent_gs_id} = req.body

            // Validate required fields
            if (!room_type || !game_rule || !game_level) {
                return res.status(400).json({ error: "Missing required field." })
            }

            const gameSessionData = {
                date_add: new Date().toISOString(),
                room_type: room_type,
                game_rule: game_rule,
                game_level: game_level,
                duration_s_theory: duration_s_theory,
                duration_s_actual: duration_s_actual,
                game_log: game_log,
                log: log,
                is_collaborative: is_collaborative,
                parent_gs_id: parent_gs_id,
                facility_id: facility_id
            }

            const jobId = Date.now()

            // Add job to queue
            jobQueue.addJob({
                id: jobId,
                run: async () => {
                    try {
                        await axios.post(`${process.env.CSA_API_URL}/game-sessions`, gameSessionData)
                        console.log(`Job ${jobId} completed successfully.`)
                    } catch (error) {
                        console.error(`Job ${jobId} failed:`, error.message)
                    }
                }
            })

            res.json({ message: "Game session added to queue for processing." })
        } catch (error) {
            console.error("Error processing game session:", error.message)
            res.status(500).json({ error: "Server error" })
        }
    },

    submitGameSessionToGameRoom: async (req, res) => {
        const { gra_id } = req.params
        const { players, locationKey } = req.body

        const roomToGameData = dbHelpers.readDatabase(ROOM_TO_GAME_PATH, {})
        const dbData = dbHelpers.readDatabase(DB_PATH, {})
        const teamsData = dbData.teams
        const playersData = dbData.players

        let teamInfo = null

        for(const teamKey in teamsData) {
            const team = teamsData[teamKey]
            
            if (Array.isArray(team.players) && Array.isArray(players) && team.players.length === players.length &&
               team.players.every(player => players.includes(player))) {
               teamInfo = team;
               break;
            }

        }

        const playerDetails = Array.isArray(players) 
         ? players.map(playerId => playersData[playerId] || { id: playerId, error: "Player not found" }) 
         : [];


        if (!roomToGameData[locationKey]) {
            return res.status(404).json({error: `No room data found for ${locationKey}`})
        }

        const { roomType, rules } = roomToGameData[locationKey]

        if (!rules || rules.length === 0) {
            return res.status(400).json({ error: 'No rules available for this room'})
        }

        const selectedRule = rules[Math.floor(Math.random() * rules.length)]
        const roomInfo = `${roomType},${selectedRule},L1`

        // Calculate book_room_until using the minimum date_end
        let minDateEnd = null
        for (const playerId of players) {
            const player = playersData[playerId]

            if(player && player.facility_session && player.facility_session.date_end) {
                const playerDateEnd = new Date(player.facility_session.date_end + 'Z')
                if (!minDateEnd || playerDateEnd < minDateEnd) {
                    minDateEnd = playerDateEnd
                }
            }
        }

        let bookRoomUntil = null
        if (minDateEnd) {
            bookRoomUntil = new Date(minDateEnd.getTime() + 6 * 60 * 1000) // Add 6 minutes
                .toISOString().replace('T', ' ').substring(0, 19)   // Format as 'YYYY-MM-DD HH:mm:ss'
        }

        const gameSessionData = {
            team: teamInfo,
            players: playerDetails,
            room: roomInfo,
            book_room_until: bookRoomUntil
        }

        // Store API call details locally
        const generateCallId = () => `call_${Date.now()}_${Math.floor(Math.random() * 10000)}`
        const apiCallRecord = {
            call_id: generateCallId(),
            endpoint: `http://${gra_id}.local:3002/api/start-game-session`,
            payload: gameSessionData,
            status: "pending",
            attempts: 0,
        }

        await dbHelpers.storeApiCall(CALLS_PATH, apiCallRecord)

        const jobId = Date.now()

        jobQueue.addJob({
            id: jobId,
            run: async () => {
               try {
                  await axios.post(apiCallRecord.endpoint, gameSessionData)
                  console.log(`Job ${jobId} completed successfully.`)
                  
                  // Update API call status in local DB
                  await dbHelpers.updateApiCallStatus(CALLS_PATH, apiCallRecord.call_id, "completed")
               } catch (error) {
                  console.error(`Job ${jobId} failed:`, error.message)

                  // Mark API call as failed in local DB
                  await dbHelpers.updateApiCallStatus(CALLS_PATH, apiCallRecord.call_id, "failed")
               }
            },
        })

        res.status(200).json({ success: true, message: "Game session submitted, processing in the background.", jobId })
    }
}

export default gamesessionsController