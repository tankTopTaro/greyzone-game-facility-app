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
   const [category, setCategory] = useState('email')
   const [isExpanded, setIsExpanded] = useState(false)
   const [query, setQuery] = useState('')
   const searchRef = useRef(null)

   const handleCategory = (cat) => {
      setCategory(cat)
   }

   const handleSearchClick = () => {
      if (!isExpanded) {
         setIsExpanded(true)
      } else {
         console.log(`Submiting search to /players/search?${category}=${encodeURIComponent(query)}`)

      }
   }

   const formatCategoryText = (text) => {
      return text
         .replace(/_/g, " ") // Replace underscores with spaces
         .replace(/\b\w/g, (char) => char.toUpperCase()) // Capitalize first letter of each word
   }

   useEffect(() => {
      const handleClickOutside = (ev) => {
         if (searchRef.current && !searchRef.current.contains(ev.target)) {
            setIsExpanded(false)
         }
      }

      document.addEventListener('mousedown', handleClickOutside)

      return () => document.removeEventListener('mousedown', handleClickOutside)
   }, [])

   return (
      <Navbar expand="lg" className="bg-body-tertiary">
         <Container>
            <Navbar.Brand>Greyzone Facility</Navbar.Brand>
            <div className='d-flex align-items-center gap-2'>
               <div className="d-flex align-items-center">
                  <InputGroup className="align-items-center" ref={searchRef}>
                     <div className={`search-container ${isExpanded ? "expanded" : ""}`}>
                        <Dropdown>
                           <Dropdown.Toggle 
                              className='dropdown-toggle'
                              variant="secondary"  
                              style={{ width: "120px", whiteSpace: "nowrap" }}
                           >
                              {formatCategoryText(category)}
                           </Dropdown.Toggle>
                           <Dropdown.Menu>
                              <Dropdown.Item onClick={() => handleCategory("email")}>Email</Dropdown.Item>
                              <Dropdown.Item onClick={() => handleCategory("phone")}>Phone</Dropdown.Item>
                              <Dropdown.Item onClick={() => handleCategory("last_name")}>Last name</Dropdown.Item>
                              <Dropdown.Item onClick={() => handleCategory("first_name")}>First name</Dropdown.Item>
                           </Dropdown.Menu> 
                        </Dropdown>

                        <Form.Control
                           className="shadow-none border rounded-0"
                           type="text"
                           placeholder="Search"
                           aria-label="Search"
                           onChange={(e) => setQuery(e.target.value)}
                        />
                     </div>
                     <Button 
                        className={isExpanded ? 'rounded-end' : 'rounded'}
                        variant="secondary" 
                        onClick={handleSearchClick}
                     >
                        <IconSearch stroke={2} />
                     </Button>
                  </InputGroup>
               </div>

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