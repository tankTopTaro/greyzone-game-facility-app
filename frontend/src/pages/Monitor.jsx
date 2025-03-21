/* eslint-disable no-unused-vars */
import axios from 'axios'
import { useEffect, useRef, useState } from "react"
import Navigation from "../components/Navigation"
import Alerts from "../components/Alerts"
import Header from "../components/Header"
import Controls from '../components/Controls'
import WebSocketService from "../utils/WebSocketService.js"
import { Container } from 'react-bootstrap'

const WS_URL = 'ws://localhost:8081'
const CLIENT = 'monitor'

/** TODO: reset the form fields on submit, Remove some elements */

const Monitor = () => {
   const [showAlerts, setShowAlerts] = useState(false)
   const [players, setPlayers] = useState([])
   const [playersWithSession, setPlayersWithSession] = useState([])
   const [playersWithRecentSession, setPlayersWithRecentSession] = useState([])
   const [message, setMessage] = useState('Waiting for messages...')
   const [clients, setClients] = useState({})
   const [scannedPlayers, setScannedPlayers] = useState({})
   
   const wsService = useRef(null)

   const fetchPlayersWithSession = async () => {
      try {
         const response = await axios.get('/api/players/active')
         if (response.status === 200 && response.data) {
            setPlayersWithSession(response.data)
         } else if (response.status === 204) {
            setPlayersWithSession([])
         }
      } catch (error) {
         console.error('Error fetching players with active session:', error)
      } 
   }

   const fetchPlayersWithRecentSession = async () => {
      try {
         const response = await axios.get('/api/players/recent')
         if (response.status === 200 && response.data) {
            setPlayersWithRecentSession(response.data)
         } else if (response.status === 204) {
            setPlayersWithRecentSession([])
         }
      } catch (error) {
         console.error('Error fetching players whose session just ended:', error)
      }
   }

    useEffect(() => {
      document.title = "GFA | Monitor"
      fetchPlayersWithSession()
      fetchPlayersWithRecentSession()
    }, [])

    // WebSocket
    useEffect(() => {
      if (!wsService.current) {
         wsService.current = new WebSocketService(WS_URL, CLIENT)
         wsService.current.connect()
      }

      const handleWebSocketMessage = (data) => {
         console.log('Received WebSocket message:', data)

         if (data.type === 'clientData'){
            setClients(data.clients)
         } else if (data.type === 'confirmed') {
            setScannedPlayers({})
         } else if (data.type === 'rfid_scanned') {
            if (data.location === 'booth') {
               // Check if the player has already been scanned at any booth
               const playerScannedLocations = scannedPlayers[data.player]
               if (playerScannedLocations && playerScannedLocations.some(loc => loc.startsWith('booth'))) {
                   // Player has already been scanned at a booth
                   console.log(`Player ${data.player} has already been scanned at a booth`)
                   return // Stop further processing, or send an error message to the user
               }
           }
   
           // Add the new scan to the state
           setScannedPlayers((prev) => ({
               ...prev,
               [data.player]: prev[data.player]
                   ? [...prev[data.player], `${data.location}-${data.id}`]
                   : [`${data.location}-${data.id}`]
           }))
         } else if (data.type === 'updatedPlayers') {
            setPlayers(data.players)
         } else if (data.type === 'facility_session') {
            setPlayersWithSession(data.active_players)
            setPlayersWithRecentSession(data.recent_players)
         } else if (data.type === 'error') {
            console.log(data)
         } else {
            setMessage(data.message || 'No message received')
         }
      }

      wsService.current.addListener(handleWebSocketMessage)

      wsService.current.send({ type: 'subscribe' })

      return () => {
         if (wsService.current) {
            wsService.current.removeListener(handleWebSocketMessage)
            wsService.current.close()
            wsService.current = null
         }
      }
    }, [scannedPlayers])

    return (
         <div className="d-flex flex-column vh-100">  
            <Navigation setShowAlerts={setShowAlerts} />
            <Alerts show={showAlerts} onClose={() => setShowAlerts(false)} />

            <Header />
            
            <section className="d-flex p-3 gap-3 flex-grow-1">
               <Container className="w-100 flex-grow-1 mb-4">
                  <Controls wsService={wsService.current} clients={clients} players={players} playersWithSession={playersWithSession} playersWithRecentSession={playersWithRecentSession} scannedPlayers={scannedPlayers}/>
               </Container>
            </section>

            <footer className="w-100 border d-flex align-items-center justify-content-center text-center mt-4" style={{ height: '100px' }}>
               <p>&copy; 2025</p>
            </footer>
        </div>
    )
}

export default Monitor