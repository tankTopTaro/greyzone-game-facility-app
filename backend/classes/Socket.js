import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { WebSocketServer } from 'ws'
import dbHelpers from '../utils/dbHelpers.js'
import checkRfidValidity from '../utils/checkRfidValidity.js'

dotenv.config()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SCANS_PATH = path.join(__dirname, '../assets/ws/scans.json')
const CLIENTS_PATH = path.join(__dirname, '../assets/ws/clients.json')
const MESSAGES_PATH = path.join(__dirname, '../assets/ws/messages.json')

const roomTimeouts = {}

export default class Socket {

    constructor(port = 8081) {
        this.port = port
        this.socket = null
        this.clientsByName = {} // Store clients grouped by name
        this.clients = null // Memory cache for client data
        this.init()
    }

    init() {
        const host = process.env.HOST || '0.0.0.0'
        this.socket = new WebSocketServer({ port: this.port, host: host })

        this.socket.on('connection', (client, request) => {
            client.clientIp = request.connection.remoteAddress
            client.userAgent = request.headers['user-agent']

            // Expect the first message to contain the hostname
            client.once('message', (message) => {
                try {
                    const data = JSON.parse(message.toString())
                    if (data.clientname) {
                        const clientName = data.clientname

                        // Initialize storage for this hostname if not exists
                        if (!this.clientsByName[clientName]) {
                            this.clientsByName[clientName] = new Set()
                        }

                        // Add client to the hostname group
                        this.clientsByName[clientName].add(client)

                        this.updateClientData(clientName, false)

                        console.log(`Client registered under name: ${clientName}`)

                        this.broadcastMessage('monitor', {
                            type: 'clientData',
                            clients: this.clients
                        })

                        this.sendStoredMessages(client, clientName)

                        // Handle messages from this client
                        client.on('message', (message) => {
                            this.handleClientMessage(message)
                        })

                        // Handle disconnection
                        client.on('close', () => {
                            this.handleClientDisconnect(clientName, client)
                        })
                    }
                } catch (error) {
                    console.error("Invalid message format:", error)
                }
            })
        })

        console.log('WebSocket Server running on port ' + this.port)
    }

    broadcastMessage(clientname, message) {
        if (this.clientsByName[clientname]) {
            this.clientsByName[clientname].forEach(client => {
                if (client.readyState === 1) {
                    client.send(JSON.stringify(message))
                }
            })
        } else {
            console.log(`No clients connected under name: ${clientname}`)
        }
    }

   handleClientMessage(message) {
        try {
            const data = JSON.parse(message.toString())
            
            if (data.type === 'confirm' && data.from) {
                dbHelpers.clearMessages(data.message_type, data.from)
                this.broadcastMessage('monitor', {type: 'confirmed'})
            }
        } catch (error) {
            console.error('Invalid message format', error)
        }
    }

    handleClientDisconnect(clientname, client) {
        console.log(`Client from ${clientname} disconnected.`)
    
        if (this.clientsByName[clientname]) {
            this.clientsByName[clientname].delete(client)
            
            if (this.clientsByName[clientname].size === 0) {
                delete this.clientsByName[clientname] // Fully remove hostname entry
                console.log(`All clients from ${clientname} are disconnected.`)
            }
        }
    
        this.updateClientData(clientname, false) // Ensure updateClientData runs
    }

    updateClientData(hostname, isConnected) {
        if (!hostname) return

        // Load memory cache if it's not already loaded
        if (!this.clients) {
            this.clients = dbHelpers.readDatabase(CLIENTS_PATH, {
                "game-rooms": [],
                "booths": [],
                "game-room-door-screens": []
            }) || { "game-rooms": [], "booths": [], "game-room-door-screens": [] }
        }

        // Ensure arrays are properly initialized before use
        this.clients["game-rooms"] = this.clients["game-rooms"] || []
        this.clients["booths"] = this.clients["booths"] || []
        this.clients["game-room-door-screens"] = this.clients["game-room-door-screens"] || []

        const gameRoomId = hostname.replace(/\D/g, '') // Extracts number
        if (!gameRoomId) return

        const gameRoom = `gra-${gameRoomId}.local`
        const booth = `booth-${gameRoomId}`
        const gameRoomDoorScreen = `game-room-${gameRoomId}`

        if (isConnected) {
            // Add game room if it's not already there
            if (!this.clients["game-rooms"].includes(gameRoom)) {
                this.clients["game-rooms"].push(gameRoom)
            }
        
            // Ensure booths and door screens are in the list (they belong to the Facility)
            if (!this.clients["booths"].includes(booth)) {
                this.clients["booths"].push(booth)
            }
            if (!this.clients["game-room-door-screens"].includes(gameRoomDoorScreen)) {
                this.clients["game-room-door-screens"].push(gameRoomDoorScreen)
            }
        }
        
        // Sort for consistency
        this.clients["game-rooms"].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        this.clients["booths"].sort()
        this.clients["game-room-door-screens"].sort()

        // Save updated data
        dbHelpers.writeDatabase(CLIENTS_PATH, this.clients)

        // Broadcast clients data
        this.broadcastMessage('monitor', {
            type: 'clientData',
            clients: this.clients
        })
    }

