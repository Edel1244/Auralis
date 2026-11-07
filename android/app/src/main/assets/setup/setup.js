// First-run / reconnect screen for Android. The activity passes context in the
// query string and receives the server address via auralis-setup://connect?url=…
// (honoured only while this local page is showing); errors come back through
// window.auralisSetupResult(reason).
(() => {
  const STRINGS = {
    en: {
      lead: "Connect to your AURALIS server to start listening.",
      label: "Server address",
      hint: "For example https://music.example.com, or http://192.168.1.20:3000 for a server on your home network (\"localhost\" means the phone itself).",
      connect: "Connect",
      checking: "Checking the server…",
      version: "Version",
      invalid: "That doesn't look like a web address.",
      unreachable: "Couldn't reach the server. Is it running, is the address right, and is the phone on the same network?",
      timeout: "The server took too long to answer.",
      "not-auralis": "A website answered, but it isn't an AURALIS server.",
      http: "The server answered with an error ({code}).",
      reasonPrefix: "The app couldn't open your server.",
    },
    tr: {
      lead: "Dinlemeye başlamak için AURALIS sunucuna bağlan.",
      label: "Sunucu adresi",
      hint: "Örneğin https://muzik.ornek.com ya da ev ağındaki bir sunucu için http://192.168.1.20:3000 (\"localhost\" telefonun kendisi demektir).",
      connect: "Bağlan",
      checking: "Sunucu kontrol ediliyor…",
      version: "Sürüm",
      invalid: "Bu geçerli bir web adresine benzemiyor.",
      unreachable: "Sunucuya ulaşılamadı. Sunucu çalışıyor mu, adres doğru mu, telefon aynı ağda mı?",
      timeout: "Sunucu çok geç yanıt verdi.",
      "not-auralis": "Bir site yanıt verdi ama bu bir AURALIS sunucusu değil.",
      http: "Sunucu bir hata döndürdü ({code}).",
      reasonPrefix: "Uygulama sunucunu açamadı.",
    },
  };

  const params = new URLSearchParams(location.search);
  const lang = String(params.get("lang") || navigator.language || "en").toLowerCase().startsWith("tr") ? "tr" : "en";
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

  const input = document.getElementById("server");
  const status = document.getElementById("status");
  const button = document.getElementById("connect");
  const reasonBox = document.getElementById("reason");
  input.value = params.get("server") || "https://";
  document.getElementById("version").textContent = params.get("version") || "";

  const reason = params.get("reason");
  if (reason) {
    reasonBox.textContent = `${S.reasonPrefix} ${message(reason)}`;
    reasonBox.hidden = false;
  }

  window.auralisSetupResult = (r) => {
    status.className = "status error";
    status.textContent = message(r);
    button.disabled = false;
  };

  document.getElementById("form").addEventListener("submit", (e) => {
    e.preventDefault();
    button.disabled = true;
    status.className = "status";
    status.textContent = S.checking;
    location.href = `auralis-setup://connect?url=${encodeURIComponent(input.value)}`;
  });
})();
