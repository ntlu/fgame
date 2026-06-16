import { RuleEngine } from './RuleEngine.js';

export class TurnEngine {
    constructor(gameState) {
        this.gameState = gameState;
    }

    getCurrentPlayer() {
        return this.gameState.players[this.gameState.currentPlayerIndex];
    }

    playCard(playerIndex, handCardIndex) {
        const player = this.gameState.players[playerIndex];
        
        // Validation: chống crash ngầm
        if (handCardIndex < 0 || handCardIndex >= player.hand.length) {
            throw new Error("Invalid handCardIndex");
        }

        const playedCard = player.hand[handCardIndex];
        player.hand.splice(handCardIndex, 1);
        return playedCard;
    }

    captureCard(playedCard, tableCard) {
        return RuleEngine.canCapture(playedCard, tableCard);
    }

    validateCaptureSelection(playedCard, selectedTableCard) {
        if (!selectedTableCard) {
            return false;
        }
        const possibleCards = RuleEngine.findCapturableCards(playedCard, this.gameState.tableCards);
        return possibleCards.some(c => c.id === selectedTableCard.id);
    }

    processPlay(playerIndex, handCardIndex, selectedTableCardIndex = null) {
        const player = this.gameState.players[playerIndex];
        const playedCard = this.playCard(playerIndex, handCardIndex);

        if (selectedTableCardIndex !== null && selectedTableCardIndex >= 0 && selectedTableCardIndex < this.gameState.tableCards.length) {
            const tableCard = this.gameState.tableCards[selectedTableCardIndex];
            
            if (this.validateCaptureSelection(playedCard, tableCard) && this.captureCard(playedCard, tableCard)) {
                // CHECK FOR 3-MATCH ON TABLE (5, 10, J, Q, K)
                const autoCaptureRanks = ['5', '10', 'J', 'Q', 'K'];
                if (autoCaptureRanks.includes(playedCard.rank)) {
                    const matchingTableCards = this.gameState.tableCards.filter(c => c && c.rank === playedCard.rank);
                    if (matchingTableCards.length === 3) {
                        player.capturedCards.push(playedCard);
                        matchingTableCards.forEach(mc => {
                            const idx = this.gameState.tableCards.findIndex(c => c && c.id === mc.id);
                            this.gameState.tableCards[idx] = null;
                            player.capturedCards.push(mc);
                        });
                        player.score = RuleEngine.calculatePlayerScore(player.capturedCards);
                        return { playedCard, tableCard: matchingTableCards, captured: true };
                    }
                }

                this.gameState.tableCards[selectedTableCardIndex] = null;
                player.capturedCards.push(playedCard, tableCard);
                player.score = RuleEngine.calculatePlayerScore(player.capturedCards);
                return { playedCard, tableCard: [tableCard], captured: true };
            }
        }
        
        // Tự động ăn nếu user không chọn hoặc chọn sai lá bài
        const possibleCards = RuleEngine.findCapturableCards(playedCard, this.gameState.tableCards);
        if (possibleCards.length > 0) {
            // CHECK FOR 3-MATCH ON TABLE (5, 10, J, Q, K)
            const autoCaptureRanks = ['5', '10', 'J', 'Q', 'K'];
            if (autoCaptureRanks.includes(playedCard.rank)) {
                const matchingTableCards = this.gameState.tableCards.filter(c => c && c.rank === playedCard.rank);
                if (matchingTableCards.length === 3) {
                    player.capturedCards.push(playedCard);
                    matchingTableCards.forEach(mc => {
                        const idx = this.gameState.tableCards.findIndex(c => c && c.id === mc.id);
                        this.gameState.tableCards[idx] = null;
                        player.capturedCards.push(mc);
                    });
                    player.score = RuleEngine.calculatePlayerScore(player.capturedCards);
                    return { playedCard, tableCard: matchingTableCards, captured: true };
                }
            }

            // Auto capture highest score card
            possibleCards.sort((a, b) => {
                const scoreA = RuleEngine.calculateCardScore(a);
                const scoreB = RuleEngine.calculateCardScore(b);
                if (scoreA !== scoreB) return scoreB - scoreA;
                
                const aIsRed = (a.suit === 'H' || a.suit === 'D') ? 1 : 0;
                const bIsRed = (b.suit === 'H' || b.suit === 'D') ? 1 : 0;
                return bIsRed - aIsRed;
            });
            const tableCard = possibleCards[0];
            const autoTableCardIndex = this.gameState.tableCards.findIndex(c => c && c.id === tableCard.id);
            this.gameState.tableCards[autoTableCardIndex] = null;
            player.capturedCards.push(playedCard, tableCard);
            player.score = RuleEngine.calculatePlayerScore(player.capturedCards);
            return { playedCard, tableCard: [tableCard], captured: true };
        }

        // Không ăn được => đưa xuống bàn
        const emptyIndex = this.gameState.tableCards.indexOf(null);
        if (emptyIndex !== -1) {
            this.gameState.tableCards[emptyIndex] = playedCard;
        } else {
            this.gameState.tableCards.push(playedCard);
        }
        return { playedCard, tableCard: null, captured: false };
    }

