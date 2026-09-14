(function (global) {
  /**
   * Критерии СТП-ПО-ВС № 5-07
   * Положение о конкурсе «Лучшая учебная группа года» (ГАПОУ «БМТ», II редакция)
   *
   * mode:
   *  - "set"  — один показатель на период (заменяет прошлую запись с тем же key)
   *  - "add"  — каждое нажатие добавляет баллы
   *  - "count"— спрашивает количество и умножает delta
   */
  var CRITERIA_SECTIONS = [
    {
      id: "contingent",
      title: "4.2.1 Сохранность контингента",
      hint: "За каждого отчисленного за неуспеваемость или прогулы",
      items: [
        {
          key: "expelled",
          label: "Отчисление (неуспеваемость / прогулы)",
          delta: -2,
          category: "Контингент",
          mode: "count",
          countLabel: "Сколько студентов отчислено?",
        },
      ],
    },
    {
      id: "performance",
      title: "4.2.2 Успеваемость группы",
      hint: "Выберите процент успеваемости — баллы подставятся сами",
      items: [
        { key: "perf", label: "90–100%", delta: 40, category: "Успеваемость", mode: "set" },
        { key: "perf", label: "80–90%", delta: 30, category: "Успеваемость", mode: "set" },
        { key: "perf", label: "70–80%", delta: 10, category: "Успеваемость", mode: "set" },
        { key: "perf", label: "60–70%", delta: 0, category: "Успеваемость", mode: "set" },
        { key: "perf", label: "50–60%", delta: -10, category: "Успеваемость", mode: "set" },
        { key: "perf", label: "менее 50%", delta: -20, category: "Успеваемость", mode: "set" },
      ],
    },
    {
      id: "quality",
      title: "4.2.3 Качество знаний",
      hint: "Выберите процент качества знаний",
      items: [
        { key: "quality", label: "90–100%", delta: 40, category: "Качество знаний", mode: "set" },
        { key: "quality", label: "80–90%", delta: 30, category: "Качество знаний", mode: "set" },
        { key: "quality", label: "70–80%", delta: 20, category: "Качество знаний", mode: "set" },
        { key: "quality", label: "60–70%", delta: 10, category: "Качество знаний", mode: "set" },
        { key: "quality", label: "50–60%", delta: 0, category: "Качество знаний", mode: "set" },
        { key: "quality", label: "40–50%", delta: -10, category: "Качество знаний", mode: "set" },
        { key: "quality", label: "менее 40%", delta: -20, category: "Качество знаний", mode: "set" },
      ],
    },
    {
      id: "attendance",
      title: "4.2.4 Посещаемость",
      hint: "Среднее число часов пропусков по неуважительной причине на 1 студента",
      items: [
        { key: "attend", label: "0–1 ч", delta: 15, category: "Посещаемость", mode: "set" },
        { key: "attend", label: "2–5 ч", delta: 0, category: "Посещаемость", mode: "set" },
        { key: "attend", label: "6–10 ч", delta: -5, category: "Посещаемость", mode: "set" },
        { key: "attend", label: "11–15 ч", delta: -10, category: "Посещаемость", mode: "set" },
        { key: "attend", label: "16–20 ч", delta: -11, category: "Посещаемость", mode: "set" },
        { key: "attend", label: "21–25 ч", delta: -12, category: "Посещаемость", mode: "set" },
        { key: "attend", label: "26–30 ч", delta: -13, category: "Посещаемость", mode: "set" },
        { key: "attend", label: "31–35 ч", delta: -14, category: "Посещаемость", mode: "set" },
        { key: "attend", label: "36–50 ч", delta: -15, category: "Посещаемость", mode: "set" },
        { key: "attend", label: "50–70 ч", delta: -20, category: "Посещаемость", mode: "set" },
        { key: "attend", label: "свыше 70 ч", delta: -25, category: "Посещаемость", mode: "set" },
      ],
    },
    {
      id: "discipline",
      title: "4.2.5 Дисциплина",
      hint: "Студенты с дисциплинарными взысканиями / докладными",
      items: [
        { key: "disc", label: "0 человек", delta: 15, category: "Дисциплина", mode: "set" },
        { key: "disc", label: "1–2 человека", delta: 0, category: "Дисциплина", mode: "set" },
        { key: "disc", label: "3–5 человек", delta: -15, category: "Дисциплина", mode: "set" },
        { key: "disc", label: "5–10 человек", delta: -20, category: "Дисциплина", mode: "set" },
        { key: "disc", label: "свыше 10", delta: -30, category: "Дисциплина", mode: "set" },
        {
          key: "offense",
          label: "Правонарушение / учёт КДН, ПДН, внутренний",
          delta: -15,
          category: "Дисциплина",
          mode: "count",
          countLabel: "Сколько студентов?",
        },
        {
          key: "late",
          label: "Опоздание / без пропуска (электронного)",
          delta: -1,
          category: "Дисциплина",
          mode: "count",
          countLabel: "Сколько случаев?",
        },
      ],
    },
    {
      id: "appearance",
      title: "4.2.6 Внешний вид",
      hint: "Несоответствие правилам внутреннего распорядка (по журналу / рейдам)",
      items: [
        {
          key: "look",
          label: "Нарушение внешнего вида",
          delta: -1,
          category: "Внешний вид",
          mode: "count",
          countLabel: "Сколько студентов?",
        },
      ],
    },
    {
      id: "events-rf",
      title: "4.2.7 Мероприятия · всероссийский уровень",
      hint: "Каждое участие добавляет баллы",
      items: [
        { key: "rf1", label: "1 место", delta: 25, category: "Мероприятия", mode: "add" },
        { key: "rf2", label: "2 место", delta: 20, category: "Мероприятия", mode: "add" },
        { key: "rf3", label: "3 место", delta: 15, category: "Мероприятия", mode: "add" },
        { key: "rfn", label: "Номинация", delta: 10, category: "Мероприятия", mode: "add" },
      ],
    },
    {
      id: "events-rt",
      title: "4.2.7 Мероприятия · республиканский уровень",
      items: [
        { key: "rt1", label: "1 место", delta: 20, category: "Мероприятия", mode: "add" },
        { key: "rt2", label: "2 место", delta: 15, category: "Мероприятия", mode: "add" },
        { key: "rt3", label: "3 место", delta: 10, category: "Мероприятия", mode: "add" },
        { key: "rtn", label: "Номинация", delta: 5, category: "Мероприятия", mode: "add" },
      ],
    },
    {
      id: "events-reg",
      title: "4.2.7 Мероприятия · региональный уровень",
      items: [
        { key: "reg1", label: "1 место", delta: 15, category: "Мероприятия", mode: "add" },
        { key: "reg2", label: "2 место", delta: 12, category: "Мероприятия", mode: "add" },
        { key: "reg3", label: "3 место", delta: 10, category: "Мероприятия", mode: "add" },
        { key: "regn", label: "Номинация", delta: 5, category: "Мероприятия", mode: "add" },
      ],
    },
    {
      id: "events-city",
      title: "4.2.7 Мероприятия · город / техникум",
      items: [
        {
          key: "city",
          label: "Городские мероприятия",
          delta: 10,
          category: "Мероприятия",
          mode: "add",
        },
        {
          key: "in1",
          label: "Внутритехникумовские · 1 место",
          delta: 10,
          category: "Мероприятия",
          mode: "add",
        },
        {
          key: "in2",
          label: "Внутритехникумовские · 2 место",
          delta: 8,
          category: "Мероприятия",
          mode: "add",
        },
        {
          key: "in3",
          label: "Внутритехникумовские · 3 место",
          delta: 5,
          category: "Мероприятия",
          mode: "add",
        },
        {
          key: "inn",
          label: "Внутритехникумовские · номинация",
          delta: 3,
          category: "Мероприятия",
          mode: "add",
        },
        {
          key: "help-org",
          label: "Участие в организации мероприятий",
          delta: 5,
          category: "Мероприятия",
          mode: "add",
        },
        {
          key: "self-org",
          label: "Самостоятельная организация мероприятий",
          delta: 10,
          category: "Мероприятия",
          mode: "add",
        },
        {
          key: "museum",
          label: "Театры, музеи и пр.",
          delta: 8,
          category: "Мероприятия",
          mode: "add",
        },
        {
          key: "news",
          label: "Выпуск газет",
          delta: 5,
          category: "Мероприятия",
          mode: "add",
        },
        {
          key: "council",
          label: "Работа студсовета",
          delta: 5,
          category: "Мероприятия",
          mode: "add",
        },
        {
          key: "corner",
          label: "Оформление уголка группы",
          delta: 5,
          category: "Мероприятия",
          mode: "add",
        },
        {
          key: "other5",
          label: "Прочая деятельность",
          delta: 5,
          category: "Мероприятия",
          mode: "add",
        },
        {
          key: "other10",
          label: "Прочая деятельность (усиленная)",
          delta: 10,
          category: "Мероприятия",
          mode: "add",
        },
      ],
    },
    {
      id: "duty",
      title: "Хозработы и дежурство",
      hint: "По оценке дежурного администратора и коменданта (+10…+30)",
      items: [
        { key: "duty", label: "+10", delta: 10, category: "Хозработы", mode: "add" },
        { key: "duty", label: "+15", delta: 15, category: "Хозработы", mode: "add" },
        { key: "duty", label: "+20", delta: 20, category: "Хозработы", mode: "add" },
        { key: "duty", label: "+25", delta: 25, category: "Хозработы", mode: "add" },
        { key: "duty", label: "+30", delta: 30, category: "Хозработы", mode: "add" },
      ],
    },
    {
      id: "jury",
      title: "Доп. баллы жюри (п. 5.5)",
      hint: "За особую активность или выдающиеся достижения",
      items: [
        { key: "jury5", label: "+5", delta: 5, category: "Прочее", mode: "add" },
        { key: "jury10", label: "+10", delta: 10, category: "Прочее", mode: "add" },
        { key: "jury15", label: "+15", delta: 15, category: "Прочее", mode: "add" },
        { key: "jury20", label: "+20", delta: 20, category: "Прочее", mode: "add" },
      ],
    },
  ];

  function formatDelta(n) {
    var v = Number(n) || 0;
    return (v > 0 ? "+" : "") + v;
  }

  function applyCriterion(group, item, count) {
    var qty = 1;
    if (item.mode === "count") {
      qty = Math.max(1, Math.floor(Number(count) || 1));
    }
    var delta = Number(item.delta) * qty;
    var reason =
      item.label +
      (item.mode === "count" && qty > 1 ? " × " + qty : "") +
      " · по положению СТП-ПО-ВС № 5-07";

    if (item.mode === "set") {
      group.events = (group.events || []).filter(function (e) {
        return e.criterionKey !== item.key;
      });
    }

    var ev = {
      id:
        Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      studentId: null,
      delta: delta,
      category: item.category,
      reason: reason,
      criterionKey: item.key,
      criterionLabel: item.label,
      fromRegulation: true,
      at: new Date().toISOString(),
    };
    group.events.unshift(ev);
    return ev;
  }

  global.BmtCriteria = {
    SECTIONS: CRITERIA_SECTIONS,
    formatDelta: formatDelta,
    applyCriterion: applyCriterion,
    DOC: "СТП-ПО-ВС № 5-07 · «Лучшая учебная группа года»",
  };
})(window);
