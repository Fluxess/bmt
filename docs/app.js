(function () {
  var status = document.getElementById("vk-status");
  var meta = document.getElementById("vk-meta");
  var bridge = window.vkBridge;

  function showMeta(rows) {
    meta.innerHTML = "";
    rows.forEach(function (row) {
      var dt = document.createElement("dt");
      var dd = document.createElement("dd");
      dt.textContent = row[0];
      dd.textContent = row[1];
      meta.appendChild(dt);
      meta.appendChild(dd);
    });
    meta.hidden = false;
  }

  function paramsFromUrl() {
    var q = new URLSearchParams(window.location.search);
    return {
      appId: q.get("vk_app_id") || "—",
      userId: q.get("vk_user_id") || "—",
      platform: q.get("vk_platform") || "—",
    };
  }

  if (!bridge || typeof bridge.send !== "function") {
    status.textContent = "VK Bridge не загрузился. Проверьте сеть и откройте из клиента VK.";
    return;
  }

  bridge.send("VKWebAppInit");

  bridge
    .send("VKWebAppGetLaunchParams")
    .then(function (p) {
      var url = paramsFromUrl();
      var appId = (p && p.vk_app_id) || url.appId;
      var userId = (p && p.vk_user_id) || url.userId;
      var platform = (p && p.vk_platform) || url.platform;
      status.textContent = "Мини-приложение запущено внутри ВКонтакте.";
      showMeta([
        ["vk_app_id", String(appId)],
        ["vk_user_id", String(userId)],
        ["платформа", String(platform)],
      ]);
      return bridge.send("VKWebAppGetUserInfo");
    })
    .then(function (user) {
      if (user && user.first_name) {
        status.textContent = "Привет, " + user.first_name + ". Это BMT в VK Mini Apps.";
      }
    })
    .catch(function () {
      var url = paramsFromUrl();
      if (url.appId !== "—") {
        status.textContent = "Параметры VK в URL есть, Bridge ответил с ошибкой — проверьте ID приложения.";
        showMeta([
          ["vk_app_id", url.appId],
          ["vk_user_id", url.userId],
          ["платформа", url.platform],
        ]);
        return;
      }
      status.textContent =
        "Сейчас обычный браузер. Откройте приложение по ссылке vk.com/app… из кабинета разработчика.";
    });
})();
