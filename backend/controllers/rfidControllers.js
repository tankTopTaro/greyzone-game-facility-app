let facilityInstance = null

const rfidController = {
    setFacilityInstance: (instance) => {
      facilityInstance = instance
    },

    gameRoom: (req, res) => {
      const { gra_id } = req.params;
      const { rfid_tag, player } = req.body;
      const data = { rfid_tag, player, location: 'game-room', id: gra_id };
  
      facilityInstance.socket.handleRfidScan(data)
          .then(() => res.json({ status: "ok", message: `RFID valid at Game Room ${gra_id}` }))
          .catch((error) => res.status(500).json({ error: "Internal server error" }));
   },
    
    booth: async (req, res) => {
        const { booth_id } = req.params
        const { rfid_tag, player } = req.body
        const data = { rfid_tag, player, location: 'booth', id: booth_id };
  
        facilityInstance.socket.handleRfidScan(data)
            .then(() => res.json({ status: "ok", message: `RFID valid at Booth ${gra_id}` }))
            .catch((error) => res.status(500).json({ error: "Internal server error" }));
    }
}

export default rfidController
