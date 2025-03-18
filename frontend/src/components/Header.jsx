import { Container } from "react-bootstrap"

const Header = () => {
   return (
      <>
      <Container className="d-flex justify-content-around my-3 p-3">
         <div>
            <h1 className="display-1 text-center border-0">0</h1>
            <small className="fw-semibold text-secondary">Current Players</small>
         </div>

         <div>
            <h1 className="display-1 text-center border-0">0</h1>
            <small className="fw-semibold text-secondary">Current Teams</small>
         </div>

         <div>
            <h1 className="display-1 text-center border-0">0</h1>
            <small className="fw-semibold text-secondary">Current Sessions</small>
         </div>
      </Container>
      </>
   )
}

export default Header