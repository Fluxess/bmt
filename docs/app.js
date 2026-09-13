(function () {
  var store = window.BmtStore;
  var root = document.getElementById("app");
  var state = {
    screen: "groups",
    groupId: null,
    studentId: null,
    search: "",
    catFilter: "Все",
    adminTab: "overview",
    userSearch: "",
    logSearch: "",
  };
  var data = store.load();
  if (!data.groups.length) {
    store.ensurePresetGroups(data);
    store.save(data);
  }
  var me = null;

  function persist() {
    if (!store.save(data)) {
      toast("Не хватило места в браузере. Удалите фото или сделайте бэкап.", true);
      return false;
    }
    return true;
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

  function updateHeader() {
    var status = document.getElementById("vk-status");
    if (!status) return;
    if (!me) {
      status.textContent = "ГАПОУ «БМТ» · войдите в личный кабинет";
      return;
    }
    status.textContent =
      me.name + " · " + store.roleLabel(me.role) + " · личный кабинет";
  }

  function renderAccountBar() {
    if (!me) return;
    var bar = el(
      '<section class="card account-bar">' +
        "<div><strong>" +
        escapeHtml(me.name) +
        '</strong><small>' +
        escapeHtml(store.roleLabel(me.role)) +
        " · @" +
        escapeHtml(me.login) +
        "</small></div>" +
        '<div class="toolbar"></div></section>'
    );
    var tools = bar.querySelector(".toolbar");
    if (store.isAdmin(me)) {
      var adminBtn = el('<button class="btn btn-soft" type="button">Админ-кабинет</button>');
      adminBtn.addEventListener("click", function () {
        state.screen = "admin";
        render();
      });
      tools.appendChild(adminBtn);
    }
    if (state.screen !== "groups" && state.screen !== "login" && state.screen !== "register") {
      var homeBtn = el('<button class="btn btn-soft" type="button">Мои группы</button>');
      homeBtn.addEventListener("click", function () {
        state.screen = "groups";
        state.groupId = null;
        state.studentId = null;
        render();
      });
      tools.appendChild(homeBtn);
    }
    var outBtn = el('<button class="btn btn-ghost" type="button">Выйти</button>');
    outBtn.addEventListener("click", function () {
      logAction("Выход", "Выход из кабинета · роль " + store.roleLabel(me.role), {
        target: "@" + me.login,
      });
      persist();
      store.logout();
      me = null;
      state.screen = "login";
      toast("Вы вышли из кабинета");
      render();
    });
    tools.appendChild(outBtn);
    root.appendChild(bar);
  }

  function render() {
    root.innerHTML = "";
    refreshMe();
    updateHeader();
    if (!me) {
      if (state.screen === "register") renderRegister();
      else renderLogin();
      return;
    }
    if (state.screen === "admin") {
      if (!store.isAdmin(me)) {
        state.screen = "groups";
      } else {
        renderAccountBar();
        renderAdmin();
        return;
      }
    }
    renderAccountBar();
    if (state.screen === "groups") renderGroups();
    else if (state.screen === "group") renderGroup();
    else renderStudent();
  }

  function renderLogin() {
    var card = el(
      '<section class="card">' +
        "<h1>Вход в личный кабинет</h1>" +
        '<p class="status">У каждого сотрудника — свой кабинет. Куратору прикрепляется группа.</p>' +
        '<form class="stack">' +
        '<label class="lbl">Логин</label>' +
        '<input name="login" required autocomplete="username" placeholder="логин" />' +
        '<label class="lbl">Пароль</label>' +
        '<input name="password" type="password" required autocomplete="current-password" />' +
        '<button class="btn" type="submit">Войти</button></form>' +
        '<p class="status">Нет кабинета? <button class="link" type="button" id="go-reg">Подать заявку</button></p>' +
        "</section>"
    );
    card.querySelector("#go-reg").addEventListener("click", function () {
      state.screen = "register";
      render();
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
        state.screen = store.isAdmin(me) ? "admin" : "groups";
        toast("Добро пожаловать, " + me.name);
        render();
      });
    });
    root.appendChild(card);
  }

  function renderRegister() {
    var card = el(
      '<section class="card">' +
        "<h1>Заявка на личный кабинет</h1>" +
        '<p class="status">Админ проверит заявку и прикрепит группу при необходимости.</p>' +
        '<form class="stack">' +
        '<label class="lbl">ФИО</label>' +
        '<input name="name" required maxlength="80" placeholder="Иванова А. С." />' +
        '<label class="lbl">Логин</label>' +
        '<input name="login" required maxlength="40" autocomplete="username" />' +
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
    data.groups
      .slice()
      .sort(function (a, b) {
        return a.name.localeCompare(b.name, "ru");
      })
      .forEach(function (g) {
        groupSel.appendChild(option(g.id, g.name));
      });
    card.querySelector("#go-login").addEventListener("click", function () {
      state.screen = "login";
      render();
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
          store.addLog(
            data,
            { login: String(fd.get("login") || ""), name: String(fd.get("name") || "") },
            "Заявка на регистрацию",
            "Роль: " +
              store.roleLabel(String(fd.get("role") || "curator")) +
              (fd.get("groupId")
                ? " · группа " +
                  ((groupById(String(fd.get("groupId"))) || {}).name || "?")
                : "") +
              (fd.get("comment") ? " · " + String(fd.get("comment")) : ""),
            {
              target: "@" + String(fd.get("login") || ""),
              category: String(fd.get("role") || ""),
              groupId: String(fd.get("groupId") || ""),
              groupName: ((groupById(String(fd.get("groupId"))) || {}).name || ""),
            }
          );
          persist();
          toast("Заявка отправлена. Ждите решения админа.");
          state.screen = "login";
          render();
        });
    });
    root.appendChild(card);
  }

  function renderAdmin() {
    var stats = store.adminStats(data);
    var pending = data.requests.filter(function (r) {
      return r.status === "pending";
    });
    var tabs = [
      ["overview", "Обзор"],
      ["requests", "Заявки (" + pending.length + ")"],
      ["users", "Кабинеты"],
      ["groups", "Группы"],
      ["logs", "Логи (" + stats.logs + ")"],
      ["create", "Создать"],
    ];

    var head = el(
      '<section class="card"><h1>Админ-кабинет</h1>' +
        '<p class="status">Управление кабинетами, заявками и журналом действий.</p>' +
        '<div class="admin-tabs"></div></section>'
    );
    var tabBar = head.querySelector(".admin-tabs");
    tabs.forEach(function (t) {
      var btn = el(
        '<button class="btn btn-soft' +
          (state.adminTab === t[0] ? " tab-on" : "") +
          '" type="button">' +
          t[1] +
          "</button>"
      );
      btn.addEventListener("click", function () {
        state.adminTab = t[0];
        render();
      });
      tabBar.appendChild(btn);
    });
    root.appendChild(head);

    if (state.adminTab === "overview") renderAdminOverview(stats);
    else if (state.adminTab === "requests") renderAdminRequests(pending);
    else if (state.adminTab === "users") renderAdminUsers();
    else if (state.adminTab === "groups") renderAdminGroups();
    else if (state.adminTab === "logs") renderAdminLogs();
    else renderAdminCreate();
  }

  function renderAdminOverview(stats) {
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

  function renderAdminRequests(pending) {
    var reqCard = el(
      '<section class="card"><h2>Заявки на регистрацию (' +
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
            " · " +
            escapeHtml(store.roleLabel(req.role)) +
            (g ? " · группа " + escapeHtml(g.name) : "") +
            (req.comment ? " · " + escapeHtml(req.comment) : "") +
            " · " +
            formatDate(req.createdAt) +
            "</small>" +
            '<div class="toolbar"></div></div>'
        );
        var ok = el('<button class="btn" type="button">Принять</button>');
        var no = el('<button class="btn btn-ghost" type="button">Отклонить</button>');
        ok.addEventListener("click", function () {
          var role = prompt(
            "Должность (curator/head/deputy/director/administrator)",
            req.role || "curator"
          );
          if (role === null) return;
          var groupId = req.groupId || "";
          if (role === "curator") {
            var names = data.groups
              .map(function (x) {
                return x.name;
              })
              .join(", ");
            var pick = prompt(
              "Прикрепить группу (номер из списка: " + names + ")",
              g ? g.name : ""
            );
            if (pick === null) return;
            pick = pick.trim();
            var found = data.groups.find(function (x) {
              return x.name.toLowerCase() === pick.toLowerCase();
            });
            groupId = found ? found.id : "";
            if (!groupId && pick) {
              toast("Группа не найдена", true);
              return;
            }
          }
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
          toast("Кабинет создан");
          render();
        });
        no.addEventListener("click", function () {
          store.rejectRequest(data, req.id);
          logAction("Заявка отклонена", "@" + req.login + " · " + req.name, {
            target: "@" + req.login,
            category: req.role || "",
          });
          if (!persist()) return;
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

  function renderAdminCreate() {
    var createCard = el(
      '<section class="card"><h2>Создать кабинет</h2>' +
        '<form class="stack">' +
        '<input name="name" required maxlength="80" placeholder="ФИО" />' +
        '<input name="login" required maxlength="40" placeholder="Логин" />' +
        '<input name="password" type="password" required minlength="6" placeholder="Пароль" />' +
        '<select name="role"></select>' +
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
      store
        .createUser(data, {
          name: fd.get("name"),
          login: fd.get("login"),
          password: fd.get("password"),
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
          toast("Кабинет @" + res.user.login + " создан");
          state.adminTab = "users";
          render();
        });
    });
    root.appendChild(createCard);
  }

  function renderAdminUsers() {
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
      var groups = (u.groupIds || [])
        .map(function (id) {
          var g = groupById(id);
          return g ? g.name : "?";
        })
        .join(", ");
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
          (groups ? " · группы: " + escapeHtml(groups) : " · без группы") +
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
          var pick = prompt("Прикрепить группу (" + names + "). Пусто = снять.", groups);
          if (pick === null) return;
          pick = pick.trim();
          if (!pick) {
            u.groupIds = [];
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
            toast("Пароль обновлён");
            render();
          });
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
        tools.appendChild(toggle);
      } else {
        tools.appendChild(el('<span class="status">Главный админ</span>'));
      }
      usersCard.appendChild(row);
    });
    root.appendChild(usersCard);
  }

  function renderAdminGroups() {
    var card = el(
      '<section class="card"><h2>Группы и кураторы</h2>' +
        '<p class="status">Кто за какой группой закреплён.</p></section>'
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
    var card = el(
      '<section class="card"><h2>Журнал действий</h2>' +
        '<p class="status">Видят администраторы. До 800 записей. Пишутся IP (публичный), платформа, UA, экран, язык, часовой пояс, сеть, VK-параметры и детали действия.</p>' +
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
              state.screen = "groups";
              state.groupId = null;
              state.studentId = null;
              toast("Данные восстановлены");
              render();
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
            state.screen = "group";
            state.groupId = g.id;
            state.search = "";
            state.catFilter = "Все";
            render();
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

  function renderGroup() {
    var g = groupById(state.groupId);
    if (!g || !store.canAccessGroup(me, g.id)) {
      state.screen = "groups";
      render();
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
      state.screen = "groups";
      render();
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
          state.screen = "student";
          state.studentId = item.student.id;
          render();
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

    var addPts = el('<section class="card"><h2>Начислить / списать</h2></section>');
    if (!g.students.length) {
      addPts.appendChild(
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
      addPts.appendChild(pickLabel);
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
          addPts.querySelector("#picked-name").textContent = s.name;
        });
        pickWrap.appendChild(btn);
      });
      addPts.appendChild(pickWrap);
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
      addPts.appendChild(form);
    }
    root.appendChild(addPts);

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
        state.screen = "groups";
        toast("Группа удалена");
        render();
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
      state.screen = "group";
      render();
      return;
    }
    var nav = el(
      '<p class="navline"><button class="link" type="button">← ' +
        escapeHtml(g.name) +
        "</button></p>"
    );
    nav.querySelector("button").addEventListener("click", function () {
      state.screen = "group";
      render();
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
      state.screen = "group";
      toast("Студент удалён");
      render();
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

  store.refreshClientMeta().finally(function () {
    store.ensureAdmin(data).then(function () {
      store.save(data);
      refreshMe();
      state.screen = me ? (store.isAdmin(me) ? "admin" : "groups") : "login";
      initVk();
      render();
    });
  });
})();
