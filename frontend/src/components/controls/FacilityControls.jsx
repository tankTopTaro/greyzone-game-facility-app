/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
import { useEffect, useState } from "react"
import { Button, Container, Form, InputGroup } from "react-bootstrap"
import { IconGenderMale, IconGenderFemale, IconGenderTransgender } from '@tabler/icons-react';
import axios from 'axios'
import SearchBar from "../SearchBar"
import PlayerCard from "../PlayerCard"

const FacilityControls = () => {
    const [players, setPlayers] = useState([])
    const [durationM, setDurationM] = useState(0)

    const [category, setCategory] = useState('email')
    const [query, setQuery] = useState('')

    useEffect(() => {
      if (query === '') {
         setPlayers([])
      }
    }, [query])
 
    const handleSearchClick = async () => {
      try {
         const response = await axios.get(`/api/players/search?${category}=${encodeURIComponent(query)}`)
         if (response.status === 200) {
            setPlayers(response.data)
         } else {
            console.log(response.data)
         }
      } catch (error) {
         console.error(error)
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
      const date = new Date(birthDate);
      return date.toLocaleDateString('en-US', { // Adjust locale as needed
        year: 'numeric',  // "2025"
        month: 'long',    // "August"
        day: 'numeric'    // "21"
      });
    };

    return (
        <Container className="p-3 player-form-container">
            <h4 className="mb-4">Create Facility Session</h4>
            <SearchBar category={category} query={query} setQuery={setQuery} setCategory={setCategory} handleSearchClick={handleSearchClick}/>
            <div className="mt-4">
               {players.length > 0 && (
                  players.map((player) => (
                     <PlayerCard key={player.id} classes={'w-100 p-2 gap-2'}>
                        <div className="d-flex w-100">
                           <img 
                              src={`/api/images/players/${player.id}.jpg`} 
                              alt={`${player.nick_name}'s image`}
                              style={{ height: '100px', width: '100px' }}
                           />
                           <div className="d-flex w-100 justify-content-between p-2">
                              <div className="d-flex flex-column">
                                 <h4 className="display-6">{player.id} — {player.nick_name}</h4>
                                 <div className="d-flex align-items-center gap-2">
                                    <h4>{player.first_name} {player.last_name}</h4>
                                    {player.gender.toLowerCase() === 'male' ? (
                                       <IconGenderMale stroke={2} /> 
                                    ) : player.gender.toLowerCase() === 'female' ? (
                                       <IconGenderFemale stroke={2} />
                                    ) : (
                                       <IconGenderTransgender stroke={2} />
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

                        <InputGroup className="w-50 d-flex justify-content-center mb-2">
                           <Form.Control
                              type="number"
                              placeholder="Duration (minutes)"
                              className="shadow-none border rounded-0"
                              onChange={(e) => setDurationM(Number(e.target.value))}
                              style={{ width: '100px', height: '38px'}}
                           />
                           <Button 
                              onClick={() => handleFacilitySession(player.id)}
                              variant="secondary"
                              style={{ width: '100px', height: '38px'}}
                           >
                              Check-in
                           </Button>
                        </InputGroup> 
                     </PlayerCard>
                  ))
               )}
            </div>
            {/* */}
        </Container>
    )
}

export default FacilityControls