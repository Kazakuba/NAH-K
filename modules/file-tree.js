import { elements } from './dom.js';
import { state } from './state.js';
import { openFile, saveCurrentFile, loadAhkHotstrings } from './editor.js';
import { showModal } from './modal.js';

export async function loadFileList() {
    try {
        const tree = await window.electronAPI.getFiles();
        elements.fileList.innerHTML = '';
        renderTree(tree, elements.fileList);

        state.currentFileTree = tree;
        loadAhkHotstrings();
    } catch (err) {
        console.error("Failed to load file list:", err);
    }
}

function renderTree(nodes, container) {
    nodes.forEach(node => {
        if (node.name === 'MyHotkeys.ahk') {
            state.ahkFilePath = node.path;
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
        text.textContent = node.name.endsWith('.md') ? node.name.slice(0, -3) : node.name;

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
                state.selectedFolder = node.path;
                state.currentFilePath = null;
                elements.filenameDisplay.value = '';
                elements.editor.value = '';
                elements.editor.placeholder = 'Start typing to create a new note in this folder...';

                if (elements.ahkSaveStatus) elements.ahkSaveStatus.style.display = 'none';

                const childrenContainer = itemDiv.querySelector('.tree-children');
                if (childrenContainer) {
                    childrenContainer.style.display = childrenContainer.style.display === 'none' ? 'block' : 'none';
                    icon.textContent = childrenContainer.style.display === 'none' ? '📁' : '📂';
                }
            }
        };

        content.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showContextMenu(e.pageX, e.pageY, node);
        });

        content.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            console.log("Double click detected on", node.name);
            if (node.type === 'file') {
                handleRename(node);
            } else {
                handleRename(node);
            }
        });

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

let contextMenuTarget = null;

function showContextMenu(x, y, node) {
    contextMenuTarget = node;
    elements.contextMenu.style.display = 'block';
    elements.contextMenu.style.left = `${x}px`;
    elements.contextMenu.style.top = `${y}px`;
}

function hideContextMenu() {
    elements.contextMenu.style.display = 'none';
    contextMenuTarget = null;
}

async function handleDelete() {
    console.log("handleDelete called", contextMenuTarget);
    if (!contextMenuTarget) return;
    if (confirm(`Are you sure you want to delete "${contextMenuTarget.name}"?`)) {
        const success = await window.electronAPI.deleteFile(contextMenuTarget.path);
        if (success) {
            if (state.currentFilePath === contextMenuTarget.path) {
                state.currentFilePath = null;
                elements.editor.value = '';
                elements.filenameDisplay.value = '';
            }
            loadFileList();
        } else {
            alert("Failed to delete item.");
        }
    }
    hideContextMenu();
}

function handleRename(node) {
    console.log("handleRename called", node);
    const currentName = node.name.endsWith('.md') ? node.name.slice(0, -3) : node.name;

    showModal(`Rename ${currentName}`, (newName) => {
        if (newName && newName !== currentName) {
            let finalName = newName;
            if (node.type === 'file' && !finalName.endsWith('.md') && !finalName.endsWith('.ahk')) {
                finalName += '.md';
            }
            performRename(node.path, finalName);
        }
    });
}

async function performRename(oldPath, newName) {
    const newPath = await window.electronAPI.renameFile(oldPath, newName);
    if (newPath) {
        if (state.currentFilePath === oldPath) {
            state.currentFilePath = newPath;
            elements.filenameDisplay.value = newName;
        }
        loadFileList();
    } else {
        alert("Failed to rename item (maybe name exists?).");
    }
}

export function setupFileTreeListeners() {
    document.addEventListener('click', () => {
        hideContextMenu();
    });

    if (elements.ctxDelete) {
        elements.ctxDelete.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log("ctxDelete clicked");
            handleDelete();
        });
    }

    if (elements.ctxRename) {
        elements.ctxRename.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log("ctxRename clicked");
            if (contextMenuTarget) {
                handleRename(contextMenuTarget);
                hideContextMenu();
            }
        });
    }

    elements.fileList.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.fileList.classList.add('drag-over-root');
    });


    elements.fileList.addEventListener('dragleave', () => {
        elements.fileList.classList.remove('drag-over-root');
    });

    elements.fileList.addEventListener('drop', async (e) => {
        e.preventDefault();
        elements.fileList.classList.remove('drag-over-root');
        const draggedPath = e.dataTransfer.getData('text/plain');

        let dropTargetIsFolder = false;
        let target = e.target;

        while (target && target !== elements.fileList) {
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

    elements.fileList.addEventListener('click', async (e) => {
        if (e.target === elements.fileList) {
            await saveCurrentFile();
            state.selectedFolder = null;
            state.currentFilePath = null;
            elements.filenameDisplay.value = '';
            elements.editor.value = '';
            elements.editor.placeholder = 'Select a file...';
            document.querySelectorAll('.tree-content').forEach(el => el.classList.remove('active'));
        }
    });
}