    // Top deck = cuối mảng (sử dụng pop, không dùng shift)
    drawCard() {
        if (this.gameState.deck.length === 0) return null;
        return this.gameState.deck.pop();
    }

    processDraw(playerIndex) {
        const player = this.gameState.players[playerIndex];
        const drawnCard = this.drawCard();

        if (!drawnCard) return null;

        const possibleCards = RuleEngine.findCapturableCards(drawnCard, this.gameState.tableCards);
        
        if (possibleCards.length > 0) {
            // CHECK FOR 3-MATCH ON TABLE (5, 10, J, Q, K)
            const autoCaptureRanks = ['5', '10', 'J', 'Q', 'K'];
            if (autoCaptureRanks.includes(drawnCard.rank)) {
                const matchingTableCards = this.gameState.tableCards.filter(c => c && c.rank === drawnCard.rank);
                if (matchingTableCards.length === 3) {
                    player.capturedCards.push(drawnCard);
                    matchingTableCards.forEach(mc => {
                        const idx = this.gameState.tableCards.findIndex(c => c && c.id === mc.id);
                        this.gameState.tableCards[idx] = null;
                        player.capturedCards.push(mc);
                    });
                    player.score = RuleEngine.calculatePlayerScore(player.capturedCards);
                    return { drawnCard, tableCard: matchingTableCards, captured: true };
                }
            }

            // Auto capture highest score card
            possibleCards.sort((a, b) => {
                const scoreA = RuleEngine.calculateCardScore(a);
                const scoreB = RuleEngine.calculateCardScore(b);
                if (scoreA !== scoreB) return scoreB - scoreA;
                
                const aIsRed = (a.suit === 'H' || a.suit === 'D') ? 1 : 0;
                const bIsRed = (b.suit === 'H' || b.suit === 'D') ? 1 : 0;
                return bIsRed - aIsRed;
            });
            const tableCard = possibleCards[0];
            const tableCardIndex = this.gameState.tableCards.findIndex(c => c && c.id === tableCard.id);
            this.gameState.tableCards[tableCardIndex] = null;
            player.capturedCards.push(drawnCard, tableCard);
            player.score = RuleEngine.calculatePlayerScore(player.capturedCards);
            return { drawnCard, tableCard: [tableCard], captured: true };
        }

        // Không ăn được => đưa xuống bàn
        const emptyIndex = this.gameState.tableCards.indexOf(null);
        if (emptyIndex !== -1) {
            this.gameState.tableCards[emptyIndex] = drawnCard;
        } else {
            this.gameState.tableCards.push(drawnCard);
        }
        return { drawnCard, tableCard: null, captured: false };
    }

    nextTurn() {
        // Tương thích với số lượng player thay đổi (2, 3, 4)
        this.gameState.currentPlayerIndex = (this.gameState.currentPlayerIndex + 1) % this.gameState.players.length;
    }

    isRoundFinished() {
        return this.gameState.deck.length === 0 && 
               this.gameState.players.every(p => p.hand.length === 0);
    }

    calculateRoundScores() {
        return this.gameState.players.map(p => RuleEngine.calculatePlayerScore(p.capturedCards));
    }

    calculateSettlement() {
        const scores = this.calculateRoundScores();
        return RuleEngine.calculateSettlement(scores);
    }
}
