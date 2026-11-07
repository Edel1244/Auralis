// AURALIS desktop shell (Electron main process).
//
// The app is a secure window onto an AURALIS server. On first launch (or when
// the server can't be reached) it shows a local setup screen asking for the
// server address. Accounts, music and the community live on that server.

const { app, BrowserWindow, Menu, dialog, ipcMain, shell, session } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { checkForUpdates } = require("./update");

const SETUP_PAGE = path.join(__dirname, "setup", "index.html");
const SETUP_URL = pathToFileURL(SETUP_PAGE).href;
const configPath = () => path.join(app.getPath("userData"), "config.json");

/** @returns {{ serverUrl?: string, bounds?: Electron.Rectangle, maximized?: boolean, skippedVersion?: string }} */
function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath(), "utf8"));
  } catch {
    return {};
  }
}

function writeConfig(patch) {
  const next = { ...readConfig(), ...patch };
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(next, null, 2));
  return next;
}

/** localhost, loopback, private IPv4 ranges, *.local/*.lan names and bare machine names. */
function isLocalAddress(hostish) {
  const host = String(hostish).replace(/^\[/, "").split(/[\]/:]/)[0].toLowerCase();
  return (
    host === "localhost" ||
    host === "" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /\.(local|lan|home|internal)$/.test(host) ||
    /^[a-z0-9-]+$/.test(host)
  );
}

