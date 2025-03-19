/* eslint-disable react/prop-types */
/* eslint-disable no-unused-vars */
import Container from 'react-bootstrap/Container'
import Navbar from 'react-bootstrap/Navbar'
import Form from 'react-bootstrap/Form'
import Dropdown from 'react-bootstrap/Dropdown'
import Button from 'react-bootstrap/Button'
import InputGroup from 'react-bootstrap/InputGroup'
import { IconSearch, IconAlertCircle } from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'
 
const Navigation = ({ setShowAlerts }) => {
   return (
      <Navbar expand="lg" className="bg-body-tertiary">
         <Container>
            <Navbar.Brand>Greyzone Facility</Navbar.Brand>
            <div className='d-flex align-items-center gap-2'>
               <Button 
                  variant="secondary"  
                  onClick={() => setShowAlerts(true)}
               >
                  <IconAlertCircle stroke={2} />
               </Button>
            </div>
         </Container>
      </Navbar>
   )
}

export default Navigation