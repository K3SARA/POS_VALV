const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("posDesktop", {
  version: () => "1.0.0",
});
