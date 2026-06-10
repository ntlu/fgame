export class NetworkManager {
    constructor(onStateUpdateCallback) {
        this.socket = io();
        this.connected = false;
        this.socketId = null;
        this.clientsCount = 0;
        this.lastSync = '---';
        this.localPlayerIndex = null;
        this.onStateUpdateCallback = onStateUpdateCallback;

        this.bindEvents();
    }

    bindEvents() {
        this.socket.on('connect', () => {
            this.connected = true;
            this.socketId = this.socket.id;
            this.updateUI();
            
            // YÊU CẦU 7: Request GameState on connect
            this.socket.emit('requestGameState');
        });

        this.socket.on('disconnect', () => {
            this.connected = false;
            this.socketId = null;
            this.localPlayerIndex = null; // Reset seat assignment on disconnect
            this.updateUI();
        });

        this.socket.on('clientCountUpdate', (count) => {
            this.clientsCount = count;
            this.updateUI();
        });

        this.socket.on('gameStateUpdate', (state) => {
            console.log('GameState Received:', state);
            const now = new Date();
            this.lastSync = now.toLocaleTimeString();
            
            if (this.onStateUpdateCallback) {
                this.onStateUpdateCallback(state);
            }
            this.updateUI();
        });

        this.socket.on('playerAssigned', (data) => {
            this.localPlayerIndex = data.playerIndex;
            console.log(`Assigned seat: Player ${this.localPlayerIndex + 1}`);
            this.updateUI();
            // Force re-render if state is available
            if (this.onStateUpdateCallback && window.currentGameState) {
                this.onStateUpdateCallback(window.currentGameState);
            }
        });

        this.socket.on('gameFull', () => {
            alert('Phòng đã đầy! Tất cả vị trí đã có người chơi.');
        });
        
        // Handle reset button
        const resetBtn = document.getElementById('reset-game-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.socket.emit('resetGame');
            });
        }

        // Handle join button
        const joinBtn = document.getElementById('join-game-btn');
        if (joinBtn) {
            joinBtn.addEventListener('click', () => {
                const nameInput = document.getElementById('player-name');
                const name = nameInput ? nameInput.value : '';
                this.socket.emit('joinGame', { name: name.trim() });
            });
        }
    }

    updateUI() {
        const panel = document.getElementById('connection-panel');
        if (!panel) return;

        const statusEl = document.getElementById('socket-status');
        const idEl = document.getElementById('socket-id');
        const clientsEl = document.getElementById('connected-clients');
        const syncEl = document.getElementById('last-sync');
        const seatEl = document.getElementById('local-player-seat');
        const joinSection = document.getElementById('join-section');
        const resetBtn = document.getElementById('reset-game-btn');

        if (this.connected) {
            statusEl.textContent = 'Đã kết nối';
            statusEl.className = 'status-connected';
            idEl.textContent = this.socketId;
            clientsEl.textContent = this.clientsCount;
        } else {
            statusEl.textContent = 'Mất kết nối';
            statusEl.className = 'status-disconnected';
            idEl.textContent = '---';
            clientsEl.textContent = '---';
        }
        
        if (syncEl) {
            syncEl.textContent = this.lastSync;
        }

        if (seatEl) {
            if (this.localPlayerIndex !== null && this.localPlayerIndex !== undefined) {
                const state = window.currentGameState;
                const isHost = state && state.hostPlayerIndex === this.localPlayerIndex;
                seatEl.textContent = `Người chơi ${this.localPlayerIndex + 1}${isHost ? ' (Chủ phòng)' : ''}`;
            } else {
                seatEl.textContent = 'Khán giả';
            }
        }

        if (joinSection) {
            if (this.localPlayerIndex !== null && this.localPlayerIndex !== undefined) {
                joinSection.style.display = 'none';
            } else {
                joinSection.style.display = 'flex';
            }
        }

        if (resetBtn) {
            const state = window.currentGameState;
            if (state && state.hostPlayerIndex !== null && state.hostPlayerIndex !== undefined) {
                if (this.localPlayerIndex === state.hostPlayerIndex) {
                    resetBtn.style.display = 'block';
                } else {
                    resetBtn.style.display = 'none';
                }
            } else {
                resetBtn.style.display = 'block';
            }
        }
    }
}
