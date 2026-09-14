(function (global) {
  var KEY = "bmt-points-v1";
  var SESSION_KEY = "bmt-session-v1";
  var PHOTO_KINDS = ["Грамота", "Фото группы", "Мероприятие", "Прочее"];
  var CATEGORIES = [
    "Контингент",
    "Успеваемость",
    "Качество знаний",
    "Посещаемость",
    "Дисциплина",
    "Внешний вид",
    "Мероприятия",
    "Хозработы",
    "Учёба",
    "Прочее",
  ];
  var ROLES = {
    admin: "Главный админ",
    administrator: "Администратор",
    director: "Директор",
    deputy: "Замдиректора",
    head: "Заведующая",
    curator: "Куратор",
  };
  var ROLE_ORDER = [
    "admin",
    "administrator",
    "director",
    "deputy",
    "head",
    "curator",
  ];
  var PRESET_GROUPS = [
    "340", "342", "343", "344Г", "346-П", "348Э", "349-П",
    "430-П", "431", "432", "436-П", "437Р", "438Ц", "438Э", "439-П",
    "520-П", "521", "522", "524Г", "526-П", "527Р", "528",
    "610-П", "611", "612", "615", "616", "618", "619Р",
  ];

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function empty() {
    return { version: 2, groups: [], users: [], requests: [], logs: [] };
  }

  function normalize(data) {
    if (!data || typeof data !== "object") return empty();
    if (!Array.isArray(data.groups)) data.groups = [];
    if (!Array.isArray(data.users)) data.users = [];
    if (!Array.isArray(data.requests)) data.requests = [];
    if (!Array.isArray(data.logs)) data.logs = [];
    data.version = 2;
    data.groups.forEach(function (g) {
      if (!g.id) g.id = uid();
      if (!g.name) g.name = "Группа";
      if (!Array.isArray(g.students)) g.students = [];
      if (!Array.isArray(g.events)) g.events = [];
      if (!Array.isArray(g.photos)) g.photos = [];
      if (typeof g.cover !== "string") g.cover = "";
      g.students.forEach(function (s) {
        if (!s.id) s.id = uid();
        if (!s.name) s.name = "Студент";
        if (Array.isArray(s.portfolio) && s.portfolio.length) {
          s.portfolio.forEach(function (item) {
            g.photos.push({
              id: item.id || uid(),
              kind: "Грамота",
              title: item.title || "Грамота",
              image: item.image,
              at: item.at || new Date().toISOString(),
            });
          });
        }
        delete s.portfolio;
      });
    });
    data.users.forEach(function (u) {
      if (!u.id) u.id = uid();
      if (!Array.isArray(u.groupIds)) u.groupIds = [];
      if (!u.status) u.status = "active";
      if (!ROLES[u.role]) u.role = "curator";
    });
    data.requests.forEach(function (r) {
      if (!r.id) r.id = uid();
      if (!r.status) r.status = "pending";
    });
    return data;
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return empty();
      return normalize(JSON.parse(raw));
    } catch (e) {
      return empty();
    }
  }

  function save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  function toHex(buf) {
    return Array.from(new Uint8Array(buf))
      .map(function (b) {
        return b.toString(16).padStart(2, "0");
      })
      .join("");
  }

  function hashPassword(password, salt) {
    if (!global.crypto || !crypto.subtle) {
      return Promise.reject(
        new Error("Нужен HTTPS-браузер с поддержкой шифрования паролей")
      );
    }
    var enc = new TextEncoder();
    return crypto.subtle
      .digest("SHA-256", enc.encode(String(salt) + ":" + String(password)))
      .then(toHex);
  }

  function makeSalt() {
    var arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return toHex(arr);
  }

  function normalizeLogin(login) {
    return String(login || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
  }

  function validateLogin(loginName) {
    if (!loginName || loginName.length < 3) {
      return "Логин слишком короткий (мин. 3 символа)";
    }
    if (!/^[a-z0-9._-]{3,40}$/i.test(loginName)) {
      return "Логин: латиница, цифры, точка, _ или -";
    }
    return "";
  }

  function validatePassword(password) {
    if (!password || String(password).length < 6) {
      return "Пароль не короче 6 символов";
    }
    return "";
  }

  function ensureAdmin(data) {
    var salt = "bmt-admin-fixed-salt-v1";
    return hashPassword("161107Dragov", salt).then(function (hash) {
      var admin = data.users.find(function (u) {
        return String(u.login).toLowerCase() === "dragov";
      });
      if (!admin) {
        data.users.unshift({
          id: uid(),
          login: "dragov",
          name: "Dragov · главный админ",
          role: "admin",
          salt: salt,
          passwordHash: hash,
          groupIds: [],
          status: "active",
          createdAt: new Date().toISOString(),
        });
      } else {
        admin.role = "admin";
        admin.status = "active";
        admin.salt = salt;
        admin.passwordHash = hash;
        admin.name = admin.name || "Dragov · главный админ";
      }
      return data;
    });
  }

  function getSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function setSession(userId) {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ userId: userId, at: new Date().toISOString() })
    );
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function currentUser(data) {
    var session = getSession();
    if (!session || !session.userId) return null;
    var user = data.users.find(function (u) {
      return u.id === session.userId && u.status === "active";
    });
    return user || null;
  }

  function findUserByLogin(data, login) {
    var key = normalizeLogin(login);
    return data.users.find(function (u) {
      return normalizeLogin(u.login) === key;
    });
  }

  function login(data, loginName, password) {
    var user = findUserByLogin(data, loginName);
    if (!user || user.status !== "active") {
      return Promise.resolve({ ok: false, error: "Неверный логин или пароль" });
    }
    return hashPassword(password, user.salt)
      .then(function (hash) {
        if (hash !== user.passwordHash) {
          return { ok: false, error: "Неверный логин или пароль" };
        }
        setSession(user.id);
        return { ok: true, user: user };
      })
      .catch(function (err) {
        return {
          ok: false,
          error: (err && err.message) || "Не удалось проверить пароль",
        };
      });
  }

  function logout() {
    clearSession();
  }

  function createUser(data, opts) {
    var loginName = normalizeLogin(opts.login);
    var password = String(opts.password || "");
    var name = String(opts.name || "").trim();
    var role = opts.role || "curator";
    var groupIds = Array.isArray(opts.groupIds) ? opts.groupIds.slice() : [];
    if (!loginName || !password || !name) {
      return Promise.resolve({ ok: false, error: "Заполните логин, пароль и ФИО" });
    }
    var loginErr = validateLogin(loginName);
    if (loginErr) return Promise.resolve({ ok: false, error: loginErr });
    var passErr = validatePassword(password);
    if (passErr) return Promise.resolve({ ok: false, error: passErr });
    if (!ROLES[role]) role = "curator";
    if (role === "admin") {
      return Promise.resolve({
        ok: false,
        error: "Роль «Главный админ» зарезервирована. Выберите «Администратор».",
      });
    }
    if (role === "curator" && !groupIds.length) {
      return Promise.resolve({
        ok: false,
        error: "Куратору нужно прикрепить группу",
      });
    }
    if (findUserByLogin(data, loginName)) {
      return Promise.resolve({ ok: false, error: "Такой логин уже занят" });
    }
    var salt = makeSalt();
    return hashPassword(password, salt)
      .then(function (hash) {
        var user = {
          id: uid(),
          login: loginName,
          name: name.slice(0, 80),
          role: role,
          salt: salt,
          passwordHash: hash,
          groupIds: groupIds,
          status: "active",
          createdAt: new Date().toISOString(),
        };
        data.users.push(user);
        return { ok: true, user: user, password: password };
      })
      .catch(function (err) {
        return {
          ok: false,
          error: (err && err.message) || "Не удалось создать кабинет",
        };
      });
  }

  function submitRegistration(data, opts) {
    var loginName = normalizeLogin(opts.login);
    var password = String(opts.password || "");
    var name = String(opts.name || "").trim();
    var role = opts.role || "curator";
    var groupId = opts.groupId || "";
    var comment = String(opts.comment || "").trim();
    if (!loginName || !password || !name) {
      return Promise.resolve({ ok: false, error: "Заполните ФИО, логин и пароль" });
    }
    var loginErr = validateLogin(loginName);
    if (loginErr) return Promise.resolve({ ok: false, error: loginErr });
    var passErr = validatePassword(password);
    if (passErr) return Promise.resolve({ ok: false, error: passErr });
    if (findUserByLogin(data, loginName)) {
      return Promise.resolve({ ok: false, error: "Такой логин уже есть" });
    }
    var pending = data.requests.some(function (r) {
      return r.status === "pending" && normalizeLogin(r.login) === loginName;
    });
    if (pending) {
      return Promise.resolve({
        ok: false,
        error: "Заявка с этим логином уже на рассмотрении",
      });
    }
    if (!ROLES[role] || role === "admin") role = "curator";
    if (role === "curator" && !groupId) {
      return Promise.resolve({
        ok: false,
        error: "Куратору укажите желаемую группу",
      });
    }
    var salt = makeSalt();
    return hashPassword(password, salt)
      .then(function (hash) {
        var req = {
          id: uid(),
          login: loginName,
          name: name.slice(0, 80),
          role: role,
          groupId: groupId || "",
          groupName: "",
          comment: comment.slice(0, 200),
          salt: salt,
          passwordHash: hash,
          status: "pending",
          createdAt: new Date().toISOString(),
        };
        if (groupId) {
          var g = data.groups.find(function (x) {
            return x.id === groupId;
          });
          if (g) req.groupName = g.name;
        }
        data.requests.unshift(req);
        return { ok: true, request: req };
      })
      .catch(function (err) {
        return {
          ok: false,
          error: (err && err.message) || "Не удалось отправить заявку",
        };
      });
  }

  function buildRequestPayload(req) {
    return {
      v: 1,
      kind: "request",
      id: req.id,
      login: req.login,
      name: req.name,
      role: req.role,
      groupId: req.groupId || "",
      groupName: req.groupName || "",
      comment: req.comment || "",
      salt: req.salt,
      passwordHash: req.passwordHash,
      status: "pending",
      createdAt: req.createdAt || new Date().toISOString(),
    };
  }

  function resolveGroupIdByName(data, name, fallbackId) {
    if (name) {
      var found = data.groups.find(function (g) {
        return String(g.name).toLowerCase() === String(name).toLowerCase();
      });
      if (found) return found.id;
    }
    if (fallbackId) {
      var byId = data.groups.find(function (g) {
        return g.id === fallbackId;
      });
      if (byId) return byId.id;
    }
    return "";
  }

  function importRequest(data, raw) {
    try {
      var payload = decodeInvite(raw);
      if (!payload || payload.kind !== "request" || !payload.login || !payload.passwordHash) {
        return { ok: false, error: "Ссылка заявки повреждена" };
      }
      var loginName = normalizeLogin(payload.login);
      if (findUserByLogin(data, loginName)) {
        return { ok: false, error: "Пользователь @" + loginName + " уже есть" };
      }
      var exists = data.requests.some(function (r) {
        return (
          (payload.id && r.id === payload.id) ||
          (r.status === "pending" && normalizeLogin(r.login) === loginName)
        );
      });
      if (exists) {
        return { ok: true, already: true, login: loginName };
      }
      var groupId = resolveGroupIdByName(data, payload.groupName, payload.groupId);
      data.requests.unshift({
        id: payload.id || uid(),
        login: loginName,
        name: String(payload.name || loginName).slice(0, 80),
        role: payload.role && ROLES[payload.role] ? payload.role : "curator",
        groupId: groupId,
        groupName: payload.groupName || "",
        comment: String(payload.comment || "").slice(0, 200),
        salt: payload.salt,
        passwordHash: payload.passwordHash,
        status: "pending",
        createdAt: payload.createdAt || new Date().toISOString(),
      });
      return { ok: true, already: false, login: loginName };
    } catch (e) {
      return { ok: false, error: "Не удалось открыть заявку" };
    }
  }

  function buildInvitePayload(user, password) {
    return {
      v: 1,
      kind: "invite",
      login: user.login,
      name: user.name,
      role: user.role,
      groupIds: user.groupIds || [],
      salt: user.salt,
      passwordHash: user.passwordHash,
      status: "active",
      password: password || "",
    };
  }

  function encodeInvite(payload) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }

  function decodeInvite(raw) {
    var s = String(raw || "").replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    return JSON.parse(decodeURIComponent(escape(atob(s))));
  }

  function acceptInvite(data, raw) {
    try {
      var payload = decodeInvite(raw);
      if (payload && payload.kind === "request") {
        return { ok: false, error: "Это ссылка заявки. Откройте её под админом." };
      }
      if (!payload || !payload.login || !payload.passwordHash || !payload.salt) {
        return { ok: false, error: "Ссылка-приглашение повреждена" };
      }
      var existing = findUserByLogin(data, payload.login);
      if (existing) {
        existing.name = payload.name || existing.name;
        existing.role = payload.role || existing.role;
        existing.salt = payload.salt;
        existing.passwordHash = payload.passwordHash;
        existing.groupIds = Array.isArray(payload.groupIds)
          ? payload.groupIds.slice()
          : existing.groupIds || [];
        existing.status = "active";
        setSession(existing.id);
        return { ok: true, user: existing, updated: true };
      }
      var user = {
        id: uid(),
        login: normalizeLogin(payload.login),
        name: String(payload.name || payload.login).slice(0, 80),
        role: payload.role && ROLES[payload.role] ? payload.role : "curator",
        salt: payload.salt,
        passwordHash: payload.passwordHash,
        groupIds: Array.isArray(payload.groupIds) ? payload.groupIds.slice() : [],
        status: "active",
        createdAt: new Date().toISOString(),
      };
      if (user.role === "admin") user.role = "administrator";
      data.users.push(user);
      setSession(user.id);
      return { ok: true, user: user, updated: false };
    } catch (e) {
      return { ok: false, error: "Не удалось открыть приглашение" };
    }
  }

  function approveRequest(data, requestId, overrides) {
    var req = data.requests.find(function (r) {
      return r.id === requestId;
    });
    if (!req || req.status !== "pending") {
      return { ok: false, error: "Заявка не найдена" };
    }
    if (findUserByLogin(data, req.login)) {
      req.status = "rejected";
      return { ok: false, error: "Логин уже занят" };
    }
    var role = (overrides && overrides.role) || req.role || "curator";
    if (!ROLES[role] || role === "admin") {
      if (role === "admin") role = "administrator";
      else role = "curator";
    }
    var groupIds = [];
    var groupId = (overrides && overrides.groupId) || req.groupId;
    if (!groupId && req.groupName) {
      groupId = resolveGroupIdByName(data, req.groupName, "");
    }
    if (groupId) groupIds = [groupId];
    if (role === "curator" && !groupIds.length) {
      return { ok: false, error: "Куратору нужно указать группу" };
    }
    var user = {
      id: uid(),
      login: req.login,
      name: req.name,
      role: role,
      salt: req.salt,
      passwordHash: req.passwordHash,
      groupIds: groupIds,
      status: "active",
      createdAt: new Date().toISOString(),
    };
    data.users.push(user);
    req.status = "approved";
    req.resolvedAt = new Date().toISOString();
    return { ok: true, user: user };
  }

  function rejectRequest(data, requestId) {
    var req = data.requests.find(function (r) {
      return r.id === requestId;
    });
    if (!req || req.status !== "pending") {
      return { ok: false, error: "Заявка не найдена" };
    }
    req.status = "rejected";
    req.resolvedAt = new Date().toISOString();
    return { ok: true };
  }

  function canSeeAllGroups(user) {
    if (!user) return false;
    return (
      user.role === "admin" ||
      user.role === "administrator" ||
      user.role === "director" ||
      user.role === "deputy" ||
      user.role === "head"
    );
  }

  function isAdmin(user) {
    return !!(
      user &&
      (user.role === "admin" || user.role === "administrator")
    );
  }

  function visibleGroups(data, user) {
    if (!user) return [];
    if (canSeeAllGroups(user)) return data.groups;
    var set = {};
    (user.groupIds || []).forEach(function (id) {
      set[id] = true;
    });
    return data.groups.filter(function (g) {
      return set[g.id];
    });
  }

  function canAccessGroup(user, groupId) {
    if (!user) return false;
    if (canSeeAllGroups(user)) return true;
    return (user.groupIds || []).indexOf(groupId) >= 0;
  }

  var clientMetaCache = {
    ip: "",
    ipCheckedAt: "",
    ready: false,
  };

  function detectClient() {
    var q = {};
    try {
      new URLSearchParams(window.location.search || "").forEach(function (value, key) {
        q[key] = value;
      });
    } catch (e) {
      q = {};
    }
    var ua = navigator.userAgent || "";
    var platform =
      q.vk_platform ||
      (navigator.userAgentData && navigator.userAgentData.platform) ||
      navigator.platform ||
      "";
    if (!platform) {
      platform = /Mobile|Android|iPhone/i.test(ua) ? "mobile-web" : "web";
    }
    var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    var screenW = window.screen ? window.screen.width : "";
    var screenH = window.screen ? window.screen.height : "";
    var tz = "";
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch (e2) {
      tz = "";
    }
    return {
      ip: clientMetaCache.ip || "",
      platform: String(platform).slice(0, 40),
      path: String(window.location.pathname || "").slice(0, 80),
      href: String(window.location.href || "").slice(0, 160),
      referrer: String(document.referrer || "").slice(0, 120),
      language: String(navigator.language || "").slice(0, 20),
      languages: Array.isArray(navigator.languages)
        ? navigator.languages.slice(0, 4).join(",")
        : "",
      timezone: tz,
      timezoneOffset: new Date().getTimezoneOffset(),
      userAgent: ua.slice(0, 160),
      screen: screenW && screenH ? screenW + "x" + screenH : "",
      viewport:
        (window.innerWidth || "") + "x" + (window.innerHeight || ""),
      online: navigator.onLine ? "online" : "offline",
      connection: conn && conn.effectiveType ? String(conn.effectiveType) : "",
      downlink: conn && conn.downlink !== undefined ? String(conn.downlink) : "",
      deviceMemory: navigator.deviceMemory ? String(navigator.deviceMemory) : "",
      hardwareConcurrency: navigator.hardwareConcurrency
        ? String(navigator.hardwareConcurrency)
        : "",
      vkUserId: q.vk_user_id ? String(q.vk_user_id) : "",
      vkAppId: q.vk_app_id ? String(q.vk_app_id) : "",
      vkPlatform: q.vk_platform ? String(q.vk_platform) : "",
      vkViewer: q.vk_viewer_group_id ? String(q.vk_viewer_group_id) : "",
      colorDepth: window.screen ? String(window.screen.colorDepth || "") : "",
      touch: navigator.maxTouchPoints ? String(navigator.maxTouchPoints) : "0",
    };
  }

  function refreshClientMeta() {
    return fetch("https://api.ipify.org?format=json")
      .then(function (r) {
        return r.json();
      })
      .then(function (json) {
        clientMetaCache.ip = json && json.ip ? String(json.ip) : "";
        clientMetaCache.ipCheckedAt = new Date().toISOString();
        clientMetaCache.ready = true;
        return clientMetaCache;
      })
      .catch(function () {
        clientMetaCache.ready = true;
        return clientMetaCache;
      });
  }

  function addLog(data, actor, action, details, meta) {
    if (!Array.isArray(data.logs)) data.logs = [];
    meta = meta || {};
    var client = detectClient();
    data.logs.unshift({
      id: uid(),
      at: new Date().toISOString(),
      actorId: actor && actor.id ? actor.id : "",
      actorLogin: actor && actor.login ? actor.login : "system",
      actorName: actor && actor.name ? actor.name : "Система",
      actorRole: actor && actor.role ? actor.role : "",
      action: String(action || "event"),
      details: String(details || "").slice(0, 400),
      groupId: meta.groupId ? String(meta.groupId) : "",
      groupName: meta.groupName ? String(meta.groupName).slice(0, 40) : "",
      target: meta.target ? String(meta.target).slice(0, 120) : "",
      amount: meta.amount !== undefined && meta.amount !== null ? Number(meta.amount) : "",
      category: meta.category ? String(meta.category).slice(0, 40) : "",
      ip: client.ip,
      platform: client.platform,
      path: client.path,
      href: client.href,
      referrer: client.referrer,
      language: client.language,
      languages: client.languages,
      timezone: client.timezone,
      timezoneOffset: client.timezoneOffset,
      userAgent: client.userAgent,
      screen: client.screen,
      viewport: client.viewport,
      online: client.online,
      connection: client.connection,
      downlink: client.downlink,
      deviceMemory: client.deviceMemory,
      hardwareConcurrency: client.hardwareConcurrency,
      vkUserId: client.vkUserId,
      vkAppId: client.vkAppId,
      vkPlatform: client.vkPlatform,
      colorDepth: client.colorDepth,
      touch: client.touch,
    });
    if (data.logs.length > 800) data.logs.length = 800;
  }

  function logsCsv(data) {
    var lines = [
      "Дата;Кто;Логин;Роль;Действие;Детали;Группа;Цель;Сумма;Категория;IP;Платформа;Язык;ЧасовойПояс;Экран;Viewport;Сеть;UA;VK_user;Referrer;Online",
    ];
    (data.logs || []).forEach(function (log) {
      lines.push(
        [
          log.at || "",
          '"' + String(log.actorName || "").replace(/"/g, '""') + '"',
          log.actorLogin || "",
          log.actorRole || "",
          '"' + String(log.action || "").replace(/"/g, '""') + '"',
          '"' + String(log.details || "").replace(/"/g, '""') + '"',
          '"' + String(log.groupName || "").replace(/"/g, '""') + '"',
          '"' + String(log.target || "").replace(/"/g, '""') + '"',
          log.amount === "" || log.amount === undefined ? "" : log.amount,
          '"' + String(log.category || "").replace(/"/g, '""') + '"',
          log.ip || "",
          log.platform || "",
          log.language || "",
          log.timezone || "",
          log.screen || "",
          log.viewport || "",
          log.connection || "",
          '"' + String(log.userAgent || "").replace(/"/g, '""') + '"',
          log.vkUserId || "",
          '"' + String(log.referrer || "").replace(/"/g, '""') + '"',
          log.online || "",
        ].join(";")
      );
    });
    return "\uFEFF" + lines.join("\n");
  }

  function clearLogs(data, keep) {
    keep = Number(keep) || 0;
    if (!Array.isArray(data.logs)) data.logs = [];
    data.logs = keep > 0 ? data.logs.slice(0, keep) : [];
  }

  function resetUserPassword(data, userId, newPassword) {
    var user = data.users.find(function (u) {
      return u.id === userId;
    });
    if (!user) return Promise.resolve({ ok: false, error: "Пользователь не найден" });
    if (user.login === "dragov") {
      return Promise.resolve({ ok: false, error: "Пароль главного админа так не сбрасывается" });
    }
    var password = String(newPassword || "");
    if (password.length < 6) {
      return Promise.resolve({ ok: false, error: "Пароль минимум 6 символов" });
    }
    var salt = makeSalt();
    return hashPassword(password, salt).then(function (hash) {
      user.salt = salt;
      user.passwordHash = hash;
      return { ok: true, user: user };
    });
  }

  function adminStats(data) {
    var students = 0;
    var events = 0;
    var photos = 0;
    data.groups.forEach(function (g) {
      students += (g.students || []).length;
      events += (g.events || []).length;
      photos += (g.photos || []).length + (g.cover ? 1 : 0);
    });
    var pending = data.requests.filter(function (r) {
      return r.status === "pending";
    }).length;
    var activeUsers = data.users.filter(function (u) {
      return u.status === "active";
    }).length;
    var byRole = {};
    ROLE_ORDER.forEach(function (r) {
      byRole[r] = 0;
    });
    data.users.forEach(function (u) {
      byRole[u.role] = (byRole[u.role] || 0) + 1;
    });
    return {
      groups: data.groups.length,
      students: students,
      events: events,
      photos: photos,
      users: data.users.length,
      activeUsers: activeUsers,
      pending: pending,
      logs: (data.logs || []).length,
      byRole: byRole,
    };
  }

  function findCuratorForGroup(data, groupId) {
    return data.users.filter(function (u) {
      return (
        u.status === "active" &&
        u.role === "curator" &&
        (u.groupIds || []).indexOf(groupId) >= 0
      );
    });
  }

  function roleLabel(role) {
    return ROLES[role] || role;
  }

  function studentTotal(group, studentId) {
    return group.events
      .filter(function (e) {
        return e.studentId === studentId;
      })
      .reduce(function (sum, e) {
        return sum + Number(e.delta || 0);
      }, 0);
  }

  function groupTotal(group) {
    return group.events.reduce(function (sum, e) {
      return sum + Number(e.delta || 0);
    }, 0);
  }

  function categoryTotals(group, studentId) {
    var map = {};
    CATEGORIES.forEach(function (c) {
      map[c] = 0;
    });
    group.events.forEach(function (e) {
      if (studentId && e.studentId !== studentId) return;
      var cat = CATEGORIES.indexOf(e.category) >= 0 ? e.category : "Прочее";
      map[cat] += Number(e.delta || 0);
    });
    return map;
  }

  function rankedStudents(group) {
    return group.students
      .map(function (s) {
        return { student: s, total: studentTotal(group, s.id) };
      })
      .sort(function (a, b) {
        if (b.total !== a.total) return b.total - a.total;
        return a.student.name.localeCompare(b.student.name, "ru");
      });
  }

  function studentName(group, studentId) {
    var s = group.students.find(function (x) {
      return x.id === studentId;
    });
    return s ? s.name : "Удалённый студент";
  }

  function exportJson(data) {
    return JSON.stringify(
      {
        version: 2,
        exportedAt: new Date().toISOString(),
        groups: data.groups,
        users: data.users.map(function (u) {
          return {
            id: u.id,
            login: u.login,
            name: u.name,
            role: u.role,
            groupIds: u.groupIds,
            status: u.status,
            createdAt: u.createdAt,
            salt: u.salt,
            passwordHash: u.passwordHash,
          };
        }),
        requests: data.requests,
        logs: data.logs || [],
      },
      null,
      2
    );
  }

  function importJson(text) {
    return normalize(JSON.parse(text));
  }

  function rankingCsv(group) {
    var ranked = rankedStudents(group);
    var lines = [
      "Место;ФИО;Баллы;Успеваемость;Дисциплина;Мероприятия;Учёба;Прочее",
    ];
    ranked.forEach(function (item, i) {
      var cats = categoryTotals(group, item.student.id);
      lines.push(
        [
          i + 1,
          '"' + String(item.student.name).replace(/"/g, '""') + '"',
          item.total,
          cats["Успеваемость"] || 0,
          cats["Дисциплина"],
          cats["Мероприятия"],
          cats["Учёба"] || 0,
          cats["Прочее"],
        ].join(";")
      );
    });
    return "\uFEFF" + lines.join("\n");
  }

  function ensurePresetGroups(data) {
    var existing = {};
    data.groups.forEach(function (g) {
      existing[String(g.name).toLowerCase()] = true;
    });
    var added = 0;
    PRESET_GROUPS.forEach(function (name) {
      var key = String(name).toLowerCase();
      if (existing[key]) return;
      data.groups.push({
        id: uid(),
        name: name,
        students: [],
        events: [],
        photos: [],
        cover: "",
        source: "bumate.ru/schedule",
      });
      existing[key] = true;
      added += 1;
    });
    return added;
  }

  function downloadText(filename, text, mime) {
    var blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  global.BmtStore = {
    PHOTO_KINDS: PHOTO_KINDS,
    CATEGORIES: CATEGORIES,
    PRESET_GROUPS: PRESET_GROUPS,
    ROLES: ROLES,
    ROLE_ORDER: ROLE_ORDER,
    uid: uid,
    load: load,
    save: save,
    ensureAdmin: ensureAdmin,
    login: login,
    logout: logout,
    currentUser: currentUser,
    createUser: createUser,
    submitRegistration: submitRegistration,
    approveRequest: approveRequest,
    rejectRequest: rejectRequest,
    buildInvitePayload: buildInvitePayload,
    encodeInvite: encodeInvite,
    acceptInvite: acceptInvite,
    buildRequestPayload: buildRequestPayload,
    importRequest: importRequest,
    addLog: addLog,
    logsCsv: logsCsv,
    clearLogs: clearLogs,
    refreshClientMeta: refreshClientMeta,
    detectClient: detectClient,
    resetUserPassword: resetUserPassword,
    adminStats: adminStats,
    findCuratorForGroup: findCuratorForGroup,
    canSeeAllGroups: canSeeAllGroups,
    isAdmin: isAdmin,
    visibleGroups: visibleGroups,
    canAccessGroup: canAccessGroup,
    roleLabel: roleLabel,
    studentTotal: studentTotal,
    groupTotal: groupTotal,
    categoryTotals: categoryTotals,
    rankedStudents: rankedStudents,
    studentName: studentName,
    exportJson: exportJson,
    importJson: importJson,
    rankingCsv: rankingCsv,
    downloadText: downloadText,
    ensurePresetGroups: ensurePresetGroups,
  };
})(window);
