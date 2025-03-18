import path from 'path'
import fs from 'fs'
import axios from 'axios'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const IMAGE_CACHE_DIR = path.join(__dirname, '../assets/images')  // local storage directory

const imagesController = {
    getPlayerImage: async (req, res) => {
        const { player_id } = req.params
        const localImagePath = path.join(IMAGE_CACHE_DIR, `${player_id}.jpg`)

        // Check if the image is cached locally
        if (fs.existsSync(localImagePath)) {
            return res.sendFile(localImagePath)
        }

        try {
            // Fetch image from CSA if not in cache
            const csaResponse = await axios.get(`${process.env.CSA_API_IMAGES_URL}/players/${player_id}.jpg`, {
                responseType: 'arraybuffer',
                validateStatus: (status) => status === 200 || status === 404
            })

            if (csaResponse.status === 200) {
                // Ensure cache directory exists
                if (!fs.existsSync(IMAGE_CACHE_DIR)) {
                    fs.mkdirSync(IMAGE_CACHE_DIR, {recursive: true})
                }

                // Save the image to local storage
                fs.writeFileSync(localImagePath, csaResponse.data)

                // Send the cached image to client
                return res.sendFile(localImagePath)
            }
        } catch (error) {
            console.error('Error fetching image from CSA:', error.message)
        }

        // If the image is not found in CSA
        return res.status(404).json({ error: 'Player image not found.' })
    }
}

export default imagesController