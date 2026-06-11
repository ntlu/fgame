import { RuleEngine } from '/shared/RuleEngine.js';

export class UIState {
    constructor() {
        this.selectedHandCardId = null;
        this.selectedTableCardId = null;
        this.capturableTableCardIds = [];
        this.secretCardOpen = false;
    }



    selectHandCard(cardId) {
        if (this.selectedHandCardId === cardId) {
            this.selectedHandCardId = null; // Toggle off nếu click lại
            this.selectedTableCardId = null;
            this.capturableTableCardIds = [];
        } else {
            this.selectedHandCardId = cardId;
            this.selectedTableCardId = null;
        }
    }

    updateCapturableCards(selectedHandCard, tableCards) {
        if (!selectedHandCard) {
            this.capturableTableCardIds = [];
            return;
        }
        const capturable = RuleEngine.findCapturableCards(selectedHandCard, tableCards);
        this.capturableTableCardIds = capturable.map(c => c.id);
    }

    selectTableCard(cardId) {
        if (!this.capturableTableCardIds.includes(cardId)) {
            return;
        }
        
        if (this.selectedTableCardId === cardId) {
            this.selectedTableCardId = null; // Toggle off nếu click lại
        } else {
            this.selectedTableCardId = cardId;
        }
    }

    clearSelection() {
        this.selectedHandCardId = null;
        this.selectedTableCardId = null;
        this.capturableTableCardIds = [];
        this.secretCardOpen = false;
    }

    hasSelection() {
        return this.selectedHandCardId !== null || this.selectedTableCardId !== null;
    }

    canPlay() {
        return this.selectedHandCardId !== null;
    }

    canCaptureSelected() {
        return this.selectedTableCardId !== null && this.capturableTableCardIds.includes(this.selectedTableCardId);
    }
}