    sendStoredMessages(client, clientname) {
      if (!clientname) {
          console.error("sendStoredMessages: clientname is undefined")
          return
      }
  
      let storedMessages = dbHelpers.readDatabase(MESSAGES_PATH, [])
  
      if (storedMessages.length === 0) {
          console.log(`No stored messages found for ${clientname}`)
          return
      }
  
      let clientType
      let clientIdNumber
  
      if (clientname === "monitor") {
          clientType = "monitor"
          clientIdNumber = null // Monitor gets all messages
      } else {
          const parts = clientname.split('-')
          clientType = parts.length === 2 ? parts[0] : `${parts[0]}-${parts[1]}`
          clientIdNumber = Number(parts.length === 2 ? parts[1] : parts[2]) // Ensure it's a number
      }
  
      // Filter relevant messages
      const relevantMessages = storedMessages.filter(msg => {
          if (!msg.location || !msg.id) return false
          
          if (clientType === 'booth') {
              return msg.location === 'booth' && Number(msg.id) === clientIdNumber
          }
  
          if (clientType === 'game-room') {
              return msg.location === 'game-room' && Number(msg.id) === clientIdNumber
          }
  
          if (clientType === 'monitor') {
              return true // Monitor gets everything
          }
  
          return false
      })
  
      if (relevantMessages.length > 0) {
          console.log(`Sending ${relevantMessages.length} messages to ${clientname}`)
          relevantMessages.forEach((msg) => client.send(JSON.stringify(msg)))
  
          // **Remove sent messages from the database**
          storedMessages = storedMessages.filter(msg => !relevantMessages.includes(msg))
          dbHelpers.writeDatabase(MESSAGES_PATH, storedMessages) // Save updated messages
      } else {
          console.log(`No relevant messages found for ${clientname}`)
      }
  }

   async handleRfidScan(data) {
      const { rfid_tag, player, location, id } = data;

      if (!rfid_tag || !player || !location || !id) {
         console.log('Missing required data: RFID tag, player, location, or id');
         return;
      }

      try {
         // Step 1: Validate RFID
         const isValid = await checkRfidValidity(rfid_tag, player);
         if (!isValid) {
            console.log(`RFID not allowed at this ${location} with id ${player}`);
            return;
         }

         // 🔥 Use a room-based key instead of separate booth/game-room keys
         const roomKey = `gra-${id}`;

         const scannedPlayers = dbHelpers.readDatabase(SCANS_PATH, {});

         // Ensure the room data exists
         if (!scannedPlayers[roomKey]) {
            scannedPlayers[roomKey] = {
               'scans-from-booth': [],
               'scans-from-game-room': [],
               'status': 'waiting',
            };
         }

         // Add player to the appropriate scan list
         if (location === 'booth') {
            if (!scannedPlayers[roomKey]['scans-from-booth'].includes(player)) {
               scannedPlayers[roomKey]['scans-from-booth'].push(player);
            }
         } else if (location === 'game-room') {
            if (!scannedPlayers[roomKey]['scans-from-game-room'].includes(player)) {
               scannedPlayers[roomKey]['scans-from-game-room'].push(player);
            }
         }

         // Update status if necessary
         if (
            scannedPlayers[roomKey]['scans-from-booth'].length > 0 &&
            scannedPlayers[roomKey]['scans-from-booth'].every(p => 
               scannedPlayers[roomKey]['scans-from-game-room'].includes(p))
         ) {
            scannedPlayers[roomKey].status = 'ready';
            console.log(`All players arrived at ${roomKey}, status: ready`);
         }

         // Step 3: Persist the updated data
         dbHelpers.writeDatabase(SCANS_PATH, scannedPlayers);

         // Step 4: Broadcast message to clients (real-time)
         const message = {
            type: 'rfid_scanned',
            location,
            id,
            player,
            status: scannedPlayers[roomKey].status,
         };
         const locationKey = `${location}-${id}`
         this.broadcastMessage(locationKey, message);
         this.broadcastMessage('monitor', message); // Broadcast to the monitor or other clients

         // Optional: Log the scan
         dbHelpers.appendMessages(message);
         console.log(`Scan processed successfully for ${player} at ${roomKey}`);

      } catch (error) {
         console.error('Error processing RFID scan:', error);
      }
   }
}

