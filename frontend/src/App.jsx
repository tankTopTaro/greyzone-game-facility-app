import { Routes, Route, Navigate } from 'react-router-dom'
import Monitor from './pages/Monitor'
import Booth from './pages/Booth'
import GameRoomDoorScreen from './pages/GameRoomDoorScreen'

const App = () => {
  return (
    <Routes>
      <Route path='/' element={<Monitor />}/>
      <Route path='/monitor' element={<Navigate to="/" replace />} />
      <Route path='/booth/:booth_id' element={<Booth />} />
      <Route path='/game-room-door-screen/:gra_id' element={<GameRoomDoorScreen />} />
    </Routes>
  )
}

export default App
