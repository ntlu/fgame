import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { gameStateStore } from './GameStateStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

// Serve client files
app.use(express.static(path.join(__dirname, '../client')));

// Serve shared files
app.use('/shared', express.static(path.join(__dirname, '../shared')));

// Helper to get local IP
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
        const iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            const alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                return alias.address;
            }
        }
    }
    return '127.0.0.1';
}

let connectedClients = 0;

// Initialize Server GameState
gameStateStore.initializeGame();

function getFilteredStateForPlayer(gameState, playerIndex) {
    const stateCopy = JSON.parse(JSON.stringify(gameState));
    
    if (stateCopy.deck) {
        stateCopy.deckRemaining = stateCopy.deck.length;
        delete stateCopy.deck;
    }
    
    if (stateCopy.players) {
        stateCopy.players = stateCopy.players.map((player, idx) => {
            if (idx === playerIndex) {
                return player;
            } else {
                return {
                    ...player,
                    hand: Array.from({ length: player.hand.length }, () => ({}))
                };
            }
        });
    }
    
    return stateCopy;
}

function broadcastGameState() {
    io.sockets.sockets.forEach((socket) => {
        const playerIndex = gameStateStore.getPlayerIndexBySocketId(socket.id);
        const filteredState = getFilteredStateForPlayer(gameStateStore.getState(), playerIndex);
        socket.emit('gameStateUpdate', filteredState);
    });
}

io.on('connection', (socket) => {
    connectedClients++;
    console.log(`Kết nối mới từ client: ${socket.id}. Tổng số: ${connectedClients}`);

    // Update client count to everyone
    io.emit('clientCountUpdate', connectedClients);

    socket.on('disconnect', () => {
        connectedClients--;
        console.log(`Client ngắt kết nối: ${socket.id}. Tổng số: ${connectedClients}`);
        
        // Release seat assignment
        gameStateStore.removeAssignment(socket.id);
        
        io.emit('clientCountUpdate', connectedClients);
        broadcastGameState();
    });

    // Ping/Pong Test
    socket.on('pingServer', () => {
        socket.emit('pongServer');
    });

    // Milestone 7B specific events
    socket.on('requestGameState', () => {
        const playerIndex = gameStateStore.getPlayerIndexBySocketId(socket.id);
        socket.emit('gameStateUpdate', getFilteredStateForPlayer(gameStateStore.getState(), playerIndex));
    });

    socket.on('resetGame', () => {
        if (!gameStateStore.isHost(socket.id)) {
            console.log(`[Ủy quyền thất bại] Yêu cầu resetGame bị từ chối cho socket ${socket.id} (không phải chủ phòng)`);
            return;
        }
        console.log(`Chủ phòng yêu cầu Đặt lại trò chơi: ${socket.id}`);
        gameStateStore.resetGame();
        broadcastGameState();
    });

    // Milestone 7D specific events
    socket.on('joinGame', (data) => {
        const name = (data && typeof data.name === 'string') ? data.name : '';
        const playerIndex = gameStateStore.assignPlayer(socket.id, name);
        if (playerIndex === -1) {
            socket.emit('gameFull');
            return;
        }
        console.log(`Đã gán người chơi: Socket ${socket.id} -> Ghế ${playerIndex} (Tên: ${name || 'Người chơi ' + (playerIndex + 1)})`);
        socket.emit('playerAssigned', { playerIndex });
        broadcastGameState();
    });

    // Milestone 7C specific events
    socket.on('playTurn', (data) => {
        console.log(`playTurn được yêu cầu bởi: ${socket.id}`, data);
        
        // Turn Validation: check if socket matches currentPlayerIndex
        const playerIndex = gameStateStore.getPlayerIndexBySocketId(socket.id);
        if (playerIndex === undefined || playerIndex !== gameStateStore.gameState.currentPlayerIndex) {
            console.log(`[Xác thực thất bại] playTurn bị từ chối cho socket ${socket.id} (ghế ${playerIndex}). Lượt hiện tại là ${gameStateStore.gameState.currentPlayerIndex}`);
            return;
        }

        const success = gameStateStore.processTurn(data.selectedHandCardId, data.selectedTableCardId);
        if (success) {
            broadcastGameState();
        }
    });
});

// Periodic sync every 10s
setInterval(() => {
    broadcastGameState();
}, 10000);

server.listen(PORT, () => {
    console.log(`\n--- Server Running ---`);
    console.log(`Local: http://localhost:${PORT}`);
    console.log(`LAN:   http://${getLocalIP()}:${PORT}`);
    console.log(`Use the LAN URL on mobile devices connected to the same WiFi.`);
    console.log(`----------------------\n`);
});
