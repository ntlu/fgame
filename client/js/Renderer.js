export class Renderer {
    constructor(gameState, uiState, turnEngine, network) {
        this.gameState = gameState;
        this.uiState = uiState;
        this.turnEngine = turnEngine;
        this.network = network;
        this.container = document.querySelector('.container');
        this.previousState = null;
        this.animationQueue = [];
        this.isAnimating = false;
        this.isDealingRound = false;
    }

    formatMoney(amount) {
        if (amount === undefined || amount === null) return '10.000.000';
        return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }

    render() {
        this.container.innerHTML = '';
        this.renderSidebar();

        if (this.gameState && this.gameState.status === 'LOBBY') {
            this.container.appendChild(this.createLobbyScreen());
            return;
        }

        if (this.gameState && this.gameState.roundResult) {
            this.container.appendChild(this.createRoundEndScreen());
            return;
        }

        const localIdx = this.network.localPlayerIndex !== null && this.network.localPlayerIndex !== undefined
            ? this.network.localPlayerIndex
            : 0;

        const playersCount = this.gameState.modeConfig ? this.gameState.modeConfig.players : 4;

        if (playersCount === 2) {
            const bottomPlayer = this.gameState.players[localIdx];
            const topPlayer = this.gameState.players[(localIdx + 1) % 2];

            this.container.appendChild(this.createPlayer(topPlayer, 'player-top'));
            this.container.appendChild(this.createTable());
            this.container.appendChild(this.createPlayer(bottomPlayer, 'player-bottom'));
        } else {
            const bottomPlayer = this.gameState.players[localIdx];
            const rightPlayer = this.gameState.players[(localIdx + 1) % 4];
            const topPlayer = this.gameState.players[(localIdx + 2) % 4];
            const leftPlayer = this.gameState.players[(localIdx + 3) % 4];

            this.container.appendChild(this.createPlayer(topPlayer, 'player-top'));
            this.container.appendChild(this.createPlayer(leftPlayer, 'player-left'));
            this.container.appendChild(this.createTable());
            this.container.appendChild(this.createPlayer(rightPlayer, 'player-right'));
            this.container.appendChild(this.createPlayer(bottomPlayer, 'player-bottom'));
        }

        const isMyTurn = this.gameState.currentPlayerIndex === localIdx;
        const turnStatusText = (playersCount === 2) ? (isMyTurn ? "YOUR TURN" : "AI TURN") : (isMyTurn ? "LƯỢT CỦA BẠN" : `LƯỢT CỦA ${this.gameState.players[this.gameState.currentPlayerIndex].name}`);
        
        const turnIndicator = document.createElement('div');
        turnIndicator.className = 'turn-indicator';
        turnIndicator.textContent = turnStatusText;
        turnIndicator.style.cssText = `
            position: absolute;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.6);
            padding: 8px 16px;
            border-radius: 20px;
            color: ${isMyTurn ? '#10b981' : '#fbbf24'};
            font-weight: bold;
            font-size: 14px;
            border: 1px solid ${isMyTurn ? '#10b981' : '#fbbf24'};
            z-index: 100;
        `;
        this.container.appendChild(turnIndicator);

        this.bindEvents();
    }

    animateAndRender(newState) {
        if (newState) {
            this.animationQueue.push(structuredClone(newState));
        } else {
            this.animationQueue.push(structuredClone(this.gameState));
        }
        this.processAnimationQueue();
    }

    processAnimationQueue() {
        if (this.isAnimating || this.animationQueue.length === 0) return;
        this.isAnimating = true;

        const nextState = this.animationQueue.shift();
        this.gameState = nextState;

        if (!this.previousState || this.previousState.round !== this.gameState.round) {
            // First render or new round: render immediately, then play deal animation
            this.isDealingRound = true;
            this.render();
            this.playDealAnimation(() => {
                this.isDealingRound = false;
                this.previousState = structuredClone(this.gameState);
                this.isAnimating = false;
                this.processAnimationQueue();
            });
            return;
        }

        if (this.gameState.version !== this.previousState.version) {
            // Play turn animation sequence
            this.playTurnAnimationSequence(() => {
                this.previousState = structuredClone(this.gameState);
                this.render();
                this.isAnimating = false;
                this.processAnimationQueue();
            });
        } else {
            // No state version change, just render statically
            this.render();
            this.isAnimating = false;
            this.processAnimationQueue();
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
        const playersCount = this.gameState.modeConfig ? this.gameState.modeConfig.players : 4;
        const modeName = this.gameState.modeConfig ? this.gameState.modeConfig.name : 'Online 4 Người';
        
        let seatsHtml = `<h3>Thành viên (${modeName})</h3>`;
        const assignments = this.gameState.playerAssignments || {};
        const assignedIndexes = Object.values(assignments);

        for (let i = 0; i < playersCount; i++) {
            const isAssigned = assignedIndexes.includes(i);
            const name = this.gameState.players[i].name || `Người chơi ${i + 1}`;

            // Mark host and local player
            let suffix = '';
            if (i === this.gameState.hostPlayerIndex) {
                suffix += ' <span style="font-size: 10px; color: #fbbf24; border: 1px solid #fbbf24; padding: 1px 4px; border-radius: 4px; margin-left: 4px;">Host</span>';
            }
            if (this.isOwnedPlayer(i)) {
                suffix += ' <span style="font-size: 10px; color: #10b981; border: 1px solid #10b981; padding: 1px 4px; border-radius: 4px; margin-left: 4px;">Bạn</span>';
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
            
            if (['J', 'Q', 'K'].includes(secretCard.rank)) {
                const imgSrc = `/assets/cards/${secretCard.rank}-${secretCard.suit}.png`;
                div.innerHTML = `<img src="${imgSrc}" style="width:100%; height:100%; object-fit:contain; border-radius:6px; display:block;" alt="${secretCard.rank} ${sym}" />`;
                div.style.padding = '0';
                div.style.backgroundColor = 'transparent';
            } else {
                div.innerHTML = `
                    <div class="card-top" style="font-size: 8px;">Bí mật</div>
                    <div class="card-center" style="flex-direction: column; gap: 2px;">
                        <span style="font-size: 11px; line-height: 1;">${secretCard.rank}</span>
                        <span style="font-size: 16px; line-height: 1;">${sym}</span>
                    </div>
                    <div class="card-bottom" style="font-size: 8px;">${sym}</div>
                `;
            }
        } else {
            // Render face down
            div.className = `card secret-card-slot ${this.getCardBackClass()}`;
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
                <span style="color: #fbbf24; font-weight: bold; font-size: 10px;">💰 ${this.formatMoney(player.money)} VNĐ</span><br>
                <span style="font-size: 10px;">Đã ăn: ${player.capturedCards.length} lá | Điểm: ${player.score}</span>
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
            if (this.isDealingRound) {
                repCard.classList.add('deal-hidden');
            }
            const count = this.isDealingRound ? 0 : player.hand.length;
            repCard.innerHTML = `
                <div class="card ${this.getCardBackClass()}"><div class="pattern">🂠</div></div>
                <div class="card-count-badge">${count}</div>
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
            info.className = 'player-info local-player-info';
            info.innerHTML = `
                <div class="info-left">
                    <strong>${player.name || 'Người chơi ' + player.id} (Bạn)</strong>
                    <span style="color: #fbbf24; font-weight: bold; font-size: 11px;">💰 ${this.formatMoney(player.money)} VNĐ</span><br>
                    <span style="font-size: 11px;">Số bài: ${player.hand.length} lá | Đã ăn: ${player.capturedCards.length} lá | Điểm: ${player.score}</span>
                </div>
                <div class="captured-preview info-right">
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

            const wrapper = document.createElement('div');
            wrapper.className = 'hand-action-wrapper';

            const cancelBtn = document.createElement('button');
            cancelBtn.id = 'cancel-btn';
            cancelBtn.innerHTML = 'Bỏ<br>chọn';

            const playBtn = document.createElement('button');
            playBtn.id = 'play-btn';
            playBtn.innerHTML = 'Đánh<br>bài';

            if (!this.uiState.hasSelection()) {
                cancelBtn.disabled = true;
                playBtn.disabled = true;
            } else if (this.gameState.currentPlayerIndex !== pIndex) {
                playBtn.disabled = true;
                playBtn.textContent = 'Chưa đến lượt';
            } else if (!this.uiState.canPlay()) {
                playBtn.disabled = true;
            }

            wrapper.appendChild(cancelBtn);
            wrapper.appendChild(hand);
            wrapper.appendChild(playBtn);

            div.appendChild(wrapper);
        }

        const actionZone = document.createElement('div');
        actionZone.className = 'action-zone';
        actionZone.innerHTML = `
            <div class="action-slot primary-slot"></div>
            <div class="action-slot secondary-slot"></div>
        `;
        div.appendChild(actionZone);

        return div;
    }

    createNocCard(count) {
        const div = document.createElement('div');
        div.className = 'noc-card';
        div.innerHTML = `
            <div class="noc-title">QUE</div>
            <div class="noc-count">(${count})</div>
        `;
        return div;
    }

    createTable() {
        const table = document.createElement('div');
        table.className = 'table';
        table.classList.add('table-9-cols');

        const tableCards = this.gameState.tableCards || [];
        
        // Define the 16 available positions around the Nọc (which is at item index 4, i.e. col 5 spanning 2 rows).
        const innerIndices = [1, 2, 3, 5, 6, 7, 10, 11, 12, 13, 14, 15];
        const edgeIndices = [0, 8, 9, 16];
        
        const gridItems = new Array(17).fill(null);
        gridItems[4] = 'NOC';
        
        for (let i = 0; i < tableCards.length; i++) {
            if (i < 12) {
                gridItems[innerIndices[i]] = tableCards[i];
            } else if (i < 16) {
                gridItems[edgeIndices[i - 12]] = tableCards[i];
            } else {
                gridItems.push(tableCards[i]);
            }
        }

        for (let i = 0; i < gridItems.length; i++) {
            if (gridItems[i] === 'NOC') {
                table.appendChild(this.createNocCard(this.gameState.deckRemaining || 0));
            } else if (gridItems[i] !== null) {
                table.appendChild(this.createCard(gridItems[i], false, false));
            } else {
                const emptySlot = document.createElement('div');
                emptySlot.className = 'card empty-slot';
                if (innerIndices.includes(i)) {
                    emptySlot.classList.add('inner-slot');
                } else if (edgeIndices.includes(i)) {
                    emptySlot.classList.add('edge-slot');
                }
                table.appendChild(emptySlot);
            }
        }

        return table;
    }

    createCard(card, isHandCard = false, isPlayer1 = false) {
        const div = document.createElement('div');
        div.className = `card ${card.isRed ? 'red' : 'black'}`;
        div.dataset.cardId = card.id;
        div.dataset.rank = card.rank;
        div.dataset.suit = card.suit;

        if (this.isDealingRound) {
            div.classList.add('deal-hidden');
        }

        if (isHandCard && isPlayer1) {
            div.classList.add('card-selectable');
            div.dataset.type = 'hand';
            if (this.uiState.selectedHandCardId === card.id) {
                div.classList.add('card-selected');
            }
        } else if (!isHandCard) {
            div.dataset.type = 'table';
            if (this.uiState.capturableTableCardIds.includes(card.id)) {
                div.classList.add('card-eatable');
            }
            if (this.uiState.selectedTableCardId === card.id) {
                div.classList.add('table-card-selected');
            }
        }

        const suitMap = { 'H': '♥', 'D': '♦', 'S': '♠', 'C': '♣' };
        const sym = suitMap[card.suit];

        if (['J', 'Q', 'K'].includes(card.rank)) {
            const imgSrc = `/assets/cards/${card.rank}-${card.suit}.png`;
            div.innerHTML = `<img src="${imgSrc}" style="width:100%; height:100%; object-fit:contain; border-radius:6px; display:block;" alt="${card.rank} ${sym}" />`;
            // Remove padding to let image fill entirely
            div.style.padding = '0';
            div.style.backgroundColor = 'transparent';
        } else {
            div.innerHTML = `
                <div class="card-top">${card.rank} ${sym}</div>
                <div class="card-center">${sym}</div>
                <div class="card-bottom">${sym} ${card.rank}</div>
            `;
        }
        return div;
    }

    getCardBackClass() {
        const color = this.gameState.cardBackColor;
        return (color && color !== 'blue') ? `card-back ${color}` : 'card-back';
    }

    createCardBack() {
        const div = document.createElement('div');
        div.className = `card ${this.getCardBackClass()}`;
        div.innerHTML = `<div class="pattern">🂠</div>`;
        return div;
    }

    bindEvents() {
        const cards = this.container.querySelectorAll('.card-selectable, .card-eatable');
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

    createLobbyScreen() {
        const div = document.createElement('div');
        div.className = 'lobby-screen';
        
        const modeConfig = this.gameState.modeConfig || { players: 4, name: 'Online 4 Người' };
        const currentPlayers = Object.keys(this.gameState.playerAssignments || {}).length;
        const requiredPlayers = modeConfig.players;

        div.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; color: white;">
                <h2 style="font-size: 2rem; margin-bottom: 20px;">Phòng Chờ (${modeConfig.name})</h2>
                <div style="font-size: 1.5rem; margin-bottom: 30px; display: flex; align-items: center; gap: 10px;">
                    <div class="loader" style="width: 24px; height: 24px; border: 3px solid rgba(255,255,255,0.3); border-radius: 50%; border-top-color: #fff; animation: spin 1s ease-in-out infinite;"></div>
                    Đang chờ người chơi khác... (${currentPlayers}/${requiredPlayers})
                </div>
                <div style="color: #cbd5e0; font-size: 1rem;">Trò chơi sẽ tự động bắt đầu khi đủ người.</div>
                <style>
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                </style>
            </div>
        `;
        return div;
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
                    <div style="font-weight: 800; color: #fbbf24; letter-spacing: 2px; font-size: 11px; text-transform: uppercase;">LÁ BÀI TẨY</div>
                    <div class="card ${isRed ? 'red' : 'black'}" style="width: 50px; height: 75px; background: white; border-radius: 6px; box-shadow: 0 3px 6px rgba(0,0,0,0.4); display: flex; flex-direction: column; justify-content: space-between; padding: 0; font-weight: 800; font-size: 11px; user-select: none; overflow: hidden; border: none;">
                        ${['J', 'Q', 'K'].includes(rank) ? 
                            `<img src="/assets/cards/${rank}-${suitChar}.png" style="width:100%; height:100%; object-fit:contain; display:block;" alt="${rank} ${suit}" />` :
                            `
                                <div style="padding: 4px; align-self: flex-start; line-height: 1;">${rank} ${suit}</div>
                                <div style="font-size: 18px; text-align: center; flex-grow: 1; display: flex; align-items: center; justify-content: center;">${suit}</div>
                                <div style="padding: 4px; align-self: flex-end; transform: rotate(180deg); line-height: 1;">${suit} ${rank}</div>
                            `
                        }
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
            const playersCount = this.gameState.modeConfig ? this.gameState.modeConfig.players : 4;
            const tayPoints = (secretCardOwner !== null && secretCardOwner !== undefined && secretCardBonus > 0)
                ? (isOwner ? secretCardBonus * (playersCount - 1) : -secretCardBonus)
                : 0;
            const totalScore = cardScore + tayPoints;
            const taySign = tayPoints > 0 ? '+' : '';

            const moneyChangeVal = (roundResult.moneyChange && roundResult.moneyChange[i] !== undefined)
                ? roundResult.moneyChange[i]
                : profit * 1000;
            const moneyChangeSign = moneyChangeVal > 0 ? '+' : '';
            const moneyChangeText = `${moneyChangeSign}${this.formatMoney(moneyChangeVal)} VNĐ`;

            // Render all captured cards
            const capturedHtml = (p.capturedCards || []).map(c => {
                const suitMap = { 'H': '♥', 'D': '♦', 'S': '♠', 'C': '♣' };
                const isRed = c.suit === 'H' || c.suit === 'D';
                return `<div class="mini-card ${isRed ? 'red' : 'black'}">${c.rank}${suitMap[c.suit]}</div>`;
            }).join('');
            
            let tayPointsHtml = '';
            if (secretCardOwner !== null && secretCardOwner !== undefined && secretCardBonus > 0) {
                tayPointsHtml = `<div>• Điểm tẩy: <strong class="${tayPoints > 0 ? 'profit-pos' : 'profit-neg'}">${taySign}${tayPoints}</strong></div>`;
            }

            html += `
                <div class="player-result ${isWinner ? 'is-winner' : ''}" style="min-width: 190px; text-align: left;">
                    <strong style="color: #fbbf24; font-size: 15px;">${pName}</strong><br>
                    <div style="font-size: 12px; margin-top: 6px; color: #cbd5e0; line-height: 1.6; display: flex; flex-direction: column; gap: 2px;">
                        <div>• Điểm bài ăn: <strong>${cardScore}</strong></div>
                        ${tayPointsHtml}
                        <div style="border-top: 1px solid rgba(255,255,255,0.15); margin: 4px 0; padding-top: 4px;">
                            • Tổng điểm: <strong style="color: #fbbf24; font-size: 13px;">${totalScore}</strong>
                        </div>
                        <div>• Tổng kết: <span class="${profit >= 0 ? 'profit-pos' : 'profit-neg'}"><strong>${sign}${profit} điểm (${moneyChangeText})</strong></span></div>
                        <div style="border-top: 1px dashed rgba(255,255,255,0.15); margin: 4px 0; padding-top: 4px;">
                            • Số tiền hiện tại: <strong style="color: #10b981;">${this.formatMoney(p.money)} VNĐ</strong>
                        </div>
                        <div style="border-top: 1px dashed rgba(255,255,255,0.15); margin: 4px 0; padding-top: 4px;">
                            • Danh sách bài đã ăn: <div class="captured-preview" style="margin-top: 4px; gap: 2px;">${capturedHtml || '<span style="color:#6b7280;font-size:10px;">(Không có)</span>'}</div>
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
        
        const playersCount = this.gameState.modeConfig ? this.gameState.modeConfig.players : 4;
        if (playersCount === 2) {
            return idx === localIdx ? 'player-bottom' : 'player-top';
        }

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

    parseCardsString(str) {
        if (!str) return [];
        return str.split(',').map(s => this.parseCardString(s.trim())).filter(c => c !== null);
    }

    playDealAnimation(onComplete) {
        const nocEl = document.querySelector('.noc-card');
        const tableEl = document.querySelector('.table');
        if (!nocEl || !tableEl) {
            onComplete();
            return;
        }

        const nocRect = nocEl.getBoundingClientRect();

        let animLayer = document.getElementById('animation-layer');
        if (!animLayer) {
            animLayer = document.createElement('div');
            animLayer.id = 'animation-layer';
            document.body.appendChild(animLayer);
        }

        const animateSingleDeal = (targetEl) => {
            return new Promise(resolve => {
                if (!targetEl) { resolve(); return; }
                const targetRect = targetEl.getBoundingClientRect();

                const cardDiv = document.createElement('div');
                cardDiv.className = `card ${this.getCardBackClass()} floating-anim-card`;
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

                const targetX = targetRect.left + (targetRect.width - nocRect.width) / 2;
                const targetY = targetRect.top + (targetRect.height - nocRect.height) / 2;

                cardDiv.style.transform = `translate(${targetX - nocRect.left}px, ${targetY - nocRect.top}px)`;

                setTimeout(() => {
                    cardDiv.remove();
                    targetEl.classList.remove('deal-hidden');
                    
                    if (targetEl.classList.contains('representative-card')) {
                        const badge = targetEl.querySelector('.card-count-badge');
                        if (badge) {
                            badge.textContent = parseInt(badge.textContent || '0') + 1;
                        }
                    }
                    resolve();
                }, 400);
            });
        };

        const promises = [];
        let delay = 0;
        const cardsPerPlayer = this.gameState.modeConfig ? this.gameState.modeConfig.cardsPerPlayer : 5;
        
        const playerTargets = [];
        for (let p = 0; p < this.gameState.players.length; p++) {
            const cls = this.getPositionClassForIndex(p);
            const seatEl = document.querySelector('.' + cls);
            if (this.isOwnedPlayer(p)) {
                playerTargets.push(seatEl ? Array.from(seatEl.querySelectorAll('.hand .card:not(.secret-card-slot)')) : []);
            } else {
                playerTargets.push(seatEl ? seatEl.querySelector('.representative-card') : null);
            }
        }
        
        // N cards for each player
        for (let round = 0; round < cardsPerPlayer; round++) {
            for (let p = 0; p < this.gameState.players.length; p++) {
                const target = playerTargets[p];
                let targetEl = null;
                if (Array.isArray(target)) {
                    targetEl = target[round];
                } else {
                    targetEl = target;
                }
                
                if (targetEl) {
                    setTimeout(() => {
                        promises.push(animateSingleDeal(targetEl));
                    }, delay);
                    delay += 150;
                }
            }
        }

        // 12 cards for table
        const tableCardEls = Array.from(tableEl.querySelectorAll('.card:not(.empty-slot):not(.noc-card)'));
        for (let i = 0; i < tableCardEls.length; i++) {
            setTimeout(() => {
                promises.push(animateSingleDeal(tableCardEls[i]));
            }, delay);
            delay += 150;
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

        const animateFlight = (cardObj, startRect, endRect, isFadeOut = false, duration = 500) => {
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
                    
                    if (['J', 'Q', 'K'].includes(cardObj.rank)) {
                        const imgSrc = `/assets/cards/${cardObj.rank}-${cardObj.suit}.png`;
                        cardDiv.innerHTML = `<img src="${imgSrc}" style="width:100%; height:100%; object-fit:contain; border-radius:6px; display:block;" alt="${cardObj.rank} ${sym}" />`;
                        cardDiv.style.padding = '0';
                        cardDiv.style.backgroundColor = 'transparent';
                    } else {
                        cardDiv.innerHTML = `
                            <div class="card-top">${cardObj.rank} ${sym}</div>
                            <div class="card-center">${sym}</div>
                            <div class="card-bottom">${sym} ${cardObj.rank}</div>
                        `;
                    }
                } else {
                    cardDiv.className = `card ${this.getCardBackClass()}`;
                    cardDiv.innerHTML = '<div class="pattern">🂠</div>';
                }

                cardDiv.style.position = 'fixed';
                cardDiv.style.left = `${startRect.left}px`;
                cardDiv.style.top = `${startRect.top}px`;
                cardDiv.style.width = `${startRect.width || 56}px`;
                cardDiv.style.height = `${startRect.height || 84}px`;
                cardDiv.style.margin = '0';
                cardDiv.style.transform = 'none';
                cardDiv.style.transformOrigin = 'top left';
                animLayer.appendChild(cardDiv);

                cardDiv.offsetHeight; // reflow

                cardDiv.style.transition = `transform ${duration / 1000}s cubic-bezier(0.25, 0.8, 0.25, 1), opacity ${duration / 1000}s ease`;
                let scaleX = endRect.width / (startRect.width || 56);
                let scaleY = endRect.height / (startRect.height || 84);
                if (isFadeOut) {
                    scaleX = 0.4;
                    scaleY = 0.4;
                }
                cardDiv.style.transform = `translate(${endRect.left - startRect.left}px, ${endRect.top - startRect.top}px) scale(${scaleX}, ${scaleY})`;
                if (isFadeOut) {
                    cardDiv.style.opacity = '0';
                }

                setTimeout(() => {
                    cardDiv.remove();
                    resolve();
                }, duration);
            });
        };

        const STEP_DELAY = 500;

        // 1. Play card animation
        if (action.played) {
            const playedCard = this.parseCardString(action.played);
            let startRect = seatRect;

            if (activePlayerIndex === this.network.localPlayerIndex) {
                const handCards = seatEl.querySelectorAll('.hand .card');
                for (let el of handCards) {
                    if (el.dataset.rank === playedCard.rank && el.dataset.suit === playedCard.suit) {
                        startRect = el.getBoundingClientRect();
                        el.style.opacity = '0';
                        break;
                    }
                }
            } else {
                const repCard = seatEl.querySelector('.representative-card');
                if (repCard) {
                    startRect = repCard.getBoundingClientRect();
                }
            }

            const actionZone = seatEl.querySelector('.action-zone');
            const primarySlot = actionZone ? actionZone.querySelector('.primary-slot') : null;
            const secondarySlot = actionZone ? actionZone.querySelector('.secondary-slot') : null;
            
            const primarySlotRect = primarySlot ? primarySlot.getBoundingClientRect() : tableRect;
            const secondarySlotRect = secondarySlot ? secondarySlot.getBoundingClientRect() : tableRect;

            // Bước 2: Lá bài từ tay bay tới Play Preview Zone
            await animateFlight(playedCard, startRect, primarySlotRect, false, STEP_DELAY);
            if (primarySlot) {
                const tempCard = this.createCard(playedCard);
                primarySlot.innerHTML = tempCard.innerHTML;
                primarySlot.className = `action-slot primary-slot card ${playedCard.isRed ? 'red' : 'black'} has-card`;
                primarySlot.style.padding = tempCard.style.padding;
                primarySlot.style.backgroundColor = tempCard.style.backgroundColor;
            }

            // Bước 3: Dừng tại đây
            await new Promise(r => setTimeout(r, STEP_DELAY));

            if (action.captured) {
                // TRƯỜNG HỢP B: ĂN ĐƯỢC
                const capturedCards = this.parseCardsString(action.captured);
                let targetEls = [];
                let capturedRects = [];
                const tableCards = Array.from(tableEl.querySelectorAll('.card'));
                const revSuitMap = { 'H': '♥', 'D': '♦', 'S': '♠', 'C': '♣' };
                
                capturedCards.forEach(cc => {
                    for (let el of tableCards) {
                        if (el.dataset.rank === cc.rank && el.dataset.suit === cc.suit && !targetEls.includes(el)) {
                            targetEls.push(el);
                            capturedRects.push(el.getBoundingClientRect());
                            break;
                        }
                    }
                });

                // Bay lần lượt từng lá bài bị ăn vào ô nét đứt bên phải
                for (let i = 0; i < capturedCards.length; i++) {
                    const cc = capturedCards[i];
                    const targetEl = targetEls[i];
                    const rect = capturedRects[i] || tableRect;

                    if (targetEl) {
                        targetEl.classList.add('flash-capture');
                        await new Promise(r => setTimeout(r, STEP_DELAY));
                        targetEl.style.opacity = '0';
                    }

                    await animateFlight(cc, rect, secondarySlotRect, false, STEP_DELAY);
                    if (secondarySlot) {
                        const tempCard = this.createCard(cc);
                        secondarySlot.innerHTML = tempCard.innerHTML;
                        secondarySlot.className = `action-slot secondary-slot card ${cc.isRed ? 'red' : 'black'} has-card`;
                        secondarySlot.style.padding = tempCard.style.padding;
                        secondarySlot.style.backgroundColor = tempCard.style.backgroundColor;
                    }
                    await new Promise(r => setTimeout(r, STEP_DELAY));
                }

                // Bay về khu vực bài ăn
                const sweeps = [
                    animateFlight(playedCard, primarySlotRect, seatRect, true, STEP_DELAY)
                ];
                capturedCards.forEach(cc => {
                    sweeps.push(animateFlight(cc, secondarySlotRect, seatRect, true, STEP_DELAY));
                });
                await Promise.all(sweeps);
                await new Promise(r => setTimeout(r, STEP_DELAY));
            } else {
                // TRƯỜNG HỢP A: KHÔNG ĂN ĐƯỢC
                const innerEmptySlots = Array.from(tableEl.querySelectorAll('.empty-slot.inner-slot'));
                const edgeEmptySlots = Array.from(tableEl.querySelectorAll('.empty-slot.edge-slot'));
                let targetRect = tableRect;
                let targetSlot = null;
                
                if (innerEmptySlots.length > 0) {
                    targetSlot = innerEmptySlots[0];
                    targetRect = targetSlot.getBoundingClientRect();
                } else if (edgeEmptySlots.length > 0) {
                    targetSlot = edgeEmptySlots[0];
                    targetRect = targetSlot.getBoundingClientRect();
                }

                await animateFlight(playedCard, primarySlotRect, targetRect, false, STEP_DELAY);
                
                // Add card visually to the table so the next phase (draw) can find it
                if (targetSlot) {
                    targetSlot.className = `card ${playedCard.isRed ? 'red' : 'black'}`;
                    const suitMap = { 'H': '♥', 'D': '♦', 'S': '♠', 'C': '♣' };
                    const sym = suitMap[playedCard.suit] || '';
                    targetSlot.innerHTML = `
                        <div class="card-top">${playedCard.rank} ${sym}</div>
                        <div class="card-center">${sym}</div>
                        <div class="card-bottom">${sym} ${playedCard.rank}</div>
                    `;
                }

                await new Promise(r => setTimeout(r, STEP_DELAY));
            }

            if (primarySlot) {
                primarySlot.innerHTML = '';
                primarySlot.className = 'action-slot primary-slot';
            }
            if (secondarySlot) {
                secondarySlot.innerHTML = '';
                secondarySlot.className = 'action-slot secondary-slot';
            }
        }

        // PHẦN 2: BỐC QUE
        if (action.drawn) {
            const drawnCard = this.parseCardString(action.drawn);
            const actionZone = seatEl.querySelector('.action-zone');
            const primarySlot = actionZone ? actionZone.querySelector('.primary-slot') : null;
            const secondarySlot = actionZone ? actionZone.querySelector('.secondary-slot') : null;
            const primarySlotRect = primarySlot ? primarySlot.getBoundingClientRect() : tableRect;
            const secondarySlotRect = secondarySlot ? secondarySlot.getBoundingClientRect() : tableRect;

            // Lá trên cùng của QUE bay tới Play Preview Zone
            await animateFlight(drawnCard, nocRect, primarySlotRect, false, STEP_DELAY);
            if (primarySlot) {
                primarySlot.innerHTML = this.createCard(drawnCard).innerHTML;
                primarySlot.className = `action-slot primary-slot card ${drawnCard.isRed ? 'red' : 'black'} has-card`;
            }

            // Dừng 
            await new Promise(r => setTimeout(r, STEP_DELAY));

            if (action.autoCaptured) {
                const autoCapturedCards = this.parseCardsString(action.autoCaptured);
                let targetEls = [];
                let capturedRects = [];
                const tableCards = Array.from(tableEl.querySelectorAll('.card'));
                const revSuitMap = { 'H': '♥', 'D': '♦', 'S': '♠', 'C': '♣' };
                
                autoCapturedCards.forEach(cc => {
                    for (let el of tableCards) {
                        if (el.dataset.rank === cc.rank && el.dataset.suit === cc.suit && !targetEls.includes(el)) {
                            targetEls.push(el);
                            capturedRects.push(el.getBoundingClientRect());
                            break;
                        }
                    }
                });

                // Bay lần lượt từng lá bài bị ăn vào ô nét đứt bên phải
                for (let i = 0; i < autoCapturedCards.length; i++) {
                    const cc = autoCapturedCards[i];
                    const targetEl = targetEls[i];
                    const rect = capturedRects[i] || tableRect;

                    if (targetEl) {
                        targetEl.classList.add('flash-capture');
                        await new Promise(r => setTimeout(r, STEP_DELAY));
                        targetEl.style.opacity = '0';
                    }

                    await animateFlight(cc, rect, secondarySlotRect, false, STEP_DELAY);
                    if (secondarySlot) {
                        secondarySlot.innerHTML = this.createCard(cc).innerHTML;
                        secondarySlot.className = `action-slot secondary-slot card ${cc.isRed ? 'red' : 'black'} has-card`;
                    }
                    await new Promise(r => setTimeout(r, STEP_DELAY));
                }

                // Cả 2 cùng bay về
                const sweeps = [
                    animateFlight(drawnCard, primarySlotRect, seatRect, true, STEP_DELAY)
                ];
                autoCapturedCards.forEach(cc => {
                    sweeps.push(animateFlight(cc, secondarySlotRect, seatRect, true, STEP_DELAY));
                });
                await Promise.all(sweeps);
                await new Promise(r => setTimeout(r, STEP_DELAY));
            } else {
                // Không ăn được
                const innerEmptySlots = Array.from(tableEl.querySelectorAll('.empty-slot.inner-slot'));
                const edgeEmptySlots = Array.from(tableEl.querySelectorAll('.empty-slot.edge-slot'));
                let targetRect = tableRect;
                let targetSlot = null;
                
                if (innerEmptySlots.length > 0) {
                    targetSlot = innerEmptySlots[0];
                    targetRect = targetSlot.getBoundingClientRect();
                } else if (edgeEmptySlots.length > 0) {
                    targetSlot = edgeEmptySlots[0];
                    targetRect = targetSlot.getBoundingClientRect();
                }

                await animateFlight(drawnCard, primarySlotRect, targetRect, false, STEP_DELAY);
                
                // Add card visually to the table
                if (targetSlot) {
                    targetSlot.className = `card ${drawnCard.isRed ? 'red' : 'black'}`;
                    const suitMap = { 'H': '♥', 'D': '♦', 'S': '♠', 'C': '♣' };
                    const sym = suitMap[drawnCard.suit] || '';
                    targetSlot.innerHTML = `
                        <div class="card-top">${drawnCard.rank} ${sym}</div>
                        <div class="card-center">${sym}</div>
                        <div class="card-bottom">${sym} ${drawnCard.rank}</div>
                    `;
                }

                await new Promise(r => setTimeout(r, STEP_DELAY));
            }

            if (primarySlot) {
                primarySlot.innerHTML = '';
                primarySlot.className = 'action-slot primary-slot';
            }
            if (secondarySlot) {
                secondarySlot.innerHTML = '';
                secondarySlot.className = 'action-slot secondary-slot';
            }
        }

        onComplete();
    }
}
