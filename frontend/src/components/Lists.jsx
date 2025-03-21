/* eslint-disable react/prop-types */
import { Container, ListGroup } from "react-bootstrap"

const Lists = ({ playersWithSession, playersWithRecentSession, player, setPlayer }) => {
   const playersToShow = (Array.isArray(playersWithSession) && playersWithSession.length > 0) 
      ? playersWithSession 
      : (Array.isArray(playersWithRecentSession) ? playersWithRecentSession : []);

   
   const sortedPlayers = [...playersToShow].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
   
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