import axios from 'axios'
import dbHelpers from './dbHelpers.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const RFIDS_PATH = path.join(__dirname, '../assets/rfids.json')

const checkRfidValidity = async (rfid_tag, player_id)  =>{
   try {
       let rfids = dbHelpers.readDatabase(RFIDS_PATH) || {}

       if (rfids[rfid_tag]) {
           console.log('Found in cache', rfids[rfid_tag])
           return rfids[rfid_tag] === player_id
       }

       try {
           const response = await axios.get(`${process.env.CSA_API_URL}/players/${player_id}`)
     
           if (response.status === 200) {
               const playerData = response.data
               const rfidTagFromCSA = playerData.rfid_tag_uid

               rfids[rfid_tag] = player_id
               dbHelpers.writeDatabase(RFIDS_PATH, rfids)

               return rfid_tag === rfidTagFromCSA
           }
         } catch (error) {
           console.error('Server is offline')

           rfids[rfid_tag] = player_id
           dbHelpers.writeDatabase(RFIDS_PATH, rfids)

           return rfids[rfid_tag] === player_id
         }
   } catch (error) {
       console.error('Error checking RFID:', error)
   }

   return false
}

export default checkRfidValidity