import { GameState } from '../shared/GameState.js';
import { GameManager } from '../shared/GameManager.js';
import { TurnEngine } from '../shared/TurnEngine.js';
import { RuleEngine } from '../shared/RuleEngine.js';

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
        const preservedAccumulatedScores = this.gameState.players.map(p => p.accumulatedScore || 0);
        const preservedTotalRoundsPlayed = this.gameState.totalRoundsPlayed || 0;
        const preservedDoubleRoundsCount = this.gameState.doubleRoundsCount || 0;
        const preservedMoney = this.gameState.players.map(p => p.money !== undefined ? p.money : 10000000);

        // Increment round
        this.gameState.round++;

        this.gameManager.startNewRound();

        // Restore preserved names & accumulated stats
        this.gameState.players.forEach((p, idx) => {
            p.name = preservedNames[idx];
            p.accumulatedScore = preservedAccumulatedScores[idx];
            p.money = preservedMoney[idx];
        });
        this.gameState.totalRoundsPlayed = preservedTotalRoundsPlayed;
        this.gameState.doubleRoundsCount = preservedDoubleRoundsCount;

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
                
                if (this.gameState.players[i].money === undefined || this.gameState.players[i].money === null) {
                    this.gameState.players[i].money = 10000000;
                }
                
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

    calculateSecretCardBonus(card) {
        if (!card || !card.isRed) return 0;
        const rank = card.rank;
        if (rank === 'A') return 20;
        if (['9', '10', 'J', 'Q', 'K'].includes(rank)) return 10;
        const val = parseInt(rank, 10);
        if (!isNaN(val) && val >= 2 && val <= 8) return val;
        return 0;
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
                this.gameState.secretCardRevealed = true;
                
                const cardScores = this.turnEngine.calculateRoundScores();
                const ownerIdx = this.gameState.secretCardOwner;
                const secretCard = this.gameState.secretCard;
                const bonus = this.calculateSecretCardBonus(secretCard);
                this.gameState.secretCardBonus = bonus;

                // 1. Calculate adjusted scores for double/X2 check
                const adjustedScores = [...cardScores];
                if (ownerIdx !== null && ownerIdx !== undefined) {
                    adjustedScores[ownerIdx] += bonus;
                }

                // 2. Check double condition on adjusted score (>= 90 points triggers X2)
                const hasDouble = adjustedScores.some(score => score >= 90);
                if (this.gameState.totalRoundsPlayed === undefined) this.gameState.totalRoundsPlayed = 0;
                if (this.gameState.doubleRoundsCount === undefined) this.gameState.doubleRoundsCount = 0;

                this.gameState.totalRoundsPlayed++;
                if (hasDouble) {
                    this.gameState.doubleRoundsCount++;
                }

                // 3. Zero-sum Settlement with multiplier
                const multiplier = hasDouble ? 2 : 1;
                const settlement = adjustedScores.map((score, idx) => {
                    const baseProfit = score - 55;
                    if (idx === ownerIdx) {
                        return (baseProfit + bonus * 2) * multiplier;
                    } else {
                        return (baseProfit - bonus) * multiplier;
                    }
                });

                // Calculate moneyChange: 1 point = 1,000 VNĐ
                const moneyChange = settlement.map(s => s * 1000);

                // Apply money changes to players
                this.gameState.players.forEach((p, idx) => {
                    if (p.money === undefined) p.money = 10000000;
                    p.money += moneyChange[idx];
                });

                // 4. Save detailed roundResult
                this.gameState.roundResult = {
                    scores: cardScores, // card scores
                    settlement: settlement,
                    moneyChange: moneyChange,
                    secretCard: secretCard ? `${secretCard.rank}${secretCard.suit}` : null,
                    secretCardOwner: ownerIdx,
                    secretCardBonus: bonus
                };

                // 5. Log end of round reveal
                const suitMap = { 'H': '♥', 'D': '♦', 'S': '♠', 'C': '♣' };
                const secretCardStr = secretCard ? `${secretCard.rank}${suitMap[secretCard.suit]}` : 'Không';
                const ownerName = this.gameState.players[ownerIdx]?.name || `Người chơi ${ownerIdx + 1}`;
                this.addLog(`[BÍ MẬT] Lá bài Bí Mật cuối ván là ${secretCardStr} thuộc về ${ownerName} (Thưởng: +${bonus})`);

                // 6. Accumulate player scores
                this.gameState.players.forEach((p, idx) => {
                    if (p.accumulatedScore === undefined) p.accumulatedScore = 0;
                    p.accumulatedScore += settlement[idx];
                });
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
