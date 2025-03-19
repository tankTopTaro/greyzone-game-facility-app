/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
import { Button, Container } from "react-bootstrap"
import Lists from "../Lists"
import { useState } from "react"
import axios from 'axios'

const RfidControls = ({ wsService, clients, playersWithSession, scannedPlayers}) => {
    const [player, setPlayer] = useState({})

    const handleScan = async(type, id, player) => {
        if (!player || !player.id) {
            console.log('Please select a player to scan')
            return
        }

        const generatedRfid = `RFID-${player.id}`
        const playerScannedLocations = scannedPlayers[player.id] || []

        if (
               (type === 'booth' && playerScannedLocations.some(loc => loc.startsWith('booth'))) ||
               (type === 'game-room' && playerScannedLocations.some(loc => loc.startsWith('game-room')))
         ) {
               console.log(`Player ${player.id} is already scanned at a ${type}`)
               return // Stop scanning
         }

        const url = type === 'booth' 
            ? `/api/rfid/booth/${id}` 
            : `/api/rfid/game-room/${id}`

        try {
            const response = await axios.post(url, { rfid_tag: generatedRfid, player: player.id })
            if (response.status === 200 && response.data) {
                console.log(response.data)

                wsService.send({
                    type: 'rfid_scanned',
                    location: type, // Send 'booth' or 'game-room'
                    id: id,
                    player: player.id
                })
            }
        } catch (error) {
            console.log('Error scanning RFID', error.message)
        }
    }

    return (
      <Container className="p-3 player-form-container d-flex flex-column">
         <h4 className="mb-4">{`Simulate RFID Scan`}</h4>
         <div className="d-flex w-100 flex-column flex-md-row">
            {/* List Column */}
            <div className="d-flex w-100 mb-3 mb-md-0">
               <Lists
                  playersWithSession={playersWithSession}
                  player={player}
                  setPlayer={setPlayer}
                  scannedPlayers={scannedPlayers}
               />
            </div>
         
            {/* Booth and Game Room Columns */}
            <div className="d-flex w-100 flex-md-row flex-wrap">
               {/* Booth Column */}
               <div className="p-2 d-flex justify-content-center flex-grow-1 mb-3 mb-md-0">
                  <div className="d-flex flex-column w-100">
                     {clients?.['booths']?.length > 0 &&
                        clients?.['booths'].map((booth, index) => (
                           <Button
                              key={booth}
                              className="mb-2 me-2"
                              style={{ width: '100%' }} // Adjust width and max width
                              onClick={() => handleScan('booth', index + 1, player)}
                           >
                              Scan at {booth}
                           </Button>
                        ))}
                  </div>
               </div>

               {/* Game Room Column */}
               <div className="p-2 d-flex justify-content-center flex-grow-1 mb-3 mb-md-0">
                  <div className="d-flex flex-column w-100">
                     {clients?.['game-room-door-screens']?.length > 0 &&
                        clients?.['game-room-door-screens'].map((game_room, index) => (
                           <Button
                              key={game_room}
                              className="mb-2 me-2"
                              style={{ width: '100%' }} // Adjust width and max width
                              onClick={() => handleScan('game-room', index + 1, player)}
                           >
                              Scan at {game_room}
                           </Button>
                        ))}
                  </div>
               </div>
            </div>

            
         </div>
      </Container>    
    )
}

export default RfidControls