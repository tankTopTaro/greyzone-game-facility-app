/* eslint-disable react/prop-types */
/* eslint-disable no-unused-vars */
import { useState } from "react"
import { Tab, Tabs } from "react-bootstrap"
import FacilityControls from "./controls/FacilityControls"
import RfidControls from "./controls/RfidControls"
import GameRoomControls from "./controls/GameRoomControls"
import CreatePlayers from "./controls/CreatePlayers"

const Controls = ({ wsService, clients, players, playersWithSession, scannedPlayers}) => {
   const [key, setKey] = useState('createFacilitySession')

   return (
      <> 
         <Tabs
            id="controlled-tab-example"
            activeKey={key}
            onSelect={(k) => setKey(k)}
         >
            <Tab eventKey="createPlayerInfo" title="Player">
               <CreatePlayers />
            </Tab>
            <Tab eventKey="createFacilitySession" title="Facility Session">
               <FacilityControls players={players} />
            </Tab>
            <Tab eventKey="simulateRfidScan" title="RFID">
               <RfidControls wsService={wsService} clients={clients} playersWithSession={playersWithSession} scannedPlayers={scannedPlayers} />
            </Tab>
            <Tab eventKey="gameRoomControl" title="Others">
               <GameRoomControls clients={clients} playersWithSession={playersWithSession} />
            </Tab>
         </Tabs>
      </>
   )
}

export default Controls