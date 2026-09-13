(function () {
  var canvas = document.getElementById("gears-bg");
  if (!canvas) return;

  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var width = 0;
  var height = 0;
  var dpr = 1;

  var pointerX = 0;
  var pointerY = 0;
  var targetPX = 0;
  var targetPY = 0;

  var COLOR_GRID_SUBTLE = "rgba(216, 178, 188, 0.035)";
  COLOR_GRID_MAJOR = "rgba(216, 178, 188, 0.07)";
  var COLOR_LINE = "rgba(237, 212, 218, 0.28)";
  var COLOR_LINE_BOLD = "rgba(237, 212, 218, 0.42)";
  var COLOR_LINE_FAINT = "rgba(216, 178, 188, 0.16)";
  var COLOR_ACCENT = "rgba(217, 145, 163, 0.45)";
  var COLOR_HATCH = "rgba(216, 178, 188, 0.12)";
  var COLOR_TEXT = "rgba(237, 212, 218, 0.45)";

  function resize() {
    var isNarrow = window.innerWidth < 700;
    dpr = Math.min(window.devicePixelRatio || 1, isNarrow ? 1.25 : 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    if (typeof pickParts === "function") {
      parts = pickParts();
    }
  }
  window.addEventListener("resize", resize);
  resize();

  window.addEventListener("pointermove", function (e) {
    targetPX = (e.clientX / width - 0.5) * 2;
    targetPY = (e.clientY / height - 0.5) * 2;
  });

  // Вспомогательные функции черчения (ГОСТ / CAD стиль)
  function drawArrow(ctx, fromX, fromY, toX, toY, size) {
    size = size || 8;
    var angle = Math.atan2(toY - fromY, toX - fromX);
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    ctx.save();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - size * Math.cos(angle - Math.PI / 7),
      toY - size * Math.sin(angle - Math.PI / 7)
    );
    ctx.lineTo(
      toX - size * Math.cos(angle + Math.PI / 7),
      toY - size * Math.sin(angle + Math.PI / 7)
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawDimLine(ctx, x1, y1, x2, y2, text, offset) {
    offset = offset || 0;
    var angle = Math.atan2(y2 - y1, x2 - x1);
    var nx = -Math.sin(angle) * offset;
    var ny = Math.cos(angle) * offset;

    var px1 = x1 + nx;
    var py1 = y1 + ny;
    var px2 = x2 + nx;
    var py2 = y2 + ny;

    ctx.save();
    ctx.strokeStyle = COLOR_ACCENT;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);

    // Выносные линии
    if (offset !== 0) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(px1 + nx * 0.15, py1 + ny * 0.15);
      ctx.moveTo(x2, y2);
      ctx.lineTo(px2 + nx * 0.15, py2 + ny * 0.15);
      ctx.stroke();
    }

    // Линия размера с двумя стрелками
    drawArrow(ctx, px2, py2, px1, py1, 7);
    drawArrow(ctx, px1, py1, px2, py2, 7);

    // Текст размера
    if (text) {
      var midX = (px1 + px2) / 2;
      var midY = (py1 + py2) / 2;
      ctx.save();
      ctx.translate(midX, midY);
      if (Math.abs(angle) > Math.PI / 2) angle += Math.PI;
      ctx.rotate(angle);
      ctx.font = "10px monospace";
      ctx.fillStyle = COLOR_TEXT;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(text, 0, -3);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawCrosshair(ctx, r, angle) {
    ctx.save();
    ctx.rotate(angle || 0);
    ctx.strokeStyle = COLOR_LINE_FAINT;
    ctx.lineWidth = 1;
    ctx.setLineDash([12, 3, 2, 3]); // Штрихпунктирная линия (осевая)
    ctx.beginPath();
    ctx.moveTo(-r * 1.35, 0);
    ctx.lineTo(r * 1.35, 0);
    ctx.moveTo(0, -r * 1.35);
    ctx.lineTo(0, r * 1.35);
    ctx.stroke();

    // Центровая окружность
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 1. Чертеж шестерни со шпоночным пазом и отверстиями облегчения
  function drawGear(ctx, r, teeth, angle, label) {
    ctx.save();
    ctx.rotate(angle);

    var pitchR = r * 0.88;
    var rootR = r * 0.76;
    var tipR = r * 1.0;
    var boreR = r * 0.32;
    var hubR = r * 0.48;

    // Зубчатый венец
    ctx.strokeStyle = COLOR_LINE_BOLD;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    var step = (Math.PI * 2) / teeth;
    var toothWidth = step * 0.42;

    for (var i = 0; i < teeth; i++) {
      var a0 = i * step;
      var a1 = a0 + toothWidth * 0.22;
      var a2 = a0 + toothWidth * 0.78;
      var a3 = a0 + toothWidth;
      var aNext = (i + 1) * step;

      if (i === 0) ctx.moveTo(Math.cos(a0) * rootR, Math.sin(a0) * rootR);
      else ctx.lineTo(Math.cos(a0) * rootR, Math.sin(a0) * rootR);

      ctx.lineTo(Math.cos(a1) * tipR, Math.sin(a1) * tipR);
      ctx.lineTo(Math.cos(a2) * tipR, Math.sin(a2) * tipR);
      ctx.lineTo(Math.cos(a3) * rootR, Math.sin(a3) * rootR);
      ctx.lineTo(Math.cos(aNext) * rootR, Math.sin(aNext) * rootR);
    }
    ctx.closePath();
    ctx.stroke();

    // Делительная окружность (штриховая)
    ctx.strokeStyle = COLOR_ACCENT;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, pitchR, 0, Math.PI * 2);
    ctx.stroke();

    // Впадины зубьев (окружность впадин)
    ctx.strokeStyle = COLOR_LINE_FAINT;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(0, 0, rootR, 0, Math.PI * 2);
    ctx.stroke();

    // Ступица
    ctx.setLineDash([]);
    ctx.strokeStyle = COLOR_LINE;
    ctx.beginPath();
    ctx.arc(0, 0, hubR, 0, Math.PI * 2);
    ctx.stroke();

    // Отверстия облегчения в диске (4 штуки)
    var holeR = (hubR + rootR) * 0.5;
    var holeSize = (rootR - hubR) * 0.32;
    for (var h = 0; h < 4; h++) {
      var ha = (h * Math.PI) / 2 + Math.PI / 4;
      ctx.beginPath();
      ctx.arc(Math.cos(ha) * holeR, Math.sin(ha) * holeR, holeSize, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Центральное отверстие со шпоночным пазом (keyway)
    ctx.strokeStyle = COLOR_LINE_BOLD;
    ctx.beginPath();
    var kwW = boreR * 0.45;
    var kwH = boreR * 0.32;
    var kwAngle = Math.asin((kwW / 2) / boreR);
    ctx.arc(0, 0, boreR, -Math.PI / 2 + kwAngle, -Math.PI / 2 - kwAngle, false);
    ctx.lineTo(-kwW / 2, -(boreR + kwH));
    ctx.lineTo(kwW / 2, -(boreR + kwH));
    ctx.closePath();
    ctx.stroke();

    // Осевые линии
    drawCrosshair(ctx, r, 0);

    // Размер
    if (label) {
      drawDimLine(ctx, -pitchR, 0, pitchR, 0, label, r * 1.15);
    }

    ctx.restore();
  }

  // 2. Чертеж дисковой фрезы (milling cutter) с наклонными зубьями
  function drawCutter(ctx, r, teeth, angle, label) {
    ctx.save();
    ctx.rotate(angle);

    var tipR = r;
    var gulletR = r * 0.72;
    var boreR = r * 0.3;
    var step = (Math.PI * 2) / teeth;

    ctx.strokeStyle = COLOR_LINE_BOLD;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (var i = 0; i < teeth; i++) {
      var a = i * step;
      var aBack = a + step * 0.7;
      var tipX = Math.cos(a) * tipR;
      var tipY = Math.sin(a) * tipR;
      var gulletX = Math.cos(aBack) * gulletR;
      var gulletY = Math.sin(aBack) * gulletR;
      var nextTipX = Math.cos(a + step) * tipR;
      var nextTipY = Math.sin(a + step) * tipR;

      if (i === 0) ctx.moveTo(tipX, tipY);
      else ctx.lineTo(tipX, tipY);

      ctx.lineTo(gulletX, gulletY);
      ctx.lineTo(nextTipX, nextTipY);
    }
    ctx.closePath();
    ctx.stroke();

    // Внутренние кольца посадки
    ctx.strokeStyle = COLOR_LINE_FAINT;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, gulletR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = COLOR_LINE;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.48, 0, Math.PI * 2);
    ctx.stroke();

    // Посадочное отверстие со шпонпазом
    ctx.strokeStyle = COLOR_LINE_BOLD;
    ctx.beginPath();
    ctx.arc(0, 0, boreR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeRect(-boreR * 0.22, -boreR * 1.35, boreR * 0.44, boreR * 0.4);

    drawCrosshair(ctx, r, 0);

    if (label) {
      drawDimLine(ctx, 0, -tipR, 0, tipR, label, -r * 1.1);
    }

    ctx.restore();
  }

  // 3. Чертеж ступенчатого вала / узла со штриховкой и размерами
  function drawShaftAssembly(ctx, w, h, angle) {
    ctx.save();
    ctx.rotate(angle);

    var hw = w / 2;
    var hh = h / 2;

    // Контур ступеней
    ctx.strokeStyle = COLOR_LINE_BOLD;
    ctx.lineWidth = 1.2;

    var s1w = w * 0.28;
    var s1h = h * 0.55;
    var s2w = w * 0.38;
    var s2h = h * 0.95;
    var s3w = w * 0.34;
    var s3h = h * 0.72;

    // Главная ступень
    ctx.strokeRect(-hw, -s1h / 2, s1w, s1h);
    // Средняя толстая ступень
    ctx.strokeRect(-hw + s1w, -s2h / 2, s2w, s2h);
    // Правая ступень
    ctx.strokeRect(-hw + s1w + s2w, -s3h / 2, s3w, s3h);

    // Фаски (chamfers)
    ctx.beginPath();
    ctx.moveTo(-hw + 6, -s1h / 2);
    ctx.lineTo(-hw, -s1h / 2 + 6);
    ctx.moveTo(-hw + 6, s1h / 2);
    ctx.lineTo(-hw, s1h / 2 - 6);
    ctx.stroke();

    // Штриховка в разрезе (hatching 45°)
    ctx.strokeStyle = COLOR_HATCH;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (var x = -hw + s1w; x < -hw + s1w + s2w; x += 9) {
      ctx.moveTo(x, -s2h / 2);
      ctx.lineTo(Math.min(x + s2h, -hw + s1w + s2w), -s2h / 2 + Math.min(s2h, -hw + s1w + s2w - x));
    }
    ctx.stroke();

    // Осевая линия вала
    ctx.strokeStyle = COLOR_LINE_FAINT;
    ctx.lineWidth = 1;
    ctx.setLineDash([14, 3, 2, 3]);
    ctx.beginPath();
    ctx.moveTo(-hw - 24, 0);
    ctx.lineTo(hw + 24, 0);
    ctx.stroke();

    // Размеры (длина и диаметр)
    drawDimLine(ctx, -hw, 0, hw, 0, "L=" + Math.round(w), s2h / 2 + 18);
    drawDimLine(ctx, -hw + s1w, -s2h / 2, -hw + s1w, s2h / 2, "Ø" + Math.round(s2h), 14);

    ctx.restore();
  }

  // 4. Чертеж фланца с отверстиями по окружности (flange coupling)
  function drawFlange(ctx, r, angle, label) {
    ctx.save();
    ctx.rotate(angle);

    var pcdR = r * 0.72; // Pitch Circle Diameter
    var boreR = r * 0.35;
    var holes = 6;

    // Внешний контур
    ctx.strokeStyle = COLOR_LINE_BOLD;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    // Окружность центров отверстий
    ctx.strokeStyle = COLOR_ACCENT;
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, pcdR, 0, Math.PI * 2);
    ctx.stroke();

    // Болтовые отверстия
    ctx.setLineDash([]);
    ctx.strokeStyle = COLOR_LINE;
    var holeR = r * 0.11;
    for (var i = 0; i < holes; i++) {
      var a = (i * Math.PI * 2) / holes;
      var hx = Math.cos(a) * pcdR;
      var hy = Math.sin(a) * pcdR;
      ctx.beginPath();
      ctx.arc(hx, hy, holeR, 0, Math.PI * 2);
      ctx.stroke();

      // Маленькие крестики центров
      ctx.strokeStyle = COLOR_LINE_FAINT;
      ctx.beginPath();
      ctx.moveTo(hx - holeR * 1.5, hy);
      ctx.lineTo(hx + holeR * 1.5, hy);
      ctx.moveTo(hx, hy - holeR * 1.5);
      ctx.lineTo(hx, hy + holeR * 1.5);
      ctx.stroke();
      ctx.strokeStyle = COLOR_LINE;
    }

    // Внутреннее посадочное отверстие
    ctx.strokeStyle = COLOR_LINE_BOLD;
    ctx.beginPath();
    ctx.arc(0, 0, boreR, 0, Math.PI * 2);
    ctx.stroke();

    drawCrosshair(ctx, r, 0);

    if (label) {
      drawDimLine(ctx, -pcdR, 0, pcdR, 0, label, -r * 1.12);
    }

    ctx.restore();
  }

  // Сетка миллиметровки (blueprint grid)
  function drawGrid(ctx, w, h, ox, oy) {
    ctx.save();
    ctx.lineWidth = 1;
    var stepSmall = 28;
    var stepBig = stepSmall * 5;

    // Мелкая сетка
    ctx.strokeStyle = COLOR_GRID_SUBTLE;
    ctx.beginPath();
    var startX = (ox % stepSmall) - stepSmall;
    for (var x = startX; x < w + stepSmall; x += stepSmall) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    var startY = (oy % stepSmall) - stepSmall;
    for (var y = startY; y < h + stepSmall; y += stepSmall) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    // Крупная сетка
    ctx.strokeStyle = COLOR_GRID_MAJOR;
    ctx.beginPath();
    var bigStartX = (ox % stepBig) - stepBig;
    for (var bx = bigStartX; bx < w + stepBig; bx += stepBig) {
      ctx.moveTo(bx, 0);
      ctx.lineTo(bx, h);
    }
    var bigStartY = (oy % stepBig) - stepBig;
    for (var by = bigStartY; by < h + stepBig; by += stepBig) {
      ctx.moveTo(0, by);
      ctx.lineTo(w, by);
    }
    ctx.stroke();

    ctx.restore();
  }

  // Список динамических машиностроительных деталей
  var allParts = [
    // Верхняя полоса (движение слева направо)
    { type: "gear", relY: 0.11, x: 80, vx: 0.32, r: 62, teeth: 18, angle: 0, vAngle: 0.0035, label: "Ø124" },
    { type: "cutter", relY: 0.08, x: 250, vx: 0.32, r: 52, teeth: 14, angle: 0.4, vAngle: -0.005, label: "Ø104" },
    { type: "shaft", relY: 0.14, x: 440, vx: 0.32, w: 150, h: 54, angle: -0.04, vAngle: 0 },
    { type: "flange", relY: 0.10, x: 670, vx: 0.32, r: 58, angle: 0.2, vAngle: 0.0025, label: "6 отв. Ø8" },
    { type: "gear", relY: 0.13, x: 860, vx: 0.32, r: 44, teeth: 13, angle: 1.1, vAngle: -0.006, label: "Ø88" },
    { type: "cutter", relY: 0.09, x: 1040, vx: 0.32, r: 68, teeth: 20, angle: 0.7, vAngle: 0.003, label: "Ø136" },
    { type: "shaft", relY: 0.12, x: 1260, vx: 0.32, w: 170, h: 60, angle: 0.02, vAngle: 0 },
    { type: "flange", relY: 0.11, x: 1510, vx: 0.32, r: 50, angle: 0.9, vAngle: -0.0035, label: "Ø100" },

    // Нижняя полоса (движение справа налево)
    { type: "gear", relY: 0.89, x: 100, vx: -0.28, r: 70, teeth: 22, angle: 0.2, vAngle: -0.0028, label: "m=2.5 z=22" },
    { type: "shaft", relY: 0.87, x: 310, vx: -0.28, w: 160, h: 58, angle: 0.05, vAngle: 0 },
    { type: "cutter", relY: 0.91, x: 530, vx: -0.28, r: 56, teeth: 16, angle: 0.8, vAngle: 0.004, label: "R=56" },
    { type: "flange", relY: 0.88, x: 730, vx: -0.28, r: 64, angle: 1.4, vAngle: -0.003, label: "Ø128" },
    { type: "gear", relY: 0.92, x: 940, vx: -0.28, r: 48, teeth: 15, angle: 0.5, vAngle: 0.005, label: "Ø96" },
    { type: "shaft", relY: 0.89, x: 1150, vx: -0.28, w: 140, h: 50, angle: -0.03, vAngle: 0 },
    { type: "cutter", relY: 0.86, x: 1370, vx: -0.28, r: 62, teeth: 18, angle: 1.2, vAngle: -0.0038, label: "Ø124" },
    { type: "flange", relY: 0.91, x: 1580, vx: -0.28, r: 54, angle: 0.1, vAngle: 0.004, label: "4 отв. M8" },

    // Фоновые крупные детали по бокам (мягкий дрейф)
    { type: "gear", relY: 0.48, x: -60, vx: 0.12, r: 120, teeth: 32, angle: 0, vAngle: 0.0012, label: "Ø240", faint: true },
    { type: "flange", relY: 0.52, x: 1750, vx: -0.15, r: 130, angle: 0, vAngle: -0.0014, label: "Ø260", faint: true }
  ];

  function pickParts() {
    var w = window.innerWidth || 1024;
    if (w < 480) {
      return allParts.filter(function (p, i) {
        return !p.faint && i % 3 === 0;
      });
    }
    if (w < 800) {
      return allParts.filter(function (p, i) {
        return !p.faint && i % 2 === 0;
      });
    }
    return allParts.slice();
  }

  var parts = pickParts();
  var reducedMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var scrollOffset = 0;
  var running = true;

  function render() {
    if (!running) return;
    requestAnimationFrame(render);

    if (reducedMotion) {
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);
      drawGrid(ctx, width, height, 0, 0);
      ctx.restore();
      running = false;
      return;
    }

    // Плавное следование за курсором
    pointerX += (targetPX - pointerX) * 0.04;
    pointerY += (targetPY - pointerY) * 0.04;

    scrollOffset += 0.2;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // 1. Отрисовка инженерной сетки-миллиметровки
    var gridOx = pointerX * 16 + scrollOffset * 0.25;
    var gridOy = pointerY * 12;
    drawGrid(ctx, width, height, gridOx, gridOy);

    // Границы замкнутого цикла по горизонтали
    var totalSpan = Math.max(width + 600, 1900);

    // 2. Отрисовка движущихся чертежных деталей
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];

      // Движение
      p.x += p.vx;
      p.angle += p.vAngle;

      // Бесшовный перезапуск по горизонтали
      if (p.vx > 0 && p.x > totalSpan) {
        p.x = -250;
      } else if (p.vx < 0 && p.x < -250) {
        p.x = totalSpan;
      }

      var posX = p.x + pointerX * (p.faint ? 25 : 12);
      var posY = height * p.relY + pointerY * (p.faint ? 18 : 8);

      ctx.save();
      ctx.translate(posX, posY);

      if (p.faint) {
        ctx.globalAlpha = 0.45;
      }

      if (p.type === "gear") {
        drawGear(ctx, p.r, p.teeth, p.angle, p.label);
      } else if (p.type === "cutter") {
        drawCutter(ctx, p.r, p.teeth, p.angle, p.label);
      } else if (p.type === "shaft") {
        drawShaftAssembly(ctx, p.w, p.h, p.angle);
      } else if (p.type === "flange") {
        drawFlange(ctx, p.r, p.angle, p.label);
      }

      ctx.restore();
    }

    ctx.restore();
  }

  render();
})();
