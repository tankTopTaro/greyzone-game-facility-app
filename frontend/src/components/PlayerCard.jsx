/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
import { useEffect, useState } from 'react'
import { Card } from 'react-bootstrap'

const PlayerCard = ({ classes, cardStyle, children }) => {
    return (
      <Card className={`${classes} d-flex align-items-center justify-content-center flex-column mb-4`} style={cardStyle}>

         { children }

      </Card>
    )
}

export default PlayerCard