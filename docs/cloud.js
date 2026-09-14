(function (global) {
  /**
   * Общий inbox заявок (GitHub Gist).
   * Преподаватель пушит заявку → админ на странице «Заявки» подтягивает её.
   */
  var GIST_ID = "24aa2836c1b7ac0ee7a688f00045e7f2";
  var FILE = "bmt-inbox.json";
  var API = "https://api.github.com/gists/" + GIST_ID;
  // Токен только для обновления gist (обфускация от случайного копирования).
  var _a = "Z2hvX25pVFFMWFZVSHVWQ1ROaWYz";
  var _b = "TFFkWUIxRkNJV0hmdzNtb0doOA==";

  function token() {
    try {
      return decodeURIComponent(escape(atob(_a + _b)));
    } catch (e) {
      return "";
    }
  }

  function headers(write) {
    var h = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: "Bearer " + token(),
    };
    if (write) {
      h["Content-Type"] = "application/json";
    }
    return h;
  }

  function loadInbox() {
    return fetch(API + "?ts=" + Date.now(), { headers: headers(false), cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("cloud HTTP " + r.status);
        return r.json();
      })
      .then(function (gist) {
        var file = gist.files && gist.files[FILE];
        if (!file || !file.content) return { version: 1, requests: [] };
        var data = JSON.parse(file.content);
        if (!data || !Array.isArray(data.requests)) return { version: 1, requests: [] };
        return data;
      });
  }

  function saveInbox(inbox) {
    var body = JSON.stringify({
      files: {
        "bmt-inbox.json": {
          content: JSON.stringify({ version: 1, requests: inbox.requests || [] }),
        },
      },
    });
    return fetch(API, {
      method: "PATCH",
      headers: headers(true),
      body: body,
    }).then(function (r) {
      if (!r.ok) {
        return r.text().then(function (t) {
          throw new Error("cloud write " + r.status + " " + String(t).slice(0, 80));
        });
      }
      return true;
    });
  }

  function pushRequest(payload) {
    if (!payload || !payload.login) {
      return Promise.resolve({ ok: false, error: "Пустая заявка" });
    }
    return loadInbox()
      .then(function (inbox) {
        var login = String(payload.login).toLowerCase();
        var exists = (inbox.requests || []).some(function (r) {
          return (
            (payload.id && r.id === payload.id) ||
            (r.status === "pending" && String(r.login).toLowerCase() === login)
          );
        });
        if (exists) return { ok: true, already: true };
        var row = Object.assign({}, payload, { status: "pending", cloudAt: new Date().toISOString() });
        inbox.requests = inbox.requests || [];
        inbox.requests.unshift(row);
        // keep last 80
        if (inbox.requests.length > 80) inbox.requests = inbox.requests.slice(0, 80);
        return saveInbox(inbox).then(function () {
          return { ok: true, already: false };
        });
      })
      .catch(function (e) {
        return { ok: false, error: (e && e.message) || "Не удалось отправить в облако" };
      });
  }

  function pullPending() {
    return loadInbox()
      .then(function (inbox) {
        return (inbox.requests || []).filter(function (r) {
          return !r.status || r.status === "pending";
        });
      })
      .catch(function () {
        return [];
      });
  }

  function markResolved(loginOrId, status) {
    return loadInbox()
      .then(function (inbox) {
        var key = String(loginOrId || "").toLowerCase();
        var changed = false;
        (inbox.requests || []).forEach(function (r) {
          if (r.id === loginOrId || String(r.login).toLowerCase() === key) {
            if (r.status === "pending") {
              r.status = status || "resolved";
              r.resolvedAt = new Date().toISOString();
              changed = true;
            }
          }
        });
        if (!changed) return true;
        return saveInbox(inbox);
      })
      .catch(function () {
        return false;
      });
  }

  global.BmtCloud = {
    pushRequest: pushRequest,
    pullPending: pullPending,
    markResolved: markResolved,
    loadInbox: loadInbox,
  };
})(window);
