let currentFilePath = null;
let saveTimeout = null;
let selectedFolder = null;
let ahkHotstrings = {};
let ahkFilePath = null;

const editor = document.getElementById('editor');
const fileList = document.getElementById('file-list');
const filenameDisplay = document.getElementById('current-filename');
const newFileBtn = document.getElementById('new-file-btn');
const newFolderBtn = document.getElementById('new-folder-btn');
const ahkBtn = document.getElementById('ahk-btn');
const ahkStatus = document.getElementById('ahk-status-text');
const ahkSaveStatus = document.getElementById('ahk-save-status');

const modal = document.getElementById('input-modal');
const modalTitle = document.getElementById('modal-title');
const modalInput = document.getElementById('modal-input');
const modalConfirm = document.getElementById('modal-confirm');
const modalCancel = document.getElementById('modal-cancel');

let modalCallback = null;

async function loadFileList() {
    try {
        const tree = await window.electronAPI.getFiles();
        fileList.innerHTML = '';
        renderTree(tree, fileList);

        window.currentFileTree = tree;
        loadAhkHotstrings();
    } catch (err) {
        console.error("Failed to load file list:", err);
    }
}

async function saveCurrentFile() {
    if (currentFilePath && editor.value) {
        if (saveTimeout) clearTimeout(saveTimeout);

        if (currentFilePath.endsWith('.ahk')) {
            ahkStatus.textContent = "Reloading...";
        }

        const status = await window.electronAPI.saveFile(currentFilePath, editor.value);
        console.log("Auto-saved before switch:", status);

        if (currentFilePath.endsWith('.ahk')) {
            loadAhkHotstrings();
            if (ahkSaveStatus) {
                ahkSaveStatus.textContent = 'Saved';
                ahkSaveStatus.className = 'save-status saved';
            }
        }
    }
}

function renderTree(nodes, container) {
    nodes.forEach(node => {
        if (node.name === 'MyHotkeys.ahk') {
            ahkFilePath = node.path;
            return;
        }

        const itemDiv = document.createElement('div');
        itemDiv.className = 'tree-item';
        itemDiv.draggable = true;

        itemDiv.dataset.path = node.path;
        itemDiv.dataset.type = node.type;

        const content = document.createElement('div');
        content.className = `tree-content ${node.type}`;

        const icon = document.createElement('span');
        icon.className = 'icon';
        icon.textContent = node.type === 'folder' ? '📁' : '📄';

        const text = document.createElement('span');
        text.textContent = node.name;

        content.appendChild(icon);
        content.appendChild(text);
        itemDiv.appendChild(content);

        content.onclick = async (e) => {
            e.stopPropagation();

            await saveCurrentFile();

            document.querySelectorAll('.tree-content').forEach(el => el.classList.remove('active'));
            content.classList.add('active');

            if (node.type === 'file') {
                openFile(node.path, node.name);
            } else {
                selectedFolder = node.path;
                currentFilePath = null;
                filenameDisplay.value = '';
                editor.value = '';
                editor.placeholder = 'Start typing to create a new note in this folder...';

                if (ahkSaveStatus) ahkSaveStatus.style.display = 'none';

                const childrenContainer = itemDiv.querySelector('.tree-children');
                if (childrenContainer) {
                    childrenContainer.style.display = childrenContainer.style.display === 'none' ? 'block' : 'none';
                    icon.textContent = childrenContainer.style.display === 'none' ? '📁' : '📂';
                }
            }
        };

        itemDiv.addEventListener('dragstart', (e) => {
            e.stopPropagation();
            e.dataTransfer.setData('text/plain', node.path);
            e.dataTransfer.effectAllowed = 'move';
            itemDiv.classList.add('dragging');
        });

        itemDiv.addEventListener('dragend', () => {
            itemDiv.classList.remove('dragging');
            document.querySelectorAll('.drag-over-top').forEach(el => el.classList.remove('drag-over-top'));
            document.querySelectorAll('.drag-over-bottom').forEach(el => el.classList.remove('drag-over-bottom'));
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        });

        content.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const rect = content.getBoundingClientRect();
            const offsetY = e.clientY - rect.top;
            const height = rect.height;

            content.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');

            if (node.type === 'file') {
                if (offsetY < height / 2) {
                    content.classList.add('drag-over-top');
                } else {
                    content.classList.add('drag-over-bottom');
                }
            }
            else {
                if (offsetY < height * 0.25) {
                    content.classList.add('drag-over-top');
                } else if (offsetY > height * 0.75) {
                    content.classList.add('drag-over-bottom');
                } else {
                    content.classList.add('drag-over');
                }
            }
        });

        content.addEventListener('dragleave', (e) => {
            e.stopPropagation();
            if (content.contains(e.relatedTarget)) return;
            content.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
        });

        content.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const isTop = content.classList.contains('drag-over-top');
            const isBottom = content.classList.contains('drag-over-bottom');
            const isMoveInto = content.classList.contains('drag-over');

            content.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');

            const draggedPath = e.dataTransfer.getData('text/plain');
            if (draggedPath && draggedPath !== node.path) {
                const separator = node.path.includes('\\') ? '\\' : '/';
                const draggedParent = draggedPath.substring(0, draggedPath.lastIndexOf(separator));
                const targetParent = node.path.substring(0, node.path.lastIndexOf(separator));
                const draggedName = draggedPath.substring(draggedPath.lastIndexOf(separator) + 1);

                if (draggedParent === targetParent && (isTop || isBottom)) {
                    const currentOrder = nodes.map(n => n.name);
                    const newOrder = currentOrder.filter(n => n !== draggedName);
                    const targetIndex = newOrder.indexOf(node.name);

                    if (targetIndex !== -1) {
                        if (isTop) {
                            newOrder.splice(targetIndex, 0, draggedName);
                        } else {
                            newOrder.splice(targetIndex + 1, 0, draggedName);
                        }
                    } else {
                        newOrder.push(draggedName);
                    }

                    await window.electronAPI.saveOrder(draggedParent, newOrder);
                    loadFileList();
                    return;
                }

                let targetFolderPath = node.path;
                if (node.type === 'file') {
                    targetFolderPath = node.path.substring(0, node.path.lastIndexOf(separator));
                }

                if (node.type === 'folder' && node.path.startsWith(draggedPath)) {
                    alert("Cannot move a folder into itself!");
                    return;
                }

                await window.electronAPI.moveEntry(draggedPath, targetFolderPath);
                loadFileList();
            }
        });

        container.appendChild(itemDiv);

        if (node.type === 'folder' && node.children) {
            const childrenDiv = document.createElement('div');
            childrenDiv.className = 'tree-children';
            childrenDiv.style.display = 'none';
            renderTree(node.children, childrenDiv);
            itemDiv.appendChild(childrenDiv);
        }
    });
}

