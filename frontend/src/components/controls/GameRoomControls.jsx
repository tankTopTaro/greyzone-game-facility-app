/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
import { useEffect, useState } from "react"
import axios from 'axios'
import { Form, InputGroup, Button, Container } from "react-bootstrap"

const GameRoomControls = ({ clients, playersWithSession, playersWithRecentSession }) => {
    const [playerId, setPlayerId] = useState('')
    const [gameRoomEnabled, setGameRoomEnabled] = useState([])
    const [timeCredit, setTimeCredit] = useState('')

    useEffect(() => {
        const fetchRoomStatus = async () => {
            if (!clients?.['game-rooms']) return

            // Initialize with false values to prevent undefined issues
            setGameRoomEnabled(Array(clients['game-rooms'].length).fill(false));

            const status = await Promise.all(
                clients['game-rooms'].map(async (game_room) => {
                    const gra_id = game_room.replace('.local', '')
                    try {
                        const response = await axios.get(`/api/game-room/${gra_id}/status`);
                        return response.data.enabled
                    } catch (error) {
                        console.error(`Failed to fetch status for ${gra_id}`, error);
                        return false
                    }
                })
            )
            setGameRoomEnabled(status)
        }

        fetchRoomStatus()
    }, [clients])

    const toggleGameRoom = async (game_room, index) => {
        const gra_id = game_room.replace('.local', '')
        const newStatus = !gameRoomEnabled[index]

        try {
            const response = await axios.post(`/api/game-room/${gra_id}/toggle-room`, {
                status: newStatus
            })
            if (response.status === 200) {
                setGameRoomEnabled(prev => {
                    const updatedStatus = [...prev];
                    updatedStatus[index] = newStatus; // Toggle the value
                    return [...updatedStatus]; // Ensure a new array reference
                });                
            }
        } catch (error) {
            console.error('Request error:', error.response?.data)
        }
    }

    const addTimeCredits = async () => {
        if (!playerId || !timeCredit) {
            alert("Please select a player and enter the time credits.");
            return;
        }

        try {
            const response = await axios.post('/api/facility-session/add-time-credits', {
                player_id: playerId,
                additional_m: parseInt(timeCredit, 10)
            });

            if (response.status === 200) {
                alert('Time credits added successfully!');
                setTimeCredit(''); // Reset input field
            }
        } catch (error) {
            console.error("Failed to add time credits:", error.response?.data);
            alert("Failed to add time credits.");
        }
    }

    return (
        <Container className="p-3 player-form-container">
            <h4>Add time credits to player</h4>
            
            <InputGroup className="w-100 d-flex mb-4">
                <Form.Select 
                  value={playerId}
                  onChange={(e) => setPlayerId(e.target.value)}
                  style={{ height: '38px', flex: '0 0 35%' }}
                  >
                  <option>Select a player</option>
                  
                  {/* Players with active session */}
                  {Array.isArray(playersWithSession) && playersWithSession.length > 0 && (
                     <optgroup label="Active Sessions">
                        {playersWithSession
                           .slice() // Create a shallow copy to avoid mutating the original array
                           .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
                           .map((p) => (
                              <option key={p.id} value={p.id}>
                                 {p.id} - {p.nick_name}
                              </option>
                           ))}
                     </optgroup>
                  )}

                  {/* Players with recently ended sessions */}
                  {Array.isArray(playersWithRecentSession) && playersWithRecentSession.length > 0 && (
                     <optgroup label="Recently Ended Sessions">
                        {playersWithRecentSession
                           .slice()
                           .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
                           .map((p) => (
                              <option key={p.id} value={p.id}>
                                 {p.id} - {p.nick_name}
                              </option>
                           ))}
                     </optgroup>
                  )}
                </Form.Select>

                <Form.Select
                    value={timeCredit}
                    onChange={(e) => setTimeCredit(e.target.value)}
                    style={{ height: '38px', flex: '0 0 35%' }}
                >
                    <option value="">Select time credit</option>
                    {[5, 10, 15, 20, 25, 30].map((value) => (
                        <option key={value} value={value}>
                            {value} minutes
                        </option>
                    ))}
                </Form.Select>

                <Button onClick={addTimeCredits} style={{ height: '38px'}}>Add Time Credits</Button>
            </InputGroup>

            

            <h4>Enable | Disable Game Rooms</h4>

            {clients?.['game-rooms']?.length > 0 &&
                clients?.['game-rooms'].map((game_room, index) => (
                <Form.Check
                    key={game_room}
                    type="switch"
                    label={`${gameRoomEnabled[index] ? "Disable" : "Enable"} ${game_room}`}
                    checked={gameRoomEnabled[index]}
                    onChange={() => toggleGameRoom(game_room, index)}
                />
                ))
            }
        </Container>
    )
}

export default GameRoomControls