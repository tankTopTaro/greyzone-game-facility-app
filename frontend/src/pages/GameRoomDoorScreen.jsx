/* eslint-disable no-unused-vars */
import { useEffect, useRef, useState } from "react"
import { useParams } from "react-router-dom"
import WebSocketService from "../utils/WebSocketService.js"
import PlayerCard from "../components/PlayerCard.jsx"
import { Button, Container, Row } from "react-bootstrap"
import axios from "axios"

const WS_URL = 'ws://localhost:8081'

/** TODO: fetch images from CSA, cache them, and then serve them */

const GameRoomDoorScreen = () => {
  const { gra_id } = useParams()
  const wsService = useRef(null)
  const CLIENT = `game-room-${gra_id}`

  const [scannedPlayers, setScannedPlayers] = useState([])
  const [gameReady, setGameReady] = useState(false)

  useEffect(() => {
    document.title = `GFA | Game Room ${gra_id}`
  }, [gra_id])

  // WebSocket
  useEffect(() => {
    if (!wsService.current) {
       wsService.current = new WebSocketService(WS_URL, CLIENT)
       wsService.current.connect()
    }

    const handleWebSocketMessage = async (data) => {
       console.log('Received WebSocket message:', data)

       if (data.type === 'rfid_scanned'){
        if (data.location === 'game-room' && Number(data.id) === Number(gra_id)) {
         const playerId = data.player

         try {
            const response = await axios.get(`http://localhost:3001/api/players/${playerId}`)

            if (response.status === 200) {
               const playerData = response.data

               setScannedPlayers((prevPlayers) => {
                  const isAlreadyScanned = prevPlayers.some(p => p.id === playerData.id)
                  return isAlreadyScanned ? prevPlayers : [...prevPlayers, playerData]
               })
            } else {
               console.error('Failed to fetch player data:', response.status)
            }
         } catch (error) {
            console.error('Failed to fetch player data:', error)
         }
        }
       } else if (data.type === 'status_update' && data.status === 'ready') {
          setGameReady(true)

          try {
            const payload = {
              players: data.playerIds,
              locationKey: data.locationKey
            }

            const gameRoomId = `gra-${gra_id}`

            const response = await axios.post(`/api/game-sessions/${gameRoomId}/submit-game-session`, payload)

            if (response.status === 200) {
              console.log('Game Session will start')

              /* setTimeout(() => {
                wsService.current.send({
                  type: 'confirm', 
                  message_type: 'rfid_scanned',
                  from: CLIENT,
                })
                setGameReady(false)
                setScannedPlayers([])
              }, 5000) */
            }
          } catch (error) {
            console.error('Error submitting game session')
          }
       } 
    }

    wsService.current.addListener(handleWebSocketMessage)

    wsService.current.send({ type: 'subscribe', gra_id })

    return () => {
       if (wsService.current) {
          wsService.current.removeListener(handleWebSocketMessage)
          wsService.current.close()
          wsService.current = null
       }
    }
  }, [gra_id, CLIENT])

  /** TODO: 
   *    - player names will appear on the screen
   *    - when all players arrive door screen should add "please come in!"
   *    - at the exact moment, the GFA backend should send the prepared game session to GRA
   *    - payload will include the book_room_until, (this might be the date_end from the facility session)
   * 
   */

  return (
      <Container className="d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '100vh', padding: '20px' }}>
         {scannedPlayers.length > 0 ? (
         <>
            <Row className="g-2">
               {scannedPlayers.map((player, index) => (
                  <PlayerCard key={player.id} classes={'p-2'} cardStyle={{width: '300px'}}>
                     <div className="d-flex align-items-center w-100">
                        <img 
                           src={`/api/images/players/${player.id}.jpg`} 
                           alt={`${player.nick_name}'s image`}
                           style={{ height: '100px', width: '100px' }}
                        />
                        <h4 className="display-6 w-100 text-center">{player.nick_name}</h4>
                     </div>
                  </PlayerCard>
               ))}
               {gameReady && <h2 className="text-success text-center">Please come in!</h2>}
            </Row>
         </>
         ) : (
         <h1 className="display-1">Please scan your tags</h1>
         )}
      </Container>


  )
}

export default GameRoomDoorScreen