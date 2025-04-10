import { useState } from "react"
import { Tab, Tabs } from "react-bootstrap"
import FacilityControls from "./controls/FacilityControls"
import RfidControls from "./controls/RfidControls"
import GameRoomControls from "./controls/GameRoomControls"
import CreatePlayers from "./controls/CreatePlayers"

const Controls = ({ wsService, clients, activePlayers, recentPlayers, scannedPlayers, gameRoomEnabled}) => {
   const [key, setKey] = useState('createPlayerInfo')

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
               <FacilityControls activePlayers={activePlayers} recentPlayers={recentPlayers} />
            </Tab>
            <Tab eventKey="simulateRfidScan" title="RFID">
               <RfidControls wsService={wsService} clients={clients} activePlayers={activePlayers} recentPlayers={recentPlayers} scannedPlayers={scannedPlayers} />
            </Tab>
            <Tab eventKey="gameRoomControl" title="Others">
               <GameRoomControls clients={clients} activePlayers={activePlayers} recentPlayers={recentPlayers} gameRoomEnabled={gameRoomEnabled} />
            </Tab>
         </Tabs>
      </>
   )
}

export default Controls