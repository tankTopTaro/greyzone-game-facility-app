import dbHelpers from "../utils/dbHelpers.js"
import axios from "axios"
import { jobQueue } from "../utils/queue.js"
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let facilityInstance = null
const DB_PATH = path.join(__dirname, '../assets/csa/db.json')
const PLAYERS_PATH = path.join(__dirname, '../assets/csa/players.json')
const CALLS_PATH = path.join(__dirname, '../assets/csa/calls.json')

const playersController = {
    setFacilityInstance: (instance) => {
        facilityInstance = instance
    },

    getById: async (req, res) => {
        const playerId = req.params.player_id
        
        let cache = dbHelpers.readDatabase(DB_PATH, {})

        try {
            // Ensure 'players' object exists in db.json
            if (!cache.players) {
                cache.players = {}
            }

            // Check if player data exists in cache
            if (cache.players[playerId]) {
                return res.json(cache.players[playerId])
            }

            // Fetch player data from CSA if not in cache
            console.log(`Fetching player ${playerId} from CSA...`)
            const csaResponse = await axios.get(`${process.env.CSA_API_PLAYERS_URL}/${playerId}`)

            if (csaResponse.status === 200 && csaResponse.data) {
                const playerData = csaResponse.data

                // Transform CSA response to match 'db.json' format
                const transformedData = {
                    id: playerData.id,
                    nick_name: playerData.nick_name,
                    date_add: playerData.date_add,
                    last_name: playerData.last_name,
                    first_name: playerData.first_name,
                    gender: playerData.gender,
                    birth_date: playerData.birth_date,
                    league: {
                        country: playerData.league_country,
                        city: playerData.league_city,
                        district: playerData.league_district,
                        other: playerData.league_other,
                    }
                }

                // Cache the transformed player data
                cache.players[playerId] = transformedData

                // Sort players by ID before saving
                const sortedPlayers = Object.values(cache.players).sort((a, b) => {
                    return parseInt(a.id.slice(-1), 10) - parseInt(b.id.slice(-1), 10);
                })

                cache.players = Object.fromEntries(sortedPlayers.map(player => [player.id, player]));
                dbHelpers.writeDatabase(DB_PATH, cache) // Save to db.json

                return res.json(transformedData)
            } else {
                return res.status(404).json({ error: "Player not found in CSA" })
            }
        } catch (error) {
            console.error("Error fetching player from CSA:", error.message)
            res.status(500).json({ error: "Could not fetch player data"})
        }
    },
    
    search: async (req, res) => {
        try {
            const { email, phone, first_name, last_name } = req.query

            if (!email && !phone && !first_name && !last_name) {
                return res.status(400).json({ error: "At least on search parameter is required." })
            }

            console.log('Forwarding search request to CSA...')
            const csaResponse = await axios.get(`${process.env.CSA_API_PLAYERS_URL}/search`, {
                params: { email, phone, first_name, last_name }
            })

            return res.json(csaResponse.data)
        } catch (error) {
            if (error.code === 'ENOTFOUND' || error.code === "ECONNREFUSED") {
                console.error('CSA API unreachable.')
                return res.status(503).json({ message: 'CSA_not_reachable' })
            }

            console.error("Error searching players:", error.message)
            return res.status(500).json({ error: "Server error" })
        }
    },
    
    create: async (req, res) => {
        if (!facilityInstance || !facilityInstance.facility_id) {
            return res.status(500).json({ error: "Facility instance is not initialized." })
        }
    
        const facility_id = facilityInstance.facility_id
    
        try {
            // Extract player data from request
            const { nick_name, email, phone, last_name, first_name, gender, birth_date, notes, league_country, league_city, league_district, league_other } = req.body
    
            // Validate required fields
            if (!first_name || !last_name || !email) {
                return res.status(400).json({ error: "Missing required fields." })
            }
    
            if (!/^\S+@\S+\.\S+$/.test(email)) {
                return res.status(400).json({ error: "Invalid email format." })
            }
    
            if (!/^\d{10,15}$/.test(phone)) {
                return res.status(400).json({ error: "Invalid phone number format." })
            }
    
            if (birth_date && isNaN(Date.parse(birth_date))) {
                return res.status(400).json({ error: "Invalid birth date format." })
            }
    
            // Generate dynamic player id and rfid_tag_uid
            const next_increment = await dbHelpers.getPlayerNextIncrement(facility_id)
            let playerId = `F${facility_id}-${next_increment}`
            const rfid_tag_uid = `RFID-${playerId}`
    
            // Prepare player data for storage and CSA API
            const playerData = {
                id: playerId,
                nick_name,
                email,
                phone,
                last_name,
                first_name,
                gender,
                birth_date,
                notes,
                log: '',   // add any issues that occurs when creating the player data here
                league_country,
                league_city,
                league_district,
                league_other,
                rfid_tag_uid
            }
    
            // Store player data in local DB first
            await dbHelpers.savePlayer(playerData) // Save locally
            
            let updatedPlayers = await dbHelpers.getPlayers()
            facilityInstance.socket.broadcastMessage('monitor', {
                type: 'updatedPlayers',
                players: updatedPlayers
            })
    
            // Store API call details locally
            const generateCallId = () => `call_${Date.now()}_${Math.floor(Math.random() * 10000)}`
            const apiCallRecord = {
                call_id: generateCallId(),
                endpoint: process.env.CSA_API_PLAYERS_URL,
                payload: playerData,
                status: "pending",
                attempts: 0,
            }
    
            await dbHelpers.storeApiCall(CALLS_PATH, apiCallRecord)
    
            // Enqueue API request for processing
            const jobId = Date.now()

            // Respond to client immediately
            res.status(200).json({ success: true, message: "Player data submitted, processing in the background.", jobId })
    
            jobQueue.addJob({
                id: jobId,
                run: async () => {
                    try {
                        await axios.post(apiCallRecord.endpoint, playerData)
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
        } catch (error) {
            console.error("Error processing player creation:", error.message)
            res.status(500).json({ error: "Server error" })
        }
    },
    
    getPlayers: async (req, res) => {
        try {
            let cache = dbHelpers.readDatabase(DB_PATH, { players: {} });
    
            // Fetch player IDs from the separate players.json file
            let playersData = dbHelpers.readDatabase(PLAYERS_PATH, { players: [] });
    
            if (!playersData || !Array.isArray(playersData.players) || playersData.players.length === 0) {
                console.warn("No player IDs found in players.json.");
                return res.status(404).json({ error: "No player IDs available." });
            }
    
            // Array to store promises of API requests
            const fetchPromises = playersData.players.map(async (playerId) => {
                if (cache.players[playerId]) {
                    return cache.players[playerId]; // Use cached data if available
                }
    
                console.log(`Fetching player ${playerId} from CSA...`);
                try {
                    const csaResponse = await axios.get(`${process.env.CSA_API_PLAYERS_URL}/${playerId}`);
                    if (csaResponse.status === 200 && csaResponse.data) {
                        const playerData = csaResponse.data;
    
                        // Transform CSA response to match 'db.json' format
                        const transformedData = {
                            id: playerData.id,
                            nick_name: playerData.nick_name,
                            date_add: playerData.date_add,
                            last_name: playerData.last_name,
                            first_name: playerData.first_name,
                            gender: playerData.gender,
                            birth_date: playerData.birth_date,
                            league: {
                                country: playerData.league_country,
                                city: playerData.league_city,
                                district: playerData.league_district,
                                other: playerData.league_other,
                            }
                        };
    
                        // Store in cache
                        cache.players[playerId] = transformedData;
                        return transformedData;
                    }
                } catch (error) {
                    console.error(`Failed to fetch player ${playerId}: `, error.message);
                }
                return null;
            });
    
            // Wait for all fetches to complete
            const fetchedPlayers = await Promise.all(fetchPromises);
    
            // Remove null values (failed fetches)
            const validPlayers = fetchedPlayers.filter(player => player !== null);
    
            // Sort players before saving
            const sortedPlayers = Object.values(cache.players).sort((a, b) => {
                return parseInt(a.id.slice(-1), 10) - parseInt(b.id.slice(-1), 10);
            })

            cache.players = Object.fromEntries(sortedPlayers.map(player => [player.id, player]));
    
            // Save updated player data to db.json
            dbHelpers.writeDatabase(DB_PATH, cache);
    
            res.status(200).json({ players: validPlayers });
        } catch (error) {
            console.error("Error fetching players:", error.message);
            res.status(500).json({ error: "Could not fetch players" });
        }
    },

    getPlayersWithActiveSession: async (req, res) => {
        try {
            let activePlayers = await dbHelpers.getPlayerWithActiveSession()
            res.status(200).json(activePlayers);
        } catch (error) {
            console.error('Error fetching active players:', error.message);
            res.status(500).json({ error: 'Could not fetch active player data' });
        }
    }
}

export default playersController