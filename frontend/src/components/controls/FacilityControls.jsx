import { useEffect, useState } from "react"
import { Button, Container, Form, InputGroup } from "react-bootstrap"
import { PulseLoader } from 'react-spinners'
import axios from 'axios'
import SearchBar from "../SearchBar"
import PlayerCard from "../PlayerCard"

const FacilityControls = ({ activePlayers, recentPlayers }) => {
    const [players, setPlayers] = useState([])
    const [durationM, setDurationM] = useState(0)

    const [category, setCategory] = useState('email')
    const [query, setQuery] = useState('')
    const [searchAttempted, setSearchAttempted] = useState(false)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
      if (query === '') {
         setPlayers([])
         setSearchAttempted(false)
      }
    }, [query])
 
    const handleSearchClick = async () => {
      if (query.trim() === '') return
      
      setSearchAttempted(true)
      setLoading(true)
      
      try {
         const response = await axios.get(`/api/players/search?${category}=${encodeURIComponent(query)}`)
         if (response.status === 200) {
            if (response.data.length > 0) {
               setPlayers(response.data)
            } else {
               setPlayers([])
            }
         } else {
            console.log(response.data)
         }
      } catch (error) {
         console.error(error)
      } finally {
         setLoading(false)
      }
    }

    const handleFacilitySession = async (playerId) => {
        if (!playerId || !durationM) {
            console.log('Please select a player and enter a duration.')
            return
        }

        try {
            const response = await axios.post('/api/facility-session/create', {
                player_id: playerId,
                duration_m: durationM
            })
    
            console.log("Facility session created successfully!")
            console.log(response.data)
        } catch (error) {
            console.error("Error creating facility session:", error)
            console.log("Failed to create facility session.")
        }
    }

    const formatBirthDate = (birthDate) => {
      const date = new Date(birthDate)
      return date.toLocaleDateString('en-US', { // Adjust locale as needed
        year: 'numeric',  // "2025"
        month: 'long',    // "August"
        day: 'numeric'    // "21"
      })
    }

    const getPlayerBadge = (playerId) => {
      if (activePlayers.some(player => player.id === playerId)) {
         return (
            <div 
               style={{
                  transform: 'rotate(45deg)', 
                  backgroundColor: 'red', 
                  color: 'white', 
                  width: '60px',  // Set width and height to make it square
                  height: '60px', 
                  display: 'flex',
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontWeight: 'bold', 
                  position: 'absolute', 
                  top: '10px', 
                  right: '10px',
                  borderRadius: '5px',
               }}
               >
               Active
            </div>
         )
      } else if (recentPlayers.some(player => player.id === playerId)) {
         return (
            <div 
              style={{
               transform: 'rotate(45deg)', 
               backgroundColor: 'blue', 
               color: 'white', 
               width: '60px',  // Set width and height to make it square
               height: '60px', 
               display: 'flex',
               alignItems: 'center', 
               justifyContent: 'center',
               fontWeight: 'bold', 
               position: 'absolute', 
               top: '10px', 
               right: '10px',
               borderRadius: '5px',
              }}
            >
              Recent
            </div>
         )
      }
      return null
    }

    const getSessionTimes = (playerId) => {
      const player = recentPlayers.find((p) => p.id === playerId) || activePlayers.find((p) => p.id === playerId);
    
      if (player && player.facility_session) {
        const { date_start, date_end } = player.facility_session;
        return (
          <>
            <div>
               <span><strong>Session Start:</strong> {new Date(date_start).toLocaleTimeString(undefined)}</span>
            </div>
            <div>
              <span><strong>Session End:</strong> {new Date(date_end).toLocaleTimeString(undefined)}</span>
            </div>
          </>
        );
      }
      return null;
    }

    return (
      <Container className="p-3 player-form-container">
         <h4 className="mb-4">Create Facility Session</h4>
         <SearchBar category={category} query={query} setQuery={setQuery} setCategory={setCategory} handleSearchClick={handleSearchClick}/>
         <div className="mt-4">
            {loading ? (
               <div className="w-100 d-flex align-items-center justify-content-center">
                  <PulseLoader color="gray" loading={loading} size={10} />
               </div>
            ) : players.length > 0 ? (
               players.map((player) => {
                  const isActive = activePlayers.some((activePlayer) => activePlayer.id === player.id)
                  
                  return (
                     <PlayerCard key={player.id} classes={'w-100 p-2 gap-2 relative'}>
                        <div className="d-flex w-100 relative">
                           <img 
                              src={`/api/images/players/${player.id}.jpg`} 
                              alt={`${player.nick_name}'s image`}
                              style={{ height: '100px', width: '100px' }}
                           />
                           <div className="d-flex w-100 justify-content-between p-2">
                              <div className="d-flex flex-column">
                                 <h4 className="display-6">{player.id} — {player.nick_name}</h4>
                                 
                                 <div className="position-absolute top-0 end-0 m-2">
                                    {getPlayerBadge(player.id)} {/* Display badge here */}
                                 </div>
   
                                 <div className="d-flex align-items-center gap-2">
                                    <h4>{player.first_name} {player.last_name}</h4>
                                    {player.gender.toLowerCase() === 'male' ? (
                                       <svg  xmlns="http://www.w3.org/2000/svg"  width={24}  height={24}  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  strokeWidth={2}  strokeLinecap="round"  strokeLinejoin="round"  className="icon icon-tabler icons-tabler-outline icon-tabler-gender-male"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10 14m-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0" /><path d="M19 5l-5.4 5.4" /><path d="M19 5h-5" /><path d="M19 5v5" /></svg>
                                    ) : player.gender.toLowerCase() === 'female' ? (
                                       <svg  xmlns="http://www.w3.org/2000/svg"  width={24}  height={24}  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  strokeWidth={2}  strokeLinecap="round"  strokeLinejoin="round"  className="icon icon-tabler icons-tabler-outline icon-tabler-gender-female"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 9m-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0" /><path d="M12 14v7" /><path d="M9 18h6" /></svg>
                                    ) : (
                                       <svg  xmlns="http://www.w3.org/2000/svg"  width={24}  height={24}  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  strokeWidth={2}  strokeLinecap="round"  strokeLinejoin="round"  className="icon icon-tabler icons-tabler-outline icon-tabler-gender-transgender"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M15 9l6 -6" /><path d="M21 7v-4h-4" /><path d="M9 9l-6 -6" /><path d="M3 7v-4h4" /><path d="M5.5 8.5l3 -3" /><path d="M12 16v5" /><path d="M9.5 19h5" /></svg>
                                    )}
                                 </div>
                              </div>
                           </div>
                        </div>
   
                        <div className="d-flex w-100 justify-content-evenly mb-2">
                           <div className="d-flex flex-column">
                              <h4>Personal Details</h4>
                              <span><strong>Birth Date:</strong> {formatBirthDate(player.birth_date)}</span>
                              <span><strong>Email:</strong> {player.email}</span>
                              <span><strong>Phone:</strong> {player.phone}</span>
                           </div>
   
                           <div>
                              <h4>League Details</h4>
                              <span className="fw-semibold">{player.league_other}</span>
                              <p>{player.league_district}, {player.league_city}, {player.league_country}</p>
                           </div>
                        </div>
   
                        {isActive ? (
                           <div className="d-flex w-100 justify-content-evenly mb-2">
                              {getSessionTimes(player.id)} {/* Show session times only for active players */}
                           </div>
                           ) : (
                           <InputGroup className="w-50 d-flex justify-content-center mb-2">
                              <Form.Control
                                 type="number"
                                 placeholder="Duration (minutes)"
                                 className="shadow-none border rounded-0"
                                 onChange={(e) => setDurationM(Number(e.target.value))}
                                 style={{ width: '100px', height: '38px' }}
                              />
                              <Button 
                                 onClick={() => handleFacilitySession(player.id)}
                                 variant="secondary"
                                 style={{ width: '100px', height: '38px' }}
                              >
                                 Check-in
                              </Button>
                           </InputGroup>
                           )}
                     </PlayerCard>
                  )
               })
            ) : (searchAttempted && query.trim() !== '')&& (
               <p className="text-muted text-center mt-3">No players found. Try a different search.</p>
            )}
         </div>
      </Container>
    )
}

export default FacilityControls