// Runs in every page of the window, but only exposes the setup bridge to the
// app's own local setup screen, never to remote server pages.
const { contextBridge, ipcRenderer } = require("electron");

if (location.protocol === "file:") {
  contextBridge.exposeInMainWorld("auralisDesktop", {
    info: () => ipcRenderer.invoke("setup:info"),
    probe: (url) => ipcRenderer.invoke("setup:probe", String(url)),
    connect: (url) => ipcRenderer.invoke("setup:connect", String(url)),
  });
}
