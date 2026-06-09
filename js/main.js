import { GameState } from './GameState.js';
import { GameManager } from './GameManager.js';
import { UIState } from './UIState.js';
import { Renderer } from './Renderer.js';
import { TurnEngine } from './TurnEngine.js';

function init() {
    const gameState = new GameState();
    const gameManager = new GameManager(gameState);
    const uiState = new UIState();
    const turnEngine = new TurnEngine(gameState);
    
    // Khởi tạo và chia bài
    gameManager.startNewRound();

    // Khởi tạo Renderer và gọi render
    const renderer = new Renderer(gameState, uiState, turnEngine);
    renderer.render();

    // Tiếp tục in log cho các console tests
    console.log("===== GAME STATE =====");
    console.log(`Round: ${gameState.round}`);
    console.log("");
    console.log(`Dealer:\nPlayer ${gameState.players[gameState.dealerIndex].id}`);
    console.log("");
    console.log(`Current Turn:\nPlayer ${gameState.players[gameState.currentPlayerIndex].id}`);
    console.log("");
    
    for (const player of gameState.players) {
        console.log(`Player ${player.id}:\n${player.hand.length} cards`);
        console.log("");
    }

    console.log(`Table:\n${gameState.tableCards.length} cards`);
    console.log("");
    console.log(`Deck:\n${gameState.deck.length} cards`);
    console.log("");
    
    let totalCards = gameState.deck.length + gameState.tableCards.length + gameState.players.reduce((sum, p) => sum + p.hand.length, 0);
    console.log(`Total:\n${totalCards} cards`);
}

// Chạy tự động khi mở trang
init();
