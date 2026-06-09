import { createCard } from './Card.js';

export function createDeck() {
    const suits = ['H', 'D', 'S', 'C'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck = [];

    for (const suit of suits) {
        for (const rank of ranks) {
            deck.push(createCard(rank, suit));
        }
    }
    return deck;
}

export function shuffleDeck(deck) {
    // Fisher-Yates Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}
