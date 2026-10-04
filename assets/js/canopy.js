/* Falling canopy for the "Your whole day on one screen" section.
   Ported from Originkit's LeafDrift (React) to plain WebGL, with the leaves
   replaced by small BlueLog logs drawn in the artwork's own colours
   (assets/img/bluelog-illustration.svg), the same in light and dark mode.

   Originkit preset was density 200, speed 8; halved to 100 and 4. Direction 360,
   cursor push 0 (so all pointer handling was dropped). */
(function () {
  'use strict';

  var section = document.getElementById('showcase');
  var canvas = section && section.querySelector('.showcase__canopy');
  if (!canvas) return;

  var CFG = {
    density: 100,
    speed: 4,
    direction: 360 * Math.PI / 180,
    size: 32 / 1000,
    spin: 0.98,
    sway: 0.5,
    spread: 1,
    opacity: 0.85,
    sprite: 'assets/img/bluelog-illustration.svg'
  };
  var TRAVEL = 0.55 * 2;
  var DRAG = 1.7;
  var SPIN_MAX = 2.6;
  var SWAY_RATE = 2.2;
  var SIZE_JITTER = 0.75;
  var MAX_DPR = 2;

  var gl = canvas.getContext('webgl', {
    alpha: true, premultipliedAlpha: true, antialias: false, depth: false
  });
  if (!gl) return;

  var VERT =
    'attribute vec2 aCorner; attribute vec2 aPos; attribute float aAngle;' +
    'attribute float aSize; uniform float uAspect; varying vec2 vUv;' +
    'void main(){' +
    ' float c=cos(aAngle), s=sin(aAngle);' +
    ' vec2 off=vec2(aCorner.x*c-aCorner.y*s, aCorner.x*s+aCorner.y*c)*aSize;' +
    ' vec2 p=aPos+off;' +
    ' gl_Position=vec4(p.x/max(uAspect,0.0001), p.y, 0.0, 1.0);' +
    ' vUv=vec2(aCorner.x*0.5+0.5, 0.5-aCorner.y*0.5);' +
    '}';
  var FRAG =
    'precision mediump float; uniform sampler2D uTex; uniform float uOpacity;' +
    'varying vec2 vUv;' +
    'void main(){' +
    ' vec4 t=texture2D(uTex,vUv)*uOpacity;' +
    ' if(t.a<0.003) discard;' +
    ' gl_FragColor=t;' +
    '}';

  function compile(type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error('Canopy shader:', gl.getShaderInfoLog(sh));
      return null;
    }
    return sh;
  }
  var vs = compile(gl.VERTEX_SHADER, VERT);
  var fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;
  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('Canopy link:', gl.getProgramInfoLog(prog));
    return;
  }
  gl.useProgram(prog);

  var loc = {
    corner: gl.getAttribLocation(prog, 'aCorner'),
    pos: gl.getAttribLocation(prog, 'aPos'),
    angle: gl.getAttribLocation(prog, 'aAngle'),
    size: gl.getAttribLocation(prog, 'aSize'),
    aspect: gl.getUniformLocation(prog, 'uAspect'),
    tex: gl.getUniformLocation(prog, 'uTex'),
    opacity: gl.getUniformLocation(prog, 'uOpacity')
  };

  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  /* --- Sprite: the log artwork, full colour, in a square texture -------- */
  var spriteReady = false;
  function uploadSprite(img) {
    var size = 256, pad = 12;
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var g = c.getContext('2d');
    var w = size - pad * 2;
    var h = w * (img.naturalHeight / img.naturalWidth);
    g.drawImage(img, pad, (size - h) / 2, w, h);

    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    spriteReady = true;
  }

  /* --- Particles -------------------------------------------------------- */
  var N = CFG.density;
  var px = new Float32Array(N), py = new Float32Array(N);
  var vx = new Float32Array(N), vy = new Float32Array(N);
  var ang = new Float32Array(N), spn = new Float32Array(N);
  var sz = new Float32Array(N);
  var swPh = new Float32Array(N), swRt = new Float32Array(N);
  var seeded = false;

  var rs = 0xbeef >>> 0;
  function rand() {
    rs = (rs * 1664525 + 1013904223) >>> 0;
    return rs / 4294967296;
  }

  var dx = Math.sin(CFG.direction);
  var dy = -Math.cos(CFG.direction);
  var ppx = dy, ppy = -dx;

  var aspect = 1, bufW = 0, bufH = 0;

  function respawn(i, R, spreadHalf, firstFill) {
    var along = firstFill ? (rand() * 2 - 1) * R : -R;
    var across = (rand() * 2 - 1) * spreadHalf;
    px[i] = dx * along + ppx * across;
    py[i] = dy * along + ppy * across;
    vx[i] = 0;
    vy[i] = 0;
    ang[i] = rand() * Math.PI * 2;
    spn[i] = (rand() * 2 - 1) * SPIN_MAX;
    sz[i] = 1 - SIZE_JITTER * 0.5 + SIZE_JITTER * rand();
    swPh[i] = rand() * Math.PI * 2;
    swRt[i] = 0.6 + rand() * 0.9;
  }

  var clock = 0;
  function step(rawDt) {
    var dt = rawDt * (CFG.speed / 50);
    clock += dt;
    var R = Math.hypot(aspect, 1) + 0.12;
    var spreadHalf = CFG.spread * Math.hypot(aspect, 1);
    if (!seeded) {
      for (var k = 0; k < N; k++) respawn(k, R, spreadHalf, true);
      seeded = true;
    }
    for (var i = 0; i < N; i++) {
      var s = Math.sin(clock * SWAY_RATE * swRt[i] + swPh[i]) * CFG.sway;
      var ax = (dx * TRAVEL + ppx * s - vx[i]) * DRAG;
      var ay = (dy * TRAVEL + ppy * s - vy[i]) * DRAG;
      vx[i] += ax * dt;
      vy[i] += ay * dt;
      px[i] += vx[i] * dt;
      py[i] += vy[i] * dt;
      ang[i] += (spn[i] * CFG.spin + (vx[i] * ppx + vy[i] * ppy) * 1.6) * dt;
      var along = px[i] * dx + py[i] * dy;
      var across = px[i] * ppx + py[i] * ppy;
      if (along > R || Math.abs(across) > spreadHalf + R) respawn(i, R, spreadHalf, false);
    }
  }

  var STRIDE = 6;
  var data = new Float32Array(N * 6 * STRIDE);
  var buf = gl.createBuffer();
  var CORNERS = [-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1];

  function draw() {
    var w = 0;
    for (var i = 0; i < N; i++) {
      var size = sz[i] * CFG.size;
      for (var k = 0; k < 6; k++) {
        data[w++] = CORNERS[k * 2];
        data[w++] = CORNERS[k * 2 + 1];
        data[w++] = px[i];
        data[w++] = py[i];
        data[w++] = ang[i];
        data[w++] = size;
      }
    }
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    var S = STRIDE * 4;
    gl.enableVertexAttribArray(loc.corner);
    gl.vertexAttribPointer(loc.corner, 2, gl.FLOAT, false, S, 0);
    gl.enableVertexAttribArray(loc.pos);
    gl.vertexAttribPointer(loc.pos, 2, gl.FLOAT, false, S, 8);
    gl.enableVertexAttribArray(loc.angle);
    gl.vertexAttribPointer(loc.angle, 1, gl.FLOAT, false, S, 16);
    gl.enableVertexAttribArray(loc.size);
    gl.vertexAttribPointer(loc.size, 1, gl.FLOAT, false, S, 20);
    gl.uniform1f(loc.aspect, aspect);
    gl.uniform1i(loc.tex, 0);
    gl.uniform1f(loc.opacity, CFG.opacity);
    gl.drawArrays(gl.TRIANGLES, 0, N * 6);
    canvas.classList.add('is-ready');
  }

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    var bw = Math.round(canvas.clientWidth * dpr);
    var bh = Math.round(canvas.clientHeight * dpr);
    if (bw < 1 || bh < 1 || (bw === bufW && bh === bufH)) return false;
    bufW = bw;
    bufH = bh;
    aspect = bw / bh;
    canvas.width = bw;
    canvas.height = bh;
    gl.viewport(0, 0, bw, bh);
    return true;
  }

  /* --- Run only while useful: in view, desktop width, motion allowed ---- */
  var wide = window.matchMedia('(min-width: 901px)');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var visible = false, running = false, raf = 0, last = 0;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    resize();
    step(dt);
    draw();
  }
  function start() {
    if (running) return;
    running = true;
    last = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }
  function update() {
    if (!(spriteReady && visible && wide.matches)) { stop(); return; }
    if (reduced.matches) {
      stop();
      resize();
      step(0);
      draw();           // one still frame, no motion
    } else {
      start();
    }
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      update();
    }).observe(section);
  }
  wide.addEventListener('change', update);
  reduced.addEventListener('change', update);
  if ('ResizeObserver' in window) {
    new ResizeObserver(function () {
      if (resize() && reduced.matches && spriteReady && visible && wide.matches) {
        step(0);
        draw();
      }
    }).observe(canvas);
  }

  var img = new Image();
  img.onload = function () { uploadSprite(img); update(); };
  img.src = CFG.sprite;
})();
