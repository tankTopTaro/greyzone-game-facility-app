import React, { useEffect, useRef, useState } from 'react'
import { Container } from 'react-bootstrap'
import WebSocketService from '../utils/WebSocketService.js'
import Navigation from "../components/Navigation"
import Alerts from "../components/Alerts"
import Controls from '../components/Controls'
import axios from 'axios'

const WS_URL = `ws://${window.location.hostname}:8081`
const CLIENT = 'monitor'

const Monitor = () => {
   const wsService = useRef(null)

   const [showAlerts, setShowAlerts] = useState(false)
   const [activePlayers, setActivePlayers] = useState([])
   const [recentPlayers, setRecentPlayers] = useState([])
   const [clients, setClients] = useState({})
   const [scannedPlayers, setScannedPlayers] = useState({})
   const [gameRoomEnabled, setGameRoomEnabled] = useState({})
   const [errors, setErrors] = useState({})

   const fetchActivePlayers = async () => {
      try {
         const response = await axios.get('/api/players/active')
         if (response.status === 200 && response.data) {
            setActivePlayers(response.data)
         } else if (response.status === 204) {
            setActivePlayers([])
         }
      } catch (error) {
         console.error('Error fetching players with active session:', error)
      }
   }

   const fetchRecentPlayers = async () => {
      try {
         const response = await axios.get('/api/players/recent')
         if (response.status === 200 && response.data) {
            setRecentPlayers(response.data)
         } else if (response.status === 204) {
            setRecentPlayers([])
         }
      } catch (error) {
         console.error('Error fetching players with recent session:', error)
      }
   }

   useEffect(() => {
      document.title = "GFA | Monitor"
      fetchActivePlayers()
      fetchRecentPlayers()
   }, [])

   useEffect(() => {
      if (!wsService.current) {
         wsService.current = new WebSocketService(WS_URL, CLIENT)
         wsService.current.connect()
      }

      const handleWebSocketMessage = (data) => {
         console.log(`Received message: ${JSON.stringify(data)}`)
         const messageHandlers = {
            'clientData': () => setClients(data.clients),
            'confirmed': () => setScannedPlayers({}),
            'error': () => {
               setErrors((prevErrors) => {
                  const newErrors = { ...prevErrors }
            
                  Object.keys(data.data).forEach((source) => {
                     const merged = data.data[source]
            
                     const deduped = []
                     const seen = new Set()

                     for (const err of merged) {
                        if (err.resolved) continue

                        const key = `${err.message}`
                        if (!seen.has(key)) {
                           seen.add(key)
                           deduped.push(err)
                        }
                     }

                     newErrors[source] = deduped
                  })
            
                  return newErrors
               })
            },
            'facility_session': () => {
               console.log(data)
               setActivePlayers(data.active_players)
               setRecentPlayers(data.recent_players)
            },
            'reportedErrors': () => {
               const cleanedErrors = {}

               Object.keys(data.data).forEach((source) => {
                  const merged = data.data[source]

                  const deduped = []
                  const seen = new Set()

                  for (const err of merged) {
                     if (err.resolved) continue

                     const key = `${err.message}` // or include timestamp if needed
                     if (!seen.has(key)) {
                        seen.add(key)
                        deduped.push(err)
                     }
                  }

                  cleanedErrors[source] = deduped
               })

               setErrors(cleanedErrors)
            },
            'rfid_scanned': () => {
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
            },
            'status_update': () => console.log(data),
            'storedStates': () => {
               setClients(data.states)
            },
            'toggleRoom': () => {
               setGameRoomEnabled(Object.fromEntries(Object.entries(data.states).map(([id, data]) => [id, data.enabled])))
            }
         }

         if (!messageHandlers[data.type]) console.warn(`No handler for this message type ${data.type}`)

         messageHandlers[data.type]()
      }

      wsService.current.addListener(handleWebSocketMessage)

      return () => {
         if (wsService.current) {
            wsService.current.removeListener(handleWebSocketMessage)
            wsService.current.close()
            wsService.current = null
         }
      }
   }, [scannedPlayers])

   // Compute errorCount directly from errors state
   const errorCount = Object.values(errors).reduce(
      (total, sourceErrors) => total + (Array.isArray(sourceErrors) ? sourceErrors.length : 0),
      0
   )

   return (
      <div className="d-flex flex-column vh-100">  
         <Navigation setShowAlerts={setShowAlerts} errorCount={errorCount} />
         <Alerts show={showAlerts} onClose={() => setShowAlerts(false)} errors={errors} />

         <section className="d-flex p-3 gap-3 flex-grow-1">
            <Container className="w-100 flex-grow-1 mb-4">
               <Controls wsService={wsService.current} clients={clients} activePlayers={activePlayers} recentPlayers={recentPlayers} scannedPlayers={scannedPlayers} gameRoomEnabled={gameRoomEnabled}/>
            </Container>
         </section>

         <footer className="w-100 d-flex align-items-center justify-content-center text-center mt-4" style={{ height: '100px' }}>
            <p>&copy; 2025</p>
         </footer>
      </div>
   )
}

export default Monitor