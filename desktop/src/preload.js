'use strict';

// Міст оверлею: лише ці виклики, без доступу до Node (contextIsolation + sandbox).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gamecon', {
    onAlert: (callback) => ipcRenderer.on('alert', (_event, alert) => callback(alert)),
    shelter: (on) => ipcRenderer.invoke('shelter', on),
    interactive: (on) => ipcRenderer.send('interactive', on),
    openAlerts: () => ipcRenderer.send('open-alerts'),
});
