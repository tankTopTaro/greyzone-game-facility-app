/* eslint-disable react/prop-types */
import { useState } from "react"
import { Button, Form, InputGroup } from "react-bootstrap"
import axios from 'axios'

const FacilityControls = ({ players }) => {
    const [playerId, setPlayerId] = useState('')
    const [durationM, setDurationM] = useState(0)

    const handleFacilitySession = async () => {
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

    return (
        <div className="p-3">
            <h4 className="mb-4">Create Facility Session</h4>
            <InputGroup className="w-100 w-lg-50 d-flex">
                <Form.Select 
                    value={playerId}
                    onChange={(e) => setPlayerId(e.target.value)}
                    style={{ height: '38px', flex: '0 0 50%' }}
                >
                    <option>Select a player</option>
                    {(Array.isArray(players) ? players : [])
                        .slice() // Create a shallow copy to avoid mutating the original array
                        .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
                        .map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.id} - {p.nick_name}
                            </option>
                    ))}
                </Form.Select>
                <Form.Control
                    type="number"
                    placeholder="Duration (minutes)"
                    className="mb-2 flex-grow-1"
                    onChange={(e) => setDurationM(Number(e.target.value))}
                    style={{ height: '38px'}}
                />
            </InputGroup>
            <Button 
                onClick={() => handleFacilitySession()}
                style={{ width: '200px'}}
            >
                Check-in
            </Button>
        </div>
    )
}

export default FacilityControls