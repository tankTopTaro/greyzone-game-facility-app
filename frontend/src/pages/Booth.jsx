/* eslint-disable no-unused-vars */
import axios from 'axios'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import WebSocketService from '../utils/WebSocketService.js'
import { Button, Container, Row } from 'react-bootstrap'
import PlayerCard from '../components/PlayerCard.jsx'

const WS_URL = 'ws://192.168.254.100:8081'

const Booth = () => {
   const { booth_id } = useParams()
   const wsService = useRef(null)
   const CLIENT = `booth-${booth_id}`

   const [players, setPlayers] = useState([])
   const [message, setMessage] = useState('')

   const getCommonLeague = (players) => {
      const leagues = players.map(player => player.league)
  
      const commonLeague = leagues.reduce((common, league) => {
          if (!common) return league
  
          const sameCountry = common.country === league.country
          const sameCity = common.city === league.city
  
          return (sameCountry && sameCity) ? common : null
      }, null)

      if (commonLeague) {
         const { district, other, ...cleanedLeagues } = commonLeague
         return cleanedLeagues
     }
  
      return null
   }

   const handleConfirm = async () => {
      try {
         if (players.length > 1) {
           const teamData = {
             unique_identifiers: players.map(player => player.id),
             leagues: getCommonLeague(players)
           };

           console.log('PAYLOAD: ', teamData)
     
           const response = await axios.post(`/api/teams/`, teamData);
     
           if (response.status === 200) {
             console.log('Players successfully forwarded to the team', response.data);
     
             wsService.current.send({
               type: 'confirm',
               from: CLIENT,
             });
     
             setMessage('Follow the pink lights');
           }
         } else {
           console.log('Single player confirmed.');
           
           wsService.current.send({
             type: 'confirm',
             from: CLIENT,
           });
     
           setMessage('Follow the pink lights');
         }
     
         // Add a delay for the message reset
         setTimeout(() => {
          setMessage('')
          setPlayers([]);
       }, 5000);
     
       } catch (error) {
         console.log('Error forwarding players to the team:', error.message);
       }
   }

   useEffect(() => {
      document.title = `GFA | Booth ${booth_id}`

      if (!wsService.current) {
         wsService.current = new WebSocketService(WS_URL, CLIENT)
         wsService.current.connect()
      }

      const handleWebSocketMessage = async (data) => {
         console.log('Received WebSocket message: ', data)
   
         if (data.type === 'rfid_scanned'){
            if (data.location === 'booth' && Number(data.id) === Number(booth_id)) {
                const playerId = data.player
                try {
                   const response = await axios.get(`/api/players/${playerId}`)
    
                   if (response.status === 200) {
                      const playerData = response.data
    
                      setPlayers((prevPlayers) => {
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
         }
      }

      wsService.current.addListener(handleWebSocketMessage)

      return () => {
         if (wsService.current) {
            wsService.current.removeListener(handleWebSocketMessage)
            wsService.current.close()
            wsService.current = null
         }
      }
   }, [booth_id, CLIENT])

   return (
      <Container className="d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '100vh', padding: '20px' }}>
      {players.length > 0 ? (
        <>
            <Row className="g-2">
               {players.map((player) => (
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
               {!message && (
                  <Button className="display-6" onClick={() => handleConfirm()}>Confirm</Button>
               )}
               {message && (
                  <h2 className="display-2">{message}</h2>
               )}
            </div>
        </>
      ) : (
        <h1 className="display-1">Please scan your tags</h1>
      )}
    </Container>
   )
}

export default Booth