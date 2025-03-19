import dbHelpers from "../utils/dbHelpers.js"
import axios from "axios"
import { jobQueue } from "../utils/queue.js"
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let facilityInstance = null
const DB_PATH = path.join(__dirname, '../assets/csa/db.json')
const CALLS_PATH = path.join(__dirname, '../assets/csa/calls.json')

const teamsController = {
    setFacilityInstance: (instance) => {
        facilityInstance = instance
    },

    getTeam: async (req, res) => {
        const teamId = req.params.team_id
        let cache = dbHelpers.readDatabase(DB_PATH) || {} 

        try {
            // Ensure 'teams' object exists in db.json
            if (!cache.teams) {
                cache.teams = {}
            }

            // Check if team data exists in cache 
            if (cache.teams[teamId]) {
                return res.json(cache.teams[teamId])
            }

            // Fetch team data from CSA if not in cache
            // console.log(`Fetching team ${teamId} from CSA...`)
            const csaResponse = await axios.get(`${process.env.CSA_API_URL}/teams/${teamId}`)

            if (csaResponse.status === 200 && csaResponse.data) {
                const teamData = csaResponse.data

                const players = teamData.unique_identifiers ? teamData.unique_identifiers.split(',').filter(Boolean) : []

                // Transform CSA response to match 'db.json' format
                const transformedData = {
                    id: teamData.id,
                    name: teamData.name || '',
                    nbr_of_players: teamData.nbr_of_players || 0,
                    players: players,
                    unique_identifiers: teamData.unique_identifiers || '',
                }

                // Cache the transformed player data
                cache.teams[teamId] = transformedData
                dbHelpers.writeDatabase(DB_PATH, cache) // Save to db.json

                return res.json(transformedData)
            } else {
                return res.status(404).json({ error: "Team not found in CSA" })
            }
        } catch (error) {
            console.error("Error fetching team from CSA:", error.message)
            res.status(500).json({ error: "Could not fetch team data"})
        }
    },
    
    createTeam: async (req, res) => {
        try {
            // Extract team data from request
            const { unique_identifiers, leagues } = req.body

            // Validate required fields
            if (!unique_identifiers || unique_identifiers.length < 2) {
                return res.status(400).json({ error: "Missing required field." })
            }

            // Format the unique_identifiers
            const formattedIdentifiers = unique_identifiers.sort((a, b) => {
               const aNumber = parseInt(a.id.split('-')[1], 10);
               const bNumber = parseInt(b.id.split('-')[1], 10);
               return aNumber - bNumber;
            }).join(',')

            // Check if a team with the same unique_identifiers exists
            const existingTeam = await dbHelpers.findTeamByIdentifiers(formattedIdentifiers)

            if (existingTeam) {
               //console.log(existingTeam)
               return res.json({ message: "Team already exists", team: existingTeam.players })
            }

            // Generate a random team name
            const teamNames = [
               "Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India", "Juliett",
               "Kilo", "Lima", "Mike", "November", "Oscar", "Papa", "Quebec", "Romeo", "Sierra", "Tango",
               "Uniform", "Victor", "Whiskey", "X-ray", "Yankee", "Zulu"
           ]

           const randomName = teamNames[Math.floor(Math.random() * teamNames.length)]

           const digitLength = Math.floor(Math.random() * 4) + 1
           const randomNumber = Math.floor(Math.random() * Math.pow(10, digitLength))

           const teamName = `Team ${randomName} ${randomNumber}`

            // count the number of players
            const nbr_of_players = unique_identifiers.length

            const teamData = {
                id: formattedIdentifiers,
                name: teamName,
                nbr_of_players: nbr_of_players,
                unique_identifier: formattedIdentifiers,
            }

            // Store teams to local DB first
            await dbHelpers.saveTeam(teamData, unique_identifiers, leagues)

            // Store API call details locally
            const generateCallId = () => `call_${Date.now()}_${Math.floor(Math.random() * 10000)}`
            const apiCallRecord = {
                call_id: generateCallId(),
                endpoint: `${process.env.CSA_API_URL}/teams`,
                payload: teamData,
                status: "pending",
                attempts: 0,
            }

            await dbHelpers.storeApiCall(CALLS_PATH, apiCallRecord)

            // Respond to client immediately
            res.json({ message: "Player added to queue for processing." })

            // Enqueue API request for processing
            const jobId = Date.now()
    
            jobQueue.addJob({
                id: jobId,
                run: async () => {
                    try {
                        await axios.post(apiCallRecord.endpoint, teamData)
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
            console.error("Error processing team creation:", error.message)
            res.status(500).json({ error: "Server error" })
        }
    }
}

export default teamsController