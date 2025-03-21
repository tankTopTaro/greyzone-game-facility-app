import dbHelpers from "../utils/dbHelpers.js";
import path from 'path'
import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SCANS_PATH = path.join(__dirname, '../assets/ws/scans.json')

let facilityInstance = null

const rfidController = {
    setFacilityInstance: (instance) => {
      facilityInstance = instance
    },

    gameRoom: (req, res) => {
      const { gra_id } = req.params;
      const { rfid_tag, player } = req.body;

      if (!rfid_tag) {
         return res.status(400).send('Missing RFID tag')
      }

      facilityInstance.socket.broadcastMessage(`game-room-${gra_id}`, {
         type: 'rfid_scanned',
         location: 'game-room',
         id: gra_id,
         player
      })

      facilityInstance.socket.broadcastMessage(`monitor`, {
         type: 'rfid_scanned',
         location: 'game-room',
         id: gra_id,
         player
      })

      processRfidScan('game-room', gra_id, player)

      return res.send('ok')
   },
    
    booth: async (req, res) => {
      const { booth_id } = req.params;
      const { rfid_tag, player } = req.body;

      if (!rfid_tag) {
         return res.status(400).send('Missing RFID tag')
      }

      facilityInstance.socket.broadcastMessage(`booth-${booth_id}`, {
         type: 'rfid_scanned',
         location: 'booth',
         id: booth_id,
         player
      })

      facilityInstance.socket.broadcastMessage(`monitor`, {
         type: 'rfid_scanned',
         location: 'booth',
         id: booth_id,
         player
      })

      processRfidScan('booth', booth_id, player)
      return res.send('ok')
    }
}

const processRfidScan = (location, id, player) => {
   const roomKey = `gra-${id}`;

   try {
     // --- Persist to local DB/file
     const allScans = dbHelpers.readDatabase(SCANS_PATH, {});

     // Initialize room if not exists
     if (!allScans[roomKey]) {
         allScans[roomKey] = { booth: [], 'game-room': [], status: 'waiting' };
     }

     // Get booth players before proceeding
     const boothPlayers = allScans[roomKey].booth || [];

     // Prevent scanning from game-room if booth is empty
     if (location === 'game-room' && boothPlayers.length === 0) {
         console.warn(`Scan denied: Booth is empty for ID: ${id}`);
         return { status: 'error', message: 'Cannot scan from game-room. Booth is empty.' };
     }

     // Initialize location if not exists
     if (!allScans[roomKey][location]) {
         allScans[roomKey][location] = [];
     }

     // Add player to the respective location if not already present
     if (!allScans[roomKey][location].includes(player)) {
         allScans[roomKey][location].push(player);
     }

     // Update the room
     dbHelpers.writeDatabase(SCANS_PATH, allScans);

     console.log(`Stored RFID scan: [${location}] ID: ${id} - Player: ${player}`);

     const receivedMessage = facilityInstance.socket.waitForMessage(`booth-${id}`)

     receivedMessage.then((message) => {
      if (message.type === 'confirm'){
         // --- Validation logic after storing scan
         const gameRoomPlayers = allScans[roomKey]['game-room'] || [];

         // Sort to make comparison order-independent
         const boothSorted = [...boothPlayers].sort();
         const gameRoomSorted = [...gameRoomPlayers].sort();

         // Return the appropriate response
         if (JSON.stringify(boothSorted) === JSON.stringify(gameRoomSorted)) {
               allScans[roomKey].status = 'ready'; // Update status to 'ready' when players match
               dbHelpers.writeDatabase(SCANS_PATH, allScans);

               facilityInstance.socket.broadcastMessage(`${location}-${id}`, {
                  type: 'status_update',
                  player: gameRoomPlayers,
                  locationKey: roomKey,
                  status: allScans[roomKey].status
               });

               return { status: 'ok', message: 'Players match.' };
         } else if (boothPlayers.length > gameRoomPlayers.length) {
               allScans[roomKey].status = 'waiting'; // Set status to 'waiting' when there are more players in the booth
               dbHelpers.writeDatabase(SCANS_PATH, allScans);
               return { status: 'waiting', message: 'Waiting for more players in the game room.' };
         } else if (gameRoomPlayers.length > boothPlayers.length) {
               allScans[roomKey].status = 'error'; // Set status to 'error' when there are more players in the game room
               dbHelpers.writeDatabase(SCANS_PATH, allScans);
               return { status: 'error', message: 'Mismatch: More players in the game room than in booth.' };
         } else {
               allScans[roomKey].status = 'error'; // Handle any other mismatches
               dbHelpers.writeDatabase(SCANS_PATH, allScans);
               return { status: 'error', message: 'Player lists do not match.' };
         }
      }
     })
   } catch (error) {
     console.error('Error processing RFID scan:', error);
     return { status: 'error', message: 'An error occurred while processing the scan.' };
   }
}


export default rfidController
