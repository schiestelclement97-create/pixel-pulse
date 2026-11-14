/* Sainte-Agathe : Hôpital Hanté — version web (Pixel Pulse). Jeu solo en 1re personne. */
'use strict';
(function () {
  const T = THREE, $ = (s) => document.querySelector(s), R = Math.random;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x)), lerp = (a, b, t) => a + (b - a) * t, rr = (a, b) => a + R() * (b - a);
  const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  let Q = { px: Math.min(devicePixelRatio || 1, 1.5), lights: 8 };   // qualité
  try { const q = localStorage.getItem('sa_q'); if (q === 'moyenne') Q = { px: 1, lights: 6 }; if (q === 'basse') Q = { px: 0.75, lights: 4 }; } catch (e) {}
  if (isTouch && !localStorage.getItem('sa_q')) Q = { px: Math.min(devicePixelRatio || 1, 1.25), lights: 5 };

  /* =============================================================== AUDIO (synthèse) */
  const AU = { ctx: null, master: null };
  function audioInit() {
    if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const ctx = AU.ctx = new C(); AU.master = ctx.createGain(); AU.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor(); AU.master.connect(comp); comp.connect(ctx.destination);
    // bruit
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = R() * 2 - 1; AU.noise = nb;
    // drone d'ambiance
    const dr = ctx.createGain(); dr.gain.value = 0.12; dr.connect(AU.master); AU.drone = dr;
    for (const f of [41, 41.7, 61.5]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160; o.connect(lp); lp.connect(dr); o.start(); }
    const n = ctx.createBufferSource(); n.buffer = nb; n.loop = true; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 300; bp.Q.value = 0.6;
    const ng = ctx.createGain(); ng.gain.value = 0.05; n.connect(bp); bp.connect(ng); ng.connect(dr); n.start();
    // pluie
    const rn = ctx.createBufferSource(); rn.buffer = nb; rn.loop = true; const rh = ctx.createBiquadFilter(); rh.type = 'highpass'; rh.frequency.value = 1800;
    const rg = ctx.createGain(); rg.gain.value = 0.035; rn.connect(rh); rh.connect(rg); rg.connect(AU.master); rn.start(); AU.rain = rg;
  }
  function env(g, t, a, peak, dcy) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy); }
  function out(pan, vol) {
    const ctx = AU.ctx, g = ctx.createGain(); g.gain.value = vol == null ? 1 : vol;
    if (pan != null && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); g.connect(p); p.connect(AU.master); } else g.connect(AU.master);
    return g;
  }
  function noiseHit(f, q, dur, vol, pan, type) {
    if (!AU.ctx) return; const ctx = AU.ctx, t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = AU.noise; s.playbackRate.value = 0.5 + R();
    const fl = ctx.createBiquadFilter(); fl.type = type || 'bandpass'; fl.frequency.value = f; fl.Q.value = q;
    const g = ctx.createGain(); env(g, t, 0.005, vol, dur); s.connect(fl); fl.connect(g); g.connect(out(pan)); s.start(t, R()); s.stop(t + dur + 0.1);
  }
  function tone(type, f0, f1, dur, vol, pan, delay) {
    if (!AU.ctx) return; const ctx = AU.ctx, t = ctx.currentTime + (delay || 0), o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain(); env(g, t, 0.01, vol, dur); o.connect(g); g.connect(out(pan)); o.start(t); o.stop(t + dur + 0.05);
  }
  const SND = {
    pas: (run, eau) => eau ? noiseHit(700, 0.7, 0.25, 0.25) : noiseHit(run ? 900 : 650, 1.2, 0.09, run ? 0.16 : 0.09),
    pasMonstre: (vol, pan) => { noiseHit(110, 1, 0.25, 0.5 * vol, pan, 'lowpass'); tone('sine', 70, 40, 0.2, 0.35 * vol, pan); },
    griffe: (vol, pan) => { noiseHit(3500, 6, 0.08, 0.2 * vol, pan); noiseHit(2600, 8, 0.06, 0.15 * vol, pan); },
    coeur: (vol) => { tone('sine', 60, 40, 0.12, 0.6 * vol); tone('sine', 55, 38, 0.12, 0.45 * vol, 0, 0.22); },
    cri: (vol) => { if (!AU.ctx) return; vol = vol || 1; for (const f of [520, 780, 1170]) tone('sawtooth', f * rr(0.9, 1.1), f * 1.8, 1.1, 0.16 * vol); noiseHit(1500, 0.5, 1.2, 0.7 * vol); tone('square', 90, 50, 0.9, 0.25 * vol); },
    sting: () => { tone('sawtooth', 300, 1400, 0.5, 0.18); tone('sawtooth', 311, 1500, 0.5, 0.18); noiseHit(2500, 1, 0.4, 0.25); },
    ping: () => { tone('sine', 880, 1320, 0.25, 0.25); tone('sine', 1320, 1760, 0.3, 0.12, 0, 0.08); },
    clic: () => tone('square', 1800, 1200, 0.03, 0.06),
    murmure: () => { for (let i = 0; i < 5; i++) setTimeout(() => noiseHit(rr(2500, 5000), 3, rr(0.1, 0.3), 0.12, rr(-1, 1)), i * 120); },
    sirene: () => { if (!AU.ctx) return; const ctx = AU.ctx, t = ctx.currentTime, o = ctx.createOscillator(); o.type = 'sawtooth';
      for (let k = 0; k < 10; k++) { o.frequency.setValueAtTime(380, t + k * 2); o.frequency.linearRampToValueAtTime(760, t + k * 2 + 1); o.frequency.linearRampToValueAtTime(380, t + k * 2 + 2); }
      const g = ctx.createGain(); g.gain.value = 0.07; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; o.connect(lp); lp.connect(g); g.connect(AU.master); o.start(t); o.stop(t + 20); },
    tonnerre: () => { noiseHit(80, 0.5, 2.5, 0.9, 0, 'lowpass'); noiseHit(300, 0.4, 1.2, 0.35); },
    grincement: (pan) => { tone('sawtooth', 160, 110, 1.2, 0.08, pan); tone('triangle', 330, 220, 1.2, 0.05, pan); },
    impact: () => { noiseHit(120, 0.6, 0.6, 1.0, 0, 'lowpass'); tone('sine', 80, 30, 0.5, 0.6); },
    sonnerie: (pan) => { for (let k = 0; k < 3; k++) { tone('square', 840, 840, 0.35, 0.06, pan, k * 0.5); tone('square', 660, 660, 0.35, 0.05, pan, k * 0.5); } },
    generateur: () => { tone('sawtooth', 40, 90, 2.5, 0.3); noiseHit(200, 0.5, 2, 0.3, 0, 'lowpass'); },
    souffle: () => noiseHit(900, 0.5, 0.9, 0.05),
    rush: (vol, pan) => { noiseHit(400, 0.4, 0.6, 0.7 * vol, pan, 'lowpass'); tone('sawtooth', 110, 60, 0.5, 0.2 * vol, pan); },
    flash: () => { tone('sine', 3000, 600, 0.25, 0.15); noiseHit(5000, 1, 0.1, 0.2); },
    eau: () => noiseHit(500, 0.8, 0.35, 0.3),
  };

  /* =============================================================== ÉTAT */
  const S = {
    started: false, paused: true, dead: false, won: false, role: null, time: 0,
    fusTrouves: 0, fusPortes: 0, fusInseres: 0, courant: false, cle: false, salle0: false,
    bat: CFG.batMax, batMax: CFG.batMax, lampe: true, cam: CFG.cam.bat, camOn: false, flashT: 0,
    stam: CFG.stamMax, stamMax: CFG.stamMax, adren: 0, esprit: 100, souffle: CFG.souffle.duree, retenu: false,
    cache: null, cacheVu: false, nuit: 1, morts: 0, indice: 0,
  };
  const P = { x: -104, y: 0, z: 0, yaw: -Math.PI / 2, pitch: 0, vy: 0, run: false, moving: false, h: 5, eye: 4.6, r: 1.1, step: 0, eau: false };
  const keys = {}; let W, NAV, scene, camera, renderer, flash, data, plan;
  const dyn = {}; // groupe -> { meshes, parts }
  const lamps = []; const lightsData = []; const pool = [];
  const lockers = [], notes = [], fusePts = [], pickups = [], monsters = {}, signs = [];
  let gen = null, exitZone = null, waterZone = null, evs = [], keyPts = [];

  /* =============================================================== CONSTRUCTION DE LA SCÈNE */
  async function build(prog) {
    prog('Chargement de l\'hôpital…', 0.05);
    data = await (await fetch('scene.json')).json(); plan = await (await fetch('plan.json')).json();
    try { await Promise.all([document.fonts.load('40px Creepster'), document.fonts.load('40px Elite')]); } catch (e) {}
    prog('Construction des salles…', 0.25); await frame();
    renderer = new T.WebGLRenderer({ canvas: $('#c'), antialias: false, powerPreference: 'high-performance' });
    let px0 = Q.px; try { const v = +localStorage.getItem('sa_px'); if (v > 0.3 && v < Q.px) px0 = v; } catch (e) {}
    renderer.setPixelRatio(px0); renderer.setSize(innerWidth, innerHeight);
    scene = new T.Scene(); scene.background = new T.Color(0x020203); scene.fog = new T.FogExp2(0x040405, 0.022);
    camera = new T.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 170); scene.add(camera);
    scene.add(new T.AmbientLight(0x2a2c34, 0.55)); AMB = scene.children[scene.children.length - 1];
    scene.add(new T.HemisphereLight(0x30323c, 0x0c0a0a, 0.35));

    const G = data.groups; W = new ENG.World();
    const buckets = {}; const lampBuf = ENG.Buf(); const lampRanges = {};
    const dynParts = {};
    for (const r of data.parts) {
      const gname = G[r[20]], nm = r[21];
      if (r[19] & 1) { const o = W.add(r, gname); if (/^(gate:|ss:PorteSalle0$|ss:PorteFourFermee)/.test(gname)) o.dyn = gname; if (gname === 'ss:PorteSalle0Ouverte') o.on = false; }
      if (r[18] >= 0.99) { (dynParts[gname] = dynParts[gname] || []).push(r); continue; }
      const isDyn = /^(gen:|gate:|ss:|obj:|note:)/.test(gname);
      if (isDyn) { (dynParts[gname] = dynParts[gname] || []).push(r); continue; }
      const mat = ENG.MATS[r[17]];
      if (gname.startsWith('lampe:') && mat === 'neon') {
        const id = +gname.split(':')[1]; const s0 = lampBuf.vc; ENG.addPart(lampBuf, r); lampRanges[id] = [s0, lampBuf.vc, ENG.colOf(r[16])]; continue;
      }
      if (gname.startsWith('casier:') || gname.startsWith('lampe:') || gname.startsWith('fen:')) (dynParts[gname] = dynParts[gname] || []).push(r);
      const op = r[18] > 0.02 ? Math.round((1 - r[18]) * 5) / 5 : 1;
      const big = Math.max(r[13], r[15]) > 70; // grands murs/sols : morceau à part, toujours dessiné
      const lv = r[2] < -4 ? 0 : r[2] < 15 ? 1 : r[2] < 31 ? 2 : 3;
      const key = mat + '|' + op + '|' + (big ? 'big' : Math.floor(r[1] / 100) + ',' + Math.floor(r[3] / 90) + ',' + lv);
      ENG.addPart(buckets[key] = buckets[key] || ENG.Buf(), r);
    }
    const MC = {};
    for (const key in buckets) {
      const [mat, op] = key.split('|'); const mk = mat + op; const mt = MC[mk] = MC[mk] || ENG.material(mat, +op);
      const m = new T.Mesh(ENG.toGeo(buckets[key]), mt);
      if (+op < 1) m.renderOrder = 2; scene.add(m); if (!key.endsWith('big')) CULL.push(m);
    }
    // néons des lampes (couleurs modifiables lampe par lampe)
    const lampGeo = ENG.toGeo(lampBuf); const lampMesh = new T.Mesh(lampGeo, new T.MeshBasicMaterial({ vertexColors: true, fog: true })); scene.add(lampMesh);
    LAMPCOL = lampGeo.attributes.color;
    // lampes : regroupe néon + lumière
    const lampByGrp = {};
    G.forEach((g, gi) => { if (g.startsWith('lampe:')) { const [, id, kind] = g.split(':'); const L = { id: +id, kind, gi, range: lampRanges[+id], on: kind !== 'LampeCassee', lvl: kind === 'LampeCassee' ? 0 : 1, lights: [], pos: null, flick: 0 }; lamps.push(L); lampByGrp[gi] = L; } });
    for (const l of data.lights) {
      const L = { x: l[0], y: l[1], z: l[2], col: new T.Color(l[3], l[4], l[5]), base: new T.Color(l[3], l[4], l[5]), range: l[6], bright: l[7], spot: l[8], en: !!l[9], grp: l[10], lamp: lampByGrp[l[10]] || null, k: 1 };
      if (L.lamp) { L.lamp.lights.push(L); L.lamp.pos = [L.x, L.y, L.z]; }
      lightsData.push(L);
    }
    for (let i = 0; i < Q.lights; i++) { const pl = new T.PointLight(0xffffff, 0, 20, 1.3); pl.visible = true; scene.add(pl); pool.push(pl); }
    // lampe torche
    flash = new T.SpotLight(0xfff2d8, 2.2, 75, 0.52, 0.45, 1.1); flash.position.set(0.35, -0.3, 0); camera.add(flash); camera.add(flash.target); flash.target.position.set(0, -0.15, -1);
    prog('Installation des objets…', 0.45); await frame();

    // groupes dynamiques
    for (const g in dynParts) {
      const prts = dynParts[g]; const grp = new T.Group(); grp.name = g; const byMat = {};
      let cx = 0, cy = 0, cz = 0;
      for (const r of prts) { cx += r[1]; cy += r[2]; cz += r[3]; }
      cx /= prts.length; cy /= prts.length; cz /= prts.length;
      const vis = prts.filter((r) => r[18] < 0.99);
      const isStatic = g.startsWith('casier:') || g.startsWith('lampe:') || g.startsWith('fen:');
      if (!isStatic) for (const r of vis) { const mat = ENG.MATS[r[17]]; const key = mat + '|' + (r[18] > 0.02 ? Math.round((1 - r[18]) * 5) / 5 : 1); const M = ENG.matOf(r); M.premultiply(new T.Matrix4().makeTranslation(-cx, -cy, -cz)); ENG.addPart(byMat[key] = byMat[key] || ENG.Buf(), r, M); }
      for (const key in byMat) { const [mat, op] = key.split('|'); const m = new T.Mesh(ENG.toGeo(byMat[key]), ENG.material(mat, +op)); grp.add(m); }
      grp.position.set(cx, cy, cz); if (!isStatic) scene.add(grp);
      dyn[g] = { grp, parts: prts, c: [cx, cy, cz] };
    }
    if (dyn['ss:PorteSalle0Ouverte']) { dyn['ss:PorteSalle0Ouverte'].grp.visible = false; dyn['ss:PorteSalle0Ouverte'].hide = true; }
    // casiers
    for (const g in dyn) if (g.startsWith('casier:')) {
      const pr = dyn[g].parts, inn = pr.find((r) => r[21] === 'Interieur'), porte = pr.find((r) => r[21] === 'Porte');
      if (!inn || !porte) continue;
      const fx = porte[1] - inn[1], fz = porte[3] - inn[3], fl = Math.hypot(fx, fz) || 1;
      lockers.push({ x: inn[1], y: inn[2] - 3.1, z: inn[3], fx: fx / fl, fz: fz / fl, porte });
    }
    // notes
    for (const g in dyn) if (g.startsWith('note:')) { const i = +g.split(':')[1]; const c = dyn[g].c; notes.push({ i, x: c[0], y: c[1], z: c[2], lu: false, grp: dyn[g].grp }); }
    // générateur
    const gc = dyn['gen:Corps']; gen = { x: gc.c[0], y: gc.c[1], z: gc.c[2], slots: [1, 2, 3, 4, 5].map((k) => dyn['gen:Slot' + k]), voyant: dyn['gen:Voyant'] };
    const ez = data.points.exit[0]; exitZone = { x: ez[0], y: ez[1], z: ez[2], sx: ez[4], sy: ez[5], sz: ez[6] };
    const wz = data.points.ss.find((p) => p[3] === 'ZoneEau'); waterZone = wz && { x: wz[0], y: wz[1], z: wz[2], sx: wz[4], sy: wz[5], sz: wz[6] };
    keyPts = data.points.key.map((p) => ({ x: p[0], y: p[1], z: p[2] }));
    evs = data.points.ev.map((p) => ({ nom: p[3], x: p[0], y: p[1], z: p[2], sx: p[4], sy: p[5], sz: p[6], fait: false }));
    // panneaux
    for (const s of data.signs) addSign(s);
    prog('Réveil des monstres…', 0.6); await frame();
    for (const nm in data.monsters) buildMonster(nm, data.monsters[nm]);
    SCREAM = {}; for (const nm in data.screamers) SCREAM[nm] = data.screamers[nm];
    prog('Calcul des passages…', 0.7); await frame();
    NAV = new ENG.Nav(W, -176, 206, -156, 52, 2, 1.7, 6.5);
    // le hall est une zone sûre : les monstres n'y entrent pas
    for (let i = 0; i < NAV.nx; i++) for (let j = 0; j < NAV.nz; j++) {
      const x = NAV.x0 + (i + 0.5) * 2, z = NAV.z0 + (j + 0.5) * 2, L = NAV.layers[i * NAV.nz + j]; if (!L) continue;
      if (x < -80.6 && x > -113 && Math.abs(z) < 20.5) { const keep = Array.from(L).filter((y) => y < -2); NAV.layers[i * NAV.nz + j] = keep.length ? Float32Array.from(keep) : null; }
    }
    prog('Presque prêt…', 0.95); await frame();
  }
  let AMB, LAMPCOL, SCREAM; const CULL = [], CULL_S = [];
  function cullUpdate() {
    const c = camera.position;
    for (const m of CULL) { const bs = m.geometry.boundingSphere; m.visible = Math.hypot(bs.center.x - c.x, (bs.center.y - c.y) * 1.3, bs.center.z - c.z) - bs.radius < 110; }
    for (const m of CULL_S) m.visible = Math.hypot(m.position.x - c.x, m.position.y - c.y, m.position.z - c.z) < 55;
    for (const g in dyn) { const d = dyn[g]; if (d.grp.parent && !d.hide) d.grp.visible = Math.hypot(d.grp.position.x - c.x, d.grp.position.y - c.y, d.grp.position.z - c.z) < 75; }
    for (const p of pickups) p.mesh.visible = Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z) < 70;
  }
  let cullT = 0;
  const frame = () => new Promise((r) => { let done = false; const f = () => { if (!done) { done = true; r(); } }; requestAnimationFrame(f); setTimeout(f, 60); });

  function addSign(s) {
    const blood = s.t.startsWith('!'), text = blood ? s.t.slice(1) : s.t;
    const w = s.s[0], h = s.s[1]; const ppu = 48, cw = Math.min(2048, Math.max(64, Math.round(w * ppu))), ch = Math.min(1024, Math.max(32, Math.round(h * ppu)));
    const c = document.createElement('canvas'); c.width = cw; c.height = ch; const g = c.getContext('2d');
    if (!blood) { g.fillStyle = '#1c2620'; g.fillRect(0, 0, cw, ch); }
    let fs = ch * 0.72; g.font = `${fs}px ${blood ? 'Creepster' : 'Elite'}, serif`;
    while (g.measureText(text).width > cw * 0.92 && fs > 6) { fs *= 0.92; g.font = `${fs}px ${blood ? 'Creepster' : 'Elite'}, serif`; }
    g.fillStyle = blood ? '#7a0000' : '#bfcdb9'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, cw / 2, ch / 2 + fs * 0.05);
    if (blood) { g.fillStyle = 'rgba(110,0,0,.8)'; for (let k = 0; k < 14; k++) { const x = R() * cw, y = ch / 2 + fs * 0.2; g.fillRect(x, y, 2 + R() * 3, R() * ch * 0.45); } }
    const t = new T.CanvasTexture(c); t.anisotropy = 4;
    const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshPhongMaterial({ map: t, transparent: blood, shininess: 4, specular: 0x050505, depthWrite: !blood }));
    const M = ENG.matOf([0, ...s.cf, ...s.s]);
    m.applyMatrix4(M); m.translateZ(-s.s[2] / 2 - 0.03); m.rotateY(Math.PI); scene.add(m); CULL_S.push(m);
  }

  // ---------------- modèles de monstres ----------------
  const MCACHE = new Map();
  function modelGroup(def, neonBoost) {
    const key = def; let base = MCACHE.get(key);
    if (!base) { base = modelGroup0(def, neonBoost); MCACHE.set(key, base); return base; }
    if (!base.parent) return base;
    const c = base.clone(); c.userData = Object.assign({}, base.userData); return c;
  }
  function modelGroup0(def, neonBoost) {
    const root = def.root; const Mr = ENG.matOf([0, ...root, 1, 1, 1]); const inv = new T.Matrix4().copy(Mr).invert();
    // repère "à plat" : enlève l'inclinaison de la racine, garde la position
    let minY = Infinity; const byMat = {}; const glow = ENG.Buf();
    let headP = null, headScore = -1;
    for (const r of def.parts) {
      if (r[18] >= 0.99) continue;
      const M = ENG.matOf(r).premultiply(inv);
      const sc = r[21] === 'Tete' ? 3 : /Tete|Crane|Oeil/.test(r[21]) ? 2 : 0;
      if (sc > headScore) { headScore = sc; headP = new T.Vector3().setFromMatrixPosition(M); }
      const mat = ENG.MATS[r[17]];
      if (mat === 'neon') { const c = ENG.colOf(r[16]).map((x) => Math.min(1, x * (neonBoost || 1.6))); ENG.addPart(glow, r, M, c); }
      else ENG.addPart(byMat[mat] = byMat[mat] || ENG.Buf(), r, M);
    }
    const grp = new T.Group(), inner = new T.Group(); grp.add(inner);
    for (const k in byMat) inner.add(new T.Mesh(ENG.toGeo(byMat[k]), ENG.material(k, 1)));
    if (glow.vc) inner.add(new T.Mesh(ENG.toGeo(glow), new T.MeshBasicMaterial({ vertexColors: true, fog: false })));
    inner.rotation.y = Math.PI; inner.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(inner); minY = box.min.y;
    inner.position.set(-(box.min.x + box.max.x) / 2, -minY, -(box.min.z + box.max.z) / 2); // le modèle Roblox regarde vers -Z local : on le fait regarder vers +Z du groupe
    grp.userData.h = box.max.y - box.min.y;
    inner.updateMatrix(); const hp = headP ? headP.clone().applyMatrix4(inner.matrix) : new T.Vector3(0, grp.userData.h * 0.9, 0);
    grp.userData.head = { x: hp.x, y: hp.y, z: hp.z }; return grp;
  }
  function buildMonster(nm, def) {
    const C = CFG.M[nm]; if (!C) return;
    const grp = modelGroup(def); scene.add(grp);
    const r = def.root; const sx = r[0], sz = r[2]; const ground = W.ground(sx, sz, r[1] + 1, 0.5);
    const M = { nm, C, grp, x: sx, y: isFinite(ground) ? ground : r[1] - 3, z: sz, yaw: Math.atan2(-r[5], -r[11]) || 0, state: 'sommeil', path: null, pi: 0, t: 0, seen: 0, lastSeen: -99, lk: null, chaseT: 0, repit: 0, stun: 0, home: null, step: 0, speed: 0, sawHide: false, h: grp.userData.h };
    M.home = { x: M.x, y: M.y, z: M.z }; monsters[nm] = M; placeMonster(M);
  }
  function placeMonster(M) { M.grp.position.set(M.x, M.y, M.z); M.grp.rotation.y = M.yaw; }

  /* =============================================================== PRÉPARATION D'UNE NUIT */
  function newNight(keepProgress) {
    // fusibles : 4 au hasard (bien répartis) + 1 dans la Salle 0 ; un faux fusible ; 7 piles
    for (const p of pickups) scene.remove(p.mesh); pickups.length = 0;
    const pts = data.points.fuse.filter((p) => p[3] === 'PointFusible').map((p) => ({ x: p[0], y: p[1], z: p[2] }));
    const s0 = data.points.fuse.find((p) => p[3] === 'PointFusibleSalle0');
    shuffle(pts);
    const chosen = [];
    for (const p of pts) { if (chosen.length >= 4) break; if (chosen.every((c) => Math.hypot(c.x - p.x, c.z - p.z) > 40 || Math.abs(c.y - p.y) > 8)) chosen.push(p); }
    if (!keepProgress) {
      chosen.forEach((p) => addPickup('fusible', p)); addPickup('fusible', { x: s0[0], y: s0[1], z: s0[2] }, true);
      const rest = pts.filter((p) => !chosen.includes(p)); addPickup('faux', rest[0]);
      for (let i = 1; i <= CFG.cam.piles; i++) addPickup('pile', rest[i]);
      const k = keyPts[Math.floor(R() * keyPts.length)]; addPickup('cle', k);
      S.fusTrouves = S.fusPortes = S.fusInseres = 0; S.courant = false; S.cle = false; S.salle0 = false;
      gen.slots.forEach((s) => setGroupColor(s, 0x222222)); setGroupColor(gen.voyant, 0x550000);
      openGate(false); setSalle0(false);
      for (const e of evs) e.fait = false;
      for (const n of notes) n.lu = false;
    }
    for (const nm in monsters) { const M = monsters[nm]; Object.assign(M, { x: M.home.x, y: M.home.y, z: M.home.z, state: 'sommeil', path: null, stun: 0, repit: 0, sawHide: false, chaseT: 0 }); M.grp.visible = true; placeMonster(M); }
    Object.assign(P, { x: -104, y: 0.2, z: 0, yaw: -Math.PI / 2, pitch: 0, vy: 0 });
    Object.assign(S, { time: 0, dead: false, won: false, bat: S.batMax, lampe: true, cam: CFG.cam.bat, camOn: false, stam: S.stamMax, esprit: 100, cache: null, adren: 0 });
    timers.coupure = CFG.coupure.first; timers.hurleur = rr(CFG.hurleur.min, CFG.hurleur.max); timers.screamer = rr(CFG.screamers.min, CFG.screamers.max);
    timers.peur = rr(35, 80); timers.orage = rr(25, 60); timers.murmure = rr(20, 50);
    coupure.phase = 0; hurl.phase = 0; ombre.on = false; ombre.t = 0; if (ombre.grp) ombre.grp.visible = false;
    setLampMode('normal');
  }
  const timers = {};
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const FUSE_GEO = new T.CylinderGeometry(0.28, 0.28, 1.0, 10), PILE_GEO = new T.CylinderGeometry(0.22, 0.22, 0.7, 10), KEY_GEO = new T.TorusGeometry(0.3, 0.08, 6, 12);
  function addPickup(kind, p, salle0) {
    if (!p) return;
    const col = { fusible: 0xffc61a, faux: 0xffa040, pile: 0x3cff6a, cle: 0x9a6a3a }[kind];
    const grp = new T.Group(); const body = new T.Mesh(kind === 'pile' ? PILE_GEO : kind === 'cle' ? KEY_GEO : FUSE_GEO, new T.MeshBasicMaterial({ color: col }));
    grp.add(body);
    if (kind !== 'cle') { const cap = new T.Mesh(new T.CylinderGeometry(0.3, 0.3, 0.12, 10), new T.MeshPhongMaterial({ color: 0x999999 })); cap.position.y = 0.5; grp.add(cap); const cap2 = cap.clone(); cap2.position.y = -0.5; grp.add(cap2); }
    else { const tige = new T.Mesh(new T.BoxGeometry(0.1, 0.1, 0.8), new T.MeshBasicMaterial({ color: col })); tige.position.z = 0.5; grp.add(tige); }
    const halo = new T.Mesh(new T.SphereGeometry(kind === 'pile' ? 0.7 : 0.95, 12, 8), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.16, depthWrite: false })); grp.add(halo);
    const g = W.ground(p.x, p.z, p.y + 1, 0.2); const y = isFinite(g) && g > p.y - 4 ? g + 0.75 : p.y;
    grp.position.set(p.x, y, p.z); grp.rotation.z = kind === 'cle' ? 0 : 0.2; scene.add(grp);
    pickups.push({ kind, x: p.x, y, z: p.z, mesh: grp, salle0: !!salle0, t: R() * 6 });
  }
  function setGroupColor(d, hex) { if (!d) return; d.grp.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color = new T.Color(hex); o.material.vertexColors = false; o.material.needsUpdate = true; if (o.material.emissive) o.material.emissive = new T.Color(hex).multiplyScalar(0.6); } }); }
  function openGate(open) {
    for (const s of ['G', 'D']) { const d = dyn['gate:Portail' + s]; if (!d) continue; d.target = open ? (s === 'G' ? -14 : 14) : 0; if (!open) { d.grp.position.z = d.c[2]; } }
    for (const o of W.obbs) if (o.dyn && o.dyn.startsWith('gate:')) o.on = !open;
  }
  function setSalle0(open) {
    S.salle0 = open; for (const o of W.obbs) { if (o.dyn === 'ss:PorteSalle0') o.on = !open; if (o.grp === 'ss:PorteSalle0Ouverte') o.on = open; }
    for (const [k, v] of [['ss:PorteSalle0', !open], ['ss:PorteSalle0Ouverte', open]]) if (dyn[k]) { dyn[k].hide = !v; dyn[k].grp.visible = v; }
  }

  /* =============================================================== LAMPES */
  let lampMode = 'normal';
  function setLampMode(m) { lampMode = m; }
  function lampColor(L, k, red) {
    if (!L.range) return; const [a, b, c] = L.range; const arr = LAMPCOL.array;
    const r = red ? 0.9 * k : c[0] * k + 0.04, g = red ? 0.05 * k : c[1] * k + 0.04, bl = red ? 0.04 * k : c[2] * k + 0.04;
    for (let i = a; i < b; i++) { arr[i * 3] = r; arr[i * 3 + 1] = g; arr[i * 3 + 2] = bl; }
    LAMPCOL.needsUpdate = true;
  }
  function updateLamps(dt) {
    const red = lampMode === 'alerte', dark = lampMode === 'noir';
    for (const L of lamps) {
      let k = L.on ? 1 : 0;
      if (S.courant && lampMode !== 'noir') k = 1;
      if (L.kind === 'LampeInstable' && k) { L.flick -= dt; if (L.flick < 0) { L.flick = R() < 0.8 ? rr(0.04, 0.15) : rr(0.5, 2); L.fv = R() < 0.35 ? 0 : rr(0.5, 1); } k = L.fv == null ? 1 : L.fv; }
      if (L.hurl) k = R() < 0.5 ? 0 : 1;
      if (dark) k = 0;
      if (L.kv !== k || L.kr !== (red || !!L.hurl)) { L.kv = k; L.kr = red || !!L.hurl; lampColor(L, k, L.kr); }
      for (const l of L.lights) { l.k = k; l.red = L.kr; }
    }
  }
  const _v = new T.Vector3();
  function updateLightPool() {
    const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z; const cand = [];
    for (const l of lightsData) {
      if (!l.en && !l.lamp) continue; if (l.spot) continue; const k = l.lamp ? l.k : 1; if (k <= 0.01) continue;
      const d = Math.hypot(l.x - cx, (l.y - cy) * 1.5, l.z - cz); if (d > l.range + 34) continue;
      cand.push([d - l.bright * 6, l]);
    }
    cand.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < pool.length; i++) {
      const pl = pool[i], c = i < Q.lights ? cand[i] : null;
      if (!c) { pl.intensity = 0; continue; }
      const l = c[1]; pl.position.set(l.x, l.y - 0.4, l.z); pl.distance = l.range * 1.25;
      pl.color.copy(l.red ? RED : l.base); pl.intensity = l.bright * 1.25 * (l.lamp ? l.k : 1);
    }
  }
  const RED = new T.Color(1, 0.06, 0.04);
  function litAt(x, y, z) { // éclairage approximatif d'un point (0..1)
    let best = 0; for (const l of lightsData) { if (l.spot || (!l.en && !l.lamp)) continue; const k = l.lamp ? l.k : 1; if (k < 0.1) continue; const d = Math.hypot(l.x - x, (l.y - y) * 0.6, l.z - z); if (d < l.range) best = Math.max(best, (1 - d / l.range) * k); }
    return best;
  }

  /* =============================================================== JOUEUR */
  function inBox(p, b, m) { m = m || 0; return Math.abs(p.x - b.x) < b.sx / 2 + m && Math.abs(p.y - b.y) < b.sy / 2 + m && Math.abs(p.z - b.z) < b.sz / 2 + m; }
  const look = { dx: 0, dy: 0 }, joy = { x: 0, y: 0, on: false };
  function updatePlayer(dt) {
    if (S.cache) { // dans un casier
      const L = S.cache; P.x = L.x; P.z = L.z; P.y = L.y;
      if (S.retenu) { S.souffle -= dt; if (S.souffle <= 0) { S.retenu = false; S.souffle = 0; SND.souffle(); msg('Tu reprends ton souffle…', 1.5); } }
      else S.souffle = Math.min(CFG.souffle.duree, S.souffle + CFG.souffle.recup * dt);
      P.yaw = clamp(P.yaw, L.yaw - 0.7, L.yaw + 0.7);
      return;
    }
    let fx = 0, fz = 0;
    if (keys.KeyW || keys.ArrowUp) fz += 1; if (keys.KeyS || keys.ArrowDown) fz -= 1;
    if (keys.KeyA || keys.ArrowLeft) fx -= 1; if (keys.KeyD || keys.ArrowRight) fx += 1;
    if (joy.on) { fx += joy.x; fz += -joy.y; }
    const mag = Math.hypot(fx, fz); if (mag > 1) { fx /= mag; fz /= mag; }
    P.moving = mag > 0.1;
    const wantRun = (keys.ShiftLeft || keys.ShiftRight || runTouch) && P.moving && fz > -0.2;
    if (wantRun && (S.stam > 0.05 || S.adren > 0)) { P.run = true; if (S.adren <= 0) S.stam = Math.max(0, S.stam - dt); }
    else { P.run = false; S.stam = Math.min(S.stamMax, S.stam + CFG.stamRec * dt * (P.moving ? 0.6 : 1)); }
    if (S.stam <= 0.05 && !S.essouffle) { S.essouffle = true; } if (S.stam > 1.5) S.essouffle = false;
    P.eau = waterZone && inBox(P, waterZone, 0.5) && P.y < -9;
    let sp = (P.run ? CFG.run : CFG.walk) * (P.eau ? CFG.ombre.eau : 1) * (S.esprit < 25 ? 0.92 : 1);
    const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
    const vx = (fx * cy - fz * sy) * sp, vz = (-fx * sy - fz * cy) * sp;
    let nx = P.x + vx * dt, nz = P.z + vz * dt;
    // pas sur des sous-étapes pour ne pas traverser les murs
    const steps = Math.ceil(Math.hypot(vx, vz) * dt / 0.5) || 1; let x = P.x, z = P.z;
    for (let s = 1; s <= steps; s++) {
      const tx = lerp(P.x, nx, s / steps), tz = lerp(P.z, nz, s / steps);
      [x, z] = W.push(tx, tz, P.r, P.y + 2.1, P.y + P.h);
    }
    // sol
    const g = W.ground(x, z, P.y + 2.2, 0.35);
    if (isFinite(g) && g > P.y - 0.05) { P.y = lerp(P.y, g, Math.min(1, dt * 18)); P.vy = 0; if (Math.abs(P.y - g) < 0.05) P.y = g; }
    else { P.vy -= 140 * dt; P.y += P.vy * dt; if (isFinite(g) && P.y < g) { P.y = g; P.vy = 0; } if (P.y < -60) { P.x = -104; P.y = 0.2; P.z = 0; P.vy = 0; } }
    P.x = x; P.z = z;
    if (P.moving && Math.abs(P.vy) < 1) { P.step += dt * (P.run ? 2.6 : 1.8); if (P.step > 1) { P.step = 0; SND.pas(P.run, P.eau); if (P.eau || P.run) noise(P.x, P.y, P.z, P.run ? 1 : 0.6, P.eau ? 'eau' : 'course'); } }
  }
  function camUpdate(dt) {
    const bob = P.moving && !S.cache ? Math.sin(perfT * (P.run ? 13 : 8.5)) * (P.run ? 0.13 : 0.07) : 0;
    let shake = shakeT > 0 ? shakeA * shakeT : 0; shakeT = Math.max(0, shakeT - dt);
    camera.position.set(P.x + rr(-shake, shake), P.y + P.eye + bob + (S.cache ? -0.6 : 0) + rr(-shake, shake), P.z);
    camera.rotation.set(0, 0, 0); camera.rotation.order = 'YXZ'; camera.rotation.y = P.yaw; camera.rotation.x = P.pitch;
    camera.rotation.z = S.esprit < 30 ? Math.sin(perfT * 0.7) * 0.02 * (30 - S.esprit) / 30 : 0;
  }
  let shakeT = 0, shakeA = 0, perfT = 0;
  function shake(a, t) { shakeA = a; shakeT = t; }

  /* =============================================================== BRUIT & MONSTRES */
  function noise(x, y, z, force, kind) {
    if (CFG.hall({ x, y, z })) return;
    for (const nm in monsters) {
      const M = monsters[nm]; if (M.state === 'sommeil' || M.C.type !== 'chasseur') continue;
      const d = Math.hypot(M.x - x, (M.y - y) * 1.5, M.z - z);
      const rad = kind === 'course' ? M.C.ouie : kind === 'eau' ? M.C.ouie * 0.8 : kind === 'fort' ? M.C.ouie * 1.4 * force : M.C.prox;
      if (d < rad && M.state !== 'chasse' && M.state !== 'fixe' && M.repit <= 0) { M.state = 'enquete'; M.target = { x, y, z }; M.path = null; M.t = 0; }
    }
  }
  function wake(nm, quiet) {
    const M = monsters[nm]; if (!M || M.state !== 'sommeil') return;
    M.state = 'patrouille'; M.path = null; if (!quiet) { msg(M.C.msg, 6, 'monstre'); SND.cri(0.35); }
  }
  function checkWakes() {
    for (const nm in monsters) {
      const M = monsters[nm], C = M.C; if (M.state !== 'sommeil') continue;
      if ((C.reveilDelai && S.time > C.reveilDelai) || (C.reveilFus && S.fusTrouves >= C.reveilFus)) wake(nm);
    }
  }
  function sees(M, maxD, angle, ignoreAngle) {
    if (S.cache || CFG.hall(P)) return false;
    const ex = M.x, ey = M.y + Math.min(M.h * 0.85, 9), ez = M.z;
    const dx = P.x - ex, dz = P.z - ez, dy = P.y + P.eye - 0.5 - ey, d = Math.hypot(dx, dy, dz);
    let range = maxD; if (!S.lampe && litAt(P.x, P.y + 3, P.z) < 0.2 && !S.camOn) range *= 0.55;
    if (d > range) return false;
    if (!ignoreAngle) { const fx = Math.sin(M.yaw), fz = Math.cos(M.yaw); const cos = (dx * fx + dz * fz) / (Math.hypot(dx, dz) || 1); if (cos < Math.cos((angle || 70) * Math.PI / 180)) return false; }
    return !W.blocked(ex, ey, ez, P.x, P.y + P.eye - 0.4, P.z, (o) => o.dyn && o.dyn.startsWith('gate:'));
  }
  function goTo(M, x, y, z) {
    const a = NAV.nearest(M.x, M.y + 1, M.z, 4); let b = NAV.nearest(x, y + 1, z, 5);
    if (b < 0) return false;
    const p = NAV.path(a, b, 26000); if (!p) return false;
    M.path = p.map((id) => NAV.pos(id)); M.pi = 0; return true;
  }
  function patrolTarget(M) {
    const pts = data.points.patrol;
    if (R() < CFG.traque && !CFG.hall(P)) return { x: P.x + rr(-25, 25), y: P.y, z: P.z + rr(-25, 25) };
    let cands = pts.filter((p) => Math.abs(p[1] - M.y - 1) < 6);
    if (M.nm === 'Chirurgienne' && R() < 0.75) cands = pts.filter((p) => p[1] > CFG.EY2 - 2);
    if (!cands.length || R() < 0.15) cands = pts;
    const p = cands[Math.floor(R() * cands.length)]; return { x: p[0], y: p[1] - 1, z: p[2] };
  }
  function follow(M, speed, dt) {
    if (!M.path || M.pi >= M.path.length) return true;
    let left = speed * dt, guard = 0;
    while (left > 1e-4 && M.pi < M.path.length && guard++ < 64) {
      const t = M.path[M.pi]; const dx = t[0] - M.x, dz = t[2] - M.z, d = Math.hypot(dx, dz);
      if (d < 0.6) { M.pi++; continue; }
      const k = Math.min(1, left / d); M.x += dx * k; M.z += dz * k; M.y = lerp(M.y, t[1], Math.min(1, k * 1.5 + dt * 4)); left -= d * k;
      const ty = Math.atan2(dx, dz); M.yaw = angLerp(M.yaw, ty, Math.min(1, dt * 8));
    }
    return M.pi >= M.path.length;
  }
  function angLerp(a, b, t) { let d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI; return a + d * t; }
  function faceTo(M, x, z, dt, k) { M.yaw = angLerp(M.yaw, Math.atan2(x - M.x, z - M.z), Math.min(1, dt * (k || 6))); }
  function catchable(M) {
    const d = Math.hypot(P.x - M.x, P.z - M.z), dy = Math.abs(P.y - M.y);
    return d < M.C.attrape && dy < 6 && !CFG.hall(P);
  }
  function updateChasseur(M, dt) {
    const C = M.C, furie = S.courant; M.t += dt; if (M.repit > 0) M.repit -= dt;
    if (M.stun > 0) { M.stun -= dt; M.speed = 0; return; }
    const sp = (s) => furie ? C.vf : s;
    const see = C.aveugle ? (Math.hypot(P.x - M.x, P.z - M.z) < C.prox && Math.abs(P.y - M.y) < 6 && !S.cache && !CFG.hall(P)) : sees(M, C.vue, C.angle);
    // respiration dans un casier
    if (S.cache && !S.retenu && C.ouieCasier && Math.hypot(P.x - M.x, P.z - M.z) < C.ouieCasier && M.state !== 'chasse') { M.sawHide = true; M.state = 'chasse'; M.chaseT = 0; }
    if (see && M.repit <= 0) {
      M.lastSeen = S.time; M.lk = { x: P.x, y: P.y, z: P.z };
      if (M.state === 'patrouille' || M.state === 'enquete') { M.state = 'fixe'; M.t = 0; SND.sting(); if (!C.aveugle) shake(0.03, 0.6); }
    }
    if (M.state === 'fixe') { faceTo(M, P.x, P.z, dt, 10); M.speed = 0; if (M.t > C.fixe) { M.state = 'chasse'; M.chaseT = 0; M.path = null; SND.cri(0.5); } return; }
    if (M.state === 'chasse') {
      M.chaseT += dt;
      if (S.cache && !M.sawHide) { // tu t'es caché : l'a-t-il vu ?
        const d = Math.hypot(P.x - M.x, P.z - M.z); if (S.cacheVu && d < C.vuCache) M.sawHide = true;
      }
      const lost = S.time - M.lastSeen > CFG.oubli && !M.sawHide;
      if (M.chaseT > CFG.chasseMax || CFG.hall(P)) { M.state = 'patrouille'; M.repit = CFG.repit; M.path = null; M.sawHide = false; return; }
      if (lost || (S.cache && !M.sawHide && S.time - M.lastSeen > 1.5)) { M.state = 'recherche'; M.t = 0; M.target = M.lk; M.path = null; return; }
      const tx = M.sawHide && S.cache ? S.cache.x + S.cache.fx * 2 : P.x, tz = M.sawHide && S.cache ? S.cache.z + S.cache.fz * 2 : P.z;
      const direct = see && Math.abs(P.y - M.y) < 3 && Math.hypot(tx - M.x, tz - M.z) < 18;
      if (direct) { const dx = tx - M.x, dz = tz - M.z, d = Math.hypot(dx, dz); const s = sp(C.vc) * dt; if (d > 0.5) { const nx = M.x + dx / d * Math.min(s, d), nz = M.z + dz / d * Math.min(s, d); const c = NAV.cell(nx, M.y + 1, nz); if (c >= 0) { M.x = nx; M.z = nz; M.y = lerp(M.y, NAV.pos(c)[1], dt * 6); } else { M.path = null; } } faceTo(M, tx, tz, dt, 10); M.path = null; }
      else { M.repath = (M.repath || 0) - dt; if (!M.path || M.repath <= 0) { M.repath = 0.6; goTo(M, tx, (M.sawHide ? S.cache.y : P.y), tz); } follow(M, sp(C.vc), dt); }
      M.speed = sp(C.vc);
      if (M.sawHide && S.cache && Math.hypot(S.cache.x - M.x, S.cache.z - M.z) < 4.5) { S.cache = null; mort(M.nm, 'Il t\'a vu entrer dans le casier…'); return; }
      if (!S.cache && catchable(M)) { mort(M.nm); return; }
      return;
    }
    if (M.state === 'enquete' || M.state === 'recherche') {
      if (!M.path) { if (!M.target || !goTo(M, M.target.x, M.target.y, M.target.z)) { M.state = 'patrouille'; return; } }
      const done = follow(M, sp(M.state === 'recherche' ? C.vc * 0.7 : C.v * 1.3), dt); M.speed = C.v;
      if (done) { M.path = null; M.wait = (M.wait || 0) + dt; M.yaw += dt * 1.5; if (M.wait > 3) { M.wait = 0; M.state = 'patrouille'; } }
      if (M.t > 22) { M.state = 'patrouille'; M.path = null; }
      if (!S.cache && catchable(M)) mort(M.nm);
      return;
    }
    // patrouille
    if (!M.path || M.pi >= M.path.length) { M.wait = (M.wait || 0) + dt; if (M.wait > rr(0.5, 2.5)) { M.wait = 0; const t = furie ? { x: P.x, y: P.y, z: P.z } : patrolTarget(M); goTo(M, t.x, t.y, t.z); } M.speed = 0; }
    else { follow(M, sp(C.v), dt); M.speed = C.v; }
    if (furie && !S.cache && Math.hypot(P.x - M.x, P.z - M.z) < 60 && R() < dt) { M.state = 'chasse'; M.lastSeen = S.time; M.lk = { x: P.x, y: P.y, z: P.z }; M.chaseT = 0; }
    if (!S.cache && catchable(M)) mort(M.nm);
  }
  function watched(M) {
    if (S.dead) return false; const hx = M.x, hy = M.y + 4, hz = M.z;
    const dx = hx - camera.position.x, dy = hy - camera.position.y, dz = hz - camera.position.z, d = Math.hypot(dx, dy, dz);
    if (d > M.C.portee) return false;
    _v.set(0, 0, -1).applyQuaternion(camera.quaternion);
    const cos = (dx * _v.x + dy * _v.y + dz * _v.z) / d; if (cos < 0.62) return false;
    if (S.cache) return false;
    if (!S.lampe && !S.camOn && litAt(hx, hy, hz) < 0.15 && d > 10) return false; // dans le noir, tu ne le vois pas
    return !W.blocked(camera.position.x, camera.position.y, camera.position.z, hx, hy, hz);
  }
  function updatePantin(M, dt) {
    const C = M.C; if (M.stun > 0) { M.stun -= dt; return; }
    const w = watched(M); M.frozen = w;
    if (w) { M.speed = 0; if (!M.wasW) { M.wasW = true; } return; }
    if (M.wasW) { M.wasW = false; M.inner = (M.inner || 0) + 1; M.grp.children[0].rotation.z = rr(-0.25, 0.25); }
    const d = Math.hypot(P.x - M.x, P.z - M.z);
    const near = d < C.portee && Math.abs(P.y - M.y) < 8 && !CFG.hall(P) && !S.cache;
    if (near) { M.repath = (M.repath || 0) - dt; if (!M.path || M.repath <= 0) { M.repath = 0.8; goTo(M, P.x, P.y, P.z); } follow(M, S.courant ? C.vf : C.v, dt); faceTo(M, P.x, P.z, dt, 12); }
    else { if (!M.path || M.pi >= M.path.length) { const t = patrolTarget(M); goTo(M, t.x, t.y, t.z); } follow(M, C.v * 0.5, dt); }
    if (catchable(M)) mort(M.nm);
  }
  function updateMonsters(dt) {
    let nearest = 99, nearM = null;
    for (const nm in monsters) {
      const M = monsters[nm]; if (M.state === 'sommeil') { placeMonster(M); continue; }
      if (S.dead) break;
      if (M.C.type === 'pantin') updatePantin(M, dt); else updateChasseur(M, dt);
      placeMonster(M);
      // animation : balancement
      const inner = M.grp.children[0]; const mv = M.speed > 0.1;
      M.step += dt * (mv ? M.speed * 0.45 : 0);
      inner.position.x = mv ? Math.sin(M.step) * 0.12 : 0; inner.rotation.x = M.nm === 'Rampante' ? 0 : (mv ? 0.06 + Math.sin(M.step * 2) * 0.03 : 0);
      if (mv && Math.floor(M.step / Math.PI) !== M.lastStep) { M.lastStep = Math.floor(M.step / Math.PI); const d = Math.hypot(P.x - M.x, P.y - M.y, P.z - M.z); if (d < 70) { const v = clamp(1 - d / 70, 0, 1); const pan = panOf(M.x, M.z); if (M.nm === 'Rampante') SND.griffe(v * 1.6, pan); else SND.pasMonstre(v, pan); } }
      const d = Math.hypot(P.x - M.x, (P.y - M.y) * 1.5, P.z - M.z); if (d < nearest) { nearest = d; nearM = M; }
    }
    return { nearest, nearM };
  }
  function panOf(x, z) { const dx = x - P.x, dz = z - P.z; const rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw); return clamp((dx * rx + dz * rz) / (Math.hypot(dx, dz) || 1), -1, 1); }

  /* =============================================================== LA COUPURE & LE RÔDEUR */
  const coupure = { phase: 0, t: 0, voie: null, rod: null, passes: 0 };
  function updateCoupure(dt) {
    const C = CFG.coupure;
    if (coupure.phase === 0) { timers.coupure -= dt; if (timers.coupure <= 0 && !S.courant) { coupure.phase = 1; coupure.t = C.alerte; setLampMode('alerte'); SND.sirene(); msg('⚠ COUPURE IMMINENTE — CACHE-TOI !', 4, 'alerte'); } return; }
    coupure.t -= dt;
    if (coupure.phase === 1) { $('#compte').textContent = Math.ceil(coupure.t); $('#compte').hidden = false; if (coupure.t <= 0) { coupure.phase = 2; coupure.t = C.noir; $('#compte').hidden = true; setLampMode('noir'); SND.impact(); startRodeur(); } return; }
    if (coupure.phase === 2) {
      updateRodeur(dt);
      if (coupure.t <= 0) { coupure.phase = 0; timers.coupure = rr(C.min, C.max); setLampMode('normal'); if (coupure.rod) coupure.rod.visible = false; msg('Le courant revient… pour l\'instant.', 3); }
    }
  }
  function exposition(v, p) { if (Math.abs(p.y - (v.y + 3)) > 9) return false; const lo = v.axe === 'x' ? p.x : p.z, pe = v.axe === 'x' ? p.z : p.x; return Math.abs(pe - v.fixe) < 42 && lo > v.a - 20 && lo < v.b + 20; }
  function startRodeur() {
    let best = CFG.voies[0], sc = -1; for (const v of CFG.voies) { const n = R() * 0.5 + (exposition(v, P) ? (S.cache ? 0.4 : 1) : 0); if (n > sc) { sc = n; best = v; } }
    coupure.voie = best; coupure.passes = 0; coupure.dir = R() < 0.5 ? 1 : -1; coupure.pos = coupure.dir > 0 ? best.a - 10 : best.b + 10; coupure.wait = rr(1.5, 3);
    if (!coupure.rod) { coupure.rod = modelGroup(SCREAM.Rodeur, 2.2); scene.add(coupure.rod); }
    coupure.rod.visible = false;
  }
  function updateRodeur(dt) {
    const v = coupure.voie, C = CFG.coupure, r = coupure.rod; if (!v) return;
    if (coupure.wait > 0) { coupure.wait -= dt; r.visible = false; return; }
    r.visible = true; coupure.pos += coupure.dir * C.vitesse * dt;
    const x = v.axe === 'x' ? coupure.pos : v.fixe, z = v.axe === 'x' ? v.fixe : coupure.pos;
    const g = W.ground(x, z, v.y + 3, 0.5); const y = isFinite(g) ? g : v.y;
    r.position.set(x, y, z); r.rotation.y = v.axe === 'x' ? (coupure.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (coupure.dir > 0 ? 0 : Math.PI);
    const d = Math.hypot(P.x - x, (P.y - y) * 1.5, P.z - z);
    if (d < 60) { coupure.snd = (coupure.snd || 0) - dt; if (coupure.snd <= 0) { coupure.snd = 0.12; SND.rush(clamp(1 - d / 60, 0, 1), panOf(x, z)); shake(0.05 * (1 - d / 60), 0.2); } }
    if (!S.cache && !CFG.hall(P) && !S.dead && (d < C.rayon || (d < C.vue && !W.blocked(x, y + 2.5, z, P.x, P.y + P.eye, P.z)))) { mort('Rodeur', 'Le Rôdeur t\'a vu passer…'); return; }
    if ((coupure.dir > 0 && coupure.pos > v.b + 15) || (coupure.dir < 0 && coupure.pos < v.a - 15)) { coupure.passes++; coupure.dir *= -1; coupure.wait = rr(1.5, 4); if (coupure.passes >= 4) coupure.wait = 99; }
  }

  /* =============================================================== LE HURLEUR */
  const hurl = { phase: 0 };
  function dansCouloir(p, c) { return Math.abs(p.z - c.z) < 10.6 && p.x > c.x0 - 2 && p.x < c.x1 + 2 && p.y > c.y - 2 && p.y < c.y + 13; }
  function updateHurleur(dt) {
    const H = CFG.hurleur;
    if (hurl.phase === 0) {
      timers.hurleur -= dt; if (timers.hurleur > 0 || S.fusTrouves < H.fusMin || coupure.phase) return;
      const mine = CFG.couloirs.filter((c) => dansCouloir(P, c)); const c = mine.length && R() < 0.75 ? mine[0] : CFG.couloirs[Math.floor(R() * CFG.couloirs.length)];
      hurl.c = c; hurl.phase = 1; hurl.t = H.alerte; hurl.dir = R() < 0.5 ? 1 : -1;
      for (const L of lamps) if (L.pos && Math.abs(L.pos[2] - c.z) < 11 && Math.abs(L.pos[1] - (c.y + 14)) < 6) L.hurl = true;
      if (dansCouloir(P, c)) { msg('Les néons s\'affolent… SORS DU COULOIR !', 3, 'alerte'); }
      SND.grincement(0); return;
    }
    hurl.t -= dt;
    if (hurl.phase === 1) { if (dansCouloir(P, hurl.c) && R() < dt * 4) shake(0.02, 0.3); if (hurl.t <= 0) { hurl.phase = 2; hurl.x = hurl.dir > 0 ? hurl.c.x0 - 20 : hurl.c.x1 + 20; if (!hurl.m) { hurl.m = modelGroup(SCREAM.Hurleur, 2); scene.add(hurl.m); } hurl.m.visible = true; } return; }
    if (hurl.phase === 2) {
      hurl.x += hurl.dir * H.vitesse * dt; const c = hurl.c; hurl.m.position.set(hurl.x, c.y + 1, c.z); hurl.m.rotation.y = hurl.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      const d = Math.hypot(P.x - hurl.x, P.y - c.y, P.z - c.z); if (d < 70) { hurl.s = (hurl.s || 0) - dt; if (hurl.s <= 0) { hurl.s = 0.1; SND.rush(1 - d / 70, panOf(hurl.x, c.z)); shake(0.06 * (1 - d / 70), 0.2); } }
      if (!S.cache && dansCouloir(P, c) && Math.abs(P.x - hurl.x) < 6 && !S.dead) { mort('Hurleur', 'Tu étais encore dans le couloir…'); }
      if ((hurl.dir > 0 && hurl.x > c.x1 + 25) || (hurl.dir < 0 && hurl.x < c.x0 - 25)) { hurl.phase = 0; hurl.m.visible = false; for (const L of lamps) L.hurl = false; timers.hurleur = rr(H.min, H.max); }
    }
  }

  /* =============================================================== L'OMBRE (sous-sol) */
  const ombre = { on: false, t: 0 };
  function updateOmbre(dt) {
    const sous = P.y < -6; const noir = !S.lampe && litAt(P.x, P.y + 2, P.z) < 0.12;
    if (!ombre.on) { if (sous && noir && !S.cache) { ombre.t += dt; if (ombre.t > CFG.ombre.delai) { ombre.on = true; ombre.d = 22; if (!ombre.grp) { ombre.grp = modelGroup(SCREAM.Ombre, 1.5); scene.add(ombre.grp); } ombre.grp.visible = true; SND.murmure(); } } else ombre.t = Math.max(0, ombre.t - dt * 2); return; }
    if (!noir || !sous) { ombre.on = false; ombre.t = 0; ombre.grp.visible = false; msg('L\'Ombre fuit la lumière…', 2); return; }
    ombre.d -= dt * 3.2; const bx = P.x - Math.sin(P.yaw) * -ombre.d, bz = P.z - Math.cos(P.yaw) * -ombre.d;
    ombre.grp.position.set(P.x + Math.sin(P.yaw) * ombre.d, P.y, P.z + Math.cos(P.yaw) * ombre.d); ombre.grp.rotation.y = P.yaw + Math.PI;
    if (ombre.d < 1.5) { ombre.on = false; ombre.grp.visible = false; mort('Ombre', 'L\'Ombre vit dans le noir complet.'); }
  }

  /* =============================================================== ÉVÈNEMENTS EFFRAYANTS */
  function moveGroup(name, dx, dy, dz, dur, rot) {
    const d = dyn[name]; if (!d) return; const g = d.grp, s = g.position.clone(), r0 = g.rotation.y, t0 = perfT;
    anims.push((t) => { const k = clamp((t - t0) / dur, 0, 1), e = 1 - Math.pow(1 - k, 3); g.position.set(s.x + dx * e, s.y + dy * e, s.z + dz * e); if (rot) g.rotation.y = r0 + rot * e; return k >= 1; });
  }
  const anims = [];
  function apparition(model, x, y, z, yaw, dur) {
    const g = modelGroup(SCREAM[model] || SCREAM.Patiente); g.position.set(x, y, z); g.rotation.y = yaw; scene.add(g);
    setTimeout(() => { scene.remove(g); }, dur * 1000);
  }
  function triggerEvent(e) {
    e.fait = true; const pan = panOf(e.x, e.z);
    switch (e.nom) {
      case 'Ev_Fauteuil': SND.grincement(pan); moveGroup('obj:FauteuilRoulant', rr(-6, 6), 0, rr(4, 8), 2.5, 1.2); break;
      case 'Ev_Ballon': moveGroup('obj:Ballon', (P.x - e.x) * 0.4, 0, (P.z - e.z) * 0.4, 2.2); SND.pasMonstre(0.4, pan); msg('Un ballon roule vers toi…', 3); break;
      case 'Ev_Bougies': case 'Ev_Rituel': { const d = dyn[e.nom === 'Ev_Bougies' ? 'obj:Bougies' : 'obj:BougiesRituel']; if (d) { d.hide = true; d.grp.visible = false; setTimeout(() => { d.hide = false; d.grp.visible = true; }, 2600); } SND.souffle(); if (e.nom === 'Ev_Rituel') { const c = data.points.ss.find((p) => p[3] === 'CentreRituel'); if (c) setTimeout(() => apparition('Pendue', c[0], c[1] - 0.5, c[2], Math.atan2(P.x - c[0], P.z - c[2]), 2.2), 2600); } msg('Les bougies s\'éteignent toutes en même temps…', 3); break; }
      case 'Ev_Tiroir': moveGroup('obj:TiroirMorgue', 0, 0, 3.5, 0.5); SND.impact(); shake(0.05, 0.4); break;
      case 'Ev_Isolement': for (let k = 0; k < 6; k++) setTimeout(() => { SND.impact(); shake(0.04, 0.2); }, k * 330); msg('Quelque chose frappe contre le capitonnage…', 3); break;
      case 'Ev_Miroir': setTimeout(() => { screamerVisage('Patiente'); }, 300); break;
      case 'Ev_Silhouette': case 'Ev_Silhouette2': { const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw); apparition('Patiente', P.x + fx * 28, P.y, P.z + fz * 28, Math.atan2(-fx, -fz), 0.9); SND.murmure(); break; }
      case 'Ev_Telephone': SND.sonnerie(pan); setTimeout(() => SND.sonnerie(pan), 1600); phone = { t: 12, i: 0, x: e.x, z: e.z }; msg('Un téléphone sonne… (E pour décrocher)', 4); break;
      case 'Ev_Electro': { const d = dyn['obj:VoyantsElectro']; if (d) setGroupColor(d, 0xff2020); SND.generateur(); msg('La machine d\'électrothérapie s\'emballe…', 3); break; }
      case 'Ev_Cour': SND.tonnerre(); lightning(); break;
      case 'Ev_Escalier': for (let k = 0; k < 8; k++) setTimeout(() => SND.pasMonstre(0.35, rr(-0.3, 0.3)), k * 380); msg('Des pas, juste au-dessus de toi…', 3); break;
      case 'Ev_Cellule': for (let k = 0; k < 10; k++) setTimeout(() => { SND.impact(); const d = dyn['obj:PorteCellule']; if (d) d.grp.position.x = d.c[0] + (k % 2 ? 0.15 : -0.15); }, k * 160); break;
      case 'Ev_Four': moveGroup('obj:PorteFour', 0, 0, 0, 0.15, 1.4); SND.impact(); setTimeout(() => SND.cri(0.6), 500); shake(0.06, 0.6); break;
      case 'Ev_Froid': msg('Il fait soudain glacial… ton souffle fait de la buée.', 3); $('#givre').style.opacity = 0.6; setTimeout(() => ($('#givre').style.opacity = 0), 4000); break;
      default: SND.murmure();
    }
  }
  let phone = null;

  /* =============================================================== SCREAMERS & JUMPSCARES */
  let jsGroup = null;
  function screamerVisage(nm, dur) {
    if (S.dead) return; const def = SCREAM[nm] || SCREAM.Veilleur; const g = modelGroup(def, 2);
    const box = new T.Box3().setFromObject(g); const h = box.max.y - box.min.y;
    _v.set(0, 0, -1).applyQuaternion(camera.quaternion);
    placeFace(g, 1.6, P.yaw); scene.add(g);
    const fl = new T.PointLight(0xffffff, 1.6, 8); fl.position.copy(camera.position); scene.add(fl);
    SND.cri(1); shake(0.12, 0.6); $('#rouge').style.opacity = 0.5;
    setTimeout(() => { scene.remove(g); scene.remove(fl); $('#rouge').style.opacity = 0; }, (dur || 0.55) * 1000);
  }
  function placeFace(g, dist, yaw) { // place la tête du modèle juste devant la caméra
    const hd = g.userData.head || { x: 0, y: (g.userData.h || 8) * 0.9, z: 0 }; const c = Math.cos(yaw), s = Math.sin(yaw);
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
    g.rotation.y = yaw; g.position.set(camera.position.x + fx * dist - (hd.x * c + hd.z * s), camera.position.y - 0.15 - hd.y, camera.position.z + fz * dist - (-hd.x * s + hd.z * c));
  }
  function lightning() { $('#eclair').style.opacity = 0.55; setTimeout(() => ($('#eclair').style.opacity = 0.1), 90); setTimeout(() => ($('#eclair').style.opacity = 0.4), 180); setTimeout(() => ($('#eclair').style.opacity = 0), 330); }
  const MORT = { Veilleur: 'Le Veilleur', Rampante: 'La Rampante', Pantin: 'Le Pantin', Chirurgienne: 'La Chirurgienne', Rodeur: 'Le Rôdeur', Hurleur: 'Le Hurleur', Ombre: "L'Ombre" };
  function mort(nm, why) {
    if (S.dead || S.won) return; S.dead = true; S.morts++;
    S.cache = null; showPrompt(null);
    const g = modelGroup(SCREAM[nm] || SCREAM.Veilleur, 2.2); const box = new T.Box3().setFromObject(g); const h = box.max.y - box.min.y;
    P.pitch = 0; placeFace(g, 6, P.yaw); scene.add(g); jsGroup = g;
    const fl = new T.PointLight(0xffe0d0, 2, 12); fl.position.copy(camera.position); scene.add(fl);
    const t0 = perfT; anims.push((t) => { const k = clamp((t - t0) / 0.35, 0, 1); placeFace(g, lerp(6, 1.9, k), P.yaw); return k >= 1; });
    SND.cri(1.2); shake(0.18, 1.2); $('#rouge').style.opacity = 0.65;
    for (const k in monsters) if (monsters[k].nm === nm) monsters[k].grp.visible = false;
    setTimeout(() => {
      scene.remove(fl); $('#rouge').style.opacity = 0;
      $('#mort-t').textContent = (MORT[nm] || 'Quelque chose') + ' t\'a attrapé.'; $('#mort-why').textContent = why || conseil(nm);
      $('#mort').hidden = false; exitLock();
      if (jsGroup) { scene.remove(jsGroup); jsGroup = null; }
    }, 1500);
  }
  function conseil(nm) {
    return { Veilleur: 'Quand il s\'arrête pour te fixer, fuis et casse sa ligne de vue.', Rampante: 'Elle est aveugle mais entend tout : ne cours jamais près d\'elle.', Pantin: 'Ne le quitte jamais des yeux : il ne bouge que quand tu ne le regardes pas.', Chirurgienne: 'Elle fait sa ronde au 2e étage : cache-toi dans un casier avant qu\'elle te voie.' }[nm] || 'Cache-toi dans un casier quand la sirène retentit.';
  }

  /* =============================================================== INTERACTIONS */
  let prompt = null, holdT = 0;
  function findInteraction() {
    if (S.dead || S.won) return null;
    if (S.cache) return { label: 'Sortir du casier', act: () => sortirCasier(), hold: 0 };
    const px = P.x, py = P.y + 2.5, pz = P.z; let best = null, bd = 1e9;
    const consider = (d, o) => { if (d < bd) { bd = d; best = o; } };
    _v.set(0, 0, -1).applyQuaternion(camera.quaternion);
    const facing = (x, y, z) => { const dx = x - camera.position.x, dy = y - camera.position.y, dz = z - camera.position.z, d = Math.hypot(dx, dy, dz); return (dx * _v.x + dy * _v.y + dz * _v.z) / d; };
    for (const p of pickups) { const d = Math.hypot(p.x - px, (p.y - py) * 0.7, p.z - pz); if (d < 5.5 && facing(p.x, p.y, p.z) > 0.55) consider(d, { label: { fusible: 'Prendre le fusible', faux: 'Prendre le fusible', pile: 'Prendre la pile', cle: 'Prendre la clé rouillée' }[p.kind], hold: p.kind === 'fusible' || p.kind === 'faux' ? 0.7 : 0.2, act: () => take(p) }); }
    for (const n of notes) { const d = Math.hypot(n.x - px, (n.y - py) * 0.7, n.z - pz); if (d < 5.5 && facing(n.x, n.y, n.z) > 0.55) consider(d + 0.5, { label: 'Lire la note', hold: 0, act: () => lireNote(n) }); }
    for (const L of lockers) { const d = Math.hypot(L.x + L.fx * 1.5 - px, L.z + L.fz * 1.5 - pz); if (d < 4.2 && Math.abs(L.y - P.y) < 3 && facing(L.x, L.y + 4, L.z) > 0.4) consider(d + 1, { label: 'Se cacher', hold: 0, act: () => entrerCasier(L) }); }
    if (gen && Math.hypot(gen.x - px, gen.z - pz) < 8.5 && Math.abs(gen.y - py) < 6) {
      if (S.fusPortes > 0) consider(1, { label: `Remettre ${S.fusPortes > 1 ? 'les fusibles' : 'le fusible'} (${S.fusInseres + S.fusPortes}/5)`, hold: 1.0, act: () => inserer() });
      else if (!S.courant) consider(3, { label: `Générateur : ${S.fusInseres}/5 fusibles`, hold: 99, act: () => {} });
    }
    const porte = dyn['ss:PorteSalle0']; if (porte && !S.salle0 && Math.hypot(porte.c[0] - px, porte.c[2] - pz) < 6 && Math.abs(porte.c[1] - py) < 8) consider(2, { label: S.cle ? 'Ouvrir la Salle 0' : 'Fermée à clé…', hold: S.cle ? 0.8 : 99, act: () => { setSalle0(true); SND.grincement(0); msg('La porte de la Salle 0 grince en s\'ouvrant…', 3); } });
    if (phone && Math.hypot(phone.x - px, phone.z - pz) < 7) consider(1, { label: 'Décrocher le téléphone', hold: 0, act: () => decrocher() });
    return best;
  }
  function take(p) {
    scene.remove(p.mesh); pickups.splice(pickups.indexOf(p), 1); SND.ping();
    if (p.kind === 'fusible') {
      S.fusTrouves++; S.fusPortes++; noise(P.x, P.y, P.z, 1, 'fort');
      msg(`Fusible trouvé ! (${S.fusTrouves}/5) — apporte-le au GÉNÉRATEUR.`, 4, 'bon');
      if (p.salle0) { msg('Le fusible de la cage… Quelque chose hurle dans le crématorium. REMONTE !', 5, 'alerte'); salle0Scene(); }
      checkWakes();
    } else if (p.kind === 'faux') {
      SND.cri(0.8); shake(0.1, 0.8); $('#rouge').style.opacity = 0.5; setTimeout(() => ($('#rouge').style.opacity = 0), 600);
      msg('C\'était un PIÈGE ! Le faux fusible a hurlé… ils t\'ont entendu.', 5, 'alerte'); noise(P.x, P.y, P.z, 2.5, 'fort');
      for (const nm in monsters) { const M = monsters[nm]; if (M.state === 'sommeil' && R() < 0.5) wake(nm, true); }
    } else if (p.kind === 'pile') { S.cam = Math.min(CFG.cam.bat, S.cam + CFG.cam.pile); msg('Pile trouvée : caméscope rechargé.', 3, 'bon'); }
    else if (p.kind === 'cle') { S.cle = true; msg('Une clé rouillée… marquée « SALLE 0 ».', 4, 'bon'); }
  }
  function salle0Scene() {
    const M = monsters.Veilleur; if (!M) return; const pv = data.points.ss.find((p) => p[3] === 'PointVeilleur');
    if (pv) { M.x = pv[0]; M.z = pv[2]; const g = W.ground(pv[0], pv[2], pv[1] + 2, 0.5); M.y = isFinite(g) ? g : pv[1] - 1; }
    M.state = 'chasse'; M.lastSeen = S.time + 6; M.lk = { x: P.x, y: P.y, z: P.z }; M.chaseT = -10; M.path = null; M.repit = 0; M.grp.visible = true;
    SND.cri(0.9); shake(0.08, 1.5);
  }
  function inserer() {
    S.fusInseres += S.fusPortes; S.fusPortes = 0; SND.generateur(); noise(gen.x, gen.y, gen.z, 1.2, 'fort');
    gen.slots.forEach((s, i) => setGroupColor(s, i < S.fusInseres ? 0xffc61a : 0x222222));
    if (S.fusInseres >= CFG.fuses) {
      S.courant = true; setGroupColor(gen.voyant, 0x30ff60); openGate(true); coupure.phase = 0; $('#compte').hidden = true; setLampMode('normal');
      msg('LE COURANT EST REVENU ! Le portail de la cour est ouvert… COURS !', 7, 'alerte'); SND.cri(0.5); shake(0.06, 1);
      for (const nm in monsters) { const M = monsters[nm]; if (M.state === 'sommeil') wake(nm, true); }
    } else msg(`Fusibles au générateur : ${S.fusInseres}/5`, 4, 'bon');
  }
  function entrerCasier(L) {
    S.cache = Object.assign(L, { yaw: Math.atan2(-L.fx, -L.fz) + Math.PI });
    // un monstre te voit-il entrer ?
    S.cacheVu = false; for (const nm in monsters) { const M = monsters[nm]; if (M.state !== 'sommeil' && M.C.type === 'chasseur' && !M.C.aveugle) { S.cache = null; const v = sees(M, M.C.vuCache, 180, true); S.cache = L; if (v) { S.cacheVu = true; M.sawHide = true; M.state = 'chasse'; M.chaseT = 0; M.lastSeen = S.time; } } }
    P.yaw = S.cache.yaw; P.pitch = 0; SND.grincement(0); $('#casier').hidden = false;
  }
  function sortirCasier() { const L = S.cache; S.cache = null; S.retenu = false; P.x = L.x + L.fx * 2.6; P.z = L.z + L.fz * 2.6; P.y = L.y; SND.grincement(0); $('#casier').hidden = true; }
  function lireNote(n) { n.lu = true; const t = TXT.notes[(n.i - 1) % TXT.notes.length]; $('#note-t').textContent = t[0]; $('#note-x').textContent = t[1]; openPanel('#note'); SND.clic(); }
  function decrocher() { const p = phone; phone = null; let i = 0; const next = () => { if (i < TXT.telephone.length) { msg('📞 ' + TXT.telephone[i++], 3.2, 'tel'); setTimeout(next, 3300); } else { SND.impact(); } }; next(); }

  /* =============================================================== OUTILS DU JOUEUR */
  function toggleLampe() { if (S.cache) return; S.lampe = !S.lampe && S.bat > 1; SND.clic(); }
  function toggleCam() { if (S.cam <= 0 && !S.camOn) { msg('Le caméscope est vide. Trouve des piles vertes.', 3); return; } S.camOn = !S.camOn; SND.clic(); $('#vision').hidden = !S.camOn; }
  function doFlash() {
    if (S.flashT > 0 || S.cam < CFG.flash.cout) { msg(S.cam < CFG.flash.cout ? 'Pas assez de batterie pour le flash.' : 'Le flash se recharge…', 2); return; }
    S.cam -= CFG.flash.cout; S.flashT = CFG.flash.recharge; SND.flash(); $('#eclair').style.opacity = 0.9; setTimeout(() => ($('#eclair').style.opacity = 0), 140);
    _v.set(0, 0, -1).applyQuaternion(camera.quaternion);
    for (const nm in monsters) { const M = monsters[nm]; if (M.C.aveugle || M.state === 'sommeil') continue; const dx = M.x - P.x, dy = M.y + 5 - camera.position.y, dz = M.z - P.z, d = Math.hypot(dx, dy, dz); if (d < CFG.flash.portee && (dx * _v.x + dy * _v.y + dz * _v.z) / d > 0.45 && !W.blocked(camera.position.x, camera.position.y, camera.position.z, M.x, M.y + 5, M.z)) { M.stun = CFG.flash.duree; if (M.C.type === 'chasseur') { M.state = 'patrouille'; M.repit = 6; M.path = null; } msg(M.C.nom + ' est ébloui !', 2, 'bon'); } }
  }
  function updateTools(dt) {
    if (S.lampe) { S.bat -= dt * (S.role === 'Electricien' ? 0.5 : 1); if (S.bat <= 0) { S.bat = 0; S.lampe = false; msg('Ta lampe s\'est éteinte… elle se recharge.', 3); } }
    else S.bat = Math.min(S.batMax, S.bat + CFG.batRec * dt);
    const lowBat = S.bat < 20;
    flash.intensity = S.lampe && !S.cache ? (lowBat && R() < 0.08 ? 0.3 : 2.2 * (lowBat ? 0.6 + S.bat / 50 : 1)) : 0;
    if (S.camOn) { S.cam -= dt; if (S.cam <= 0) { S.cam = 0; S.camOn = false; $('#vision').hidden = true; msg('Caméscope déchargé.', 2); } }
    AMB.intensity = S.camOn ? 3.2 : 0.55; AMB.color.set(S.camOn ? 0x7dff8a : 0x2a2c34);
    scene.fog.density = S.camOn ? 0.012 : (lampMode === 'noir' ? 0.035 : 0.022);
    if (S.flashT > 0) S.flashT -= dt; if (S.adren > 0) S.adren -= dt; if (S.indice > 0) S.indice -= dt;
  }
  function updateEsprit(dt, nearest) {
    const lit = litAt(P.x, P.y + 3, P.z) > 0.25 || S.courant;
    let d = 0; if (CFG.hall(P)) d = CFG.esprit.hall; else if (lit) d = CFG.esprit.lumiere; else if (!S.lampe) d = -CFG.esprit.noir;
    if (nearest < 25) d -= CFG.esprit.monstre * (1 - nearest / 25) * 1.5;
    S.esprit = clamp(S.esprit + d * dt, 0, 100);
    if (S.esprit < 35) { timers.murmure -= dt * 2; }
  }

  /* =============================================================== PEURS ALÉATOIRES */
  function updateFrights(dt) {
    timers.screamer -= dt; timers.orage -= dt; timers.murmure -= dt; timers.peur -= dt;
    if (timers.orage <= 0) { timers.orage = rr(25, 60); SND.tonnerre(); if (P.y > -3) lightning(); }
    if (timers.murmure <= 0) { timers.murmure = rr(25, 60); SND.murmure(); if (S.esprit < 60 || R() < 0.4) msg('« ' + TXT.murmures[Math.floor(R() * TXT.murmures.length)] + ' »', 2.5, 'murmure'); }
    if (timers.peur <= 0) { timers.peur = rr(35, 80); const k = R(); if (k < 0.4) { for (let i = 0; i < 4; i++) setTimeout(() => SND.pas(false), i * 300); } else if (k < 0.7) SND.grincement(rr(-1, 1)); else SND.impact(); }
    if (timers.screamer <= 0 && !S.cache && !S.dead && coupure.phase === 0) { timers.screamer = rr(CFG.screamers.min, CFG.screamers.max) * (P.y < -6 ? 0.6 : 1); const list = ['Patiente', 'Pendue', 'Veilleur', 'Rampante', 'Pantin']; screamerVisage(list[Math.floor(R() * list.length)], 0.5); }
  }

  /* =============================================================== HUD & INTERFACE */
  let msgT = 0;
  function msg(t, d, style) { const el = $('#msg'); el.textContent = t; el.className = 'msg ' + (style || ''); el.style.opacity = 1; msgT = d || 3; }
  function showPrompt(p) {
    const el = $('#prompt'); if (!p) { el.hidden = true; if (isTouch) $('#b-e').classList.remove('on'); return; }
    el.hidden = false; $('#prompt-t').textContent = p.label; $('#prompt-k').textContent = isTouch ? 'MAIN' : 'E';
    $('#prompt-bar').style.width = p.hold >= 99 ? '0%' : clamp(holdT / (p.hold || 0.0001), 0, 1) * 100 + '%'; if (isTouch) $('#b-e').classList.add('on');
  }
  function hud(dt, nearest) {
    $('#h-fus').textContent = `${S.fusInseres}/5` + (S.fusPortes ? ` (+${S.fusPortes} en main)` : '');
    $('#h-bat').style.width = (S.bat / S.batMax * 100) + '%'; $('#h-cam').style.width = (S.cam / CFG.cam.bat * 100) + '%';
    $('#h-sta').style.width = (S.adren > 0 ? 100 : S.stam / S.stamMax * 100) + '%'; $('#h-sta').classList.toggle('adr', S.adren > 0);
    $('#h-esp').style.width = S.esprit + '%';
    if (isTouch) $('#b-souffle').hidden = !S.cache;
    $('#h-cle').hidden = !S.cle; $('#h-souffle').hidden = !S.cache; $('#h-souffle-b').style.width = (S.souffle / CFG.souffle.duree * 100) + '%';
    $('#vis-bat').textContent = Math.ceil(S.cam) + ' s';
    if (msgT > 0) { msgT -= dt; if (msgT <= 0) $('#msg').style.opacity = 0; }
    // danger : vignette rouge + cœur
    const danger = clamp(1 - nearest / 30, 0, 1); $('#danger').style.opacity = danger * 0.8;
    heart.t -= dt; if (danger > 0.05 && heart.t <= 0) { heart.t = lerp(1.1, 0.35, danger); SND.coeur(0.3 + danger); }
    // folie
    $('#folie').style.opacity = S.esprit < 35 ? (35 - S.esprit) / 35 * 0.6 : 0;
    // guide vers le générateur / indices
    const mk = $('#marks'); let html = '';
    if (S.fusPortes > 0 && gen) html += mark(gen.x, gen.y + 2, gen.z, '⚡', 'gen');
    if (S.courant) html += mark(exitZone.x, exitZone.y, exitZone.z, 'SORTIE', 'gen');
    if (S.role === 'Enqueteur' || S.indice > 0) for (const p of pickups) if (p.kind === 'fusible' || (S.role === 'Enqueteur' && p.kind === 'faux')) { if (S.indice > 0 || Math.hypot(p.x - P.x, p.z - P.z) < 45) html += mark(p.x, p.y, p.z, '✦', 'fus'); }
    if (S.role === 'Enqueteur') for (const n of notes) if (!n.lu && Math.hypot(n.x - P.x, n.z - P.z) < 40) html += mark(n.x, n.y, n.z, '✉', 'note');
    mk.innerHTML = html;
  }
  const heart = { t: 0 };
  function mark(x, y, z, t, cls) {
    _v.set(x, y, z).project(camera); if (_v.z > 1) return '';
    const sx = (_v.x * 0.5 + 0.5) * innerWidth, sy = (-_v.y * 0.5 + 0.5) * innerHeight;
    if (sx < -40 || sx > innerWidth + 40 || sy < -40 || sy > innerHeight + 40) return '';
    const d = Math.round(Math.hypot(x - P.x, z - P.z));
    return `<span class="mk ${cls}" style="left:${sx}px;top:${sy}px">${t}<small>${d} m</small></span>`;
  }

  // ---------------- plan (M) ----------------
  function drawMap() {
    const c = $('#plan-c'), g = c.getContext('2d'), W2 = c.width, H2 = c.height;
    g.fillStyle = '#0d0f0d'; g.fillRect(0, 0, W2, H2);
    let zones = plan.z0, titre = 'REZ-DE-CHAUSSÉE';
    if (P.y > CFG.EY2 - 3) { zones = plan.z2; titre = '2e ÉTAGE — BLOC OPÉRATOIRE'; } else if (P.y > CFG.EY - 3) { zones = plan.z1; titre = '1er ÉTAGE — AILE PSYCHIATRIQUE'; }
    if (P.y < -6) { g.fillStyle = '#7a0000'; g.font = '34px Creepster, serif'; g.textAlign = 'center'; g.fillText('AUCUN PLAN DU SOUS-SOL', W2 / 2, H2 / 2); g.font = '16px Elite, serif'; g.fillStyle = '#9a9'; g.fillText('Tu es seul ici.', W2 / 2, H2 / 2 + 34); $('#plan-h').textContent = 'SOUS-SOL'; return; }
    $('#plan-h').textContent = titre;
    const x0 = -128, x1 = 206, z0 = -92, z1 = 42, sc = Math.min((W2 - 20) / (x1 - x0), (H2 - 20) / (z1 - z0));
    const X = (x) => 10 + (x - x0) * sc, Z = (z) => 10 + (z1 - z) * sc;
    const col = { couloir: '#2b302b', salle: '#1e2420', depart: '#1d3a27', cour: '#232a33', sortie: '#3a3215', escalier: '#33281e', generateur: '#3a2a12' };
    for (const z of zones) {
      g.fillStyle = col[z[5]] || '#222'; g.fillRect(X(z[1]), Z(z[4]), (z[3] - z[1]) * sc, (z[4] - z[2]) * sc);
      g.strokeStyle = '#4a554a'; g.lineWidth = 1; g.strokeRect(X(z[1]), Z(z[4]), (z[3] - z[1]) * sc, (z[4] - z[2]) * sc);
      g.fillStyle = z[5] === 'generateur' ? '#ffc61a' : '#a9b8a6'; g.font = `${Math.max(8, Math.min(12, sc * 3.2))}px Elite, serif`; g.textAlign = 'center';
      const lines = z[0].split(' '); const cx = X((z[1] + z[3]) / 2), cy = Z((z[2] + z[4]) / 2);
      if (z[3] - z[1] > 60) g.fillText(z[0], cx, cy + 4); else lines.slice(0, 3).forEach((l, i) => g.fillText(l, cx, cy + (i - (Math.min(3, lines.length) - 1) / 2) * 12 + 4));
    }
    // joueur
    g.save(); g.translate(X(P.x), Z(P.z)); g.rotate(-P.yaw + Math.PI); g.fillStyle = '#ff4040'; g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 7); g.lineTo(-6, 7); g.closePath(); g.fill(); g.restore();
  }
  function openPanel(sel) { for (const s of ['#note', '#plan', '#guide', '#pause']) $(s).hidden = s !== sel; if (sel === '#plan') drawMap(); exitLock(); S.paused = true; }
  function closePanels() { for (const s of ['#note', '#plan', '#guide', '#pause']) $(s).hidden = true; S.paused = false; lockPointer(); last = performance.now(); }
  function buildGuide() {
    $('#guide-x').innerHTML = TXT.guide.map(([t, x]) => `<h3>${t}</h3><p>${x.replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>`).join('');
  }

  /* =============================================================== ENTRÉES */
  function lockPointer() { if (!isTouch && S.started && !S.dead && !S.won) { try { $('#c').requestPointerLock(); } catch (e) {} } }
  function exitLock() { if (document.pointerLockElement) document.exitPointerLock(); }
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && S.started && !S.dead && !S.won && !S.paused && !isTouch) openPanel('#pause'); });
  document.addEventListener('mousemove', (e) => { if (document.pointerLockElement === $('#c')) { look.dx += e.movementX; look.dy += e.movementY; } });
  $('#c').addEventListener('click', () => { audioInit(); if (S.started && !S.paused) lockPointer(); });
  addEventListener('keydown', (e) => {
    keys[e.code] = true; if (!S.started || S.dead || S.won) return;
    if (e.code === 'Escape' && S.paused) { closePanels(); return; }
    if (S.paused) { const k = (e.key || '').toLowerCase(); if ((k === 'm' || k === 'tab') && !$('#plan').hidden) { closePanels(); e.preventDefault(); } if (k === 'g' && !$('#guide').hidden) closePanels(); if ((k === 'e' || e.code === 'Space') && !$('#note').hidden) { keys.KeyE = false; closePanels(); } return; }
    const k = (e.key || '').toLowerCase();
    if (k === 'f') toggleLampe(); else if (k === 'v') toggleCam(); else if (k === 'r') doFlash();
    else if (k === 'm' || k === 'tab') { openPanel('#plan'); e.preventDefault(); } else if (k === 'g') openPanel('#guide'); else if (k === 'p') openPanel('#pause');
    if (e.code === 'Space') { if (S.cache && S.souffle > 0.5) S.retenu = true; e.preventDefault(); }
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; if (e.code === 'Space') S.retenu = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  // ---------------- tactile ----------------
  let runTouch = false;
  function setupTouch() {
    $('#touch').hidden = false; const jz = $('#joy'), jk = $('#joy-k'); let jid = null, jx = 0, jy = 0, lid = null, lx = 0, ly = 0;
    jz.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; jid = t.identifier; const r = jz.getBoundingClientRect(); jx = r.left + r.width / 2; jy = r.top + r.height / 2; joy.on = true; e.preventDefault(); }, { passive: false });
    const cv = $('#c');
    cv.addEventListener('touchstart', (e) => { audioInit(); for (const t of e.changedTouches) if (lid === null) { lid = t.identifier; lx = t.clientX; ly = t.clientY; } }, { passive: true });
    addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === jid) { const dx = t.clientX - jx, dy = t.clientY - jy, d = Math.hypot(dx, dy), m = 50; const k = d > m ? m / d : 1; joy.x = dx * k / m; joy.y = dy * k / m; jk.style.transform = `translate(${dx * k}px,${dy * k}px)`; }
        if (t.identifier === lid) { look.dx += (t.clientX - lx) * 2.2; look.dy += (t.clientY - ly) * 2.2; lx = t.clientX; ly = t.clientY; }
      }
    }, { passive: true });
    const end = (e) => { for (const t of e.changedTouches) { if (t.identifier === jid) { jid = null; joy.on = false; joy.x = joy.y = 0; jk.style.transform = ''; } if (t.identifier === lid) lid = null; } };
    addEventListener('touchend', end); addEventListener('touchcancel', end);
    const btn = (id, down, up) => { const b = $(id); b.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); audioInit(); down(); }, { passive: false }); if (up) b.addEventListener('touchend', (e) => { e.preventDefault(); up(); }); };
    btn('#b-e', () => (keys.KeyE = true), () => (keys.KeyE = false));
    btn('#b-run', () => { runTouch = !runTouch; $('#b-run').classList.toggle('on', runTouch); });
    btn('#b-lampe', toggleLampe); btn('#b-cam', toggleCam); btn('#b-flash', doFlash);
    btn('#b-plan', () => openPanel('#plan')); btn('#b-menu', () => openPanel('#pause'));
    btn('#b-souffle', () => { if (S.cache && S.souffle > 0.5) S.retenu = true; }, () => (S.retenu = false));
  }

  /* =============================================================== BOUCLE */
  let last = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    if (window.__SA && __SA.hold) { last = now; return; }
    let dt = Math.min(0.05, (now - last) / 1000); last = now; perfT = now / 1000;
    if (!S.started) { renderer.render(scene, camera); return; }
    // regard
    const sens = 0.0022 * (+($('#sens').value || 1));
    P.yaw -= look.dx * sens; P.pitch = clamp(P.pitch - look.dy * sens, -1.35, 1.35); look.dx = look.dy = 0;
    if (!S.paused && !S.dead && !S.won) { tick(dt); adapt(dt); }
    for (let i = anims.length - 1; i >= 0; i--) if (anims[i](perfT)) anims.splice(i, 1);
    for (const p of pickups) { p.t += dt; p.mesh.rotation.y += dt * 1.5; p.mesh.children[p.mesh.children.length - 1].scale.setScalar(1 + Math.sin(p.t * 3) * 0.15); }
    for (const s of ['G', 'D']) { const d = dyn['gate:Portail' + s]; if (d && d.target != null) d.grp.position.z = lerp(d.grp.position.z, d.c[2] + d.target, dt * 0.8); }
    camUpdate(dt); updateLightPool(); cullT -= dt; if (cullT <= 0) { cullT = 0.25; cullUpdate(); }
    renderer.render(scene, camera);
  }
  // résolution automatique : baisse la définition si l'ordinateur rame, la remonte s'il est à l'aise
  const AD = { t: 0, n: 0, px: null };
  function adapt(dt) {
    if (document.hidden) return; AD.t += dt; AD.n++;
    if (AD.t < 2.5) return; const fps = AD.n / AD.t; AD.t = 0; AD.n = 0;
    if (AD.px == null) AD.px = renderer.getPixelRatio();
    let np = AD.px; if (fps < 40 && AD.px > 0.5) np = Math.max(0.5, AD.px * 0.8); else if (fps > 57 && AD.px < Q.px) np = Math.min(Q.px, AD.px * 1.12);
    if (Math.abs(np - AD.px) > 0.01) { AD.px = np; renderer.setPixelRatio(np); renderer.setSize(innerWidth, innerHeight); try { localStorage.setItem('sa_px', np.toFixed(2)); } catch (e) {} }
  }
  function tick(dt) {
    {
      S.time += dt;
      updatePlayer(dt); updateTools(dt); updateLamps(dt);
      checkWakes();
      const { nearest } = updateMonsters(dt);
      updateCoupure(dt); updateHurleur(dt); updateOmbre(dt); updateFrights(dt); updateEsprit(dt, nearest);
      for (const e of evs) if (!e.fait && inBox(P, e, 1)) triggerEvent(e);
      if (phone) { phone.t -= dt; if (phone.t <= 0) phone = null; }
      // interaction
      const it = findInteraction(); prompt = it;
      if (it && (keys.KeyE) && it.hold < 99) { holdT += dt; if (holdT >= it.hold) { holdT = 0; keys.KeyE = isTouch ? false : keys.KeyE; const a = it.act; a(); if (!isTouch) keys.KeyE = false; } } else holdT = 0;
      showPrompt(it);
      if (S.courant && inBox(P, exitZone, 1)) victoire();
      hud(dt, nearest);
      // souffle (sons)
      if (S.essouffle && R() < dt * 1.5) SND.souffle();
      if (AU.drone) AU.drone.gain.value = lerp(AU.drone.gain.value, coupure.phase === 2 ? 0.02 : 0.12, dt);
    }
  }

  function victoire() {
    S.won = true; exitLock(); const t = S.time; const m = Math.floor(t / 60), s = Math.floor(t % 60);
    let best = null; try { best = +localStorage.getItem('sa_best') || null; if (!best || t < best) { localStorage.setItem('sa_best', t); best = t; } } catch (e) {}
    $('#vic-t').textContent = `Tu t'es échappé en ${m} min ${String(s).padStart(2, '0')} s.`;
    $('#vic-b').textContent = best ? `Meilleur temps : ${Math.floor(best / 60)} min ${String(Math.floor(best % 60)).padStart(2, '0')} s` : '';
    $('#victoire').hidden = false; SND.generateur();
  }

  /* =============================================================== MENUS */
  function startGame(role) {
    S.role = role; S.batMax = role === 'Electricien' ? CFG.batMax * 2 : CFG.batMax; S.stamMax = role === 'Infirmiere' ? CFG.stamMax * 1.6 : CFG.stamMax;
    newNight(false); S.bat = S.batMax; S.stam = S.stamMax;
    $('#menu').hidden = true; $('#hud').hidden = false; $('#aide').hidden = isTouch; S.started = true; S.paused = false; audioInit(); lockPointer();
    msg('Trouve les 5 fusibles. Appuie sur G pour le guide, M pour le plan.', 6);
    if (isTouch) msg('Trouve les 5 fusibles. Bouton ☰ : guide et plan.', 6);
  }
  function revivre() {
    // on garde les fusibles, retour au hall
    $('#mort').hidden = true; S.dead = false; Object.assign(P, { x: -104, y: 0.2, z: 0, yaw: -Math.PI / 2, pitch: 0 });
    for (const nm in monsters) { const M = monsters[nm]; M.grp.visible = true; if (M.state !== 'sommeil') { M.state = 'patrouille'; M.repit = 20; M.path = null; M.sawHide = false; if (Math.hypot(M.x + 90, M.z) < 60 && M.y < 10) { M.x = M.home.x; M.y = M.home.y; M.z = M.home.z; } } }
    if (coupure.phase === 2) { coupure.phase = 0; timers.coupure = 60; setLampMode('normal'); if (coupure.rod) coupure.rod.visible = false; }
    hurl.phase = 0; if (hurl.m) hurl.m.visible = false; for (const L of lamps) L.hurl = false; timers.hurleur = rr(120, 200);
    ombre.on = false; if (ombre.grp) ombre.grp.visible = false; S.esprit = 70; S.bat = S.batMax; S.lampe = true;
    S.paused = false; lockPointer(); msg('Tu te réveilles dans le hall… tu as gardé tes fusibles.', 5);
  }
  function rejouer() { $('#mort').hidden = true; $('#victoire').hidden = true; S.nuit++; newNight(false); S.paused = false; lockPointer(); msg(`Nuit ${S.nuit}. Les fusibles ont changé de place.`, 5); if (window.PPAds) PPAds.inter('sa_nouvelle_nuit'); }
  function bonus(kind) {
    if (!window.PPAds) return grant(kind, 'free');
    PPAds.reward('sa_' + kind, (ok, why) => { if (ok) grant(kind, why); else msg('Regarde la pub jusqu\'au bout pour avoir le bonus.', 3); });
  }
  function grant(kind, why) {
    if (kind === 'revivre') { revivre(); return; }
    if (kind === 'piles') { S.bat = S.batMax; S.cam = CFG.cam.bat; msg('🔋 Piles neuves : lampe et caméscope à 100 %.', 4, 'bon'); }
    if (kind === 'adrenaline') { S.adren = 45; msg('💉 Adrénaline : 45 secondes de course illimitée !', 4, 'bon'); }
    if (kind === 'indice') { S.indice = 30; msg('🔍 Indice : les fusibles apparaissent pendant 30 secondes.', 4, 'bon'); }
    closePanels();
  }
  function setQuality(q) {
    try { localStorage.setItem('sa_q', q); } catch (e) {}
    Q = q === 'haute' ? { px: Math.min(devicePixelRatio || 1, 1.5), lights: 8 } : q === 'moyenne' ? { px: 1, lights: 6 } : { px: 0.75, lights: 4 };
    renderer.setPixelRatio(Q.px); renderer.setSize(innerWidth, innerHeight); AD.px = Q.px; try { localStorage.removeItem('sa_px'); } catch (e) {} for (let i = 0; i < pool.length; i++) pool[i].visible = true; // le nombre de lumières reste fixe (pas de recompilation)
    for (let i = Q.lights; i < pool.length; i++) pool[i].intensity = 0;
    $('#q-t').textContent = q.toUpperCase();
  }

  async function main() {
    const prog = (t, k) => { $('#load-t').textContent = t; $('#load-b').style.width = (k * 100) + '%'; };
    try { await build(prog); } catch (e) { $('#load-t').textContent = 'Erreur de chargement : ' + e.message; console.error(e); return; }
    buildGuide();
    Object.assign(P, { x: -104, y: 0.2, z: 0 }); camUpdate(0); updateLamps(0); updateLightPool();
    $('#load').hidden = true; $('#menu').hidden = false; $('#intro-x').textContent = TXT.intro;
    $('#roles').innerHTML = TXT.roles.map((r) => `<button class="role" data-r="${r.id}"><b>${r.nom}</b><span>${r.desc}</span></button>`).join('');
    document.querySelectorAll('.role').forEach((b) => b.addEventListener('click', () => startGame(b.dataset.r)));
    $('#q-t').textContent = (localStorage.getItem('sa_q') || (isTouch ? 'moyenne' : 'haute')).toUpperCase();
    if (isTouch) setupTouch();
    // boutons
    const on = (sel, f) => $(sel).addEventListener('click', f);
    on('#note-ok', closePanels); on('#plan-ok', closePanels); on('#guide-ok', closePanels); on('#reprendre', closePanels);
    on('#p-guide', () => openPanel('#guide')); on('#p-plan', () => openPanel('#plan'));
    on('#q-btn', () => { const order = ['haute', 'moyenne', 'basse']; const cur = (localStorage.getItem('sa_q') || 'haute'); setQuality(order[(order.indexOf(cur) + 1) % 3]); });
    on('#bn-piles', () => bonus('piles')); on('#bn-adr', () => bonus('adrenaline')); on('#bn-ind', () => bonus('indice'));
    on('#m-revivre', () => bonus('revivre')); on('#m-rejouer', rejouer); on('#v-rejouer', rejouer);
    on('#p-quitter', () => { location.href = '../../sainte-agathe/'; });
    addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
    requestAnimationFrame(loop);
    window.__SA = { keys, tick: (dt, n) => { for (let i = 0; i < (n || 1); i++) { perfT += dt; camUpdate(dt); tick(dt); for (let j = anims.length - 1; j >= 0; j--) if (anims[j](perfT)) anims.splice(j, 1); } }, snap: (q) => { camUpdate(0); updateLamps(0); updateLightPool(); cullUpdate(); renderer.render(scene, camera); return renderer.domElement.toDataURL('image/jpeg', q || 0.85); }, S, P, monsters, W, NAV, pickups, lockers, notes, wake, mort, take, camera, scene, renderer, coupure, timers, dyn, lamps, inserer, startGame, setLampMode };
  }
  main();
})();
