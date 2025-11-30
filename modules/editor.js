import { elements } from './dom.js';
import { state } from './state.js';
import { loadFileList } from './file-tree.js';

export async function saveCurrentFile() {
    if (!state.currentFilePath && elements.editor.value && !state.isCreatingFile) {
        if (state.creationTimeout) clearTimeout(state.creationTimeout);
        await createNewNote();
        return;
    }

    if (state.currentFilePath && elements.editor.value) {
        if (state.saveTimeout) clearTimeout(state.saveTimeout);

        if (state.currentFilePath.endsWith('.ahk')) {
            elements.ahkStatus.textContent = "Reloading...";
        }

        const status = await window.electronAPI.saveFile(state.currentFilePath, elements.editor.value);
        console.log("Auto-saved before switch:", status);

        if (state.currentFilePath.endsWith('.ahk')) {
            loadAhkHotstrings();
            if (elements.ahkSaveStatus) {
                elements.ahkSaveStatus.textContent = 'Saved';
                elements.ahkSaveStatus.className = 'save-status saved';
            }
        }
    }
}

async function createNewNote() {
    state.isCreatingFile = true;

    const firstLine = elements.editor.value.split('\n')[0].trim();
    let filename = firstLine.replace(/[^a-z0-9 \-_]/gi, '').substring(0, 50) || "Untitled";
    filename += ".md";

    try {
        const createdPath = await window.electronAPI.createFile(state.selectedFolder, filename);
        state.currentFilePath = createdPath;
        elements.filenameDisplay.value = filename;

        await window.electronAPI.saveFile(state.currentFilePath, elements.editor.value);
        await loadFileList();
        state.isCreatingFile = false;
    } catch (err) {
        console.error("Error creating file:", err);
        alert("Failed to create file");
        state.isCreatingFile = false;
    }
}

export async function openFile(filepath, filename) {
    state.currentFilePath = filepath;
    const displayName = filename.endsWith('.md') ? filename.slice(0, -3) : filename;
    elements.filenameDisplay.value = displayName;
    elements.filenameDisplay.disabled = false;
    delete elements.filenameDisplay.dataset.empty;
    elements.filenameDisplay.readOnly = false;
    if (elements.filenameDisplay.resize) elements.filenameDisplay.resize();
    elements.editor.placeholder = 'Start typing...';

    const content = await window.electronAPI.readFile(filepath);
    elements.editor.value = content;

    if (filepath.endsWith('.ahk')) {
        if (elements.ahkSaveStatus) {
            elements.ahkSaveStatus.style.display = 'inline-block';
            elements.ahkSaveStatus.textContent = 'Saved';
            elements.ahkSaveStatus.className = 'save-status saved';
        }
    } else {
        if (elements.ahkSaveStatus) {
            elements.ahkSaveStatus.style.display = 'none';
        }
    }
}

export async function loadAhkHotstrings() {
    const findAhk = (nodes) => {
        for (const node of nodes) {
            if (node.name === 'MyHotkeys.ahk') return node;
            if (node.children) {
                const found = findAhk(node.children);
                if (found) return found;
            }
        }
        return null;
    };

    const ahkNode = findAhk(state.currentFileTree || []);
    if (ahkNode) {
        const content = await window.electronAPI.readFile(ahkNode.path);
        parseAhk(content);
    }
}

function parseAhk(content) {
    state.ahkHotstrings = {};
    const lines = content.split('\n');
    lines.forEach(line => {
        const match = line.match(/^::(.+?)::(.*)$/);
        if (match) {
            const trigger = match[1];
            const replacement = match[2];
            state.ahkHotstrings[trigger] = replacement;
        }
    });
    console.log("Loaded Hotstrings:", state.ahkHotstrings);
}

export function handleAhkExpansion(e) {
    if (!state.currentFilePath || !state.currentFilePath.endsWith('.md')) return;

    if (e.inputType === 'insertText' && (e.data === ' ' || e.data === '\n')) {
        const cursorPosition = elements.editor.selectionStart;
        const textBeforeCursor = elements.editor.value.substring(0, cursorPosition - 1);
        for (const [trigger, replacement] of Object.entries(state.ahkHotstrings)) {
            if (textBeforeCursor.endsWith(trigger)) {
                const start = cursorPosition - 1 - trigger.length;

                const before = elements.editor.value.substring(0, start);
                const after = elements.editor.value.substring(cursorPosition);

                elements.editor.value = before + replacement + e.data + after;

                const newCursorPos = start + replacement.length + 1;
                elements.editor.setSelectionRange(newCursorPos, newCursorPos);
                return;
            }
        }
    }
}

