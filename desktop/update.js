// Update check against GitHub Releases. It doesn't download anything itself:
// when a newer version exists it offers to open the release page, where the
// user downloads the new installer (it upgrades the existing install in place).

const { app, dialog, shell } = require("electron");

const REPO = "Edel1244/Auralis";
const RELEASES_API = `https://api.github.com/repos/${REPO}/releases/latest`;

/** Compares "1.2.3" style versions (a leading "v" is ignored). Returns 1, 0 or -1. */
function compareVersions(a, b) {
  const pa = String(a).replace(/^v/i, "").split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const pb = String(b).replace(/^v/i, "").split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

/**
 * @param {Electron.BrowserWindow} win
 * @param {{ manual: boolean, tr: boolean, skipped?: string, onSkip?: (v: string) => void }} opts
 */
async function checkForUpdates(win, opts) {
  const T = opts.tr
    ? { title: "Güncelleme", available: (v) => `AURALIS ${v} çıktı!`, detail: (c) => `Şu an kullandığın sürüm: ${c}. İndirme sayfası tarayıcında açılacak; yeni kurulum dosyası mevcut uygulamanın üzerine kurulur.`, download: "İndir", later: "Sonra", skip: "Bu sürümü atla", latest: "En güncel sürümü kullanıyorsun.", failed: "Güncellemeler denetlenemedi. İnternet bağlantını kontrol et." }
    : { title: "Update", available: (v) => `AURALIS ${v} is available!`, detail: (c) => `You're on ${c}. The download page opens in your browser; the new installer upgrades this app in place.`, download: "Download", later: "Later", skip: "Skip this version", latest: "You're on the latest version.", failed: "Couldn't check for updates. Check your internet connection." };
  const current = app.getVersion();
  try {
    const res = await fetch(RELEASES_API, {
      headers: { accept: "application/vnd.github+json", "user-agent": `AURALIS-Desktop/${current}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rel = await res.json();
    const latest = String(rel.tag_name || "").replace(/^v/i, "");
    if (!latest || compareVersions(latest, current) <= 0) {
      if (opts.manual) await dialog.showMessageBox(win, { type: "info", title: T.title, message: T.latest });
      return;
    }
    if (!opts.manual && opts.skipped === latest) return;
    const { response } = await dialog.showMessageBox(win, {
      type: "info",
      title: T.title,
      message: T.available(latest),
      detail: T.detail(current),
      buttons: [T.download, T.later, T.skip],
      defaultId: 0,
      cancelId: 1,
    });
    const page = typeof rel.html_url === "string" && rel.html_url.startsWith("https://github.com/") ? rel.html_url : `https://github.com/${REPO}/releases/latest`;
    if (response === 0) void shell.openExternal(page);
    if (response === 2 && opts.onSkip) opts.onSkip(latest);
  } catch {
    if (opts.manual) await dialog.showMessageBox(win, { type: "warning", title: T.title, message: T.failed });
  }
}

module.exports = { checkForUpdates, compareVersions };
