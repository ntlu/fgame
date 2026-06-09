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
            
            // Xác nhận lá trên bàn hợp lệ mới được ăn
            if (this.validateCaptureSelection(playedCard, tableCard) && this.captureCard(playedCard, tableCard)) {
                this.gameState.tableCards.splice(selectedTableCardIndex, 1);
                player.capturedCards.push(playedCard, tableCard);
                return { playedCard, tableCard, captured: true };
            }
        }
        
        // Không ăn được hoặc chọn sai => đưa xuống bàn
        this.gameState.tableCards.push(playedCard);
        return { playedCard, tableCard: null, captured: false };
    }

    // Top deck = cuối mảng (sử dụng pop, không dùng shift)
    drawCard() {
        if (this.gameState.deck.length === 0) return null;
        return this.gameState.deck.pop();
    }

    processDraw(playerIndex, selectedTableCardIndex = null) {
        const player = this.gameState.players[playerIndex];
        const drawnCard = this.drawCard();

        if (!drawnCard) return null;

        if (selectedTableCardIndex !== null && selectedTableCardIndex >= 0 && selectedTableCardIndex < this.gameState.tableCards.length) {
            const tableCard = this.gameState.tableCards[selectedTableCardIndex];
            
            // Xác nhận hợp lệ mới được ăn
            if (this.validateCaptureSelection(drawnCard, tableCard) && this.captureCard(drawnCard, tableCard)) {
                this.gameState.tableCards.splice(selectedTableCardIndex, 1);
                player.capturedCards.push(drawnCard, tableCard);
                return { drawnCard, tableCard, captured: true };
            }
        }

        // Không ăn được hoặc chọn sai => đưa xuống bàn
        this.gameState.tableCards.push(drawnCard);
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
