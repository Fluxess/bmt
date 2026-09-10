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

  function option(value, label) {
    var o = document.createElement("option");
    o.value = value;
    o.textContent = label;
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
      g.students.push({ id: store.uid(), name: name, portfolio: [] });
      persist();
      render();
    });
    root.appendChild(addSt);

    var addPts = el(
      '<section class="card"><h2>Начислить / списать</h2></section>'
    );
    if (!g.students.length) {
      addPts.appendChild(
        el('<p class="status">Сначала добавьте студента кнопкой выше.</p>')
      );
    } else {
      var picked = { id: g.students[0].id };
      var pickLabel = el(
        '<p class="status">Студент: <strong id="picked-name">' +
          escapeHtml(g.students[0].name) +
          "</strong></p>"
      );
      addPts.appendChild(pickLabel);
      g.students.forEach(function (s) {
        var btn = el(
          '<button class="row pick" type="button">' +
            escapeHtml(s.name) +
            "</button>"
        );
        if (s.id === picked.id) btn.classList.add("pick-on");
        btn.addEventListener("click", function () {
          picked.id = s.id;
          addPts.querySelectorAll(".pick").forEach(function (b) {
            b.classList.remove("pick-on");
          });
          btn.classList.add("pick-on");
          addPts.querySelector("#picked-name").textContent = s.name;
        });
        addPts.appendChild(btn);
      });
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
      var catSel = form.querySelector('[name="category"]');
      store.CATEGORIES.forEach(function (c) {
        catSel.appendChild(option(c, c));
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
        persist();
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

    if (!Array.isArray(s.portfolio)) s.portfolio = [];
    var port = el(
      '<section class="card"><h2>Портфолио</h2>' +
        '<p class="status">Грамоты, дипломы, сертификаты — фото с телефона.</p></section>'
    );
    var grid = document.createElement("div");
    grid.className = "gallery";
    if (!s.portfolio.length) {
      port.appendChild(el('<p class="status">Пока нет файлов.</p>'));
    } else {
      s.portfolio.forEach(function (item) {
        var fig = el(
          '<figure class="shot"><img alt=""/><figcaption></figcaption>' +
            '<button class="link" type="button">Удалить</button></figure>'
        );
        fig.querySelector("img").src = item.image;
        fig.querySelector("figcaption").textContent =
          item.title + " · " + formatDate(item.at);
        fig.querySelector("button").addEventListener("click", function () {
          s.portfolio = s.portfolio.filter(function (x) {
            return x.id !== item.id;
          });
          persist();
          render();
        });
        grid.appendChild(fig);
      });
      port.appendChild(grid);
    }
    var portForm = el(
      '<form class="stack">' +
        '<input name="title" maxlength="80" placeholder="Название, например Грамота за олимпиаду" />' +
        '<input name="photo" type="file" accept="image/*" />' +
        '<button class="btn" type="submit">Добавить в портфолио</button></form>'
    );
    portForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var file = portForm.querySelector('[name="photo"]').files[0];
      if (!file) {
        alert("Выберите фото грамоты.");
        return;
      }
      var title =
        String(new FormData(portForm).get("title") || "").trim() || "Грамота";
      compressImage(file, function (dataUrl) {
        if (!dataUrl) {
          alert("Не удалось прочитать фото.");
          return;
        }
        try {
          s.portfolio.unshift({
            id: store.uid(),
            title: title,
            image: dataUrl,
            at: new Date().toISOString(),
          });
          persist();
          render();
        } catch (err) {
          alert("Не хватило места в браузере. Удалите старые фото.");
        }
      });
    });
    port.appendChild(portForm);
    root.appendChild(port);

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
