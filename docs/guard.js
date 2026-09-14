(function (global) {
  /**
   * Защита копии проекта:
   * - приложение стартует только на разрешённых хостах
   * - секрет облака разворачивается ключом, завязанным на ваш домен
   *
   * Полностью «зашифровать» фронтенд нельзя: браузер всегда получает код.
   * Оптимум для GitHub Pages: доменный замок + привязка облака.
   */
  var ALLOWED = {
    "fluxess.github.io": true,
    localhost: true,
    "127.0.0.1": true,
  };
  var KEY_SEED = "fluxess.github.io|bmt-guard-v1";

  function host() {
    try {
      return String(location.hostname || "").toLowerCase();
    } catch (e) {
      return "";
    }
  }

  function isAllowedHost(h) {
    h = String(h || host()).toLowerCase();
    return !!ALLOWED[h];
  }

  function keyBytes() {
    var s = KEY_SEED;
    var out = [];
    for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i) & 255);
    return out;
  }

  function unwrapSecret(parts) {
    if (!isAllowedHost()) return "";
    try {
      var b64 = (parts || []).join("");
      var raw = atob(b64);
      var key = keyBytes();
      var out = [];
      for (var i = 0; i < raw.length; i++) {
        out.push(raw.charCodeAt(i) ^ key[i % key.length]);
      }
      return String.fromCharCode.apply(null, out);
    } catch (e) {
      return "";
    }
  }

  function lockScreen() {
    try {
      document.documentElement.innerHTML =
        "<head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
        "<title>BMT</title><style>body{font-family:system-ui,sans-serif;background:#1a2217;color:#e8ebe4;" +
        "display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px;text-align:center}" +
        "h1{font-size:1.25rem;margin:0 0 8px}p{opacity:.75;margin:0;max-width:28rem;line-height:1.45}</style></head>" +
        "<body><div><h1>Копия не активирована</h1>" +
        "<p>Это приложение ГАПОУ «БМТ» привязано к официальному адресу. " +
        "Запуск с другого сайта отключён.</p></div></body>";
    } catch (e) {}
  }

  function assertAllowed() {
    if (isAllowedHost()) return true;
    lockScreen();
    return false;
  }

  global.BmtGuard = {
    isAllowedHost: isAllowedHost,
    assertAllowed: assertAllowed,
    unwrapSecret: unwrapSecret,
    allowedHosts: Object.keys(ALLOWED),
  };

  // блокируем чужой хост сразу
  if (!isAllowedHost()) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", lockScreen);
    } else {
      lockScreen();
    }
  }
})(window);
