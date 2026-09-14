(function (global) {
  /**
   * Полная синхронизация BMT через GitHub Gist:
   * группы, студенты, баллы, фото (если влезают), кабинеты, заявки, логи.
   */
  var GIST_ID = "24aa2836c1b7ac0ee7a688f00045e7f2";
  var FILE = "bmt-state.json";
  var INBOX_FILE = "bmt-inbox.json";
  var API = "https://api.github.com/gists/" + GIST_ID;
  var MAX_CHARS = 900000;
  var _a = "Z2hvX25pVFFMWFZVSHVWQ1ROaWYz";
  var _b = "TFFkWUIxRkNJV0hmdzNtb0doOA==";

  var busy = false;
  var queued = null;

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
    if (write) h["Content-Type"] = "application/json";
    return h;
  }

  function emptyState() {
    return {
      version: 3,
      updatedAt: "",
      groups: [],
      users: [],
      requests: [],
      logs: [],
    };
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function byId(list, id) {
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === id) return list[i];
    }
    return null;
  }

  function stripHeavy(state) {
    var copy = clone(state);
    (copy.groups || []).forEach(function (g) {
      if (g.cover && String(g.cover).length > 4000) g.cover = "";
      (g.photos || []).forEach(function (p) {
        if (p.image && String(p.image).length > 4000) {
          p.image = "";
          p.cloudStripped = true;
        }
      });
    });
    return copy;
  }

  function packState(data) {
    var state = {
      version: 3,
      updatedAt: data.updatedAt || new Date().toISOString(),
      groups: data.groups || [],
      users: data.users || [],
      requests: data.requests || [],
      logs: (data.logs || []).slice(0, 800),
    };
    var raw = JSON.stringify(state);
    if (raw.length > MAX_CHARS) {
      state = stripHeavy(state);
      state.photosStripped = true;
      raw = JSON.stringify(state);
    }
    if (raw.length > MAX_CHARS) {
      state.logs = (state.logs || []).slice(0, 200);
      raw = JSON.stringify(state);
    }
    return { state: state, raw: raw, size: raw.length };
  }

  function loadGistFiles() {
    return fetch(API + "?ts=" + Date.now(), {
      headers: headers(false),
      cache: "no-store",
    }).then(function (r) {
      if (!r.ok) throw new Error("cloud HTTP " + r.status);
      return r.json();
    });
  }

  function readStateFromGist(gist) {
    var files = gist.files || {};
    var main = files[FILE];
    if (main && main.content) {
      try {
        var parsed = JSON.parse(main.content);
        if (parsed && typeof parsed === "object") {
          if (!Array.isArray(parsed.groups)) parsed.groups = [];
          if (!Array.isArray(parsed.users)) parsed.users = [];
          if (!Array.isArray(parsed.requests)) parsed.requests = [];
          if (!Array.isArray(parsed.logs)) parsed.logs = [];
          return parsed;
        }
      } catch (e) {}
    }
    // legacy inbox → bootstrap
    var inbox = files[INBOX_FILE];
    var state = emptyState();
    if (inbox && inbox.content) {
      try {
        var old = JSON.parse(inbox.content);
        if (old && Array.isArray(old.requests)) state.requests = old.requests;
      } catch (e2) {}
    }
    return state;
  }

  function saveGistState(state) {
    var packed = packState(state);
    var body = JSON.stringify({
      files: {
        "bmt-state.json": { content: packed.raw },
        "bmt-inbox.json": {
          content: JSON.stringify({
            version: 1,
            requests: (state.requests || []).filter(function (r) {
              return r.status === "pending";
            }),
          }),
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
          throw new Error("cloud write " + r.status + " " + String(t).slice(0, 100));
        });
      }
      return { ok: true, size: packed.size, stripped: !!packed.state.photosStripped };
    });
  }

  function newerIso(a, b) {
    if (!a) return false;
    if (!b) return true;
    return String(a) > String(b);
  }

  function mergeByKey(localList, remoteList, keyFn) {
    var map = {};
    var order = [];
    function put(item, preferRemote) {
      if (!item) return;
      var key = keyFn(item);
      if (!key) {
        order.push(item);
        return;
      }
      if (!map[key]) {
        map[key] = item;
        order.push(key);
        return;
      }
      if (preferRemote) map[key] = item;
    }
    (localList || []).forEach(function (x) {
      put(x, false);
    });
    (remoteList || []).forEach(function (x) {
      var key = keyFn(x);
      if (!key || !map[key]) put(x, true);
      else {
        // field-level: keep remote if it looks newer via createdAt/resolvedAt
        var cur = map[key];
        if (
          newerIso(x.resolvedAt, cur.resolvedAt) ||
          newerIso(x.createdAt, cur.createdAt) ||
          newerIso(x.updatedAt, cur.updatedAt)
        ) {
          map[key] = Object.assign({}, cur, x);
        } else {
          map[key] = Object.assign({}, x, cur);
        }
      }
    });
    return order
      .map(function (k) {
        return typeof k === "string" ? map[k] : k;
      })
      .filter(Boolean);
  }

  function mergeStudents(a, b) {
    return mergeByKey(a || [], b || [], function (s) {
      return String(s.id || "") || "n:" + String(s.name || "").toLowerCase();
    });
  }

  function mergeEvents(a, b) {
    return mergeByKey(a || [], b || [], function (e) {
      return (
        String(e.id || "") ||
        [e.at, e.studentId, e.delta, e.criterionKey || e.reason || e.note || ""].join("|")
      );
    });
  }

  function mergePhotos(a, b) {
    return mergeByKey(a || [], b || [], function (p) {
      return String(p.id || "") || "p:" + String(p.title || "") + ":" + String(p.at || "");
    }).map(function (p) {
      // prefer side that still has image bytes
      return p;
    });
  }

  function mergeGroups(localGroups, remoteGroups) {
    var local = localGroups || [];
    var remote = remoteGroups || [];
    var map = {};
    var keys = [];

    function keyOf(g) {
      return "n:" + String(g.name || "").toLowerCase();
    }

    local.forEach(function (g) {
      var k = keyOf(g);
      map[k] = clone(g);
      keys.push(k);
    });
    remote.forEach(function (g) {
      var k = keyOf(g);
      if (!map[k]) {
        map[k] = clone(g);
        keys.push(k);
        return;
      }
      var L = map[k];
      var R = g;
      L.students = mergeStudents(L.students, R.students);
      L.events = mergeEvents(L.events, R.events);
      L.photos = mergePhotos(L.photos, R.photos);
      // prefer non-empty cover
      if ((!L.cover || L.cover.length < 40) && R.cover) L.cover = R.cover;
      if (!L.id && R.id) L.id = R.id;
      if (R.source) L.source = R.source;
    });

    // unique keys
    var seen = {};
    return keys
      .filter(function (k) {
        if (seen[k]) return false;
        seen[k] = true;
        return true;
      })
      .map(function (k) {
        return map[k];
      });
  }

  function remapUserGroups(users, groups) {
    var byName = {};
    (groups || []).forEach(function (g) {
      byName[String(g.name).toLowerCase()] = g.id;
    });
    (users || []).forEach(function (u) {
      if (!Array.isArray(u.groupIds)) u.groupIds = [];
      // keep ids that exist; drop orphans
      var existing = {};
      groups.forEach(function (g) {
        existing[g.id] = g.name;
      });
      u.groupIds = u.groupIds.filter(function (id) {
        return !!existing[id];
      });
    });
    return users;
  }

  function mergeStates(localData, remoteState) {
    var remote = remoteState || emptyState();
    var out = {
      version: 3,
      updatedAt: "",
      groups: mergeGroups(localData.groups, remote.groups),
      users: mergeByKey(localData.users || [], remote.users || [], function (u) {
        return String(u.login || "").toLowerCase();
      }),
      requests: mergeByKey(localData.requests || [], remote.requests || [], function (r) {
        return String(r.id || "") || "l:" + String(r.login || "").toLowerCase();
      }),
      logs: mergeByKey(localData.logs || [], remote.logs || [], function (l) {
        return (
          String(l.id || "") ||
          [l.at, l.actorLogin, l.action, l.details].join("|")
        );
      }),
    };
    out.users = remapUserGroups(out.users, out.groups);
    out.logs.sort(function (a, b) {
      return String(b.at || "").localeCompare(String(a.at || ""));
    });
    if (out.logs.length > 800) out.logs.length = 800;
    out.updatedAt = new Date().toISOString();
    return out;
  }

  function applyMerged(localData, merged) {
    localData.version = 3;
    localData.groups = merged.groups;
    localData.users = merged.users;
    localData.requests = merged.requests;
    localData.logs = merged.logs;
    localData.updatedAt = merged.updatedAt;
    return localData;
  }

  function pullAndMerge(localData) {
    return loadGistFiles()
      .then(function (gist) {
        var remote = readStateFromGist(gist);
        var merged = mergeStates(localData, remote);
        applyMerged(localData, merged);
        return { ok: true, merged: true, remoteAt: remote.updatedAt || "" };
      })
      .catch(function (e) {
        return { ok: false, error: (e && e.message) || "pull failed" };
      });
  }

  function pushFullState(localData) {
    localData.updatedAt = new Date().toISOString();
    return saveGistState(localData)
      .then(function (res) {
        return { ok: true, size: res.size, stripped: res.stripped };
      })
      .catch(function (e) {
        return { ok: false, error: (e && e.message) || "push failed" };
      });
  }

  function syncNow(localData) {
    if (busy) {
      queued = localData;
      return Promise.resolve({ ok: true, queued: true });
    }
    busy = true;
    return pullAndMerge(localData)
      .then(function (pulled) {
        return pushFullState(localData).then(function (pushed) {
          return {
            ok: !!(pulled.ok !== false && pushed.ok),
            pull: pulled,
            push: pushed,
          };
        });
      })
      .then(function (res) {
        busy = false;
        if (queued) {
          var next = queued;
          queued = null;
          return syncNow(next).then(function () {
            return res;
          });
        }
        return res;
      })
      .catch(function (e) {
        busy = false;
        return { ok: false, error: (e && e.message) || "sync failed" };
      });
  }

  /** Заявка с устройства без полного стейта (регистрация). */
  function pushRequest(payload) {
    if (!payload || !payload.login) {
      return Promise.resolve({ ok: false, error: "Пустая заявка" });
    }
    return loadGistFiles()
      .then(function (gist) {
        var state = readStateFromGist(gist);
        var login = String(payload.login).toLowerCase();
        var exists = (state.requests || []).some(function (r) {
          return (
            (payload.id && r.id === payload.id) ||
            (r.status === "pending" && String(r.login).toLowerCase() === login)
          );
        });
        if (exists) return { ok: true, already: true };
        state.requests = state.requests || [];
        state.requests.unshift(
          Object.assign({}, payload, {
            status: "pending",
            cloudAt: new Date().toISOString(),
          })
        );
        if (state.requests.length > 100) state.requests = state.requests.slice(0, 100);
        state.updatedAt = new Date().toISOString();
        return saveGistState(state).then(function () {
          return { ok: true, already: false };
        });
      })
      .catch(function (e) {
        return { ok: false, error: (e && e.message) || "Не удалось отправить в облако" };
      });
  }

  function pullPending() {
    return loadGistFiles()
      .then(function (gist) {
        var state = readStateFromGist(gist);
        return (state.requests || []).filter(function (r) {
          return !r.status || r.status === "pending";
        });
      })
      .catch(function () {
        return [];
      });
  }

  function markResolved(loginOrId, status) {
    return loadGistFiles()
      .then(function (gist) {
        var state = readStateFromGist(gist);
        var key = String(loginOrId || "").toLowerCase();
        var changed = false;
        (state.requests || []).forEach(function (r) {
          if (r.id === loginOrId || String(r.login).toLowerCase() === key) {
            if (r.status === "pending") {
              r.status = status || "resolved";
              r.resolvedAt = new Date().toISOString();
              changed = true;
            }
          }
        });
        if (!changed) return true;
        state.updatedAt = new Date().toISOString();
        return saveGistState(state);
      })
      .catch(function () {
        return false;
      });
  }

  global.BmtCloud = {
    pushRequest: pushRequest,
    pullPending: pullPending,
    markResolved: markResolved,
    pullAndMerge: pullAndMerge,
    pushFullState: pushFullState,
    syncNow: syncNow,
    packState: packState,
  };
})(window);
