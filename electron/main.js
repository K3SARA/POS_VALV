const { app, BrowserWindow } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");

let backendProcess = null;
let logFile = null;

function log(msg) {
  try {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    if (logFile) fs.appendFileSync(logFile, line);
  } catch {
    // ignore logging failures
  }
}

function startBackend() {
  const isDev = !app.isPackaged;
  const backendDir = isDev
    ? path.join(__dirname, "..", "backend")
    : path.join(process.resourcesPath, "backend");

  const dbPath = path.join(app.getPath("userData"), "pos.db");
  const databaseUrl = `file:${dbPath}`;

  const backendEntry = path.join(backendDir, "dist", "index.js");
  const nodeArgs = ["--runAsNode", backendEntry];

  log(`Backend dir: ${backendDir}`);
  log(`Backend entry: ${backendEntry}`);
  log(`DB path: ${dbPath}`);

  backendProcess = spawn(process.execPath, nodeArgs, {
    cwd: backendDir,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "ignore",
    windowsHide: true,
  });

  backendProcess.on("exit", (code) => {
    backendProcess = null;
    if (code && code !== 0) {
      log(`Backend exited with code: ${code}`);
    }
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    win.loadURL(process.env.ELECTRON_START_URL || "http://localhost:3000");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    const indexPath = path.join(process.resourcesPath, "frontend", "build", "index.html");
    win.loadFile(indexPath);
  }

  win.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
    log(`Renderer failed to load: ${errorCode} ${errorDescription}`);
  });

  win.webContents.on("render-process-gone", (event, details) => {
    log(`Renderer process gone: ${details.reason}`);
  });
}

app.whenReady().then(() => {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("disable-gpu");

  logFile = path.join(app.getPath("userData"), "pos-desktop.log");
  log("App starting...");

  startBackend();
  createWindow();
  if (process.env.ENABLE_UPDATES === "1") {
    setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 15000);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
  if (process.platform !== "darwin") app.quit();
});
