**NAH-K** is a lightweight desktop notes app built with **Electron**
that integrates **AutoHotkey (AHK)** for real-time text expansion
directly inside your markdown notes.

Manage notes, folders, and hotstrings in one place --- then let AHK
auto-type saved expansions anywhere in Windows.

------------------------------------------------------------------------

## ✨ Features

### 📝 Smart Notes Editor

-   Markdown (.md) note editing with autosave\
-   Folder + sub-folder organization\
-   Drag & drop to move and reorder files\
-   Automatic note creation while typing in empty folders\
-   Persistent custom sort order

### ⚡ Built-In AutoHotkey Manager

-   Edit `MyHotkeys.ahk` inside the app\
-   Instant reload of AHK after saving\
-   Hotstrings expand live inside notes

### 🖥️ Desktop Experience

-   Frameless dark UI
-   System tray support\
-   Start/Restart AHK from tray\
-   Desktop + Start Menu shortcuts

------------------------------------------------------------------------

## 🚀 Installation (Users)

1.  Download latest installer.
2.  Run `NAH-K Setup.exe`.
3.  Follow install prompts.
4.  Launch from Desktop or Start.

------------------------------------------------------------------------

## 🛠️ Development

### Requirements

-   Node 18+
-   npm
-   Windows

### Install

``` bash
npm install
```

### Run

``` bash
npm start
```

### Build Installer

``` bash
npm run build
```

The installer will appear in the `dist/` folder.

------------------------------------------------------------------------

## 🔁 Notes Storage

Saved locally to:

    %APPDATA%/NAH-K/Notes/


