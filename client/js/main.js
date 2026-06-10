import { UIState } from './UIState.js';
import { Renderer } from './Renderer.js';
import { TurnEngine } from '/shared/TurnEngine.js';
import { NetworkManager } from './network.js';

let currentGameState = null;
let turnEngine = null;
let renderer = null;

function init() {
    const uiState = new UIState();
    
    // Khởi tạo Network Manager (Socket.IO)
    const network = new NetworkManager((serverState) => {
        currentGameState = structuredClone(serverState);
        window.currentGameState = currentGameState;
        
        // Khởi tạo TurnEngine và Renderer nếu chưa có
        if (!turnEngine) {
            turnEngine = new TurnEngine(currentGameState);
        } else {
            turnEngine.gameState = currentGameState;
        }

        if (!renderer) {
            renderer = new Renderer(currentGameState, uiState, turnEngine, network);
        } else {
            renderer.gameState = currentGameState;
        }
        
        uiState.clearSelection(); // Clear UI selection whenever server state is received
        renderer.render();
    });
}

// Helper to check state origin
window.isServerAuthoritative = function() {
    return true; // GameState is now only provided by server
}

// Chạy tự động khi mở trang
init();
