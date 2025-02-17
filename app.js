const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

class Socket {
    constructor (page, port) {
        this.page = page
        this.port = port
        this.socket
        this.clients
        this.init()
    }

    init () {
        this.socket = new WebSocket.Server({ port: this.port, host: 'localhost' });
        this.clients = new Set();

        this.socket.on('connection', (client, request) => {
            this.clients.add(client);
            client.clientIp = request.connection.remoteAddress;
            client.userAgent = request.headers['user-agent'];
            console.log('New client connected on the webSocket for ' + this.page + '. clientIp: ' + client.clientIp + ' browser: ' + client.userAgent);
            this.broadcastMessage('A new client has connected on the webSocket for ' + this.page + ' (), total clients: ' + this.clients.size);

            // Remove the client from the set when they close the connection
            client.on('close', () => {
                console.log('Client disconnected');
                this.clients.delete(client);
                this.broadcastMessage('A client has disconnected from the webSocket for ' + this.page + ', total clients: ' + this.clients.size);
            });

            // Handle incoming messages from the client
            client.on('message', message => {
                console.log('Socket for ' + this.page + ' received message from client: ', message.toString());
            });
        });

        console.log('WebSocket for ' + this.page + ' is running on port ' + this.port);
    }

    broadcastMessage(message){
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }
}

class Facility {
    constructor() {
        this.init()
        this.socketForMonitor = new Socket('monitor', 8080)
        this.socketForBooth = new Socket('booth', 8081)
        this.socketForGameScreen = new Socket('game-screen', 8082)
        this.socketForRoomScreen = new Socket('room-screen', 8083)
        this.socketForDoorScreen = new Socket('door-screen', 8084)
    }

    init() {
        this.startServer();
    }

    startServer () {
        // Prepare server
        this.server = express();
        const serverPort = 3001;
        const serverHostname = 'localhost';
    
        // Middleware to set no-cache headers for all routes
        this.server.use((req, res, next) => {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('Surrogate-Control', 'no-store');
            next();
        });
    
        this.server.use(express.json());
        this.server.use(cors());
        this.server.use(express.static(path.join(__dirname, './assets')));

        // WebSockets
        this.server.get('/', (req, res) => {
            res.send('<html><body><h1>Hello</h1></body></html>');
        });
    
        this.server.get('/monitor', (req, res) => {
            res.send('<html><body><h1>Hello Monitor</h1></body></html>');
        });
    
        this.server.get('/booth/:booth_id', (req, res) => {
            res.send(`<html><body><h1>Hello Booth ${req.params.booth_id}</h1></body></html>`);
        });
    
        this.server.get('/game-screen/:gra_id', (req, res) => {
            res.send(`<html><body><h1>Hello game-screen ${req.params.gra_id}</h1></body></html>`);
        });
    
        this.server.get('/room-screen/:gra_id', (req, res) => {
            res.send(`<html><body><h1>Hello room-screen ${req.params.gra_id}</h1></body></html>`);
        });
    
        this.server.get('/door-screen/:gra_id', (req, res) => {
            res.send(`<html><body><h1>Hello door-screen ${req.params.gra_id} </h1></body></html>`);
        });

        // API routes
        this.server.use('/api/players', require('./routes/players'))
        this.server.use('/api/teams', require('./routes/teams'))
        this.server.use('/api/images', require('./routes/images'))
        this.server.use('/api/game-room', require('./routes/game-room'))
        this.server.use('/api/game-sessions', require('./routes/game-sessions'))
        this.server.use('/api/rfid', require('./routes/rfid'))
        this.server.use('/api/facility-session', require('./routes/facility-session')) 
    
        // Start server
        this.server.listen(serverPort, serverHostname, () => {
            console.log(`Server running at http://${serverHostname}:${serverPort}/`);
            console.log(`Monitor running at http://${serverHostname}:${serverPort}/monitor`);
            console.log(`Booth running at http://${serverHostname}:${serverPort}/booth/:booth_id`);
            console.log(`Game-screen running at http://${serverHostname}:${serverPort}/game-screen/:gra_id`);
            console.log(`Room-screen running at http://${serverHostname}:${serverPort}/room-screen/:gra_id`);
            console.log(`Door-screen running at http://${serverHostname}:${serverPort}/door-screen/:gra_id`);
        });
    }
}

new Facility()