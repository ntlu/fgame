export class GameState {
    constructor(modeConfig) {
        // Fallback to ONLINE_4 if no config provided (for backward compatibility)
        this.modeConfig = modeConfig || {
            id: 'ONLINE_4',
            name: 'Online 4 Người',
            players: 4,
            cardsPerPlayer: 5,
            breakEvenScore: 55,
            x2Threshold: 90
        };

        this.round = 1;
        this.dealerIndex = 0;
        this.currentPlayerIndex = 0;
        
        this.players = [];
        for (let i = 0; i < this.modeConfig.players; i++) {
            this.players.push({ 
                id: i + 1, 
                hand: [], 
                capturedCards: [], 
                score: 0, 
                name: `Người chơi ${i + 1}`, 
                accumulatedScore: 0, 
                money: 10000000 
            });
        }
        this.tableCards = [];
        this.deck = [];
        
        // Server Authoritative logs & state
        this.logs = [];
        this.lastAction = "";
        this.roundResult = null;
        this.playerAssignments = {};
        this.hostPlayerIndex = null;
        this.totalRoundsPlayed = 0;
        this.doubleRoundsCount = 0;
        this.secretCard = null;
        this.secretCardOwner = null;
        this.secretCardRevealed = false;
        this.secretCardBonus = 0;
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
        this.secretCard = null;
        this.secretCardOwner = null;
        this.secretCardRevealed = false;
        this.secretCardBonus = 0;
    }
}
