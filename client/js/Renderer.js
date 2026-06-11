export class Renderer {
    constructor(gameState, uiState, turnEngine, network) {
        this.gameState = gameState;
        this.uiState = uiState;
        this.turnEngine = turnEngine;
        this.network = network;
        this.container = document.querySelector('.container');
        this.previousState = null;
    }

    formatMoney(amount) {
        if (amount === undefined || amount === null) return '10.000.000';
        return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }

    render() {
        this.container.innerHTML = '';
        this.renderSidebar();

        if (this.gameState && this.gameState.roundResult) {
            this.container.appendChild(this.createRoundEndScreen());
            return;
        }

        const localIdx = this.network.localPlayerIndex !== null && this.network.localPlayerIndex !== undefined
            ? this.network.localPlayerIndex
            : 0;

        // Rotate seats relative to local player index
        const bottomPlayer = this.gameState.players[localIdx];
        const rightPlayer = this.gameState.players[(localIdx + 1) % 4];
        const topPlayer = this.gameState.players[(localIdx + 2) % 4];
        const leftPlayer = this.gameState.players[(localIdx + 3) % 4];

        // P3 phía trên (rotated top)
        this.container.appendChild(this.createPlayer(topPlayer, 'player-top'));

        // P4 bên trái (rotated left)
        this.container.appendChild(this.createPlayer(leftPlayer, 'player-left'));

        // Bàn chơi
        this.container.appendChild(this.createTable());

        // P2 bên phải (rotated right)
        this.container.appendChild(this.createPlayer(rightPlayer, 'player-right'));

        // P1 ở dưới (rotated bottom - always the local player)
        this.container.appendChild(this.createPlayer(bottomPlayer, 'player-bottom'));

        this.bindEvents();
    }

    animateAndRender() {
        if (!this.previousState || this.previousState.round !== this.gameState.round) {
            // First render or new round: render immediately, then play deal animation
            this.render();
            this.playDealAnimation(() => {
                this.previousState = structuredClone(this.gameState);
            });
            return;
        }

        if (this.gameState.version !== this.previousState.version) {
            // Play turn animation sequence
            this.playTurnAnimationSequence(() => {
                this.previousState = structuredClone(this.gameState);
                this.render();
            });
        } else {
            // No state version change, just render statically
            this.render();
        }
    }

    renderSidebar() {
        const dynamicContent = document.getElementById('sidebar-dynamic-content');
        if (!dynamicContent) return;

        dynamicContent.innerHTML = '';

        // 1. Game Info Panel
        const gameInfoCard = document.createElement('div');
        gameInfoCard.className = 'sidebar-card game-info-card';
        const activePlayer = this.gameState.players[this.gameState.currentPlayerIndex];
        const activePlayerName = activePlayer.name || `Người chơi ${this.gameState.currentPlayerIndex + 1}`;
        gameInfoCard.innerHTML = `
            <h3>Thông tin trận đấu</h3>
            <div><strong>Vòng đấu:</strong> ${this.gameState.round}</div>
            <div><strong>Bài còn lại:</strong> ${this.gameState.deckRemaining || 0} lá</div>
            <div><strong>Bài trên bàn:</strong> ${this.gameState.tableCards.length} lá</div>
            <div><strong>Lượt của:</strong> ${activePlayerName}</div>
        `;
        dynamicContent.appendChild(gameInfoCard);

        // 2. Member seats & connection details
        const seatsCard = document.createElement('div');
        seatsCard.className = 'sidebar-card seats-card';
        let seatsHtml = '<h3>Danh sách ghế</h3>';
        const assignments = this.gameState.playerAssignments || {};
        const assignedIndexes = Object.values(assignments);

        for (let i = 0; i < 4; i++) {
            const isAssigned = assignedIndexes.includes(i);
            const name = this.gameState.players[i].name || `Người chơi ${i + 1}`;

            // Mark host and local player
            let suffix = '';
            if (this.gameState.hostPlayerIndex === i) {
                suffix += ' 👑'; // Host crown icon
            }
            if (this.network.localPlayerIndex === i) {
                suffix += ' (Bạn)';
            }

            seatsHtml += `
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span>${name}${suffix}</span>
                    <span class="${isAssigned ? 'seat-occupied' : 'seat-empty'}">
                        ${isAssigned ? 'Đã kết nối' : 'Trống'}
                    </span>
                </div>
            `;
        }
        seatsCard.innerHTML = seatsHtml;
        dynamicContent.appendChild(seatsCard);

        // 3. Statistics Panel
        const statsCard = document.createElement('div');
        statsCard.className = 'sidebar-card stats-card';

        let playersStatsHtml = '';
        this.gameState.players.forEach(p => {
            playersStatsHtml += `
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span>${p.name || 'Người chơi ' + p.id}:</span>
                    <strong style="color: #fbbf24;">${p.accumulatedScore || 0}</strong>
                </div>
            `;
        });

        statsCard.innerHTML = `
            <h3>Thống kê tích lũy</h3>
            <div><strong>Vòng đã chơi:</strong> ${this.gameState.totalRoundsPlayed || 0}</div>
            <div><strong>Vòng nhân đôi:</strong> ${this.gameState.doubleRoundsCount || 0}</div>
            <hr style="border-color: rgba(75, 85, 99, 0.4); margin: 8px 0;">
            <div><strong>Điểm tích lũy:</strong></div>
            ${playersStatsHtml}
        `;
        dynamicContent.appendChild(statsCard);

        // Bankroll Card
        const bankrollCard = document.createElement('div');
        bankrollCard.className = 'sidebar-card bankroll-card';
        let bankrollHtml = '';
        this.gameState.players.forEach(p => {
            bankrollHtml += `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 13px;">
                    <span style="color: #d1d5db; font-weight: 500;">${p.name || 'Người chơi ' + p.id}</span>
                    <strong style="color: #fbbf24;">💰 ${this.formatMoney(p.money)}</strong>
                </div>
            `;
        });
        bankrollCard.innerHTML = `
            <h3>Số dư (Bankroll)</h3>
            <div style="display: flex; flex-direction: column; gap: 4px;">
                ${bankrollHtml}
            </div>
        `;
        dynamicContent.appendChild(bankrollCard);

        // 4. Debug Logs Panel
        const logsCard = document.createElement('div');
        logsCard.className = 'sidebar-card logs-card';

        const logs = this.gameState.logs || [];
        const logsHtml = logs.map(log => `<div style="margin-bottom: 3px; border-bottom: 1px dashed rgba(75, 85, 99, 0.2); padding-bottom: 2px;">${log}</div>`).join('');

        logsCard.innerHTML = `
            <h3>Nhật ký & Debug</h3>
            <div><strong>Nguồn:</strong> Máy chủ</div>
            <div><strong>Version:</strong> ${this.gameState.version || 0}</div>
            <hr style="border-color: rgba(75, 85, 99, 0.4); margin: 8px 0;">
            <div class="game-log">
                ${logsHtml || '<div style="font-style: italic; color: #6b7280;">Chưa có log...</div>'}
            </div>
        `;
        dynamicContent.appendChild(logsCard);
    }

    isOwnedPlayer(playerIndex) {
        return this.network.localPlayerIndex === playerIndex;
    }

    createActionPanel() {
        const div = document.createElement('div');
        div.className = 'action-panel';

        const localPlayerIndex = this.network.localPlayerIndex;
        if (localPlayerIndex === null || localPlayerIndex === undefined) return null;

        if (!this.uiState.hasSelection()) {
            div.style.visibility = 'hidden';
            div.innerHTML = `
                <button disabled>Đánh bài</button>
                <button disabled>Bỏ chọn</button>
            `;
            return div;
        }

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

    createSecretCardSlot(player, isOwned) {
        const div = document.createElement('div');
        div.className = 'card secret-card-slot';

        const secretCard = this.gameState.secretCard; // might be null for other players
        const isRevealed = this.gameState.secretCardRevealed;
        const isOpenOnClient = isOwned && this.uiState.secretCardOpen;

        if (secretCard && (isRevealed || isOpenOnClient)) {
            div.classList.add('revealed');
            div.classList.add(secretCard.isRed ? 'red' : 'black');

            const suitMap = { 'H': '♥', 'D': '♦', 'S': '♠', 'C': '♣' };
            const sym = suitMap[secretCard.suit] || '';
            div.innerHTML = `
                <div class="card-top" style="font-size: 8px;">Bí mật</div>
                <div class="card-center" style="flex-direction: column; gap: 2px;">
                    <span style="font-size: 11px; line-height: 1;">${secretCard.rank}</span>
                    <span style="font-size: 16px; line-height: 1;">${sym}</span>
                </div>
                <div class="card-bottom" style="font-size: 8px;">${sym}</div>
            `;
        } else {
            // Render face down
            div.innerHTML = `
                <div class="pattern" style="font-size: 20px;">🂠</div>
                <div style="font-size: 8px; font-weight: bold; margin-top: 2px; color: #fbbf24;">Bí Mật</div>
            `;
        }

        // Add click event for local owner
        if (isOwned && !isRevealed) {
            div.addEventListener('click', (e) => {
                e.stopPropagation();
                this.uiState.secretCardOpen = !this.uiState.secretCardOpen;
                this.render();
            });
        }

        return div;
    }

    createPlayer(player, positionClass) {
        const div = document.createElement('div');
        div.className = `player ${positionClass}`;

        if (player.id === this.gameState.players[this.gameState.currentPlayerIndex].id) {
            div.classList.add('current-turn');
        }

        // Render all captured cards
        const capturedHtml = player.capturedCards.map(c => {
            const suitMap = { 'H': '♥', 'D': '♦', 'S': '♠', 'C': '♣' };
            const isRed = c.suit === 'H' || c.suit === 'D';
            return `<div class="mini-card ${isRed ? 'red' : 'black'}">${c.rank}${suitMap[c.suit]}</div>`;
        }).join('');

        const pIndex = player.id - 1;
        const isOwned = this.isOwnedPlayer(pIndex);

        if (!isOwned) {
            // Render other player compactly
            div.classList.add('compact-player');

            const info = document.createElement('div');
            info.className = 'player-info';
            info.innerHTML = `
                <strong>${player.name || 'Người chơi ' + player.id}</strong><br>
                <span style="color: #fbbf24; font-weight: bold; font-size: 13px;">💰 ${this.formatMoney(player.money)} VNĐ</span><br>
                Đã ăn: ${player.capturedCards.length} lá | Điểm: ${player.score}
                <div class="captured-preview">
                    ${capturedHtml}
                </div>
            `;
            div.appendChild(info);

            const hand = document.createElement('div');
            hand.className = 'hand';

            // Single representative card back showing the count
            const repCard = document.createElement('div');
            repCard.className = 'representative-card';
            repCard.innerHTML = `
                <div class="card card-back"><div class="pattern">🂠</div></div>
                <div class="card-count-badge">${player.hand.length}</div>
            `;
            hand.appendChild(repCard);

            // Render Secret Card Slot for compact other player if they are the owner
            if (pIndex === this.gameState.secretCardOwner) {
                hand.appendChild(this.createSecretCardSlot(player, false));
            }

            div.appendChild(hand);
        } else {
            // Render local player hand normally
            const info = document.createElement('div');
            info.className = 'player-info';
            info.innerHTML = `
                <strong>${player.name || 'Người chơi ' + player.id} (Bạn)</strong><br>
                <span style="color: #fbbf24; font-weight: bold; font-size: 13px;">💰 ${this.formatMoney(player.money)} VNĐ</span><br>
                Số bài: ${player.hand.length} lá | Đã ăn: ${player.capturedCards.length} lá | Điểm: ${player.score}
                <div class="captured-preview">
                    ${capturedHtml}
                </div>
            `;
            div.appendChild(info);

            const hand = document.createElement('div');
            hand.className = 'hand';

            player.hand.forEach(card => {
                const isCurrentTurn = this.gameState.currentPlayerIndex === pIndex;
                hand.appendChild(this.createCard(card, true, isCurrentTurn));
            });

            // Render Secret Card Slot for local player if they are the owner
            if (pIndex === this.gameState.secretCardOwner) {
                hand.appendChild(this.createSecretCardSlot(player, true));
            }

            div.appendChild(hand);

            // Render Action Panel right below local player's hand
            const actionPanel = this.createActionPanel();
            if (actionPanel) {
                div.appendChild(actionPanel);
            }
        }

        return div;
    }

    createNocCard(count) {
        const div = document.createElement('div');
        div.className = 'noc-card';
        div.innerHTML = `
            <div class="noc-title">Que</div>
            <div class="noc-count">${count}</div>
        `;
        return div;
    }

    createTable() {
        const table = document.createElement('div');
        table.className = 'table';

        table.classList.add('table-7-cols');

        const tableCards = this.gameState.tableCards;

        if (tableCards.length === 0) {
            table.appendChild(this.createNocCard(this.gameState.deckRemaining || 0));
        } else {
            tableCards.forEach((card, idx) => {
                if (idx === 3) {
                    const spacer = document.createElement('div');
                    spacer.style.width = '100%';
                    spacer.style.height = '100%';
                    table.appendChild(spacer);
                }
                if (idx === 9) {
                    table.appendChild(this.createNocCard(this.gameState.deckRemaining || 0));
                }
                if (card) {
                    table.appendChild(this.createCard(card, false, false));
                } else {
                    const emptySlot = document.createElement('div');
                    emptySlot.className = 'card empty-slot';
                    table.appendChild(emptySlot);
                }
            });
        }

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

        // Gửi action lên server và CHỜ
        this.network.socket.emit('playTurn', {
            selectedHandCardId: handCardId,
            selectedTableCardId: tableCardId
        });
    }

    createRoundEndScreen() {
        const div = document.createElement('div');
        div.className = 'round-end-screen';

        const roundResult = this.gameState.roundResult;
        const cardScores = roundResult.scores || []; // card scores
        const settlement = roundResult.settlement || [];
        const secretCardStr = roundResult.secretCard;
        const secretCardOwner = roundResult.secretCardOwner;
        const secretCardBonus = roundResult.secretCardBonus || 0;

        // Find winner based on final total score (cardScore + secretCardBonus if owner)
        let maxTotalScore = -1;
        let winnerIndex = -1;
        this.gameState.players.forEach((p, i) => {
            const cardScore = cardScores[i] || 0;
            const bonusPoints = (i === secretCardOwner) ? secretCardBonus : 0;
            const totalScore = cardScore + bonusPoints;
            if (totalScore > maxTotalScore) {
                maxTotalScore = totalScore;
                winnerIndex = i;
            }
        });

        const winnerName = this.gameState.players[winnerIndex].name || `Người chơi ${winnerIndex + 1}`;
        let html = `<h2>Tổng kết vòng đấu</h2>`;
        html += `<div class="winner">🏆 ${winnerName}</div>`;

        // Secret Card Banner Section
        if (secretCardStr) {
            const suitMap = { 'H': '♥', 'D': '♦', 'S': '♠', 'C': '♣' };
            const rank = secretCardStr.slice(0, -1);
            const suitChar = secretCardStr.slice(-1);
            const suit = suitMap[suitChar] || suitChar;
            const isRed = suitChar === 'H' || suitChar === 'D';

            const ownerPlayerName = this.gameState.players[secretCardOwner]?.name || `Người chơi ${secretCardOwner + 1}`;

            html += `
                <div style="border: 2px dashed #fbbf24; border-radius: 12px; padding: 12px 20px; margin-bottom: 25px; width: 100%; max-width: 450px; background: rgba(31, 41, 55, 0.6); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;">
                    <div style="font-weight: 800; color: #fbbf24; letter-spacing: 2px; font-size: 11px; text-transform: uppercase;">SECRET CARD</div>
                    <div class="card ${isRed ? 'red' : 'black'}" style="width: 50px; height: 75px; background: white; border-radius: 6px; box-shadow: 0 3px 6px rgba(0,0,0,0.4); display: flex; flex-direction: column; justify-content: space-between; padding: 4px; font-weight: 800; font-size: 11px; user-select: none;">
                        <div style="align-self: flex-start; line-height: 1;">${rank} ${suit}</div>
                        <div style="font-size: 18px; text-align: center; flex-grow: 1; display: flex; align-items: center; justify-content: center;">${suit}</div>
                        <div style="align-self: flex-end; transform: rotate(180deg); line-height: 1;">${suit} ${rank}</div>
                    </div>
                    <div style="font-size: 12px; color: #d1d5db; text-align: center;">
                        <div>Sở hữu: <strong>${ownerPlayerName}</strong> | Giá trị: <strong style="color: #fbbf24;">+${secretCardBonus} điểm</strong></div>
                    </div>
                </div>
            `;
        }

        html += `<div class="results">`;

        this.gameState.players.forEach((p, i) => {
            const profit = settlement[i];
            const sign = profit > 0 ? '+' : '';
            const isWinner = i === winnerIndex;
            const pName = p.name || `Người chơi ${p.id}`;

            const cardScore = cardScores[i] || 0;
            const isOwner = i === secretCardOwner;
            const bonusPoints = isOwner ? secretCardBonus : 0;
            const totalScore = cardScore + bonusPoints;

            const moneyChangeVal = (roundResult.moneyChange && roundResult.moneyChange[i] !== undefined)
                ? roundResult.moneyChange[i]
                : profit * 1000;
            const moneyChangeSign = moneyChangeVal > 0 ? '+' : '';

            html += `
                <div class="player-result ${isWinner ? 'is-winner' : ''}" style="min-width: 190px; text-align: left;">
                    <strong style="color: #fbbf24; font-size: 15px;">${pName}</strong><br>
                    <div style="font-size: 12px; margin-top: 6px; color: #cbd5e0; line-height: 1.6; display: flex; flex-direction: column; gap: 2px;">
                        <div>• Điểm bài ăn: <strong>${cardScore}</strong></div>
                        <div>• Thưởng Secret: <strong>+${bonusPoints}</strong></div>
                        <div style="border-top: 1px solid rgba(255,255,255,0.15); margin: 4px 0; padding-top: 4px;">
                            • Tổng điểm: <strong style="color: #fbbf24; font-size: 13px;">${totalScore}</strong>
                        </div>
                        <div>• Settlement: <span class="${profit >= 0 ? 'profit-pos' : 'profit-neg'}"><strong>${sign}${profit}</strong></span></div>
                        <div>• Money: <span class="${moneyChangeVal >= 0 ? 'profit-pos' : 'profit-neg'}"><strong>${moneyChangeSign}${this.formatMoney(moneyChangeVal)}</strong></span></div>
                        <div style="border-top: 1px dashed rgba(255,255,255,0.15); margin: 4px 0; padding-top: 4px;">
                            • Balance: <strong style="color: #10b981;">${this.formatMoney(p.money)}</strong>
                        </div>
                    </div>
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

    // --- Animation Helpers ---
    getPositionClassForIndex(idx) {
        const localIdx = this.network.localPlayerIndex !== null && this.network.localPlayerIndex !== undefined
            ? this.network.localPlayerIndex
            : 0;
        const rel = (idx - localIdx + 4) % 4;
        const classes = ['player-bottom', 'player-right', 'player-top', 'player-left'];
        return classes[rel] || 'player-bottom';
    }

    parseLastAction(lastAction) {
        if (!lastAction) return null;
        const lines = lastAction.split('\n');
        const result = {
            played: null,
            captured: null,
            drawn: null,
            autoCaptured: null
        };
        lines.forEach(line => {
            if (line.startsWith('Đã đánh:')) {
                result.played = line.replace('Đã đánh:', '').trim();
            } else if (line.startsWith('Đã ăn:')) {
                const val = line.replace('Đã ăn:', '').trim();
                if (val !== 'Không ăn bài') result.captured = val;
            } else if (line.startsWith('Bốc được:')) {
                result.drawn = line.replace('Bốc được:', '').trim();
            } else if (line.startsWith('Tự động ăn:')) {
                const val = line.replace('Tự động ăn:', '').trim();
                if (val !== 'Không ăn bài') result.autoCaptured = val;
            }
        });
        return result;
    }

    parseCardString(str) {
        if (!str) return null;
        const suitChar = str.slice(-1);
        const rank = str.slice(0, -1);
        const suitMap = { '♥': 'H', '♦': 'D', '♠': 'S', '♣': 'C' };
        const suit = suitMap[suitChar] || 'H';
        const isRed = suit === 'H' || suit === 'D';
        return { rank, suit, isRed };
    }

    playDealAnimation(onComplete) {
        const nocEl = document.querySelector('.noc-card');
        const tableEl = document.querySelector('.table');
        if (!nocEl || !tableEl) {
            onComplete();
            return;
        }

        const nocRect = nocEl.getBoundingClientRect();
        const tableRect = tableEl.getBoundingClientRect();

        const seatClasses = ['player-bottom', 'player-right', 'player-top', 'player-left'];
        const seatRects = seatClasses.map(cls => {
            const el = document.querySelector('.' + cls);
            return el ? el.getBoundingClientRect() : tableRect;
        });

        let animLayer = document.getElementById('animation-layer');
        if (!animLayer) {
            animLayer = document.createElement('div');
            animLayer.id = 'animation-layer';
            document.body.appendChild(animLayer);
        }

        const animateSingleDeal = (targetRect, isTable = false, index = 0) => {
            return new Promise(resolve => {
                const cardDiv = document.createElement('div');
                cardDiv.className = 'card card-back floating-anim-card';
                cardDiv.style.position = 'fixed';
                cardDiv.style.left = `${nocRect.left}px`;
                cardDiv.style.top = `${nocRect.top}px`;
                cardDiv.style.width = `${nocRect.width || 56}px`;
                cardDiv.style.height = `${nocRect.height || 84}px`;
                cardDiv.style.margin = '0';
                cardDiv.style.transform = 'none';
                cardDiv.innerHTML = '<div class="pattern">🂠</div>';
                animLayer.appendChild(cardDiv);

                cardDiv.offsetHeight; // reflow

                cardDiv.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.4s ease';

                let xOffset = 0;
                let yOffset = 0;
                if (isTable) {
                    const cols = 6;
                    const colIdx = index % cols;
                    const rowIdx = Math.floor(index / cols);
                    xOffset = colIdx * 50 - 100;
                    yOffset = rowIdx * 70 - 35;
                }

                const targetX = targetRect.left + (targetRect.width / 2) - 28 + xOffset;
                const targetY = targetRect.top + (targetRect.height / 2) - 42 + yOffset;

                cardDiv.style.transform = `translate(${targetX - nocRect.left}px, ${targetY - nocRect.top}px)`;

                setTimeout(() => {
                    cardDiv.remove();
                    resolve();
                }, 400);
            });
        };

        const promises = [];
        let delay = 0;

        // 5 cards for each player
        for (let round = 0; round < 5; round++) {
            for (let p = 0; p < 4; p++) {
                const pRect = seatRects[p];
                setTimeout(() => {
                    promises.push(animateSingleDeal(pRect));
                }, delay);
                delay += 40;
            }
        }

        // 12 cards for table
        for (let i = 0; i < 12; i++) {
            setTimeout(() => {
                promises.push(animateSingleDeal(tableRect, true, i));
            }, delay);
            delay += 40;
        }

        setTimeout(() => {
            Promise.all(promises).then(onComplete);
        }, delay + 450);
    }

    async playTurnAnimationSequence(onComplete) {
        const action = this.parseLastAction(this.gameState.lastAction);
        if (!action) {
            onComplete();
            return;
        }

        const activePlayerIndex = this.previousState.currentPlayerIndex;
        const seatClass = this.getPositionClassForIndex(activePlayerIndex);

        const seatEl = document.querySelector('.' + seatClass);
        const tableEl = document.querySelector('.table');
        const nocEl = document.querySelector('.noc-card');

        if (!seatEl || !tableEl || !nocEl) {
            onComplete();
            return;
        }

        const seatRect = seatEl.getBoundingClientRect();
        const tableRect = tableEl.getBoundingClientRect();
        const nocRect = nocEl.getBoundingClientRect();

        const animateFlight = (cardObj, startRect, endRect, isFadeOut = false, duration = 450) => {
            return new Promise(resolve => {
                let animLayer = document.getElementById('animation-layer');
                if (!animLayer) {
                    animLayer = document.createElement('div');
                    animLayer.id = 'animation-layer';
                    document.body.appendChild(animLayer);
                }

                const cardDiv = document.createElement('div');
                cardDiv.className = 'card floating-anim-card';
                if (cardObj) {
                    cardDiv.classList.add(cardObj.isRed ? 'red' : 'black');
                    const suitMap = { 'H': '♥', 'D': '♦', 'S': '♠', 'C': '♣' };
                    const sym = suitMap[cardObj.suit] || '';
                    cardDiv.innerHTML = `
                        <div class="card-top">${cardObj.rank} ${sym}</div>
                        <div class="card-center">${sym}</div>
                        <div class="card-bottom">${sym} ${cardObj.rank}</div>
                    `;
                } else {
                    cardDiv.classList.add('card-back');
                    cardDiv.innerHTML = '<div class="pattern">🂠</div>';
                }

                cardDiv.style.position = 'fixed';
                cardDiv.style.left = `${startRect.left}px`;
                cardDiv.style.top = `${startRect.top}px`;
                cardDiv.style.width = `${startRect.width || 56}px`;
                cardDiv.style.height = `${startRect.height || 84}px`;
                cardDiv.style.margin = '0';
                cardDiv.style.transform = 'none';
                animLayer.appendChild(cardDiv);

                cardDiv.offsetHeight; // reflow

                cardDiv.style.transition = `transform ${duration / 1000}s cubic-bezier(0.25, 0.8, 0.25, 1), opacity ${duration / 1000}s ease`;
                cardDiv.style.transform = `translate(${endRect.left - startRect.left}px, ${endRect.top - startRect.top}px)`;
                if (isFadeOut) {
                    cardDiv.style.opacity = '0';
                }

                setTimeout(() => {
                    cardDiv.remove();
                    resolve();
                }, duration);
            });
        };

        // 1. Play card animation
        if (action.played) {
            const playedCard = this.parseCardString(action.played);
            let startRect = seatRect;

            if (activePlayerIndex === this.network.localPlayerIndex) {
                const handCards = seatEl.querySelectorAll('.hand .card');
                for (let el of handCards) {
                    if (el.textContent.includes(playedCard.rank)) {
                        startRect = el.getBoundingClientRect();
                        el.style.opacity = '0';
                        break;
                    }
                }
            }
            await animateFlight(playedCard, startRect, tableRect, false, 1200);
        }

        // 2. Capture animation
        if (action.captured) {
            const playedCard = this.parseCardString(action.played);
            const capturedCard = this.parseCardString(action.captured);

            let capturedRect = tableRect;
            const tableCards = tableEl.querySelectorAll('.card');
            let targetEl = null;
            for (let el of tableCards) {
                if (el.textContent.includes(capturedCard.rank)) {
                    capturedRect = el.getBoundingClientRect();
                    targetEl = el;
                    break;
                }
            }

            if (targetEl) {
                targetEl.classList.add('flash-capture');
                await new Promise(r => setTimeout(r, 800));
                targetEl.style.opacity = '0';
            }

            await Promise.all([
                animateFlight(playedCard, tableRect, seatRect, true, 800),
                animateFlight(capturedCard, capturedRect, seatRect, true, 800)
            ]);
        }

        // 3. Draw card animation
        if (action.drawn) {
            const drawnCard = this.parseCardString(action.drawn);
            await animateFlight(drawnCard, nocRect, tableRect, false, 1200);
        }

        // 4. Auto capture drawn card animation
        if (action.autoCaptured) {
            const drawnCard = this.parseCardString(action.drawn);
            const autoCapturedCard = this.parseCardString(action.autoCaptured);

            let capturedRect = tableRect;
            const tableCards = tableEl.querySelectorAll('.card');
            let targetEl = null;
            for (let el of tableCards) {
                if (el.textContent.includes(autoCapturedCard.rank)) {
                    capturedRect = el.getBoundingClientRect();
                    targetEl = el;
                    break;
                }
            }

            if (targetEl) {
                targetEl.classList.add('flash-capture');
                await new Promise(r => setTimeout(r, 800));
                targetEl.style.opacity = '0';
            }

            await Promise.all([
                animateFlight(drawnCard, tableRect, seatRect, true, 800),
                animateFlight(autoCapturedCard, capturedRect, seatRect, true, 800)
            ]);
        }

        onComplete();
    }
}
