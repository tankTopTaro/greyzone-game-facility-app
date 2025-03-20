import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const DB_PATH = path.join(__dirname, '../assets/csa/db.json')
const SCANS_PATH = path.join(__dirname, '../assets/ws/scans.json')
const CLIENTS_PATH = path.join(__dirname, '../assets/ws/clients.json')
const MESSAGES_PATH = path.join(__dirname, '../assets/ws/messages.json')

const dbHelpers = {
    readDatabase: (filePath, defaultValue = {}) => {
        try {
            if (!fs.existsSync(filePath)) {
                console.warn(`File ${filePath} not found, initializing with default value.`)
                fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf8')
                return defaultValue
            }
    
            const rawData = fs.readFileSync(filePath, 'utf8')
            const parsedData = JSON.parse(rawData)
    
            if (!parsedData || typeof parsedData !== "object") {
                console.warn(`Invalid DB structure in ${filePath}:`, parsedData)
                return defaultValue
            }
    
            return parsedData
        } catch (error) {
            console.error(`Error reading ${filePath}:`, error)
            return defaultValue
        }
    },

    writeDatabase: (filePath, data) => {
        try {
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
            //console.log(`Updated ${filePath}`)
        } catch (error) {
            console.error(`Error writing to ${filePath}:`, error)
        }
    },

    // WebSockets
    updateClientData: (clients) => {
        dbHelpers.writeDatabase(CLIENTS_PATH, clients)
    },

    appendMessages: (newMessage) => {
        const messages = dbHelpers.readDatabase(MESSAGES_PATH, [])

        const isDuplicate = messages.some(message =>
            message.type === newMessage.type &&
            message.location === newMessage.location &&
            message.id === newMessage.id &&
            message.player === newMessage.player
        )

        if (!isDuplicate) {
            messages.push(newMessage)
            dbHelpers.writeDatabase(MESSAGES_PATH, messages)
        }
    },

    clearMessages: (messageType, from) => {
        const lastDashIndex = from.lastIndexOf('-')

        if(lastDashIndex === -1) {
            console.error('Invalid from format')
            return
        }

        const location = from.substring(0, lastDashIndex)
        const id = from.substring(lastDashIndex + 1)

        if (!location || isNaN(id)) {
            console.error('Invalid extracted values:', {location, id})
            return
        }

        fs.readFile(MESSAGES_PATH, 'utf8', (err, data) => {
            if (err) {
               console.error('Error reading messages:', err)
               return
            }

            let messages = JSON.parse(data)

            messages = messages.filter(msg => 
               !(msg.type === messageType && msg.location === location && msg.id === Number(id))
           )

           fs.writeFile(MESSAGES_PATH, JSON.stringify(messages), (err) => {
                  if (err) console.error('Error writing messages:', err)
            })
        })

        if (location === 'game-room') {
            fs.readFile(SCANS_PATH, 'utf8', (err, scanData) => {
                if (err) {
                    console.error('Error reading scans:', err);
                    return;
                }

                let scannedPlayers = JSON.parse(scanData);

                const roomKey = `${location}-${id}`;

                if (scannedPlayers[roomKey]) {
                    delete scannedPlayers[roomKey];

                    fs.writeFile(SCANS_PATH, JSON.stringify(scannedPlayers), (err) => {
                        if (err) console.error('Error updating scans:', err);
                    });
                }
            });
        }
    },

    // API Calls
    storeApiCall: async (JSON_PATH, apiCallRecord) => {
        const db = dbHelpers.readDatabase(JSON_PATH)

        if(!db['pending_api_calls']) {
            db['pending_api_calls'] = []
        }

        db['pending_api_calls'].push(apiCallRecord)
        dbHelpers.writeDatabase(JSON_PATH, db)
        console.log(`API call for ${apiCallRecord.id} stored for tracking.`)
    },

    updateApiCallStatus: async (JSON_PATH, call_id, status) => {
        const db = dbHelpers.readDatabase(JSON_PATH)
    
        if (!db["pending_api_calls"]) return
    
        const apiCallIndex = db["pending_api_calls"].findIndex(call => call.call_id === call_id)
    
        if (apiCallIndex !== -1) {
            db["pending_api_calls"][apiCallIndex].status = status
            dbHelpers.writeDatabase(JSON_PATH, db)
            console.log(`API call status for ${call_id} updated to '${status}'.`)

            if (status === 'completed') {
               await dbHelpers.clearCompletedApiCalls(JSON_PATH)
            }
        }
    },

    clearCompletedApiCalls: async (JSON_PATH) => {
         const db = dbHelpers.readDatabase(JSON_PATH)
   
         if (!db["pending_api_calls"]) return
   
         // Keep only API calls that are not completed
         db["pending_api_calls"] = db["pending_api_calls"].filter(call => call.status !== "completed")
   
         dbHelpers.writeDatabase(JSON_PATH, db)
         console.log("Cleared completed API calls.")
    },

    // Database
    savePlayer: async (playerData) => {
      const db = dbHelpers.readDatabase(DB_PATH);

      if (!db['players']) {
         db['players'] = {};
      }

      const formattedPlayer = {
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
         },
         games_history: {},
         facility_session: {}
      };

      // Add/Update the player data
      db['players'][playerData.id] = formattedPlayer;

      // Sort the players numerically by the increment part of their ID (after the '-')
      const sortedPlayers = Object.values(db['players']).sort((a, b) => {
         const aNumber = parseInt(a.id.split('-')[1], 10);
         const bNumber = parseInt(b.id.split('-')[1], 10);
         return aNumber - bNumber;
      });

      // Rebuild the players object with sorted entries
      db['players'] = Object.fromEntries(sortedPlayers.map(player => [player.id, player]));

      // Write the sorted database back
      dbHelpers.writeDatabase(DB_PATH, db);

      console.log(`Player ${playerData.id} saved to local database.`);
   },

    saveTeam: async(teamData, unique_identifiers, league) => {
        const db = dbHelpers.readDatabase(DB_PATH)

        if(!db['teams']){
            db['teams'] = {}
        }

        const formattedTeam = {
            id: teamData.id,
            name: teamData.name,
            nbr_of_players: teamData.nbr_of_players,
            players: unique_identifiers,
            unique_identifier: teamData.unique_identifier,
            league,
            games_history: {},
            events_to_debrief: []
        }

        db['teams'][teamData.id] = formattedTeam

        dbHelpers.writeDatabase(DB_PATH, db)
        console.log(`Team ${teamData.name} saved to local database`)
    },

    getPlayers: async () => {
        try {
            let cache = dbHelpers.readDatabase(DB_PATH) || {}
            
            if(!cache.players) {
                console.warn('No players found in database, initializing empty object.')
                cache.players = {}
            }

            return Object.values(cache.players)
        } catch (error) {
            console.error('Error fetching player', error.message)
            return []
        }
    },

    getPlayerWithActiveSession: async () => {
        try {
            const db = dbHelpers.readDatabase(DB_PATH, {});

            const now = new Date();
    
            let activePlayers = Object.values(db.players).filter(player => {
                if (!player.facility_session || !player.facility_session.date_end) {
                    return false; // Skip players without an active session
                }
    
                const dateEnd = new Date(player.facility_session.date_end + 'Z'); // Ensure UTC
    
                return now < dateEnd;
            });

            return activePlayers;
        } catch (error) {
            console.error('Error fetching active players', error.message);
            return [];
        }
    },

    getPlayerWithRecentSession: async () => {
      try {
         const db = dbHelpers.readDatabase(DB_PATH, {})

         const now = new Date()

         const oneHourAgo = new Date(now.getTime() - 60 * 60000)

         let playersWithRecentEnd = Object.values(db.players).filter(player => {
            if (!player.facility_session || !player.facility_session.date_end) {
               return false
            }

            const dateEnd = new Date(player.facility_session.date_end.replace(' ', 'T') + 'Z');

            return dateEnd <= now && dateEnd >= oneHourAgo
         })

         return playersWithRecentEnd
      } catch (error) {
         console.error('Error fetching players with recently ended sessions')
         return []
      }
    },

    findTeamByIdentifiers: (formattedIdentifiers) => {
      const db = dbHelpers.readDatabase(DB_PATH)

      if (!db["teams"]) return null

      // Look for an existing team with the same unique_identifier
      const existingTeam = Object.values(db['teams']).find(team => team.unique_identifier === formattedIdentifiers)

      return existingTeam || null
    },

    getNextIncrement: (dbKey, facility_id) => {
        const db = dbHelpers.readDatabase(DB_PATH)
        if (!db || !db["players"] || Object.keys(db["players"]).length === 0) return 1
    
        //console.log("Database Entries:", db["players"]) // Debugging
    
        let numbers = []
    
        if (dbKey === "players") {
            numbers = Object.values(db["players"])
                .map(entry => entry.id?.match(new RegExp(`^F${facility_id}-(\\d+)$`)))
                .filter(match => match)
                .map(match => parseInt(match[1], 10))
        } else if (dbKey === "teams") {
            numbers = Object.values(db["teams"])
                .map(entry => entry.id?.match(new RegExp(`^F${facility_id}-T(\\d+)$`)))
                .filter(match => match)
                .map(match => parseInt(match[1], 10))
        } else if (dbKey === "facility_sessions") {
            numbers = Object.values(db["players"])
                .map(player => player.facility_session?.id?.match(new RegExp(`^F${facility_id}-S(\\d+)$`)))
                .filter(match => match)
                .map(match => parseInt(match[1], 10))
        }
    
        return numbers.length === 0 ? 1 : Math.max(...numbers) + 1
    },

    getPlayerNextIncrement: (facility_id) => {
        return dbHelpers.getNextIncrement('players', facility_id)
    },
}

export default dbHelpers
