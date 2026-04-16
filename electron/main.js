const { app, BrowserWindow, dialog, ipcMain, Notification } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");

const APP_URL = process.env.RALLECT_APP_URL || "https://rallect.ai";
const DEV_URL = process.env.RALLECT_DEV_URL || "http://localhost:3000";
const isDev = !app.isPackaged;

let mainWindow;
let silentUpdateEnabled = true;
let downloadApproved = false;

function sendUpdaterEvent(channel, payload = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function showOfflineFallback() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.loadFile(path.join(__dirname, "offline.html"));
}

function loadApp() {
  const targetUrl = isDev ? DEV_URL : APP_URL;
  mainWindow.loadURL(targetUrl).catch(() => {
    showOfflineFallback();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.on("did-fail-load", () => {
    showOfflineFallback();
  });

  loadApp();
}

function setupAutoUpdate() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.disableWebInstaller = false;

  autoUpdater.on("error", (error) => {
    sendUpdaterEvent("updater:error", { message: error.message });
  });

  autoUpdater.on("checking-for-update", () => {
    sendUpdaterEvent("updater:checking");
  });

  autoUpdater.on("update-not-available", (info) => {
    sendUpdaterEvent("updater:none", { version: info.version });
  });

  autoUpdater.on("update-available", async (info) => {
    sendUpdaterEvent("updater:available", { version: info.version });

    if (silentUpdateEnabled) {
      downloadApproved = true;
      await autoUpdater.downloadUpdate();
      return;
    }

    const choice = await dialog.showMessageBox({
      type: "info",
      title: "Update available",
      message: `Rallect ${info.version} is available.`,
      detail: "Download and install this update now?",
      buttons: ["Download", "Later"],
      defaultId: 0,
      cancelId: 1
    });

    if (choice.response === 0) {
      downloadApproved = true;
      await autoUpdater.downloadUpdate();
    }
  });

  autoUpdater.on("download-progress", (progress) => {
    sendUpdaterEvent("updater:progress", {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total
    });
  });

  autoUpdater.on("update-downloaded", async (info) => {
    sendUpdaterEvent("updater:downloaded", { version: info.version });

    if (silentUpdateEnabled) {
      autoUpdater.quitAndInstall(false, true);
      return;
    }

    const choice = await dialog.showMessageBox({
      type: "question",
      title: "Install update",
      message: "Update is ready to install.",
      detail: "Restart now to finish installing the update?",
      buttons: ["Restart now", "Later"],
      defaultId: 0,
      cancelId: 1
    });

    if (choice.response === 0) {
      autoUpdater.quitAndInstall(false, true);
    } else if (Notification.isSupported()) {
      new Notification({
        title: "Rallect update ready",
        body: "The update will be installed next time you close the app."
      }).show();
    }
  });
}

function setupIpc() {
  ipcMain.handle("updater:check", async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      return { ok: true, updateInfo: result?.updateInfo || null };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  });

  ipcMain.handle("updater:download", async () => {
    try {
      downloadApproved = true;
      await autoUpdater.downloadUpdate();
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  });

  ipcMain.handle("updater:install-now", () => {
    autoUpdater.quitAndInstall(false, true);
    return { ok: true };
  });

  ipcMain.handle("updater:set-silent", (_event, enabled) => {
    silentUpdateEnabled = Boolean(enabled);
    return { ok: true, silent: silentUpdateEnabled };
  });

  ipcMain.handle("updater:get-state", () => {
    return { silent: silentUpdateEnabled, downloadApproved };
  });
}

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdate();
  setupIpc();

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((error) => {
      sendUpdaterEvent("updater:error", { message: error.message });
    });
  }, 8000);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
