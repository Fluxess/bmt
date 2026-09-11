(function (global) {
  var KEY = "bmt-points-v1";
  var PHOTO_KINDS = ["Грамота", "Фото группы", "Мероприятие", "Прочее"];
  var CATEGORIES = ["Учёба", "Дисциплина", "Мероприятия", "Прочее"];

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function empty() {
    return { version: 1, groups: [] };
  }

  function normalize(data) {
    if (!data || !Array.isArray(data.groups)) return empty();
    data.version = 1;
    data.groups.forEach(function (g) {
      if (!g.id) g.id = uid();
      if (!g.name) g.name = "Группа";
      if (!Array.isArray(g.students)) g.students = [];
      if (!Array.isArray(g.events)) g.events = [];
      if (!Array.isArray(g.photos)) g.photos = [];
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
        version: 1,
        exportedAt: new Date().toISOString(),
        groups: data.groups,
      },
      null,
      2
    );
  }

  function importJson(text) {
    var parsed = JSON.parse(text);
    return normalize(parsed);
  }

  function rankingCsv(group) {
    var ranked = rankedStudents(group);
    var lines = ["Место;ФИО;Баллы;Учёба;Дисциплина;Мероприятия;Прочее"];
    ranked.forEach(function (item, i) {
      var cats = categoryTotals(group, item.student.id);
      lines.push(
        [
          i + 1,
          '"' + String(item.student.name).replace(/"/g, '""') + '"',
          item.total,
          cats["Учёба"],
          cats["Дисциплина"],
          cats["Мероприятия"],
          cats["Прочее"],
        ].join(";")
      );
    });
    return "\uFEFF" + lines.join("\n");
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
    uid: uid,
    load: load,
    save: save,
    studentTotal: studentTotal,
    groupTotal: groupTotal,
    categoryTotals: categoryTotals,
    rankedStudents: rankedStudents,
    studentName: studentName,
    exportJson: exportJson,
    importJson: importJson,
    rankingCsv: rankingCsv,
    downloadText: downloadText,
  };
})(window);
