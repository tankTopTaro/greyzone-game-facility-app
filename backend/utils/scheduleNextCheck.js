import dbHelpers from "./dbHelpers.js";

const DEFAULT_CHECK_INTERVAL = 60000; // 60 seconds

const scheduleNextSessionCheck = async (facilityInstance) => {
    if (!facilityInstance || !facilityInstance.socket) {
        console.error("Facility instance or socket not initialized.");
        return;
    }

    const activePlayers = await dbHelpers.getPlayerWithActiveSession();

    const now = new Date();
    let nextExpiration = null;

    activePlayers.forEach(player => {
        const sessionEnd = new Date(player.facility_session.date_end + 'Z'); // Ensure UTC
        const remainingTime = sessionEnd - now;

        if (remainingTime > 0 && (!nextExpiration || remainingTime < nextExpiration.time)) {
            nextExpiration = { time: remainingTime, player_id: player.id };
        }
    });

    let nextCheckTime = nextExpiration ? nextExpiration.time : DEFAULT_CHECK_INTERVAL;

    // Schedule the next session check
    setTimeout(async () => {
        console.log("Checking for session updates...");

        const updatedActivePlayers = await dbHelpers.getPlayerWithActiveSession();
        const updatedRecentPlayers = await dbHelpers.getPlayerWithRecentSession();

        facilityInstance.socket.broadcastMessage("monitor", {
            type: "facility_session",
            active_players: updatedActivePlayers,
            recent_players: updatedRecentPlayers
        });

        console.log("Updated active players list broadcasted.");

        // Schedule the next check
        scheduleNextSessionCheck(facilityInstance);

    }, nextCheckTime);
};

// Start scheduling
export default scheduleNextSessionCheck;