// The Gilded Wake — ships: classes, looks, peers, NPC fleets (simulated by the room host),
// damage (holes, fire, flooding, torn sails, broken masts), ramming, sinking break-up,
// anchors, jolly boats, grappling hooks, ammunition types and gunnery.
const org = seaOff;                 // render origin in ocean coords (floating origin)
const dOrg = new THREE.Vector2(), lastOrg = new THREE.Vector2();
const shipO = new THREE.Vector2();  // my ship's ocean position
const ENTS = new Map();             // id -> ship entity (peers 'p:<id>', npcs 'n:<id>', rowboats 'r:<id>')
const balls = [];
const MV = 74, RELOAD = 4.5;

/* avatars, weapons and tools live in art.js */

/* ---------- ship classes, stats and looks ---------- */
function shipStats(rec) {
  const c = SHIP_CLASSES[rec.cls], u = rec.up || {};
  return { cls: rec.cls, c, max: Math.round(c.hp * (1 + 0.25 * (u.hull || 0))), speed: c.speed * (1 + 0.07 * (u.sail || 0)), turn: c.turn * (1 + 0.15 * (u.rud || 0)),
    guns: c.guns ? c.guns + (u.guns || 0) : 0, scale: c.scale, slots: Math.round(c.slots * (1 + 0.5 * (u.hold || 0))), crewMax: c.crew };
}
function gunLayout(n) {           // template-local gun positions per side, first three are the real cannons
  const zs = [-5.5, -2.5, 1.0, -8.0, 3.6, -10.2, 5.4, -12.0, 7.4].slice(0, n), out = [];
  for (const sg of [1, -1]) zs.forEach((z, i) => out.push({ sg, z, real: i < 3 ? (sg > 0 ? i : 3 + i) : -1, x: sg * (hw(z) * 0.962 + 0.05), y: DECK + 0.62 }));
  return out;
}
const flagTexCache = new Map();
function flagTexture(design, color) {
  const key = design + color; if (flagTexCache.has(key)) return flagTexCache.get(key);
  const [c, g] = cnv(256, 160); g.fillStyle = '#141012'; g.fillRect(0, 0, 256, 160);
  g.fillStyle = color; g.strokeStyle = color; g.lineCap = 'round';
  if (design === 'skull' || !design) { g.drawImage(flagCanvas(), 0, 0); }
  else if (design === 'swords') { g.lineWidth = 9; g.beginPath(); g.moveTo(70, 40); g.lineTo(186, 130); g.moveTo(186, 40); g.lineTo(70, 130); g.stroke(); g.fillRect(60, 120, 30, 10); g.fillRect(166, 120, 30, 10); g.beginPath(); g.arc(128, 60, 20, 0, TAU); g.fill(); }
  else if (design === 'hourglass') { g.beginPath(); g.moveTo(90, 30); g.lineTo(166, 30); g.lineTo(128, 80); g.lineTo(166, 130); g.lineTo(90, 130); g.lineTo(128, 80); g.closePath(); g.fill(); g.fillRect(80, 22, 96, 8); g.fillRect(80, 130, 96, 8); }
  else if (design === 'heart') { g.beginPath(); g.moveTo(128, 130); g.bezierCurveTo(40, 70, 80, 20, 128, 55); g.bezierCurveTo(176, 20, 216, 70, 128, 130); g.fill(); g.fillStyle = '#e9e2d0'; g.fillRect(118, 20, 6, 120); }
  g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.moveTo(256, 0); for (let y = 0; y <= 160; y += 10) g.lineTo(256 - Math.random() * 20 - (y > 90 ? 14 : 0), y); g.lineTo(256, 160); g.fill();
  const t = mkTex(c, false); flagTexCache.set(key, t); return t;
}
/* rowboat model: a clinker-built hull lofted from cross-sections (bow toward -z) */
const ROWG = (() => {
  const N = 22, M = 14, T = 0.035;
  const st = t => { // t: 0 bow → 1 stern; returns half-beam, keel height, sheer height, z
    const z = lerp(-2.25, 2.05, t);
    const b = 0.74 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.8 + 0.04)), 0.55) * (t > 0.9 ? 1 : 1) + (t > 0.85 ? (t - 0.85) * 0.2 : 0);
    const k = -0.26 + 0.2 * Math.pow(1 - t, 3) + 0.05 * Math.pow(t, 4);
    const sh = 0.44 + 0.2 * Math.pow(1 - t, 2.5) + 0.06 * Math.pow(t, 3);
    return { z, b: t < 0.02 ? 0.01 : b, k, sh };
  };
  const shell = (inset) => { const pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) { const t = i / N, S = st(t); for (let j = 0; j <= M; j++) { const u = j / M * 2 - 1; const bb = Math.max(0.005, S.b - inset), kk = S.k + inset;
        const y = kk + (S.sh - kk) * (1 - Math.sqrt(Math.max(0, 1 - u * u))); pos.push(bb * u * (1 + 0.04 * (1 - Math.abs(u))), Math.min(y, S.sh), S.z); uv.push(t * 4.3, j / M * 7); } }
    for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) { const a = i * (M + 1) + j, b = a + M + 1; if (inset) idx.push(a, a + 1, b, a + 1, b + 1, b); else idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g; };
  const hull = merge([shell(0), shell(T)]);
  // gunwale rails following the sheer, transom board, stem post and keel
  const rail = [], keelPts = [];
  for (const sx of [-1, 1]) { const P = []; for (let i = 0; i <= N; i++) { const S = st(i / N); P.push([sx * (S.b - T / 2), S.sh + 0.02, S.z]); } rail.push(tubeG(P, 0.035, 30, 5)); }
  for (let i = 0; i <= N; i++) { const S = st(i / N); keelPts.push([0, S.k - 0.03, S.z]); }
  rail.push(tubeG(keelPts, 0.04, 26, 5));
  const S1 = st(1), S0 = st(0.02);
  const tr = new THREE.Shape(); tr.moveTo(-S1.b, S1.sh); for (let j = 0; j <= 10; j++) { const u = j / 10 * 2 - 1; tr.lineTo(S1.b * u, S1.k + (S1.sh - S1.k) * (1 - Math.sqrt(1 - u * u))); } tr.closePath();
  const transom = new THREE.ExtrudeGeometry(tr, { depth: 0.05, bevelEnabled: false }); transom.translate(0, 0, S1.z - 0.02);
  const stem = tubeG([[0, S0.k - 0.02, S0.z + 0.05], [0, (S0.k + S0.sh) / 2, S0.z - 0.06], [0, S0.sh + 0.12, S0.z - 0.12]], 0.05, 8, 5);
  const floor = []; for (let i = 0; i < 7; i++) floor.push(xf(box(0.11, 0.025, 3.0), -0.33 + i * 0.11, -0.07, 0.05));
  const seats = [xf(box(1.36, 0.05, 0.28), 0, 0.17, -0.7), xf(box(1.42, 0.05, 0.28), 0, 0.17, 0.35), xf(box(1.12, 0.05, 0.5), 0, 0.2, 1.55)];
  for (const z of [-0.7, 0.35]) for (const sx of [-1, 1]) seats.push(xf(box(0.06, 0.25, 0.06), sx * 0.55, 0.05, z));
  const locks = []; for (const sx of [-1, 1]) { locks.push(xf(box(0.06, 0.08, 0.2), sx * 0.72, 0.49, -0.2), xf(cyl(0.012, 0.012, 0.16, 6), sx * 0.72, 0.6, -0.26), xf(cyl(0.012, 0.012, 0.16, 6), sx * 0.72, 0.6, -0.14)); }
  const oar = merge([xf(lathe([[0.001, -1.3], [0.022, -1.28], [0.026, -0.2], [0.03, 0.4], [0.024, 1.15], [0.03, 1.2], [0.001, 1.22]], 8), 0, 0, 0, 0, 0, -Math.PI / 2),
    xf(profile([[-0.08, 0], [0.08, 0], [0.09, 0.45], [0.0, 0.52], [-0.09, 0.45]], 0.014, 0.004), -1.25, 0, 0, 0, 0, Math.PI / 2)]);
  return { hull, rails: merge(rail), transom: merge([transom, stem]), floor: merge(floor), seats: merge(seats), locks: merge(locks), oar };
})();
const rowTex = canvasTex(256, 256, (g, w, h) => { for (let y = 0; y < h; y += 256 / 7) { const k = 0.85 + Math.random() * 0.25; g.fillStyle = `rgb(${190 * k},${150 * k},${105 * k})`; g.fillRect(0, y, w, 256 / 7);
  for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(60,35,15,${Math.random() * 0.2})`; g.fillRect(Math.random() * w, y + Math.random() * 30, 20 + Math.random() * 60, 1); } g.fillStyle = 'rgba(30,18,8,0.7)'; g.fillRect(0, y + 256 / 7 - 3, w, 3); g.fillStyle = 'rgba(255,230,190,0.18)'; g.fillRect(0, y, w, 2);
  for (let x = 8; x < w; x += 32) { g.fillStyle = 'rgba(40,30,20,0.6)'; g.beginPath(); g.arc(x + (y % 2) * 16, y + 256 / 7 - 6, 1.6, 0, TAU); g.fill(); } } });
function makeRowboat(color) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const hm = stdMat({ map: rowTex, color: new THREE.Color(color || '#ffffff'), roughness: 0.75, side: THREE.DoubleSide });
  const add = (g, m) => { const x = new THREE.Mesh(g, m); x.castShadow = x.receiveShadow = true; body.add(x); return x; };
  add(ROWG.hull, hm); add(ROWG.rails, CM.dwood); add(ROWG.transom, CM.dwood); add(ROWG.floor, BLD_WOOD()); add(ROWG.seats, CM.wood); add(ROWG.locks, CM.dsteel);
  const oL = new THREE.Group(), oR = new THREE.Group(); oL.position.set(-0.72, 0.6, -0.2); oR.position.set(0.72, 0.6, -0.2); oR.rotation.y = Math.PI; body.add(oL, oR);
  for (const o of [oL, oR]) { const m = new THREE.Mesh(ROWG.oar, CM.ash); m.position.x = -0.25; m.rotation.z = 0.32; m.castShadow = true; o.add(m); }
  return { root, body, oL, oR, scale: 1, row: true };
}
function rowOars(v, t, amt) { const a = Math.min(1, Math.abs(amt)), sw = Math.sin(t * 3) * 0.55 * a, dp = Math.cos(t * 3) * 0.18 * a; v.oL.rotation.set(0, sw, 0.0 + dp); v.oR.rotation.set(0, Math.PI - sw, -dp); }
function BLD_WOOD() { return BLD_WOOD.m || (BLD_WOOD.m = stdMat({ map: TEX.wood, color: 0x8a6a48, roughness: 0.85 })); }
/* lower gun decks for galleons and men-o'-war: a painted strake, open ports with red lids and run-out guns */
const GUNDECK = {};
function gunDeckGeo(rows) {
  if (GUNDECK[rows]) return GUNDECK[rows];
  const port = [], lid = [], muz = [], band = [];
  for (let r = 0; r < rows; r++) { const y = DECK - 0.95 - r * 0.95;
    for (let z = -9.2; z <= 7.6; z += 2.1) for (const sg of [1, -1]) { const s2 = (topY(z) - y) / (topY(z) - keelY(z)); const [x] = secPt(z, s2);
      port.push(xf(box(0.08, 0.5, 0.56), sg * (x + 0.02), y, z)); lid.push(xf(box(0.05, 0.52, 0.6), sg * (x + 0.06), y + 0.42, z, 0, 0, sg * -1.0));
      muz.push(xf(cyl(0.11, 0.13, 0.55, 10), sg * (x + 0.2), y - 0.02, z, 0, 0, Math.PI / 2)); muz.push(xf(cyl(0.15, 0.15, 0.08, 10), sg * (x + 0.46), y - 0.02, z, 0, 0, Math.PI / 2)); }
    for (let z = -11; z < 9.5; z += 0.7) for (const sg of [1, -1]) { const s2 = (topY(z) - y) / (topY(z) - keelY(z)); const [x] = secPt(z, s2); band.push(xf(box(0.04, 0.85, 0.72), sg * (x + 0.012), y + 0.02, z)); } }
  return (GUNDECK[rows] = { port: merge(port), lid: merge(lid), muz: merge(muz), band: merge(band) });
}
const GD_M = { port: new THREE.MeshStandardMaterial({ color: 0x0c0806, roughness: 1 }), lid: stdMat({ color: 0x8a2418, roughness: 0.7 }), band: stdMat({ map: TEX.wood, color: 0xb88a3a, roughness: 0.7 }) };
function addGunDecks(parent, cls) { const rows = cls === 'manowar' ? 2 : cls === 'galleon' ? 1 : 0; const g = new THREE.Group(); g.name = 'gundecks'; if (!rows) return g; const G = gunDeckGeo(rows);
  g.add(new THREE.Mesh(G.band, GD_M.band), new THREE.Mesh(G.port, GD_M.port), new THREE.Mesh(G.lid, GD_M.lid), new THREE.Mesh(G.muz, MAT.iron)); g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); parent.add(g); return g; }
/* visuals for other ships, built from the merged Saltwren template */
function makeShipVisual(look, clsKey, opt = {}) {
  if (clsKey === 'rowboat') { const v = makeRowboat(LOOKS.hull[look.hull || 0][0]); scene.add(v.root); return v; }
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); scene.add(root);
  const sc = SHIP_CLASSES[clsKey].scale; body.scale.setScalar(sc);
  const ghost = opt.ghost;
  const hullTint = new THREE.Color(ghost ? '#6fffc8' : LOOKS.hull[look.hull || 0][0]);
  for (const [mat, geo] of PEER_T.parts) {
    let m = mat;
    if (ghost) m = mat === MAT.glass ? mat : new THREE.MeshStandardMaterial({ color: 0x223a33, emissive: 0x1b6a4f, emissiveIntensity: 0.5, transparent: true, opacity: 0.55, roughness: 1, depthWrite: false });
    else if (mat === MAT.hull) { m = mat.clone(); m.color = hullTint; }
    body.add(new THREE.Mesh(geo, m));
  }
  body.add(new THREE.LineSegments(ratGeo, ratLines.material));
  const sc0 = new THREE.Color(ghost ? '#8affd2' : LOOKS.sail[look.sail || 0][0]);
  const sm = MAT.sail.clone(); sm.color = sc0; if (ghost) { sm.transparent = true; sm.opacity = 0.35; sm.depthWrite = false; sm.emissive = new THREE.Color('#3effb0'); }
  const sails2 = PEER_T.sailsT.map((m, i) => { const x = fixedMesh(sails[i].mesh.geometry.clone(), sm, m); body.add(x); return x; });
  const jibs2 = PEER_T.jibsT.map((m, i) => { const x = fixedMesh(jibs[i].mesh.geometry.clone(), sm, m); body.add(x); return x; });
  const col = new THREE.Color(opt.color || '#e8b45f');
  const fm = MAT.flag.clone(); fm.map = flagTexture(LOOKS.flag[look.flag || 0][0], opt.color || '#e9e2d0'); fm.color = new THREE.Color(1, 1, 1);
  const flag2 = fixedMesh(flagGeo.clone(), fm, PEER_T.flagM); body.add(flag2);
  const pm = penMat.clone(); pm.color = col.clone(); pm.emissive = col.clone();
  const pen2 = fixedMesh(penGeo.clone(), pm, PEER_T.penM); body.add(pen2);
  for (const g of PEER_T.glows) { const s = new THREE.Sprite(PEER_T.glowMat); s.position.copy(g); s.scale.setScalar(1.2); body.add(s); }
  if (ghost) { const gl = new THREE.PointLight(0x3effb0, 2, 60, 2); gl.position.y = 10; body.add(gl); }
  if (!ghost) addGunDecks(body, clsKey);
  // a mast group we can break: the main topmast is approximated by an extra spar
  return { root, body, sails: sails2, jibs: jibs2, flag: flag2, pen: pen2, sm, fm, scale: sc, ghost };
}
function fixedMesh(geo, mat, m) { const x = new THREE.Mesh(geo, mat); x.matrixAutoUpdate = false; x.matrix.copy(m); x.frustumCulled = false; return x; }
function disposeVisual(v) { scene.remove(v.root); if (v.tagTex) v.tagTex.dispose(); }

/* ---------- name tags ---------- */
function makeTag(root, y) {
  const [tc, tg] = cnv(512, 160); const tt = new THREE.CanvasTexture(tc); tt.encoding = THREE.sRGBEncoding;
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tt, depthTest: false, depthWrite: false, transparent: true, sizeAttenuation: false }));
  tag.scale.set(0.3, 0.094, 1); tag.renderOrder = 20; tag.position.set(0, y, 0); root.add(tag);
  return { tag, tg, tt, key: '' };
}
function drawTag2(T, name, color, hp, line2, chat) {
  const key = name + color + Math.round(hp) + line2 + chat; if (key === T.key) return; T.key = key;
  const g = T.tg, W = 512; g.clearRect(0, 0, W, 160); g.textAlign = 'center'; g.lineWidth = 7; g.strokeStyle = 'rgba(15,8,4,0.85)';
  if (chat) { g.font = 'italic 30px Georgia, serif'; const t = chat.length > 34 ? chat.slice(0, 33) + '…' : chat; g.fillStyle = '#fff3dc'; g.strokeText(t, W / 2, 30); g.fillText(t, W / 2, 30); }
  g.font = '600 38px Inter, sans-serif'; g.strokeText(name, W / 2, 76); g.fillStyle = color; g.fillText(name, W / 2, 76);
  if (line2) { g.font = '500 24px Inter, sans-serif'; g.fillStyle = '#f0c05a'; g.strokeText(line2, W / 2, 104); g.fillText(line2, W / 2, 104); }
  g.fillStyle = 'rgba(15,8,4,0.75)'; g.fillRect(W / 2 - 120, 118, 240, 16); g.fillStyle = hp > 55 ? '#7fd18b' : hp > 25 ? '#f0c05a' : '#e8655f'; g.fillRect(W / 2 - 117, 121, 234 * clamp(hp, 0, 100) / 100, 10);
  T.tt.needsUpdate = true;
}

/* ---------- my own ship ---------- */
const OWN = { id: 'me', kind: 'own', root: shipYaw, body: ship, o: shipO, h: 0.42, sp: 0, scale: 1, cls: 'brig', st: null, hp: 220, max: 220, sail: 100, fire: 0, flood: 0, holes: [], sk: 0, sinkT: 0, anchored: 0, anchorT: 0, crew: 0, b: { h: 0, hv: 0, p: 0, pv: 0, r: 0, rv: 0 }, rec: null, has: false, row: null };
const rowOwn = makeRowboat(); ship.add(rowOwn.root); rowOwn.root.visible = false;
const holeGeo = new THREE.CircleGeometry(0.35, 7), holeMat = new THREE.MeshBasicMaterial({ color: 0x0b0705, side: THREE.DoubleSide });
function setOwnShip(rec) {
  OWN.rec = rec; OWN.has = !!rec;
  if (!rec) return;
  const st = shipStats(rec); OWN.st = st; OWN.cls = rec.cls; OWN.max = st.max; OWN.hp = rec.hp != null ? Math.min(rec.hp, st.max) : st.max; OWN.sail = 100; OWN.fire = 0; OWN.flood = 0;
  for (const h of OWN.holes) ship.remove(h.m); OWN.holes = [];
  const isRow = rec.cls === 'rowboat';
  OWN.scale = isRow ? 1 : st.scale; ship.scale.setScalar(OWN.scale);
  ship.children.forEach(c => { if (c !== rowOwn.root) c.visible = !isRow; });
  rowOwn.root.visible = isRow; OWN.row = isRow ? rowOwn : null;
  const L = rec.look || {};
  MAT.sail.color.set(LOOKS.sail[L.sail || 0][0]);
  MAT.hull.color.set(LOOKS.hull[L.hull || 0][0]);
  MAT.flag.map = flagTexture(LOOKS.flag[L.flag || 0][0], NET.color || '#e9e2d0'); MAT.flag.color.set('#ffffff'); MAT.flag.needsUpdate = true;
  // show the right number of real cannons
  const g = st.guns; cannons.forEach((C, i) => { C.grp.visible = !isRow && (i % 3) < Math.min(3, g); });
  OWN.guns = gunLayout(g);
  OWN.gready = OWN.guns.map(() => 0);
  if (OWN.gd) ship.remove(OWN.gd); OWN.gd = isRow ? null : addGunDecks(ship, rec.cls);
}

/* ---------- other ships: shared update ---------- */
function remoteShip(id, kind, cls, look, opt) {
  const v = makeShipVisual(look, cls, opt);
  const e = { id, kind, cls, look, v, root: v.root, body: v.body, scale: v.scale, o: new THREE.Vector2(), h: 0, sp: 0, sl: 1, hp: 100, max: 100, sail: 100, fire: 0, sk: 0, sinkT: 0, snaps: [], b: { h: 0, hv: 0, p: 0, pv: 0, r: 0, rv: 0 }, inv: new THREE.Matrix4(), T: makeTag(v.root, (cls === 'rowboat' ? 4 : 31 * v.scale)), fm: (Math.random() * 3) | 0, dist: 0, guns: gunLayout(SHIP_CLASSES[cls].guns), opt: opt || {}, holes: [] };
  ENTS.set(id, e); return e;
}
function removeEnt(id) { const e = ENTS.get(id); if (!e) return; disposeVisual(e.v); if (e.halves) e.halves.forEach(h => scene.remove(h)); ENTS.delete(id); }
const lerpAng2 = (a, b, t) => { let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI; return a + d * t; };
function bobShip(e, dt, sl) {
  const wx = e.o.x - org.x, wz = e.o.y - org.y, h = e.h, sh = Math.sin(h), ch = Math.cos(h), s = e.scale || 1;
  const W = (lx, lz) => waveH(wx + ch * lx * s + sh * lz * s, wz - sh * lx * s + ch * lz * s, seaT);
  const hb = W(0, -11), hs = W(0, 10), hp = W(-3.6, 0), hst = W(3.6, 0), m = S.motion / 100, b = e.b;
  const tH = (hb + hs + hp + hst) * 0.25 * 0.85 * m, tP = Math.atan2(hb - hs, 21 * s) * 0.9 * m, tR = Math.atan2(hst - hp, 7.2 * s) * 0.55 * m - 0.03 * (sl || 0);
  b.hv += ((tH - b.h) * 3.2 - b.hv * 2.2) * dt; b.h += b.hv * dt; b.pv += ((tP - b.p) * 2.6 - b.pv * 2) * dt; b.p += b.pv * dt; b.rv += ((tR - b.r) * 1.8 - b.rv * 1.1) * dt; b.r += b.rv * dt;
  e.root.position.set(wx, 0, wz); e.root.rotation.y = h;
  const sk = e.sinkT || 0;
  e.body.position.y = b.h - 0.1 - sk * sk * 0.11 * s; e.body.rotation.set(b.p - sk * 0.035, 0, b.r + sk * 0.06);
}
function updateRemoteShips(dt, t, g) {
  const rt = performance.now() - 140; const U = waterU.uShips.value, US = waterU.uShipS.value; let n = 0;
  const own = OWN.has && !OWN.row ? 1 : 0;
  if (OWN.has) { U[0].set(shipO.x - org.x, shipO.y - org.y, OWN.h, OWN.sk ? 0 : clamp(OWN.sp / 6, 0, 1)); US[0] = OWN.row ? 0.18 : OWN.scale; n = 1; }
  for (const e of ENTS.values()) {
    if (e.kind === 'peer' || e.kind === 'row') {
      const SN = e.snaps; if (!SN.length) { e.root.visible = false; continue; }
      while (SN.length > 2 && SN[1].t <= rt) SN.shift();
      let x, z, h;
      if (SN.length >= 2 && SN[0].t <= rt) { const a = clamp((rt - SN[0].t) / Math.max(1, SN[1].t - SN[0].t), 0, 1.5); x = lerp(SN[0].x, SN[1].x, a); z = lerp(SN[0].z, SN[1].z, a); h = lerpAng2(SN[0].h, SN[1].h, Math.min(a, 1)); }
      else { const L = SN[SN.length - 1], ex = clamp((rt - L.t) / 1000, 0, 0.6); x = L.x - Math.sin(L.h) * L.sp * ex; z = L.z - Math.cos(L.h) * L.sp * ex; h = L.h; }
      e.o.set(x, z); e.h = h;
    } else if (e.kind === 'npc') {
      if (!e.tgt) continue;
      if (!NET.isHost) { e.o.x += (e.tgt.x - e.o.x) * Math.min(1, dt * 3); e.o.y += (e.tgt.z - e.o.y) * Math.min(1, dt * 3); e.h = lerpAng2(e.h, e.tgt.h, Math.min(1, dt * 3)); e.o.x += -Math.sin(e.h) * e.sp * dt; e.o.y += -Math.cos(e.h) * e.sp * dt; e.tgt.x += -Math.sin(e.tgt.h) * e.sp * dt; e.tgt.z += -Math.cos(e.tgt.h) * e.sp * dt; }
    }
    const wx = e.o.x - org.x, wz = e.o.y - org.y; e.dist = Math.hypot(wx, wz);
    e.root.visible = e.dist < 3600; if (!e.root.visible) continue;
    if (e.sk) e.sinkT += dt;
    bobShip(e, dt, e.sl);
    if (e.v.row) rowOars(e.v, t, e.sp);
    const near = e.dist < 450 && !e.v.row;
    if (near && ((frame + e.fm) % 3 === 0)) {
      const sl = e.sl * (e.sail > 15 ? 1 : 0.3);
      for (let i = 0; i < sails.length; i++) { const geo = e.v.sails[i].geometry; shapeSail(sails[i], geo.attributes.position.array, sl, g, t); geo.attributes.position.needsUpdate = true; geo.computeVertexNormals(); }
      for (let i = 0; i < jibs.length; i++) { const geo = e.v.jibs[i].geometry; shapeJib(jibs[i], geo.attributes.position.array, sl, g, t); geo.attributes.position.needsUpdate = true; geo.computeVertexNormals(); }
      shapeFlag(e.v.flag.geometry, flagBase, t, g); shapeFlag(e.v.pen.geometry, penBase, t * 1.2, g, true);
      // torn sails: hide some sails as sail health drops; broken main mast below 20
      e.v.sails.forEach((m, i) => m.visible = e.sail > (i * 9) % 60 + 10 || i % 3 === 2);
    }
    if (!e.v.row && !e.v.ghost) { e.v.sm.emissive.copy(MAT.sail.emissive); e.v.sm.emissiveIntensity = MAT.sail.emissiveIntensity; }
    const pct = e.max ? e.hp / e.max * 100 : 100;
    e.T.tag.visible = e.dist < 1900 && !(e.sk && e.sinkT > 5);
    if (e.T.tag.visible) drawTag2(e.T, e.name || '', e.color || '#fff', pct, e.line2 || '', e.chatT > 0 ? e.chat : '');
    if (e.chatT > 0) e.chatT -= dt;
    if (n < 8 && e.dist < 700) { U[n].set(wx, wz, e.h, e.sk ? 0 : clamp(e.sp / 6, 0, 1)); US[n] = e.v.row ? 0.18 : e.scale; n++; }
    if (e.dist < 450 && (pct < 60 || e.fire)) { e.fx = (e.fx || 0) - dt; if (e.fx <= 0) { e.fx = pct < 30 || e.fire ? 0.08 : 0.2; damageFx(e.body, pct < 30 || e.fire ? 10 : 50); } }
    if (e.sk && e.sinkT > 0.5 && !e.halves && !e.v.row) breakApart(e);
    if (e.halves) updateHalves(e, dt);
  }
  waterU.uShipN.value = n;
}

/* ---------- sinking: the hull splits and both halves go down ---------- */
const clipMats = new Map();
function clipped(mat, plane) { const m = mat.clone(); m.clippingPlanes = [plane]; m.clipShadows = true; return m; }
function breakApart(e) {
  renderer.localClippingEnabled = true;
  e.planes = [new THREE.Plane(), new THREE.Plane()];
  e.halves = [0, 1].map(k => {
    const g = new THREE.Group(); g.position.copy(e.root.position); scene.add(g);
    const b = e.body.clone(true); b.traverse(o => { if (o.isMesh && o.material) o.material = clipped(o.material, e.planes[k]); if (o.isSprite) o.visible = false; }); g.add(b); g.rotation.y = e.h; return g;
  });
  e.body.visible = false;
  for (let i = 0; i < 20; i++) { const w = e.body.localToWorld(new THREE.Vector3(rand(-3, 3), DECK, rand(-12, 12))); emit({ x: w.x, y: w.y, z: w.z, vx: rand(-4, 4), vy: rand(2, 7), vz: rand(-4, 4), max: rand(2, 4), s0: 0.3, s1: 0.2, a0: 1, kind: 3, g: -9.8, drag: 0.4, sea: true }); }
  spawnDebris(e.o.x, e.o.y, e.scale || 1);
}
function updateHalves(e, dt) {
  const t = e.sinkT;
  e.halves.forEach((g, k) => {
    const sgn = k ? 1 : -1, b = g.children[0];
    g.position.set(e.o.x - org.x, 0, e.o.y - org.y); g.rotation.y = e.h;
    b.position.set(0, -t * t * 0.1 * e.scale, sgn * t * 0.6); b.rotation.set(sgn * t * 0.09, 0, 0.04 * t * sgn);
    g.updateMatrixWorld(true);
    const n = new THREE.Vector3(0, 0, sgn).applyQuaternion(g.quaternion);
    const p = new THREE.Vector3(0, 0, -0.5 * e.scale).applyMatrix4(g.matrixWorld);
    e.planes[k].setFromNormalAndCoplanarPoint(n.clone().negate().multiplyScalar(-1), p);
  });
}
function spawnDebris(ox, oz, s) { for (let i = 0; i < 6 * s; i++) { const m = new THREE.Mesh(box(rand(0.8, 2.4), 0.15, 0.4), MAT.dark); m.position.set(ox + rand(-8, 8) * s, 0, oz + rand(-15, 15) * s); m.rotation.y = rand(0, 6); WORLD.add(m); DEBRIS.push({ m, t: 120 }); } }
const DEBRIS = [];
function updateDebris(dt) { for (let i = DEBRIS.length - 1; i >= 0; i--) { const d = DEBRIS[i]; d.t -= dt; d.m.position.y = waveH(d.m.position.x - org.x, d.m.position.z - org.y, seaT) + 0.05; d.m.rotation.z = Math.sin(seaT + i) * 0.1; if (d.t < 0) { WORLD.remove(d.m); DEBRIS.splice(i, 1); } } }

/* ---------- my ship's damage, fire, flooding, repair ---------- */
function damageOwn(dmg, l, opt = {}) {
  if (!OWN.has || OWN.sk) return;
  OWN.hp = Math.max(0, OWN.hp - dmg);
  if (opt.sail) OWN.sail = Math.max(0, OWN.sail - opt.sail);
  if (opt.fire && Math.random() < opt.fire) { OWN.fire = 1; say('Fire aboard! Grab a bucket.', 2.5); }
  if (l && dmg > 6 && OWN.holes.length < 18 && !OWN.row && l.y < DECK + 1) {
    const m = new THREE.Mesh(holeGeo, holeMat); const sg = Math.sign(l.x) || 1; const z = clamp(l.z, L0 + 2, L1 - 1);
    const [x] = secPt(z, 0.25); m.position.set(sg * (x + 0.02), clamp(l.y, 0.4, DECK + 0.6), z); m.rotation.y = sg * Math.PI / 2; m.scale.setScalar(rand(0.7, 1.3)); ship.add(m);
    OWN.holes.push({ m, below: m.position.y < 1.3 });
  }
  if (OWN.hp <= 0) startSink(opt.by);
}
function updateOwnDamage(dt) {
  if (!OWN.has || OWN.sk) return;
  const leaks = OWN.holes.filter(h => h.below).length;
  OWN.flood = clamp(OWN.flood + (leaks * 0.012 - 0.004 - (OWN.crewN || 0) * 0.002) * dt, 0, 1);
  if (OWN.flood > 0.02) { OWN.hp -= OWN.flood * 2.2 * dt; }
  if (OWN.fire) { OWN.hp -= 1.8 * dt; if (ENV.rain > 0.5 && Math.random() < dt * 0.1) OWN.fire = 0; if ((OWN.crewN || 0) > 0 && Math.random() < dt * 0.02 * OWN.crewN) { OWN.fire = 0; say('Your crew douses the flames.', 2); } }
  if ((OWN.crewN || 0) > 0 && OWN.holes.length && Math.random() < dt * 0.015 * OWN.crewN && invCount('plank') > 0) { patchHole(true); }
  if (OWN.hp <= 0) startSink(lastHitBy);
}
function patchHole(quiet) {
  if (!OWN.holes.length) { if (!quiet) say('The hull is sound.', 1.6); return false; }
  if (!invTake('plank', 2)) { if (!quiet) say('You need planks to patch the hull.', 2); return false; }
  const h = OWN.holes.pop(); ship.remove(h.m); OWN.hp = Math.min(OWN.max, OWN.hp + OWN.max * 0.06); sfx.thud(camera, 0.8); if (!quiet) say('Patched.', 1.2); return true;
}

/* ---------- gunnery ---------- */
const AMMO = { ball: { hull: [9, 13], sail: 2, rng: 1 }, chain: { hull: [3, 5], sail: 18, rng: 0.9 }, grape: { hull: [2, 4], sail: 4, rng: 0.55, crew: 1 }, bomb: { hull: [14, 19], sail: 4, rng: 0.9, fire: 0.45, boom: 1 } };
let curAmmo = 'ball';
function shipRightOf(h) { return new THREE.Vector3(Math.cos(h), 0, -Math.sin(h)); }
function gunWorld(ent, gi, out) { const G = ent.guns[gi]; const v = out || new THREE.Vector3(); v.set(G.x, G.y, G.z); (ent.kind === 'own' ? ship : ent.body).localToWorld(v); return v; }
function fireGunsOf(ent, gis, el, ammo, owner, sd, aimYaw) {
  // ent: ship entity; gis: gun indices; aimYaw: optional extra yaw (manned cannon)
  gis.forEach((gi, k) => setTimeout(() => {
    const G = ent.guns && ent.guns[gi]; if (!G) return;
    if (ent === OWN && OWN.sk) return;
    const m = gunWorld(ent, gi);
    let out = shipRightOf(ent.h).multiplyScalar(G.sg);
    if (aimYaw) out.applyAxisAngle(new THREE.Vector3(0, 1, 0), aimYaw);
    const vel = new THREE.Vector3(-Math.sin(ent.h) * ent.sp, 0, -Math.cos(ent.h) * ent.sp);
    shoot(m, out, el, owner, sd + k, vel, ammo);
    if (ent === OWN && G.real >= 0) { const C = cannons[G.real]; if (C) { C.recoil = 1; } }
  }, 120 + k * 140));
}
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const ballG = new THREE.SphereGeometry(0.12, 10, 8), chainG = merge([xf(new THREE.SphereGeometry(0.1, 8, 6), -0.35, 0, 0), xf(new THREE.SphereGeometry(0.1, 8, 6), 0.35, 0, 0), xf(cyl(0.015, 0.015, 0.7, 4), 0, 0, 0, 0, 0, Math.PI / 2)]);
function shoot(muzzle, out, el, owner, seed, shipVel, ammo = 'ball') {
  const r = rng(seed); const A = AMMO[ammo] || AMMO.ball;
  const pellets = ammo === 'grape' ? 6 : 1;
  for (let p = 0; p < pellets; p++) {
    const yaw = (r() - 0.5) * (ammo === 'grape' ? 0.18 : 0.04), e = el + (r() - 0.5) * (ammo === 'grape' ? 0.1 : 0.02);
    const cy = Math.cos(yaw), sy = Math.sin(yaw), ox = out.x * cy - out.z * sy, oz = out.x * sy + out.z * cy;
    const sp = MV * A.rng;
    const v = new THREE.Vector3(ox * Math.cos(e) * sp, Math.sin(e) * sp, oz * Math.cos(e) * sp).add(shipVel);
    const b = new THREE.Mesh(ammo === 'chain' ? chainG : ballG, MAT.iron); b.position.copy(muzzle); if (ammo === 'grape') b.scale.setScalar(0.5); scene.add(b);
    balls.push({ m: b, v, owner, ammo, life: 0, whz: 0 });
  }
  sfx.cannon(WP(muzzle)); flash.position.copy(muzzle); flashT = 1;
  for (let i = 0; i < 26; i++) emit({ x: muzzle.x, y: muzzle.y, z: muzzle.z, vx: out.x * rand(3, 12) + rand(-1, 1), vy: rand(0, 2), vz: out.z * rand(3, 12) + rand(-1, 1), max: rand(3.5, 6.5), s0: rand(0.6, 1.2), s1: rand(4, 8), a0: rand(0.35, 0.6), kind: 1, g: 0.25, drag: 1.1, sea: true });
  for (let i = 0; i < 10; i++) emit({ x: muzzle.x, y: muzzle.y, z: muzzle.z, vx: out.x * rand(6, 16), vy: rand(-1, 2), vz: out.z * rand(6, 16), max: rand(0.12, 0.25), s0: 0.9, s1: 0.2, a0: 1, kind: 2, g: 0, drag: 2 });
  if (camera.position.distanceTo(muzzle) < 40) shake = Math.max(shake, 0.3);
}
const WP = v => ({ getWorldPosition: t => t.copy(v) });
function inHull(l) { return l.y > -1.4 && l.y < topY(clamp(l.z, L0, L1)) + 0.4 && (l.x / 4.3) ** 2 + ((l.z + 0.5) / 14.9) ** 2 < 1; }
function inRow(l) { return l.y > -0.6 && l.y < 1.2 && Math.abs(l.x) < 0.9 && Math.abs(l.z) < 2.6; }
function splinters(w, n = 26) {
  for (let i = 0; i < n; i++) emit({ x: w.x, y: w.y, z: w.z, vx: rand(-5, 5), vy: rand(2, 8), vz: rand(-5, 5), max: rand(0.8, 1.8), s0: rand(0.08, 0.2), s1: rand(0.05, 0.12), a0: 1, kind: 3, g: -9.8, drag: 0.3, sea: true });
  for (let i = 0; i < 10; i++) emit({ x: w.x, y: w.y, z: w.z, vx: rand(-1.5, 1.5), vy: rand(0.5, 2), vz: rand(-1.5, 1.5), max: rand(2, 4), s0: 0.8, s1: rand(3, 5), a0: 0.5, kind: 1, g: 0.2, drag: 1, sea: true });
  for (let i = 0; i < 8; i++) emit({ x: w.x, y: w.y, z: w.z, vx: rand(-6, 6), vy: rand(0, 6), vz: rand(-6, 6), max: rand(0.15, 0.35), s0: 0.5, s1: 0.1, a0: 1, kind: 2, g: -3, drag: 1 });
}
function splash(w, big = 1) { for (let k = 0; k < 36 * big; k++) emit({ x: w.x, y: w.y, z: w.z, vx: rand(-2.5, 2.5), vy: rand(5, 13) * big, vz: rand(-2.5, 2.5), max: rand(1.2, 2.4), s0: rand(0.8, 1.6), s1: rand(2.5, 4.5), a0: 0.85, kind: 0, g: -9.8, drag: 0.6, sea: true }); }
function damageFx(obj, h) {
  const l = new THREE.Vector3(rand(-2.5, 2.5), DECK + 0.6, rand(-10, 10)); const w = obj.localToWorld(l);
  emit({ x: w.x, y: w.y, z: w.z, vx: rand(-0.4, 0.4), vy: rand(2, 3.5), vz: rand(-0.4, 0.4), max: rand(4, 7), s0: 1.2, s1: rand(6, 10), a0: 0.45, kind: 1, g: 0.3, drag: 0.6, sea: true });
  if (h < 30) for (let i = 0; i < 4; i++) emit({ x: w.x + rand(-0.5, 0.5), y: w.y, z: w.z + rand(-0.5, 0.5), vx: rand(-0.3, 0.3), vy: rand(1.5, 3.5), vz: rand(-0.3, 0.3), max: rand(0.5, 1.0), s0: rand(0.6, 1.1), s1: 0.15, a0: 0.9, kind: 4, g: 0.5, drag: 0.5, sea: true });
}
function explosion(w, power = 1) {
  for (let i = 0; i < 50 * power; i++) emit({ x: w.x, y: w.y, z: w.z, vx: rand(-8, 8) * power, vy: rand(2, 12) * power, vz: rand(-8, 8) * power, max: rand(0.3, 0.8), s0: rand(1, 2.5), s1: 0.3, a0: 1, kind: 4, g: -4, drag: 1.5, sea: true });
  for (let i = 0; i < 30 * power; i++) emit({ x: w.x, y: w.y, z: w.z, vx: rand(-4, 4), vy: rand(1, 6), vz: rand(-4, 4), max: rand(3, 7), s0: 2, s1: rand(8, 14) * power, a0: 0.55, kind: 1, g: 0.4, drag: 1, sea: true });
  flash.position.copy(w); flashT = 1.5; sfx.boom(WP(w), power);
  if (camera.position.distanceTo(w) < 60) shake = Math.max(shake, 1.2 * power);
}
// called when anything explodes at an ocean position — every client applies effects to what it owns
function applyBlast(ox, oy, oz, radius, power, by) {
  const w = new THREE.Vector3(ox - org.x, oy, oz - org.y);
  if (OWN.has && !OWN.sk) { const d = Math.hypot(shipO.x - ox, shipO.y - oz) - 6 * OWN.scale; if (d < radius) { const l = ship.worldToLocal(w.clone()); damageOwn(power * 45 * (1 - Math.max(0, d) / radius), l, { fire: 0.5, by }); } }
  if (PL.alive) { const d = playerWorld().distanceTo(w); if (d < radius * 0.8) hurtPlayer(power * 90 * (1 - d / radius), by, 'blast'); }
  if (typeof blastBase === 'function') blastBase(ox, oy, oz, radius, power, by);
}

/* ---------- balls in flight ---------- */
const lHit = new THREE.Vector3(), tmpA = new THREE.Vector3();
function updateBalls(dt) {
  for (const e of ENTS.values()) if (e.root.visible) e.inv.copy(e.body.matrixWorld).invert();
  const myInv = new THREE.Matrix4().copy(ship.matrixWorld).invert();
  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i], pos = b.m.position; b.life += dt;
    b.v.y -= 9.8 * dt; pos.addScaledVector(b.v, dt); pos.x -= dOrg.x; pos.z -= dOrg.y;
    if (b.ammo === 'chain') b.m.rotation.y += dt * 18;
    if ((frame & 1) === 0 && b.ammo !== 'grape') emit({ x: pos.x, y: pos.y, z: pos.z, vx: 0, vy: 0.3, vz: 0, max: 1.1, s0: 0.35, s1: 1.1, a0: 0.22, kind: 1, g: 0, drag: 1, sea: true });
    let dead = false; const A = AMMO[b.ammo] || AMMO.ball;
    const hitFx = big => { splinters(pos, 24); sfx.hit(WP(pos), big); if (A.boom) explosion(pos, 0.5); };
    if (b.owner === 'me') {
      for (const e of ENTS.values()) {
        if (!e.root.visible || e.sk || e.tl || e.dist > 700) continue;
        lHit.copy(pos).applyMatrix4(e.inv);
        if (e.v.row ? inRow(lHit) : inHull(lHit)) {
          const dmg = Math.round(rand(A.hull[0], A.hull[1])), sd = A.sail;
          const P = [+lHit.x.toFixed(2), +lHit.y.toFixed(2), +lHit.z.toFixed(2)];
          if (e.kind === 'npc') netSend({ t: 'nhit', n: e.id.slice(2), dmg, sd, p: P, am: b.ammo }), npcHitLocal(e, dmg, sd, b.ammo, 'me');
          else netSend({ t: 'hit', to: e.pid, dmg, sd, p: P, am: b.ammo });
          e.pred = (e.pred != null ? e.pred : e.hp) - dmg;
          hitFx(1); flashEl('#hitm'); if (A.boom) netSend({ t: 'boom', x: pos.x + org.x, y: pos.y, z: pos.z + org.y, r: 6, pw: 0.4 });
          dead = true; break;
        }
        if (b.ammo === 'chain' && !e.v.row) { // chain shot tears through rigging above deck
          if (lHit.y > DECK + 3 && lHit.y < DECK + 24 && Math.abs(lHit.x) < 7 && Math.abs(lHit.z) < 12 && !b.hitSail) { b.hitSail = 1; if (e.kind === 'npc') { netSend({ t: 'nhit', n: e.id.slice(2), dmg: 1, sd: 22, p: [0, 10, 0], am: 'chain' }); npcHitLocal(e, 1, 22, 'chain', 'me'); } else netSend({ t: 'hit', to: e.pid, dmg: 1, sd: 22, p: [0, 10, 0], am: 'chain' }); for (let k = 0; k < 14; k++) emit({ x: pos.x, y: pos.y, z: pos.z, vx: rand(-3, 3), vy: rand(-1, 3), vz: rand(-3, 3), max: 2, s0: 0.3, s1: 0.2, a0: 1, kind: 0, g: -3, drag: 1, sea: true }); flashEl('#hitm'); }
        }
      }
      if (!dead && typeof ballHitsWorld === 'function' && ballHitsWorld(pos, b)) dead = true;
    } else {
      lHit.copy(pos).applyMatrix4(myInv);
      if (OWN.has && !OWN.sk && (OWN.row ? inRow(lHit) : inHull(lHit))) {
        hitFx(1); dead = true;
        if (b.owner && b.owner.startsWith('n:')) { const dmg = Math.round(rand(A.hull[0], A.hull[1])); damageOwn(dmg, lHit.clone(), { sail: A.sail, fire: A.fire, by: b.owner }); }
      }
      if (!dead && !b.whz && pos.distanceTo(camera.position) < 16) { b.whz = 1; tmpA.subVectors(pos, camera.position).normalize(); sfx.whiz(tmpA.dot(new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion))); }
      if (!dead && PL.alive && pos.distanceTo(playerWorld(tmpA)) < 1.2) { hurtPlayer(b.ammo === 'grape' ? 35 : 80, b.owner, 'cannon'); dead = true; }
    }
    if (!dead && terrainH(pos.x + org.x, pos.z + org.y) > pos.y) { splinters(pos, 8); dead = true; if (A.boom) explosion(pos, 0.5); }
    if (!dead && pos.y < waveH(pos.x, pos.z, seaT)) { splash(pos, b.ammo === 'grape' ? 0.3 : 1); if (b.ammo !== 'grape') sfx.splash(pos.distanceTo(camera.position)); dead = true;
      if (typeof kegHitCheck === 'function') kegHitCheck(pos); }
    if (dead || b.life > 9) { scene.remove(b.m); balls.splice(i, 1); }
  }
}

/* ---------- my ship's sailing ---------- */
let heading = 0.42, turnRate = 0, speed = 0, gust = 0.6, gustT = 0, rudder = 0, lastHitBy = null, bumpT = 0;
const body = OWN.b;
function updateOwnShip(dt, steerIn) {
  gustT -= dt; if (gustT <= 0) { gustT = rand(3, 9); gust = clamp(gust + rand(-0.35, 0.35), 0.25, 1); }
  const gNow = gust + Math.sin(clock * 0.7) * 0.06 + Math.sin(clock * 2.3) * 0.03 + ENV.storm * 0.35;
  if (!OWN.has) { OWN.root.visible = false; return gNow; }
  OWN.root.visible = !(OWN.sk && OWN.sinkT > 12);
  const st = OWN.st, isRow = !!OWN.row;
  sailF += ((isRow ? 0 : SAIL_T[sailLvl]) - sailF) * Math.min(1, dt * 0.8);
  rudder += (steerIn - rudder) * Math.min(1, dt * (steerIn ? 2.6 : 1.8));
  let tgt = 0;
  if (!OWN.sk) {
    if (isRow) tgt = st.speed * clamp(rowIn, -0.5, 1);
    else tgt = (0.5 + (st.speed - 0.5) * sailF * (0.8 + 0.3 * gNow) * (0.35 + 0.65 * OWN.sail / 100)) * (0.6 + 0.4 * OWN.hp / OWN.max) * (1 - OWN.flood * 0.5);
    if (OWN.anchored) tgt = 0;
    if (GRAP.on) tgt = Math.min(tgt, 1.2);
  }
  speed += (tgt - speed) * dt * (OWN.anchored ? 0.8 : tgt > speed ? 0.22 : 0.3);
  const sp01 = clamp(speed / 6, 0, 1);
  turnRate += (-rudder * st.turn * (isRow ? 1 : (0.25 + 0.75 * clamp(speed / st.speed, 0, 1))) - turnRate) * Math.min(1, dt * 1.6);
  if (!OWN.anchored) heading += turnRate * dt;
  OWN.h = heading; OWN.sp = speed;
  shipYaw.rotation.y = heading;
  // drift: wind and current push a little even under bare poles
  const drift = ENV.storm * 0.4 + 0.08;
  shipO.x += -Math.sin(heading) * speed * dt + (OWN.anchored ? 0 : Math.sin(clock * 0.05) * drift * dt);
  shipO.y += -Math.cos(heading) * speed * dt;
  // grounding on islands
  const s = OWN.scale;
  for (const lz of [-12, 0, 11]) {
    const gx = shipO.x - Math.sin(heading) * lz * s * -1 * -1, gz = shipO.y - Math.cos(heading) * lz * s * -1 * -1;
    const bx = shipO.x + Math.sin(heading) * lz * s, bz = shipO.y + Math.cos(heading) * lz * s;
    const h = terrainH(bx, bz);
    if (h > (isRow ? -0.5 : -2.4 * s)) {
      const I = nearIsle(bx, bz); if (I) { const dx = shipO.x - I.x, dz = shipO.y - I.z, d = Math.hypot(dx, dz) || 1; shipO.x += dx / d * 0.15; shipO.y += dz / d * 0.15; }
      if (speed > 1.5 && clock - bumpT > 1) { bumpT = clock; damageOwn(speed * 3, null, {}); sfx.creak(0.5, null, 1.4); sfx.thud(camera, 1.2); shake = 0.8; say('Aground! Steer for deeper water.', 2); }
      speed *= 0.9; break;
    }
  }
  shipYaw.position.set(shipO.x - org.x, 0, shipO.y - org.y);
  bobOwn(dt, gNow);
  return gNow;
}
let rowIn = 0;
function bobOwn(dt, gNow) {
  const sh = Math.sin(heading), ch = Math.cos(heading), s = OWN.row ? 0.25 : OWN.scale, wx = shipYaw.position.x, wz = shipYaw.position.z;
  const W = (lx, lz) => waveH(wx + ch * lx * s + sh * lz * s, wz - sh * lx * s + ch * lz * s, seaT);
  const hb = W(0, -11), hs = W(0, 10), hp_ = W(-3.6, 0), hst = W(3.6, 0), hc = W(0, 0);
  const m = S.motion / 100 * (OWN.row ? 1.4 : 1);
  const tH = ((hb + hs + hp_ + hst) * 0.25 * 0.7 + hc * 0.3) * 0.85 * m;
  const tP = Math.atan2(hb - hs, 21 * s) * 0.9 * m;
  const tR = Math.atan2(hst - hp_, 7.2 * s) * 0.55 * m - 0.035 * sailF * gNow - turnRate * 0.45;
  body.hv += ((tH - body.h) * 3.2 - body.hv * 2.2) * dt; body.h += body.hv * dt;
  body.pv += ((tP - body.p) * 2.6 - body.pv * 2.0) * dt; body.p += body.pv * dt;
  body.rv += ((tR - body.r) * 1.8 - body.rv * 1.1) * dt; body.r += body.rv * dt;
  if (OWN.sk) OWN.sinkT += dt;
  const sk = OWN.sk ? OWN.sinkT : 0;
  ship.position.y = body.h - 0.1 - sk * sk * 0.11 * OWN.scale - OWN.flood * 1.2 * OWN.scale + (OWN.row ? 0.25 : 0);
  ship.rotation.set(body.p - sk * 0.035, 0, body.r + sk * 0.06 + OWN.flood * 0.06);
  if (OWN.row) rowOars(rowOwn, clock, speed);
  hcSwell = hc;
}
let hcSwell = 0;

/* ---------- ship-to-ship contact: ramming and grappling ---------- */
const GRAP = { on: 0, ent: null, lines: null };
const grapMat = new THREE.LineBasicMaterial({ color: 0x2a1d12 });
function shipContacts(dt) {
  if (!OWN.has || OWN.sk || OWN.row) return;
  for (const e of ENTS.values()) {
    if (!e.root.visible || e.sk || e.dist > 70) continue;
    const sA = OWN.scale, sB = e.v.row ? 0.25 : e.scale;
    for (const oz of [-9, 0, 9]) for (const pz of [-9, 0, 9]) {
      const ax = shipO.x + Math.sin(heading) * oz * sA, az = shipO.y + Math.cos(heading) * oz * sA;
      const bx = e.o.x + Math.sin(e.h) * pz * sB, bz = e.o.y + Math.cos(e.h) * pz * sB;
      const dx = ax - bx, dz = az - bz, d = Math.hypot(dx, dz), R = 4.2 * sA + 4.2 * sB;
      if (d < R && d > 0.01) {
        const push = (R - d) * 0.5; shipO.x += dx / d * push; shipO.y += dz / d * push;
        const rel = Math.hypot(-Math.sin(heading) * speed + Math.sin(e.h) * e.sp, -Math.cos(heading) * speed + Math.cos(e.h) * e.sp);
        if (clock - bumpT > 1.2) {
          bumpT = clock; sfx.slap(0.7, 0); sfx.creak(0.4, null, 1.2); shake = Math.max(shake, 0.5);
          if (rel > 2.2) { // a proper ram: the faster, heavier ship deals more
            const mine = rel * 4 * (sB / sA), theirs = rel * 5 * (sA / sB) * (Math.abs(oz) > 7 && oz < 0 ? 1.6 : 1);
            damageOwn(mine, new THREE.Vector3(0, 1, oz), { by: e.kind === 'npc' ? e.id : e.pid });
            if (e.kind === 'npc') { netSend({ t: 'nhit', n: e.id.slice(2), dmg: Math.round(theirs), sd: 0, p: [0, 1, pz], am: 'ram' }); npcHitLocal(e, Math.round(theirs), 0, 'ram', 'me'); }
            else netSend({ t: 'hit', to: e.pid, dmg: Math.round(theirs), sd: 0, p: [0, 1, pz], am: 'ram' });
            splinters(new THREE.Vector3((ax + bx) / 2 - org.x, 2, (az + bz) / 2 - org.y), 40); say(rel > 4 ? 'You ram her hard amidships!' : 'Timbers grind together.', 2);
          }
          speed *= 0.6;
        }
      }
    }
  }
  // grappling: haul toward the target and lie alongside it
  if (GRAP.on) {
    const e = GRAP.ent; if (!e || !ENTS.has(e.id) || e.sk || e.dist > 60) { cutGrapple(); return; }
    const side = Math.sign((e.o.x - shipO.x) * Math.cos(heading) - (e.o.y - shipO.y) * Math.sin(heading)) || 1;
    const want = 8.5 * (OWN.scale + (e.v.row ? 0.2 : e.scale)) / 2 + 0.6;
    const tx = e.o.x - Math.cos(e.h) * side * want * 1, tz = e.o.y + Math.sin(e.h) * side * want;
    shipO.x += (tx - shipO.x) * dt * 0.6; shipO.y += (tz - shipO.y) * dt * 0.6;
    heading = lerpAng2(heading, e.h, dt * 0.5); speed *= 1 - dt * 0.8;
    // ropes
    const pts = [];
    for (const z of [-6, 0, 6]) { pts.push(ship.localToWorld(new THREE.Vector3(side * 3.6, DECK + 1, z))); pts.push(e.body.localToWorld(new THREE.Vector3(-side * 3.6, DECK + 1, z))); }
    if (!GRAP.lines) { GRAP.lines = new THREE.LineSegments(new THREE.BufferGeometry(), grapMat); GRAP.lines.frustumCulled = false; scene.add(GRAP.lines); }
    GRAP.lines.geometry.setFromPoints(pts);
  }
}
function throwGrapple() {
  if (!OWN.has || OWN.row) return;
  let best = null, bd = 45;
  for (const e of ENTS.values()) { if (e.sk || e.v.row) continue; const d = Math.hypot(e.o.x - shipO.x, e.o.y - shipO.y); if (d < bd) { bd = d; best = e; } }
  if (!best) { say('No ship close enough to grapple — get within 40 metres.', 2.2); return; }
  GRAP.on = 1; GRAP.ent = best; sfx.whoosh(camera); setTimeout(() => sfx.thud(camera, 0.8), 400);
  say(`Grappling hooks bite into the ${best.name || 'ship'}! Haul alongside and board her.`, 3);
  if (best.kind === 'peer') netSend({ t: 'grap', to: best.pid, on: 1 }); else if (best.kind === 'npc') netSend({ t: 'ngrap', n: best.id.slice(2), by: NET.id });
}
function cutGrapple() { GRAP.on = 0; GRAP.ent = null; if (GRAP.lines) { scene.remove(GRAP.lines); GRAP.lines = null; } }

/* ---------- anchor ---------- */
const anchorLine = new THREE.Mesh(cyl(0.05, 0.05, 1, 5), MAT.iron); anchorLine.visible = false; ship.add(anchorLine);
function toggleAnchor() {
  if (!OWN.has) return;
  if (OWN.anchorBusy) return; OWN.anchorBusy = 1;
  const drop = !OWN.anchored;
  let k = 0; const iv = setInterval(() => { sfx.ratchet(0); if (++k > (drop ? 6 : 14)) clearInterval(iv); }, 160);
  setTimeout(() => { OWN.anchored = drop ? 1 : 0; OWN.anchorBusy = 0; if (drop) { sfx.splash(10); say('Anchor’s down. She’ll hold here.', 2); } else say('Anchor aweigh!', 1.6); }, drop ? 1100 : 2400);
  say(drop ? 'Letting go the anchor…' : 'Heaving on the capstan…', 1.5);
}
function updateAnchorVisual() {
  anchorLine.visible = !!OWN.anchored && !OWN.row;
  if (anchorLine.visible) { const len = DECK + 6; anchorLine.scale.y = len; anchorLine.position.set(1.2, DECK - len / 2 + 0.8, -13.2); anchorLine.rotation.x = 0.35; }
}

/* ---------- NPC fleets (the room host simulates them; everyone renders) ---------- */
const NPC_TYPES = {
  merchant: { n: 'Merchantman', cls: 'brig', sail: 0, hull: 0, flag: 3, color: '#d4c49a', hostile: 0, crew: 4, gold: [700, 2200], cargo: 2, ammo: 'ball' },
  navy:     { n: 'Navy frigate', cls: 'galleon', sail: 6, hull: 3, flag: 1, color: '#9cc3ff', hostile: 'bounty', crew: 8, gold: [400, 1200], ammo: 'ball' },
  pirate:   { n: 'Pirate raider', cls: 'sloop', sail: 1, hull: 1, flag: 0, color: '#ff6b5a', hostile: 'all', crew: 5, gold: [500, 1800], ammo: 'chain' },
  captain:  { n: 'Notorious captain', cls: 'brig', sail: 2, hull: 1, flag: 2, color: '#ff3b3b', hostile: 'all', crew: 7, gold: [2500, 5000], bounty: 3000, ammo: 'bomb' },
  ghost:    { n: 'The Pale Lantern', cls: 'manowar', sail: 0, hull: 4, flag: 0, color: '#7dffc8', hostile: 'all', crew: 9, gold: [6000, 12000], ghost: 1, relic: 1, ammo: 'ball' },
};
const CAPTAINS = ['Black Annis', 'Red Jory', 'Mad Lysander', 'One-Eyed Peg', 'Captain Graves', 'Salt-Tongue Mara'];
const NPCS = new Map(); // id -> sim state (host) / last snapshot (everyone)
let npcSeq = 1, npcTick = 0, npcSendT = 0;
function npcEnt(id, type) {
  let e = ENTS.get('n:' + id); if (e) return e;
  const T = NPC_TYPES[type];
  e = remoteShip('n:' + id, 'npc', T.cls, { sail: T.sail, hull: T.hull, flag: T.flag }, { color: T.color, ghost: T.ghost });
  e.type = type; e.name = T.n; e.color = T.color; e.crewAv = [];
  return e;
}
function hostNpcs(dt) {
  if (!NET.isHost && NET.on) return;
  if (!NET.on && canOnline && NET.tries < 2) return; // wait for the room to tell us who keeps the NPCs
  npcTick -= dt;
  const players = allPlayerShips();
  if (npcTick <= 0 && players.length) {
    npcTick = 5;
    // keep a handful of ships near the players
    const want = Math.min(7, 3 + players.length);
    const night = ENV.night > 0.6 || ENV.fog > 0.5;
    const hasGhost = [...NPCS.values()].some(n => n.type === 'ghost');
    if (NPCS.size < want || (night && !hasGhost && Math.random() < 0.25)) {
      const p = players[(Math.random() * players.length) | 0], a = rand(0, TAU), r = rand(700, 1200);
      const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
      if (terrainH(x, z) < -20) {
        const roll = Math.random();
        const type = night && !hasGhost && roll < 0.35 ? 'ghost' : roll < 0.4 ? 'merchant' : roll < 0.62 ? 'pirate' : roll < 0.85 ? 'navy' : 'captain';
        const T = NPC_TYPES[type], c = SHIP_CLASSES[T.cls];
        const id = (NET.id || 'solo') + (npcSeq++).toString(36);
        const n = { id, type, x, z, h: rand(0, TAU), sp: c.speed * 0.6, hp: c.hp * (type === 'ghost' ? 1.6 : 1), max: c.hp * (type === 'ghost' ? 1.6 : 1), sail: 100, fire: 0, sk: 0, sinkT: 0, gold: Math.round(rand(T.gold[0], T.gold[1])), crew: [], reload: [0, 0], tgt: null, wx: x + rand(-2000, 2000), wz: z + rand(-2000, 2000), surrender: 0, grap: null, name: type === 'captain' ? CAPTAINS[(Math.random() * CAPTAINS.length) | 0] : T.n };
        for (let i = 0; i < T.crew; i++) n.crew.push({ x: rand(-2, 2), z: rand(-9, 9), hp: type === 'ghost' ? 90 : 60, cd: 0, f: 0 });
        NPCS.set(id, n);
        netSend({ t: 'oc', o: { id: 'sb:' + id, k: 'strongbox', ship: 'n:' + id, gold: n.gold } });
      }
    }
    for (const [id, n] of NPCS) { const near = players.some(p => Math.hypot(p.x - n.x, p.z - n.z) < 3200); if (!near || (n.sk && n.sinkT > 25)) { NPCS.delete(id); netSend({ t: 'ndel', n: id }); removeEnt('n:' + id); netSend({ t: 'od', id: 'sb:' + id }); } }
  }
  for (const n of NPCS.values()) npcAI(n, dt, players);
  npcSendT -= dt;
  if (npcSendT <= 0) { npcSendT = 0.2; netSend({ t: 'npcs', l: [...NPCS.values()].map(npcPack) }); for (const n of NPCS.values()) applyNpc(npcPack(n), true); }
}
function npcPack(n) { return [n.id, n.type, +n.x.toFixed(1), +n.z.toFixed(1), +n.h.toFixed(3), +n.sp.toFixed(2), Math.round(n.hp), Math.round(n.max), Math.round(n.sail), n.fire, n.sk, n.crew.map(c => [+c.x.toFixed(2), +c.z.toFixed(2), Math.round(c.hp), c.f ? 1 : 0]), n.name, n.surrender]; }
function applyNpc(a, local) {
  const [id, type, x, z, h, sp, hp, max, sail, fire, sk, crew, name, sur] = a;
  const e = npcEnt(id, type);
  if (!e.tgt) { e.o.set(x, z); e.h = h; }
  e.tgt = { x, z, h }; if (local) { e.o.set(x, z); e.h = h; }
  e.sp = sp; e.max = max; e.hp = e.pred != null && e.pred < hp ? e.pred : hp; e.pred = null; e.sail = sail; e.fire = fire; e.name = name; e.line2 = sur ? 'Colours struck — board her!' : NPC_TYPES[type].bounty ? 'Bounty ' + fmtG(NPC_TYPES[type].bounty) : '';
  if (sk && !e.sk) { e.sk = 1; e.sinkT = 0; }
  e.sl = sur || sk ? 0 : 1; e.crewData = crew;
  if (!NPCS.has(id) || !NET.isHost) NPCS.set(id, NPCS.get(id) || { id, type, x, z, h, sp, hp, max, sail, fire, sk, crew: crew.map(c => ({ x: c[0], z: c[1], hp: c[2], cd: 0 })), reload: [0, 0], gold: 0, name, surrender: sur, remote: 1 });
  const n = NPCS.get(id); if (n.remote || !NET.isHost) Object.assign(n, { x, z, h, sp, hp, max, sail, fire, sk, name, surrender: sur }), n.crew = crew.map((c, i) => Object.assign(n.crew[i] || {}, { x: c[0], z: c[1], hp: c[2] }));
}
function allPlayerShips() {
  const out = [];
  const me = playerOcean(); out.push({ id: NET.id || 'me', x: me.x, z: me.z, ship: OWN.has && !OWN.sk ? { x: shipO.x, z: shipO.y, h: heading, sp: speed } : null, bounty: ME.bounty || 0, onShip: PL.plat });
  for (const P of PEERS.values()) out.push({ id: P.id, x: P.wo ? P.wo.x : 0, z: P.wo ? P.wo.y : 0, ship: P.ship && !P.ship.sk ? { x: P.ship.o.x, z: P.ship.o.y, h: P.ship.h, sp: P.ship.sp } : null, bounty: P.bounty || 0, onShip: P.plat });
  return out;
}
function npcAI(n, dt, players) {
  const T = NPC_TYPES[n.type], c = SHIP_CLASSES[T.cls];
  if (n.sk) { n.sinkT += dt; n.sp *= 0.98; return; }
  if (n.fire) { n.hp -= 1.5 * dt; if (Math.random() < dt * 0.05) n.fire = 0; }
  if (n.hp <= 0) { sinkNpc(n); return; }
  const alive = n.crew.filter(k => k.hp > 0).length;
  if (!n.surrender && (alive === 0 || (n.type === 'merchant' && n.hp < n.max * 0.35))) { n.surrender = 1; netSend({ t: 'chat', text: '' }); }
  // pick a target
  let tgt = null, td = 1e9;
  for (const p of players) { if (!p.ship) continue; const d = Math.hypot(p.ship.x - n.x, p.ship.z - n.z);
    const wantsIt = T.hostile === 'all' || (T.hostile === 'bounty' && p.bounty > 0) || n.angry === p.id;
    if (wantsIt && d < (n.type === 'ghost' ? 900 : 650) && d < td) { td = d; tgt = p; } }
  let desired, spd = c.speed * (0.35 + 0.65 * n.sail / 100);
  if (n.surrender || n.grap) { spd = 0; desired = n.h; }
  else if (n.type === 'merchant') {
    const threat = players.filter(p => p.ship && Math.hypot(p.ship.x - n.x, p.ship.z - n.z) < 400)[0];
    if (threat) desired = Math.atan2(-(n.x - threat.ship.x), -(n.z - threat.ship.z)) + Math.PI; else desired = Math.atan2(-(n.wx - n.x), -(n.wz - n.z));
    spd *= threat ? 1 : 0.7;
  } else if (tgt) {
    const bx = tgt.ship.x - n.x, bz = tgt.ship.z - n.z, bearing = Math.atan2(-bx, -bz);
    const side = Math.sign(Math.sin(bearing - n.h)) || 1;
    desired = td > 260 ? bearing : bearing - side * Math.PI / 2 * (td < 90 ? 1.3 : 1);
    // broadside when the target sits abeam
    const rel = ((bearing - n.h + Math.PI) % TAU + TAU) % TAU - Math.PI;
    for (const sg of [1, -1]) {
      const beam = -sg * Math.PI / 2;
      const k = sg > 0 ? 0 : 1; n.reload[k] = Math.max(0, n.reload[k] - dt);
      if (Math.abs(rel - beam) < 0.32 && td < 260 && td > 25 && n.reload[k] <= 0) {
        n.reload[k] = n.type === 'ghost' ? 4 : 6.5;
        const el = clamp(Math.asin(clamp(td * 9.8 / (MV * MV), 0, 0.9)) / 2 + 0.01, 0.02, 0.3);
        const gis = gunLayout(c.guns).map((g, i) => g.sg === sg ? i : -1).filter(i => i >= 0);
        const msg = { t: 'nfire', n: n.id, g: gis, el: +el.toFixed(3), sd: (Math.random() * 1e5) | 0, am: T.ammo };
        netSend(msg); npcFireLocal(msg);
      }
    }
  } else desired = Math.atan2(-(n.wx - n.x), -(n.wz - n.z));
  if (Math.hypot(n.wx - n.x, n.wz - n.z) < 80) { n.wx = n.x + rand(-2000, 2000); n.wz = n.z + rand(-2000, 2000); }
  // avoid land
  const ahead = terrainH(n.x - Math.sin(n.h) * 70, n.z - Math.cos(n.h) * 70);
  if (ahead > -12) desired = n.h + 1.2;
  const dh = ((desired - n.h + Math.PI) % TAU + TAU) % TAU - Math.PI;
  n.h += clamp(dh, -c.turn * dt, c.turn * dt);
  n.sp += (spd - n.sp) * dt * 0.25;
  n.x += -Math.sin(n.h) * n.sp * dt; n.z += -Math.cos(n.h) * n.sp * dt;
  // crews fight anyone who boards
  npcCrew(n, dt);
}
function sinkNpc(n) {
  if (n.sk) return; n.sk = 1; n.sinkT = 0;
  const T = NPC_TYPES[n.type];
  // spill floating loot
  const sb = OBJS.get('sb:' + n.id), gold = sb ? sb.gold : 0;
  if (gold > 0) { netSend({ t: 'od', id: 'sb:' + n.id }); for (let i = 0; i < 3; i++) netSend({ t: 'oc', o: { k: 'gold', x: n.x + rand(-10, 10), z: n.z + rand(-10, 10), v: Math.round(gold / 3), float: 1 } }); }
  for (let i = 0; i < (T.cargo || 1); i++) netSend({ t: 'oc', o: { k: 'item', it: 'cargo', n: 1, x: n.x + rand(-12, 12), z: n.z + rand(-12, 12), float: 1 } });
  if (Math.random() < 0.6 || T.relic) netSend({ t: 'oc', o: { k: 'item', it: 'map', n: 1, d: { s: randomSpot(T.relic ? 3 : 0) }, x: n.x + rand(-6, 6), z: n.z + rand(-6, 6), float: 1 } });
  if (T.relic) netSend({ t: 'oc', o: { k: 'item', it: 'relic', n: 1, x: n.x, z: n.z, float: 1 } });
  if (T.bounty) netSend({ t: 'oc', o: { k: 'gold', x: n.x, z: n.z + 5, v: T.bounty, float: 1 } });
  netSend({ t: 'chat', text: `☠ The ${n.name} has gone to the bottom.` });
}
function npcCrew(n, dt) {
  const e = ENTS.get('n:' + n.id); if (!e) return;
  const boarders = playersOnShip('n:' + n.id);
  for (const k of n.crew) {
    if (k.hp <= 0) continue;
    k.cd = Math.max(0, k.cd - dt); k.f = 0;
    if (!boarders.length) { k.x += Math.sin(clock + k.z) * dt * 0.2; continue; }
    let b = null, bd = 1e9; for (const p of boarders) { const d = Math.hypot(p.lx - k.x, p.lz - k.z); if (d < bd) { bd = d; b = p; } }
    if (bd > 1.6) { k.x += (b.lx - k.x) / bd * 2.4 * dt; k.z += (b.lz - k.z) / bd * 2.4 * dt; }
    else if (k.cd <= 0) { k.cd = n.type === 'ghost' ? 1.0 : 1.3; k.f = 1; const dmg = n.type === 'ghost' ? 16 : 11; if (b.id === (NET.id || 'me')) hurtPlayer(dmg, 'n:' + n.id, 'crew', new THREE.Vector3(k.x, 0, k.z)); else netSend({ t: 'phit', to: b.id, dmg, from: 'n:' + n.id, k: 'crew', lx: k.x, lz: k.z }); }
    k.x = clamp(k.x, -2.6, 2.6); k.z = clamp(k.z, -11, 5);
  }
}
function npcFireLocal(m) {
  const e = ENTS.get('n:' + m.n); if (!e || !e.root.visible || e.sk) return;
  e.guns = gunLayout(SHIP_CLASSES[e.cls].guns);
  fireGunsOf(e, m.g, m.el, m.am, 'n:' + m.n, m.sd);
}
function npcHitLocal(e, dmg, sd, am, by) {
  e.pred = (e.pred != null ? e.pred : e.hp) - dmg;
  if (NET.isHost || !NET.on) { const n = NPCS.get(e.id.slice(2)); if (n && !n.sk) { n.hp -= dmg; n.sail = Math.max(0, n.sail - (sd || 0)); if (am === 'bomb' && Math.random() < 0.4) n.fire = 1; n.angry = by === 'me' ? (NET.id || 'me') : by; if (am === 'grape') { const live = n.crew.filter(c => c.hp > 0); if (live.length) live[(Math.random() * live.length) | 0].hp -= 40; } if (n.hp <= 0) sinkNpc(n); } }
  if (by === 'me' || by === NET.id) { ME.infamy = (ME.infamy || 0) + (NPC_TYPES[e.type].hostile === 'bounty' ? 2 : 0.5); }
}
function updateNpcCrewVisuals(dt, t) {
  for (const e of ENTS.values()) {
    if (e.kind !== 'npc') continue;
    const data = e.crewData || [], show = e.dist < 160 && !e.sk;
    const T = NPC_TYPES[e.type];
    while (e.crewAv.length < data.length) { const av = makeAvatar({ coat: e.type === 'navy' ? '#26406b' : e.type === 'merchant' ? '#6b5a3a' : ['#5a1f1a', '#2a2a2a', '#4a3a22'][e.crewAv.length % 3], style: e.type === 'navy' ? (e.crewAv.length ? 'sailor' : 'navy') : e.crewAv.length === 0 ? 'captain' : 'sailor', seed: (e.id.length * 977 + e.crewAv.length * 131) | 0, ghost: T.ghost }); setAvatarWeapon(av, 'cutlass'); e.body.add(av.root); av.root.scale.setScalar(1 / e.scale); e.crewAv.push(av); }
    e.crewAv.forEach((av, i) => {
      const c = data[i]; av.root.visible = show && c && c[2] > 0;
      if (!av.root.visible) return;
      const px = av.root.position.x, pz = av.root.position.z;
      av.root.position.set(c[0], DECK, c[1]);
      const sp = Math.hypot(c[0] - px, c[1] - pz) / Math.max(dt, 0.001);
      if (sp > 0.2) av.root.rotation.y = Math.atan2(-(c[0] - px), -(c[1] - pz));
      av.sw = c[3] ? 1 : Math.max(0, (av.sw || 0) - dt * 2.5);
      animAvatar(av, { spd: sp, t, swing: av.sw });
    });
  }
}
function playersOnShip(eid) {
  const out = [];
  if (PL.plat && PL.plat.id === eid && PL.alive) out.push({ id: NET.id || 'me', lx: PL.l.x, lz: PL.l.z });
  for (const P of PEERS.values()) if (P.pp === eid && P.alive !== 0) out.push({ id: P.id, lx: P.lx, lz: P.lz });
  return out;
}
function randomSpot(minTier = 0) { const L = SPOTS.filter(s => s.tier >= minTier); return L[(Math.random() * L.length) | 0].id; }

/* ---------- my jolly boat ---------- */
const JB = { on: 0, o: new THREE.Vector2(), h: 0, sp: 0, v: null, b: { h: 0, hv: 0, p: 0, pv: 0, r: 0, rv: 0 } };
function lowerJollyBoat() {
  if (!OWN.has || OWN.row) return;
  if (JB.on) { say('Your jolly boat is already in the water.', 1.8); return; }
  JB.on = 1; if (!JB.v) { JB.v = makeRowboat(); scene.add(JB.v.root); }
  JB.v.root.visible = true;
  const side = 1; JB.o.set(shipO.x + Math.cos(heading) * (5.5 * OWN.scale) * side, shipO.y - Math.sin(heading) * 5.5 * OWN.scale * side); JB.h = heading; JB.sp = 0;
  sfx.splash(5); sfx.ratchet(0);
  PL.mode = 'row'; PL.plat = JBENT; PL.l.set(0, -0.05, 0.6); say('You lower the jolly boat and climb down. W/S to row, A/D to turn, E to step out.', 3.5);
}
const JBENT = { id: 'jb', kind: 'jb', get body() { return JB.v.body; }, scale: 1, row: true };
function updateJollyBoat(dt) {
  if (!JB.on) return;
  const rowing = PL.mode === 'row' && PL.plat === JBENT;
  const f = rowing ? (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 0.5 : 0) - (coarse ? stick.y : 0) : 0;
  const tr = rowing ? (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + (coarse ? stick.x : 0) : 0;
  JB.sp += (f * 2.6 - JB.sp) * dt * 0.8; JB.h -= tr * 0.7 * dt;
  JB.o.x += -Math.sin(JB.h) * JB.sp * dt; JB.o.y += -Math.cos(JB.h) * JB.sp * dt;
  if (terrainH(JB.o.x, JB.o.y) > -0.4) { JB.sp *= 0.5; JB.o.x += Math.sin(JB.h) * 0.05; JB.o.y += Math.cos(JB.h) * 0.05; }
  const e = { o: JB.o, h: JB.h, root: JB.v.root, body: JB.v.body, b: JB.b, scale: 0.25 }; bobShip(e, dt, 0); JB.v.body.position.y += 0.3;
  rowOars(JB.v, clock, JB.sp);
  if (Math.abs(JB.sp) > 0.4 && Math.random() < dt * 2) sfx.stroke();
}
function hoistJollyBoat() { JB.on = 0; if (JB.v) JB.v.root.visible = false; sfx.ratchet(0); say('The jolly boat is hoisted aboard.', 1.8); }