/** Normalizes user input to an http(s) origin, or returns null. */
function normalizeServerUrl(input) {
  let raw = String(input || "").trim();
  if (!raw) return null;
  // Without a scheme: local and home-network addresses (where self-hosted servers
  // usually run plain HTTP) get http://, everything else https://.
  if (!/^https?:\/\//i.test(raw)) raw = (isLocalAddress(raw) ? "http://" : "https://") + raw;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

/** Checks that an AURALIS server answers at `origin` (GET /api/v1/health). */
async function probeServer(origin) {
  try {
    const res = await fetch(`${origin}/api/v1/health`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const body = await res.json().catch(() => null);
    if (!body || typeof body !== "object" || !("status" in body || "db" in body || "ok" in body)) return { ok: false, reason: "not-auralis" };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e && e.name === "TimeoutError" ? "timeout" : "unreachable" };
  }
}

/** @type {BrowserWindow | null} */
let win = null;

function serverOrigin() {
  return normalizeServerUrl(readConfig().serverUrl);
}

function showSetup(reason) {
  if (!win) return;
  void win.loadFile(SETUP_PAGE, { query: { server: readConfig().serverUrl || "", reason: reason || "" } });
}

async function openServer() {
  const origin = serverOrigin();
  if (!origin) return showSetup("");
  const probe = await probeServer(origin);
  if (!probe.ok) return showSetup(probe.reason);
  await win.loadURL(`${origin}/home`);
}

function createWindow() {
  const cfg = readConfig();
  win = new BrowserWindow({
    width: cfg.bounds?.width || 1280,
    height: cfg.bounds?.height || 820,
    x: cfg.bounds?.x,
    y: cfg.bounds?.y,
    minWidth: 380,
    minHeight: 560,
    backgroundColor: "#080B10",
    title: "AURALIS",
    icon: path.join(__dirname, "build", "icon.png"),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  if (cfg.maximized) win.maximize();
  win.once("ready-to-show", () => win && win.show());

  const saveBounds = () => {
    if (!win || win.isDestroyed()) return;
    writeConfig({ bounds: win.getNormalBounds(), maximized: win.isMaximized() });
  };
  win.on("close", saveBounds);

  const wc = win.webContents;

  // Only the configured server and the local setup page may load in the window;
  // every other link opens in the user's browser.
  const isInternal = (url) => {
    if (url.startsWith("file:")) return url.split(/[?#]/)[0] === SETUP_URL;
    const origin = serverOrigin();
    try {
      return Boolean(origin) && new URL(url).origin === origin;
    } catch {
      return false;
    }
  };
  const openExternal = (url) => {
    if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) void shell.openExternal(url);
  };
  wc.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: "deny" };
  });
  wc.on("will-navigate", (e, url) => {
    if (isInternal(url)) return;
    e.preventDefault();
    openExternal(url);
  });

  // Network failure on the server page → back to the setup screen with a reason.
  wc.on("did-fail-load", (_e, code, _desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3 /* aborted */ || url.startsWith("file:")) return;
    showSetup("unreachable");
  });

  void openServer();
}

function buildMenu() {
  const tr = app.getLocale().toLowerCase().startsWith("tr");
  const L = tr
    ? { app: "AURALIS", server: "Sunucuyu değiştir…", reload: "Yeniden yükle", update: "Güncellemeleri denetle", about: "AURALIS hakkında", quit: "Çıkış", view: "Görünüm", zoomIn: "Yakınlaştır", zoomOut: "Uzaklaştır", zoomReset: "Gerçek boyut", full: "Tam ekran" }
    : { app: "AURALIS", server: "Change server…", reload: "Reload", update: "Check for updates", about: "About AURALIS", quit: "Quit", view: "View", zoomIn: "Zoom in", zoomOut: "Zoom out", zoomReset: "Actual size", full: "Full screen" };
  return Menu.buildFromTemplate([
    {
      label: L.app,
      submenu: [
        { label: L.server, click: () => showSetup("") },
        { label: L.reload, accelerator: "CmdOrCtrl+R", click: () => win && win.webContents.reload() },
        { label: L.update, click: () => win && void checkForUpdates(win, { manual: true, tr }) },
        { type: "separator" },
        {
          label: L.about,
          click: () =>
            win &&
            dialog.showMessageBox(win, {
              type: "info",
              title: L.about,
              message: `AURALIS ${app.getVersion()}`,
              detail: `${tr ? "Sunucu" : "Server"}: ${serverOrigin() || "—"}\nElectron ${process.versions.electron} · Chromium ${process.versions.chrome}\nAGPL-3.0-only`,
            }),
        },
        { type: "separator" },
        { label: L.quit, role: "quit" },
      ],
    },
    {
      label: L.view,
      submenu: [
        { label: L.zoomIn, role: "zoomIn" },
        { label: L.zoomOut, role: "zoomOut" },
        { label: L.zoomReset, role: "resetZoom" },
        { type: "separator" },
        { label: L.full, role: "togglefullscreen" },
      ],
    },
  ]);
}

// ───────── setup-page IPC (the preload only exposes these on the local setup page) ─────────

const fromSetupPage = (event) => {
  const url = event.senderFrame && event.senderFrame.url;
  return typeof url === "string" && url.split(/[?#]/)[0] === SETUP_URL;
};

/** Probes the typed address; when no scheme was typed, falls back from https to http. */
async function resolveServer(input) {
  const origin = normalizeServerUrl(input);
  if (!origin) return { ok: false, reason: "invalid" };
  const probe = await probeServer(origin);
  const typedScheme = /^https?:\/\//i.test(String(input).trim());
  if (probe.ok || typedScheme || !origin.startsWith("https://")) return { ...probe, origin };
  const plain = origin.replace(/^https:/, "http:");
  const retry = await probeServer(plain);
  return retry.ok ? { ...retry, origin: plain } : { ...probe, origin };
}

ipcMain.handle("setup:probe", async (event, input) => {
  if (!fromSetupPage(event)) return { ok: false, reason: "forbidden" };
  return resolveServer(input);
});

ipcMain.handle("setup:connect", async (event, input) => {
  if (!fromSetupPage(event)) return { ok: false, reason: "forbidden" };
  const probe = await resolveServer(input);
  if (!probe.ok) return probe;
  const origin = probe.origin;
  writeConfig({ serverUrl: origin });
  await win.loadURL(`${origin}/home`);
  return { ok: true, origin };
});

ipcMain.handle("setup:info", (event) => {
  if (!fromSetupPage(event)) return null;
  return { version: app.getVersion(), locale: app.getLocale(), server: readConfig().serverUrl || "" };
});

// ───────── app lifecycle ─────────

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.whenReady().then(() => {
    // The web app needs no device permissions; deny them all by default.
    session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === "fullscreen" || permission === "clipboard-sanitized-write"));
    Menu.setApplicationMenu(buildMenu());
    createWindow();
    const tr = app.getLocale().toLowerCase().startsWith("tr");
    setTimeout(() => win && void checkForUpdates(win, { manual: false, tr, skipped: readConfig().skippedVersion, onSkip: (v) => writeConfig({ skippedVersion: v }) }), 5000);
  });

  app.on("window-all-closed", () => app.quit());
}
