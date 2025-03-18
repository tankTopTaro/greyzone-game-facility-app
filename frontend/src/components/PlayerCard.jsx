/* eslint-disable react/prop-types */
import { useEffect, useState } from 'react'
import { Card } from 'react-bootstrap'

const PlayerCard = ({ player }) => {
   const [imageUrl, setImageUrl] = useState(null)

   useEffect(() => {
      if (player?.id) {
         setImageUrl(`http://localhost:3001/api/images/players/${player.id}.jpg`)
      }
   }, [player])

    return (
      <Card className="d-flex align-items-center justify-content-center flex-column gap-2" 
         style={{ width: '12rem', overflow: 'hidden' }}>

         <div style={{ 
            width: '100px', 
            height: '100px', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            marginTop: '10px'  // Added spacing from the top
         }}>
            <Card.Img
               src={imageUrl}
               onError={(e) => { e.target.src = 'https://placehold.co/100x100' }}
               style={{ width: '100px', height: '100px', objectFit: 'cover' }}
            />
         </div>

         <Card.Body className="text-center">
            <Card.Title style={{ fontSize: '24px', marginTop: '10px' }}>{player.nick_name}</Card.Title>
         </Card.Body>

      </Card>
    )
}

export default PlayerCard