import { elements } from './dom.js';
import { state } from './state.js';

let modalCallback = null;

export function showModal(title, callback, confirmText = 'Create') {
    elements.modalTitle.textContent = title;
    elements.modalInput.style.display = 'block';
    elements.modalInput.value = '';
    elements.modalConfirm.textContent = confirmText;
    elements.modal.style.display = 'flex';
    elements.modalInput.focus();
    modalCallback = callback;
}

export function showConfirmModal(title, callback, confirmText = 'Confirm') {
    elements.modalTitle.textContent = title;
    elements.modalInput.style.display = 'none';
    elements.modalConfirm.textContent = confirmText;
    elements.modal.style.display = 'flex';
    elements.modalConfirm.focus();
    modalCallback = callback;
}

export function hideModal() {
    elements.modal.style.display = 'none';
    elements.modalInput.style.display = 'block';
    modalCallback = null;
}

export function setupModalListeners() {
    elements.modalConfirm.addEventListener('click', () => {
        if (modalCallback) {
            if (elements.modalInput.style.display === 'none') {
                modalCallback(true);
            } else if (elements.modalInput.value) {
                modalCallback(elements.modalInput.value);
            }
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
