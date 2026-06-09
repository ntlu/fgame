export class Renderer {
    constructor(gameState, uiState, turnEngine) {
        this.gameState = gameState;
        this.uiState = uiState;
        this.turnEngine = turnEngine;
        this.container = document.querySelector('.container');
    }

    render() {
        this.container.innerHTML = ''; 

        if (this.turnEngine && this.turnEngine.isRoundFinished()) {
            this.container.appendChild(this.createRoundEndScreen());
            return;
        }

        const infoColumn = document.createElement('div');
        infoColumn.className = 'info-column';
        infoColumn.appendChild(this.createGameInfo());
        infoColumn.appendChild(this.createDebugPanel());

        const scoreBoard = this.createScoreBoard();
        
        this.container.appendChild(infoColumn);
        
        // P3 phía trên (Index 2)
        this.container.appendChild(this.createPlayer(this.gameState.players[2], 'player-top'));
        
        // P4 bên trái (Index 3)
        this.container.appendChild(this.createPlayer(this.gameState.players[3], 'player-left'));
        
        // Bàn chơi
        this.container.appendChild(this.createTable());
        
        // P2 bên phải (Index 1)
        this.container.appendChild(this.createPlayer(this.gameState.players[1], 'player-right'));
        
        // P1 ở dưới (Index 0)
        this.container.appendChild(this.createPlayer(this.gameState.players[0], 'player-bottom'));
        
        this.container.appendChild(scoreBoard);

        this.bindEvents(); 
    }

    createGameInfo() {
        const div = document.createElement('div');
        div.className = 'game-info';
        div.innerHTML = `
            <div><strong>Round:</strong> ${this.gameState.round}</div>
            <div><strong>Dealer:</strong><br>Player ${this.gameState.players[this.gameState.dealerIndex].id}</div>
            <div><strong>Current Turn:</strong><br>Player ${this.gameState.players[this.gameState.currentPlayerIndex].id}</div>
            <div class="deck-info"><strong>Deck:</strong><br>${this.gameState.deck.length} cards</div>
        `;
        return div;
    }

    createDebugPanel() {
        const capturableIds = this.uiState.capturableTableCardIds.length > 0 
            ? this.uiState.capturableTableCardIds.join(', ') 
            : 'None';

        let logsHtml = this.uiState.gameLogs.map(log => `<div>${log}</div>`).join('');

        const div = document.createElement('div');
        div.className = 'debug-panel';
        div.innerHTML = `
            <div><strong>Selected Hand:</strong><br>${this.uiState.selectedHandCardId || 'None'}</div>
            <div><strong>Selected Table:</strong><br>${this.uiState.selectedTableCardId || 'None'}</div>
            <div><strong>Capturable:</strong><br>${capturableIds}</div>
            <hr style="border-color: #718096; margin: 5px 0;">
            <div><strong>Last Action:</strong><br>${this.uiState.lastAction.replace(/\n/g, '<br>')}</div>
            <hr style="border-color: #718096; margin: 5px 0;">
            <div class="game-log"><strong>Game Log:</strong><br>${logsHtml}</div>
        `;
        return div;
    }

    createActionPanel() {
        if (!this.uiState.hasSelection()) return null;

        const div = document.createElement('div');
        div.className = 'action-panel';
        div.innerHTML = `
            <button id="play-btn" ${this.uiState.canPlay() ? '' : 'disabled'}>Đánh bài</button>
            <button id="cancel-btn">Bỏ chọn</button>
        `;
        return div;
    }

    createPlayer(player, positionClass) {
        const div = document.createElement('div');
        div.className = `player ${positionClass}`;
        
        if (player.id === this.gameState.players[this.gameState.currentPlayerIndex].id) {
            div.classList.add('current-turn');
        }

        const info = document.createElement('div');
        info.className = 'player-info';
        
        let handHtml = `Hand: ${player.hand.length}`;
        if (player.id === 2 || player.id === 4) {
            handHtml += `<br>🂠 x${player.hand.length}`;
        }

        info.innerHTML = `
            <strong>Player ${player.id}</strong><br>
            ${handHtml}<br>
            Captured: ${player.capturedCards.length}<br>
            Score: ${player.score}
            <div class="captured-preview"></div>
        `;
        div.appendChild(info);

        if (player.id === 1 || player.id === 3) {
            const hand = document.createElement('div');
            hand.className = 'hand';
            
            if (player.id === 1) { 
                player.hand.forEach(card => {
                    hand.appendChild(this.createCard(card, true, true));
                });
            } else if (player.id === 3) { 
                const maxCards = Math.min(player.hand.length, 5);
                for (let i = 0; i < maxCards; i++) {
                    hand.appendChild(this.createCardBack());
                }
            }
            div.appendChild(hand);

            // Render Action Panel ngay dưới tay bài Player 1
            if (player.id === 1) {
                const actionPanel = this.createActionPanel();
                if (actionPanel) {
                    div.appendChild(actionPanel);
                }
            }
        }

        return div;
    }

    createTable() {
        const table = document.createElement('div');
        table.className = 'table';
        
        this.gameState.tableCards.forEach(card => {
            table.appendChild(this.createCard(card, false, false));
        });

        return table;
    }

    createCard(card, isHandCard = false, isPlayer1 = false) {
        const div = document.createElement('div');
        div.className = `card ${card.isRed ? 'red' : 'black'}`;
        div.dataset.cardId = card.id;

        if (isHandCard && isPlayer1) {
            div.classList.add('card-selectable');
            div.dataset.type = 'hand';
            if (this.uiState.selectedHandCardId === card.id) {
                div.classList.add('card-selected');
            }
        } else if (!isHandCard) {
            div.dataset.type = 'table';
            if (this.uiState.capturableTableCardIds.includes(card.id)) {
                div.classList.add('card-selectable');
            }
            if (this.uiState.selectedTableCardId === card.id) {
                div.classList.add('table-card-selected');
            }
        }

        const suitMap = { 'H': '♥', 'D': '♦', 'S': '♠', 'C': '♣' };
        const sym = suitMap[card.suit];

        div.innerHTML = `
            <div class="card-top">${card.rank} ${sym}</div>
            <div class="card-center">${sym}</div>
            <div class="card-bottom">${sym} ${card.rank}</div>
        `;
        return div;
    }

    createCardBack() {
        const div = document.createElement('div');
        div.className = 'card card-back';
        div.innerHTML = `<div class="pattern">🂠</div>`;
        return div;
    }

    createScoreBoard() {
        const board = document.createElement('div');
        board.className = 'score-board';
        
        let html = '<h3>Score Board</h3>';
        this.gameState.players.forEach(p => {
            html += `<div>Player ${p.id}: ${p.score}</div>`;
        });
        board.innerHTML = html;

        return board;
    }

    bindEvents() {
        const cards = this.container.querySelectorAll('.card-selectable');
        cards.forEach(card => {
            card.addEventListener('click', () => {
                // Kiểm tra lượt: Chỉ P1 (Index 0) mới được thao tác click bài
                if (this.gameState.currentPlayerIndex !== 0) {
                    return; // KHÔNG có tác dụng
                }

                const cardId = card.dataset.cardId;
                const type = card.dataset.type;

                if (type === 'hand') {
                    this.uiState.selectHandCard(cardId);
                    const handCard = this.gameState.players[0].hand.find(c => c.id === cardId);
                    this.uiState.updateCapturableCards(this.uiState.selectedHandCardId ? handCard : null, this.gameState.tableCards);
                } else if (type === 'table') {
                    // Không cho phép chọn bài bàn nếu chưa chọn bài tay
                    if (this.uiState.selectedHandCardId === null) {
                        return; // KHÔNG có tác dụng
                    }
                    this.uiState.selectTableCard(cardId);
                }
                
                this.render();
            });
        });

        const playBtn = this.container.querySelector('#play-btn');
        if (playBtn) {
            playBtn.addEventListener('click', () => {
                this.handlePlayAction();
            });
        }

        // Bắt event cho Action Panel (nút Cancel)
        const cancelBtn = this.container.querySelector('#cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.uiState.clearSelection();
                this.render();
            });
        }
    }

    handlePlayAction() {
        if (!this.uiState.canPlay()) return;

        const playerIndex = this.gameState.currentPlayerIndex;
        const player = this.gameState.players[playerIndex];
        
        const handCardId = this.uiState.selectedHandCardId;
        const tableCardId = this.uiState.selectedTableCardId;

        const handCardIndex = player.hand.findIndex(c => c.id === handCardId);
        const tableCardIndex = tableCardId ? this.gameState.tableCards.findIndex(c => c.id === tableCardId) : null;

        // B3: Gọi TurnEngine.processPlay()
        const playResult = this.turnEngine.processPlay(playerIndex, handCardIndex, tableCardIndex);
        
        let logMsg = `Player ${player.id} played ${playResult.playedCard.id}`;
        if (playResult.captured) {
            logMsg += ` and captured ${playResult.tableCard.id}`;
            this.uiState.lastAction = `Played:\n${playResult.playedCard.id}\nCaptured:\n${playResult.tableCard.id}`;
        } else {
            this.uiState.lastAction = `Played:\n${playResult.playedCard.id}\nNo Capture`;
        }
        this.uiState.addLog(logMsg);

        // B4: Renderer.render()
        this.render();

        // B5: Gọi TurnEngine.processDraw()
        // Pass null cho selectedTableCardIndex (Luật hiện tại: không có chọn thì đặt xuống bàn)
        const drawResult = this.turnEngine.processDraw(playerIndex, null);

        if (drawResult && drawResult.drawnCard) {
            let drawMsg = `Player ${player.id} drew ${drawResult.drawnCard.id}`;
            if (drawResult.captured) {
                drawMsg += ` and captured ${drawResult.tableCard.id}`;
                this.uiState.lastAction = `Draw:\n${drawResult.drawnCard.id}\nCaptured:\n${drawResult.tableCard.id}`;
            } else {
                this.uiState.lastAction = `Draw:\n${drawResult.drawnCard.id}\nNo Capture`;
            }
            this.uiState.addLog(drawMsg);
        }

        // B6: Renderer.render()
        this.render();

        // B7: TurnEngine.nextTurn()
        this.turnEngine.nextTurn();

        // B8: uiState.clearSelection()
        this.uiState.clearSelection();

        // B9: Renderer.render()
        this.render();
    }

    createRoundEndScreen() {
        const div = document.createElement('div');
        div.className = 'round-end-screen';
        
        const scores = this.turnEngine.calculateRoundScores();
        const settlement = this.turnEngine.calculateSettlement();

        let html = `<h2>ROUND FINISHED</h2>`;
        html += `<div class="results">`;
        
        this.gameState.players.forEach((p, i) => {
            const profit = settlement[i];
            const sign = profit > 0 ? '+' : '';
            html += `
                <div class="player-result">
                    <strong>Player ${p.id}:</strong><br>
                    ${scores[i]} points<br>
                    Profit: ${sign}${profit}
                </div>
            `;
        });
        
        html += `</div>`;
        div.innerHTML = html;
        return div;
    }
}
