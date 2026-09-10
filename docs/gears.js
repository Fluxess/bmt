(function () {
  if (typeof THREE === "undefined") return;

  var canvas = document.getElementById("gears-bg");
  if (!canvas) return;

  var renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 18);

  var amb = new THREE.AmbientLight(0x38bdf8, 0.45);
  scene.add(amb);

  var dir1 = new THREE.DirectionalLight(0xffffff, 1.1);
  dir1.position.set(5, 8, 10);
  scene.add(dir1);

  var dir2 = new THREE.DirectionalLight(0x0ea5e9, 0.6);
  dir2.position.set(-6, -4, -4);
  scene.add(dir2);

  function createGearGeometry(opts) {
    var teeth = opts.teeth || 12;
    var rOut = opts.rOut || 3.0;
    var rIn = opts.rIn || 2.4;
    var rHole = opts.rHole || 0.9;
    var toothH = opts.toothH || 0.55;
    var depth = opts.depth || 0.45;

    var shape = new THREE.Shape();
    var step = (Math.PI * 2) / teeth;
    var tSpan = step * 0.42;

    for (var i = 0; i < teeth; i++) {
      var a0 = i * step;
      var a1 = a0 + tSpan * 0.25;
      var a2 = a0 + tSpan * 0.75;
      var a3 = a0 + tSpan;
      var aNext = (i + 1) * step;

      var rTip = rOut + toothH;

      if (i === 0) {
        shape.moveTo(Math.cos(a0) * rIn, Math.sin(a0) * rIn);
      } else {
        shape.lineTo(Math.cos(a0) * rIn, Math.sin(a0) * rIn);
      }
      shape.lineTo(Math.cos(a1) * rTip, Math.sin(a1) * rTip);
      shape.lineTo(Math.cos(a2) * rTip, Math.sin(a2) * rTip);
      shape.lineTo(Math.cos(a3) * rIn, Math.sin(a3) * rIn);
      shape.lineTo(Math.cos(aNext) * rIn, Math.sin(aNext) * rIn);
    }

    var hole = new THREE.Path();
    var holeSegs = 32;
    for (var h = 0; h <= holeSegs; h++) {
      var ah = (h / holeSegs) * Math.PI * 2;
      var hx = Math.cos(ah) * rHole;
      var hy = Math.sin(ah) * rHole;
      if (h === 0) hole.moveTo(hx, hy);
      else hole.lineTo(hx, hy);
    }
    shape.holes.push(hole);

    var spokes = 4;
    var spokeR = (rIn + rHole) * 0.5;
    var spokeSlotR = (rIn - rHole) * 0.28;
    for (var s = 0; s < spokes; s++) {
      var sa = (s / spokes) * Math.PI * 2;
      var cx = Math.cos(sa) * spokeR;
      var cy = Math.sin(sa) * spokeR;
      var spokeHole = new THREE.Path();
      for (var sh = 0; sh <= 16; sh++) {
        var sha = (sh / 16) * Math.PI * 2;
        var sx = cx + Math.cos(sha) * spokeSlotR;
        var sy = cy + Math.sin(sha) * spokeSlotR;
        if (sh === 0) spokeHole.moveTo(sx, sy);
        else spokeHole.lineTo(sx, sy);
      }
      shape.holes.push(spokeHole);
    }

    var extrudeSettings = {
      depth: depth,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.08,
      bevelThickness: 0.08,
    };

    var geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.center();
    return geo;
  }

  var mat1 = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    metalness: 0.85,
    roughness: 0.35,
    transparent: true,
    opacity: 0.5,
  });

  var mat2 = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    metalness: 0.9,
    roughness: 0.3,
    transparent: true,
    opacity: 0.45,
  });

  var mat3 = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    metalness: 0.8,
    roughness: 0.4,
    transparent: true,
    opacity: 0.4,
  });

  var group = new THREE.Group();
  scene.add(group);

  var g1 = new THREE.Mesh(
    createGearGeometry({ teeth: 16, rOut: 2.8, rIn: 2.3, rHole: 0.85, depth: 0.4 }),
    mat1
  );
  g1.position.set(-5.5, 4.0, -3);
  g1.rotation.x = 0.35;
  g1.rotation.y = -0.3;
  group.add(g1);

  var g2 = new THREE.Mesh(
    createGearGeometry({ teeth: 10, rOut: 1.8, rIn: 1.45, rHole: 0.6, depth: 0.35 }),
    mat2
  );
  g2.position.set(-2.0, 5.8, -4);
  g2.rotation.x = 0.35;
  g2.rotation.y = -0.3;
  group.add(g2);

  var g3 = new THREE.Mesh(
    createGearGeometry({ teeth: 20, rOut: 3.6, rIn: 3.0, rHole: 1.1, depth: 0.45 }),
    mat3
  );
  g3.position.set(6.0, -3.5, -2);
  g3.rotation.x = -0.25;
  g3.rotation.y = 0.4;
  group.add(g3);

  var g4 = new THREE.Mesh(
    createGearGeometry({ teeth: 12, rOut: 2.1, rIn: 1.7, rHole: 0.7, depth: 0.35 }),
    mat1
  );
  g4.position.set(4.0, 1.2, -5);
  g4.rotation.x = -0.25;
  g4.rotation.y = 0.4;
  group.add(g4);

  var g5 = new THREE.Mesh(
    createGearGeometry({ teeth: 8, rOut: 1.4, rIn: 1.1, rHole: 0.45, depth: 0.3 }),
    mat2
  );
  g5.position.set(-4.5, -5.5, -4);
  g5.rotation.x = 0.2;
  g5.rotation.y = -0.2;
  group.add(g5);

  function resize() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  window.addEventListener("resize", resize);
  resize();

  var pointerX = 0;
  var pointerY = 0;
  window.addEventListener("pointermove", function (e) {
    pointerX = (e.clientX / window.innerWidth - 0.5) * 2;
    pointerY = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  var clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    var t = clock.getElapsedTime();

    g1.rotation.z = t * 0.25;
    g2.rotation.z = -t * 0.4 + 0.15;
    g3.rotation.z = -t * 0.18;
    g4.rotation.z = t * 0.3 + 0.2;
    g5.rotation.z = t * 0.35;

    group.position.x += (pointerX * 0.4 - group.position.x) * 0.03;
    group.position.y += (-pointerY * 0.3 - group.position.y) * 0.03;

    renderer.render(scene, camera);
  }
  animate();
})();
