import { RuleEngine } from './RuleEngine.js';

export class AIEngine {
    static simulateSingleTurn(turnEngine) {
        const suitMap = { 'H': '♥', 'D': '♦', 'S': '♠', 'C': '♣' };
        const getStr = (c) => `${c.rank}${suitMap[c.suit]}`;

        const player = turnEngine.getCurrentPlayer();
        const playerIndex = turnEngine.gameState.currentPlayerIndex;
        
        console.log("===== TURN =====");
        console.log(`Current Player:\nPlayer ${player.id}`);
        
        let handCardIndex = 0;
        let tableCardIndexPlay = null;
        
        for (let i = 0; i < player.hand.length; i++) {
            const possibleCaptures = RuleEngine.findCapturableCards(player.hand[i], turnEngine.gameState.tableCards);
            if (possibleCaptures.length > 0) {
                handCardIndex = i;
                tableCardIndexPlay = turnEngine.gameState.tableCards.findIndex(c => c.id === possibleCaptures[0].id);
                break;
            }
        }
        
        const playResult = turnEngine.processPlay(playerIndex, handCardIndex, tableCardIndexPlay);
        console.log(`Played:\n${getStr(playResult.playedCard)}`);
        if (playResult.captured) {
            console.log(`Captured:\n${getStr(playResult.tableCard)}`);
        } else {
            console.log("No Capture");
        }
        
        const topDeck = turnEngine.gameState.deck[turnEngine.gameState.deck.length - 1];
        let tableCardIndexDraw = null;
        if (topDeck) {
             const possibleDrawCaptures = RuleEngine.findCapturableCards(topDeck, turnEngine.gameState.tableCards);
             if (possibleDrawCaptures.length > 0) {
                 tableCardIndexDraw = turnEngine.gameState.tableCards.findIndex(c => c.id === possibleDrawCaptures[0].id);
             }
        }

        const drawResult = turnEngine.processDraw(playerIndex, tableCardIndexDraw);
        if (drawResult) {
            console.log(`Draw:\n${getStr(drawResult.drawnCard)}`);
            if (drawResult.captured) {
                console.log(`Captured:\n${getStr(drawResult.tableCard)}`);
            } else {
                console.log("No Capture");
            }
        }

        turnEngine.nextTurn();
        console.log(`Next Turn:\nPlayer ${turnEngine.gameState.players[turnEngine.gameState.currentPlayerIndex].id}`);
    }
}
