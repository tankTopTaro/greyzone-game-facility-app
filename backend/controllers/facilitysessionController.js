import axios from 'axios'
import dbHelpers from '../utils/dbHelpers.js'
import { jobQueue } from "../utils/queue.js"
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

let facilityInstance = null
const DB_PATH = path.join(__dirname, '../assets/csa/db.json')
const CALLS_PATH = path.join(__dirname, '../assets/csa/calls.json')

const facilitysessionController = {
    setFacilityInstance: (instance) => {
        facilityInstance = instance
    },

    createFacilitySession: async (req, res) => {
        const { player_id, duration_m } = req.body

        if (!facilityInstance || !facilityInstance.facility_id) {
            return res.status(500).json({ error: "Facility instance is not initialized." })
        }
        
        const facility_id = facilityInstance.facility_id

        if (!player_id || !duration_m) {
            return res.status(400).json({ error: "Missing required field." })
        }

        let db = dbHelpers.readDatabase(DB_PATH, {})

        if (!db) {
            return res.status(500).json({ error: 'Failed to read database.' })
        }

        // Check if player exists in GFA database
        let player = db.players[player_id]

        // If player does not exist, fetch from CSA
        if (!player) {
            try {
                // Fetch player data from CSA if not in cache
                console.log(`Fetching player ${player_id} from CSA...`)
                const csaResponse = await axios.get(`${process.env.CSA_API_PLAYERS_URL}/${player_id}`)

                if (csaResponse.status === 200 && csaResponse.data) {
                    player = csaResponse.data

                    dbHelpers.savePlayer(player)
                }
            } catch (error) {
                return res.status(500).json({ error: 'Failed to fetch player from CSA.' })
            }
        }

        const date_start = new Date(Date.now()).toISOString().replace("T", " ").slice(0, 19)
        const date_end = new Date(Date.now() + duration_m * 60000).toISOString().replace("T", " ").slice(0, 19)

        db.players[player_id].facility_session = {
            date_start: date_start,
            duration_m: duration_m,
            date_end: date_end
        }

        dbHelpers.writeDatabase(DB_PATH, db)

        const newPlayerSessions = await dbHelpers.getPlayerWithActiveSession()

        facilityInstance.socket.broadcastMessage('monitor', {type: 'facility_session', players: newPlayerSessions})

        // Cascade to CSA
        const facilitySessionData = {
            date_exec: date_start,
            duration_m: duration_m,
            facility_id: facility_id,
            player_id: player_id
        }

        // Store API call details locally
        const generateCallId = () => `call_${Date.now()}_${Math.floor(Math.random() * 10000)}`
        const apiCallRecord = {
            call_id: generateCallId(),
            endpoint: `${process.env.CSA_API_FACILITY_SESSION_URL}/create`,
            payload: facilitySessionData,
            status: "pending",
            attempts: 0,
        }

        await dbHelpers.storeApiCall(CALLS_PATH, apiCallRecord)

        const jobId = Date.now()
    
         jobQueue.addJob({
            id: jobId,
            run: async () => {
               try {
                  await axios.post(apiCallRecord.endpoint, facilitySessionData)
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
    },

    addTimeCredits: async (req, res) => {
        const { player_id, additional_m } = req.body;
    
        if (!facilityInstance || !facilityInstance.facility_id) {
            return res.status(500).json({ error: "Facility instance is not initialized." });
        }
    
        if (!player_id || !additional_m) {
            return res.status(400).json({ error: "Missing required field." });
        }
    
        let db = dbHelpers.readDatabase(DB_PATH, {});
    
        if (!db) {
            return res.status(500).json({ error: 'Failed to read database.' });
        }
    
        let player = db.players[player_id];
    
        if (!player || !player.facility_session) {
            return res.status(404).json({ error: "Player does not have an active facility session." });
        }
    
        // Extend the session
        const { date_start, duration_m, date_end } = player.facility_session;
    
        const new_duration_m = duration_m + additional_m;
        const new_date_end = new Date(new Date(date_end).getTime() + additional_m * 60000)
            .toISOString().replace("T", " ").slice(0, 19);
    
        player.facility_session = {
            date_start: date_start,
            duration_m: new_duration_m,
            date_end: new_date_end
        };
    
        db.players[player_id] = player;
    
        // Save the updated session to the database
        dbHelpers.writeDatabase(DB_PATH, db);
    
        // Fetch updated player sessions
        const updatedSessions = await dbHelpers.getPlayerWithActiveSession();
    
        // Broadcast the updated session to clients
        facilityInstance.socket.broadcastMessage('monitor', { type: 'facility_session', players: updatedSessions });
    
        // Cascade update to CSA
        const facilitySessionData = {
            date_exec: date_start,
            duration_m: new_duration_m,
            facility_id: facilityInstance.facility_id,
            player_id: player_id
        };
    
        // Store API call details locally
        const generateCallId = () => `call_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        const apiCallRecord = {
            call_id: generateCallId(),
            endpoint: `${process.env.CSA_API_FACILITY_SESSION_URL}/update`,
            payload: facilitySessionData,
            status: "pending",
            attempts: 0,
        };
    
        await dbHelpers.storeApiCall(CALLS_PATH, apiCallRecord);
    
        const jobId = Date.now();
    
        jobQueue.addJob({
            id: jobId,
            run: async () => {
                try {
                    await axios.post(apiCallRecord.endpoint, facilitySessionData);
                    console.log(`Job ${jobId} completed successfully.`);
    
                    // Mark API call as completed
                    await dbHelpers.updateApiCallStatus(CALLS_PATH, apiCallRecord.call_id, "completed");
                } catch (error) {
                    console.error(`Job ${jobId} failed:`, error.message);
    
                    // Mark API call as failed
                    await dbHelpers.updateApiCallStatus(CALLS_PATH, apiCallRecord.call_id, "failed");
                }
            },
        });
    
        return res.json({ message: "Time credits added successfully.", facility_session: player.facility_session });
    }
    
}

export default facilitysessionController