(function () {
  var store = window.BmtStore;
  var root = document.getElementById("app");
  var state = {
    screen: "groups",
    groupId: null,
    studentId: null,
    search: "",
    catFilter: "Все",
    userSearch: "",
    logSearch: "",
    lastInvite: null,
    inviteToken: null,
    requestToken: null,
    lastRequestLink: null,
  };

  var ADMIN_PAGES = {
    overview: true,
    requests: true,
    users: true,
    assignments: true,
    logs: true,
    create: true,
  };
  var data = store.load();
  if (!data.groups.length) {
    store.ensurePresetGroups(data);
    store.save(data);
  }
  var me = null;

  var cloudTimer = null;
  var cloudStatus = { at: "", ok: null, text: "" };

  function persist() {
    data.updatedAt = new Date().toISOString();
    if (!store.save(data)) {
      toast("Не хватило места в браузере. Удалите фото или сделайте бэкап.", true);
      return false;
    }
    scheduleCloudSync();
    return true;
  }

  function scheduleCloudSync() {
    if (!window.BmtCloud || !window.BmtCloud.syncNow) return;
    if (cloudTimer) clearTimeout(cloudTimer);
    cloudTimer = setTimeout(function () {
      cloudTimer = null;
      runCloudSync(false);
    }, 1400);
  }

  function runCloudSync(forceRender) {
    if (!window.BmtCloud || !window.BmtCloud.syncNow) {
      return Promise.resolve({ ok: false });
    }
    cloudStatus.text = "Синхронизация…";
    return window.BmtCloud.syncNow(data).then(function (res) {
      if (res && res.queued) return res;
      if (res && res.ok) {
        store.save(data);
        cloudStatus.ok = true;
        cloudStatus.at = new Date().toISOString();
        cloudStatus.text =
          "Облако обновлено" +
          (res.push && res.push.stripped ? " (фото урезаны по размеру)" : "");
      } else {
        cloudStatus.ok = false;
        cloudStatus.text =
          "Облако: " + ((res && res.error) || (res && res.push && res.push.error) || "ошибка");
      }
      if (forceRender) render();
      return res;
    });
  }

  function refreshMe() {
    me = store.currentUser(data);
    return me;
  }

  function logAction(action, details, meta) {
    store.addLog(data, me, action, details, meta || {});
  }

  function toast(message, isError) {
    var old = document.querySelector(".toast");
    if (old) old.remove();
    var node = el(
      '<div class="toast' +
        (isError ? " toast-err" : "") +
        '" role="status">' +
        escapeHtml(message) +
        "</div>"
    );
    document.body.appendChild(node);
    setTimeout(function () {
      node.classList.add("toast-out");
      setTimeout(function () {
        node.remove();
      }, 280);
    }, 2600);
  }

  function groupById(id) {
    return data.groups.find(function (g) {
      return g.id === id;
    });
  }

  function studentById(group, id) {
    return group.students.find(function (s) {
      return s.id === id;
    });
  }

  function el(html) {
    var wrap = document.createElement("div");
    wrap.innerHTML = html.trim();
    return wrap.firstElementChild;
  }

  function option(value, label, selected) {
    var o = document.createElement("option");
    o.value = value;
    o.textContent = label;
    if (selected) o.selected = true;
    return o;
  }

  function compressImage(file, done) {
    var img = new Image();
    var url = URL.createObjectURL(file);
    img.onload = function () {
      var max = 1100;
      var scale = Math.min(1, max / Math.max(img.width, img.height));
      var canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      done(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      done(null);
    };
    img.src = url;
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatPts(n) {
    var v = Number(n) || 0;
    return (v > 0 ? "+" : "") + v;
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return "";
    }
  }

  function safeName(name) {
    return String(name || "file")
      .replace(/[\\/:*?"<>|]+/g, "_")
      .slice(0, 40);
  }

  function pageTitle(screen) {
    var titles = {
      login: "Вход",
      register: "Регистрация",
      invite: "Приглашение",
      request: "Заявка",
      groups: "Группы",
      group: "Группа",
      student: "Студент",
      cabinet: "Личный кабинет",
      overview: "Обзор",
      requests: "Заявки",
      users: "Кабинеты",
      assignments: "Кураторы",
      logs: "Логи",
      create: "Создать кабинет",
    };
    return titles[screen] || "BMT";
  }

  function updateHeader() {
    var status = document.getElementById("vk-status");
    if (!status) return;
    document.title = pageTitle(state.screen) + " · BMT";
    if (!me) {
      status.textContent = "ГАПОУ «БМТ» · войдите в личный кабинет";
      return;
    }
    status.textContent =
      pageTitle(state.screen) +
      " · " +
      me.name +
      " · " +
      store.roleLabel(me.role);
  }

  function parseHash() {
    var raw = (location.hash || "").replace(/^#\/?/, "");
    var parts = raw.split("/").filter(Boolean);
    var screen = (parts[0] || "").toLowerCase();
    if (!screen) return { screen: "", groupId: null, studentId: null };
    if (screen === "group" && parts[1]) {
      return { screen: "group", groupId: parts[1], studentId: null };
    }
    if (screen === "student" && parts[1] && parts[2]) {
      return { screen: "student", groupId: parts[1], studentId: parts[2] };
    }
    if (screen === "invite" && parts[1]) {
      return {
        screen: "invite",
        groupId: null,
        studentId: null,
        inviteToken: parts.slice(1).join("/"),
      };
    }
    if (screen === "request" && parts[1]) {
      return {
        screen: "request",
        groupId: null,
        studentId: null,
        requestToken: parts.slice(1).join("/"),
      };
    }
    if (screen === "admin-groups" || screen === "curators") {
      screen = "assignments";
    }
    if (screen === "admin") screen = "overview";
    return { screen: screen, groupId: null, studentId: null };
  }

  function defaultScreen() {
    if (!me) return "login";
    return store.isAdmin(me) ? "overview" : "groups";
  }

  function applyRouteFromHash(forceDefault) {
    var route = parseHash();
    if (!route.screen || forceDefault) {
      route = {
        screen: defaultScreen(),
        groupId: null,
        studentId: null,
      };
      history.replaceState(null, "", "#/" + route.screen);
    }
    if (!me && route.screen !== "login" && route.screen !== "register" && route.screen !== "invite" && route.screen !== "request") {
      route = { screen: "login", groupId: null, studentId: null };
      history.replaceState(null, "", "#/login");
    }
    if (me && (route.screen === "login" || route.screen === "register")) {
      route = {
        screen: defaultScreen(),
        groupId: null,
        studentId: null,
      };
      history.replaceState(null, "", "#/" + route.screen);
    }
    if (me && (route.screen === "invite" || route.screen === "request")) {
      // allow special links
    } else if (ADMIN_PAGES[route.screen] && me && !store.isAdmin(me)) {
      route = { screen: "groups", groupId: null, studentId: null };
      history.replaceState(null, "", "#/groups");
    }
    state.screen = route.screen;
    state.groupId = route.groupId;
    state.studentId = route.studentId;
    state.inviteToken = route.inviteToken || null;
    state.requestToken = route.requestToken || null;
  }

  function navigate(path, replace) {
    var clean = String(path || "")
      .replace(/^#\/?/, "")
      .replace(/^\//, "");
    if (!clean) clean = defaultScreen();
    var hash = "#/" + clean;
    if (replace) {
      history.replaceState(null, "", hash);
      applyRouteFromHash(false);
      render();
      return;
    }
    if (location.hash === hash) {
      applyRouteFromHash(false);
      render();
      return;
    }
    location.hash = hash;
  }

  function logoutUser() {
    if (me) {
      logAction("Выход", "Выход из кабинета · роль " + store.roleLabel(me.role), {
        target: "@" + me.login,
      });
      persist();
    }
    store.logout();
    me = null;
    toast("Вы вышли из кабинета");
    navigate("login", true);
  }

  function renderMainNav() {
    if (!me) return;
    var navItems = [{ id: "groups", label: "Группы", path: "groups" }];
    if (store.isAdmin(me)) {
      var pending = data.requests.filter(function (r) {
        return r.status === "pending";
      }).length;
      var stats = store.adminStats(data);
      navItems = navItems.concat([
        { id: "overview", label: "Обзор", path: "overview" },
        {
          id: "requests",
          label: "Заявки" + (pending ? " (" + pending + ")" : ""),
          path: "requests",
        },
        { id: "users", label: "Кабинеты", path: "users" },
        { id: "assignments", label: "Кураторы", path: "assignments" },
        {
          id: "logs",
          label: "Логи" + (stats.logs ? " (" + stats.logs + ")" : ""),
          path: "logs",
        },
        { id: "create", label: "Создать", path: "create" },
      ]);
    }
    navItems.push({ id: "cabinet", label: "Личный кабинет", path: "cabinet" });

    var active = state.screen;
    if (active === "group" || active === "student") active = "groups";

    var nav = el('<nav class="page-nav" aria-label="Разделы"></nav>');
    navItems.forEach(function (item) {
      var btn = el(
        '<button class="page-nav-link' +
          (active === item.id ? " is-active" : "") +
          '" type="button">' +
          escapeHtml(item.label) +
          "</button>"
      );
      btn.addEventListener("click", function () {
        navigate(item.path);
      });
      nav.appendChild(btn);
    });
    root.appendChild(nav);
  }

  function render() {
    root.innerHTML = "";
    refreshMe();
    applyRouteFromHash(false);
    updateHeader();
    try {
      window.scrollTo(0, 0);
    } catch (e) {}
    if (state.screen === "invite") {
      renderInvite();
      return;
    }
    if (state.screen === "request") {
      renderRequestImport();
      return;
    }
    if (!me) {
      if (state.screen === "register") renderRegister();
      else renderLogin();
      return;
    }
    renderMainNav();
    if (state.screen === "groups") renderGroups();
    else if (state.screen === "group") renderGroup();
    else if (state.screen === "student") renderStudent();
    else if (state.screen === "cabinet") renderCabinet();
    else if (state.screen === "overview") renderAdminOverview(store.adminStats(data));
    else if (state.screen === "requests") {
      renderAdminRequests(
        data.requests.filter(function (r) {
          return r.status === "pending";
        })
      );
    } else if (state.screen === "users") renderAdminUsers();
    else if (state.screen === "assignments") renderAdminGroups();
    else if (state.screen === "logs") renderAdminLogs();
    else if (state.screen === "create") renderAdminCreate();
    else navigate("groups", true);
  }

  function renderCabinet() {
    var groups = store.visibleGroups(data, me);
    var card = el(
      '<section class="card">' +
        "<h1>Личный кабинет</h1>" +
        '<p class="status">Данные вашего аккаунта и быстрые действия.</p>' +
        '<div class="stat-grid">' +
        '<div class="stat-card"><small>ФИО</small><strong>' +
        escapeHtml(me.name) +
        "</strong></div>" +
        '<div class="stat-card"><small>Логин</small><strong>@' +
        escapeHtml(me.login) +
        "</strong></div>" +
        '<div class="stat-card"><small>Должность</small><strong>' +
        escapeHtml(store.roleLabel(me.role)) +
        "</strong></div>" +
        '<div class="stat-card"><small>Доступных групп</small><strong>' +
        groups.length +
        "</strong></div></div></section>"
    );
    root.appendChild(card);

    var syncCard = el(
      '<section class="card"><h2>Облако</h2><p class="status">' +
        escapeHtml(cloudStatus.text || "Баллы, группы и логи синхронизируются между устройствами.") +
        '</p><div class="toolbar"></div></section>'
    );
    var syncBtn = el('<button class="btn" type="button">Синхронизировать</button>');
    syncBtn.addEventListener("click", function () {
      runCloudSync(false).then(function (res) {
        toast(res && res.ok ? "Синхронизировано" : cloudStatus.text || "Ошибка", !(res && res.ok));
        refreshMe();
        render();
      });
    });
    syncCard.querySelector(".toolbar").appendChild(syncBtn);
    root.appendChild(syncCard);

    var list = el('<section class="card"><h2>Ваши группы</h2></section>');
    if (!groups.length) {
      list.appendChild(el('<p class="status">Нет прикреплённых групп.</p>'));
    } else {
      groups.forEach(function (g) {
        var row = el(
          '<button class="row" type="button"><div><strong>' +
            escapeHtml(g.name) +
            "</strong><small>" +
            (g.students || []).length +
            " студ.</small></div><span>" +
            formatPts(store.groupTotal(g)) +
            "</span></button>"
        );
        row.addEventListener("click", function () {
          navigate("group/" + g.id);
        });
        list.appendChild(row);
      });
    }
    root.appendChild(list);

    var actions = el('<section class="card"><h2>Действия</h2><div class="toolbar"></div></section>');
    var tools = actions.querySelector(".toolbar");
    var groupsBtn = el('<button class="btn btn-soft" type="button">Открыть группы</button>');
    groupsBtn.addEventListener("click", function () {
      navigate("groups");
    });
    tools.appendChild(groupsBtn);
    if (store.isAdmin(me)) {
      var logsBtn = el('<button class="btn btn-soft" type="button">Журнал логов</button>');
      logsBtn.addEventListener("click", function () {
        navigate("logs");
      });
      tools.appendChild(logsBtn);
    }
    var outBtn = el('<button class="btn btn-ghost" type="button">Выйти</button>');
    outBtn.addEventListener("click", logoutUser);
    tools.appendChild(outBtn);
    root.appendChild(actions);
  }

  function renderInvite() {
    var card = el(
      '<section class="card">' +
        "<h1>Приглашение в кабинет</h1>" +
        '<p class="status">Ссылка добавит ваш личный кабинет на это устройство. Затем войдите своим паролем.</p>' +
        '<div class="toolbar"></div></section>'
    );
    var tools = card.querySelector(".toolbar");
    var accept = el('<button class="btn" type="button">Принять и войти</button>');
    var cancel = el('<button class="btn btn-soft" type="button">Отмена</button>');
    accept.addEventListener("click", function () {
      var res = store.acceptInvite(data, state.inviteToken || "");
      if (!res.ok) {
        toast(res.error, true);
        return;
      }
      if (!persist()) return;
      me = res.user;
      logAction(
        "Приглашение принято",
        "Кабинет @" + res.user.login + " установлен на устройстве",
        { target: "@" + res.user.login }
      );
      persist();
      toast("Кабинет @" + res.user.login + " готов");
      navigate(store.isAdmin(me) ? "overview" : "groups", true);
    });
    cancel.addEventListener("click", function () {
      navigate(me ? defaultScreen() : "login", true);
    });
    tools.appendChild(accept);
    tools.appendChild(cancel);
    root.appendChild(card);
  }

  function requestShareUrl(req) {
    var token = store.encodeInvite(store.buildRequestPayload(req));
    return location.href.split("#")[0] + "#/request/" + token;
  }

  function renderRequestImport() {
    var card = el(
      '<section class="card">' +
        "<h1>Заявка с другого устройства</h1>" +
        '<p class="status">Откройте эту ссылку под админом — заявка попадёт в раздел «Заявки».</p>' +
        '<div class="toolbar"></div></section>'
    );
    var tools = card.querySelector(".toolbar");

    function doImport() {
      var res = store.importRequest(data, state.requestToken || "");
      if (!res.ok) {
        toast(res.error, true);
        return;
      }
      if (!persist()) return;
      if (me && store.isAdmin(me)) {
        logAction(
          "Заявка импортирована",
          "@" + res.login + (res.already ? " (уже была)" : ""),
          { target: "@" + res.login }
        );
        persist();
        toast(res.already ? "Заявка уже в списке" : "Заявка добавлена");
        navigate("requests", true);
        return;
      }
      toast(
        res.already
          ? "Заявка уже сохранена. Войдите как админ → Заявки."
          : "Заявка сохранена. Войдите как админ → Заявки."
      );
      navigate("login", true);
    }

    var accept = el('<button class="btn" type="button">Добавить заявку сюда</button>');
    accept.addEventListener("click", doImport);
    var cancel = el('<button class="btn btn-soft" type="button">Отмена</button>');
    cancel.addEventListener("click", function () {
      navigate(me ? defaultScreen() : "login", true);
    });
    tools.appendChild(accept);
    tools.appendChild(cancel);
    root.appendChild(card);

    // auto-import when admin already logged in
    if (me && store.isAdmin(me)) {
      doImport();
    }
  }

  function renderLogin() {
    var card = el(
      '<section class="card">' +
        "<h1>Вход в личный кабинет</h1>" +
        '<p class="status">Данные хранятся в браузере устройства. Между телефонами кабинеты передаются ссылкой-приглашением или бэкапом.</p>' +
        '<form class="stack">' +
        '<label class="lbl">Логин</label>' +
        '<input name="login" required autocomplete="username" placeholder="логин латиницей" />' +
        '<label class="lbl">Пароль</label>' +
        '<input name="password" type="password" required autocomplete="current-password" />' +
        '<button class="btn" type="submit">Войти</button></form>' +
        '<p class="status">Нет кабинета? <button class="link" type="button" id="go-reg">Подать заявку</button></p>' +
        "</section>"
    );
    card.querySelector("#go-reg").addEventListener("click", function () {
      navigate("register", true);
    });
    card.querySelector("form").addEventListener("submit", function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      store.login(data, fd.get("login"), fd.get("password")).then(function (res) {
        if (!res.ok) {
          store.addLog(
            data,
            { login: String(fd.get("login") || ""), name: "Неизвестный" },
            "Ошибка входа",
            "Неверный логин или пароль"
          );
          persist();
          toast(res.error, true);
          return;
        }
        me = res.user;
        store.addLog(data, me, "Вход", "Успешный вход · роль " + store.roleLabel(me.role), {
          target: "@" + me.login,
        });
        persist();
        toast("Добро пожаловать, " + me.name);
        navigate(store.isAdmin(me) ? "overview" : "groups", true);
      }).catch(function () {
        toast("Не удалось войти. Откройте сайт по HTTPS.", true);
      });
    });
    root.appendChild(card);
  }

  function renderRegister() {
    if (state.lastRequestLink) {
      var st = state.lastRequestLink.cloudStatus || "";
      var cloudMsg =
        st === "sending"
          ? "Отправляем заявку админу…"
          : st === "ok" || st === "already"
            ? "Готово: заявка уже у админа в разделе «Заявки». Ждите решения — ссылку слать не нужно."
            : st === "fail"
              ? "Автоотправка не удалась. Нажмите «Отправить…» и выберите чат с админом."
              : "Если админ не видит заявку — отправьте ссылку ниже.";
      var done = el(
        '<section class="card">' +
          "<h1>" +
          (st === "ok" || st === "already" ? "Заявка отправлена" : "Заявка создана") +
          "</h1>" +
          '<p class="status">Логин: <strong>@' +
          escapeHtml(state.lastRequestLink.login) +
          "</strong></p>" +
          '<p class="status">' +
          escapeHtml(cloudMsg) +
          "</p>" +
          (st === "ok" || st === "already"
            ? ""
            : '<div class="share-host"></div>') +
          '<div class="toolbar"></div></section>'
      );
      if (st !== "ok" && st !== "already") {
        mountSharePanel(done.querySelector(".share-host"), {
          url: state.lastRequestLink.url,
          title: "Заявка BMT",
          shareText:
            "Заявка на кабинет BMT @" +
            state.lastRequestLink.login +
            ". Откройте ссылку под админом:",
          autoShare: !!state.lastRequestLink.autoShare,
        });
        state.lastRequestLink.autoShare = false;
      }
      var again = el('<button class="btn btn-soft" type="button">Новая заявка</button>');
      again.addEventListener("click", function () {
        state.lastRequestLink = null;
        render();
      });
      var toLogin = el('<button class="btn btn-ghost" type="button">Ко входу</button>');
      toLogin.addEventListener("click", function () {
        state.lastRequestLink = null;
        navigate("login", true);
      });
      done.querySelector(".toolbar").appendChild(again);
      done.querySelector(".toolbar").appendChild(toLogin);
      root.appendChild(done);
      return;
    }

    var card = el(
      '<section class="card">' +
        "<h1>Заявка на личный кабинет</h1>" +
        '<p class="status">После создания заявка сама появится у админа. Ссылки слать не нужно.</p>' +
        '<form class="stack">' +
        '<label class="lbl">ФИО</label>' +
        '<input name="name" required maxlength="80" placeholder="Иванова А. С." />' +
        '<label class="lbl">Логин (латиница)</label>' +
        '<input name="login" required maxlength="40" autocomplete="username" placeholder="ivanova" />' +
        '<label class="lbl">Пароль</label>' +
        '<input name="password" type="password" required minlength="6" autocomplete="new-password" />' +
        '<label class="lbl">Должность</label>' +
        '<select name="role"></select>' +
        '<label class="lbl">Желаемая группа (для куратора)</label>' +
        '<select name="groupId"></select>' +
        '<label class="lbl">Комментарий</label>' +
        '<textarea name="comment" rows="3" maxlength="200" placeholder="Например: куратор группы 616"></textarea>' +
        '<button class="btn" type="submit">Отправить заявку</button></form>' +
        '<p class="status"><button class="link" type="button" id="go-login">Уже есть кабинет — войти</button></p>' +
        "</section>"
    );
    var roleSel = card.querySelector('[name="role"]');
    ["curator", "head", "deputy", "director", "administrator"].forEach(function (r) {
      roleSel.appendChild(option(r, store.roleLabel(r), r === "curator"));
    });
    var groupSel = card.querySelector('[name="groupId"]');
    groupSel.appendChild(option("", "Пока не выбрана"));
    if (!data.groups.length) {
      store.ensurePresetGroups(data);
      persist();
    }
    data.groups
      .slice()
      .sort(function (a, b) {
        return a.name.localeCompare(b.name, "ru");
      })
      .forEach(function (g) {
        groupSel.appendChild(option(g.id, g.name));
      });
    card.querySelector("#go-login").addEventListener("click", function () {
      navigate("login", true);
    });
    card.querySelector("form").addEventListener("submit", function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      store
        .submitRegistration(data, {
          name: fd.get("name"),
          login: fd.get("login"),
          password: fd.get("password"),
          role: fd.get("role"),
          groupId: fd.get("groupId"),
          comment: fd.get("comment"),
        })
        .then(function (res) {
          if (!res.ok) {
            toast(res.error, true);
            return;
          }
          if (!persist()) return;
          var payload = store.buildRequestPayload(res.request);
          var url = requestShareUrl(res.request);
          state.lastRequestLink = {
            login: res.request.login,
            url: url,
            autoShare: false,
            cloudStatus: "sending",
          };
          render();
          var cloud = window.BmtCloud;
          if (cloud && cloud.pushRequest) {
            cloud.pushRequest(payload).then(function (cRes) {
              state.lastRequestLink.cloudStatus = cRes.ok
                ? cRes.already
                  ? "already"
                  : "ok"
                : "fail";
              state.lastRequestLink.cloudError = cRes.error || "";
              if (cRes.ok) {
                toast("Заявка ушла админу в облако");
              } else {
                state.lastRequestLink.autoShare = true;
                toast("Облако недоступно — отправьте ссылку вручную", true);
              }
              render();
            });
          } else {
            state.lastRequestLink.cloudStatus = "fail";
            state.lastRequestLink.autoShare = true;
            render();
          }
        })
        .catch(function () {
          toast("Не удалось создать заявку", true);
        });
    });
    root.appendChild(card);
  }

  function renderAdminPageHead(title, subtitle) {
    root.appendChild(
      el(
        "<section class=\"card\"><h1>" +
          escapeHtml(title) +
          "</h1><p class=\"status\">" +
          escapeHtml(subtitle) +
          "</p></section>"
      )
    );
  }

  function renderAdminOverview(stats) {
    renderAdminPageHead("Обзор", "Сводка по кабинетам, группам и журналу действий.");
    var cloudCard = el(
      '<section class="card"><h2>Облако</h2><p class="status" id="ov-cloud">' +
        escapeHtml(cloudStatus.text || "Данные синхронизируются между устройствами автоматически.") +
        '</p><div class="toolbar"></div></section>'
    );
    var btn = el('<button class="btn btn-soft" type="button">Синхронизировать</button>');
    btn.addEventListener("click", function () {
      cloudCard.querySelector("#ov-cloud").textContent = "Синхронизация…";
      runCloudSync(false).then(function (res) {
        toast(res && res.ok ? "Облако обновлено" : cloudStatus.text || "Ошибка", !(res && res.ok));
        render();
      });
    });
    cloudCard.querySelector(".toolbar").appendChild(btn);
    root.appendChild(cloudCard);
    var card = el('<section class="card"><h2>Сводка</h2><div class="stat-grid"></div></section>');
    var grid = card.querySelector(".stat-grid");
    [
      ["Кабинеты", stats.users + " / акт. " + stats.activeUsers],
      ["Заявки", String(stats.pending)],
      ["Группы", String(stats.groups)],
      ["Студенты", String(stats.students)],
      ["Операции баллов", String(stats.events)],
      ["Фото", String(stats.photos)],
      ["Записи логов", String(stats.logs)],
    ].forEach(function (item) {
      grid.appendChild(
        el(
          '<div class="stat-card"><small>' +
            escapeHtml(item[0]) +
            "</small><strong>" +
            escapeHtml(item[1]) +
            "</strong></div>"
        )
      );
    });
    root.appendChild(card);

    var roles = el('<section class="card"><h2>По должностям</h2><div class="chips"></div></section>');
    var chips = roles.querySelector(".chips");
    store.ROLE_ORDER.forEach(function (r) {
      chips.appendChild(
        el(
          '<span class="chip">' +
            escapeHtml(store.roleLabel(r)) +
            ": " +
            (stats.byRole[r] || 0) +
            "</span>"
        )
      );
    });
    root.appendChild(roles);

    var recent = el('<section class="card"><h2>Последние действия</h2></section>');
    var logs = (data.logs || []).slice(0, 8);
    if (!logs.length) {
      recent.appendChild(el('<p class="status">Пока нет записей в журнале.</p>'));
    } else {
      logs.forEach(function (log) {
        recent.appendChild(
          el(
            '<div class="log-row"><strong>' +
              escapeHtml(log.action) +
              "</strong><small>" +
              escapeHtml(log.actorName) +
              " · @" +
              escapeHtml(log.actorLogin) +
              " · " +
              formatDate(log.at) +
              (log.details ? " · " + escapeHtml(log.details) : "") +
              "</small></div>"
          )
        );
      });
    }
    root.appendChild(recent);
  }

  function syncCloudRequests() {
    return runCloudSync(false).then(function (res) {
      if (!res || !res.ok) return 0;
      // after merge, pending count may have grown — caller re-renders
      return (data.requests || []).filter(function (r) {
        return r.status === "pending";
      }).length;
    });
  }

  function renderAdminRequests(pending) {
    renderAdminPageHead(
      "Заявки",
      "Заявки с телефонов преподавателей подтягиваются сами. Можно также вставить ссылку."
    );

    var syncCard = el(
      '<section class="card">' +
        "<h2>Облако</h2>" +
        '<p class="status" id="cloud-sync-status">' +
        escapeHtml(cloudStatus.text || "Группы, баллы, кабинеты, заявки и логи — в общем облаке.") +
        "</p>" +
        '<div class="toolbar"></div></section>'
    );
    var syncBtn = el('<button class="btn" type="button">Синхронизировать сейчас</button>');
    function runSync() {
      var statusEl = syncCard.querySelector("#cloud-sync-status");
      statusEl.textContent = "Синхронизация…";
      var before = (data.requests || []).filter(function (r) {
        return r.status === "pending";
      }).length;
      runCloudSync(false).then(function (res) {
        var after = (data.requests || []).filter(function (r) {
          return r.status === "pending";
        }).length;
        if (res && res.ok) {
          statusEl.textContent =
            cloudStatus.text +
            (after > before ? " · новых заявок: " + (after - before) : "");
          toast("Данные синхронизированы");
          render();
        } else {
          statusEl.textContent = cloudStatus.text || "Не удалось синхронизировать";
          toast(cloudStatus.text || "Ошибка облака", true);
        }
      });
    }
    syncBtn.addEventListener("click", runSync);
    syncCard.querySelector(".toolbar").appendChild(syncBtn);
    root.appendChild(syncCard);
    if (!cloudStatus.at) runSync();

    var pasteCard = el(
      '<section class="card">' +
        "<h2>Вставить ссылку вручную</h2>" +
        '<p class="status">Запасной способ, если облако недоступно.</p>' +
        '<form class="stack paste-request">' +
        '<label class="lbl">Ссылка заявки</label>' +
        '<textarea name="paste" rows="3" placeholder="https://fluxess.github.io/bmt/#/request/…" required></textarea>' +
        '<button class="btn" type="submit">Добавить заявку</button></form></section>'
    );
    pasteCard.querySelector("form").addEventListener("submit", function (e) {
      e.preventDefault();
      var raw = new FormData(e.target).get("paste");
      var res = importRequestFromPaste(raw);
      if (!res.ok) {
        toast(res.error, true);
        return;
      }
      if (!persist()) return;
      logAction(
        "Заявка импортирована",
        "@" + res.login + (res.already ? " (уже была)" : ""),
        { target: "@" + res.login }
      );
      persist();
      toast(res.already ? "Эта заявка уже в списке" : "Заявка добавлена");
      e.target.reset();
      render();
    });
    root.appendChild(pasteCard);

    var reqCard = el(
      '<section class="card"><h2>Ожидают решения (' +
        pending.length +
        ")</h2></section>"
    );
    if (!pending.length) {
      reqCard.appendChild(el('<p class="status">Новых заявок нет.</p>'));
    } else {
      pending.forEach(function (req) {
        var g = groupById(req.groupId);
        var box = el(
          '<div class="admin-item">' +
            "<strong>" +
            escapeHtml(req.name) +
            "</strong>" +
            "<small>@" +
            escapeHtml(req.login) +
            " · хочет: " +
            escapeHtml(store.roleLabel(req.role)) +
            (g ? " · группа " + escapeHtml(g.name) : "") +
            (req.comment ? " · " + escapeHtml(req.comment) : "") +
            " · " +
            formatDate(req.createdAt) +
            "</small>" +
            '<div class="stack tight approve-box">' +
            '<label class="lbl">Должность</label>' +
            '<select class="approve-role"></select>' +
            '<label class="lbl">Группа</label>' +
            '<select class="approve-group"></select>' +
            '<div class="toolbar"></div></div></div>'
        );
        var roleSel = box.querySelector(".approve-role");
        ["curator", "head", "deputy", "director", "administrator"].forEach(function (r) {
          roleSel.appendChild(option(r, store.roleLabel(r), r === (req.role || "curator")));
        });
        var gSel = box.querySelector(".approve-group");
        gSel.appendChild(option("", "Без группы"));
        data.groups
          .slice()
          .sort(function (a, b) {
            return a.name.localeCompare(b.name, "ru");
          })
          .forEach(function (gr) {
            gSel.appendChild(
              option(gr.id, gr.name, req.groupId === gr.id)
            );
          });
        var ok = el('<button class="btn" type="button">Принять</button>');
        var no = el('<button class="btn btn-ghost" type="button">Отклонить</button>');
        ok.addEventListener("click", function () {
          var role = roleSel.value;
          var groupId = gSel.value;
          var res = store.approveRequest(data, req.id, {
            role: role,
            groupId: groupId,
          });
          if (!res.ok) {
            toast(res.error, true);
            return;
          }
          logAction(
            "Заявка принята",
            "@" +
              req.login +
              " · " +
              req.name +
              " → " +
              store.roleLabel(role) +
              (groupId
                ? " · группа " + ((groupById(groupId) || {}).name || "?")
                : ""),
            {
              target: "@" + req.login,
              category: role,
              groupId: groupId || "",
              groupName: ((groupById(groupId) || {}).name || ""),
            }
          );
          if (!persist()) return;
          if (window.BmtCloud && window.BmtCloud.markResolved) {
            window.BmtCloud.markResolved(req.login, "approved");
          }
          if (res.user) {
            state.lastInvite = {
              login: res.user.login,
              password: "(пароль, который задал при заявке)",
              url: inviteUrlFor(res.user),
              autoShare: true,
            };
          }
          toast("Готово — отправьте ссылку преподавателю");
          navigate("users", true);
        });
        no.addEventListener("click", function () {
          store.rejectRequest(data, req.id);
          logAction("Заявка отклонена", "@" + req.login + " · " + req.name, {
            target: "@" + req.login,
            category: req.role || "",
          });
          if (!persist()) return;
          if (window.BmtCloud && window.BmtCloud.markResolved) {
            window.BmtCloud.markResolved(req.login, "rejected");
          }
          toast("Заявка отклонена");
          render();
        });
        box.querySelector(".toolbar").appendChild(ok);
        box.querySelector(".toolbar").appendChild(no);
        reqCard.appendChild(box);
      });
    }
    root.appendChild(reqCard);

    var history = data.requests.filter(function (r) {
      return r.status !== "pending";
    }).slice(0, 20);
    if (history.length) {
      var histCard = el('<section class="card"><h2>Недавние решения</h2></section>');
      history.forEach(function (req) {
        histCard.appendChild(
          el(
            '<div class="log-row"><strong>' +
              escapeHtml(req.name) +
              " · " +
              (req.status === "approved" ? "принята" : "отклонена") +
              "</strong><small>@" +
              escapeHtml(req.login) +
              " · " +
              formatDate(req.resolvedAt || req.createdAt) +
              "</small></div>"
          )
        );
      });
      root.appendChild(histCard);
    }
  }

  function inviteUrlFor(user, password) {
    var token = store.encodeInvite(store.buildInvitePayload(data, user, password || ""));
    var base = location.href.split("#")[0];
    return base + "#/invite/" + token;
  }

  function copyText(text, okMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () {
          toast(okMsg || "Скопировано");
        },
        function () {
          prompt("Скопируйте вручную", text);
        }
      );
    } else {
      prompt("Скопируйте вручную", text);
    }
  }

  function extractShareToken(raw) {
    var s = String(raw || "").trim();
    if (!s) return "";
    var m = s.match(/#\/(?:request|invite)\/([A-Za-z0-9_-]+)/i);
    if (m) return m[1];
    m = s.match(/\/(?:request|invite)\/([A-Za-z0-9_-]+)/i);
    if (m) return m[1];
    if (/^[A-Za-z0-9_-]{16,}$/.test(s)) return s;
    return s;
  }

  function telegramShareUrl(url, text) {
    return (
      "https://t.me/share/url?url=" +
      encodeURIComponent(url) +
      "&text=" +
      encodeURIComponent(text || "")
    );
  }

  function vkShareUrl(url, text) {
    return (
      "https://vk.com/share.php?url=" +
      encodeURIComponent(url) +
      "&title=" +
      encodeURIComponent(text || "BMT")
    );
  }

  function qrImageUrl(url) {
    return (
      "https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=" +
      encodeURIComponent(url)
    );
  }

  function openExternal(url) {
    var a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function tryNativeShare(url, title, text) {
    if (!navigator.share) return Promise.resolve(false);
    return navigator
      .share({ title: title || "BMT", text: text || "", url: url })
      .then(function () {
        return true;
      })
      .catch(function () {
        return false;
      });
  }

  /** Панель: Отправить / Telegram / VK / копировать / QR */
  function mountSharePanel(host, opts) {
    var url = opts.url;
    var title = opts.title || "Отправить";
    var hint = opts.hint || "";
    var shareText = opts.shareText || title;
    var autoShare = !!opts.autoShare;

    var panel = el(
      '<div class="share-panel">' +
        (hint ? '<p class="status">' + escapeHtml(hint) + "</p>" : "") +
        '<div class="share-actions"></div>' +
        '<div class="share-qr">' +
        '<img alt="QR-код ссылки" width="160" height="160" />' +
        "<small>Или покажите QR — отсканируют камерой</small></div>" +
        '<label class="lbl">Ссылка</label>' +
        '<input class="stack-input share-url" readonly />' +
        "</div>"
    );
    var actions = panel.querySelector(".share-actions");
    var img = panel.querySelector("img");
    var urlInput = panel.querySelector(".share-url");
    img.src = qrImageUrl(url);
    img.loading = "lazy";
    urlInput.value = url;
    urlInput.addEventListener("click", function () {
      urlInput.select();
      copyText(url, "Ссылка скопирована");
    });

    var sendBtn = el('<button class="btn" type="button">Отправить…</button>');
    sendBtn.addEventListener("click", function () {
      tryNativeShare(url, "BMT", shareText).then(function (ok) {
        if (ok) {
          toast("Отправлено");
          return;
        }
        openExternal(telegramShareUrl(url, shareText));
      });
    });
    var tgBtn = el('<button class="btn btn-soft" type="button">Telegram</button>');
    tgBtn.addEventListener("click", function () {
      openExternal(telegramShareUrl(url, shareText));
    });
    var vkBtn = el('<button class="btn btn-soft" type="button">VK</button>');
    vkBtn.addEventListener("click", function () {
      openExternal(vkShareUrl(url, shareText));
    });
    var copyBtn = el('<button class="btn btn-soft" type="button">Копировать</button>');
    copyBtn.addEventListener("click", function () {
      copyText(url, "Ссылка скопирована");
    });
    actions.appendChild(sendBtn);
    actions.appendChild(tgBtn);
    actions.appendChild(vkBtn);
    actions.appendChild(copyBtn);
    host.appendChild(panel);

    if (autoShare) {
      setTimeout(function () {
        tryNativeShare(url, "BMT", shareText);
      }, 400);
    }
    return panel;
  }

  function importRequestFromPaste(raw) {
    var token = extractShareToken(raw);
    if (!token) {
      return { ok: false, error: "Вставьте ссылку заявки из сообщения" };
    }
    return store.importRequest(data, token);
  }

  function renderAdminCreate() {
    renderAdminPageHead("Создать кабинет", "Ручное создание кабинета сотрудника.");
    var createCard = el(
      '<section class="card"><h2>Новый кабинет</h2>' +
        '<p class="status">После создания скопируйте ссылку-приглашение и отправьте преподавателю — иначе на его телефоне кабинета не будет (данные пока только в браузере).</p>' +
        '<form class="stack">' +
        '<label class="lbl">ФИО</label>' +
        '<input name="fullName" required maxlength="80" placeholder="Иванова А. С." />' +
        '<label class="lbl">Логин (латиница)</label>' +
        '<input name="login" required maxlength="40" placeholder="ivanova" autocomplete="off" />' +
        '<label class="lbl">Пароль</label>' +
        '<input name="password" type="password" required minlength="6" placeholder="мин. 6 символов" autocomplete="new-password" />' +
        '<label class="lbl">Должность</label>' +
        '<select name="role"></select>' +
        '<label class="lbl">Группа (обязательно для куратора)</label>' +
        '<select name="groupId"></select>' +
        '<button class="btn" type="submit">Создать</button></form></section>'
    );
    var roleSel = createCard.querySelector('[name="role"]');
    store.ROLE_ORDER.forEach(function (r) {
      if (r === "admin") return;
      roleSel.appendChild(option(r, store.roleLabel(r), r === "curator"));
    });
    var gSel = createCard.querySelector('[name="groupId"]');
    gSel.appendChild(option("", "Без группы (для руководства)"));
    data.groups
      .slice()
      .sort(function (a, b) {
        return a.name.localeCompare(b.name, "ru");
      })
      .forEach(function (g) {
        gSel.appendChild(option(g.id, "Группа " + g.name));
      });
    createCard.querySelector("form").addEventListener("submit", function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var groupId = String(fd.get("groupId") || "");
      var password = String(fd.get("password") || "");
      store
        .createUser(data, {
          name: fd.get("fullName"),
          login: fd.get("login"),
          password: password,
          role: fd.get("role"),
          groupIds: groupId ? [groupId] : [],
        })
        .then(function (res) {
          if (!res.ok) {
            toast(res.error, true);
            return;
          }
          logAction(
            "Кабинет создан",
            "@" +
              res.user.login +
              " · " +
              res.user.name +
              " · " +
              store.roleLabel(res.user.role) +
              (groupId
                ? " · группа " + ((groupById(groupId) || {}).name || "?")
                : ""),
            {
              target: "@" + res.user.login,
              category: res.user.role,
              groupId: groupId || "",
              groupName: ((groupById(groupId) || {}).name || ""),
            }
          );
          if (!persist()) return;
          var link = inviteUrlFor(res.user, password);
          state.lastInvite = {
            login: res.user.login,
            password: password,
            url: link,
            autoShare: true,
          };
          toast("Отправьте ссылку преподавателю");
          navigate("users", true);
        })
        .catch(function () {
          toast("Не удалось создать кабинет", true);
        });
    });
    root.appendChild(createCard);
  }

  function renderAdminUsers() {
    renderAdminPageHead("Кабинеты", "Управление пользователями, ролями и доступом.");
    if (state.lastInvite) {
      var inviteCard = el(
        '<section class="card">' +
          "<h2>Отправьте кабинет @" +
          escapeHtml(state.lastInvite.login) +
          "</h2>" +
          '<p class="status">Преподаватель откроет ссылку на своём телефоне и войдёт паролем из заявки' +
          (state.lastInvite.password &&
          state.lastInvite.password.indexOf("пароль") === -1
            ? ": <strong>" + escapeHtml(state.lastInvite.password) + "</strong>"
            : "") +
          ".</p>" +
          '<div class="share-host"></div>' +
          '<div class="toolbar"></div></section>'
      );
      mountSharePanel(inviteCard.querySelector(".share-host"), {
        url: state.lastInvite.url,
        title: "Кабинет BMT",
        shareText:
          "Ваш кабинет BMT @" +
          state.lastInvite.login +
          ". Откройте ссылку и войдите своим паролем:",
        autoShare: !!state.lastInvite.autoShare,
      });
      state.lastInvite.autoShare = false;
      var hideBtn = el('<button class="btn btn-soft" type="button">Скрыть</button>');
      hideBtn.addEventListener("click", function () {
        state.lastInvite = null;
        render();
      });
      inviteCard.querySelector(".toolbar").appendChild(hideBtn);
      root.appendChild(inviteCard);
    }
    var usersCard = el(
      '<section class="card"><h2>Все кабинеты (' +
        data.users.length +
        ")</h2>" +
        '<input class="stack-input" name="userSearch" maxlength="80" placeholder="Поиск по ФИО или логину" /></section>'
    );
    var searchInput = usersCard.querySelector('[name="userSearch"]');
    searchInput.value = state.userSearch;
    searchInput.addEventListener("input", function () {
      state.userSearch = searchInput.value;
      render();
      var again = root.querySelector('[name="userSearch"]');
      if (again) {
        again.focus();
        var len = again.value.length;
        again.setSelectionRange(len, len);
      }
    });
    var q = state.userSearch.trim().toLowerCase();
    var list = data.users
      .slice()
      .sort(function (a, b) {
        return a.name.localeCompare(b.name, "ru");
      })
      .filter(function (u) {
        if (!q) return true;
        return (
          u.name.toLowerCase().indexOf(q) >= 0 ||
          u.login.toLowerCase().indexOf(q) >= 0 ||
          store.roleLabel(u.role).toLowerCase().indexOf(q) >= 0
        );
      });
    if (!list.length) {
      usersCard.appendChild(el('<p class="status">Никого не найдено.</p>'));
    }
    list.forEach(function (u) {
      var groupNames = (u.groupIds || [])
        .map(function (id) {
          var g = groupById(id);
          return g ? g.name : "";
        })
        .filter(Boolean);
      // подтянуть имена, если id устарели после облака
      if (!groupNames.length && Array.isArray(u.groupNames) && u.groupNames.length) {
        u.groupNames.forEach(function (name) {
          var found = data.groups.find(function (g) {
            return String(g.name).toLowerCase() === String(name).toLowerCase();
          });
          if (found) {
            groupNames.push(found.name);
            if ((u.groupIds || []).indexOf(found.id) < 0) {
              u.groupIds = (u.groupIds || []).concat([found.id]);
            }
          }
        });
      }
      var groupsLabel = groupNames.join(", ");
      var row = el(
        '<div class="admin-item">' +
          "<strong>" +
          escapeHtml(u.name) +
          "</strong>" +
          "<small>@" +
          escapeHtml(u.login) +
          " · " +
          escapeHtml(store.roleLabel(u.role)) +
          " · " +
          (u.status === "active" ? "активен" : "отключён") +
          (groupsLabel
            ? " · группы: " + escapeHtml(groupsLabel)
            : " · без группы") +
          (u.role === "curator" && !groupsLabel
            ? " · нужно назначить группу"
            : "") +
          "</small>" +
          '<div class="toolbar"></div></div>'
      );
      var tools = row.querySelector(".toolbar");
      if (u.login !== "dragov") {
        var attach = el('<button class="btn btn-soft" type="button">Группа</button>');
        attach.addEventListener("click", function () {
          var names = data.groups
            .map(function (x) {
              return x.name;
            })
            .join(", ");
          var pick = prompt(
            "Прикрепить группу (" + names + "). Пусто = снять.",
            groupsLabel
          );
          if (pick === null) return;
          pick = pick.trim();
          if (!pick) {
            u.groupIds = [];
            u.groupNames = [];
            logAction("Группа снята", "@" + u.login);
          } else {
            var found = data.groups.find(function (x) {
              return x.name.toLowerCase() === pick.toLowerCase();
            });
            if (!found) {
              toast("Группа не найдена", true);
              return;
            }
            u.groupIds = [found.id];
            u.groupNames = [found.name];
            logAction("Группа прикреплена", "@" + u.login + " → " + found.name);
          }
          if (!persist()) return;
          toast("Группа обновлена");
          render();
        });
        var roleBtn = el('<button class="btn btn-soft" type="button">Должность</button>');
        roleBtn.addEventListener("click", function () {
          var next = prompt(
            "Должность: curator / head / deputy / director / administrator",
            u.role
          );
          if (next === null) return;
          next = next.trim();
          if (!store.ROLES[next] || next === "admin") {
            toast("Некорректная должность. Для полных прав выберите administrator", true);
            return;
          }
          var prev = u.role;
          u.role = next;
          logAction(
            "Должность изменена",
            "@" + u.login + ": " + store.roleLabel(prev) + " → " + store.roleLabel(next)
          );
          if (!persist()) return;
          toast("Должность обновлена");
          render();
        });
        var passBtn = el('<button class="btn btn-soft" type="button">Пароль</button>');
        passBtn.addEventListener("click", function () {
          var next = prompt("Новый пароль для @" + u.login + " (мин. 6 символов)");
          if (next === null) return;
          store.resetUserPassword(data, u.id, next).then(function (res) {
            if (!res.ok) {
              toast(res.error, true);
              return;
            }
            logAction("Сброс пароля", "@" + u.login);
            if (!persist()) return;
            state.lastInvite = {
              login: u.login,
              password: next,
              url: inviteUrlFor(u, next),
              autoShare: true,
            };
            toast("Отправьте новую ссылку преподавателю");
            render();
          });
        });
        var invBtn = el('<button class="btn btn-soft" type="button">Ссылка</button>');
        invBtn.addEventListener("click", function () {
          state.lastInvite = {
            login: u.login,
            password: "",
            url: inviteUrlFor(u),
            autoShare: true,
          };
          render();
        });
        var toggle = el(
          '<button class="btn btn-ghost" type="button">' +
            (u.status === "active" ? "Отключить" : "Включить") +
            "</button>"
        );
        toggle.addEventListener("click", function () {
          u.status = u.status === "active" ? "disabled" : "active";
          logAction(
            u.status === "active" ? "Кабинет включён" : "Кабинет отключён",
            "@" + u.login
          );
          if (!persist()) return;
          toast("Статус обновлён");
          render();
        });
        tools.appendChild(attach);
        tools.appendChild(roleBtn);
        tools.appendChild(passBtn);
        tools.appendChild(invBtn);
        tools.appendChild(toggle);
      } else {
        tools.appendChild(el('<span class="status">Главный админ</span>'));
      }
      usersCard.appendChild(row);
    });
    root.appendChild(usersCard);
  }

  function renderAdminGroups() {
    renderAdminPageHead("Кураторы", "Кто за какой группой закреплён.");
    var card = el(
      '<section class="card"><h2>Группы и кураторы</h2></section>'
    );
    data.groups
      .slice()
      .sort(function (a, b) {
        return a.name.localeCompare(b.name, "ru");
      })
      .forEach(function (g) {
        var curators = store.findCuratorForGroup(data, g.id);
        var names = curators
          .map(function (u) {
            return u.name + " (@" + u.login + ")";
          })
          .join(", ");
        card.appendChild(
          el(
            '<div class="admin-item"><strong>' +
              escapeHtml(g.name) +
              "</strong><small>" +
              g.students.length +
              " студ. · " +
              store.groupTotal(g) +
              " баллов · куратор: " +
              escapeHtml(names || "не назначен") +
              "</small></div>"
          )
        );
      });
    if (!data.groups.length) {
      card.appendChild(el('<p class="status">Групп пока нет.</p>'));
    }
    root.appendChild(card);
  }

  function renderAdminLogs() {
    renderAdminPageHead(
      "Логи",
      "Общий журнал (облако). До 800 записей: IP, платформа, UA, экран, язык, часовой пояс, сеть, VK."
    );
    var card = el(
      '<section class="card"><h2>Журнал</h2>' +
        '<div class="toolbar"></div>' +
        '<input class="stack-input" name="logSearch" maxlength="80" placeholder="Поиск по логам" /></section>'
    );
    var tools = card.querySelector(".toolbar");
    var exportBtn = el('<button class="btn btn-soft" type="button">Экспорт CSV</button>');
    exportBtn.addEventListener("click", function () {
      store.downloadText(
        "bmt-logs-" + new Date().toISOString().slice(0, 10) + ".csv",
        store.logsCsv(data),
        "text/csv;charset=utf-8"
      );
      logAction("Экспорт логов", "CSV скачан");
      persist();
      toast("Логи экспортированы");
    });
    var clearBtn = el('<button class="btn btn-ghost" type="button">Очистить логи</button>');
    clearBtn.addEventListener("click", function () {
      if (!confirm("Удалить все записи журнала?")) return;
      store.clearLogs(data, 0);
      logAction("Очистка логов", "Журнал очищен");
      if (!persist()) return;
      toast("Логи очищены");
      render();
    });
    tools.appendChild(exportBtn);
    tools.appendChild(clearBtn);

    var searchInput = card.querySelector('[name="logSearch"]');
    searchInput.value = state.logSearch;
    searchInput.addEventListener("input", function () {
      state.logSearch = searchInput.value;
      render();
      var again = root.querySelector('[name="logSearch"]');
      if (again) {
        again.focus();
        var len = again.value.length;
        again.setSelectionRange(len, len);
      }
    });
    root.appendChild(card);

    var q = state.logSearch.trim().toLowerCase();
    var list = (data.logs || []).filter(function (log) {
      if (!q) return true;
      return (
        String(log.action).toLowerCase().indexOf(q) >= 0 ||
        String(log.details).toLowerCase().indexOf(q) >= 0 ||
        String(log.actorName).toLowerCase().indexOf(q) >= 0 ||
        String(log.actorLogin).toLowerCase().indexOf(q) >= 0
      );
    });
    var listCard = el('<section class="card"></section>');
    if (!list.length) {
      listCard.appendChild(el('<p class="status">Записей нет.</p>'));
    } else {
      list.slice(0, 150).forEach(function (log) {
        var extra = [];
        if (log.ip) extra.push("IP " + log.ip);
        if (log.groupName) extra.push("группа " + log.groupName);
        if (log.target) extra.push("цель: " + log.target);
        if (log.amount !== "" && log.amount !== undefined && log.amount !== null) {
          extra.push("сумма " + log.amount);
        }
        if (log.category) extra.push(log.category);
        if (log.actorRole) extra.push(store.roleLabel(log.actorRole) || log.actorRole);
        if (log.platform) extra.push(log.platform);
        if (log.screen) extra.push(log.screen);
        if (log.language) extra.push(log.language);
        if (log.timezone) extra.push(log.timezone);
        if (log.connection) extra.push(log.connection);
        if (log.vkUserId) extra.push("vk:" + log.vkUserId);
        if (log.online) extra.push(log.online);
        listCard.appendChild(
          el(
            '<div class="log-row"><strong>' +
              escapeHtml(log.action) +
              "</strong><small>" +
              escapeHtml(log.actorName) +
              " · @" +
              escapeHtml(log.actorLogin) +
              " · " +
              formatDate(log.at) +
              (log.details ? " · " + escapeHtml(log.details) : "") +
              (extra.length ? " · " + escapeHtml(extra.join(" · ")) : "") +
              "</small></div>"
          )
        );
      });
    }
    root.appendChild(listCard);
  }

  function renderGroups() {
    var visible = store.visibleGroups(data, me);
    var card = el('<section class="card"></section>');
    card.innerHTML =
      "<h1>Мои группы</h1>" +
      '<p class="status">' +
      (store.canSeeAllGroups(me)
        ? "Вам доступны все группы техникума."
        : "Вам прикреплены только ваши группы.") +
      ' Список можно подтянуть из <a href="https://bumate.ru/schedule" target="_blank" rel="noreferrer">bumate.ru</a>.</p>';

    var tools = el('<div class="toolbar"></div>');
    if (store.isAdmin(me) || store.canSeeAllGroups(me)) {
      var presetBtn = el(
        '<button class="btn btn-soft" type="button">Загрузить группы с bumate.ru</button>'
      );
      presetBtn.addEventListener("click", function () {
        var added = store.ensurePresetGroups(data);
        if (!added) {
          toast("Все группы из расписания уже есть");
          logAction("Импорт групп bumate.ru", "Новых групп нет, всё уже загружено");
          persist();
          return;
        }
        if (!persist()) return;
        logAction("Импорт групп bumate.ru", "Добавлено групп: " + added, {
          amount: added,
        });
        persist();
        toast("Добавлено групп: " + added);
        render();
      });
      tools.appendChild(presetBtn);
    }
    if (store.isAdmin(me)) {
      var exportBtn = el('<button class="btn btn-soft" type="button">Скачать бэкап</button>');
      exportBtn.addEventListener("click", function () {
        store.downloadText(
          "bmt-backup-" + new Date().toISOString().slice(0, 10) + ".json",
          store.exportJson(data),
          "application/json;charset=utf-8"
        );
        toast("Бэкап скачан");
        logAction("Бэкап скачан", "JSON экспорт");
        persist();
      });
      var importLabel = el(
        '<label class="btn btn-soft file-btn">Восстановить<input type="file" accept="application/json,.json" hidden /></label>'
      );
      importLabel.querySelector("input").addEventListener("change", function (e) {
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          try {
            var imported = store.importJson(String(reader.result || ""));
            if (!confirm("Заменить текущие данные бэкапом? Это необратимо.")) return;
            data = imported;
            store.ensureAdmin(data).then(function () {
              logAction(
                "Восстановление бэкапа",
                "Импорт JSON · групп: " +
                  data.groups.length +
                  " · кабинетов: " +
                  data.users.length,
                {
                  amount: data.groups.length,
                  target: "backup-import",
                }
              );
              if (!persist()) return;
              refreshMe();
              toast("Данные восстановлены");
              navigate("groups", true);
            });
          } catch (err) {
            toast("Файл бэкапа повреждён", true);
          }
        };
        reader.readAsText(file);
      });
      tools.appendChild(exportBtn);
      tools.appendChild(importLabel);
    }
    if (tools.childNodes.length) card.appendChild(tools);

    var list = document.createElement("div");
    if (!visible.length) {
      list.innerHTML =
        '<p class="status">Вам пока не прикреплена группа. Обратитесь к админу.</p>';
    } else {
      visible
        .slice()
        .sort(function (a, b) {
          return a.name.localeCompare(b.name, "ru");
        })
        .forEach(function (g) {
          var total = store.groupTotal(g);
          var row = el(
            '<button class="row" type="button">' +
              (g.cover
                ? '<img class="row-cover" alt="" />'
                : '<span class="row-cover row-cover-empty"></span>') +
              "<span class=\"row-text\"><strong>" +
              escapeHtml(g.name) +
              "</strong><small>" +
              g.students.length +
              " студ. · " +
              (g.photos ? g.photos.length : 0) +
              " фото</small></span>" +
              '<span class="badge">' +
              total +
              "</span></button>"
          );
          if (g.cover) row.querySelector("img").src = g.cover;
          row.addEventListener("click", function () {
            state.search = "";
            state.catFilter = "Все";
            navigate("group/" + g.id);
          });
          list.appendChild(row);
        });
    }
    card.appendChild(list);

    if (store.isAdmin(me) || store.canSeeAllGroups(me)) {
      var form = el(
        '<form class="stack">' +
          '<input name="groupName" required maxlength="40" placeholder="Название, например 616" />' +
          '<button class="btn" type="submit">Создать группу</button>' +
          "</form>"
      );
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var name = String(new FormData(form).get("groupName") || "").trim();
        if (!name) return;
        data.groups.push({
          id: store.uid(),
          name: name,
          students: [],
          events: [],
          photos: [],
          cover: "",
        });
        if (!persist()) return;
        logAction("Группа создана", "«" + name + "»", {
          groupName: name,
          target: name,
        });
        persist();
        toast("Группа «" + name + "» создана");
        render();
      });
      card.appendChild(form);
    }
    root.appendChild(card);
  }

  function renderCriteriaPanel(host, g) {
    var criteria = window.BmtCriteria;
    if (!criteria || !criteria.SECTIONS) {
      host.appendChild(
        el('<p class="status">Не загружен файл критериев. Обновите страницу (Ctrl+F5).</p>')
      );
      return;
    }

    criteria.SECTIONS.forEach(function (section) {
      var box = el(
        '<div class="criteria-block">' +
          "<h3>" +
          escapeHtml(section.title) +
          "</h3>" +
          (section.hint
            ? '<p class="status">' + escapeHtml(section.hint) + "</p>"
            : "") +
          '<div class="criteria-grid"></div></div>'
      );
      var grid = box.querySelector(".criteria-grid");
      section.items.forEach(function (item) {
        var active =
          item.mode === "set" &&
          (g.events || []).some(function (e) {
            return e.criterionKey === item.key && Number(e.delta) === Number(item.delta);
          });
        var btn = el(
          '<button class="criteria-btn' +
            (active ? " is-on" : "") +
            (Number(item.delta) < 0 ? " is-minus" : Number(item.delta) > 0 ? " is-plus" : "") +
            '" type="button"><span class="criteria-pts">' +
            escapeHtml(criteria.formatDelta(item.delta)) +
            '</span><span class="criteria-label">' +
            escapeHtml(item.label) +
            (item.mode === "count" ? " × N" : "") +
            "</span></button>"
        );
        btn.addEventListener("click", function () {
          var count = 1;
          if (item.mode === "count") {
            var raw = prompt(item.countLabel || "Количество", "1");
            if (raw === null) return;
            count = Math.max(1, Math.floor(Number(raw) || 0));
            if (!count) {
              toast("Укажите число больше 0", true);
              return;
            }
          }
          var ev = criteria.applyCriterion(g, item, count);
          if (!persist()) return;
          logAction(
            Number(ev.delta) >= 0 ? "Критерий положения +" : "Критерий положения −",
            "Группа " +
              g.name +
              " · " +
              ev.reason +
              " · " +
              formatPts(ev.delta),
            {
              groupId: g.id,
              groupName: g.name,
              target: item.label,
              amount: ev.delta,
              category: item.category,
            }
          );
          persist();
          toast(
            (item.mode === "set" ? "Показатель: " : "Добавлено: ") +
              item.label +
              " · " +
              formatPts(ev.delta)
          );
          render();
        });
        grid.appendChild(btn);
      });
      host.appendChild(box);
    });
  }

  function renderGroup() {
    var g = groupById(state.groupId);
    if (!g || !store.canAccessGroup(me, g.id)) {
      navigate("groups", true);
      return;
    }
    var ranked = store.rankedStudents(g);
    var cats = store.categoryTotals(g);
    var q = state.search.trim().toLowerCase();
    var filtered = ranked.filter(function (item) {
      if (q && item.student.name.toLowerCase().indexOf(q) === -1) return false;
      if (state.catFilter !== "Все") {
        var map = store.categoryTotals(g, item.student.id);
        return Number(map[state.catFilter] || 0) !== 0;
      }
      return true;
    });

    var nav = el(
      '<p class="navline"><button class="link" type="button">← Все группы</button></p>'
    );
    nav.querySelector("button").addEventListener("click", function () {
      navigate("groups");
    });
    root.appendChild(nav);

    var head = el('<section class="card head-card"></section>');
    var headMain = el('<div class="head-main"></div>');
    headMain.appendChild(el("<h1>" + escapeHtml(g.name) + "</h1>"));
    headMain.appendChild(
      el(
        '<p class="status">Всего баллов группы: <strong>' +
          store.groupTotal(g) +
          "</strong></p>"
      )
    );
    var chips = document.createElement("div");
    chips.className = "chips";
    store.CATEGORIES.forEach(function (c) {
      chips.appendChild(
        el('<span class="chip">' + escapeHtml(c) + ": " + cats[c] + "</span>")
      );
    });
    headMain.appendChild(chips);

    var headTools = el('<div class="toolbar"></div>');
    var renameBtn = el('<button class="btn btn-soft" type="button">Переименовать</button>');
    renameBtn.addEventListener("click", function () {
      var next = prompt("Новое название группы", g.name);
      if (next === null) return;
      next = next.trim();
      if (!next) return;
      var oldName = g.name;
      g.name = next.slice(0, 40);
      if (!persist()) return;
      logAction(
        "Группа переименована",
        "«" + oldName + "» → «" + g.name + "»",
        { groupId: g.id, groupName: g.name, target: oldName }
      );
      persist();
      toast("Группа переименована");
      render();
    });
    var csvBtn = el('<button class="btn btn-soft" type="button">Экспорт CSV</button>');
    csvBtn.addEventListener("click", function () {
      store.downloadText(
        "rating-" + safeName(g.name) + ".csv",
        store.rankingCsv(g),
        "text/csv;charset=utf-8"
      );
      logAction("Экспорт рейтинга CSV", "Группа " + g.name, {
        groupId: g.id,
        groupName: g.name,
        amount: g.students.length,
      });
      persist();
      toast("Рейтинг экспортирован");
    });
    var shareBtn = el('<button class="btn btn-soft" type="button">Поделиться</button>');
    shareBtn.addEventListener("click", shareApp);
    headTools.appendChild(renameBtn);
    headTools.appendChild(csvBtn);
    headTools.appendChild(shareBtn);
    headMain.appendChild(headTools);

    var coverWrap = el('<div class="group-cover"></div>');
    if (g.cover) {
      var coverImg = el('<img class="group-cover-img" alt="Фото группы" />');
      coverImg.src = g.cover;
      coverWrap.appendChild(coverImg);
      var coverActions = el('<div class="group-cover-actions"></div>');
      var changeCover = el('<button class="link" type="button">Сменить</button>');
      var clearCover = el('<button class="link" type="button">Убрать</button>');
      changeCover.addEventListener("click", function () {
        pickCover(g);
      });
      clearCover.addEventListener("click", function () {
        g.cover = "";
        if (!persist()) return;
        logAction("Обложка группы убрана", "Группа " + g.name, {
          groupId: g.id,
          groupName: g.name,
        });
        persist();
        toast("Фото группы убрано");
        render();
      });
      coverActions.appendChild(changeCover);
      coverActions.appendChild(clearCover);
      coverWrap.appendChild(coverActions);
    } else {
      var addCover = el(
        '<button class="group-cover-empty" type="button">+ Фото группы</button>'
      );
      addCover.addEventListener("click", function () {
        pickCover(g);
      });
      coverWrap.appendChild(addCover);
    }

    head.appendChild(headMain);
    head.appendChild(coverWrap);
    root.appendChild(head);

    root.appendChild(renderGroupPhotos(g));
    root.appendChild(renderRecentEvents(g));

    var table = el('<section class="card"><h2>Рейтинг</h2></section>');
    var filters = el(
      '<div class="stack tight">' +
        '<input name="search" maxlength="80" placeholder="Поиск по ФИО" />' +
        '<select name="catFilter"></select></div>'
    );
    var searchInput = filters.querySelector('[name="search"]');
    searchInput.value = state.search;
    searchInput.addEventListener("input", function () {
      state.search = searchInput.value;
      render();
      var again = root.querySelector('[name="search"]');
      if (again) {
        again.focus();
        var len = again.value.length;
        again.setSelectionRange(len, len);
      }
    });
    var catSel = filters.querySelector('[name="catFilter"]');
    ["Все"].concat(store.CATEGORIES).forEach(function (c) {
      catSel.appendChild(option(c, c === "Все" ? "Все категории" : "Есть баллы: " + c, c === state.catFilter));
    });
    catSel.addEventListener("change", function () {
      state.catFilter = catSel.value;
      render();
    });
    table.appendChild(filters);

    if (!ranked.length) {
      table.appendChild(el('<p class="status">Добавьте студентов.</p>'));
    } else if (!filtered.length) {
      table.appendChild(el('<p class="status">Никого не найдено по фильтру.</p>'));
    } else {
      filtered.forEach(function (item) {
        var place = ranked.findIndex(function (r) {
          return r.student.id === item.student.id;
        });
        var row = el(
          '<button class="row" type="button"><span><strong>' +
            (place + 1) +
            ". " +
            escapeHtml(item.student.name) +
            "</strong></span><span class=\"badge\">" +
            item.total +
            "</span></button>"
        );
        row.addEventListener("click", function () {
          navigate("student/" + g.id + "/" + item.student.id);
        });
        table.appendChild(row);
      });
    }
    root.appendChild(table);

    var addSt = el(
      '<section class="card"><h2>Студенты</h2>' +
        '<form class="stack">' +
        '<input name="studentName" maxlength="80" placeholder="ФИО одного студента" />' +
        '<textarea name="bulk" rows="4" placeholder="Или список целиком — каждое ФИО с новой строки"></textarea>' +
        '<button class="btn" type="submit">Добавить</button></form></section>'
    );
    addSt.querySelector("form").addEventListener("submit", function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var one = String(fd.get("studentName") || "").trim();
      var bulk = String(fd.get("bulk") || "");
      var names = [];
      if (one) names.push(one);
      bulk.split(/\r?\n/).forEach(function (line) {
        var n = line.trim();
        if (n) names.push(n);
      });
      if (!names.length) {
        toast("Введите ФИО", true);
        return;
      }
      var existing = {};
      g.students.forEach(function (s) {
        existing[s.name.toLowerCase()] = true;
      });
      var added = 0;
      names.forEach(function (name) {
        var key = name.toLowerCase();
        if (existing[key]) return;
        existing[key] = true;
        g.students.push({ id: store.uid(), name: name.slice(0, 80) });
        added += 1;
      });
      if (!added) {
        toast("Такие студенты уже есть", true);
        return;
      }
      if (!persist()) return;
      logAction(
        "Студенты добавлены",
        "Группа " + g.name + " · +" + added + " · " + names.slice(0, 3).join(", ") + (names.length > 3 ? "…" : ""),
        {
          groupId: g.id,
          groupName: g.name,
          amount: added,
          target: names.slice(0, 5).join(", "),
        }
      );
      persist();
      toast("Добавлено: " + added);
      render();
    });
    root.appendChild(addSt);

    var addPts = el(
      '<section class="card"><h2>Начислить по положению</h2>' +
        '<p class="status">СТП-ПО-ВС № 5-07 · «Лучшая учебная группа года». Нажимайте кнопки — баллы подставятся сами. Показатели с одним выбором (успеваемость, посещаемость и т.п.) заменяют предыдущее значение.</p></section>'
    );
    renderCriteriaPanel(addPts, g);
    root.appendChild(addPts);

    var manualPts = el('<section class="card"><h2>Вручную студенту</h2></section>');
    if (!g.students.length) {
      manualPts.appendChild(
        el('<p class="status">Сначала добавьте студента кнопкой выше.</p>')
      );
    } else {
      var sorted = g.students.slice().sort(function (a, b) {
        return a.name.localeCompare(b.name, "ru");
      });
      var picked = { id: sorted[0].id };
      var pickLabel = el(
        '<p class="status">Студент: <strong id="picked-name">' +
          escapeHtml(sorted[0].name) +
          "</strong></p>"
      );
      manualPts.appendChild(pickLabel);
      var pickWrap = el('<div class="pick-list"></div>');
      sorted.forEach(function (s) {
        var btn = el(
          '<button class="row pick" type="button">' + escapeHtml(s.name) + "</button>"
        );
        if (s.id === picked.id) btn.classList.add("pick-on");
        btn.addEventListener("click", function () {
          picked.id = s.id;
          pickWrap.querySelectorAll(".pick").forEach(function (b) {
            b.classList.remove("pick-on");
          });
          btn.classList.add("pick-on");
          manualPts.querySelector("#picked-name").textContent = s.name;
        });
        pickWrap.appendChild(btn);
      });
      manualPts.appendChild(pickWrap);
      var form = el(
        '<form class="stack">' +
          '<label class="lbl">Категория</label>' +
          '<select name="category"></select>' +
          '<label class="lbl">Баллы</label>' +
          '<input name="delta" type="number" required step="1" placeholder="Например 5 или -2" />' +
          '<label class="lbl">Причина</label>' +
          '<input name="reason" maxlength="120" placeholder="За что начислено" />' +
          '<button class="btn" type="submit">Сохранить баллы</button></form>'
      );
      var categorySel = form.querySelector('[name="category"]');
      store.CATEGORIES.forEach(function (c) {
        categorySel.appendChild(option(c, c));
      });
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var fd = new FormData(form);
        var delta = Number(fd.get("delta"));
        if (!delta || !picked.id) return;
        g.events.unshift({
          id: store.uid(),
          studentId: picked.id,
          delta: delta,
          category: String(fd.get("category") || "Прочее"),
          reason: String(fd.get("reason") || "").trim() || "Без комментария",
          at: new Date().toISOString(),
        });
        if (!persist()) return;
        var st = studentById(g, picked.id);
        logAction(
          delta > 0 ? "Начисление баллов" : "Списание баллов",
          "Группа " +
            g.name +
            " · " +
            (st ? st.name : "?") +
            " · " +
            formatPts(delta) +
            " · " +
            String(fd.get("category") || "Прочее") +
            " · " +
            (String(fd.get("reason") || "").trim() || "Без комментария"),
          {
            groupId: g.id,
            groupName: g.name,
            target: st ? st.name : picked.id,
            amount: delta,
            category: String(fd.get("category") || "Прочее"),
          }
        );
        persist();
        toast("Баллы сохранены: " + formatPts(delta));
        render();
      });
      manualPts.appendChild(form);
    }
    root.appendChild(manualPts);

    if (store.isAdmin(me) || store.canSeeAllGroups(me)) {
      var danger = el(
        '<section class="card"><button class="btn btn-ghost" type="button">Удалить группу</button></section>'
      );
      danger.querySelector("button").addEventListener("click", function () {
        if (!confirm("Удалить группу «" + g.name + "» и все баллы?")) return;
        data.groups = data.groups.filter(function (x) {
          return x.id !== g.id;
        });
        data.users.forEach(function (u) {
          u.groupIds = (u.groupIds || []).filter(function (id) {
            return id !== g.id;
          });
        });
        if (!persist()) return;
        logAction(
          "Группа удалена",
          "«" + g.name + "» · студ. " + g.students.length + " · событий " + g.events.length,
          {
            groupId: g.id,
            groupName: g.name,
            amount: g.students.length,
          }
        );
        persist();
        toast("Группа удалена");
        navigate("groups", true);
      });
      root.appendChild(danger);
    }
  }

  function pickCover(g) {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      if (!file) return;
      compressImage(file, function (dataUrl) {
        if (!dataUrl) {
          toast("Не удалось прочитать фото", true);
          return;
        }
        g.cover = dataUrl;
        if (!Array.isArray(g.photos)) g.photos = [];
        var already = g.photos.some(function (p) {
          return p.kind === "Фото группы" && p.image === dataUrl;
        });
        if (!already) {
          g.photos.unshift({
            id: store.uid(),
            kind: "Фото группы",
            title: "Фото группы " + g.name,
            image: dataUrl,
            at: new Date().toISOString(),
          });
        }
        if (!persist()) return;
        logAction("Обложка группы установлена", "Группа " + g.name, {
          groupId: g.id,
          groupName: g.name,
          target: "cover",
        });
        persist();
        toast("Фото группы установлено");
        render();
      });
    });
    input.click();
  }

  function renderRecentEvents(g) {
    var box = el(
      '<section class="card"><h2>Последние операции</h2></section>'
    );
    var recent = g.events.slice(0, 8);
    if (!recent.length) {
      box.appendChild(el('<p class="status">Пока нет начислений.</p>'));
      return box;
    }
    recent.forEach(function (ev) {
      var row = el(
        '<div class="hist">' +
          '<span class="' +
          (ev.delta >= 0 ? "plus" : "minus") +
          '">' +
          formatPts(ev.delta) +
          "</span><span><strong>" +
          escapeHtml(store.studentName(g, ev.studentId)) +
          "</strong><small>" +
          escapeHtml(ev.reason) +
          " · " +
          escapeHtml(ev.category) +
          " · " +
          formatDate(ev.at) +
          '</small></span><button class="link" type="button">Отмена</button></div>'
      );
      row.querySelector("button").addEventListener("click", function () {
        if (!confirm("Отменить эту операцию?")) return;
        g.events = g.events.filter(function (x) {
          return x.id !== ev.id;
        });
        if (!persist()) return;
        logAction(
          "Отмена операции баллов",
          "Группа " +
            g.name +
            " · " +
            store.studentName(g, ev.studentId) +
            " · " +
            formatPts(ev.delta) +
            " · " +
            ev.category +
            " · " +
            ev.reason,
          {
            groupId: g.id,
            groupName: g.name,
            target: store.studentName(g, ev.studentId),
            amount: ev.delta,
            category: ev.category,
          }
        );
        persist();
        toast("Операция отменена");
        render();
      });
      box.appendChild(row);
    });
    return box;
  }

  function renderGroupPhotos(g) {
    if (!Array.isArray(g.photos)) g.photos = [];
    var box = el(
      '<section class="card"><h2>Альбом группы</h2>' +
        '<p class="status">Грамоты, общее фото группы, мероприятия.</p></section>'
    );
    var grid = document.createElement("div");
    grid.className = "gallery";
    if (!g.photos.length) {
      box.appendChild(el('<p class="status">Пока нет фото.</p>'));
    } else {
      g.photos.forEach(function (item) {
        var fig = el(
          '<figure class="shot"><img alt=""/><figcaption></figcaption>' +
            '<div class="shot-actions">' +
            '<button class="link" type="button" data-act="rename">Подпись</button>' +
            '<button class="link" type="button" data-act="del">Удалить</button>' +
            "</div></figure>"
        );
        fig.querySelector("img").src = item.image;
        fig.querySelector("figcaption").textContent =
          (item.kind || "Фото") +
          " · " +
          (item.title || "") +
          " · " +
          formatDate(item.at);
        fig.querySelector('[data-act="rename"]').addEventListener("click", function () {
          var next = prompt("Подпись к фото", item.title || "");
          if (next === null) return;
          item.title = next.trim().slice(0, 80) || item.kind || "Фото";
          if (!persist()) return;
          logAction(
            "Подпись фото изменена",
            "Группа " + g.name + " · " + (item.kind || "Фото") + " · «" + item.title + "»",
            {
              groupId: g.id,
              groupName: g.name,
              target: item.title,
              category: item.kind || "",
            }
          );
          persist();
          toast("Подпись обновлена");
          render();
        });
        fig.querySelector('[data-act="del"]').addEventListener("click", function () {
          if (!confirm("Удалить фото?")) return;
          g.photos = g.photos.filter(function (x) {
            return x.id !== item.id;
          });
          if (!persist()) return;
          logAction(
            "Фото удалено",
            "Группа " + g.name + " · " + (item.kind || "Фото") + " · «" + (item.title || "") + "»",
            {
              groupId: g.id,
              groupName: g.name,
              target: item.title || item.kind || "",
              category: item.kind || "",
            }
          );
          persist();
          toast("Фото удалено");
          render();
        });
        grid.appendChild(fig);
      });
      box.appendChild(grid);
    }
    var form = el(
      '<form class="stack">' +
        '<label class="lbl">Тип</label>' +
        '<select name="kind"></select>' +
        '<input name="title" maxlength="80" placeholder="Подпись, например День группы" />' +
        '<input name="photo" type="file" accept="image/*" />' +
        '<button class="btn" type="submit">Добавить фото</button></form>'
    );
    var kindSel = form.querySelector('[name="kind"]');
    store.PHOTO_KINDS.forEach(function (k) {
      kindSel.appendChild(option(k, k));
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var file = form.querySelector('[name="photo"]').files[0];
      if (!file) {
        toast("Выберите фото", true);
        return;
      }
      var fd = new FormData(form);
      var kind = String(fd.get("kind") || "Прочее");
      var title = String(fd.get("title") || "").trim() || kind;
      compressImage(file, function (dataUrl) {
        if (!dataUrl) {
          toast("Не удалось прочитать фото", true);
          return;
        }
        g.photos.unshift({
          id: store.uid(),
          kind: kind,
          title: title,
          image: dataUrl,
          at: new Date().toISOString(),
        });
        if (kind === "Фото группы" && !g.cover) {
          g.cover = dataUrl;
        }
        if (!persist()) return;
        logAction(
          "Фото добавлено в альбом",
          "Группа " + g.name + " · " + kind + " · «" + title + "»",
          {
            groupId: g.id,
            groupName: g.name,
            target: title,
            category: kind,
          }
        );
        persist();
        toast("Фото добавлено");
        render();
      });
    });
    box.appendChild(form);
    return box;
  }

  function renderStudent() {
    var g = groupById(state.groupId);
    var s = g && studentById(g, state.studentId);
    if (!s || !store.canAccessGroup(me, g.id)) {
      if (g) navigate("group/" + g.id, true);
      else navigate("groups", true);
      return;
    }
    var nav = el(
      '<p class="navline"><button class="link" type="button">← ' +
        escapeHtml(g.name) +
        "</button></p>"
    );
    nav.querySelector("button").addEventListener("click", function () {
      navigate("group/" + g.id);
    });
    root.appendChild(nav);

    var total = store.studentTotal(g, s.id);
    var cats = store.categoryTotals(g, s.id);
    var head = el(
      '<section class="card"><h1>' +
        escapeHtml(s.name) +
        '</h1><p class="sum">' +
        total +
        " баллов</p></section>"
    );
    var chips = document.createElement("div");
    chips.className = "chips";
    store.CATEGORIES.forEach(function (c) {
      chips.appendChild(
        el('<span class="chip">' + escapeHtml(c) + ": " + cats[c] + "</span>")
      );
    });
    head.appendChild(chips);

    var tools = el('<div class="toolbar"></div>');
    var renameBtn = el('<button class="btn btn-soft" type="button">Переименовать</button>');
    renameBtn.addEventListener("click", function () {
      var next = prompt("ФИО студента", s.name);
      if (next === null) return;
      next = next.trim();
      if (!next) return;
      var oldName = s.name;
      s.name = next.slice(0, 80);
      if (!persist()) return;
      logAction(
        "Студент переименован",
        "Группа " + g.name + " · «" + oldName + "» → «" + s.name + "»",
        {
          groupId: g.id,
          groupName: g.name,
          target: s.name,
        }
      );
      persist();
      toast("ФИО обновлено");
      render();
    });
    var delBtn = el('<button class="btn btn-ghost" type="button">Удалить студента</button>');
    delBtn.addEventListener("click", function () {
      if (!confirm("Удалить «" + s.name + "» и все его баллы?")) return;
      var removedName = s.name;
      var removedPts = store.studentTotal(g, s.id);
      g.students = g.students.filter(function (x) {
        return x.id !== s.id;
      });
      g.events = g.events.filter(function (x) {
        return x.studentId !== s.id;
      });
      if (!persist()) return;
      logAction(
        "Студент удалён",
        "Группа " + g.name + " · «" + removedName + "» · баллов было " + removedPts,
        {
          groupId: g.id,
          groupName: g.name,
          target: removedName,
          amount: removedPts,
        }
      );
      persist();
      toast("Студент удалён");
      navigate("group/" + g.id, true);
    });
    tools.appendChild(renameBtn);
    tools.appendChild(delBtn);
    head.appendChild(tools);
    root.appendChild(head);

    var quick = el(
      '<section class="card"><h2>Быстрое начисление</h2>' +
        '<form class="stack">' +
        '<select name="category"></select>' +
        '<input name="delta" type="number" required step="1" placeholder="Баллы" />' +
        '<input name="reason" maxlength="120" placeholder="Причина" />' +
        '<button class="btn" type="submit">Сохранить</button></form></section>'
    );
    var qCat = quick.querySelector('[name="category"]');
    store.CATEGORIES.forEach(function (c) {
      qCat.appendChild(option(c, c));
    });
    quick.querySelector("form").addEventListener("submit", function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var delta = Number(fd.get("delta"));
      if (!delta) return;
      g.events.unshift({
        id: store.uid(),
        studentId: s.id,
        delta: delta,
        category: String(fd.get("category") || "Прочее"),
        reason: String(fd.get("reason") || "").trim() || "Без комментария",
        at: new Date().toISOString(),
      });
      if (!persist()) return;
      logAction(
        delta > 0 ? "Начисление баллов" : "Списание баллов",
        "Группа " +
          g.name +
          " · " +
          s.name +
          " · " +
          formatPts(delta) +
          " · " +
          String(fd.get("category") || "Прочее") +
          " · " +
          (String(fd.get("reason") || "").trim() || "Без комментария") +
          " · быстрая форма",
        {
          groupId: g.id,
          groupName: g.name,
          target: s.name,
          amount: delta,
          category: String(fd.get("category") || "Прочее"),
        }
      );
      persist();
      toast("Баллы: " + formatPts(delta));
      render();
    });
    root.appendChild(quick);

    var hist = el('<section class="card"><h2>История баллов</h2></section>');
    var events = g.events.filter(function (e) {
      return e.studentId === s.id;
    });
    if (!events.length) {
      hist.appendChild(el('<p class="status">Пока нет операций.</p>'));
    } else {
      events.forEach(function (ev) {
        var row = el(
          '<div class="hist"><span class="' +
            (ev.delta >= 0 ? "plus" : "minus") +
            '">' +
            formatPts(ev.delta) +
            "</span><span><strong>" +
            escapeHtml(ev.reason) +
            "</strong><small>" +
            escapeHtml(ev.category) +
            " · " +
            formatDate(ev.at) +
            '</small></span><button class="link" type="button">Отмена</button></div>'
        );
        row.querySelector("button").addEventListener("click", function () {
          if (!confirm("Отменить эту операцию?")) return;
          g.events = g.events.filter(function (x) {
            return x.id !== ev.id;
          });
          if (!persist()) return;
          logAction(
            "Отмена операции баллов",
            "Группа " +
              g.name +
              " · " +
              s.name +
              " · " +
              formatPts(ev.delta) +
              " · " +
              ev.category +
              " · " +
              ev.reason +
              " · из карточки студента",
            {
              groupId: g.id,
              groupName: g.name,
              target: s.name,
              amount: ev.delta,
              category: ev.category,
            }
          );
          persist();
          toast("Операция отменена");
          render();
        });
        hist.appendChild(row);
      });
    }
    root.appendChild(hist);
  }

  function shareApp() {
    var link = window.location.href.split("#")[0];
    var bridge = window.vkBridge;
    if (bridge && typeof bridge.send === "function") {
      bridge
        .send("VKWebAppShare", { link: link })
        .then(function () {
          logAction("Поделиться", "Ссылка отправлена через VK", { target: link });
          persist();
          toast("Ссылка отправлена");
        })
        .catch(function () {
          copyLink(link);
        });
      return;
    }
    copyLink(link);
  }

  function copyLink(link) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(
        function () {
          logAction("Поделиться", "Ссылка скопирована", { target: link });
          persist();
          toast("Ссылка скопирована");
        },
        function () {
          prompt("Скопируйте ссылку", link);
        }
      );
    } else {
      prompt("Скопируйте ссылку", link);
    }
  }

  function initVk() {
    var bridge = window.vkBridge;
    if (!bridge || typeof bridge.send !== "function") return;
    bridge.send("VKWebAppInit");
  }

  var brandHome = document.getElementById("brand-home");
  if (brandHome) {
    brandHome.addEventListener("click", function () {
      refreshMe();
      navigate(me ? (store.isAdmin(me) ? "overview" : "groups") : "login");
    });
  }

  store.refreshClientMeta().finally(function () {
    if (window.BmtGuard && !window.BmtGuard.assertAllowed()) return;

    function boot() {
      store.ensureAdmin(data).then(function () {
        store.save(data);
        refreshMe();
        initVk();
        if (!location.hash || location.hash === "#" || location.hash === "#/") {
          history.replaceState(null, "", "#/" + defaultScreen());
        }
        window.addEventListener("hashchange", function () {
          render();
        });
        render();
        setTimeout(function () {
          runCloudSync(false).then(function (res) {
            if (res && res.ok) {
              store.ensureAdmin(data).then(function () {
                store.save(data);
                refreshMe();
                render();
              });
            }
          });
        }, 600);
      });
    }

    if (window.BmtCloud && window.BmtCloud.pullAndMerge) {
      window.BmtCloud.pullAndMerge(data)
        .then(function () {
          boot();
        })
        .catch(function () {
          boot();
        });
    } else {
      boot();
    }
  });
})();
