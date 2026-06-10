export class Renderer {
    constructor(gameState, uiState, turnEngine, network) {
        this.gameState = gameState;
        this.uiState = uiState;
        this.turnEngine = turnEngine;
        this.network = network;
        this.container = document.querySelector('.container');
    }

    render() {
        this.container.innerHTML = ''; 

        if (this.gameState && this.gameState.roundResult) {
            this.container.appendChild(this.createRoundEndScreen());
            return;
        }

        const infoColumn = document.createElement('div');
        infoColumn.className = 'info-column';
        infoColumn.appendChild(this.createGameInfo());
        infoColumn.appendChild(this.createPlayerListPanel());
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
            <div><strong>Vòng:</strong> ${this.gameState.round}</div>
            <div class="deck-info"><strong>Bài còn lại:</strong> ${this.gameState.deckRemaining || 0}</div>
            <div><strong>Bài trên bàn:</strong> ${this.gameState.tableCards.length}</div>
            <div><strong>Lượt của:</strong><br>${this.gameState.players[this.gameState.currentPlayerIndex].name || 'Người chơi ' + (this.gameState.currentPlayerIndex + 1)}</div>
        `;
        return div;
    }

    createDebugPanel() {
        const capturableIds = this.uiState.capturableTableCardIds.length > 0 
            ? this.uiState.capturableTableCardIds.join(', ') 
            : 'Không';

        const logs = this.gameState.logs || [];
        let logsHtml = logs.map(log => `<div>${log}</div>`).join('');

        const div = document.createElement('div');
        div.className = 'debug-panel';
        const lastActionStr = this.gameState.lastAction || 'Không';
        div.innerHTML = `
            <div style="color: #fbbf24;"><strong>Nguồn dữ liệu:</strong><br>Máy chủ</div>
            <div style="color: #fbbf24;"><strong>Phiên bản:</strong><br>${this.gameState.version || 0}</div>
            <hr style="border-color: #718096; margin: 5px 0;">
            <div><strong>Bài tay đã chọn:</strong><br>${this.uiState.selectedHandCardId || 'Không'}</div>
            <div><strong>Bài bàn đã chọn:</strong><br>${this.uiState.selectedTableCardId || 'Không'}</div>
            <div><strong>Có thể ăn:</strong><br>${capturableIds}</div>
            <hr style="border-color: #718096; margin: 5px 0;">
            <div><strong>Hành động cuối:</strong><br>${lastActionStr.replace(/\n/g, '<br>')}</div>
            <hr style="border-color: #718096; margin: 5px 0;">
            <div class="game-log"><strong>Nhật ký trận đấu:</strong><br>${logsHtml}</div>
        `;
        return div;
    }

    isOwnedPlayer(playerIndex) {
        return this.network.localPlayerIndex === playerIndex;
    }

    createPlayerListPanel() {
        const div = document.createElement('div');
        div.className = 'player-list-panel';
        
        const assignments = this.gameState.playerAssignments || {};
        const assignedIndexes = Object.values(assignments);
        
        let html = '<h3>Danh sách ghế</h3>';
        for (let i = 0; i < 4; i++) {
            const isAssigned = assignedIndexes.includes(i);
            const name = this.gameState.players[i].name || `Người chơi ${i + 1}`;
            html += `<div>${name}: <span class="${isAssigned ? 'seat-occupied' : 'seat-empty'}">${isAssigned ? 'Đã kết nối' : 'Trống'}</span></div>`;
        }
        div.innerHTML = html;
        return div;
    }

    createActionPanel() {
        const div = document.createElement('div');
        div.className = 'action-panel';

        const localPlayerIndex = this.network.localPlayerIndex;
        if (localPlayerIndex === null || localPlayerIndex === undefined) return null;

        if (!this.uiState.hasSelection()) return null;

        const isCurrentTurn = this.gameState.currentPlayerIndex === localPlayerIndex;
        if (!isCurrentTurn) {
            div.innerHTML = `
                <button id="play-btn" disabled>Chưa đến lượt</button>
                <button id="cancel-btn">Bỏ chọn</button>
            `;
            return div;
        }

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
        
        let handHtml = `Số bài tay: ${player.hand.length}`;

        // Render up to 5 last captured cards
        const lastCaptured = player.capturedCards.slice(-5);
        const capturedHtml = lastCaptured.map(c => {
            const suitMap = { 'H': '♥', 'D': '♦', 'S': '♠', 'C': '♣' };
            const isRed = c.suit === 'H' || c.suit === 'D';
            return `<div class="mini-card ${isRed ? 'red' : 'black'}">${c.rank}${suitMap[c.suit]}</div>`;
        }).join('');

        info.innerHTML = `
            <strong>${player.name || 'Người chơi ' + player.id}</strong><br>
            ${handHtml}<br>
            Đã ăn: ${player.capturedCards.length} lá<br>
            Điểm: ${player.score}
            <div class="captured-preview">
                ${capturedHtml}
            </div>
        `;
        div.appendChild(info);

        const pIndex = player.id - 1;
        const isOwned = this.isOwnedPlayer(pIndex);

        const hand = document.createElement('div');
        hand.className = 'hand';
        
        player.hand.forEach(card => {
            if (isOwned) {
                const isCurrentTurn = this.gameState.currentPlayerIndex === pIndex;
                hand.appendChild(this.createCard(card, true, isCurrentTurn));
            } else {
                hand.appendChild(this.createCardBack());
            }
        });
        div.appendChild(hand);

        // Render Action Panel ngay dưới tay bài của người chơi sở hữu
        const localPlayerIndex = this.network.localPlayerIndex;
        if (pIndex === localPlayerIndex) {
            const actionPanel = this.createActionPanel();
            if (actionPanel) {
                div.appendChild(actionPanel);
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
        
        let html = '<h3>Bảng điểm</h3>';
        this.gameState.players.forEach(p => {
            html += `<div>${p.name || 'Người chơi ' + p.id}: ${p.score}</div>`;
        });
        board.innerHTML = html;

        return board;
    }

    bindEvents() {
        const cards = this.container.querySelectorAll('.card-selectable');
        cards.forEach(card => {
            card.addEventListener('click', () => {
                const localPlayerIndex = this.network.localPlayerIndex;
                if (localPlayerIndex === null || localPlayerIndex === undefined) return;

                // Kiểm tra lượt: Chỉ người chơi có lượt hiện tại mới được click thao tác bài
                if (this.gameState.currentPlayerIndex !== localPlayerIndex) {
                    return; // KHÔNG có tác dụng
                }

                const cardId = card.dataset.cardId;
                const type = card.dataset.type;

                if (type === 'hand') {
                    this.uiState.selectHandCard(cardId);
                    const handCard = this.gameState.players[localPlayerIndex].hand.find(c => c.id === cardId);
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
        if (!this.uiState.canPlay()) {
            alert('Vui lòng chọn một lá bài trên tay trước!');
            return;
        }

        // Validate lượt cơ bản phía Client
        const localPlayerIndex = this.network.localPlayerIndex;
        if (this.gameState.currentPlayerIndex !== localPlayerIndex) return;

        const handCardId = this.uiState.selectedHandCardId;
        const tableCardId = this.uiState.selectedTableCardId;

        if (!handCardId) {
            console.warn("No hand card selected");
            return;
        }

        // YÊU CẦU 1 & 5: Gửi action lên server và CHỜ
        this.network.socket.emit('playTurn', {
            selectedHandCardId: handCardId,
            selectedTableCardId: tableCardId
        });

        // Không gọi clearSelection hoặc render() ở đây.
        // UIState sẽ được clear và render lại khi nhận được gameStateUpdate từ Server.
    }

    createRoundEndScreen() {
        const div = document.createElement('div');
        div.className = 'round-end-screen';
        
        const scores = this.gameState.roundResult.scores;
        const settlement = this.gameState.roundResult.settlement;
        
        // Find winner
        let maxScore = -1;
        let winnerIndex = -1;
        scores.forEach((s, i) => {
            if (s > maxScore) {
                maxScore = s;
                winnerIndex = i;
            }
        });

        const winnerName = this.gameState.players[winnerIndex].name || `Người chơi ${winnerIndex + 1}`;
        let html = `<h2>Tổng kết vòng đấu</h2>`;
        html += `<div class="winner">🏆 ${winnerName}</div>`;
        html += `<div class="results">`;
        
        this.gameState.players.forEach((p, i) => {
            const profit = settlement[i];
            const sign = profit > 0 ? '+' : '';
            const isWinner = i === winnerIndex;
            const pName = p.name || `Người chơi ${p.id}`;
            html += `
                <div class="player-result ${isWinner ? 'is-winner' : ''}">
                    <strong>${pName}</strong><br>
                    Đã ăn: ${p.capturedCards.length} lá<br>
                    Điểm: ${scores[i]}<br>
                    Thanh toán: <span class="${profit >= 0 ? 'profit-pos' : 'profit-neg'}">${sign}${profit}</span>
                </div>
            `;
        });
        
        html += `</div>`;
        
        const localPlayerIndex = this.network.localPlayerIndex;
        const hostPlayerIndex = this.gameState.hostPlayerIndex;
        const isHost = (hostPlayerIndex === null || hostPlayerIndex === undefined) || (localPlayerIndex === hostPlayerIndex);

        if (isHost) {
            html += `<button class="next-round-btn">Vòng tiếp theo</button>`;
        } else {
            html += `<div class="waiting-ai" style="margin-top: 30px;">Đang đợi chủ phòng bắt đầu vòng tiếp theo...</div>`;
        }
        
        div.innerHTML = html;
        
        if (isHost) {
            div.querySelector('.next-round-btn').addEventListener('click', () => {
                this.network.socket.emit('resetGame');
            });
        }

        return div;
    }
}
