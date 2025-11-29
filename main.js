const { app, BrowserWindow, ipcMain, Tray, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let mainWindow;
let tray = null;
let ahkProcess = null;

const NOTES_DIR = path.join(app.getPath('userData'), 'Notes');
const AHK_EXE_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'bin', 'AutoHotkey.exe')
    : path.join(__dirname, 'bin', 'AutoHotkey.exe');
const AHK_SCRIPT_PATH = path.join(app.getPath('userData'), 'active_script.ahk');

if (!fs.existsSync(NOTES_DIR)) {
    fs.mkdirSync(NOTES_DIR, { recursive: true });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, 'icon.png'),
        backgroundColor: '#202020',
        frame: false,
        titleBarStyle: 'hidden',
        titleBarOverlay: { color: '#202020', symbolColor: '#ffffff' },
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    mainWindow.loadFile('index.html');

    mainWindow.webContents.on('did-finish-load', () => {
        reloadAHK();
    });

    mainWindow.on('close', (event) => {
        if (!app.isQuitting) {
            event.preventDefault();
            mainWindow.hide();
            return false;
        }
    });
}

function createTray() {
    const iconPath = path.join(__dirname, 'icon.png');
    if (!fs.existsSync(iconPath)) return;

    tray = new Tray(iconPath);
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Show App', click: () => mainWindow.show() },
        { label: 'Restart AHK', click: () => reloadAHK() },
        { label: 'Quit', click: () => { app.isQuitting = true; stopAHK(); app.quit(); } }
    ]);
    tray.setToolTip('NAH-K');
    tray.setContextMenu(contextMenu);
    tray.on('click', () => mainWindow.show());
}

function stopAHK() {
    if (ahkProcess) {
        try { ahkProcess.kill(); } catch (e) { console.log("Error killing AHK", e); }
        ahkProcess = null;
    }
}

function reloadAHK() {
    stopAHK();
    if (!fs.existsSync(AHK_EXE_PATH)) {
        if (mainWindow) mainWindow.webContents.send('ahk-status', 'Error: AHK Exe missing');
        return;
    }
    ahkProcess = spawn(AHK_EXE_PATH, [AHK_SCRIPT_PATH]);
    ahkProcess.on('error', (err) => {
        if (mainWindow) mainWindow.webContents.send('ahk-status', 'Error starting AHK');
    });
    if (mainWindow) mainWindow.webContents.send('ahk-status', 'Active');
}

function getFileTree(dir) {
    const results = [];
    let list = [];
    try {
        list = fs.readdirSync(dir);
    } catch (e) {
        console.error(`Error reading directory ${dir}:`, e);
        return [];
    }

    const orderFile = path.join(dir, '_folder_order.json');
    let customOrder = [];
    if (fs.existsSync(orderFile)) {
        try {
            customOrder = JSON.parse(fs.readFileSync(orderFile, 'utf-8'));
        } catch (e) {
            console.error("Error parsing order file:", e);
        }
    }

    list.forEach(file => {
        if (file === '_folder_order.json') return;

        const fullPath = path.join(dir, file);
        let stat;
        try {
            stat = fs.statSync(fullPath);
        } catch (e) {
            return;
        }

        if (stat && stat.isDirectory()) {
            results.push({
                name: file,
                path: fullPath,
                type: 'folder',
                children: getFileTree(fullPath)
            });
        } else {
            if (file.endsWith('.md') || file.endsWith('.ahk')) {
                results.push({
                    name: file,
                    path: fullPath,
                    type: 'file'
                });
            }
        }
    });

    if (customOrder.length > 0) {
        results.sort((a, b) => {
            const indexA = customOrder.indexOf(a.name);
            const indexB = customOrder.indexOf(b.name);

            if (indexA !== -1 && indexB !== -1) {
                return indexA - indexB;
            }

            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;

            if (a.type === 'folder' && b.type !== 'folder') return -1;
            if (a.type !== 'folder' && b.type === 'folder') return 1;
            return a.name.localeCompare(b.name);
        });
    } else {
        results.sort((a, b) => {
            if (a.type === 'folder' && b.type !== 'file') return -1;
            if (a.type === 'file' && b.type === 'folder') return 1;
            return a.name.localeCompare(b.name);
        });
    }

    return results;
}


ipcMain.handle('get-files', async () => {
    return getFileTree(NOTES_DIR);
});

ipcMain.handle('read-file', async (event, filepath) => {
    if (fs.existsSync(filepath)) return fs.readFileSync(filepath, 'utf-8');
    return '';
});

ipcMain.handle('save-file', async (event, filepath, content) => {
    fs.writeFileSync(filepath, content, 'utf-8');
    if (path.basename(filepath) === 'MyHotkeys.ahk') {
        fs.writeFileSync(AHK_SCRIPT_PATH, content, 'utf-8');
        reloadAHK();
        return "Saved & Reloaded AHK";
    }
    return "Saved";
});

ipcMain.handle('create-file', async (event, folderPath, filename) => {
    const targetDir = folderPath || NOTES_DIR;
    if (!filename.endsWith('.md') && !filename.endsWith('.ahk')) filename += '.md';
    const filepath = path.join(targetDir, filename);
    fs.writeFileSync(filepath, '', 'utf-8');
    return filepath;
});

ipcMain.handle('create-folder', async (event, folderPath, folderName) => {
    const targetDir = folderPath || NOTES_DIR;
    const fullPath = path.join(targetDir, folderName);
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath);
    }
    return fullPath;
});

ipcMain.handle('move-entry', async (event, oldPath, newFolderPath) => {
    const fileName = path.basename(oldPath);
    const targetDir = newFolderPath || NOTES_DIR;
    const newPath = path.join(targetDir, fileName);

    if (oldPath !== newPath) {
        fs.renameSync(oldPath, newPath);
        return true;
    }
    return false;
});

ipcMain.handle('save-order', async (event, folderPath, orderList) => {
    const targetDir = folderPath || NOTES_DIR;
    const orderFile = path.join(targetDir, '_folder_order.json');
    fs.writeFileSync(orderFile, JSON.stringify(orderList, null, 2), 'utf-8');
    return true;
});

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });
}

app.whenReady().then(() => {
    createWindow();
    createTray();

    const ahkFile = path.join(NOTES_DIR, 'MyHotkeys.ahk');
    if (!fs.existsSync(ahkFile)) {
        const defaultAHK = `
^1::SendEvent("Walking through quiet streets under a bruised violet sky, I thought about how tiny choices—paused steps, unsent messages, half-spoken truths—slowly stack into a life that only makes sense from a distance.")
^2::SendText("She rearranged the cluttered desk, hoping aligned notebooks and coffee mugs might somehow untangle the knotted timeline of missed chances and delayed dreams.")
^3::Send("As the train rattled past flickering lights full of screen-lit strangers, he realized the real movement came not from the cars but from the shifting hopes each traveler carried.")`;
        fs.writeFileSync(ahkFile, defaultAHK);
        fs.writeFileSync(AHK_SCRIPT_PATH, defaultAHK);
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});