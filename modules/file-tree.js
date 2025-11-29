import { elements } from './dom.js';
import { state } from './state.js';
import { openFile, saveCurrentFile, loadAhkHotstrings } from './editor.js';

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

export function setupFileTreeListeners() {
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
