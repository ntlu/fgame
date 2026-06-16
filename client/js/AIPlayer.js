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
            }, 2500); // Đợi 2.5s để đảm bảo animation của người trước đã chạy xong
        }
    }

    chooseMove() {
        // Lấy state THẬT từ store, vì gameState truyền từ onStateUpdate đã bị mock bài của AI để che UI
        const realGameState = this.gameStore.gameState;
        const myPlayer = realGameState.players[this.aiIndex];
        if (!myPlayer || myPlayer.hand.length === 0) return;

        let bestHandCardId = null;
        let bestTableCardId = null;

        // Ưu tiên:
        // 1. Dùng bài (đỏ/đen) để ăn bài Đỏ trên bàn
        // 2. Dùng bài (đỏ/đen) để ăn bài Đen trên bàn
        // 3. Đánh rác (chọn bài Đen đánh trước, giữ bài Đỏ lại)

        // Tìm tất cả các cơ hội ăn bài
        let captureOptions = [];
        for (let card of myPlayer.hand) {
            const capturable = RuleEngine.findCapturableCards(card, realGameState.tableCards);
            if (capturable && capturable.length > 0) {
                capturable.forEach(tCard => {
                    captureOptions.push({
                        handCard: card,
                        tableCard: tCard,
                        tableIsRed: (tCard.suit === 'H' || tCard.suit === 'D') ? 1 : 0
                    });
                });
            }
        }

        if (captureOptions.length > 0) {
            // Sắp xếp ưu tiên ăn bài Đỏ trước
            captureOptions.sort((a, b) => b.tableIsRed - a.tableIsRed);
            bestHandCardId = captureOptions[0].handCard.id;
            bestTableCardId = captureOptions[0].tableCard.id;
        } else {
            // Không ăn được, đánh rác. Ưu tiên đánh bài đen (giữ bài đỏ).
            let trashCards = [...myPlayer.hand].sort((a, b) => {
                const aIsRed = (a.suit === 'H' || a.suit === 'D') ? 1 : 0;
                const bIsRed = (b.suit === 'H' || b.suit === 'D') ? 1 : 0;
                return aIsRed - bIsRed; // Đen (0) lên trước Đỏ (1)
            });
            bestHandCardId = trashCards[0].id;
            bestTableCardId = null;
        }

        console.log(`[AI V1] Choosing to play handCard: ${bestHandCardId}, tableCard: ${bestTableCardId}`);
        this.gameStore.processTurn(this.aiIndex, bestHandCardId, bestTableCardId);
    }
}
