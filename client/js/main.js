import { UIState } from './UIState.js';
import { Renderer } from './Renderer.js';
import { TurnEngine } from '/shared/TurnEngine.js';
import { NetworkManager } from './network.js';
import { AuthManager } from './AuthManager.js';
import { OfflineGameStore } from './OfflineGameStore.js';
import { AIPlayer } from './AIPlayer.js';

let currentGameState = null;
let turnEngine = null;
let renderer = null;
let network = null;
let offlineStore = null;
let aiPlayer = null;

function init() {
    const loginScreen = document.getElementById('login-screen');
    const modeScreen = document.getElementById('mode-screen');
    const gameScreen = document.getElementById('game-screen');

    function showScreen(screenId) {
        loginScreen.style.display = 'none';
        modeScreen.style.display = 'none';
        gameScreen.style.display = 'none';
        document.body.classList.remove('sidebar-open');
        
        const target = document.getElementById(screenId);
        if (target) {
            target.style.display = '';
        }
        
        if (screenId === 'game-screen' && window.innerWidth >= 1200) {
            document.body.classList.add('sidebar-open');
        }
    }

    const currentUser = AuthManager.getCurrentUser();
    if (currentUser) {
        setupModeScreen(currentUser);
        showScreen('mode-screen');
    } else {
        showScreen('login-screen');
    }

    const loginBtn = document.getElementById('login-submit-btn');
    const accessInput = document.getElementById('access-code-input');
    const loginError = document.getElementById('login-error');

    function handleLogin() {
        const code = accessInput.value.trim();
        const user = AuthManager.login(code);
        if (user) {
            loginError.style.display = 'none';
            setupModeScreen(user);
            showScreen('mode-screen');
        } else {
            loginError.style.display = 'block';
        }
    }

    if (loginBtn) loginBtn.addEventListener('click', handleLogin);
    if (accessInput) accessInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });

    function setupModeScreen(user) {
        const greeting = document.getElementById('greeting-username');
        if (greeting) greeting.textContent = user.username;
        
        const userInfoPanel = document.getElementById('user-info-panel');
        const currUserEl = document.getElementById('current-username');
        if (currUserEl) currUserEl.textContent = user.username;
        if (userInfoPanel) userInfoPanel.style.display = 'flex';
    }

    const modeOnline4 = document.getElementById('mode-online-4');
    if (modeOnline4) {
        modeOnline4.addEventListener('click', () => {
            const user = AuthManager.getCurrentUser();
            if(!user) return;
            
            showScreen('game-screen');
            startGameClient(user);
        });
    }

    const modeOffline2 = document.getElementById('mode-offline-2');
    if (modeOffline2) {
        modeOffline2.addEventListener('click', () => {
            const user = AuthManager.getCurrentUser();
            if(!user) return;
            
            showScreen('game-screen');
            startOfflineGame(user);
        });
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            AuthManager.logout();
            if (network) {
                network.socket.disconnect();
            }
            window.location.reload();
        });
    }

    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            document.body.classList.toggle('sidebar-open');
        });
    }
}

function startGameClient(user) {
    if (network) return;

    const uiState = new UIState();
    
    network = new NetworkManager((serverState) => {
        currentGameState = structuredClone(serverState);
        window.currentGameState = currentGameState;
        
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
        
        uiState.clearSelection(); 
        renderer.animateAndRender();
    });

    network.connect(user.username);
}

class OfflineNetworkMock {
    constructor() {
        this.localPlayerIndex = 0;
        this.socket = {
            emit: (event, data) => {
                if (event === 'playTurn') {
                    offlineStore.processTurn(0, data.selectedHandCardId, data.selectedTableCardId);
                } else if (event === 'resetGame') {
                    offlineStore.resetGame();
                }
            }
        };
    }
}

function startOfflineGame(user) {
    if (offlineStore) return;

    const uiState = new UIState();
    
    offlineStore = new OfflineGameStore((localState) => {
        currentGameState = structuredClone(localState);
        window.currentGameState = currentGameState;
        
        if (!turnEngine) {
            turnEngine = new TurnEngine(currentGameState);
        } else {
            turnEngine.gameState = currentGameState;
        }

        if (!renderer) {
            const mockNetwork = new OfflineNetworkMock();
            renderer = new Renderer(currentGameState, uiState, turnEngine, mockNetwork);
        } else {
            renderer.gameState = currentGameState;
        }
        
        uiState.clearSelection(); 
        renderer.animateAndRender();

        if (aiPlayer) {
            aiPlayer.onStateUpdate(currentGameState);
        }
    });

    offlineStore.setUserName(user.username);
    
    const onlineDetails = document.getElementById('online-details');
    const offlineDetails = document.getElementById('offline-details');
    if (onlineDetails) onlineDetails.style.display = 'none';
    if (offlineDetails) {
        offlineDetails.style.display = 'block';
        const offlineUser = document.getElementById('offline-user');
        if (offlineUser) offlineUser.textContent = user.username;
    }

    // Create AI (Player Index 1)
    aiPlayer = new AIPlayer(offlineStore, 1);
    
    offlineStore.broadcastState();
}

window.isServerAuthoritative = function() {
    return true; 
}

init();

