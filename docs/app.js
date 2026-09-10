(function () {
  var store = window.BmtStore;
  var root = document.getElementById("app");
  var state = { screen: "groups", groupId: null, studentId: null };
  var data = store.load();

  function persist() {
    store.save(data);
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

  function render() {
    root.innerHTML = "";
    if (state.screen === "groups") renderGroups();
    else if (state.screen === "group") renderGroup();
    else renderStudent();
  }

  function renderGroups() {
    var card = el('<section class="card"></section>');
    card.innerHTML =
      "<h1>Группы</h1>" +
      '<p class="status">Добавьте учебную группу, затем студентов и начисляйте баллы.</p>';
    var list = document.createElement("div");
    if (!data.groups.length) {
      list.innerHTML = '<p class="status">Пока нет групп.</p>';
    } else {
      data.groups.forEach(function (g) {
        var total = store.groupTotal(g);
        var row = el(
          '<button class="row" type="button">' +
            "<span><strong>" +
            escapeHtml(g.name) +
            "</strong><small>" +
            g.students.length +
            " студ.</small></span>" +
            '<span class="badge">' +
            total +
            "</span></button>"
        );
        row.addEventListener("click", function () {
          state.screen = "group";
          state.groupId = g.id;
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
      var name = new FormData(form).get("groupName");
      name = name ? String(name).trim() : "";
      if (!name) return;
      data.groups.push({ id: store.uid(), name: name, students: [], events: [] });
      persist();
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
        "</h1><p class=\"status\">Всего баллов группы: <strong>" +
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
    root.appendChild(head);

    var table = el('<section class="card"><h2>Рейтинг</h2></section>');
    if (!ranked.length) {
      table.appendChild(el('<p class="status">Добавьте студентов.</p>'));
    } else {
      ranked.forEach(function (item, i) {
        var row = el(
          '<button class="row" type="button"><span><strong>' +
            (i + 1) +
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
      '<section class="card"><h2>Новый студент</h2>' +
        '<form class="stack">' +
        '<input name="studentName" required maxlength="80" placeholder="ФИО" />' +
        '<button class="btn" type="submit">Добавить</button></form></section>'
    );
    addSt.querySelector("form").addEventListener("submit", function (e) {
      e.preventDefault();
      var name = new FormData(e.target).get("studentName");
      name = name ? String(name).trim() : "";
      if (!name) return;
      g.students.push({ id: store.uid(), name: name });
      persist();
      render();
    });
    root.appendChild(addSt);

    if (!g.students.length) {
      root.appendChild(
        el(
          '<section class="card"><h2>Начислить / списать</h2>' +
            '<p class="status">Сначала добавьте хотя бы одного студента — список появится здесь.</p></section>'
        )
      );
    } else {
      var addPts = el(
        '<section class="card"><h2>Начислить / списать</h2>' +
          '<form class="stack">' +
          '<label class="lbl">Студент</label>' +
          '<select name="studentId" required></select>' +
          '<label class="lbl">Категория</label>' +
          '<select name="category"></select>' +
          '<label class="lbl">Баллы</label>' +
          '<input name="delta" type="number" required step="1" placeholder="Например 5 или -2" />' +
          '<label class="lbl">Причина</label>' +
          '<input name="reason" maxlength="120" placeholder="За что начислено" />' +
          '<button class="btn" type="submit">Сохранить</button></form></section>'
      );
      var sel = addPts.querySelector('[name="studentId"]');
      g.students.forEach(function (s) {
        sel.appendChild(
          el('<option value="' + s.id + '">' + escapeHtml(s.name) + "</option>")
        );
      });
      var catSel = addPts.querySelector('[name="category"]');
      store.CATEGORIES.forEach(function (c) {
        catSel.appendChild(el("<option>" + escapeHtml(c) + "</option>"));
      });
      addPts.querySelector("form").addEventListener("submit", function (e) {
        e.preventDefault();
        var fd = new FormData(e.target);
        var delta = Number(fd.get("delta"));
        var studentId = String(fd.get("studentId") || "");
        if (!delta || !studentId) return;
        g.events.unshift({
          id: store.uid(),
          studentId: studentId,
          delta: delta,
          category: String(fd.get("category") || "Прочее"),
          reason: String(fd.get("reason") || "").trim() || "Без комментария",
          at: new Date().toISOString(),
        });
        persist();
        render();
      });
      root.appendChild(addPts);
    }

    var danger = el(
      '<section class="card"><button class="btn btn-ghost" type="button">Удалить группу</button></section>'
    );
    danger.querySelector("button").addEventListener("click", function () {
      if (!confirm("Удалить группу «" + g.name + "» и все баллы?")) return;
      data.groups = data.groups.filter(function (x) {
        return x.id !== g.id;
      });
      persist();
      state.screen = "groups";
      render();
    });
    root.appendChild(danger);
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
    root.appendChild(head);

    var hist = el('<section class="card"><h2>История</h2></section>');
    var events = g.events.filter(function (e) {
      return e.studentId === s.id;
    });
    if (!events.length) {
      hist.appendChild(el('<p class="status">Пока нет операций.</p>'));
    } else {
      events.forEach(function (ev) {
        hist.appendChild(
          el(
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
              "</small></span></div>"
          )
        );
      });
    }
    root.appendChild(hist);
  }

  function initVk() {
    var status = document.getElementById("vk-status");
    var bridge = window.vkBridge;
    if (!bridge || typeof bridge.send !== "function") return;
    bridge.send("VKWebAppInit");
    bridge
      .send("VKWebAppGetUserInfo")
      .then(function (user) {
        if (user && user.first_name) {
          status.textContent = "Куратор: " + user.first_name + " · баллы групп техникума";
        }
      })
      .catch(function () {});
  }

  initVk();
  render();
})();
