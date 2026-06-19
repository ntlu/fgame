import { createDeck, shuffleDeck } from './Deck.js';

export class GameManager {
    constructor(gameState) {
        this.gameState = gameState;
    }

    startNewRound() {
        this.gameState.resetForNewRound();
        
        // Dealer rotation based on total rounds played
        this.gameState.dealerIndex = (this.gameState.totalRoundsPlayed || 0) % this.gameState.modeConfig.players;
        this.gameState.currentPlayerIndex = this.gameState.dealerIndex;

        const colors = ['blue', 'gold', 'orange', 'gray'];
        this.gameState.cardBackColor = colors[Math.floor(Math.random() * colors.length)];

        this.dealCards();
    }

    createAndShuffleDeck() {
        let rawDeck = createDeck();
        
        // Validation: deck luôn đủ 52 lá, không trùng id
        if (rawDeck.length !== 52) {
            console.error("Validation Failed: Deck does not have exactly 52 cards.");
        }
        const uniqueIds = new Set(rawDeck.map(c => c.id));
        if (uniqueIds.size !== 52) {
            console.error("Validation Failed: Deck has duplicate IDs.");
        }

        return shuffleDeck(rawDeck);
    }

    dealCards() {
        this.gameState.deck = this.createAndShuffleDeck();
        
        // Deal cards to players
        const cardsPerPlayer = this.gameState.modeConfig.cardsPerPlayer;
        const playersCount = this.gameState.modeConfig.players;
        
        for(let i = 0; i < cardsPerPlayer; i++){
            for(let p = 0; p < playersCount; p++){
                this.gameState.players[p].hand.push(this.gameState.deck.pop());
            }
        }
        
        // Deal 12 cards to table
        for(let i = 0; i < 12; i++){
            this.gameState.tableCards.push(this.gameState.deck.pop());
        }

        // Deal Secret Card logic
        if (this.gameState.deck.length > 0) {
            const secretCard = this.gameState.deck.pop();
            this.gameState.secretCard = secretCard;
            this.gameState.secretCardOwner = (this.gameState.dealerIndex + playersCount - 1) % playersCount; // Rotate based on dealer
            this.gameState.secretCardRevealed = false;
            this.gameState.secretCardBonus = 0;
            
            // Put the secret card at the bottom of the deck/Que (index 0)
            this.gameState.deck.unshift(secretCard);
        }

        this.validateGameState();
    }

    validateGameState() {
        const totalCardsAfterDeal = this.gameState.deck.length + 
            this.gameState.tableCards.filter(c => c !== null).length + 
            this.gameState.players.reduce((sum, p) => sum + p.hand.length, 0);
        
        if (totalCardsAfterDeal !== 52) {
            console.error("Validation Failed: Total cards after dealing is not 52.");
        }
    }
}
