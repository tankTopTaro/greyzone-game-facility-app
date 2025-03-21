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
import FacilityErrorHandler from './FacilityErrorHandler.js'

dotenv.config()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CSA_CALLS_PATH = path.join(__dirname, '../assets/csa/calls.json')
const GRA_CALLS_PATH = path.join(__dirname, '../assets/gra/calls.json')
const PLAYERS_PATH = path.join(__dirname, '../assets/csa/players.json')
const ROOMS_PATH = path.join(__dirname, '../assets/gra/rooms.json')
const HOSTNAMES = path.join(__dirname, '../assets/gra/hostnames.json')

let prevConnectionStatus = {}

export default class Facility {
    constructor(facility_id) {
        this.facility_id = facility_id
        this.socket = new Socket(8081)
        this.roomStatus = {}
        this.errorHandler = new FacilityErrorHandler(this.socket)
        this.init()
    }

    init() {
        this.startServer()
        this.monitorCSAConnection()
        this.monitorGRAConnection()
        this.fetchPlayerSessions()
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
        const checkConnection = async () => {
            try {
                const response = await axios.get(`${process.env.CSA_API_URL}/health`);
                
                if (response.status === 200) {
                    this.retryPendingApiCalls(CSA_CALLS_PATH);
                }
            } catch (error) {
                this.errorHandler.handleError(error, 'CSA Connection')
            }
        };
    
        setInterval(checkConnection, 5000);
    }    
  
    async monitorGRAConnection() {
      const game_room_hostnames = dbHelpers.readDatabase(HOSTNAMES, []);
      
      const checkConnection = async () => {
         await Promise.all(game_room_hostnames.map(async (hostname) => {
            try {
                  const response = await axios.get(`http://${hostname}:3002/api/health`);
                  if (response.status === 200) {
                     if (prevConnectionStatus[hostname] !== true) {
                        this.retryPendingApiCalls(GRA_CALLS_PATH);
                        this.socket.updateClientData(hostname, true);
                        this.roomStatus[hostname] = { online: true };
                        prevConnectionStatus[hostname] = true
                     }
                  }
            } catch (error) {
               if (prevConnectionStatus[hostname] !== false) {
                  this.errorHandler.handleError(error, `GRA Connection (${hostname})`);
                  this.socket.updateClientData(hostname, false);
                  this.roomStatus[hostname] = { online: false };
                  prevConnectionStatus[hostname] = false
               }
            }
         }));
         dbHelpers.writeDatabase(ROOMS_PATH, this.roomStatus);
         };
         setInterval(checkConnection, 5000);
   }

   async retryPendingApiCalls(JSON_PATH) {
      const db = dbHelpers.readDatabase(JSON_PATH, {});
      if (!db['pending_api_calls']) return;

      db['pending_api_calls'].forEach((apiCall) => {
          if (['pending', 'failed'].includes(apiCall.status)) {
              jobQueue.addJob({
                  id: Date.now(),
                  run: async () => {
                      try {
                          await axios.post(apiCall.endpoint, apiCall.payload);
                          await dbHelpers.updateApiCallStatus(JSON_PATH, apiCall.call_id, 'completed');
                      } catch (error) {
                          this.errorHandler.handleError(error, `Retry API (${apiCall.endpoint})`);
                          await dbHelpers.updateApiCallStatus(JSON_PATH, apiCall.call_id, 'failed');
                      }
                  },
              });
          }
      });
  }

  async fetchPlayerSessions() {
      try {
          const updatedSessions = await dbHelpers.getPlayerWithActiveSession();
          const recentSessions = await dbHelpers.getPlayerWithRecentSession();
          this.socket.broadcastMessage('monitor', {
              type: 'facility_session',
              active_players: updatedSessions,
              recent_players: recentSessions,
          });
      } catch (error) {
          this.errorHandler.handleError(error, 'Fetch Player Sessions');
      }
  }
}