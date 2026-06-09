import { GameState } from './GameState.js';
import { GameManager } from './GameManager.js';
import { TurnEngine } from './TurnEngine.js';
import { AIEngine } from './AIEngine.js';

function runTest(name, expected, actual) {
    let result = "FAIL";
    if (expected === actual) {
        result = "PASS";
    }
    console.log(`[${result}] ${name} | Expected: ${expected} | Actual: ${actual}`);
}

function testTurnEngine() {
    console.log("===== RUNNING STABILITY TESTS =====");
    
    const gameState = new GameState();
    const gameManager = new GameManager(gameState);
    
    // Start fake round
    gameManager.startNewRound();
    const turnEngine = new TurnEngine(gameState);
    
    // Setup state
    gameState.currentPlayerIndex = 0;
    gameState.deck = [{id: 'KD', rank: 'K', suit: 'D'}, {id: '9C', rank: '9', suit: 'C'}];
    gameState.tableCards = [{id: '2H', rank: '2', suit: 'H'}, {id: 'AC', rank: 'A', suit: 'C'}, {id: '3D', rank: '3', suit: 'D'}];
    gameState.players[0].hand = [{id: '8D', rank: '8', suit: 'D'}, {id: '5S', rank: '5', suit: 'S'}, {id: '8C', rank: '8', suit: 'C'}];
    gameState.players[0].capturedCards = [];

    // test playCard Exceptions
    let indexNegativeError = false;
    try { turnEngine.playCard(0, -1); } catch (e) { indexNegativeError = true; }
    runTest("playCard() index âm throw error", true, indexNegativeError);

    let indexOutOfBoundsError = false;
    try { turnEngine.playCard(0, 999); } catch (e) { indexOutOfBoundsError = true; }
    runTest("playCard() vượt giới hạn throw error", true, indexOutOfBoundsError);

    // test validateCaptureSelection
    const isValidCapture = turnEngine.validateCaptureSelection({id: '8D', rank: '8', suit: 'D'}, {id: '2H', rank: '2', suit: 'H'});
    const isInvalidCapture = turnEngine.validateCaptureSelection({id: '8C', rank: '8', suit: 'C'}, {id: '3D', rank: '3', suit: 'D'});
    const isInvalidCaptureNull = turnEngine.validateCaptureSelection({id: '8D', rank: '8', suit: 'D'}, null);
    runTest("validateCaptureSelection() hợp lệ -> true", true, isValidCapture);
    runTest("validateCaptureSelection() không hợp lệ -> false", false, isInvalidCapture);
    runTest("validateCaptureSelection() với null -> false", false, isInvalidCaptureNull);

    // test processPlay capture hợp lệ
    const playResultValid = turnEngine.processPlay(0, 0, 0); // Đánh 8D ăn 2H
    runTest("processPlay() capture hợp lệ -> captured=true", true, playResultValid.captured);
    
    // test processPlay capture KHÔNG hợp lệ (cố tình ăn lá sai luật)
    // bài trên tay hiện tại (index 1 cũ giờ thành 0): 5S, 8C. Bàn: AC, 3D
    const playResultInvalid = turnEngine.processPlay(0, 1, 1); // Đánh 8C cố ăn 3D
    runTest("processPlay() capture không hợp lệ -> captured=false", false, playResultInvalid.captured);
    runTest("processPlay() không hợp lệ đưa bài xuống bàn", 3, gameState.tableCards.length); // AC, 3D, 8C

    // test nextTurn xoay đúng vòng linh hoạt với số lượng player
    gameState.currentPlayerIndex = 0; // P1
    turnEngine.nextTurn();
    runTest("nextTurn() P1 -> P2", 1, gameState.currentPlayerIndex);
    turnEngine.nextTurn();
    runTest("nextTurn() P2 -> P3", 2, gameState.currentPlayerIndex);
    turnEngine.nextTurn();
    runTest("nextTurn() P3 -> P4", 3, gameState.currentPlayerIndex);
    turnEngine.nextTurn();
    runTest("nextTurn() P4 -> P1", 0, gameState.currentPlayerIndex);

    // test processDraw
    gameState.deck = [{id: 'AD', rank: 'A', suit: 'D'}];
    gameState.tableCards = [{id: '9H', rank: '9', suit: 'H'}];
    // Giả sử có chức năng chọn table card khi bốc nọc
    const drawResultValid = turnEngine.processDraw(0, 0); // Bốc AD ăn 9H
    runTest("processDraw() capture hợp lệ -> captured=true", true, drawResultValid.captured);
    
    gameState.deck = [{id: '7S', rank: '7', suit: 'S'}];
    const drawResultDrop = turnEngine.processDraw(0, null); // Không chọn -> đặt xuống bàn
    runTest("processDraw() không chọn bàn -> captured=false", false, drawResultDrop.captured);
    runTest("processDraw() đặt lá bốc xuống bàn", 1, gameState.tableCards.length);

    // test isRoundFinished
    gameState.deck = [];
    gameState.players.forEach(p => p.hand = []);
    runTest("isRoundFinished() khi hết bài", true, turnEngine.isRoundFinished());
    gameState.deck = [{id: '10H', rank: '10', suit: 'H'}];
    runTest("isRoundFinished() khi deck còn bài", false, turnEngine.isRoundFinished());
}

function testSimulation() {
    console.log("===== RUNNING SIMULATION =====");
    const gameState = new GameState();
    const gameManager = new GameManager(gameState);
    gameManager.startNewRound();
    
    const turnEngine = new TurnEngine(gameState);
    AIEngine.simulateSingleTurn(turnEngine);
}

testTurnEngine();
testSimulation();
