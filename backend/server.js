import facilityInstance from "./utils/facilityInstance.js"
import facilitysessionController from "./controllers/facilitysessionController.js"
import playersController from "./controllers/playersController.js"
import gamesessionsController from "./controllers/gamesessionsController.js"
import teamsController from "./controllers/teamsController.js"
import rfidController from "./controllers/rfidControllers.js"
import scheduleNextSessionCheck from "./utils/scheduleNextCheck.js"

facilitysessionController.setFacilityInstance(facilityInstance)
playersController.setFacilityInstance(facilityInstance)
gamesessionsController.setFacilityInstance(facilityInstance)
teamsController.setFacilityInstance(facilityInstance)
rfidController.setFacilityInstance(facilityInstance)

scheduleNextSessionCheck(facilityInstance)