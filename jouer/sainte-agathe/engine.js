/* Sainte-Agathe — moteur : géométrie, matériaux, collisions, navigation (version web du jeu Roblox) */
'use strict';
const ENG = {};
(function () {
  const T = THREE;
  const MATS = ['plastic', 'neon', 'wood', 'tile', 'concrete', 'brick', 'rust', 'metal', 'grass', 'ground', 'fabric', 'glass', 'plaster'];
  ENG.MATS = MATS;

  /* ---------------- textures procédurales (gris, multipliées par la couleur de la pièce) ---------------- */
  function rnd(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  function tex(kind) {
    const N = 128, c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d'), R = rnd(kind.length * 977 + 13);
    const base = { plaster: 222, tile: 232, wood: 200, concrete: 205, brick: 200, rust: 200, metal: 225, grass: 200, ground: 200, fabric: 222, plastic: 235, glass: 255, neon: 255 }[kind] || 230;
    g.fillStyle = `rgb(${base},${base},${base})`; g.fillRect(0, 0, N, N);
    const id = g.getImageData(0, 0, N, N), d = id.data;
    const amp = { plaster: 22, tile: 10, wood: 18, concrete: 34, brick: 24, rust: 50, metal: 14, grass: 40, ground: 40, fabric: 16, plastic: 8 }[kind] || 10;
    for (let i = 0; i < N * N; i++) { const n = (R() - 0.5) * amp; d[i * 4] += n; d[i * 4 + 1] += n; d[i * 4 + 2] += n; }
    g.putImageData(id, 0, 0);
    g.globalAlpha = 1;
    if (kind === 'tile') { g.strokeStyle = 'rgba(70,70,70,.55)'; g.lineWidth = 2; for (let k = 0; k <= N; k += 32) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, N); g.moveTo(0, k); g.lineTo(N, k); g.stroke(); } }
    if (kind === 'wood') { for (let k = 0; k < 30; k++) { g.strokeStyle = `rgba(60,40,20,${0.08 + R() * 0.12})`; g.beginPath(); const y = R() * N; g.moveTo(0, y); g.bezierCurveTo(N / 3, y + R() * 8 - 4, 2 * N / 3, y + R() * 8 - 4, N, y); g.stroke(); } g.fillStyle = 'rgba(40,25,10,.35)'; for (let k = 0; k < N; k += 32) g.fillRect(0, k, N, 1.5); }
    if (kind === 'brick') { g.fillStyle = 'rgba(80,80,80,.5)'; for (let y = 0; y < N; y += 16) { g.fillRect(0, y, N, 2); for (let x = (y / 16) % 2 ? 16 : 0; x < N; x += 32) g.fillRect(x, y, 2, 16); } }
    if (kind === 'plaster' || kind === 'concrete') { for (let k = 0; k < 7; k++) { g.fillStyle = `rgba(60,55,40,${0.05 + R() * 0.12})`; g.beginPath(); g.ellipse(R() * N, R() * N, 6 + R() * 26, 4 + R() * 18, R() * 3, 0, 7); g.fill(); }
      for (let k = 0; k < 3; k++) { g.strokeStyle = 'rgba(40,40,40,.35)'; g.lineWidth = 0.8; g.beginPath(); let x = R() * N, y = R() * N; g.moveTo(x, y); for (let j = 0; j < 6; j++) { x += R() * 14 - 7; y += R() * 14; g.lineTo(x, y); } g.stroke(); } }
    if (kind === 'rust') { for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(${90 + R() * 60},${40 + R() * 30},10,${0.15 + R() * 0.25})`; g.beginPath(); g.arc(R() * N, R() * N, 1 + R() * 7, 0, 7); g.fill(); } }
    if (kind === 'metal') { for (let k = 0; k < 60; k++) { g.strokeStyle = `rgba(255,255,255,${R() * 0.06})`; g.beginPath(); const y = R() * N; g.moveTo(0, y); g.lineTo(N, y + R() * 2); g.stroke(); } }
    if (kind === 'fabric') { g.strokeStyle = 'rgba(0,0,0,.06)'; for (let k = 0; k < N; k += 3) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, N); g.stroke(); } }
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; return t;
  }

  /* ---------------- géométrie des pièces ---------------- */
  // rec = [shape, x,y,z, r00..r22, sx,sy,sz, color, mat, transp, flags, grp, name]
  ENG.matOf = (r) => { const m = new T.Matrix4(); m.set(r[4], r[5], r[6], r[1], r[7], r[8], r[9], r[2], r[10], r[11], r[12], r[3], 0, 0, 0, 1); return m; };
  function Buf() { return { p: [], n: [], u: [], c: [], idx: [], vc: 0 }; }
  const v = new T.Vector3(), nn = new T.Vector3();
  function addVert(B, M, NM, x, y, z, nx, ny, nz, u, w, col) {
    v.set(x, y, z).applyMatrix4(M); nn.set(nx, ny, nz).applyMatrix3(NM).normalize();
    B.p.push(v.x, v.y, v.z); B.n.push(nn.x, nn.y, nn.z); B.u.push(u, w); B.c.push(col[0], col[1], col[2]); return B.vc++;
  }
  function quad(B, M, NM, a, b, c, d, n, uvs, col) {
    const i0 = addVert(B, M, NM, ...a, ...n, ...uvs[0], col), i1 = addVert(B, M, NM, ...b, ...n, ...uvs[1], col);
    const i2 = addVert(B, M, NM, ...c, ...n, ...uvs[2], col), i3 = addVert(B, M, NM, ...d, ...n, ...uvs[3], col);
    B.idx.push(i0, i1, i2, i0, i2, i3);
  }
  const TS = 0.25; // 1 répétition de texture tous les 4 studs
  function box(B, M, NM, hx, hy, hz, col) {
    const X = hx, Y = hy, Z = hz, s = TS;
    quad(B, M, NM, [X, -Y, Z], [X, -Y, -Z], [X, Y, -Z], [X, Y, Z], [1, 0, 0], [[-Z * s, -Y * s], [Z * s, -Y * s], [Z * s, Y * s], [-Z * s, Y * s]], col);
    quad(B, M, NM, [-X, -Y, -Z], [-X, -Y, Z], [-X, Y, Z], [-X, Y, -Z], [-1, 0, 0], [[-Z * s, -Y * s], [Z * s, -Y * s], [Z * s, Y * s], [-Z * s, Y * s]], col);
    quad(B, M, NM, [-X, Y, Z], [X, Y, Z], [X, Y, -Z], [-X, Y, -Z], [0, 1, 0], [[-X * s, Z * s], [X * s, Z * s], [X * s, -Z * s], [-X * s, -Z * s]], col);
    quad(B, M, NM, [-X, -Y, -Z], [X, -Y, -Z], [X, -Y, Z], [-X, -Y, Z], [0, -1, 0], [[-X * s, -Z * s], [X * s, -Z * s], [X * s, Z * s], [-X * s, Z * s]], col);
    quad(B, M, NM, [-X, -Y, Z], [X, -Y, Z], [X, Y, Z], [-X, Y, Z], [0, 0, 1], [[-X * s, -Y * s], [X * s, -Y * s], [X * s, Y * s], [-X * s, Y * s]], col);
    quad(B, M, NM, [X, -Y, -Z], [-X, -Y, -Z], [-X, Y, -Z], [X, Y, -Z], [0, 0, -1], [[-X * s, -Y * s], [X * s, -Y * s], [X * s, Y * s], [-X * s, Y * s]], col);
  }
  function wedge(B, M, NM, hx, hy, hz, col) {
    const s = TS;
    // fond (y-), arrière vertical (+Z), pente de (y-,-Z) à (y+,+Z), deux flancs
    quad(B, M, NM, [-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz], [0, -1, 0], [[0, 0], [hx * 2 * s, 0], [hx * 2 * s, hz * 2 * s], [0, hz * 2 * s]], col);
    quad(B, M, NM, [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz], [0, 0, 1], [[0, 0], [hx * 2 * s, 0], [hx * 2 * s, hy * 2 * s], [0, hy * 2 * s]], col);
    const L = Math.hypot(2 * hy, 2 * hz), ny = 2 * hz / L, nz = -2 * hy / L;
    quad(B, M, NM, [hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, hz], [hx, hy, hz], [0, ny, nz], [[0, 0], [hx * 2 * s, 0], [hx * 2 * s, L * s], [0, L * s]], col);
    for (const sx of [-1, 1]) {
      const a = addVert(B, M, NM, sx * hx, -hy, -hz, sx, 0, 0, 0, 0, col), b2 = addVert(B, M, NM, sx * hx, -hy, hz, sx, 0, 0, hz * 2 * s, 0, col), c = addVert(B, M, NM, sx * hx, hy, hz, sx, 0, 0, hz * 2 * s, hy * 2 * s, col);
      if (sx > 0) B.idx.push(a, c, b2); else B.idx.push(a, b2, c);
    }
  }
  function cyl(B, M, NM, axis, h, rx, ry, col, seg) {
    // axe 'x' (cylindre Roblox) ou 'y' (maillage Head) ; ellipse de rayons rx, ry
    seg = seg || 12; const P = (a, t, r1, r2) => axis === 'x' ? [a, Math.cos(t) * r1, Math.sin(t) * r2] : [Math.cos(t) * r1, a, Math.sin(t) * r2];
    const Nn = (a, t) => axis === 'x' ? [a, Math.cos(t), Math.sin(t)] : [Math.cos(t), a, Math.sin(t)];
    for (let i = 0; i < seg; i++) {
      const t0 = i / seg * Math.PI * 2, t1 = (i + 1) / seg * Math.PI * 2;
      const a = addVert(B, M, NM, ...P(-h, t0, rx, ry), ...Nn(0, t0), i / seg * 2, 0, col), b2 = addVert(B, M, NM, ...P(h, t0, rx, ry), ...Nn(0, t0), i / seg * 2, h * 2 * TS, col);
      const c = addVert(B, M, NM, ...P(h, t1, rx, ry), ...Nn(0, t1), (i + 1) / seg * 2, h * 2 * TS, col), d = addVert(B, M, NM, ...P(-h, t1, rx, ry), ...Nn(0, t1), (i + 1) / seg * 2, 0, col);
      if (axis === 'x') B.idx.push(a, c, b2, a, d, c); else B.idx.push(a, b2, c, a, c, d);
      for (const sgn of [-1, 1]) {
        const ce = addVert(B, M, NM, ...(axis === 'x' ? [sgn * h, 0, 0] : [0, sgn * h, 0]), ...(axis === 'x' ? [sgn, 0, 0] : [0, sgn, 0]), 0.5, 0.5, col);
        const e0 = addVert(B, M, NM, ...P(sgn * h, t0, rx, ry), ...(axis === 'x' ? [sgn, 0, 0] : [0, sgn, 0]), 0.5 + Math.cos(t0) / 2, 0.5 + Math.sin(t0) / 2, col);
        const e1 = addVert(B, M, NM, ...P(sgn * h, t1, rx, ry), ...(axis === 'x' ? [sgn, 0, 0] : [0, sgn, 0]), 0.5 + Math.cos(t1) / 2, 0.5 + Math.sin(t1) / 2, col);
        if ((sgn > 0) === (axis === 'x')) B.idx.push(ce, e0, e1); else B.idx.push(ce, e1, e0);
      }
    }
  }
  function ellipsoid(B, M, NM, rx, ry, rz, col, seg) {
    seg = seg || 10; const rings = Math.max(6, seg - 2), base = B.vc;
    for (let i = 0; i <= rings; i++) {
      const ph = i / rings * Math.PI;
      for (let j = 0; j <= seg; j++) {
        const th = j / seg * Math.PI * 2, x = Math.sin(ph) * Math.cos(th), y = Math.cos(ph), z = Math.sin(ph) * Math.sin(th);
        addVert(B, M, NM, x * rx, y * ry, z * rz, x / rx, y / ry, z / rz, j / seg * 2, i / rings, col);
      }
    }
    for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) {
      const a = base + i * (seg + 1) + j, b2 = a + seg + 1;
      B.idx.push(a, a + 1, b2, a + 1, b2 + 1, b2);
    }
  }
  const srgb = (x) => Math.pow(x / 255, 2.0);
  ENG.colOf = (c) => [srgb((c >> 16) & 255), srgb((c >> 8) & 255), srgb(c & 255)];
  ENG.addPart = function (B, r, M0, colOverride) {
    const M = M0 || ENG.matOf(r); const NM = new T.Matrix3().getNormalMatrix(M);
    const sx = r[13], sy = r[14], sz = r[15], col = colOverride || ENG.colOf(r[16]);
    switch (r[0]) {
      case 0: if (sx === sy && sy === sz) ellipsoid(B, M, NM, sx / 2, sx / 2, sx / 2, col, 10); else ellipsoid(B, M, NM, sx / 2, sy / 2, sz / 2, col, 10); break;
      case 2: { const d = Math.min(sy, sz) / 2; cyl(B, M, NM, 'x', sx / 2, d, d, col, d > 1.5 ? 18 : 10); break; }
      case 3: wedge(B, M, NM, sx / 2, sy / 2, sz / 2, col); break;
      case 4: cyl(B, M, NM, 'y', sy / 2, sx / 2, sz / 2, col, 12); break;
      default: box(B, M, NM, sx / 2, sy / 2, sz / 2, col);
    }
  };
  ENG.Buf = Buf;
  ENG.toGeo = function (B) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(B.p, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(B.n, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(B.u, 2));
    g.setAttribute('color', new T.Float32BufferAttribute(B.c, 3));
    g.setIndex(B.vc > 65535 ? new T.Uint32BufferAttribute(B.idx, 1) : new T.Uint16BufferAttribute(B.idx, 1));
    g.computeBoundingSphere(); return g;
  };

  /* ---------------- matériaux ---------------- */
  const TEX = {};
  ENG.material = function (mat, opacity) {
    if (mat === 'neon') return new T.MeshBasicMaterial({ vertexColors: true, transparent: opacity < 1, opacity, fog: true });
    if (!TEX[mat]) TEX[mat] = tex(mat);
    const shin = { tile: 40, metal: 30, glass: 60, plastic: 12, rust: 4 }[mat] || 3;
    const spec = { tile: 0x2a2a2a, metal: 0x303030, glass: 0x555555, plastic: 0x151515 }[mat] || 0x050505;
    return new T.MeshPhongMaterial({ vertexColors: true, map: TEX[mat], shininess: shin, specular: spec, transparent: opacity < 1, opacity, depthWrite: opacity > 0.6, side: opacity < 1 ? T.DoubleSide : T.FrontSide });
  };

  /* ---------------- monde de collision : OBB + grille ---------------- */
  // Chaque OBB : c (centre), axes (colonnes de R), h (demi-tailles), type : 0 mur droit (un axe vertical), 1 rampe/incliné, 2 coin (wedge)
  const CELL = 8;
  ENG.World = function () {
    this.obbs = []; this.grid = new Map();
  };
  ENG.World.prototype.add = function (r, grp) {
    const R = [r[4], r[5], r[6], r[7], r[8], r[9], r[10], r[11], r[12]];
    const h = [r[13] / 2, r[14] / 2, r[15] / 2];
    if (r[0] === 2) { const d = Math.min(r[14], r[15]) / 2; h[1] = h[2] = d; }
    if (r[0] === 0 && r[13] === r[14]) { /* boule */ }
    // axe vertical ?
    let up = -1; for (let k = 0; k < 3; k++) if (Math.abs(R[3 + k]) > 0.985) up = k;   // R10,R11,R12 = composantes Y des axes locaux X,Y,Z
    const o = { c: [r[1], r[2], r[3]], R, h, up, wedge: r[0] === 3, grp: grp || 0, on: true, id: this.obbs.length };
    // demi-étendue monde (AABB)
    const ex = [0, 0, 0];
    for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) ex[i] += Math.abs(R[i * 3 + k]) * h[k];
    o.min = [o.c[0] - ex[0], o.c[1] - ex[1], o.c[2] - ex[2]]; o.max = [o.c[0] + ex[0], o.c[1] + ex[1], o.c[2] + ex[2]];
    this.obbs.push(o);
    for (let gx = Math.floor(o.min[0] / CELL); gx <= Math.floor(o.max[0] / CELL); gx++)
      for (let gz = Math.floor(o.min[2] / CELL); gz <= Math.floor(o.max[2] / CELL); gz++) {
        const k = gx * 4096 + gz; let a = this.grid.get(k); if (!a) this.grid.set(k, a = []); a.push(o);
      }
    return o;
  };
  ENG.World.prototype.near = function (x, z, r, out) {
    out.length = 0; if (!isFinite(x) || !isFinite(z) || !(r < 200)) return out; const stamp = ++this._st || (this._st = 1);
    for (let gx = Math.floor((x - r) / CELL); gx <= Math.floor((x + r) / CELL); gx++)
      for (let gz = Math.floor((z - r) / CELL); gz <= Math.floor((z + r) / CELL); gz++) {
        const a = this.grid.get(gx * 4096 + gz); if (!a) continue;
        for (const o of a) if (o.on && o._s !== stamp) { o._s = stamp; out.push(o); }
      }
    return out;
  };
  // point monde -> local
  function toLocal(o, x, y, z, out) {
    const dx = x - o.c[0], dy = y - o.c[1], dz = z - o.c[2], R = o.R;
    out[0] = R[0] * dx + R[3] * dy + R[6] * dz; out[1] = R[1] * dx + R[4] * dy + R[7] * dz; out[2] = R[2] * dx + R[5] * dy + R[8] * dz; return out;
  }
  ENG.toLocal = toLocal;
  const L = [0, 0, 0], tmp = [];
  // hauteur du sol sous (x,z), en dessous de yMax ; -Infinity si rien
  ENG.World.prototype.ground = function (x, z, yMax, rad) {
    let best = -Infinity, bo = null; const list = this.near(x, z, rad || 0.6, tmp);
    for (const o of list) {
      if (o.min[1] > yMax) continue;
      const top = this.topAt(o, x, z, rad || 0);
      if (top !== null && top <= yMax + 1e-3 && top > best) { best = top; bo = o; }
    }
    this.lastGround = bo; return best;
  };
  // hauteur de la face supérieure de l'OBB à (x,z) (rayon vertical), ou null
  ENG.World.prototype.topAt = function (o, x, z, rad) {
    rad = rad || 0;
    if (x < o.min[0] - rad || x > o.max[0] + rad || z < o.min[2] - rad || z > o.max[2] + rad) return null;
    const R = o.R, h = o.h;
    if (o.up >= 0 && !o.wedge) {
      // boîte droite : test 2D dans le plan horizontal
      toLocal(o, x, o.c[1], z, L);
      for (let k = 0; k < 3; k++) if (k !== o.up && Math.abs(L[k]) > h[k] + rad) return null;
      return o.c[1] + h[o.up];
    }
    // cas général : rayon vertical descendant, méthode des dalles en repère local
    const top = o.max[1] + 1;
    toLocal(o, x, top, z, L);
    const d = [-R[3], -R[4], -R[5]]; // direction (0,-1,0) en local = -(ligne Y de R)
    let t0 = -Infinity, t1 = Infinity;
    for (let k = 0; k < 3; k++) {
      const hk = h[k] + (k !== 1 ? rad * 0.5 : 0);
      if (Math.abs(d[k]) < 1e-9) { if (Math.abs(L[k]) > hk) return null; continue; }
      let a = (-hk - L[k]) / d[k], b = (hk - L[k]) / d[k]; if (a > b) { const t = a; a = b; b = t; }
      if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 > t1) return null;
    }
    if (o.wedge) {
      // plan de la pente : y_l = (hy/hz) * z_l  -> intersection avec le rayon
      const k = h[1] / h[2];
      // y_l(t) = L1 + d1 t ; z_l(t) = L2 + d2 t ; y - k z = 0
      const den = d[1] - k * d[2]; if (Math.abs(den) < 1e-9) return null;
      const t = (k * L[2] - L[1]) / den;
      if (t > t1 + 1e-6) return null;
      return top - Math.max(t, t0);
    }
    return top - t0;
  };
  // pousse un cercle (x,z,rayon) hors des murs entre y0 et y1 ; renvoie [x,z]
  ENG.World.prototype.push = function (x, z, rad, y0, y1, filter) {
    const list = this.near(x, z, rad + 1, tmp);
    for (let it = 0; it < 2; it++) for (const o of list) {
      if (o.up < 0 || o.wedge) continue;
      if (filter && !filter(o)) continue;
      const top = o.c[1] + o.h[o.up], bot = o.c[1] - o.h[o.up];
      if (top <= y0 || bot >= y1) continue;
      if (x < o.min[0] - rad || x > o.max[0] + rad || z < o.min[2] - rad || z > o.max[2] + rad) continue;
      toLocal(o, x, o.c[1], z, L);
      const a = o.up === 0 ? 1 : 0, b = o.up === 2 ? 1 : 2;
      const ha = o.h[a], hb = o.h[b];
      const ca = Math.max(-ha, Math.min(ha, L[a])), cb = Math.max(-hb, Math.min(hb, L[b]));
      let da = L[a] - ca, db = L[b] - cb; const d2 = da * da + db * db;
      if (d2 >= rad * rad) continue;
      let pa, pb;
      if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (rad - d) / d; pa = da * k; pb = db * k; }
      else { // centre à l'intérieur : sortie par le côté le plus proche
        const ea = ha - Math.abs(L[a]), eb = hb - Math.abs(L[b]);
        if (ea < eb) { pa = (ea + rad) * Math.sign(L[a] || 1); pb = 0; } else { pb = (eb + rad) * Math.sign(L[b] || 1); pa = 0; }
      }
      // local -> monde (axes a et b)
      const R = o.R;
      x += R[a] * pa + R[b] * pb; z += R[6 + a] * pa + R[6 + b] * pb;
    }
    return [x, z];
  };
  // segment bloqué ? (lignes de vue)
  ENG.World.prototype.blocked = function (ax, ay, az, bx, by, bz, ignore) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, len = Math.hypot(dx, dy, dz); if (!(len > 1e-6) || len > 2000) return false;
    const steps = Math.ceil(len / CELL) + 1; const seen = new Set();
    for (let s = 0; s <= steps; s++) {
      const t = s / steps, x = ax + dx * t, z = az + dz * t;
      const list = this.near(x, z, 1, tmp);
      for (const o of list) {
        if (seen.has(o.id)) continue; seen.add(o.id);
        if (ignore && ignore(o)) continue;
        if (Math.min(ay, by) > o.max[1] || Math.max(ay, by) < o.min[1]) continue;
        if (segObb(o, ax, ay, az, dx, dy, dz)) return true;
      }
    }
    return false;
  };
  function segObb(o, ax, ay, az, dx, dy, dz) {
    toLocal(o, ax, ay, az, L); const R = o.R;
    const d = [R[0] * dx + R[3] * dy + R[6] * dz, R[1] * dx + R[4] * dy + R[7] * dz, R[2] * dx + R[5] * dy + R[8] * dz];
    let t0 = 0, t1 = 1;
    for (let k = 0; k < 3; k++) {
      const hk = o.h[k];
      if (Math.abs(d[k]) < 1e-9) { if (Math.abs(L[k]) > hk) return false; continue; }
      let a = (-hk - L[k]) / d[k], b = (hk - L[k]) / d[k]; if (a > b) { const t = a; a = b; b = t; }
      if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 > t1) return false;
    }
    return true;
  }

  /* ---------------- navigation des monstres (grille multi-niveaux + A*) ---------------- */
  ENG.Nav = function (world, x0, x1, z0, z1, cs, clear, height) {
    this.w = world; this.cs = cs; this.x0 = x0; this.z0 = z0;
    this.nx = Math.ceil((x1 - x0) / cs); this.nz = Math.ceil((z1 - z0) / cs);
    this.layers = new Array(this.nx * this.nz);
    const W = world, tmpL = [];
    for (let i = 0; i < this.nx; i++) for (let j = 0; j < this.nz; j++) {
      const x = x0 + (i + 0.5) * cs, z = z0 + (j + 0.5) * cs;
      const list = W.near(x, z, clear + 0.5, tmpL).slice();
      const tops = [];
      for (const o of list) { if (o.max[1] - o.min[1] > 60) continue; const t = W.topAt(o, x, z, 0); if (t !== null) tops.push(t); }
      tops.sort((a, b) => a - b);
      const fl = [];
      for (const t of tops) {
        if (fl.length && Math.abs(fl[fl.length - 1] - t) < 0.3) { fl[fl.length - 1] = Math.max(fl[fl.length - 1], t); continue; }
        fl.push(t);
      }
      const ok = [];
      for (const y of fl) {
        // espace libre au-dessus : aucun obstacle (mur) dans le cylindre (x,z,clear) entre y+0.6 et y+height
        let free = true;
        for (const o of list) {
          if (o.min[1] >= y + height || o.max[1] <= y + 0.6) continue;
          if (o.up < 0 || o.wedge) { const t = W.topAt(o, x, z, 0); if (t !== null && t > y + 0.6 && t < y + height) { free = false; break; } continue; }
          const top = o.c[1] + o.h[o.up]; if (top <= y + 0.6) continue;
          toLocal(o, x, o.c[1], z, L);
          const a = o.up === 0 ? 1 : 0, b = o.up === 2 ? 1 : 2;
          const da = Math.max(0, Math.abs(L[a]) - o.h[a]), db = Math.max(0, Math.abs(L[b]) - o.h[b]);
          if (da * da + db * db < clear * clear) { free = false; break; }
        }
        if (free) ok.push(y);
      }
      this.layers[i * this.nz + j] = ok.length ? Float32Array.from(ok.slice(0, 4)) : null;
    }
  };
  ENG.Nav.prototype.cell = function (x, y, z) {
    const i = Math.floor((x - this.x0) / this.cs), j = Math.floor((z - this.z0) / this.cs);
    if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) return -1;
    const L = this.layers[i * this.nz + j]; if (!L) return -1;
    let best = -1, bd = 1e9; for (let k = 0; k < L.length; k++) { const d = Math.abs(L[k] - y); if (L[k] <= y + 3 && d < bd) { bd = d; best = k; } }
    if (best < 0 || bd > 9) return -1; return (i * this.nz + j) * 4 + best;
  };
  ENG.Nav.prototype.nearest = function (x, y, z, rmax) {
    let c = this.cell(x, y, z); if (c >= 0) return c;
    for (let r = 1; r <= (rmax || 4); r++) for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      c = this.cell(x + di * this.cs, y, z + dj * this.cs); if (c >= 0) return c;
    }
    return -1;
  };
  ENG.Nav.prototype.pos = function (id) {
    const k = id & 3, cj = id >> 2, i = Math.floor(cj / this.nz), j = cj % this.nz;
    return [this.x0 + (i + 0.5) * this.cs, this.layers[cj][k], this.z0 + (j + 0.5) * this.cs];
  };
  ENG.Nav.prototype.path = function (a, b, maxIt) {
    if (a < 0 || b < 0) return null; if (a === b) return [a];
    const nz = this.nz, nx = this.nx, layers = this.layers;
    const g = new Map(), from = new Map(), open = [];
    const bp = this.pos(b);
    const h = (id) => { const p = this.pos(id); return Math.hypot(p[0] - bp[0], (p[1] - bp[1]) * 2, p[2] - bp[2]); };
    const push = (id, f) => { open.push([f, id]); let i = open.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (open[p][0] <= open[i][0]) break; [open[p], open[i]] = [open[i], open[p]]; i = p; } };
    const pop = () => { const top = open[0], last = open.pop(); if (open.length) { open[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < open.length && open[l][0] < open[m][0]) m = l; if (r < open.length && open[r][0] < open[m][0]) m = r; if (m === i) break; [open[m], open[i]] = [open[i], open[m]]; i = m; } } return top; };
    g.set(a, 0); push(a, h(a)); let it = 0; maxIt = maxIt || 30000;
    while (open.length && it++ < maxIt) {
      const [, cur] = pop(); if (cur === b) break;
      const cj = cur >> 2, k = cur & 3, ci = Math.floor(cj / nz), cz = cj % nz, y = layers[cj][k], gc = g.get(cur);
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        if (!di && !dj) continue; const ni = ci + di, nj = cz + dj; if (ni < 0 || nj < 0 || ni >= nx || nj >= nz) continue;
        const L2 = layers[ni * nz + nj]; if (!L2) continue;
        if (di && dj && (!layers[(ci + di) * nz + cz] || !layers[ci * nz + cz + dj])) continue; // pas de coupe de coin
        for (let k2 = 0; k2 < L2.length; k2++) {
          if (Math.abs(L2[k2] - y) > 2.6) continue;
          const nid = (ni * nz + nj) * 4 + k2, cost = gc + (di && dj ? 1.414 : 1) * this.cs + Math.abs(L2[k2] - y);
          if (cost < (g.has(nid) ? g.get(nid) : Infinity)) { g.set(nid, cost); from.set(nid, cur); push(nid, cost + h(nid)); }
        }
      }
    }
    if (!from.has(b)) return null;
    const out = [b]; let c = b; while (c !== a) { c = from.get(c); out.push(c); } return out.reverse();
  };
})();
