(function (global) {
  var KEY = "bmt-points-v1";
  var PHOTO_KINDS = ["Грамота", "Фото группы", "Мероприятие", "Прочее"];
  var CATEGORIES = ["Учёба", "Дисциплина", "Мероприятия", "Прочее"];

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function empty() {
    return { groups: [] };
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return empty();
      var data = JSON.parse(raw);
      if (!data || !Array.isArray(data.groups)) return empty();
      data.groups.forEach(function (g) {
        if (!Array.isArray(g.students)) g.students = [];
        if (!Array.isArray(g.events)) g.events = [];
        if (!Array.isArray(g.photos)) g.photos = [];
        g.students.forEach(function (s) {
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
    } catch (e) {
      return empty();
    }
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
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
        return b.total - a.total;
      });
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
  };
})(window);
