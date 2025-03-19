/* eslint-disable react/prop-types */
import { Badge, Container, ListGroup } from "react-bootstrap"

const Lists = ({ playersWithSession, player, setPlayer, scannedPlayers = {} }) => {
   const sortedPlayers = [...playersWithSession].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
   
   return (
      <Container className="border py-3">
         <ListGroup>
            {sortedPlayers.length > 0 ? (
               sortedPlayers.map((p) => (
                  <ListGroup.Item 
                     key={p.id}  
                     className={`list-group-item-action 
                        ${player?.id === p.id ? 'list-group-item-dark' : ''}`}
                     onClick={() => setPlayer(p)}
                  >
                     <div className="d-flex justify-content-between align-items-center">
                        <span className="text-truncate w-100 overflow-hidden" style={{ whiteSpace: "nowrap" }}>
                           {p.id} - {p.nick_name}
                        </span>
                        {scannedPlayers[p.id] && [...new Set(scannedPlayers[p.id])].map((location, index) => (
                           <Badge bg="success" className="ms-2" key={index}>
                              {location}
                           </Badge>
                        ))}

                     </div>
                  </ListGroup.Item>
               ))
            ) : (
               <p>No players found.</p>
            )}
         </ListGroup>
      </Container>
   )
}

export default Lists