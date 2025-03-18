import { useState } from 'react'
import { Button, Col, Container, Form, Row } from 'react-bootstrap'
import axios from 'axios'

const CreatePlayers = () => {
  const initialStates = {
    nick_name: "",
    email: "",
    phone: "",
    last_name: "",
    first_name: "",
    gender: "",
    birth_date: "",
    league_country: "",
    league_city: "",
    league_district: "",
    league_other: "",
    notes: ""
  }
  const [formData, setFormData] = useState(initialStates)
  
    const handleChange = (e) => {
      setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleSubmit = async (e) => {
      e.preventDefault()

      try {
          const response = await axios.post("/api/players/", formData, {
              headers: {
              "Content-Type": "application/json",
              },
          })
          if (response.status === 200) {
            setFormData(initialStates)
          }
      } catch (error) {
          console.error("Error:", error)
      }
    
    }
  
    return (
      <Container className="mt-4">
        <h2>Create New Player</h2>
        <Form onSubmit={handleSubmit}>
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Nickname</Form.Label>
                <Form.Control type="text" name="nick_name" value={formData.nick_name} onChange={handleChange} />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Email</Form.Label>
                <Form.Control type="email" name="email" value={formData.email} onChange={handleChange} required />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Phone</Form.Label>
                <Form.Control type="tel" name="phone" value={formData.phone} onChange={handleChange} />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>First Name</Form.Label>
                <Form.Control type="text" name="first_name" value={formData.first_name} onChange={handleChange} required />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Last Name</Form.Label>
                <Form.Control type="text" name="last_name" value={formData.last_name} onChange={handleChange} required />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Gender</Form.Label>
                <Form.Select name="gender" value={formData.gender} onChange={handleChange}>
                  <option value="">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Birth Date</Form.Label>
                <Form.Control type="date" name="birth_date" value={formData.birth_date} onChange={handleChange} />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>League Country</Form.Label>
                <Form.Control type="text" name="league_country" value={formData.league_country} onChange={handleChange} />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>League City</Form.Label>
                <Form.Control type="text" name="league_city" value={formData.league_city} onChange={handleChange} />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>League District</Form.Label>
                <Form.Control type="text" name="league_district" value={formData.league_district} onChange={handleChange} />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>League Other</Form.Label>
                <Form.Control type="text" name="league_other" value={formData.league_other} onChange={handleChange} />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Notes</Form.Label>
                <Form.Control as='textarea' name="notes" value={formData.notes} onChange={handleChange} />
              </Form.Group>
            </Col>
          </Row>
          <Button variant="primary" type="submit">
            Submit
          </Button>
        </Form>
      </Container>
    )
}

export default CreatePlayers