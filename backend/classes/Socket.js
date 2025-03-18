import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { WebSocketServer } from 'ws'
import dbHelpers from '../utils/dbHelpers.js'

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
        const host = process.env.HOSTNAME || 'localhost'
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
            
            if (data.type === 'rfid_scanned' && data.location && data.id) {
                const locationKey = `${data.location}-${data.id}`
                const scannedPlayers = dbHelpers.readDatabase(SCANS_PATH, {})
                const gameRoom = `game-room-${data.id}`

                if (data.location === 'booth') {
                    console.log(`Scans coming from ${locationKey}...`)

                    if (!scannedPlayers[gameRoom]) {
                        scannedPlayers[gameRoom] ={
                            'scans-from-booth': [],
                            'scans-from-game-room': [],
                            'status': 'waiting'
                        }
                    }

                    if (data.player) {
                        scannedPlayers[gameRoom]['scans-from-booth'].push(data.player)
                    }

                    dbHelpers.writeDatabase(SCANS_PATH, scannedPlayers)
                    dbHelpers.appendMessages(data)

                    this.broadcastMessage(locationKey, data)
                    this.broadcastMessage('monitor', data)
                } else if (data.location === 'game-room') {
                    const locationKey = `${data.location}-${data.id}`

                    if (!scannedPlayers[locationKey]) {
                        scannedPlayers[locationKey] ={
                            'scans-from-booth': [],
                            'scans-from-game-room': [],
                            'status': 'waiting'
                        }
                    }

                    if (data.player) {
                        const scansFromBooth = scannedPlayers[locationKey]['scans-from-booth']
                        const scansFromGameRoom = scannedPlayers[locationKey]['scans-from-game-room']
                    
                        // Add player to the game-room scan list if not already present
                        if (!scansFromGameRoom.includes(data.player)) {
                            scansFromGameRoom.push(data.player)

                            if (roomTimeouts[locationKey]) {
                                clearTimeout(roomTimeouts[locationKey])
                            }
                        }

                        // Check if all booth-scanned players have arrived
                        const allPlayersArrived = scansFromBooth.every(player => scansFromGameRoom.includes(player))

                        if (allPlayersArrived) {
                            console.log(`All players have arrived in ${locationKey}`)
                            scannedPlayers[locationKey].status = 'ready'

                            if (roomTimeouts[locationKey]) {
                                clearTimeout(roomTimeouts[locationKey])
                                delete roomTimeouts[locationKey]
                            }

                            this.broadcastMessage(locationKey, {
                                type: 'status_update',
                                status: 'ready',
                                playerIds: scansFromBooth,
                                locationKey: locationKey
                            })
                        } else {
                            console.log(`Waiting for remaining players in ${locationKey}...`)

                            roomTimeouts[locationKey] = setTimeout(() => {
                                const updatedScans = dbHelpers.readDatabase(SCANS_PATH, {})
                                const updatedScansFromGameRoom = updatedScans[locationKey]?.['scans-from-game-room'] || []
                
                                const stillMissingPlayers = scansFromBooth.filter(player => !updatedScansFromGameRoom.includes(player))
                
                                if (stillMissingPlayers.length > 0) {
                                    console.log(`Time's up! Missing players: ${stillMissingPlayers.join(', ')}.`)
                                    console.log(`Revoking room access. Players must return to the booth.`)
                                    delete scannedPlayers[locationKey] // Reset the game-room entry
                                }
                                
                                dbHelpers.writeDatabase(SCANS_PATH, scannedPlayers)
                            }, 60000)
                        }
                    }

                    dbHelpers.writeDatabase(SCANS_PATH, scannedPlayers)
                    dbHelpers.appendMessages(data)
                    this.broadcastMessage(locationKey, data)
                    this.broadcastMessage('monitor', data)
                }
            } else if (data.type === 'confirm' && data.from) {
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
    
        const storedMessages = dbHelpers.readDatabase(MESSAGES_PATH, [])

        let clientType
        let clientIdNumber
    
        if (storedMessages.length > 0) {
            // Special handling for monitor client
            if (clientname === "monitor") {
                  clientType = "monitor"
                  clientIdNumber = null // Monitor doesn't have an ID
            } else {
                  // For other clients (booth or game-room), split the client name
                  const parts = clientname.split('-')
                  clientType = parts.length === 2 ? parts[0] : `${parts[0]}-${parts[1]}`
                  const clientId = parts.length === 2 ? parts[1] : parts[2] // The last part is always the ID
                  clientIdNumber = Number(clientId) // Ensure it's a number
            }
            // Ensure messages are sent to the correct client type and ID
            const relevantMessages = storedMessages.filter(msg => {
                if (!msg.location || !msg.id) return false // Ensure valid messages
                
                // Match Booth messages
                if (clientType === 'booth') {
                    return msg.location === 'booth' && Number(msg.id) === clientIdNumber
                }
                
                // Match Game Room messages
                if (clientType === 'game-room') {
                  return msg.location === 'game-room' && Number(msg.id) === clientIdNumber
                }
    
                // Send all messages to the monitor
                if (clientType === 'monitor') {
                    return true
                }
    
                return false
            })
    
            if (relevantMessages.length > 0) {
                console.log(`Sending ${relevantMessages.length} messages to ${clientname}`)
                relevantMessages.forEach((msg) => client.send(JSON.stringify(msg)))
            } else {
                console.log(`No relevant messages found for ${clientname}`)
            }
        } else {
            console.log(`No stored messages found for ${clientname}`)
        }
    }
}

