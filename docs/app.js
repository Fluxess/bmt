(function () {
  var store = window.BmtStore;
  var root = document.getElementById("app");
  var state = {
    screen: "groups",
    groupId: null,
    studentId: null,
    search: "",
    catFilter: "Все",
  };
  var data = store.load();

  function persist() {
    if (!store.save(data)) {
      toast("Не хватило места в браузере. Удалите фото или сделайте бэкап.", true);
      return false;
    }
    return true;
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

  function render() {
    root.innerHTML = "";
    if (state.screen === "groups") renderGroups();
    else if (state.screen === "group") renderGroup();
    else renderStudent();
  }

  function renderGroups() {
    var card = el('<section class="card"></section>');
    card.innerHTML =
      "<h1>Группы техникума</h1>" +
      '<p class="status">Учёт баллов по учебным группам. Данные хранятся на этом устройстве — сделайте бэкап.</p>';

    var tools = el('<div class="toolbar"></div>');
    var exportBtn = el('<button class="btn btn-soft" type="button">Скачать бэкап</button>');
    exportBtn.addEventListener("click", function () {
      store.downloadText(
        "bmt-backup-" + new Date().toISOString().slice(0, 10) + ".json",
        store.exportJson(data),
        "application/json;charset=utf-8"
      );
      toast("Бэкап скачан");
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
          if (!persist()) return;
          state.screen = "groups";
          state.groupId = null;
          state.studentId = null;
          toast("Данные восстановлены");
          render();
        } catch (err) {
          toast("Файл бэкапа повреждён", true);
        }
      };
      reader.readAsText(file);
    });
    tools.appendChild(exportBtn);
    tools.appendChild(importLabel);
    card.appendChild(tools);

    var list = document.createElement("div");
    if (!data.groups.length) {
      list.innerHTML =
        '<p class="status">Пока нет групп. Создайте первую — например ИС-31.</p>';
    } else {
      data.groups
        .slice()
        .sort(function (a, b) {
          return a.name.localeCompare(b.name, "ru");
        })
        .forEach(function (g) {
          var total = store.groupTotal(g);
          var row = el(
            '<button class="row" type="button">' +
              "<span><strong>" +
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

    var form = el(
      '<form class="stack">' +
        '<input name="groupName" required maxlength="40" placeholder="Название, например ИС-31" />' +
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
      });
      if (!persist()) return;
      toast("Группа «" + name + "» создана");
      render();
    });
    card.appendChild(form);
    root.appendChild(card);
  }

  function renderGroup() {
    var g = groupById(state.groupId);
    if (!g) {
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

    var head = el(
      '<section class="card"><h1>' +
        escapeHtml(g.name) +
        '</h1><p class="status">Всего баллов группы: <strong>' +
        store.groupTotal(g) +
        "</strong></p></section>"
    );
    var chips = document.createElement("div");
    chips.className = "chips";
    store.CATEGORIES.forEach(function (c) {
      chips.appendChild(
        el('<span class="chip">' + escapeHtml(c) + ": " + cats[c] + "</span>")
      );
    });
    head.appendChild(chips);

    var headTools = el('<div class="toolbar"></div>');
    var renameBtn = el('<button class="btn btn-soft" type="button">Переименовать</button>');
    renameBtn.addEventListener("click", function () {
      var next = prompt("Новое название группы", g.name);
      if (next === null) return;
      next = next.trim();
      if (!next) return;
      g.name = next.slice(0, 40);
      if (!persist()) return;
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
      toast("Рейтинг экспортирован");
    });
    var shareBtn = el('<button class="btn btn-soft" type="button">Поделиться</button>');
    shareBtn.addEventListener("click", shareApp);
    headTools.appendChild(renameBtn);
    headTools.appendChild(csvBtn);
    headTools.appendChild(shareBtn);
    head.appendChild(headTools);
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
        toast("Баллы сохранены: " + formatPts(delta));
        render();
      });
      addPts.appendChild(form);
    }
    root.appendChild(addPts);

    var danger = el(
      '<section class="card"><button class="btn btn-ghost" type="button">Удалить группу</button></section>'
    );
    danger.querySelector("button").addEventListener("click", function () {
      if (!confirm("Удалить группу «" + g.name + "» и все баллы?")) return;
      data.groups = data.groups.filter(function (x) {
        return x.id !== g.id;
      });
      if (!persist()) return;
      state.screen = "groups";
      toast("Группа удалена");
      render();
    });
    root.appendChild(danger);
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
          toast("Подпись обновлена");
          render();
        });
        fig.querySelector('[data-act="del"]').addEventListener("click", function () {
          if (!confirm("Удалить фото?")) return;
          g.photos = g.photos.filter(function (x) {
            return x.id !== item.id;
          });
          if (!persist()) return;
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
        if (!persist()) return;
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
    if (!s) {
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
      s.name = next.slice(0, 80);
      if (!persist()) return;
      toast("ФИО обновлено");
      render();
    });
    var delBtn = el('<button class="btn btn-ghost" type="button">Удалить студента</button>');
    delBtn.addEventListener("click", function () {
      if (!confirm("Удалить «" + s.name + "» и все его баллы?")) return;
      g.students = g.students.filter(function (x) {
        return x.id !== s.id;
      });
      g.events = g.events.filter(function (x) {
        return x.studentId !== s.id;
      });
      if (!persist()) return;
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
    var status = document.getElementById("vk-status");
    var bridge = window.vkBridge;
    if (!bridge || typeof bridge.send !== "function") {
      if (status) status.textContent = "Баллы учебных групп техникума · локальный режим";
      return;
    }
    bridge.send("VKWebAppInit");
    bridge
      .send("VKWebAppGetUserInfo")
      .then(function (user) {
        if (user && user.first_name && status) {
          status.textContent =
            "Куратор: " + user.first_name + " · баллы групп техникума";
        }
      })
      .catch(function () {});
  }

  initVk();
  render();
})();
