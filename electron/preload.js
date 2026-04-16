const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("rallectUpdater", {
  check: () => ipcRenderer.invoke("updater:check"),
  download: () => ipcRenderer.invoke("updater:download"),
  installNow: () => ipcRenderer.invoke("updater:install-now"),
  setSilentMode: (enabled) => ipcRenderer.invoke("updater:set-silent", enabled),
  getState: () => ipcRenderer.invoke("updater:get-state"),
  onChecking: (callback) => ipcRenderer.on("updater:checking", callback),
  onAvailable: (callback) => ipcRenderer.on("updater:available", (_event, payload) => callback(payload)),
  onProgress: (callback) => ipcRenderer.on("updater:progress", (_event, payload) => callback(payload)),
  onDownloaded: (callback) => ipcRenderer.on("updater:downloaded", (_event, payload) => callback(payload)),
  onNone: (callback) => ipcRenderer.on("updater:none", (_event, payload) => callback(payload)),
  onError: (callback) => ipcRenderer.on("updater:error", (_event, payload) => callback(payload))
});
