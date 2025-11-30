const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getFiles: () => ipcRenderer.invoke('get-files'),
    readFile: (path) => ipcRenderer.invoke('read-file', path),
    saveFile: (path, content) => ipcRenderer.invoke('save-file', path, content),

    createFile: (folderPath, name) => ipcRenderer.invoke('create-file', folderPath, name),
    createFolder: (folderPath, name) => ipcRenderer.invoke('create-folder', folderPath, name),

    moveEntry: (oldPath, newFolderPath) => ipcRenderer.invoke('move-entry', oldPath, newFolderPath),
    saveOrder: (folderPath, orderList) => ipcRenderer.invoke('save-order', folderPath, orderList),

    deleteFile: (path) => ipcRenderer.invoke('delete-file', path),
    renameFile: (oldPath, newName) => ipcRenderer.invoke('rename-file', oldPath, newName),

    onAhkStatus: (callback) => ipcRenderer.on('ahk-status', (_event, value) => callback(value))
});