fileList.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileList.classList.add('drag-over-root');
});

fileList.addEventListener('dragleave', () => {
    fileList.classList.remove('drag-over-root');
});

fileList.addEventListener('drop', async (e) => {
    e.preventDefault();
    fileList.classList.remove('drag-over-root');
    const draggedPath = e.dataTransfer.getData('text/plain');

    let dropTargetIsFolder = false;
    let target = e.target;

    while (target && target !== fileList) {
        if (target.classList && target.classList.contains('tree-content')) {
            const treeItem = target.closest('.tree-item');
            if (treeItem && treeItem.dataset.type === 'folder') {
                dropTargetIsFolder = true;
                break;
            }
        }
        target = target.parentElement;
    }

    if (!dropTargetIsFolder && draggedPath) {
        await window.electronAPI.moveEntry(draggedPath, null);
        loadFileList();
    }
});


async function openFile(filepath, filename) {
    currentFilePath = filepath;
    filenameDisplay.value = filename;
    editor.placeholder = 'Start typing...';

    const content = await window.electronAPI.readFile(filepath);
    editor.value = content;

    if (filepath.endsWith('.ahk')) {
        if (ahkSaveStatus) {
            ahkSaveStatus.style.display = 'inline-block';
            ahkSaveStatus.textContent = 'Saved';
            ahkSaveStatus.className = 'save-status saved';
        }
    } else {
        if (ahkSaveStatus) {
            ahkSaveStatus.style.display = 'none';
        }
    }
}

let isCreatingFile = false;
let creationTimeout = null;

editor.addEventListener('input', async (e) => {
    if (currentFilePath && currentFilePath.endsWith('.ahk')) {
        if (ahkSaveStatus) {
            ahkSaveStatus.textContent = 'SAVE';
            ahkSaveStatus.className = 'save-status unsaved';
        }
    }

    handleAhkExpansion(e);

    if (!currentFilePath && selectedFolder && editor.value && !isCreatingFile) {
        if (creationTimeout) clearTimeout(creationTimeout);

        creationTimeout = setTimeout(async () => {
            isCreatingFile = true;

            const firstLine = editor.value.split('\n')[0].trim();
            let filename = firstLine.replace(/[^a-z0-9 \-_]/gi, '').substring(0, 50) || "Untitled";
            filename += ".md";

            try {
                const createdPath = await window.electronAPI.createFile(selectedFolder, filename);
                currentFilePath = createdPath;
                filenameDisplay.value = filename;

                await window.electronAPI.saveFile(currentFilePath, editor.value);
                await loadFileList();
                isCreatingFile = false;
            } catch (err) {
                console.error("Error creating file:", err);
                alert("Failed to create file");
                isCreatingFile = false;
            }
        }, 1000);
        return;
    }

    if (!currentFilePath) return;

    if (currentFilePath.endsWith('.md')) {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
            const status = await window.electronAPI.saveFile(currentFilePath, editor.value);
            console.log(status);
        }, 300);
    }
});

