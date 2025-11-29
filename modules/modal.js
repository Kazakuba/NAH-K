import { elements } from './dom.js';
import { state } from './state.js';

let modalCallback = null;

export function showModal(title, callback) {
    elements.modalTitle.textContent = title;
    elements.modalInput.value = '';
    elements.modal.style.display = 'flex';
    elements.modalInput.focus();
    modalCallback = callback;
}

export function hideModal() {
    elements.modal.style.display = 'none';
    modalCallback = null;
}

export function setupModalListeners() {
    elements.modalConfirm.addEventListener('click', () => {
        if (modalCallback && elements.modalInput.value) {
            modalCallback(elements.modalInput.value);
        }
        hideModal();
    });

    elements.modalCancel.addEventListener('click', () => {
        if (state.isCreatingFile) {
            elements.editor.value = '';
            state.isCreatingFile = false;
        }
        hideModal();
    });

    elements.modalInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            if (modalCallback && elements.modalInput.value) {
                modalCallback(elements.modalInput.value);
            }
            hideModal();
        } else if (e.key === 'Escape') {
            if (state.isCreatingFile) {
                elements.editor.value = '';
                state.isCreatingFile = false;
            }
            hideModal();
        }
    });
}
