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
        renderer.animateAndRender();
    });

    // Sidebar toggle behavior
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            document.body.classList.toggle('sidebar-open');
        });
    }

    // Desktop default open (>= 1200px)
    if (window.innerWidth >= 1200) {
        document.body.classList.add('sidebar-open');
    }
}

// Helper to check state origin
window.isServerAuthoritative = function() {
    return true; // GameState is now only provided by server
}

// Chạy tự động khi mở trang
init();
