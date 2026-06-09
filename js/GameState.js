export class GameState {
    constructor() {
        this.round = 1;
        this.dealerIndex = 0;
        this.currentPlayerIndex = 0;
        this.players = [
            { id: 1, hand: [], capturedCards: [], score: 0 },
            { id: 2, hand: [], capturedCards: [], score: 0 },
            { id: 3, hand: [], capturedCards: [], score: 0 },
            { id: 4, hand: [], capturedCards: [], score: 0 }
        ];
        this.tableCards = [];
        this.deck = [];
    }

    resetForNewRound() {
        this.players.forEach(p => {
            p.hand = [];
            p.capturedCards = [];
            p.score = 0;
        });
        this.tableCards = [];
        this.deck = [];
    }
}
