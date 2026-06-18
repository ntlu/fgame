import { GameState } from '/shared/GameState.js';
import { GameManager } from '/shared/GameManager.js';
import { TurnEngine } from '/shared/TurnEngine.js';
import { RuleEngine } from '/shared/RuleEngine.js';
import { GameModes } from '/shared/config/GameModes.js';

export class OfflineGameStore {
    constructor(onStateUpdateCallback, modeId = 'OFFLINE_2') {
        const modeConfig = GameModes[modeId] || GameModes['OFFLINE_2'];
        this.gameState = new GameState(modeConfig);
        this.gameState.version = 1;
        this.gameManager = new GameManager(this.gameState);
        this.turnEngine = new TurnEngine(this.gameState);
        this.processingTurn = false;
        this.onStateUpdateCallback = onStateUpdateCallback;
        
        // Hardcode names
        this.gameState.players[0].name = "Current User"; // Will be updated
        this.gameState.players[1].name = "AI BOT";

        this.initializeGame();
    }

    setUserName(name) {
        this.gameState.players[0].name = name;
    }

    initializeGame() {
        this.gameManager.startNewRound();
        this.broadcastState();
    }

    resetGame() {
        this.gameState.version++;
        this.gameManager.startNewRound();
        this.broadcastState();
    }

    broadcastState() {
        if (this.onStateUpdateCallback) {
            // Filter state slightly if needed, but in offline we can just pass it
            const stateCopy = JSON.parse(JSON.stringify(this.gameState));
            
            if (stateCopy.deck) {
                stateCopy.deckRemaining = stateCopy.deck.length;
                delete stateCopy.deck;
            }

            // Hide all AI hands from User
            for (let i = 1; i < stateCopy.players.length; i++) {
                stateCopy.players[i].hand = Array.from({ length: stateCopy.players[i].hand.length }, () => ({}));
            }

            // Secret Card: AI is owner. Don't reveal to user.
            if (!stateCopy.secretCardRevealed && stateCopy.secretCardOwner !== 0 && stateCopy.secretCardOwner !== null) {
                stateCopy.secretCard = null;
            }

            this.onStateUpdateCallback(stateCopy);
        }
    }

    addLog(message) {
        if (!this.gameState.logs) this.gameState.logs = [];
        this.gameState.logs.push(message);
        if (this.gameState.logs.length > 50) this.gameState.logs.shift();
    }

