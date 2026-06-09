export function createCard(rank, suit) {
    const isRed = suit === 'H' || suit === 'D';
    let score = 0;

    if (rank === 'A') {
        score = isRed ? 20 : 5;
    } else if (isRed) {
        if (['9', '10', 'J', 'Q', 'K'].includes(rank)) {
            score = 10;
        } else {
            // 2, 3, 4, 5, 6, 7, 8
            score = parseInt(rank, 10);
        }
    }

    return {
        id: `${rank}${suit}`,
        rank: rank,
        suit: suit,
        isRed: isRed,
        score: score
    };
}
