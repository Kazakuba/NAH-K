const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getFiles: () => ipcRenderer.invoke('get-files'),
    readFile: (path) => ipcRenderer.invoke('read-file', path),
    saveFile: (path, content) => ipcRenderer.invoke('save-file', path, content),

    createFile: (folderPath, name) => ipcRenderer.invoke('create-file', folderPath, name),
    createFolder: (folderPath, name) => ipcRenderer.invoke('create-folder', folderPath, name),

    moveEntry: (oldPath, newFolderPath) => ipcRenderer.invoke('move-entry', oldPath, newFolderPath),
    saveOrder: (folderPath, orderList) => ipcRenderer.invoke('save-order', folderPath, orderList),

    onAhkStatus: (callback) => ipcRenderer.on('ahk-status', (_event, value) => callback(value))
});