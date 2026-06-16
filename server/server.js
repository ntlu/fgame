import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { GameStateStore } from './GameStateStore.js';
import { GameModes } from '../shared/config/GameModes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

app.use(express.static(path.join(__dirname, '../client')));
app.use('/shared', express.static(path.join(__dirname, '../shared')));

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
const activeUsers = new Map(); // username -> socket.id

// Rooms Management
const rooms = new Map(); // roomId -> GameStateStore instance
const clientRoom = new Map(); // socket.id -> roomId

function getRoomStateStore(roomId) {
    return rooms.get(roomId);
}

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

    if (stateCopy.secretCardOwner !== undefined && stateCopy.secretCardOwner !== null) {
        if (!stateCopy.secretCardRevealed && stateCopy.secretCardOwner !== playerIndex) {
            stateCopy.secretCard = null;
        }
    }
    
    return stateCopy;
}

function broadcastGameState(roomId) {
    const store = getRoomStateStore(roomId);
    if (!store) return;
    io.sockets.sockets.forEach((socket) => {
        if (clientRoom.get(socket.id) === roomId) {
            const playerIndex = store.getPlayerIndexBySocketId(socket.id);
            const filteredState = getFilteredStateForPlayer(store.getState(), playerIndex);
            socket.emit('gameStateUpdate', filteredState);
        }
    });
}

io.on('connection', (socket) => {
    connectedClients++;
    console.log(`Kết nối mới từ client: ${socket.id}. Tổng số: ${connectedClients}`);

    io.emit('clientCountUpdate', connectedClients);

    socket.on('disconnect', () => {
        connectedClients--;
        console.log(`Client ngắt kết nối: ${socket.id}. Tổng số: ${connectedClients}`);
        
        for (const [username, id] of activeUsers.entries()) {
            if (id === socket.id) {
                activeUsers.delete(username);
                console.log(`Đã giải phóng user: ${username}`);
                break;
            }
        }

        const roomId = clientRoom.get(socket.id);
        if (roomId) {
            const store = getRoomStateStore(roomId);
            if (store) {
                store.removeAssignment(socket.id);
                clientRoom.delete(socket.id);
                socket.leave(roomId);
                
                // If room empty, delete it
                if (Object.keys(store.playerAssignments).length === 0) {
                    rooms.delete(roomId);
                    console.log(`Room ${roomId} deleted.`);
                } else {
                    broadcastGameState(roomId);
                }
            }
        }
        
        io.emit('clientCountUpdate', connectedClients);
    });

    socket.on('pingServer', () => {
        socket.emit('pongServer');
    });

    socket.on('requestGameState', () => {
        const roomId = clientRoom.get(socket.id);
        if (roomId) {
            const store = getRoomStateStore(roomId);
            if (store) {
                const playerIndex = store.getPlayerIndexBySocketId(socket.id);
                socket.emit('gameStateUpdate', getFilteredStateForPlayer(store.getState(), playerIndex));
            }
        }
    });

    socket.on('resetGame', () => {
        const roomId = clientRoom.get(socket.id);
        if (roomId) {
            const store = getRoomStateStore(roomId);
            if (store) {
                if (!store.isHost(socket.id)) {
                    console.log(`[Ủy quyền thất bại] Yêu cầu resetGame bị từ chối cho socket ${socket.id} (không phải chủ phòng)`);
                    return;
                }
                console.log(`Chủ phòng yêu cầu Đặt lại trò chơi: ${socket.id} trong phòng ${roomId}`);
                store.resetGame();
                broadcastGameState(roomId);
            }
        }
    });

    socket.on('joinGame', (data) => {
        const name = (data && typeof data.name === 'string') ? data.name : '';
        const modeId = (data && data.mode) ? data.mode : 'ONLINE_4';
        
        if (!name) {
            socket.emit('joinError', 'Tên đăng nhập không hợp lệ.');
            return;
        }

        if (activeUsers.has(name) && activeUsers.get(name) !== socket.id) {
            console.log(`[Đăng nhập trùng] User ${name} đang online.`);
            socket.emit('joinError', 'Tài khoản đang được sử dụng.');
            return;
        }

        activeUsers.set(name, socket.id);

        let roomIdToJoin = null;
        let targetStore = null;

        // Find available room for the requested mode
        for (const [rId, store] of rooms.entries()) {
            if (store.gameState.modeConfig.id === modeId && store.gameState.status === 'LOBBY') {
                if (Object.keys(store.playerAssignments).length < store.gameState.modeConfig.players) {
                    roomIdToJoin = rId;
                    targetStore = store;
                    break;
                }
            }
        }

        // If no available room found, create a new one
        if (!roomIdToJoin) {
            roomIdToJoin = `room_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            const modeConfig = GameModes[modeId] || GameModes['ONLINE_4'];
            targetStore = new GameStateStore(modeConfig);
            rooms.set(roomIdToJoin, targetStore);
            console.log(`Created new room ${roomIdToJoin} for mode ${modeId}`);
        }

        const playerIndex = targetStore.assignPlayer(socket.id, name);
        if (playerIndex === -1) {
            socket.emit('gameFull'); // should theoretically never happen now due to dynamic room creation, but fallback
            return;
        }

        clientRoom.set(socket.id, roomIdToJoin);
        socket.join(roomIdToJoin);

        console.log(`Đã gán người chơi: Socket ${socket.id} -> Ghế ${playerIndex} (Tên: ${name}) ở phòng ${roomIdToJoin}`);
        socket.emit('playerAssigned', { playerIndex });
        broadcastGameState(roomIdToJoin);
    });

    socket.on('playTurn', (data) => {
        console.log(`playTurn được yêu cầu bởi: ${socket.id}`, data);
        
        const roomId = clientRoom.get(socket.id);
        if (!roomId) return;
        
        const store = getRoomStateStore(roomId);
        if (!store) return;

        const playerIndex = store.getPlayerIndexBySocketId(socket.id);
        if (playerIndex === undefined || playerIndex !== store.gameState.currentPlayerIndex) {
            console.log(`[Xác thực thất bại] playTurn bị từ chối cho socket ${socket.id} (ghế ${playerIndex}). Lượt hiện tại là ${store.gameState.currentPlayerIndex}`);
            return;
        }

        const success = store.processTurn(data.selectedHandCardId, data.selectedTableCardId);
        if (success) {
            broadcastGameState(roomId);
        }
    });
});

setInterval(() => {
    for (const roomId of rooms.keys()) {
        broadcastGameState(roomId);
    }
}, 10000);

server.listen(PORT, () => {
    console.log(`\n--- Server Running ---`);
    console.log(`Local: http://localhost:${PORT}`);
    console.log(`LAN:   http://${getLocalIP()}:${PORT}`);
    console.log(`Use the LAN URL on mobile devices connected to the same WiFi.`);
    console.log(`----------------------\n`);
});