    processTurn(playerIndex, handCardId, tableCardId) {
        if (this.processingTurn) return false;
        this.processingTurn = true;

        try {
            if (this.gameState.roundResult) return false;

            if (playerIndex !== this.gameState.currentPlayerIndex) return false;

            const player = this.gameState.players[playerIndex];
            const handCardIndex = player.hand.findIndex(c => c.id === handCardId);
            if (handCardIndex === -1) return false;

            const tableCardIndex = tableCardId ? this.gameState.tableCards.findIndex(c => c && c.id === tableCardId) : null;

            const playResult = this.turnEngine.processPlay(playerIndex, handCardIndex, tableCardIndex);
            
            const suitMap = { 'H': '♥', 'D': '♦', 'S': '♠', 'C': '♣' };
            const getCardStr = (c) => `${c.rank}${suitMap[c.suit]}`;
            const playerName = player.name;

            this.addLog(`${playerName} đã đánh ${getCardStr(playResult.playedCard)}`);
            if (playResult.captured) {
                const capturedCardsArr = Array.isArray(playResult.tableCard) ? playResult.tableCard : [playResult.tableCard];
                this.addLog(`${playerName} dùng ${getCardStr(playResult.playedCard)} ăn ${capturedCardsArr.map(getCardStr).join(', ')}`);
            } else {
                this.addLog(`${playerName} không ăn được.`);
            }

            const drawResult = this.turnEngine.processDraw(playerIndex);
            this.addLog(`${playerName} bốc nọc được ${getCardStr(drawResult.drawnCard)}`);
            if (drawResult.captured) {
                const capturedCardsArr = Array.isArray(drawResult.tableCard) ? drawResult.tableCard : [drawResult.tableCard];
                this.addLog(`${playerName} dùng ${getCardStr(drawResult.drawnCard)} ăn ${capturedCardsArr.map(getCardStr).join(', ')}`);
            } else {
                this.addLog(`${playerName} không ăn được bài nọc.`);
            }

            let actionText = `Đã đánh: ${getCardStr(playResult.playedCard)}\n`;
            if (playResult.captured) {
                const capturedCardsArr = Array.isArray(playResult.tableCard) ? playResult.tableCard : [playResult.tableCard];
                actionText += `Đã ăn: ${capturedCardsArr.map(getCardStr).join(', ')}\n`;
            } else {
                actionText += `Đã ăn: Không ăn bài\n`;
            }

            actionText += `Bốc được: ${getCardStr(drawResult.drawnCard)}\n`;
            if (drawResult.captured) {
                const capturedCardsArr = Array.isArray(drawResult.tableCard) ? drawResult.tableCard : [drawResult.tableCard];
                actionText += `Tự động ăn: ${capturedCardsArr.map(getCardStr).join(', ')}`;
            } else {
                actionText += `Tự động ăn: Không ăn bài`;
            }

            this.gameState.lastAction = actionText;

            if (this.turnEngine.isRoundFinished()) {
                this.addLog("--- VÁN BÀI KẾT THÚC ---");
                this.gameState.secretCardRevealed = true;
                
                const ownerIdx = this.gameState.secretCardOwner;
                
                // Sweep remaining table cards to secret card owner
                const remainingTableCards = this.gameState.tableCards.filter(c => c !== null);
                if (remainingTableCards.length > 0 && ownerIdx !== null && ownerIdx !== undefined) {
                    const owner = this.gameState.players[ownerIdx];
                    owner.capturedCards.push(...remainingTableCards);
                    owner.score = RuleEngine.calculatePlayerScore(owner.capturedCards);
                    
                    this.addLog(`[BÍ MẬT] Thu gom ${remainingTableCards.length} lá bài rác cuối ván cho người giữ Bí Mật`);
                    
                    // Clear table
                    this.gameState.tableCards = this.gameState.tableCards.map(c => null);
                }
                
                const cardScores = this.gameState.players.map(p => RuleEngine.calculatePlayerScore(p.capturedCards));
                const secretCard = this.gameState.secretCard;
                const bonus = secretCard ? RuleEngine.calculateCardScore(secretCard) : 0;
                
                const config = this.gameState.modeConfig;
                const playersCount = config.players;
                
                const adjustedScores = cardScores.map((score, idx) => {
                    if (ownerIdx === null || ownerIdx === undefined || bonus === 0) return score;
                    if (idx === ownerIdx) {
                        return score + bonus * (playersCount - 1);
                    } else {
                        return score - bonus;
                    }
                });

                const hasDouble = adjustedScores.some(score => score >= config.x2Threshold);
                if (this.gameState.totalRoundsPlayed === undefined) this.gameState.totalRoundsPlayed = 0;
                if (this.gameState.doubleRoundsCount === undefined) this.gameState.doubleRoundsCount = 0;

                this.gameState.totalRoundsPlayed++;
                if (hasDouble) this.gameState.doubleRoundsCount++;

                const multiplier = hasDouble ? 2 : 1;
                const settlement = cardScores.map((score, idx) => {
                    const baseProfit = score - config.breakEvenScore;
                    if (idx === ownerIdx) {
                        return (baseProfit + bonus * (playersCount - 1)) * multiplier;
                    } else {
                        return (baseProfit - bonus) * multiplier;
                    }
                });

                const moneyChange = settlement.map(s => s * 1000);
                this.gameState.players.forEach((p, idx) => {
                    if (p.money === undefined) p.money = 10000000;
                    p.money += moneyChange[idx];
                });

                this.gameState.roundResult = {
                    scores: cardScores,
                    settlement: settlement,
                    moneyChange: moneyChange,
                    secretCard: secretCard ? `${secretCard.rank}${secretCard.suit}` : null,
                    secretCardOwner: ownerIdx,
                    secretCardBonus: bonus
                };

                const secretCardStr = secretCard ? `${secretCard.rank}${suitMap[secretCard.suit]}` : 'Không';
                const ownerName = this.gameState.players[ownerIdx].name;
                this.addLog(`[BÍ MẬT] Lá bài Bí Mật cuối ván là ${secretCardStr} thuộc về ${ownerName} (Thưởng: +${bonus})`);

                this.gameState.players.forEach((p, idx) => {
                    if (p.accumulatedScore === undefined) p.accumulatedScore = 0;
                    p.accumulatedScore += settlement[idx];
                });
            } else {
                this.turnEngine.nextTurn();
            }
            this.gameState.version++;
            
            this.broadcastState();
            return true;
        } catch (error) {
            console.error("Lỗi khi xử lý lượt đi offline:", error);
            return false;
        } finally {
            this.processingTurn = false;
        }
    }
}
