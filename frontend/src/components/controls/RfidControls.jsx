/* eslint-disable no-unused-vars */
import { Button, Container, Toast } from "react-bootstrap"
import Lists from "../Lists"
import { useEffect, useState } from "react"
import axios from 'axios'

const RfidControls = ({ clients, activePlayers, recentPlayers, scannedPlayers}) => {
    const [player, setPlayer] = useState({})
    const [toast, setToast] = useState({
      show: false,
      message: '',
      color: '',
   })

    const handleScan = async(type, id, player) => {
        if (!player || !player.id) {
            console.log('Please select a player to scan')
            setToast({
               show: true,
               message: 'Please select a player to scan.',
               color: 'danger',
            })
            return
        }

        const playerScannedLocations = scannedPlayers[player.id] || []

        if (
               (type === 'booth' && playerScannedLocations.some(loc => loc.startsWith('booth'))) ||
               (type === 'game-room' && playerScannedLocations.some(loc => loc.startsWith('game-room')))
         ) {
               console.log(`Player ${player.id} is already scanned at a ${type}`)
               setToast({
                  show: true,
                  message: `Player ${player.id} is already scanned at a ${type}.`,
                  color: 'warning',
               })
               return // Stop scanning
         }

        const url = type === 'booth' 
            ? `/api/rfid/booth/${id}` 
            : `/api/rfid/game-room/${id}`

        try {
            const response = await axios.post(url, { 
               rfid_tag: 'PLACEHOLDER-RFID', // replace with actual rfid
               player: player.id 
            })

            if (response.status === 200 && response.data) {
                console.log(response.data)
                setToast({
                  show: true,
                  message: `Scan successful at ${type} for player ${player.id}!`,
                  color: 'success',
               })
            }
        } catch (error) {
            console.log('Error scanning RFID', error.message)
            setToast({
               show: true,
               message: 'Error scanning RFID.',
               color: 'danger',
            })
        }
    }

    const groupClients = () => {
      const grouped = {};
   
      // Group booths
      clients?.['booths']?.forEach((booth, index) => {
         const match = booth.match(/(\d+)$/); // Extract number from the name
         if (match) {
            const id = match[0]; // Extracted number
            if (!grouped[id]) grouped[id] = {};
            grouped[id].booth = { name: booth, index };
         }
      });
   
      // Group game-room-door-screens
      clients?.['game-room-door-screens']?.forEach((game_room, index) => {
         const match = game_room.match(/(\d+)$/);
         if (match) {
            const id = match[0];
            if (!grouped[id]) grouped[id] = {};
            grouped[id].gameRoom = { name: game_room, index };
         }
      });
   
      return grouped;
   };
   
   const groupedClients = groupClients();   
    
    return (
      <Container className="p-3 player-form-container d-flex flex-column">
         <h4 className="mb-4">{`Simulate RFID Scan`}</h4>

         {/* Lists Section (2 Columns) */}
         <div className="d-flex flex-column flex-md-row w-100">
            <div className="d-flex flex-column w-100 w-md-50 p-2">
               <h4>Active Players</h4>
               <Lists
                  activePlayers={activePlayers}
                  player={player}
                  setPlayer={setPlayer}
               />
            </div>
            <div className="d-flex flex-column w-100 w-md-50 p-2">
               <h4>Recent Players</h4>
               <Lists
                  recentPlayers={recentPlayers}
                  player={player}
               />
            </div>
         </div>

         {/* Buttons Section */}
         <div className="d-flex flex-wrap justify-content-center w-100 mt-4">
            {Object.entries(groupedClients).map(([id, { booth, gameRoom }]) => (
               <div key={id} className="p-2 d-flex flex-column">
                  {booth && (
                     <Button
                        className="mb-2"
                        style={{ minWidth: '200px', maxWidth: '300px' }}
                        onClick={() => handleScan('booth', booth.index + 1, player)}
                        disabled={!player?.id} // Disable if no player is selected
                     >
                        Scan at {booth.name}
                     </Button>
                  )}
                  {gameRoom && (
                     <Button
                        className="mb-2"
                        style={{ minWidth: '200px', maxWidth: '300px' }}
                        onClick={() => handleScan('game-room', gameRoom.index + 1, player)}
                        disabled={!player?.id} // Disable if no player is selected
                     >
                        Scan at {gameRoom.name}
                     </Button>
                  )}
               </div>
            ))}
         </div>

         <Toast
            onClose={() => setToast({ ...toast, show: false })}
            show={toast.show}
            delay={3000}
            autohide
            bg={toast.color}
            className="position-fixed bottom-0 end-0 m-3"
         >
               <Toast.Body>{toast.message}</Toast.Body>
         </Toast>
      </Container>
    )
}

export default RfidControls