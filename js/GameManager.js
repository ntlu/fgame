import { createDeck, shuffleDeck } from './Deck.js';

export class GameManager {
    constructor(gameState) {
        this.gameState = gameState;
    }

    startNewRound() {
        this.gameState.resetForNewRound();
        
        // Dealer rotation: Round 1 -> P1 (index 0), Round 2 -> P2 (index 1), v.v.
        this.gameState.dealerIndex = (this.gameState.round - 1) % 4;
        this.gameState.currentPlayerIndex = this.gameState.dealerIndex;

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
        
        // Deal 5 cards to 4 players
        for(let i = 0; i < 5; i++){
            for(let p = 0; p < 4; p++){
                this.gameState.players[p].hand.push(this.gameState.deck.pop());
            }
        }
        
        // Deal 12 cards to table
        for(let i = 0; i < 12; i++){
            this.gameState.tableCards.push(this.gameState.deck.pop());
        }

        this.validateGameState();
    }

    validateGameState() {
        const totalCardsAfterDeal = this.gameState.deck.length + 
            this.gameState.tableCards.length + 
            this.gameState.players.reduce((sum, p) => sum + p.hand.length, 0);
        
        if (totalCardsAfterDeal !== 52) {
            console.error("Validation Failed: Total cards after dealing is not 52.");
        }
    }
}
