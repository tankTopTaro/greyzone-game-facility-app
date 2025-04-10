import Container from 'react-bootstrap/Container'
import Navbar from 'react-bootstrap/Navbar'
import Button from 'react-bootstrap/Button'
import { Badge } from 'react-bootstrap'
 
const Navigation = ({ setShowAlerts, errorCount }) => {
   const handleShowAlerts = () => {
      setShowAlerts(true)
   }
   return (
      <Navbar expand="lg" className="bg-body-tertiary">
         <Container>
            <Navbar.Brand>Greyzone Facility</Navbar.Brand>
            <div className='d-flex align-items-center gap-2'>
            <Button 
               variant="secondary"  
               onClick={handleShowAlerts}
               className="position-relative" 
            >
               <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-alert-circle">
                  <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                  <path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" />
                  <path d="M12 8v4" />
                  <path d="M12 16h.01" />
               </svg>
               {errorCount > 0 && (
                  <Badge pill bg="danger" className="position-absolute top-0 start-100 translate-middle">
                     {errorCount}
                  </Badge>
               )}
            </Button>
            </div>
         </Container>
      </Navbar>
   )
}

export default Navigation