export function setupEditorListeners() {
    elements.editor.addEventListener('input', async (e) => {
        if (state.currentFilePath && state.currentFilePath.endsWith('.ahk')) {
            if (elements.ahkSaveStatus) {
                elements.ahkSaveStatus.textContent = 'SAVE';
                elements.ahkSaveStatus.className = 'save-status unsaved';
            }
        }

        handleAhkExpansion(e);

        if (!state.currentFilePath && elements.editor.value && !state.isCreatingFile) {
            if (state.creationTimeout) clearTimeout(state.creationTimeout);

            state.creationTimeout = setTimeout(async () => {
                await createNewNote();
            }, 500);
            return;
        }

        if (!state.currentFilePath) return;

        if (state.currentFilePath.endsWith('.md')) {
            if (state.saveTimeout) clearTimeout(state.saveTimeout);
            state.saveTimeout = setTimeout(async () => {
                const status = await window.electronAPI.saveFile(state.currentFilePath, elements.editor.value);
                console.log(status);
            }, 300);
        }
    });

    document.addEventListener('keydown', async (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            if (state.currentFilePath) {
                if (state.currentFilePath.endsWith('.ahk')) {
                    elements.ahkStatus.textContent = "Reloading...";
                }

                const status = await window.electronAPI.saveFile(state.currentFilePath, elements.editor.value);
                console.log("Manual Save:", status);

                if (state.currentFilePath.endsWith('.ahk')) {
                    loadAhkHotstrings();
                    if (elements.ahkSaveStatus) {
                        elements.ahkSaveStatus.textContent = 'Saved';
                        elements.ahkSaveStatus.className = 'save-status saved';
                    }
                }
            }
        }
    });

    elements.editor.addEventListener('keydown', (e) => {
        if (!state.currentFilePath || !state.currentFilePath.endsWith('.ahk')) return;

        if (e.key === '"' || e.key === '(') {
            e.preventDefault();
            const start = elements.editor.selectionStart;
            const end = elements.editor.selectionEnd;
            const char = e.key;
            const closeChar = char === '"' ? '"' : ')';

            elements.editor.value = elements.editor.value.substring(0, start) + char + closeChar + elements.editor.value.substring(end);

            elements.editor.selectionStart = elements.editor.selectionEnd = start + 1;

            if (elements.ahkSaveStatus) {
                elements.ahkSaveStatus.textContent = 'SAVE';
                elements.ahkSaveStatus.className = 'save-status unsaved';
            }
        }
    });

    // Editable Title Logic
    const resizeTitle = () => {
        const span = document.createElement('span');
        span.style.font = window.getComputedStyle(elements.filenameDisplay).font;
        span.style.visibility = 'hidden';
        span.style.position = 'absolute';
        span.textContent = elements.filenameDisplay.value || elements.filenameDisplay.placeholder;
        document.body.appendChild(span);
        elements.filenameDisplay.style.width = `${span.offsetWidth + 20}px`;
        document.body.removeChild(span);
    };

    elements.filenameDisplay.addEventListener('input', resizeTitle);
    elements.filenameDisplay.resize = resizeTitle;

    elements.filenameDisplay.addEventListener('blur', () => {
        renameCurrentFile();
    });

    elements.filenameDisplay.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            elements.filenameDisplay.blur();
        }
    });
}

async function renameCurrentFile() {
    const targetPath = state.currentFilePath || state.selectedFolder;
    if (!targetPath) return;

    const newName = elements.filenameDisplay.value.trim();
    const originalName = targetPath.split(/[\\/]/).pop();
    const isFile = !!state.currentFilePath;

    if (!newName) {
        const displayName = (isFile && originalName.endsWith('.md')) ? originalName.slice(0, -3) : originalName;
        elements.filenameDisplay.value = displayName;
        if (elements.filenameDisplay.resize) elements.filenameDisplay.resize();
        return;
    }

    const currentDisplayName = (isFile && originalName.endsWith('.md')) ? originalName.slice(0, -3) : originalName;

    if (newName === currentDisplayName) return;

    let finalName = newName;
    if (isFile && targetPath.endsWith('.md') && !finalName.endsWith('.md')) {
        finalName += '.md';
    }

    const newPath = await window.electronAPI.renameFile(targetPath, finalName);
    if (newPath) {
        if (isFile) {
            state.currentFilePath = newPath;
        } else {
            state.selectedFolder = newPath;
        }
        loadFileList();
    } else {
        alert("Failed to rename item (maybe name exists?).");
        elements.filenameDisplay.value = currentDisplayName;
        if (elements.filenameDisplay.resize) elements.filenameDisplay.resize();
    }
}
