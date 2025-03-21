import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { WebSocketServer } from 'ws'
import dbHelpers from '../utils/dbHelpers.js'
import FacilityErrorHandler from './FacilityErrorHandler.js'

dotenv.config()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CLIENTS_PATH = path.join(__dirname, '../assets/ws/clients.json')
const MESSAGES_PATH = path.join(__dirname, '../assets/ws/messages.json')

const roomTimeouts = {}

export default class Socket {

    constructor(port = 8081) {
        this.port = port
        this.socket = null
        this.clientsByName = {} // Store clients grouped by name
        this.clients = null // Memory cache for client data
        this.errorHandler = new FacilityErrorHandler(this)
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
                        this.testErrorHandling()

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
                    this.errorHandler.handleError(error, 'WebSocket connection')
                }
            })
        })

        console.log('WebSocket Server running on port ' + this.port)
    }

    testErrorHandling() {
      try {
          // Deliberately throw an error to test the error handler
          throw new Error('Test error from testErrorHandling method');
      } catch (error) {
          // Handle the error using the errorHandler
          this.errorHandler.handleError(error, 'testErrorHandling');
      }
  }

    broadcastMessage(clientname, message) {
        try {
            if (this.clientsByName[clientname]) {
               this.clientsByName[clientname].forEach(client => {
                  if (client.readyState === 1) {
                     client.send(JSON.stringify(message))
                  }
               })
            } else {
                  console.log(`No clients connected under name: ${clientname}`)
            }
        } catch (error) {
            this.errorHandler.handleError(error, 'broadcastMessage')
        }
    }

    async waitForMessage(clientName) {
      return new Promise((resolve, reject) => {
          try {
              if (!this.clientsByName[clientName] || this.clientsByName[clientName].size === 0) {
                  const error = new Error(`No clients found under name: ${clientName}`);
                  this.errorHandler.handleError(error, 'waitForMessage');
                  return reject(error);  // Reject after passing the error to the handler
              }

              // Listen for the first message from any client in the group
              this.clientsByName[clientName].forEach((client) => {
                  const messageHandler = (raw) => {
                      try {
                        const message = JSON.parse(raw);
                        client.off('message', messageHandler); // Remove listener after first message
                        resolve(message);
                      } catch (error) {
                        this.errorHandler.handleError(error, 'waitForMessage');
                        reject(error);
                      }
                  };

                  client.on('message', messageHandler);
              });
          } catch (error) {
              this.errorHandler.handleError(error, 'waitForMessage');
              reject(error);
          }
      });
  }
  

  handleClientMessage(message) {
      try {
         const data = JSON.parse(message.toString());
         if (data.type === 'confirm' && data.from) {
            if (data.from.includes('game-room')) dbHelpers.clearScans(data.from);

            this.broadcastMessage('monitor', { type: 'confirmed' });
         }
      } catch (error) {
         this.errorHandler.handleError(error, 'handleClientMessage');
      }
   }

   handleClientDisconnect(clientname, client) {
      try {
         console.log(`Client from ${clientname} disconnected.`);

         if (this.clientsByName[clientname]) {
            this.clientsByName[clientname].delete(client);

            if (this.clientsByName[clientname].size === 0) {
                  delete this.clientsByName[clientname]; // Fully remove hostname entry
                  console.log(`All clients from ${clientname} are disconnected.`);
            }
         }

         this.updateClientData(clientname, false); // Ensure updateClientData runs
      } catch (error) {
         this.errorHandler.handleError(error, 'handleClientDisconnect');
      }
   }

   updateClientData(hostname, isConnected) {
      try {
         if (!hostname) return;

         // Load memory cache if it's not already loaded
         if (!this.clients) {
            this.clients = dbHelpers.readDatabase(CLIENTS_PATH, {
                  "game-rooms": [],
                  "booths": [],
                  "game-room-door-screens": [],
            }) || { "game-rooms": [], "booths": [], "game-room-door-screens": [] };
         }

         // Ensure arrays are properly initialized before use
         this.clients["game-rooms"] = this.clients["game-rooms"] || [];
         this.clients["booths"] = this.clients["booths"] || [];
         this.clients["game-room-door-screens"] = this.clients["game-room-door-screens"] || [];

         const gameRoomId = hostname.replace(/\D/g, ''); // Extracts number
         if (!gameRoomId) return;

         const gameRoom = `gra-${gameRoomId}.local`;
         const booth = `booth-${gameRoomId}`;
         const gameRoomDoorScreen = `game-room-${gameRoomId}`;

         if (isConnected) {
            // Add game room if it's not already there
            if (!this.clients["game-rooms"].includes(gameRoom)) {
                  this.clients["game-rooms"].push(gameRoom);
            }

            // Ensure booths and door screens are in the list (they belong to the Facility)
            if (!this.clients["booths"].includes(booth)) {
                  this.clients["booths"].push(booth);
            }
            if (!this.clients["game-room-door-screens"].includes(gameRoomDoorScreen)) {
                  this.clients["game-room-door-screens"].push(gameRoomDoorScreen);
            }
         }

         // Sort for consistency
         this.clients["game-rooms"].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
         this.clients["booths"].sort();
         this.clients["game-room-door-screens"].sort();

         // Save updated data
         dbHelpers.writeDatabase(CLIENTS_PATH, this.clients);

         // Broadcast clients data
         this.broadcastMessage('monitor', {
            type: 'clientData',
            clients: this.clients,
         });
      } catch (error) {
         this.errorHandler.handleError(error, 'updateClientData');
      }
   }

   sendStoredMessages(client, clientname) {
      try {
         if (!clientname) {
            console.error("sendStoredMessages: clientname is undefined");
            return;
         }

         let storedMessages = dbHelpers.readDatabase(MESSAGES_PATH, []);

         if (storedMessages.length === 0) {
            console.log(`No stored messages found for ${clientname}`);
            return;
         }

         let clientType;
         let clientIdNumber;

         if (clientname === "monitor") {
            clientType = "monitor";
            clientIdNumber = null; // Monitor gets all messages
         } else {
            const parts = clientname.split('-');
            clientType = parts.length === 2 ? parts[0] : `${parts[0]}-${parts[1]}`;
            clientIdNumber = Number(parts.length === 2 ? parts[1] : parts[2]); // Ensure it's a number
         }

         // Filter relevant messages
         const relevantMessages = storedMessages.filter((msg) => {
            if (!msg.location || !msg.id) return false;

            if (clientType === 'booth') {
                  return msg.location === 'booth' && Number(msg.id) === clientIdNumber;
            }

            if (clientType === 'game-room') {
                  return msg.location === 'game-room' && Number(msg.id) === clientIdNumber;
            }

            if (clientType === 'monitor') {
                  return true; // Monitor gets everything
            }

            return false;
         });

         if (relevantMessages.length > 0) {
            console.log(`Sending ${relevantMessages.length} messages to ${clientname}`);
            relevantMessages.forEach((msg) => client.send(JSON.stringify(msg)));

            // **Remove sent messages from the database**
            storedMessages = storedMessages.filter((msg) => !relevantMessages.includes(msg));
            dbHelpers.writeDatabase(MESSAGES_PATH, storedMessages); // Save updated messages
         } else {
            console.log(`No relevant messages found for ${clientname}`);
         }
      } catch (error) {
         this.errorHandler.handleError(error, 'sendStoredMessages');
      }
   }
}

