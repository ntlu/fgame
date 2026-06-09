import { RuleEngine } from './RuleEngine.js';

function runTest(name, expected, actual) {
    let result = "FAIL";
    
    if (Array.isArray(expected) && Array.isArray(actual)) {
        if (expected.length === actual.length && expected.every((v, i) => v === actual[i])) {
            result = "PASS";
        }
    } else if (expected === actual) {
        result = "PASS";
    }

    console.log(`[${result}] ${name} | Expected: ${expected} | Actual: ${actual}`);
}

function testCanCapture() {
    console.log("--- testCanCapture ---");
    runTest("A + 9", true, RuleEngine.canCapture({rank: 'A'}, {rank: '9'}));
    runTest("9 + A", true, RuleEngine.canCapture({rank: '9'}, {rank: 'A'}));
    runTest("2 + 8", true, RuleEngine.canCapture({rank: '2'}, {rank: '8'}));
    runTest("5 + 5", true, RuleEngine.canCapture({rank: '5'}, {rank: '5'}));
    runTest("10 + 10", true, RuleEngine.canCapture({rank: '10'}, {rank: '10'}));
    runTest("J + J", true, RuleEngine.canCapture({rank: 'J'}, {rank: 'J'}));
    runTest("Q + Q", true, RuleEngine.canCapture({rank: 'Q'}, {rank: 'Q'}));
    runTest("K + K", true, RuleEngine.canCapture({rank: 'K'}, {rank: 'K'}));
    
    runTest("A + A", false, RuleEngine.canCapture({rank: 'A'}, {rank: 'A'}));
    runTest("2 + 2", false, RuleEngine.canCapture({rank: '2'}, {rank: '2'}));
    runTest("8 + 8", false, RuleEngine.canCapture({rank: '8'}, {rank: '8'}));
    runTest("10 + J", false, RuleEngine.canCapture({rank: '10'}, {rank: 'J'}));
    runTest("Q + K", false, RuleEngine.canCapture({rank: 'Q'}, {rank: 'K'}));
}

function testFindCapturableCards() {
    console.log("--- testFindCapturableCards ---");
    const playedCard = { id: '8D', rank: '8', suit: 'D' };
    const tableCards = [
        { id: '2H', rank: '2', suit: 'H' },
        { id: '7C', rank: '7', suit: 'C' },
        { id: 'AD', rank: 'A', suit: 'D' },
        { id: '2S', rank: '2', suit: 'S' }
    ];
    
    const expectedIds = ['2H', '2S'];
    const actual = RuleEngine.findCapturableCards(playedCard, tableCards);
    const actualIds = actual.map(c => c.id);
    
    runTest("Find 8 pairs with 2s", expectedIds.join(','), actualIds.join(','));
}

function testCalculateCardScore() {
    console.log("--- testCalculateCardScore ---");
    runTest("AH = 20", 20, RuleEngine.calculateCardScore({rank: 'A', suit: 'H'}));
    runTest("AD = 20", 20, RuleEngine.calculateCardScore({rank: 'A', suit: 'D'}));
    runTest("AS = 5", 5, RuleEngine.calculateCardScore({rank: 'A', suit: 'S'}));
    runTest("AC = 5", 5, RuleEngine.calculateCardScore({rank: 'A', suit: 'C'}));
    runTest("8H = 8", 8, RuleEngine.calculateCardScore({rank: '8', suit: 'H'}));
    runTest("8S = 0", 0, RuleEngine.calculateCardScore({rank: '8', suit: 'S'}));
    runTest("KH = 10", 10, RuleEngine.calculateCardScore({rank: 'K', suit: 'H'}));
    runTest("KC = 0", 0, RuleEngine.calculateCardScore({rank: 'K', suit: 'C'}));
}

function testCalculatePlayerScore() {
    console.log("--- testCalculatePlayerScore ---");
    const capturedCards = [
        {rank: 'A', suit: 'H'},
        {rank: '8', suit: 'H'},
        {rank: '9', suit: 'D'},
        {rank: 'K', suit: 'C'},
        {rank: 'A', suit: 'S'}
    ];
    runTest("Player score is 45", 45, RuleEngine.calculatePlayerScore(capturedCards));
}

function testCalculateProfit() {
    console.log("--- testCalculateProfit ---");
    runTest("95 -> 40", 40, RuleEngine.calculateProfit(95));
    runTest("60 -> 5", 5, RuleEngine.calculateProfit(60));
    runTest("55 -> 0", 0, RuleEngine.calculateProfit(55));
    runTest("30 -> -25", -25, RuleEngine.calculateProfit(30));
}

function testHasDoubleCondition() {
    console.log("--- testHasDoubleCondition ---");
    runTest("95 -> true", true, RuleEngine.hasDoubleCondition(95));
    runTest("91 -> true", true, RuleEngine.hasDoubleCondition(91));
    runTest("90 -> false", false, RuleEngine.hasDoubleCondition(90));
    runTest("80 -> false", false, RuleEngine.hasDoubleCondition(80));
}

function testCalculateSettlement() {
    console.log("--- testCalculateSettlement ---");
    const scoresX2 = [95, 60, 30, 35];
    runTest("Settlement with X2", [80, 10, -50, -40].join(','), RuleEngine.calculateSettlement(scoresX2).join(','));

    const scoresNormal = [70, 60, 50, 40];
    runTest("Settlement without X2", [15, 5, -5, -15].join(','), RuleEngine.calculateSettlement(scoresNormal).join(','));
}

export function runAllTests() {
    console.log("===== RUNNING TESTS =====");
    testCanCapture();
    testFindCapturableCards();
    testCalculateCardScore();
    testCalculatePlayerScore();
    testCalculateProfit();
    testHasDoubleCondition();
    testCalculateSettlement();
}

// Chạy tự động
runAllTests();
