export class GameState {
    constructor() {
        this.round = 1;
        this.dealerIndex = 0;
        this.currentPlayerIndex = 0;
        this.players = [
            { id: 1, hand: [], capturedCards: [], score: 0, name: 'Người chơi 1' },
            { id: 2, hand: [], capturedCards: [], score: 0, name: 'Người chơi 2' },
            { id: 3, hand: [], capturedCards: [], score: 0, name: 'Người chơi 3' },
            { id: 4, hand: [], capturedCards: [], score: 0, name: 'Người chơi 4' }
        ];
        this.tableCards = [];
        this.deck = [];
        
        // Server Authoritative logs & state
        this.logs = [];
        this.lastAction = "";
        this.roundResult = null;
        this.playerAssignments = {};
        this.hostPlayerIndex = null;
    }

    resetForNewRound() {
        this.players.forEach(p => {
            p.hand = [];
            p.capturedCards = [];
            p.score = 0;
        });
        this.tableCards = [];
        this.deck = [];
        this.logs = [];
        this.lastAction = "";
        this.roundResult = null;
    }
}
