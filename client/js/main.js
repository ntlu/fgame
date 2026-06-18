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
let aiPlayers = [];

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
        
        const leaveBtn = document.getElementById('leave-game-btn');
        if (leaveBtn) {
            leaveBtn.style.display = screenId === 'game-screen' ? 'block' : 'none';
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
            startGameClient(user, 'ONLINE_4');
        });
    }

    const modeOnline2 = document.getElementById('mode-online-2');
    if (modeOnline2) {
        modeOnline2.addEventListener('click', () => {
            const user = AuthManager.getCurrentUser();
            if(!user) return;
            
            showScreen('game-screen');
            startGameClient(user, 'ONLINE_2');
        });
    }

    const modeOffline4 = document.getElementById('mode-offline-4');
    if (modeOffline4) {
        modeOffline4.addEventListener('click', () => {
            const user = AuthManager.getCurrentUser();
            if(!user) return;
            
            showScreen('game-screen');
            startOfflineGame(user, 'OFFLINE_4');
        });
    }

    const modeOffline2 = document.getElementById('mode-offline-2');
    if (modeOffline2) {
        modeOffline2.addEventListener('click', () => {
            const user = AuthManager.getCurrentUser();
            if(!user) return;
            
            showScreen('game-screen');
            startOfflineGame(user, 'OFFLINE_2');
        });
    }

    const logoutBtn = document.getElementById('logout-btn');
    const modeLogoutBtn = document.getElementById('mode-logout-btn');
    
    const handleLogout = () => {
        AuthManager.logout();
        if (network) {
            network.socket.disconnect();
        }
        window.location.reload();
    };

    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (modeLogoutBtn) modeLogoutBtn.addEventListener('click', handleLogout);

    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            document.body.classList.toggle('sidebar-open');
        });
    }

    const leaveBtn = document.getElementById('leave-game-btn');
    if (leaveBtn) {
        leaveBtn.addEventListener('click', () => {
            const overlay = document.createElement('div');
            overlay.className = 'custom-dialog-overlay';
            
            const dialog = document.createElement('div');
            dialog.className = 'custom-dialog';
            
            dialog.innerHTML = `
                <h3>🚪 Xác nhận rời bàn</h3>
                <p>Bạn có chắc chắn muốn rời bàn và quay lại sảnh không?</p>
                <div class="custom-dialog-actions">
                    <button class="btn-cancel">Hủy</button>
                    <button class="btn-confirm">Rời bàn</button>
                </div>
            `;
            
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            
            const closeDialog = () => {
                overlay.style.animation = 'fadeOut 0.2s ease forwards';
                dialog.style.animation = 'slideDown 0.2s ease forwards';
                setTimeout(() => document.body.removeChild(overlay), 200);
            };
            
            dialog.querySelector('.btn-cancel').addEventListener('click', closeDialog);
            
            dialog.querySelector('.btn-confirm').addEventListener('click', () => {
                closeDialog();
                if (typeof network !== 'undefined' && network && network.socket) {
                    network.socket.disconnect();
                }
                window.location.reload();
            });
        });
    }

    // Fullscreen on double tap
    let lastTap = 0;
    
    function toggleFullScreen() {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(err => console.log(err));
            } else if (document.documentElement.webkitRequestFullscreen) {
                document.documentElement.webkitRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
        }
    }

    document.addEventListener('touchend', function (e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTap;
        if (tapLength < 300 && tapLength > 0) {
            toggleFullScreen();
            // Optional: prevent default to avoid zooming if browser allows it
            // e.preventDefault(); 
        }
        lastTap = currentTime;
    });

    document.addEventListener('dblclick', function (e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
        toggleFullScreen();
    });
}

function startGameClient(user, mode = 'ONLINE_4') {
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
        }
        
        uiState.clearSelection(); 
        renderer.animateAndRender(currentGameState);
    });

    network.connect(user.username, mode);
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

function startOfflineGame(user, mode = 'OFFLINE_2') {
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
        }
        
        uiState.clearSelection(); 
        renderer.animateAndRender(currentGameState);

        if (aiPlayers.length > 0) {
            aiPlayers.forEach(ai => ai.onStateUpdate(currentGameState));
        }
    }, mode);

    offlineStore.setUserName(user.username);
    
    const onlineDetails = document.getElementById('online-details');
    const offlineDetails = document.getElementById('offline-details');
    if (onlineDetails) onlineDetails.style.display = 'none';
    if (offlineDetails) {
        offlineDetails.style.display = 'block';
        const offlineUser = document.getElementById('offline-user');
        if (offlineUser) offlineUser.textContent = user.username;
    }

    // Create AIs
    const modeConfig = offlineStore.gameState.modeConfig;
    for (let i = 1; i < modeConfig.players; i++) {
        aiPlayers.push(new AIPlayer(offlineStore, i));
    }
    
    offlineStore.broadcastState();
}

window.isServerAuthoritative = function() {
    return true; 
}

init();

