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

  var amb = new THREE.AmbientLight(0x455038, 0.4);
  scene.add(amb);

  var dir1 = new THREE.DirectionalLight(0xf4dce2, 0.6);
  dir1.position.set(5, 8, 10);
  scene.add(dir1);

  var dir2 = new THREE.DirectionalLight(0x38452d, 0.4);
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
    color: 0x8c9676,
    metalness: 0.7,
    roughness: 0.5,
    transparent: true,
    opacity: 0.16,
  });

  var mat2 = new THREE.MeshStandardMaterial({
    color: 0x58634a,
    metalness: 0.65,
    roughness: 0.6,
    transparent: true,
    opacity: 0.14,
  });

  var mat3 = new THREE.MeshStandardMaterial({
    color: 0x9e7c87,
    metalness: 0.7,
    roughness: 0.55,
    transparent: true,
    opacity: 0.16,
  });

  var group = new THREE.Group();
  group.scale.set(0.55, 0.55, 0.55);
  scene.add(group);

  var g1 = new THREE.Mesh(
    createGearGeometry({ teeth: 16, rOut: 2.5, rIn: 2.1, rHole: 0.8, depth: 0.35 }),
    mat1
  );
  g1.position.set(-9.5, 6.0, -2);
  g1.rotation.x = 0.35;
  g1.rotation.y = -0.3;
  group.add(g1);

  var g2 = new THREE.Mesh(
    createGearGeometry({ teeth: 10, rOut: 1.6, rIn: 1.3, rHole: 0.55, depth: 0.3 }),
    mat2
  );
  g2.position.set(-6.2, 7.8, -3);
  g2.rotation.x = 0.35;
  g2.rotation.y = -0.3;
  group.add(g2);

  var g3 = new THREE.Mesh(
    createGearGeometry({ teeth: 18, rOut: 3.0, rIn: 2.5, rHole: 0.95, depth: 0.4 }),
    mat3
  );
  g3.position.set(10.0, -5.5, -2);
  g3.rotation.x = -0.25;
  g3.rotation.y = 0.4;
  group.add(g3);

  var g4 = new THREE.Mesh(
    createGearGeometry({ teeth: 12, rOut: 1.9, rIn: 1.55, rHole: 0.65, depth: 0.3 }),
    mat1
  );
  g4.position.set(7.5, -1.8, -4);
  g4.rotation.x = -0.25;
  g4.rotation.y = 0.4;
  group.add(g4);

  var g5 = new THREE.Mesh(
    createGearGeometry({ teeth: 8, rOut: 1.25, rIn: 1.0, rHole: 0.4, depth: 0.25 }),
    mat2
  );
  g5.position.set(-8.5, -7.5, -3);
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

    g1.rotation.z = t * 0.12;
    g2.rotation.z = -t * 0.19 + 0.15;
    g3.rotation.z = -t * 0.09;
    g4.rotation.z = t * 0.14 + 0.2;
    g5.rotation.z = t * 0.16;

    group.position.x += (pointerX * 0.3 - group.position.x) * 0.02;
    group.position.y += (-pointerY * 0.2 - group.position.y) * 0.02;

    renderer.render(scene, camera);
  }
  animate();
})();
