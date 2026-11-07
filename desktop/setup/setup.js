// First-run / reconnect screen. Talks to the main process only through the
// small bridge the preload exposes on this local page.
(async () => {
  const STRINGS = {
    en: {
      lead: "Connect to your AURALIS server to start listening.",
      label: "Server address",
      hint: "For example https://music.example.com, or http://localhost:3000 if AURALIS runs on this computer.",
      connect: "Connect",
      checking: "Checking the server…",
      version: "Version",
      invalid: "That doesn't look like a web address.",
      unreachable: "Couldn't reach the server. Is it running, and is the address right?",
      timeout: "The server took too long to answer.",
      "not-auralis": "A website answered, but it isn't an AURALIS server.",
      http: "The server answered with an error ({code}).",
      reasonPrefix: "The app couldn't open your server.",
    },
    tr: {
      lead: "Dinlemeye başlamak için AURALIS sunucuna bağlan.",
      label: "Sunucu adresi",
      hint: "Örneğin https://muzik.ornek.com ya da AURALIS bu bilgisayarda çalışıyorsa http://localhost:3000.",
      connect: "Bağlan",
      checking: "Sunucu kontrol ediliyor…",
      version: "Sürüm",
      invalid: "Bu geçerli bir web adresine benzemiyor.",
      unreachable: "Sunucuya ulaşılamadı. Sunucu çalışıyor mu, adres doğru mu?",
      timeout: "Sunucu çok geç yanıt verdi.",
      "not-auralis": "Bir site yanıt verdi ama bu bir AURALIS sunucusu değil.",
      http: "Sunucu bir hata döndürdü ({code}).",
      reasonPrefix: "Uygulama sunucunu açamadı.",
    },
  };

  const bridge = window.auralisDesktop;
  const info = bridge ? await bridge.info() : null;
  const lang = String((info && info.locale) || navigator.language || "en").toLowerCase().startsWith("tr") ? "tr" : "en";
  const S = STRINGS[lang];
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = S[el.getAttribute("data-i18n")] || "";
  });

  const message = (reason) => {
    if (!reason) return "";
    if (/^HTTP (\d+)/.test(reason)) return S.http.replace("{code}", reason.slice(5));
    return S[reason] || S.unreachable;
  };

  const params = new URLSearchParams(location.search);
  const input = document.getElementById("server");
  const status = document.getElementById("status");
  const button = document.getElementById("connect");
  const reasonBox = document.getElementById("reason");
  input.value = params.get("server") || (info && info.server) || "http://localhost:3000";
  document.getElementById("version").textContent = (info && info.version) || "";

  const reason = params.get("reason");
  if (reason) {
    reasonBox.textContent = `${S.reasonPrefix} ${message(reason)}`;
    reasonBox.hidden = false;
  }

  document.getElementById("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!bridge) return;
    button.disabled = true;
    status.className = "status";
    status.textContent = S.checking;
    const r = await bridge.connect(input.value).catch(() => ({ ok: false, reason: "unreachable" }));
    if (!r.ok) {
      status.className = "status error";
      status.textContent = message(r.reason);
      button.disabled = false;
    }
  });

  input.focus();
  input.select();
})();
