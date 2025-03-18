import fs from 'fs'
import cors from 'cors'
import path from 'path'
import axios from 'axios'
import dotenv from 'dotenv'
import express from 'express'
import { fileURLToPath } from 'url'

import Socket from './Socket.js'
import dbHelpers from '../utils/dbHelpers.js'
import { jobQueue } from "../utils/queue.js"

import playersRouter from '../routes/players.js'
import teamsRouter from '../routes/teams.js'
import imagesRouter from '../routes/images.js'
import rfidRouter from '../routes/rfid.js'
import facilitySessionRouter from '../routes/facility-session.js'
import gameRoomRouter from '../routes/game-room.js'
import gameSessionsRouter from '../routes/game-sessions.js'

dotenv.config()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CSA_CALLS_PATH = path.join(__dirname, '../assets/csa/calls.json')
const GRA_CALLS_PATH = path.join(__dirname, '../assets/gra/calls.json')
const PLAYERS_PATH = path.join(__dirname, '../assets/csa/players.json')
const ROOMS_PATH = path.join(__dirname, '../assets/gra/rooms.json')
const HOSTNAMES = path.join(__dirname, '../assets/gra/hostnames.json')

export default class Facility {
    constructor(facility_id) {
        this.facility_id = facility_id
        this.socket = new Socket(8081)
        this.roomStatus = {}
        this.init()
    }

    init() {
        this.startServer()
        this.monitorCSAConnection()
        this.monitorGRAConnection()
        this.downloadDatabase(this.facility_id)
    }

    startServer() {
        // Prepare server
        this.server = express()
        const serverPort = process.env.PORT || 3001
        const serverHostname = process.env.HOST || '0.0.0.0'
    
        // Middleware to set no-cache headers for all routes
        this.server.use((req, res, next) => {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
            res.setHeader('Pragma', 'no-cache')
            res.setHeader('Expires', '0')
            res.setHeader('Surrogate-Control', 'no-store')
            next()
        })
        this.server.use(express.json())
        this.server.use(cors())
        this.server.use(express.static(path.join(__dirname, '../../frontend/dist')))

        // API routes
        this.server.use('/api/players', playersRouter)
        this.server.use('/api/teams', teamsRouter)
        this.server.use('/api/images', imagesRouter)
        this.server.use('/api/game-room', gameRoomRouter)
        this.server.use('/api/game-sessions', gameSessionsRouter)
        this.server.use('/api/rfid', rfidRouter)
        this.server.use('/api/facility-session', facilitySessionRouter)
        this.server.get('/api/health', (req, res) => { res.json({status: 'ok'}) })

        // Frontend Route
        this.server.get('*', (req, res) => {
            const filePath = path.join(__dirname, '../../frontend/dist/index.html')
            res.sendFile(filePath)
        })

        // Start server
        this.server.listen(serverPort, serverHostname, () => {
            console.log('\n-------------------------\n')
            console.log(`Server running at http://${serverHostname}:${serverPort}/`)
            console.log(`Monitor running at http://${serverHostname}:${serverPort}/monitor`)
            console.log(`Booth running at http://${serverHostname}:${serverPort}/booth/1`)
            console.log(`Game-Room-Door-Screen running at http://${serverHostname}:${serverPort}/game-room-door-screen/1`)
        })
    }

    monitorCSAConnection() {
        let loggedError = false;
    
        const checkConnection = async () => {
            try {
                const response = await axios.get(process.env.CSA_API_HEALTH_URL);
                
                if (response.status === 200) {
                    this.retryPendingApiCalls(CSA_CALLS_PATH);
                    this.downloadDatabase(this.facility_id);
                    if (loggedError) {
                        console.log(`Reconnected! Retrying pending API calls...`);
                        loggedError = false;
                    }
                }
            } catch (error) {
                if (!loggedError) {
                    console.error('CSA Server is down or unreachable:', error.message);
                    loggedError = true;
                }
            }
        };
    
        checkConnection().then(() => {
            setInterval(checkConnection, 5000);
        });
    }    
  
    monitorGRAConnection() {
        const game_room_hostnames = dbHelpers.readDatabase(HOSTNAMES, [])
        const loggedErrors = {}

        const checkConnection = async () => {
            await Promise.all(game_room_hostnames.map(async (game_room_hostname) => {
                try {
                    const response = await axios.get(`http://${game_room_hostname}:3002/api/health`)
                    const { hostname } = response.data
        
                    if (!this.roomStatus[hostname]) {
                        this.roomStatus[hostname] = { online: null };
                    }
        
                    const wasOffline = this.roomStatus[hostname].online === false;
        
                    if (response.status === 200) {
                        if (wasOffline || this.roomStatus[hostname].online === null) {
                            this.retryPendingApiCalls(GRA_CALLS_PATH)
                            this.socket.updateClientData(hostname, true)
                            this.roomStatus[hostname].online = true;
                        }
                    }
                } catch (error) {
                    if (!loggedErrors[game_room_hostname]) {
                        console.error(`GRA Server ${game_room_hostname} is down or unreachable:`, error.message)
                        loggedErrors[game_room_hostname] = true;
                    }

                    if (!this.roomStatus[game_room_hostname]) {
                        this.roomStatus[game_room_hostname] = { online: null };
                    }
        
                    if (this.roomStatus[game_room_hostname]?.online !== false) {
                        this.socket.updateClientData(game_room_hostname, false)
                        this.roomStatus[game_room_hostname].online = false;
                    }
                }
            }))

            this.roomStatus = Object.fromEntries(
                Object.entries(this.roomStatus).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
            );
        
            dbHelpers.writeDatabase(ROOMS_PATH, this.roomStatus);
        }        
    
        checkConnection().then(() => {
            setInterval(checkConnection, 5000)
        })
    }    

    async downloadAndSaveData(url, filePath) {
        try {
            const response = await axios.get(url);
            if (response.status === 200) {
                fs.writeFileSync(filePath, JSON.stringify(response.data, null, 2), 'utf8');
                console.log(`Data successfully saved to ${filePath}`);
            }
        } catch (error) {
            console.error(`Error fetching data from ${url}:`, error.message);
        }
    }
    
    async downloadDatabase(facility_id) {
        await this.downloadAndSaveData(`${process.env.CSA_API_DOWNLOAD_URL}/${facility_id}`, PLAYERS_PATH);
    }
    
    async downloadGameConfig() {
        //await this.downloadAndSaveData('http://gra-1.local:3002/api/game-config/', ROOMS_PATH);
    }

    async retryPendingApiCalls(JSON_PATH) {
        const db = dbHelpers.readDatabase(JSON_PATH, {})

        if (!db['pending_api_calls']) return

        db['pending_api_calls'].forEach((apiCall) => {
            if (apiCall.status === 'pending' || apiCall.status === 'failed') {
               jobQueue.addJob({
                  id: Date.now(),
                  run: async () => {
                    console.log(`Processing API call: ${apiCall.call_id}`)
                     try {
                        await axios.post(apiCall.endpoint, apiCall.payload)
                        console.log(`Reprocessed API call for endpoint ${apiCall.endpoint}`)
                        await dbHelpers.updateApiCallStatus(JSON_PATH, apiCall.call_id, 'completed')
                     } catch (error) {
                        console.error(`Reprocessing failed for endpoint ${apiCall.endpoint}:`, error.message)
                        await dbHelpers.updateApiCallStatus(JSON_PATH, apiCall.call_id, 'failed')
                     }
                  }
               })
            }
        })
    }
}