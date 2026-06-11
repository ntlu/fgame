import { CARD_VALUES } from './constants.js';

export class RuleEngine {

    // YÊU CẦU 2: canCapture
    static canCapture(cardA, cardB) {
        if (!cardA || !cardB) return false;
        const rankA = cardA.rank || cardA;
        const rankB = cardB.rank || cardB;

        // 10, J, Q, K chỉ ăn chính nó
        const faceCards = ['10', 'J', 'Q', 'K'];
        if (faceCards.includes(rankA) || faceCards.includes(rankB)) {
            return rankA === rankB;
        }

        // Các lá còn lại (A=1, 2-9) ăn nhau nếu tổng bằng 10
        const valA = CARD_VALUES[rankA];
        const valB = CARD_VALUES[rankB];

        if (valA && valB && valA < 10 && valB < 10) {
            return valA + valB === 10;
        }

        return false;
    }

    // YÊU CẦU 3: findCapturableCards
    static findCapturableCards(playedCard, tableCards) {
        return tableCards.filter(tableCard => tableCard && this.canCapture(playedCard, tableCard));
    }

    // YÊU CẦU 4: calculateCardScore
    static calculateCardScore(card) {
        const isRed = card.suit === 'H' || card.suit === 'D';

        if (card.rank === 'A') {
            return isRed ? 20 : 5;
        }

        if (!isRed) {
            return 0; // Các lá đen còn lại = 0
        }

        // Các lá đỏ còn lại (2-K)
        const val = CARD_VALUES[card.rank];
        if (val >= 9 && val <= 13) {
            return 10; // 9 đỏ, 10 đỏ, J đỏ, Q đỏ, K đỏ = 10
        }

        return val; // 2, 3, 4, 5, 6, 7, 8 đỏ = 2-8
    }

    // YÊU CẦU 5: calculatePlayerScore
    static calculatePlayerScore(capturedCards) {
        return capturedCards.reduce((total, card) => total + this.calculateCardScore(card), 0);
    }

    // YÊU CẦU 6: calculateProfit
    static calculateProfit(score) {
        const BASE_SCORE = 55;
        return score - BASE_SCORE;
    }

    // YÊU CẦU 7: hasDoubleCondition
    static hasDoubleCondition(score) {
        return this.calculateProfit(score) > 35;
    }

    // YÊU CẦU 8: calculateSettlement
    static calculateSettlement(scores) {
        const hasDouble = scores.some(score => this.hasDoubleCondition(score));
        const multiplier = hasDouble ? 2 : 1;

        return scores.map(score => this.calculateProfit(score) * multiplier);
    }
}