document.addEventListener('keydown', async (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (currentFilePath) {
            if (currentFilePath.endsWith('.ahk')) {
                ahkStatus.textContent = "Reloading...";
            }

            const status = await window.electronAPI.saveFile(currentFilePath, editor.value);
            console.log("Manual Save:", status);

            if (currentFilePath.endsWith('.ahk')) {
                loadAhkHotstrings();
                if (ahkSaveStatus) {
                    ahkSaveStatus.textContent = 'Saved';
                    ahkSaveStatus.className = 'save-status saved';
                }
            }
        }
    }
});

editor.addEventListener('keydown', (e) => {
    if (!currentFilePath || !currentFilePath.endsWith('.ahk')) return;

    if (e.key === '"' || e.key === '(') {
        e.preventDefault();
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const char = e.key;
        const closeChar = char === '"' ? '"' : ')';

        editor.value = editor.value.substring(0, start) + char + closeChar + editor.value.substring(end);

        editor.selectionStart = editor.selectionEnd = start + 1;

        if (ahkSaveStatus) {
            ahkSaveStatus.textContent = 'SAVE';
            ahkSaveStatus.className = 'save-status unsaved';
        }
    }
});

function showModal(title, callback) {
    modalTitle.textContent = title;
    modalInput.value = '';
    modal.style.display = 'flex';
    modalInput.focus();
    modalCallback = callback;
}

function hideModal() {
    modal.style.display = 'none';
    modalCallback = null;
}

modalConfirm.addEventListener('click', () => {
    if (modalCallback && modalInput.value) {
        modalCallback(modalInput.value);
    }
    hideModal();
});

modalCancel.addEventListener('click', () => {
    if (isCreatingFile) {
        editor.value = '';
        isCreatingFile = false;
    }
    hideModal();
});

modalInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        if (modalCallback && modalInput.value) {
            modalCallback(modalInput.value);
        }
        hideModal();
    } else if (e.key === 'Escape') {
        if (isCreatingFile) {
            editor.value = '';
            isCreatingFile = false;
        }
        hideModal();
    }
});

newFileBtn.addEventListener('click', (e) => {
    e.preventDefault();
    showModal("Enter Note Name", async (name) => {
        try {
            const newFilePath = await window.electronAPI.createFile(selectedFolder, name);
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

            editor.focus();

        } catch (err) {
            console.error("Error creating file:", err);
            alert("Failed to create file");
        }
    });
});

newFolderBtn.addEventListener('click', (e) => {
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

ahkBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    await saveCurrentFile();
    if (ahkFilePath) {
        openFile(ahkFilePath, 'MyHotkeys.ahk');
    }
});

fileList.addEventListener('click', async (e) => {
    if (e.target === fileList) {
        await saveCurrentFile();
        selectedFolder = null;
        currentFilePath = null;
        filenameDisplay.value = '';
        editor.value = '';
        editor.placeholder = 'Select a file...';
        document.querySelectorAll('.tree-content').forEach(el => el.classList.remove('active'));
    }
});

window.electronAPI.onAhkStatus((status) => {
    if (status) {
        ahkStatus.textContent = status;
        ahkStatus.style.color = status.includes('Error') ? '#ff5555' : '#55ff55';
    }
});

if (ahkSaveStatus) {
    ahkSaveStatus.addEventListener('click', async (e) => {
        e.preventDefault();
        await saveCurrentFile();
    });
}

async function loadAhkHotstrings() {
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

    const ahkNode = findAhk(window.currentFileTree || []);
    if (ahkNode) {
        const content = await window.electronAPI.readFile(ahkNode.path);
        parseAhk(content);
    }
}

function parseAhk(content) {
    ahkHotstrings = {};
    const lines = content.split('\n');
    lines.forEach(line => {
        const match = line.match(/^::(.+?)::(.*)$/);
        if (match) {
            const trigger = match[1];
            const replacement = match[2];
            ahkHotstrings[trigger] = replacement;
        }
    });
    console.log("Loaded Hotstrings:", ahkHotstrings);
}

function handleAhkExpansion(e) {
    if (!currentFilePath || !currentFilePath.endsWith('.md')) return;

    if (e.inputType === 'insertText' && (e.data === ' ' || e.data === '\n')) {
        const cursorPosition = editor.selectionStart;
        const textBeforeCursor = editor.value.substring(0, cursorPosition - 1);
        for (const [trigger, replacement] of Object.entries(ahkHotstrings)) {
            if (textBeforeCursor.endsWith(trigger)) {
                const start = cursorPosition - 1 - trigger.length;

                const before = editor.value.substring(0, start);
                const after = editor.value.substring(cursorPosition);

                editor.value = before + replacement + e.data + after;

                const newCursorPos = start + replacement.length + 1;
                editor.setSelectionRange(newCursorPos, newCursorPos);
                return;
            }
        }
    }
}

loadFileList();