/* eslint-disable no-unused-vars */
import { useEffect, useRef, useState } from "react"
import { useParams } from "react-router-dom"
import WebSocketService from "../utils/WebSocketService.js"
import PlayerCard from "../components/PlayerCard.jsx"
import { Button, Container, Row } from "react-bootstrap"
import axios from "axios"

const WS_URL = 'ws://192.168.254.100:8081'

const GameRoomDoorScreen = () => {
  const { gra_id } = useParams()
  const wsService = useRef(null)
  const CLIENT = `game-room-${gra_id}`

  const [scannedPlayers, setScannedPlayers] = useState([])
  const [gameReady, setGameReady] = useState(false)
  const [message, setMessage] = useState('')
  const [roomIsNotBusy, setRoomIsNotBusy] = useState(false)

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
         console.log(data)
         try {
            const response = await axios.get(`/api/players/${playerId}`)

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
         setMessage('Please come in!')

         setTimeout(() => {
            setGameReady(false)
            setScannedPlayers([])
            setMessage('')
          }, 5000)
       } else if (data.type === 'toggleRoom') {
         setRoomIsNotBusy(data.states[`gra-${gra_id}.local`].isAvailable)
       } else if (data.type === 'roomAvailable') {
         setRoomIsNotBusy(data.isAvailable)
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
               
            </Row>

            <div className="d-flex justify-content-center mt-2">
               {gameReady && <h2 className="text-success w-100 text-center">{message}</h2>}
            </div>
         </>
         ) : (
            roomIsNotBusy 
               ? <h1 className="display-1">Please scan your tags</h1>
               : <h1 className="display-1">Room is busy, please wait</h1>
         )}
      </Container>
  )
}

export default GameRoomDoorScreen