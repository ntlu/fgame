import { RuleEngine } from '/shared/RuleEngine.js';

export class AIPlayer {
    constructor(gameStore, aiIndex = 1) {
        this.gameStore = gameStore;
        this.aiIndex = aiIndex;
        this.turnTimeout = null;
    }

    onStateUpdate(gameState) {
        // Clear any existing timeout to avoid duplicate turns
        if (this.turnTimeout) {
            clearTimeout(this.turnTimeout);
            this.turnTimeout = null;
        }

        // If game is over, do nothing
        if (gameState.roundResult) return;

        // If it's my turn, schedule action
        if (gameState.currentPlayerIndex === this.aiIndex) {
            this.turnTimeout = setTimeout(() => {
                this.chooseMove();
            }, 800);
        }
    }

    chooseMove() {
        // Lấy state THẬT từ store, vì gameState truyền từ onStateUpdate đã bị mock bài của AI để che UI
        const realGameState = this.gameStore.gameState;
        const myPlayer = realGameState.players[this.aiIndex];
        if (!myPlayer || myPlayer.hand.length === 0) return;

        let bestHandCardId = null;
        let bestTableCardId = null;

        // Simple Heuristic: Eat if possible
        for (let card of myPlayer.hand) {
            const capturable = RuleEngine.findCapturableCards(card, realGameState.tableCards);
            if (capturable && capturable.length > 0) {
                bestHandCardId = card.id;
                // Just pick the first capturable card
                bestTableCardId = capturable[0].id;
                break;
            }
        }

        // If no capture possible, play a random card
        if (!bestHandCardId) {
            const randomIdx = Math.floor(Math.random() * myPlayer.hand.length);
            bestHandCardId = myPlayer.hand[randomIdx].id;
            bestTableCardId = null;
        }

        console.log(`[AI V1] Choosing to play handCard: ${bestHandCardId}, tableCard: ${bestTableCardId}`);
        this.gameStore.processTurn(this.aiIndex, bestHandCardId, bestTableCardId);
    }
}
