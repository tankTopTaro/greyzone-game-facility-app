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
       facilityInstance = instance;
   },

   createFacilitySession: async (req, res) => {
       const { player_id, duration_m } = req.body;

       console.log('Player ID: ', player_id, ' Duration_M: ', duration_m);

       if (!facilityInstance || !facilityInstance.facility_id) {
           return res.status(500).json({ error: "Facility instance is not initialized." });
       }

       const facility_id = facilityInstance.facility_id;

       if (!player_id || !duration_m) {
           return res.status(400).json({ error: "Missing required field." });
       }

       let db = dbHelpers.readDatabase(DB_PATH, {});

       if (!db) {
           return res.status(500).json({ error: 'Failed to read database.' });
       }

       if (!db.players) {
           db.players = {};
       }

       // Check if player exists in GFA database
       let player = db.players[player_id];

       // If player does not exist, fetch from CSA
       if (!player) {
           try {
               console.log(`Fetching player ${player_id} from CSA...`);
               const csaResponse = await axios.get(`${process.env.CSA_API_URL}/players/${player_id}`);

               if (csaResponse.status === 200 && csaResponse.data) {
                   const playerData = csaResponse.data;

                   // Make sure the player is saved properly before continuing
                   await dbHelpers.savePlayer(playerData);

                   // Reload the database and re-fetch the player
                   db = dbHelpers.readDatabase(DB_PATH, {});
                   player = db.players[player_id];

                   // If player is still not found after saving, return an error
                   if (!player) {
                       return res.status(500).json({ error: "Failed to store player in database." });
                   }
               }
           } catch (error) {
               facilityInstance.errorHandler.handleError(error, 'createFacilitySession - Fetching player from CSA');
               return res.status(500).json({ error: 'Failed to fetch player from CSA.' });
           }
       }

       const date_start = new Date(Date.now()).toISOString().replace("T", " ").slice(0, 19);
       const date_end = new Date(Date.now() + duration_m * 60000).toISOString().replace("T", " ").slice(0, 19);

       // Ensure player object is not undefined before setting facility_session
       if (!db.players[player_id]) {
           return res.status(500).json({ error: "Player object is missing in database after save." });
       }

       // Assign facility session to player object
       db.players[player_id].facility_session = {
           date_start: date_start,
           duration_m: duration_m,
           date_end: date_end
       };

       // Save updated database after assigning facility session
       dbHelpers.writeDatabase(DB_PATH, db);

       const newPlayerSessions = await dbHelpers.getPlayerWithActiveSession();
       const recentPlayerSessions = await dbHelpers.getPlayerWithRecentSession();

       facilityInstance.socket.broadcastMessage('monitor', {
           type: 'facility_session',
           active_players: newPlayerSessions,
           recent_players: recentPlayerSessions
       });

       // Cascade to CSA
       const facilitySessionData = {
           date_exec: date_start,
           duration_m: duration_m,
           facility_id: facility_id,
           player_id: player_id
       };

       // Store API call details locally
       const generateCallId = () => `call_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
       const apiCallRecord = {
           call_id: generateCallId(),
           endpoint: `${process.env.CSA_API_URL}/facility-session/create`,
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

                   // Update API call status in local DB
                   await dbHelpers.updateApiCallStatus(CALLS_PATH, apiCallRecord.call_id, "completed");
               } catch (error) {
                   console.error(`Job ${jobId} failed:`, error.message);

                   // Mark API call as failed in local DB
                   await dbHelpers.updateApiCallStatus(CALLS_PATH, apiCallRecord.call_id, "failed");
                   facilityInstance.errorHandler.handleError(error, 'Job failure during facility session creation');
               }
           },
       });

       return res.status(200).json({ message: "Facility session created successfully." });
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

       // Extract session details
       const { date_start, duration_m, date_end } = player.facility_session;
       const now = new Date();
       const parsedDateEnd = new Date(date_end + 'Z');

       let new_duration_m;
       let new_date_start = date_start;
       let new_date_end;

       let apiEndpoint = `${process.env.CSA_API_URL}/facility-session/update`;

       if (parsedDateEnd < now) {
           // Session has ended, overwrite duration and start new session
           new_duration_m = additional_m;
           new_date_start = now.toISOString().replace('T', ' ').slice(0, 19);
           new_date_end = new Date(now.getTime() + additional_m * 60000).toISOString().replace('T', ' ').slice(0, 19);

           // Treat this as a new session
           apiEndpoint = `${process.env.CSA_API_URL}/facility-session/create`;
       } else {
           // Session is still active, extend it
           new_duration_m = duration_m + additional_m;
           new_date_end = new Date(parsedDateEnd.getTime() + additional_m * 60000).toISOString().replace('T', ' ').slice(0, 19);
       }

       // Update the player's session
       player.facility_session = {
           date_start: new_date_start,
           duration_m: new_duration_m,
           date_end: new_date_end
       };

       db.players[player_id] = player;

       dbHelpers.writeDatabase(DB_PATH, db);

       // Fetch updated player sessions
       const updatedSessions = await dbHelpers.getPlayerWithActiveSession();
       const recentSessions = await dbHelpers.getPlayerWithRecentSession();

       facilityInstance.socket.broadcastMessage('monitor', {
           type: 'facility_session',
           active_players: updatedSessions,
           recent_players: recentSessions
       });

       // Prepare the session data for the API call
       const facilitySessionData = {
           date_exec: new_date_start,
           duration_m: new_duration_m,
           facility_id: facilityInstance.facility_id,
           player_id: player_id
       };

       // Store API call details locally
       const generateCallId = () => `call_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
       const apiCallRecord = {
           call_id: generateCallId(),
           endpoint: apiEndpoint,
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

                   await dbHelpers.updateApiCallStatus(CALLS_PATH, apiCallRecord.call_id, "completed");
               } catch (error) {
                   console.error(`Job ${jobId} failed:`, error.message);

                   await dbHelpers.updateApiCallStatus(CALLS_PATH, apiCallRecord.call_id, "failed");
                   facilityInstance.errorHandler.handleError(error, 'Job failure during addTimeCredits');
               }
           },
       });

       return res.json({ message: "Time credits updated successfully.", facility_session: player.facility_session });
   }
}

export default facilitysessionController