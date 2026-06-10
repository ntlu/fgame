import { GameState } from '../shared/GameState.js';
import { GameManager } from '../shared/GameManager.js';
import { TurnEngine } from '../shared/TurnEngine.js';

class GameStateStore {
    constructor() {
        this.gameState = new GameState();
        this.gameState.version = 1;
        this.gameState.playerAssignments = {};
        this.gameManager = new GameManager(this.gameState);
        this.turnEngine = new TurnEngine(this.gameState);
        this.processingTurn = false;
        this.playerAssignments = {};
    }

    initializeGame() {
        this.gameManager.startNewRound();
    }

    resetGame() {
        const currentVersion = this.gameState.version || 1;
        const currentAssignments = this.gameState.playerAssignments || {};
        const currentHost = this.gameState.hostPlayerIndex;
        const preservedNames = this.gameState.players.map((p, idx) => p.name || `Người chơi ${idx + 1}`);

        this.gameManager.startNewRound();

        // Restore preserved names
        this.gameState.players.forEach((p, idx) => {
            p.name = preservedNames[idx];
        });

        this.gameState.version = currentVersion + 1;
        this.gameState.playerAssignments = currentAssignments;
        this.gameState.hostPlayerIndex = currentHost;
        this.gameState.roundResult = null;
        if (this.gameState.lastAction !== undefined) {
            this.gameState.lastAction = "";
        }
    }

    assignPlayer(socketId, name) {
        // If already assigned, return existing index
        if (socketId in this.playerAssignments) {
            return this.playerAssignments[socketId];
        }

        const assignedIndexes = Object.values(this.playerAssignments);
        for (let i = 0; i < 4; i++) {
            if (!assignedIndexes.includes(i)) {
                this.playerAssignments[socketId] = i;
                this.gameState.playerAssignments = { ...this.playerAssignments };
                
                const actualName = (name && name.trim()) ? name.trim() : `Người chơi ${i + 1}`;
                this.gameState.players[i].name = actualName;
                
                this.updateHostPlayerIndex();
                return i;
            }
        }
        return -1; // Full
    }

    removeAssignment(socketId) {
        if (socketId in this.playerAssignments) {
            const playerIndex = this.playerAssignments[socketId];
            delete this.playerAssignments[socketId];
            this.gameState.playerAssignments = { ...this.playerAssignments };
            
            if (this.gameState.players[playerIndex]) {
                this.gameState.players[playerIndex].name = `Người chơi ${playerIndex + 1}`;
            }
            
            this.updateHostPlayerIndex();
        }
    }

    updateHostPlayerIndex() {
        const assignedIndexes = Object.values(this.playerAssignments);
        if (assignedIndexes.length === 0) {
            this.gameState.hostPlayerIndex = null;
            return;
        }
        this.gameState.hostPlayerIndex = Math.min(...assignedIndexes);
    }

    isHost(socketId) {
        const playerIndex = this.getPlayerIndexBySocketId(socketId);
        if (playerIndex === undefined) {
            const assignedIndexes = Object.values(this.playerAssignments);
            return assignedIndexes.length === 0;
        }
        return playerIndex === this.gameState.hostPlayerIndex;
    }

    getPlayerIndexBySocketId(socketId) {
        return this.playerAssignments[socketId];
    }

    addLog(message) {
        if (!this.gameState.logs) {
            this.gameState.logs = [];
        }
        this.gameState.logs.push(message);
        if (this.gameState.logs.length > 50) {
            this.gameState.logs.shift();
        }
    }

    getState() {
        return this.gameState;
    }

    processTurn(handCardId, tableCardId) {
        if (this.processingTurn) {
            return false;
        }
        this.processingTurn = true;

        try {
            if (this.gameState.roundResult) return false; // Round finished

            const playerIndex = this.gameState.currentPlayerIndex;
            const player = this.gameState.players[playerIndex];

            // Validation: Check if handCard exists
            const handCardIndex = player.hand.findIndex(c => c.id === handCardId);
            if (handCardIndex === -1) {
                console.log(`[Validation Failed] Player ${player.id} does not have card ${handCardId}`);
                return false;
            }

            const tableCardIndex = tableCardId ? this.gameState.tableCards.findIndex(c => c.id === tableCardId) : null;

            // Process Play
            const playResult = this.turnEngine.processPlay(playerIndex, handCardIndex, tableCardIndex);
            
            const suitMap = { 'H': '♥', 'D': '♦', 'S': '♠', 'C': '♣' };
            const getCardStr = (c) => `${c.rank}${suitMap[c.suit]}`;
            const playerName = player.name || `Người chơi ${player.id}`;

            this.addLog(`${playerName} đã đánh ${getCardStr(playResult.playedCard)}`);
            if (playResult.captured) {
                this.addLog(`${playerName} ăn ${getCardStr(playResult.tableCard)}`);
                this.gameState.lastAction = `Đã đánh: ${getCardStr(playResult.playedCard)}\nĐã ăn: ${getCardStr(playResult.tableCard)}`;
            } else {
                this.addLog(`${playerName} không ăn bài`);
                this.gameState.lastAction = `Đã đánh: ${getCardStr(playResult.playedCard)}\nKhông ăn bài`;
            }

            // Process Draw
            const drawResult = this.turnEngine.processDraw(playerIndex);
            if (drawResult && drawResult.drawnCard) {
                this.addLog(`${playerName} bốc được ${getCardStr(drawResult.drawnCard)}`);
                if (drawResult.captured) {
                    this.addLog(`${playerName} tự động ăn ${getCardStr(drawResult.tableCard)}`);
                    this.gameState.lastAction += `\nBốc được: ${getCardStr(drawResult.drawnCard)}\nTự động ăn: ${getCardStr(drawResult.tableCard)}`;
                } else {
                    this.addLog(`${playerName} không ăn bài`);
                    this.gameState.lastAction += `\nBốc được: ${getCardStr(drawResult.drawnCard)}\nKhông ăn bài`;
                }
            }

            // Check Round End
            if (this.turnEngine.isRoundFinished()) {
                const scores = this.turnEngine.calculateRoundScores();
                const settlement = this.turnEngine.calculateSettlement();
                this.gameState.roundResult = { scores, settlement };
            } else {
                this.turnEngine.nextTurn();
            }

            this.gameState.version++;
            return true;
        } finally {
            this.processingTurn = false;
        }
    }
}

export const gameStateStore = new GameStateStore();
