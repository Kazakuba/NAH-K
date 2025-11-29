import { elements } from './modules/dom.js';
import { state } from './modules/state.js';
import { setupModalListeners, showModal } from './modules/modal.js';
import { setupEditorListeners, saveCurrentFile, openFile } from './modules/editor.js';
import { loadFileList, setupFileTreeListeners } from './modules/file-tree.js';

// Setup Listeners
setupModalListeners();
setupEditorListeners();
setupFileTreeListeners();

// Button Listeners
elements.newFileBtn.addEventListener('click', (e) => {
    e.preventDefault();
    showModal("Enter Note Name", async (name) => {
        try {
            const newFilePath = await window.electronAPI.createFile(state.selectedFolder, name);
            await loadFileList();

            let finalName = name;
            if (!finalName.endsWith('.md') && !finalName.endsWith('.ahk')) {
                finalName += '.md';
            }

            await openFile(newFilePath, finalName);

            const safePath = newFilePath.replace(/\\/g, '\\\\');
            const newFileItem = document.querySelector(`.tree-item[data-path="${safePath}"] .tree-content`);

            if (newFileItem) {
                document.querySelectorAll('.tree-content').forEach(el => el.classList.remove('active'));
                newFileItem.classList.add('active');
                newFileItem.scrollIntoView({ block: 'center' });
            }

            elements.editor.focus();

        } catch (err) {
            console.error("Error creating file:", err);
            alert("Failed to create file");
        }
    });
});

elements.newFolderBtn.addEventListener('click', (e) => {
    e.preventDefault();
    showModal("Enter Folder Name", async (name) => {
        try {
            await window.electronAPI.createFolder(null, name);
            await loadFileList();
        } catch (err) {
            console.error("Error creating folder:", err);
            alert("Failed to create folder");
        }
    });
});

elements.ahkBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    await saveCurrentFile();
    if (state.ahkFilePath) {
        openFile(state.ahkFilePath, 'MyHotkeys.ahk');
    }
});

if (elements.ahkSaveStatus) {
    elements.ahkSaveStatus.addEventListener('click', async (e) => {
        e.preventDefault();
        await saveCurrentFile();
    });
}

// Electron API Listeners
window.electronAPI.onAhkStatus((status) => {
    if (status) {
        elements.ahkStatus.textContent = status;
        elements.ahkStatus.style.color = status.includes('Error') ? '#ff5555' : '#55ff55';
    }
});

// Initial Load
loadFileList();