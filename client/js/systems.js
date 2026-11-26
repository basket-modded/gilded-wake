// The Gilded Wake — physical gold and loot, chests and strongboxes, kegs, base building and raiding,
// sharks, the profile, and the trade / shipyard / inventory / chest / map screens.

/* ================= PROFILE ================= */
let ME = null;
function newProfile() {
  const key = (crypto.getRandomValues ? [...crypto.getRandomValues(new Uint8Array(12))].map(b => b.toString(16).padStart(2, '0')).join('') : String(Math.random()).slice(2));
  const inv = new Array(24).fill(null); START.inv.forEach(([k, n], i) => inv[i] = { k, n });
  inv[15] = { k: 'map', n: 1, d: { s: '1:0' } };
  return { v: 2, key, name: '', gold: START.gold, inv, ships: [{ id: 'jolly', cls: 'rowboat', up: {}, look: { sail: 0, hull: 0, flag: 0 }, hp: 50 }], active: null, infamy: 0, kills: 0, ts: Date.now(), firstRun: 1 };
}
function loadProfile() { try { const p = JSON.parse(localStorage.getItem('gw.profile') || 'null'); if (p && p.v === 2) return p; } catch (e) {} return newProfile(); }
ME = loadProfile();
let saveT = 0;
function saveProfileSoon() { saveT = 2; }
function saveProfileNow() { ME.ts = Date.now(); if (OWN.has && OWN.rec) OWN.rec.hp = Math.round(OWN.hp); try { localStorage.setItem('gw.profile', JSON.stringify(ME)); } catch (e) {} netSend({ t: 'ps', k: ME.key, d: ME }); }
function activeShip() { return ME.ships.find(s => s.id === ME.active && !s.sunk) || null; }
ME.bounty = Math.round((ME.infamy || 0) * 150);

/* ================= OBJECTS (shared, server-authoritative) ================= */
const OBJS = new Map(); const OBJM = new Map();
const rq = new Map(); let rqSeq = 1;
function request(m) { return new Promise(res => { const id = rqSeq++; m.rq = id; rq.set(id, res); if (!NET.on) { res(localOp(m)); rq.delete(id); return; } netSend(m); setTimeout(() => { if (rq.has(id)) { rq.delete(id); res({ ok: 0 }); } }, 5000); }); }
function localOp(m) { // offline: emulate the server store locally
  if (m.t === 'ot') { const o = OBJS.get(m.id); if (!o) return { ok: 0 }; delObj(m.id); return { ok: 1, o }; }
  if (m.t === 'oi') { const o = OBJS.get(m.id); if (!o) return { ok: 0 }; const v = (o[m.f] || 0) + m.d; if (v < (m.min || 0) && !m.del) return { ok: 0 }; if (m.del && v <= 0) delObj(m.id); else { o[m.f] = v; updObj(m.id, { [m.f]: v }); } return { ok: 1, v }; }
  return { ok: 0 };
}
const _netSendRaw = (m) => netSend(m);
function oCreate(o) { if (!NET.on) { o.id = o.id || 'l' + Math.random().toString(36).slice(2); o.at = Date.now(); addObj(o); return; } netSend({ t: 'oc', o }); }
function addObj(o) { if (OBJS.has(o.id)) delObj(o.id); OBJS.set(o.id, o); const m = objMesh(o); if (m) { OBJM.set(o.id, m); } if (o.k === 'bp') basesDirty = 1; if (o.k === 'strongbox') strongChanged(o); }
function delObj(id) { const o = OBJS.get(id); OBJS.delete(id); const m = OBJM.get(id); if (m) { (m.parent || WORLD).remove(m); OBJM.delete(id); } if (o && o.k === 'bp') basesDirty = 1; }
function updObj(id, p, by) { const o = OBJS.get(id); if (!o) return; const prev = Object.assign({}, o); Object.assign(o, p); if (o.k === 'bp') basesDirty = 1; if (o.k === 'strongbox') { strongChanged(o, prev, by); } if (o.k === 'bp' && o.p === 'door') { const m = OBJM.get(id); } }
const coinGeo = merge([...Array(7)].map((_, i) => xf(cyl(0.09, 0.09, 0.02, 10), rand(-0.15, 0.15), i * 0.02, rand(-0.15, 0.15))));
const bagGeo = merge([xf(new THREE.SphereGeometry(0.28, 10, 8), 0, 0.22, 0, 0, 0, 0, 1, 1.1, 1), xf(cyl(0.06, 0.12, 0.12, 8), 0, 0.5, 0)]);
const sackMat = new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 1 });
const goldMat = new THREE.MeshStandardMaterial({ color: 0xe0aa38, metalness: 0.85, roughness: 0.3, emissive: 0x2a1700 });
function objMesh(o) {
  let m = null;
  if (o.k === 'gold') { m = new THREE.Group(); const n = clamp(Math.ceil(o.v / 400), 1, 6); for (let i = 0; i < n; i++) { const c = new THREE.Mesh(i ? coinGeo : bagGeo, i ? goldMat : sackMat); c.position.set(rand(-0.4, 0.4) * (i ? 1 : 0), 0, rand(-0.4, 0.4) * (i ? 1 : 0)); c.rotation.y = rand(0, 6); m.add(c); } const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc040, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.6 })); s.position.y = 0.4; s.scale.setScalar(1.6); m.add(s); }
  else if (o.k === 'item') { const it = ITEMS[o.it] || {}; m = new THREE.Mesh(it.cat === 'treasure' ? (o.it === 'cargo' ? new THREE.BoxGeometry(1, 0.8, 1) : new THREE.OctahedronGeometry(0.25)) : o.it === 'map' ? new THREE.CylinderGeometry(0.06, 0.06, 0.4, 8) : new THREE.BoxGeometry(0.5, 0.35, 0.5), o.it === 'cargo' ? MAT.crate : it.cat === 'treasure' ? goldMat : o.it === 'map' ? MAT.paper : MAT.med); if (o.it === 'map') m.rotation.z = Math.PI / 2; }
  else if (o.k === 'sack') { m = new THREE.Mesh(bagGeo, sackMat); m.scale.setScalar(1.3); }
  else if (o.k === 'tchest') { m = new THREE.Group(); const b = new THREE.Mesh(box(0.95, 0.55, 0.6), MAT.med); b.position.y = 0.28; m.add(b); const lid = new THREE.Mesh(box(0.97, 0.18, 0.62), MAT.med); lid.position.y = 0.63; m.add(lid); const bands = new THREE.Mesh(merge([xf(box(0.99, 0.05, 0.64), 0, 0.15, 0), xf(box(0.99, 0.05, 0.64), 0, 0.5, 0), xf(box(0.1, 0.14, 0.03), 0, 0.55, 0.32)]), MAT.brass); m.add(bands); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc860, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.7 })); s.position.y = 0.8; s.scale.setScalar(2.4); m.add(s); m.userData.rise = 1; }
  else if (o.k === 'keg') { m = new THREE.Group(); const k = new THREE.Mesh(barrelWoodG, MAT.med); k.scale.setScalar(1.2); k.rotation.z = o.float ? Math.PI / 2 : 0; m.add(k); const h = new THREE.Mesh(hoopG, MAT.iron); h.scale.copy(k.scale); h.rotation.copy(k.rotation); m.add(h); const f = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.2), MAT.red); f.position.y = 0.9; m.add(f); }
  if (!m) return null;
  m.userData.o = o; WORLD.add(m); placeObj(o, m, 0); return m;
}
function placeObj(o, m, t) {
  if (o.ship) { const e = o.ship === 'p:' + NET.id ? OWN : ENTS.get(o.ship); if (e && e.root.visible !== false) { const b = platBody(e); tmpW.set(o.lx || 0, DECK + 0.05, o.lz || 0); b.localToWorld(tmpW); m.position.set(tmpW.x + org.x, tmpW.y, tmpW.z + org.y); return; } }
  const w = o.float ? waveH(o.x - org.x, o.z - org.y, seaT) : null;
  m.position.set(o.x, o.float ? w - 0.05 : (o.y != null ? o.y : groundAt(o.x, o.z, 99)), o.z);
  if (o.float) { m.rotation.x = Math.sin(t * 1.3 + o.x) * 0.15; m.rotation.z = Math.cos(t * 1.1 + o.z) * 0.15; }
  if (m.userData.rise) { m.userData.rise = Math.max(0, m.userData.rise - 0.02); m.position.y -= m.userData.rise * 0.8; }
}
let objT = 0;
function updateObjects(dt, t) {
  objT -= dt;
  for (const [id, m] of OBJM) {
    const o = m.userData.o;
    const d = Math.hypot(o.x - org.x, o.z - org.y);
    m.visible = d < 900 || !!o.ship;
    if (!m.visible) continue;
    if (o.float || o.ship || m.userData.rise) placeObj(o, m, t);
    if (o.k === 'gold') m.rotation.y += dt * 0.6;
    if (o.float) { o.x += Math.sin(t * 0.05 + o.z) * dt * 0.15; } // drift a little
  }
  // walk over gold to scoop it up; float near gold while swimming or rowing
  if (PL.alive && objT <= 0) {
    objT = 0.2; const p = playerOcean();
    for (const [id, o] of OBJS) {
      if (o.k !== 'gold' || o.busy) continue;
      const m = OBJM.get(id); if (!m) continue;
      const dy = Math.abs(m.position.y - (p.y - 0.9));
      if (Math.hypot(o.x - p.x, o.z - p.z) < (o.float ? 2.2 : 1.5) && dy < 2.2) { o.busy = 1; request({ t: 'ot', id }).then(r => { o.busy = 0; if (r.ok) { ME.gold += r.o.v; sfx.coin(6); popText('+' + fmtG(r.o.v) + ' gold'); ME.ts = Date.now(); saveProfileSoon(); } }); }
    }
  }
  // kegs explode when a hull touches them
  if (OWN.has && !OWN.sk) for (const [id, o] of OBJS) if (o.k === 'keg' && o.float && !o.busy) { const l = ship.worldToLocal(new THREE.Vector3(o.x - org.x, 0.5, o.z - org.y)); if ((OWN.row ? inRow(l) : (l.x / 5) ** 2 + ((l.z + 0.5) / 16) ** 2 < 1)) detonateKeg(id); }
}
function detonateKeg(id) { const o = OBJS.get(id); if (!o || o.busy) return; o.busy = 1; request({ t: 'ot', id }).then(r => { if (r.ok) { const msg = { t: 'boom', x: o.x, y: 0.5, z: o.z, r: 12, pw: 1.4 }; netSend(msg); onBoom(msg); } else o.busy = 0; }); }
function kegHitCheck(pos) { for (const [id, o] of OBJS) if (o.k === 'keg' && Math.hypot(o.x - org.x - pos.x, o.z - org.y - pos.z) < 2.5) detonateKeg(id); }
function shootKegs(eye, d, rng) { for (const [id, o] of OBJS) { if (o.k !== 'keg') continue; const m = OBJM.get(id); if (!m) continue; const p = m.getWorldPosition(new THREE.Vector3()); const v = p.clone().sub(eye); const t = v.dot(d); if (t > 0 && t < rng && v.addScaledVector(d, -t).length() < 0.6) detonateKeg(id); } }
function popText(t) { const d = document.createElement('div'); d.className = 'pop'; d.textContent = t; $('#hud').appendChild(d); setTimeout(() => d.remove(), 1600); }

/* proximity interactions for objects and other ships */
function objInteract() {
  const p = playerOcean(); let best = null, bd = 2.6;
  for (const [id, o] of OBJS) {
    if (!['item', 'sack', 'tchest'].includes(o.k)) continue;
    const m = OBJM.get(id); if (!m || !m.visible) continue;
    const w = m.getWorldPosition(new THREE.Vector3()); const d = Math.hypot(w.x - (p.x - org.x), w.z - (p.z - org.y)) + Math.abs(w.y - (p.y - 0.9)) * 0.5;
    if (d < bd) { bd = d; best = o; }
  }
  if (best) {
    if (best.k === 'item') return { label: () => `Pick up ${ITEMS[best.it] ? ITEMS[best.it].n.toLowerCase() : 'it'}${best.n > 1 ? ' ×' + best.n : ''}`, act: () => takeObj(best) };
    if (best.k === 'sack') return { label: () => `Take ${best.name ? best.name + '’s' : 'the'} dropped purse`, sub: () => fmtG(best.v) + ' gold' + (best.items && best.items.length ? ' and belongings' : ''), act: () => takeObj(best) };
    if (best.k === 'tchest') return { label: () => 'Break open the treasure chest', sub: 'or press G to carry it', act: () => openTreasure(best), alt: () => carryTreasure(best) };
  }
  // strongboxes on ships you stand on
  const plat = PL.plat;
  if (plat && plat !== OWN && plat !== JBENT && !isRowPlat(plat)) {
    if (Math.hypot(PL.l.x - 1.6, PL.l.z - 12.65) < 1.6 && PL.l.y < 3.6) {
      const sid = plat.kind === 'npc' ? 'sb:' + plat.id.slice(2) : null;
      const sb = sid ? OBJS.get(sid) : [...OBJS.values()].find(o => o.k === 'strongbox' && o.ship === plat.id);
      return { label: () => 'Plunder the strongbox', sub: () => sb ? fmtG(sb.gold) + ' gold inside — hold E' : 'it’s empty', hold: 2.2, act: () => plunder(sb) };
    }
  }
  if (PL.mode === 'swim') {
    for (const e of shipsNear(p.x, p.z, 40)) { if (e === JBENT) { if (Math.hypot(JB.o.x - p.x, JB.o.y - p.z) < 3) return { label: () => 'Climb into the jolly boat', act: () => { PL.plat = JBENT; PL.mode = 'row'; PL.l.set(0, 0.35, 0.6); PL.yaw = 0; } }; continue; }
      const b = platBody(e); tmpL.set(p.x - org.x, 0, p.z - org.y); b.worldToLocal(tmpL);
      const row = isRowPlat(e); const inside = row ? Math.abs(tmpL.x) < 1.6 && Math.abs(tmpL.z) < 3 : (tmpL.x / 6) ** 2 + ((tmpL.z + 0.5) / 17) ** 2 < 1;
      if (inside) return { label: () => e === OWN ? 'Climb aboard your ship' : `Climb aboard the ${e.name || 'ship'}`, sub: e === OWN ? '' : 'board her!', act: () => { const sg = Math.sign(tmpL.x) || 1, z = clamp(tmpL.z, -10, 5); PL.plat = e; PL.l.set(row ? 0 : sg * (hw(z) * 0.8), row ? 0.32 : DECK, row ? 0 : z); PL.eyeY = PL.l.y; PL.yaw = 0; PL.mode = row ? 'row' : 'walk'; sfx.creak(0.2, null, 0.6); } };
    }
  }
  if (PL.mode === 'row' && PL.plat === JBENT) {
    if (OWN.has && Math.hypot(JB.o.x - shipO.x, JB.o.y - shipO.y) < 14 * OWN.scale) return { label: () => 'Climb aboard and hoist the boat', act: () => { hoistJollyBoat(); PL.plat = OWN; PL.l.set(0, DECK, 4); PL.eyeY = DECK; PL.mode = 'walk'; } };
    return { label: () => 'Step out of the boat', act: () => { PL.mode = 'walk'; const w = playerWorld(tmpW); PL.o.set(w.x + org.x + Math.cos(JB.h) * 1.4, w.z + org.y - Math.sin(JB.h) * 1.4); PL.y = Math.max(groundAt(PL.o.x, PL.o.y, 99), waveH(PL.o.x - org.x, PL.o.y - org.y, seaT) - 1.4); PL.plat = null; PL.yaw += JB.h; } };
  }
  return null;
}
async function takeObj(o) {
  const r = await request({ t: 'ot', id: o.id }); if (!r.ok) { say('Someone beat you to it.', 1.5); return; }
  const g = r.o;
  if (g.k === 'item') { invAdd(g.it, g.n || 1, g.d); sfx.clink(camera); popText(`+${g.n || 1} ${ITEMS[g.it].n}`); }
  if (g.k === 'sack') { ME.gold += g.v || 0; (g.items || []).forEach(([k, n, d]) => invAdd(k, n, d)); sfx.coin(6); popText('+' + fmtG(g.v || 0) + ' gold'); }
  saveProfileSoon();
}
async function openTreasure(o) {
  const r = await request({ t: 'ot', id: o.id }); if (!r.ok) return;
  const g = r.o; sfx.creak(0.3, null, 1.2); sfx.coins(camera);
  // coins burst out as piles to scoop up
  const n = clamp(Math.ceil(g.v / 600), 2, 7);
  for (let i = 0; i < n; i++) { const a = i / n * TAU; oCreate({ k: 'gold', x: g.x + Math.cos(a) * rand(1, 2.5), z: g.z + Math.sin(a) * rand(1, 2.5), v: Math.round(g.v / n) }); }
  (g.items || []).forEach(([k, c, d], i) => oCreate({ k: 'item', it: k, n: c, d, x: g.x + rand(-1, 1), z: g.z + rand(-1, 1) }));
  const w = new THREE.Vector3(g.x - org.x, (g.y || 0) + 0.6, g.z - org.y);
  for (let i = 0; i < 60; i++) emit({ x: w.x, y: w.y, z: w.z, vx: rand(-3, 3), vy: rand(3, 8), vz: rand(-3, 3), max: rand(0.8, 1.6), s0: 0.25, s1: 0.1, a0: 1, kind: 2, g: -9.8, drag: 0.3 });
  say(`Gold spills across the sand — ${fmtG(g.v)} in coin, and more besides.`, 3);
}
async function carryTreasure(o) { const r = await request({ t: 'ot', id: o.id }); if (!r.ok) return; PL.carry = r.o; carryMesh.visible = true; say('You heave the chest onto your shoulder. Get it to your strongbox — click to set it down.', 3); }
async function plunder(sb) {
  if (!sb || sb.gold <= 0) { say('Empty. Someone got here first.', 1.5); return; }
  const take = Math.min(sb.gold, 800);
  const r = await request({ t: 'oi', id: sb.id, f: 'gold', d: -take, min: 0 });
  if (r.ok) { ME.gold += take; sfx.coins(camera); popText('+' + fmtG(take) + ' gold'); ME.infamy = (ME.infamy || 0) + 1; ME.bounty = Math.round(ME.infamy * 150); saveProfileSoon(); netSend({ t: 'chat', text: '' }); }
}

/* ================= STRONGBOXES ================= */
function myStrongId() { return OWN.rec ? 'sb:' + ME.key.slice(0, 10) + ':' + OWN.rec.id : null; }
function strongGold(ent) { const id = ent === OWN ? myStrongId() : null; const o = id && OBJS.get(id); return o ? o.gold : 0; }
function ensureStrongbox() { const id = myStrongId(); if (id && !OBJS.has(id)) oCreate({ id, k: 'strongbox', ship: 'p:' + NET.id, gold: 0, owner: ME.key }); else if (id && OBJS.get(id).ship !== 'p:' + NET.id) netSend({ t: 'ou', id, p: { ship: 'p:' + NET.id } }); }
function strongChanged(o, prev, by) {
  if (o.id === myStrongId()) { const s = clamp(o.gold / 6000, 0, 1); chest.grp.children.forEach(c => { if (c.geometry && c.geometry.type === 'SphereGeometry') { c.visible = o.gold > 0; c.scale.set(1.08 * (0.4 + s * 0.6), 0.28 * (0.3 + s), 0.6 * (0.4 + s * 0.6)); } });
    if (prev && by && by !== NET.id && o.gold < prev.gold) { const who = (PEERS.get(by) || {}).name || 'Someone'; feed(`${who} is plundering your strongbox!`, '#e8655f'); say('Thieves in your cabin!', 2); } }
}

/* ================= BASE BUILDING ================= */
let basesDirty = 1, buildIdx = 0, buildRot = 0;
const BUILD_LIST = Object.keys(PIECES);
const baseGroup = new THREE.Group(); WORLD.add(baseGroup);
const BMAT = { wood: new THREE.MeshStandardMaterial({ map: tx(medTex, 0.7, 0.7), roughness: 0.85 }), stone: new THREE.MeshStandardMaterial({ color: 0x9a948a, roughness: 0.95, flatShading: false }), ghostOk: new THREE.MeshBasicMaterial({ color: 0x7fd18b, transparent: true, opacity: 0.35, depthWrite: false }), ghostBad: new THREE.MeshBasicMaterial({ color: 0xe8655f, transparent: true, opacity: 0.35, depthWrite: false }) };
let BCELLS = new Map(); // "cx,cz" -> foundation top y
function pieceGeo(o) {
  const p = o.p, L = [];
  const by = cellY(o.cx, o.cz) + (o.lv || 0) * 3;
  const cx = (o.cx + 0.5) * CELL, cz = (o.cz + 0.5) * CELL;
  if (p === 'foundation') { const g = terrainH(cx, cz); const top = o.y; L.push(xf(box(CELL, top - Math.min(g, top - 1) + 0.5, CELL), cx, (top + Math.min(g, top - 1) - 0.5) / 2, cz)); }
  else if (p === 'floor') L.push(xf(box(CELL, 0.2, CELL), cx, by - 0.1, cz));
  else if (p === 'roof') { const g = new THREE.ConeGeometry(CELL * 0.75, 1.6, 4); g.rotateY(Math.PI / 4); L.push(xf(g, cx, by + 0.8, cz)); }
  else if (p === 'stairs') { for (let i = 0; i < 10; i++) { const t = i / 10; const ang = (o.r || 0) * Math.PI / 2; const lx = 0, lz = -CELL / 2 + t * CELL + 0.15; L.push(xf(box(CELL * 0.8, 0.12, 0.32), cx + lx * Math.cos(ang) + lz * Math.sin(ang), by + t * 3 + 0.15, cz - lx * Math.sin(ang) + lz * Math.cos(ang), 0, ang, 0)); } }
  else if (['wall', 'doorway', 'window', 'door'].includes(p)) {
    const e = o.e || 0, ex = [0, 1, 0, -1][e] * CELL / 2, ez = [-1, 0, 1, 0][e] * CELL / 2, rot = e % 2 ? Math.PI / 2 : 0;
    const add = (w, h, x, y) => L.push(xf(box(w, h, 0.22), cx + ex + (e % 2 ? 0 : x), by + y, cz + ez + (e % 2 ? x : 0), 0, rot, 0));
    if (p === 'wall') add(CELL, 3, 0, 1.5);
    else if (p === 'window') { add(CELL, 1.1, 0, 0.55); add(CELL, 0.8, 0, 2.6); add(0.9, 1.1, -1.05, 1.65); add(0.9, 1.1, 1.05, 1.65); }
    else if (p === 'doorway') { add(0.9, 3, -1.05, 1.5); add(0.9, 3, 1.05, 1.5); add(1.2, 0.6, 0, 2.7); }
    else if (p === 'door') { /* drawn separately so it can swing */ }
  }
  return L;
}
function cellY(cx, cz) { const y = BCELLS.get(cx + ',' + cz); return y != null ? y : null; }
let baseMeshes = [], doorMeshes = new Map(), freeMeshes = new Map();
const BLOCKS = []; const FLOORS = []; // derived from pieces
function rebuildBases() {
  basesDirty = 0; BCELLS = new Map();
  for (const o of OBJS.values()) if (o.k === 'bp' && o.p === 'foundation') BCELLS.set(o.cx + ',' + o.cz, o.y);
  baseMeshes.forEach(m => baseGroup.remove(m)); baseMeshes = [];
  const by = { wood: [], stone: [] }; BLOCKS.length = 0; FLOORS.length = 0;
  for (const o of OBJS.values()) {
    if (o.k !== 'bp') continue;
    const P = PIECES[o.p]; if (!P) continue;
    if (P.place === 'free') continue;
    const cy = cellY(o.cx, o.cz); if (cy == null && o.p !== 'foundation') continue;
    const L = pieceGeo(o); (by[o.mat || 'wood'] || by.wood).push(...L);
    const b0 = (cy != null ? cy : o.y) + (o.lv || 0) * 3, cx = (o.cx + 0.5) * CELL, cz = (o.cz + 0.5) * CELL;
    if (o.p === 'foundation') FLOORS.push({ x: cx, z: cz, hx: CELL / 2, hz: CELL / 2, top: o.y });
    if (o.p === 'floor') FLOORS.push({ x: cx, z: cz, hx: CELL / 2, hz: CELL / 2, top: b0 });
    if (o.p === 'stairs') FLOORS.push({ x: cx, z: cz, hx: CELL / 2, hz: CELL / 2, top: b0, stair: o.r || 0 });
    if (['wall', 'window', 'doorway', 'door'].includes(o.p)) { const e = o.e || 0; const ex = [0, 1, 0, -1][e] * CELL / 2, ez = [-1, 0, 1, 0][e] * CELL / 2; if (o.p === 'wall' || o.p === 'window' || (o.p === 'door' && !o.open)) BLOCKS.push({ x: cx + ex, z: cz + ez, hx: e % 2 ? 0.15 : CELL / 2, hz: e % 2 ? CELL / 2 : 0.15, y0: b0, y1: b0 + 3, id: o.id }); if (o.p === 'doorway') { for (const s of [-1, 1]) BLOCKS.push({ x: cx + ex + (e % 2 ? 0 : s * 1.05), z: cz + ez + (e % 2 ? s * 1.05 : 0), hx: e % 2 ? 0.15 : 0.45, hz: e % 2 ? 0.45 : 0.15, y0: b0, y1: b0 + 3 }); } }
  }
  for (const k in by) if (by[k].length) { const m = new THREE.Mesh(merge(by[k]), BMAT[k]); m.castShadow = m.receiveShadow = true; baseGroup.add(m); baseMeshes.push(m); }
  // doors and free-standing pieces as their own meshes
  const seen = new Set();
  for (const o of OBJS.values()) {
    if (o.k !== 'bp') continue;
    if (o.p === 'door') { seen.add(o.id); let m = doorMeshes.get(o.id); if (!m) { m = new THREE.Group(); const d = new THREE.Mesh(box(1.18, 2.35, 0.1), MAT.med); d.position.set(0.59, 1.18, 0); m.add(d); const ir = new THREE.Mesh(xf(box(0.08, 0.08, 0.14), 1.0, 1.15, 0), MAT.iron); m.add(ir); baseGroup.add(m); doorMeshes.set(o.id, m); }
      const cy = cellY(o.cx, o.cz); if (cy == null) { m.visible = false; continue; } m.visible = true; const e = o.e || 0; const cx = (o.cx + 0.5) * CELL + [0, 1, 0, -1][e] * CELL / 2, cz = (o.cz + 0.5) * CELL + [-1, 0, 1, 0][e] * CELL / 2;
      const rot = e % 2 ? Math.PI / 2 : 0; m.position.set(cx - (e % 2 ? 0 : 0.6), cy + (o.lv || 0) * 3, cz - (e % 2 ? -0.6 : 0)); m.rotation.y = rot + (o.open ? -1.6 : 0); m.userData.o = o; }
    if (PIECES[o.p] && PIECES[o.p].place === 'free') { seen.add(o.id); let m = freeMeshes.get(o.id); if (!m) { m = freeMesh(o); baseGroup.add(m); freeMeshes.set(o.id, m); } m.position.set(o.x, o.y, o.z); m.rotation.y = (o.r || 0) * Math.PI / 2; m.userData.o = o;
      if (o.p === 'chest' || o.p === 'bed' || o.p === 'rack' || o.p === 'cannon') BLOCKS.push({ x: o.x, z: o.z, hx: 0.5, hz: 0.5, y0: o.y, y1: o.y + 1 }); }
  }
  for (const [id, m] of doorMeshes) if (!seen.has(id)) { baseGroup.remove(m); doorMeshes.delete(id); }
  for (const [id, m] of freeMeshes) if (!seen.has(id)) { baseGroup.remove(m); freeMeshes.delete(id); }
}
function freeMesh(o) {
  const g = new THREE.Group();
  if (o.p === 'chest') { g.add(new THREE.Mesh(merge([xf(box(1.1, 0.6, 0.6), 0, 0.3, 0), xf(box(1.12, 0.12, 0.62), 0, 0.62, 0)]), MAT.med)); g.add(new THREE.Mesh(merge([xf(box(1.14, 0.05, 0.64), 0, 0.2, 0), xf(box(1.14, 0.05, 0.64), 0, 0.5, 0)]), MAT.iron)); }
  else if (o.p === 'campfire') { const c = campfire(0, 0, g); c.position.set(0, 0, 0); }
  else if (o.p === 'cannon') { const car = new THREE.Mesh(carriageG, MAT.med); g.add(car); const b = new THREE.Mesh(barrelG, MAT.iron); b.position.y = 0.62; b.rotation.z = 0.08; g.add(b); }
  else if (o.p === 'rack') { g.add(new THREE.Mesh(merge([xf(box(1.4, 0.08, 0.2), 0, 1.4, 0), xf(box(1.4, 0.08, 0.2), 0, 0.5, 0), xf(box(0.08, 1.6, 0.08), -0.66, 0.8, 0), xf(box(0.08, 1.6, 0.08), 0.66, 0.8, 0)]), MAT.dark)); for (let i = 0; i < 3; i++) { const w = weaponMesh(['cutlass', 'musket', 'axe'][i]); w.position.set(-0.4 + i * 0.4, 0.55, 0.05); g.add(w); } }
  else if (o.p === 'bed') { g.add(new THREE.Mesh(merge([xf(box(1.0, 0.35, 2.0), 0, 0.2, 0), xf(box(0.9, 0.1, 1.8), 0, 0.42, 0)]), MAT.med)); const s = new THREE.Mesh(box(0.92, 0.08, 1.4), new THREE.MeshStandardMaterial({ color: 0x8a2a22 })); s.position.set(0, 0.5, 0.2); g.add(s); }
  return g;
}
function basePieceFloor(x, z, y) {
  if (basesDirty) rebuildBases();
  let h = -99;
  for (const f of FLOORS) { if (Math.abs(x - f.x) < f.hx && Math.abs(z - f.z) < f.hz) { let top = f.top; if (f.stair != null) { const ang = f.stair * Math.PI / 2; const lz = -(x - f.x) * Math.sin(ang) + (z - f.z) * Math.cos(ang); top = f.top + clamp((lz + CELL / 2) / CELL, 0, 1) * 3; } if (top <= y + 0.65 && top > h) h = top; } }
  return h;
}
function basePieceBlock(x, z, y, r) { for (const b of BLOCKS) if (y + 1.6 > b.y0 && y + 0.3 < b.y1 && Math.abs(x - b.x) < b.hx + r && Math.abs(z - b.z) < b.hz + r) return true; return false; }
// placement
const ghost = new THREE.Group(); WORLD.add(ghost); ghost.visible = false; let ghostPlan = null;
function aimPoint() { const eye = camera.position.clone(), d = new THREE.Vector3(); camera.getWorldDirection(d); for (let t = 0.5; t < 9; t += 0.25) { const p = eye.clone().addScaledVector(d, t); const ox = p.x + org.x, oz = p.z + org.y; const g = groundAt(ox, oz, p.y); if (p.y <= g + 0.02) return { x: ox, z: oz, y: g, d: t }; } const p = eye.clone().addScaledVector(d, 6); return { x: p.x + org.x, z: p.z + org.y, y: groundAt(p.x + org.x, p.z + org.y, p.y), d: 6, air: 1 }; }
function planPiece() {
  const k = BUILD_LIST[buildIdx], P = PIECES[k]; if (PL.plat) return { ok: false, why: 'Build on land, not aboard ship.' };
  const a = aimPoint(); const cx = Math.floor(a.x / CELL), cz = Math.floor(a.z / CELL);
  const plan = { p: k, cx, cz, lv: 0, e: 0, r: buildRot };
  const fy = cellY(cx, cz);
  if (k === 'foundation') {
    if (fy != null) { plan.y = fy; return { ok: false, why: 'Already built here.', plan }; }
    let mx = -99, mn = 99; for (const [dx, dz] of [[0.2, 0.2], [2.8, 0.2], [0.2, 2.8], [2.8, 2.8], [1.5, 1.5]]) { const h = terrainH(cx * CELL + dx, cz * CELL + dz); mx = Math.max(mx, h); mn = Math.min(mn, h); }
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([x, z]) => cellY(cx + x, cz + z)).filter(v => v != null);
    plan.y = nb.length ? nb[0] : Math.ceil((mx + 0.4) * 2) / 2;
    if (mx < -6) return { ok: false, why: 'Too deep — build closer to shore (docks may reach a little into the sea).', plan };
    if (I_town(cx * CELL, cz * CELL)) return { ok: false, why: 'Not in town — the harbourmaster forbids it.', plan };
    return { ok: true, plan };
  }
  if (P.place === 'free') { plan.x = a.x; plan.z = a.z; plan.y = a.y; return { ok: !a.air && a.d < 6, why: 'Aim at nearby ground or a floor.', plan }; }
  if (fy == null) return { ok: false, why: 'Place a foundation first.', plan };
  // level from aim height
  const lv = clamp(Math.floor((a.y - fy + 0.5) / 3), 0, 6); plan.lv = k === 'floor' || k === 'roof' ? Math.max(1, lv + (a.y - fy - lv * 3 > 1 ? 1 : 0)) : lv;
  if (k === 'roof') plan.lv = Math.max(0, lv);
  if (P.place === 'edge') { const fx = a.x / CELL - cx - 0.5, fz = a.z / CELL - cz - 0.5; plan.e = Math.abs(fx) > Math.abs(fz) ? (fx > 0 ? 1 : 3) : (fz > 0 ? 2 : 0);
    const clash = [...OBJS.values()].some(o => o.k === 'bp' && o.cx === cx && o.cz === cz && (o.lv || 0) === plan.lv && o.e === plan.e && PIECES[o.p].place === 'edge' && !(k === 'door' && o.p === 'doorway'));
    if (k === 'door' && ![...OBJS.values()].some(o => o.k === 'bp' && o.p === 'doorway' && o.cx === cx && o.cz === cz && (o.lv || 0) === plan.lv && o.e === plan.e)) return { ok: false, why: 'Doors go in a doorway.', plan };
    if (clash) return { ok: false, why: 'Something is already there.', plan }; }
  else { const clash = [...OBJS.values()].some(o => o.k === 'bp' && o.p === k && o.cx === cx && o.cz === cz && (o.lv || 0) === plan.lv); if (clash) return { ok: false, why: 'Already built here.', plan }; }
  return { ok: true, plan };
}
function I_town(x, z) { return ISLES.some(I => I.tR && Math.hypot(x - I.tx, z - I.tz) < I.tR); }
function canAfford(P) { for (const k in P.cost) if (invCount(k) < P.cost[k]) return false; return ME.gold >= (P.gold || 0); }
function buildPreview(dt) {
  if (PL.plat === OWN && OWN.has) { ghost.visible = false; $('#buildhud').innerHTML = 'Click to repair the hull with planks'; $('#buildhud').classList.add('on'); return; }
  if (PL.plat || PL.mode !== 'walk') { hideBuildPreview(); return; }
  const r = planPiece(); ghostPlan = r; ghost.visible = true;
  const P = PIECES[BUILD_LIST[buildIdx]];
  const gkey = JSON.stringify(r.plan) + r.ok + canAfford(P) + buildRot + (r.plan && r.plan.x != null ? '' : BCELLS.size);
  if (gkey !== ghost.userData.key) { ghost.userData.key = gkey;
  while (ghost.children.length) { const c = ghost.children[0]; ghost.remove(c); if (P.place !== 'free' && c.geometry) c.geometry.dispose(); }
  if (r.plan && !Object.values(r.plan).some(v => typeof v === 'number' && !isFinite(v))) {
    const o = Object.assign({ k: 'bp' }, r.plan); let L;
    if (P.place === 'free') { const m = freeMesh(o); m.position.set(o.x, o.y, o.z); m.rotation.y = buildRot * Math.PI / 2; m.traverse(c => { if (c.isMesh) c.material = r.ok ? BMAT.ghostOk : BMAT.ghostBad; }); ghost.add(m); }
    else { const tmpCell = o.p === 'foundation' && !BCELLS.has(o.cx + ',' + o.cz); if (tmpCell) BCELLS.set(o.cx + ',' + o.cz, o.y); L = pieceGeo(o.p === 'door' ? Object.assign({}, o, { p: 'wall' }) : o); if (tmpCell) BCELLS.delete(o.cx + ',' + o.cz); if (L.length) ghost.add(new THREE.Mesh(merge(L), r.ok && canAfford(P) ? BMAT.ghostOk : BMAT.ghostBad)); }
  }
  }
  const cost = Object.entries(P.cost).map(([k, n]) => `${n} ${ITEMS[k].n.toLowerCase()}`).join(', ') + (P.gold ? `, ${P.gold} gold` : '');
  $('#buildhud').innerHTML = `<b>${esc(P.n)}</b> · ${esc(cost)}<br>${r.ok ? (canAfford(P) ? 'Click to build' : 'You can’t afford it') : esc(r.why || '')} · wheel: change piece · R: rotate · right-click: demolish yours · U: upgrade to stone`;
  $('#buildhud').classList.add('on');
}
function hideBuildPreview() { ghost.visible = false; $('#buildhud') && $('#buildhud').classList.remove('on'); }
function buildClick() {
  if (PL.plat === OWN && OWN.has) { if (OWN.holes.length) patchHole(); else if (OWN.hp < OWN.max) { if (invTake('plank', 1)) { OWN.hp = Math.min(OWN.max, OWN.hp + OWN.max * 0.04); sfx.thud(camera, 0.7); say('You hammer a plank over the worst of it.', 1.4); } else say('You need planks to repair her.', 1.6); } else say('She’s sound as a bell.', 1.2); return; }
  const r = ghostPlan; const P = PIECES[BUILD_LIST[buildIdx]];
  if (!r || !r.ok) { say(r && r.why || 'Can’t build there.', 1.5); return; }
  if (!canAfford(P)) { say('Not enough materials. A chandler sells timber and iron.', 2); return; }
  for (const k in P.cost) invTake(k, P.cost[k]); ME.gold -= P.gold || 0;
  const o = Object.assign({ k: 'bp', owner: ME.key, oname: ME.name, hp: P.hp, mat: 'wood' }, r.plan);
  if (o.p === 'chest') { o.gold = 0; o.items = []; }
  oCreate(o); sfx.thud(camera, 1); sfx.creak(0.15, null, 0.4);
}
function targetPiece(maxD = 5) {
  const eye = camera.position.clone(), d = new THREE.Vector3(); camera.getWorldDirection(d);
  let best = null, bt = maxD;
  for (const o of OBJS.values()) { if (o.k !== 'bp') continue; const c = pieceCenter(o); if (!c) continue; const v = c.clone().sub(eye); const t = v.dot(d); if (t < 0 || t > bt) continue; if (v.addScaledVector(d, -t).length() < 1.4) { bt = t; best = o; } }
  return best;
}
function pieceCenter(o) { if (o.x != null && PIECES[o.p].place === 'free') return new THREE.Vector3(o.x - org.x, o.y + 0.5, o.z - org.y); const cy = cellY(o.cx, o.cz); if (cy == null) return null; const e = o.e || 0, pl = PIECES[o.p].place; return new THREE.Vector3((o.cx + 0.5) * CELL + (pl === 'edge' ? [0, 1, 0, -1][e] * CELL / 2 : 0) - org.x, (o.p === 'foundation' ? o.y - 0.3 : cy + (o.lv || 0) * 3 + 1.5), (o.cz + 0.5) * CELL + (pl === 'edge' ? [-1, 0, 1, 0][e] * CELL / 2 : 0) - org.y); }
function demolish() { const o = targetPiece(); if (!o) return; if (o.owner !== ME.key) { say('That isn’t yours to take down — but an axe or a keg might.', 2); return; } const P = PIECES[o.p]; request({ t: 'ot', id: o.id }).then(r => { if (r.ok) { for (const k in P.cost) invAdd(k, Math.floor(P.cost[k] / 2)); if (o.gold) ME.gold += o.gold; (o.items || []).forEach(([k, n, d]) => invAdd(k, n, d)); sfx.thud(camera, 0.8); } }); }
function upgradePiece() { const o = targetPiece(); if (!o || o.owner !== ME.key || o.mat === 'stone') return; if (!invTake('metal', 6) || ME.gold < 120) { say('Stone work needs 6 iron and 120 gold.', 2); return; } ME.gold -= 120; netSend({ t: 'ou', id: o.id, p: { mat: 'stone', hp: PIECES[o.p].hp * 2.5 } });; say('Reinforced with stone.', 1.4); }
function damagePiece(o, dmg) { request({ t: 'oi', id: o.id, f: 'hp', d: -dmg, del: 1 }).then(r => { if (r.ok && r.v <= 0) { const c = pieceCenter(o); if (c) splinters(c, 40); if (o.gold > 0) oCreate({ k: 'gold', x: (c ? c.x : 0) + org.x, z: (c ? c.z : 0) + org.y, v: o.gold }); (o.items || []).forEach(([k, n, d]) => oCreate({ k: 'item', it: k, n, d, x: (c ? c.x : 0) + org.x + rand(-1, 1), z: (c ? c.z : 0) + org.y + rand(-1, 1) })); } }); }
function meleeBase(eye, dir, it) { const o = targetPiece(it.rng + 0.8); if (!o || o.owner === ME.key) return false; damagePiece(o, it.bdmg || 6); const c = pieceCenter(o); if (c) splinters(c, 6); return true; }
function ballHitsWorld(pos, b) {
  for (const o of OBJS.values()) { if (o.k !== 'bp') continue; const c = pieceCenter(o); if (c && c.distanceTo(pos) < 2) { damagePiece(o, b.ammo === 'bomb' ? 160 : 70); splinters(pos, 20); return true; } }
  return false;
}
function blastBase(ox, oy, oz, radius, power, by) { if (by && by !== NET.id && by !== 'me') return; // the exploder pays for the damage
  for (const o of OBJS.values()) { if (o.k !== 'bp') continue; const c = pieceCenter(o); if (!c) continue; const d = Math.hypot(c.x + org.x - ox, c.z + org.y - oz, c.y - oy); if (d < radius) damagePiece(o, Math.round(power * 320 * (1 - d / radius))); } }
function myBed() { return [...OBJS.values()].find(o => o.k === 'bp' && o.p === 'bed' && o.owner === ME.key); }
function baseInteract() {
  const eye = camera.position.clone(), d = new THREE.Vector3(); camera.getWorldDirection(d);
  let best = null, bt = 3;
  for (const o of OBJS.values()) { if (o.k !== 'bp' || !['door', 'chest', 'cannon', 'bed', 'campfire'].includes(o.p)) continue; const c = pieceCenter(o); if (!c) continue; if (o.p === 'door') c.y -= 0.3; const v = c.clone().sub(eye); const t = v.dot(d); if (t < 0 || t > bt) continue; if (v.addScaledVector(d, -t).length() < 1) { bt = t; best = o; } }
  if (!best) return null;
  const mine = best.owner === ME.key;
  if (best.p === 'door') return { label: () => best.open ? 'Close the door' : mine ? 'Open the door' : 'Locked', sub: mine ? '' : `belongs to ${best.oname || 'someone'} — break it down`, act: () => { if (!mine && !best.open) { sfx.thud(camera, 0.6); return; } netSend({ t: 'ou', id: best.id, p: { open: best.open ? 0 : 1 } });; sfx.door(camera); } };
  if (best.p === 'chest') return { label: () => mine ? 'Your storage chest' : `${best.oname || 'Someone'}’s chest`, sub: () => fmtG(best.gold || 0) + ' gold · ' + (best.items || []).length + ' stacks', act: () => openChestUI(best) };
  if (best.p === 'bed') return { label: () => mine ? 'Your bed' : 'A bed', sub: mine ? 'you’ll wake here' : '', act: () => { if (mine) say('You’ll wake here after a bad day.', 2); } };
  if (best.p === 'campfire') return { label: () => 'Campfire', sub: () => cookable() ? 'cook your fish' : '', act: cookAll };
  if (best.p === 'cannon') return { label: () => 'Fire the fort cannon', sub: 'aims where you look', act: () => { if (!invTake(curAmmo, 1)) { say('No shot.', 1); return; } const c = pieceCenter(best); const dir = new THREE.Vector3(); camera.getWorldDirection(dir); const out = new THREE.Vector3(dir.x, 0, dir.z).normalize(); const el = clamp(-PL.pitch * 0.5 + 0.1, 0.02, 0.35); const sd = (Math.random() * 1e5) | 0; shoot(c.clone().add(out.clone().multiplyScalar(1.4)), out, el, 'me', sd, new THREE.Vector3(), curAmmo); netSend({ t: 'xshot', x: c.x + org.x, y: c.y, z: c.z + org.y, dx: out.x, dz: out.z, el, sd, am: curAmmo }); } };
  return null;
}

/* ================= SHARKS ================= */
const sharkGeo = merge([xf(new THREE.SphereGeometry(0.5, 10, 6), 0, 0, 0, 0, 0, 0, 0.6, 0.55, 2.6), xf(new THREE.ConeGeometry(0.28, 0.75, 4), 0, 0.55, 0.1, -0.35, 0, 0), xf(new THREE.ConeGeometry(0.3, 0.7, 4), 0, 0.1, 1.5, Math.PI / 2, 0, 0, 1, 1, 0.3)]);
const sharkMat = new THREE.MeshStandardMaterial({ color: 0x5f6a72, roughness: 0.6 });
const SHARKS = [];
for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(sharkGeo, sharkMat); scene.add(m); SHARKS.push({ m, a: rand(0, TAU), r: rand(25, 45), hp: 80, cd: 0, flee: 0, o: new THREE.Vector2(rand(-200, 200), rand(-200, 200)), dep: 0, dead: 0 }); }
function killShark(sh) { sh.dead = 30; sh.hp = 0; splash(sh.m.position, 0.5); say('The shark rolls over and sinks.', 1.5); if (Math.random() < 0.5) invAdd('f_tuna', 1); }
function updateSharks(dt, t) {
  const me = playerOcean(), swimming = PL.mode === 'swim' && PL.alive;
  const center = OWN.has ? shipO : new THREE.Vector2(me.x, me.z);
  for (const sh of SHARKS) {
    if (sh.dead > 0) { sh.dead -= dt; sh.m.visible = false; if (sh.dead <= 0) { sh.hp = 80; sh.o.set(center.x + rand(-150, 150), center.y + rand(-150, 150)); } continue; }
    if (terrainH(sh.o.x, sh.o.y) > -4) { sh.o.set(center.x + rand(-120, 120), center.y + rand(-120, 120)); }
    sh.m.visible = true; sh.cd -= dt; sh.flee -= dt;
    const dP = Math.hypot(me.x - sh.o.x, me.z - sh.o.y);
    let tx, tz;
    if (swimming && dP < 40 && sh.flee <= 0) { tx = me.x; tz = me.z; sh.dep = lerp(sh.dep, -1.2, dt); if (dP < 1.8 && sh.cd <= 0) { sh.cd = 1.6; hurtPlayer(22, null, 'shark'); sfx.bite(camera); say('A shark!', 1); } }
    else { sh.a += dt * 0.25 * (sh.flee > 0 ? 3 : 1); const r = sh.flee > 0 ? sh.r * 3 : sh.r; tx = center.x + Math.cos(sh.a) * r; tz = center.y + Math.sin(sh.a) * r; sh.dep = lerp(sh.dep, -0.35, dt); }
    const dx = tx - sh.o.x, dz = tz - sh.o.y, d = Math.hypot(dx, dz) || 1, v = sh.flee > 0 ? 7 : swimming && dP < 40 ? 5 : 3;
    sh.o.x += dx / d * v * dt; sh.o.y += dz / d * v * dt;
    const wx = sh.o.x - org.x, wz = sh.o.y - org.y;
    sh.m.position.set(wx, waveH(wx, wz, seaT) + sh.dep, wz); sh.m.rotation.set(0, Math.atan2(dx, dz) + Math.PI, Math.sin(t * 3 + sh.a) * 0.1);
  }
}

/* ================= SCREENS ================= */
let uiKind = '';
const uiOpen = () => !!uiKind;
function openUI(kind, title, html, wide) { uiKind = kind; const u = $('#ui'); u.classList.toggle('wide', !!wide); $('#uititle').textContent = title; $('#uibody').innerHTML = html; u.classList.add('on'); if (document.pointerLockElement) document.exitPointerLock(); }
function closeUI() { const was = uiKind; uiKind = ''; $('#ui').classList.remove('on'); hideTip(); if (state === 'yard' && was === 'yard') { beginVoyage(); return; } if (!coarse && !dragLook && state === 'play') requestLock(); }
$('#uiclose').addEventListener('click', closeUI);
function hideTip() {}
function itemRow(k, n, extra) { const it = ITEMS[k] || { n: k }; return `<span class="ic">${ICON[it.cat] || '·'}</span><span class="nm">${esc(it.n)}${n > 1 ? ` <i>×${n}</i>` : ''}</span>${extra || ''}`; }
function priceOf(k, shop) { const it = ITEMS[k]; const bulk = BULK[k] || 1; return Math.round((it.price || it.sell || 10) * bulk * (shop.markup || 1)); }
function sellPrice(k, shop) { const it = ITEMS[k]; const base = it.sell || (it.price ? it.price * 0.5 : 5); return Math.max(1, Math.round(base * (shop.sellBonus || 1))); }
function openShop(key) {
  if (key === 'yard') return openShipyard();
  const shop = SHOPS[key]; const render = () => {
    const buy = shop.items.map(k => { const p = priceOf(k, shop), b = BULK[k] || 1; return `<button class="row" data-buy="${k}" ${ME.gold < p ? 'disabled' : ''}>${itemRow(k, b)}<b>${fmtG(p)}</b></button>`; }).join('');
    const sell = ME.inv.map((s, i) => s && ITEMS[s.k] && shop.buyCats.includes(ITEMS[s.k].cat) ? `<button class="row" data-sell="${i}">${itemRow(s.k, s.n)}<b>${fmtG(sellPrice(s.k, shop))} ea</b></button>` : '').join('') || '<p class="muted">Nothing they want.</p>';
    let extra = '';
    if (shop.crew) { const st = OWN.st; const max = st ? st.crewMax : 0; extra = `<h4>Crew</h4><button class="row" data-crew="1" ${!OWN.has || (OWN.crewN || 0) >= max || ME.gold < 300 ? 'disabled' : ''}><span class="nm">Hire a deckhand · ${OWN.crewN || 0}/${max} aboard</span><b>300</b></button><p class="muted">Crew reload faster, patch holes, fight fires and repel boarders.</p><button class="row" data-rumour="1" ${ME.gold < 150 ? 'disabled' : ''}><span class="nm">Buy a rumour from an old sailor</span><b>150</b></button>`; }
    $('#uibody').innerHTML = `<div class="cols"><div><h4>Buy</h4>${buy}${extra}</div><div><h4>Sell</h4>${sell}</div></div><p class="purse">Your purse: <b>${fmtG(ME.gold)}</b> gold</p>`;
  };
  openUI('shop', shop.n, ''); render();
  $('#uibody').onclick = e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.buy) { const k = b.dataset.buy, p = priceOf(k, shop); if (ME.gold >= p) { ME.gold -= p; invAdd(k, BULK[k] || 1, k === 'map' ? { s: randomSpot() } : undefined); sfx.coin(2); } }
    if (b.dataset.sell) { const i = +b.dataset.sell, s = ME.inv[i]; if (s) { const p = sellPrice(s.k, shop); s.n -= 1; ME.gold += p; if (s.n <= 0) ME.inv[i] = null; sfx.coin(3); invChanged(); } }
    if (b.dataset.crew) { ME.gold -= 300; OWN.crewN = (OWN.crewN || 0) + 1; OWN.rec.crew = OWN.crewN; say('A weathered sailor signs your articles.', 2); spawnOwnCrew(); }
    if (b.dataset.rumour) { ME.gold -= 150; const sp = randomSpot(Math.random() < 0.3 ? 2 : 0); invAdd('map', 1, { s: sp }); const I = ISLES[SPOTS.find(s => s.id === sp).isl]; say(`“There’s gold buried on ${I.name}, I swear it.” He sketches you a map.`, 4); }
    saveProfileSoon(); render();
  };
}
function openShipyard(first) {
  const tab = { t: first ? 'fleet' : 'fleet' };
  const render = () => {
    const act = ME.active;
    const fleet = ME.ships.map(s => { const st = shipStats(s), c = SHIP_CLASSES[s.cls]; const L = s.look || {}; return `<div class="card ${s.id === act ? 'sel' : ''}"><div class="ch"><b>${esc(s.name || c.n)}</b> <span class="muted">${c.n}${s.sunk ? ' · sunk' : ''}</span></div>
      <div class="stats">Hull ${st.max} · ${st.guns} guns a side · speed ${(st.speed * 1.944).toFixed(1)} kn · hold ${st.slots}</div>
      ${s.sunk ? `<button data-raise="${s.id}" ${ME.gold < Math.round(c.price * 0.5) ? 'disabled' : ''}>Raise from the deep · ${fmtG(Math.round(c.price * 0.5))}</button>` : `<button data-sail="${s.id}">${s.id === act ? 'Sailing this ship' : 'Take command'}</button>`}
      ${!s.sunk && s.cls !== 'rowboat' ? `<div class="ups">${Object.entries(UPGRADES).map(([k, U]) => { const l = (s.up || {})[k] || 0, cost = l < U.max ? U.cost(c, l) : 0; return `<button data-up="${s.id}:${k}" ${l >= U.max || ME.gold < cost ? 'disabled' : ''} title="${U.desc}">${U.n} ${'●'.repeat(l)}${'○'.repeat(U.max - l)}${l < U.max ? ' · ' + fmtG(cost) : ''}</button>`; }).join('')}</div>
      <div class="looks">Sails ${LOOKS.sail.map((c2, i) => `<button class="sw ${L.sail === i ? 'on' : ''}" style="background:${c2[0]}" title="${c2[1]}" data-look="${s.id}:sail:${i}"></button>`).join('')}<br>Paint ${LOOKS.hull.map((c2, i) => `<button class="sw ${L.hull === i ? 'on' : ''}" style="background:${c2[0]}" title="${c2[1]}" data-look="${s.id}:hull:${i}"></button>`).join('')}<br>Flag ${LOOKS.flag.map((c2, i) => `<button class="fl ${L.flag === i ? 'on' : ''}" data-look="${s.id}:flag:${i}">${c2[1]}</button>`).join('')}</div>` : ''}
      ${s.id === act && OWN.has && OWN.hp < OWN.max ? `<button data-repair="1" ${ME.gold < repairCost() ? 'disabled' : ''}>Repair hull, sails and holes · ${fmtG(repairCost())}</button>` : ''}</div>`; }).join('');
    const buy = Object.entries(SHIP_CLASSES).filter(([k]) => k !== 'rowboat').map(([k, c]) => `<div class="card"><div class="ch"><b>${c.n}</b> <span class="muted">${fmtG(c.price)} gold</span></div><div class="stats">Hull ${c.hp} · ${c.guns} guns a side · ${(c.speed * 1.944).toFixed(1)} kn · crew ${c.crew}</div><p class="muted">${c.desc}</p><button data-buyship="${k}" ${ME.gold < c.price ? 'disabled' : ''}>Buy</button></div>`).join('');
    $('#uibody').innerHTML = `<p class="purse">Your purse: <b>${fmtG(ME.gold)}</b> gold · you start with plenty — spend it, but a sunk ship takes its strongbox with it.</p><div class="cols"><div><h4>Your fleet</h4>${fleet}</div><div><h4>Ships for sale</h4>${buy}</div></div>${first ? `<button class="btn big" data-go="1">${activeShip() ? 'Set sail' : 'Sail the rowboat'}</button>` : ''}`;
  };
  openUI('yard', first ? 'Choose your ship' : 'The shipwright', '', true); render();
  $('#uibody').onclick = e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.buyship) { const k = b.dataset.buyship, c = SHIP_CLASSES[k]; ME.gold -= c.price; const id = 's' + Date.now().toString(36); ME.ships.push({ id, cls: k, up: {}, look: { sail: 0, hull: 0, flag: 0 }, hp: c.hp, crew: 0 }); ME.active = id; sfx.coins(camera); if (!first) swapShip(); }
    if (b.dataset.sail) { ME.active = b.dataset.sail; if (!first) swapShip(); }
    if (b.dataset.raise) { const s = ME.ships.find(x => x.id === b.dataset.raise); ME.gold -= Math.round(SHIP_CLASSES[s.cls].price * 0.5); s.sunk = 0; s.hp = shipStats(s).max; }
    if (b.dataset.up) { const [id, k] = b.dataset.up.split(':'); const s = ME.ships.find(x => x.id === id); s.up = s.up || {}; const l = s.up[k] || 0; ME.gold -= UPGRADES[k].cost(SHIP_CLASSES[s.cls], l); s.up[k] = l + 1; if (id === ME.active && OWN.has) { const hp = OWN.hp; setOwnShip(s); OWN.hp = Math.min(OWN.max, hp + (k === 'hull' ? OWN.max * 0.2 : 0)); } sfx.thud(camera, 0.6); }
    if (b.dataset.look) { const [id, k, i] = b.dataset.look.split(':'); const s = ME.ships.find(x => x.id === id); s.look = s.look || {}; s.look[k] = +i; if (id === ME.active && OWN.has) { const hp = OWN.hp; setOwnShip(s); OWN.hp = hp; } }
    if (b.dataset.repair) { ME.gold -= repairCost(); OWN.hp = OWN.max; OWN.sail = 100; OWN.fire = 0; OWN.flood = 0; for (const h of OWN.holes) ship.remove(h.m); OWN.holes = []; sfx.thud(camera, 1); say('The shipwright’s men swarm over her. Good as new.', 2); }
    if (b.dataset.go) { closeUI(); beginVoyage(); return; }
    saveProfileSoon(); render();
  };
}
function repairCost() { return Math.round((OWN.max - OWN.hp) * 4 + (100 - OWN.sail) * 6 + OWN.holes.length * 40); }
function swapShip() {
  const rec = activeShip(); const I = nearestPort();
  if (OWN.has && OWN.rec) OWN.rec.hp = Math.round(OWN.hp);
  setOwnShip(rec || ME.ships[0]); if (!rec) ME.active = ME.ships[0].id;
  if (I && I.dockEnd) { const a = I.ta; shipO.set(I.dockEnd.x + Math.cos(a) * 25 + Math.sin(a) * 18, I.dockEnd.z + Math.sin(a) * 25 - Math.cos(a) * 18); heading = -a + Math.PI; }
  ensureStrongbox(); spawnOwnCrew();
  say(`The ${SHIP_CLASSES[OWN.cls].n.toLowerCase()} is brought round to the end of the pier.`, 3);
}
function nearestPort() { const p = playerOcean(); let best = null, bd = 1e9; for (const I of ISLES) if (I.dockEnd) { const d = Math.hypot(I.dockEnd.x - p.x, I.dockEnd.z - p.z); if (d < bd) { bd = d; best = I; } } return best; }
function openStrongbox(ent) {
  ensureStrongbox(); const id = myStrongId();
  const render = () => { const o = OBJS.get(id); const g = o ? o.gold : 0;
    $('#uibody').innerHTML = `<p>Your strongbox holds <b>${fmtG(g)}</b> gold. You carry <b>${fmtG(ME.gold)}</b>.</p><p class="muted">Gold in the strongbox is safe from a knife in the dark — but it goes down with the ship, and boarders can plunder it.</p>
      <div class="row2"><input id="amt" type="number" min="0" step="100" value="${Math.min(1000, Math.max(ME.gold, g))}"><button data-dep="1">Deposit</button><button data-wd="1">Withdraw</button><button data-all="1">Deposit all</button></div>
      ${PL.carry ? '<button data-stow="1" class="btn">Stow the treasure chest you’re carrying</button>' : ''}`; };
  openUI('strong', 'Ship’s strongbox', ''); render();
  $('#uibody').onclick = async e => { const b = e.target.closest('button'); if (!b) return; let n = Math.max(0, Math.floor(+$('#amt').value || 0));
    if (b.dataset.all) n = Math.floor(ME.gold);
    if (b.dataset.dep || b.dataset.all) { n = Math.min(n, Math.floor(ME.gold)); if (n > 0) { const r = await request({ t: 'oi', id, f: 'gold', d: n }); if (r.ok) { ME.gold -= n; sfx.coins(chest.grp); } } }
    if (b.dataset.wd) { const r = await request({ t: 'oi', id, f: 'gold', d: -n, min: 0 }); if (r.ok) { ME.gold += n; sfx.coin(5); } else say('Not that much inside.', 1.4); }
    if (b.dataset.stow && PL.carry) { const c = PL.carry; PL.carry = null; carryMesh.visible = false; const r = await request({ t: 'oi', id, f: 'gold', d: c.v || 0 }); (c.items || []).forEach(([k, n2, d]) => invAdd(k, n2, d)); sfx.coins(chest.grp); say(`Stowed: ${fmtG(c.v || 0)} gold into the strongbox.`, 2.5); }
    saveProfileSoon(); render(); };
}
function openChestUI(o) {
  const render = () => { const cur = OBJS.get(o.id) || o;
    const left = ME.inv.map((s, i) => s ? `<button class="row" data-put="${i}">${itemRow(s.k, s.n)}<b>→</b></button>` : '').join('');
    const right = (cur.items || []).map((s, i) => `<button class="row" data-get="${i}">${itemRow(s[0], s[1])}<b>←</b></button>`).join('') || '<p class="muted">Empty.</p>';
    $('#uibody').innerHTML = `<div class="cols"><div><h4>You</h4>${left}</div><div><h4>Chest</h4>${right}</div></div><div class="row2"><span>Gold in chest: <b>${fmtG(cur.gold || 0)}</b> · yours: <b>${fmtG(ME.gold)}</b></span><input id="amt" type="number" min="0" step="100" value="500"><button data-dep="1">Put gold</button><button data-wd="1">Take gold</button></div>`; };
  openUI('chest', o.owner === ME.key ? 'Your chest' : 'Someone else’s chest', ''); render();
  $('#uibody').onclick = async e => { const b = e.target.closest('button'); if (!b) return; const cur = OBJS.get(o.id); if (!cur) { closeUI(); return; }
    if (b.dataset.put) { const i = +b.dataset.put, s = ME.inv[i]; if (s) { ME.inv[i] = null; const items = (cur.items || []).concat([[s.k, s.n, s.d]]); netSend({ t: 'ou', id: o.id, p: { items } });; invChanged(); } }
    if (b.dataset.get) { const i = +b.dataset.get, items = (cur.items || []).slice(), s = items.splice(i, 1)[0]; if (s) { netSend({ t: 'ou', id: o.id, p: { items } });; invAdd(s[0], s[1], s[2]); if (cur.owner !== ME.key) { ME.infamy = (ME.infamy || 0) + 0.5; } } }
    const n = Math.max(0, Math.floor(+$('#amt').value || 0));
    if (b.dataset.dep && n <= ME.gold) { const r = await request({ t: 'oi', id: o.id, f: 'gold', d: n }); if (r.ok) ME.gold -= n; }
    if (b.dataset.wd) { const r = await request({ t: 'oi', id: o.id, f: 'gold', d: -n, min: 0 }); if (r.ok) ME.gold += n; }
    sfx.clink(camera); saveProfileSoon(); setTimeout(render, 120); };
}
let invSel = -1;
function openInventory() {
  const render = () => {
    const slots = ME.inv.map((s, i) => `<button class="slot ${i < 8 ? 'hb' : ''} ${i === invSel ? 'sel' : ''} ${i === PL.slot ? 'eq' : ''}" data-s="${i}">${i < 8 ? `<em>${i + 1}</em>` : ''}${s ? `<span class="ic">${ICON[(ITEMS[s.k] || {}).cat] || '·'}</span><span class="nm">${esc((ITEMS[s.k] || { n: s.k }).n)}</span>${s.n > 1 ? `<i>${s.n}</i>` : ''}` : ''}</button>`).join('');
    const sel = ME.inv[invSel]; const it = sel && ITEMS[sel.k];
    const detail = sel ? `<div class="detail"><b>${esc(it.n)}</b>${sel.n > 1 ? ' ×' + sel.n : ''}<p class="muted">${esc(it.desc || ({ melee: `Damage ${it.dmg} · right-click to block, block just as they strike to parry`, gun: `Damage ${it.dmg}${it.pel > 1 ? '×' + it.pel : ''} · range ${it.rng} m · reload ${it.rel}s`, food: `Restores ${it.heal} health`, drink: `Restores ${it.heal} health. Goes to your head.`, fish: it.cook ? 'Cook it at a campfire' : 'Sell it', treasure: `Worth about ${fmtG(it.sell)} to a trader`, map: 'Click it in your hand to read it' }[it.cat] || ''))}</p><button data-use="1">Hold it</button><button data-drop="1">Drop</button></div>` : '<p class="muted">Click an item, then click another slot to move it. Slots 1–8 are your hotbar.</p>';
    const craft = RECIPES.map((r, i) => { const ok = Object.entries(r.need).every(([k, n]) => invCount(k) >= n); return `<button class="row" data-craft="${i}" ${ok ? '' : 'disabled'}>${itemRow(r.out, r.n)}<b class="muted">${Object.entries(r.need).map(([k, n]) => n + ' ' + ITEMS[k].n.toLowerCase()).join(', ')}</b></button>`; }).join('');
    $('#uibody').innerHTML = `<div class="cols"><div><div class="grid8">${slots}</div>${detail}<div class="row2"><span>Gold carried: <b>${fmtG(ME.gold)}</b> · load ${Math.round(invWeight())}/60</span><input id="amt" type="number" min="0" step="100" value="500"><button data-dropgold="1">Drop gold</button></div></div><div><h4>Craft</h4>${craft}</div></div>`;
  };
  openUI('inv', 'Inventory', '', true); render();
  $('#uibody').onclick = e => { const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.s != null) { const i = +b.dataset.s; if (invSel >= 0 && invSel !== i) { const t = ME.inv[i]; ME.inv[i] = ME.inv[invSel]; ME.inv[invSel] = t; invSel = -1; invChanged(); } else invSel = invSel === i ? -1 : i; }
    if (b.dataset.use && invSel >= 0) { if (invSel < 8) PL.slot = invSel; else { const t = ME.inv[PL.slot]; ME.inv[PL.slot] = ME.inv[invSel]; ME.inv[invSel] = t; } invSel = -1; invChanged(); }
    if (b.dataset.drop && invSel >= 0) { const s = ME.inv[invSel]; ME.inv[invSel] = null; const p = playerOcean(); oCreate({ k: 'item', it: s.k, n: s.n, d: s.d, x: p.x - Math.sin(PL.yaw + platYawW()), z: p.z - Math.cos(PL.yaw + platYawW()), y: PL.plat ? p.y - 0.9 : undefined, float: PL.mode === 'swim' || (PL.plat && PL.plat !== OWN) ? 1 : 0 }); invSel = -1; invChanged(); }
    if (b.dataset.dropgold) { const n = Math.min(Math.floor(+$('#amt').value || 0), Math.floor(ME.gold)); if (n > 0) { ME.gold -= n; const p = playerOcean(); oCreate({ k: 'gold', x: p.x - Math.sin(PL.yaw + platYawW()) * 1.5, z: p.z - Math.cos(PL.yaw + platYawW()) * 1.5, y: p.y - 0.9, v: n, float: PL.mode === 'swim' ? 1 : 0 }); sfx.coin(4); saveProfileSoon(); } }
    if (b.dataset.craft) { const r = RECIPES[+b.dataset.craft]; for (const [k, n] of Object.entries(r.need)) invTake(k, n); invAdd(r.out, r.n); sfx.thud(camera, 0.5); }
    render(); };
}
function openMap(spotId) {
  const sp = SPOTS.find(s => s.id === spotId); if (!sp) { say('The ink has run. This map is useless.', 2); return; }
  const I = ISLES[sp.isl];
  const [c, g] = cnv(640, 480);
  const bg = g.createRadialGradient(320, 240, 60, 320, 240, 420); bg.addColorStop(0, '#ecd9ae'); bg.addColorStop(1, '#b8945a'); g.fillStyle = bg; g.fillRect(0, 0, 640, 480);
  for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(90,60,20,${Math.random() * 0.06})`; g.fillRect(Math.random() * 640, Math.random() * 480, 2, 2); }
  const sc = 170 / (I.R * 1.25), cx = 320, cy = 250;
  g.beginPath(); for (let a = 0; a <= TAU + 0.01; a += 0.05) { let r = 0; for (let t = I.R * 1.5; t > 0; t -= 4) if (isleRaw(I, I.x + Math.cos(a) * t, I.z + Math.sin(a) * t) > 0) { r = t; break; } const x = cx + Math.cos(a) * r * sc, y = cy + Math.sin(a) * r * sc; a ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath();
  g.fillStyle = 'rgba(120,130,80,0.35)'; g.fill(); g.strokeStyle = '#3b2814'; g.lineWidth = 2.5; g.stroke();
  // hills
  for (let k = 0; k < 40; k++) { const a = Math.random() * TAU, d = Math.random() * I.R * 0.7, x = I.x + Math.cos(a) * d, z = I.z + Math.sin(a) * d; if (isleRaw(I, x, z) > I.peak * 0.5) { const px = cx + (x - I.x) * sc, py = cy + (z - I.z) * sc; g.strokeStyle = 'rgba(59,40,20,0.6)'; g.beginPath(); g.moveTo(px - 8, py + 4); g.lineTo(px, py - 6); g.lineTo(px + 8, py + 4); g.stroke(); } }
  // landmarks: nearest rock or palms
  const lm = (I.landmarks || [])[0];
  let clue = '';
  if (lm) { const px = cx + (lm.x - I.x) * sc, py = cy + (lm.z - I.z) * sc; g.fillStyle = '#3b2814'; g.beginPath(); g.arc(px, py, 6, 0, TAU); g.fill(); const dx = sp.x - lm.x, dz = sp.z - lm.z, dist = Math.round(Math.hypot(dx, dz) / 0.75); const dir = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'][Math.round(((Math.atan2(dz, dx) + TAU) % TAU) / (TAU / 8)) % 8]; clue = `${dist} paces ${dir} of ${lm.n}`; g.setLineDash([4, 6]); g.strokeStyle = '#5a2a16'; g.beginPath(); g.moveTo(px, py); g.lineTo(cx + (sp.x - I.x) * sc, cy + (sp.z - I.z) * sc); g.stroke(); g.setLineDash([]); }
  const xx = cx + (sp.x - I.x) * sc, yy = cy + (sp.z - I.z) * sc; g.strokeStyle = '#8a1c10'; g.lineWidth = 5; g.beginPath(); g.moveTo(xx - 10, yy - 10); g.lineTo(xx + 10, yy + 10); g.moveTo(xx + 10, yy - 10); g.lineTo(xx - 10, yy + 10); g.stroke();
  g.save(); g.translate(560, 400); g.strokeStyle = '#3b2814'; g.lineWidth = 1.5; for (let i = 0; i < 8; i++) { g.rotate(Math.PI / 4); g.beginPath(); g.moveTo(0, 0); g.lineTo(i % 2 ? 18 : 34, 0); g.stroke(); } g.font = '16px Georgia'; g.fillStyle = '#3b2814'; g.fillText('N', -5, -38); g.restore();
  g.font = 'italic 30px "IM Fell English", Georgia, serif'; g.fillStyle = '#3b2814'; g.textAlign = 'center'; g.fillText(I.name, 320, 52);
  const tierTxt = ['', 'A modest cache', 'A rich hoard', 'The hoard of the Pale Lantern'][sp.tier];
  const p = playerOcean(), bearing = Math.round(((Math.atan2(I.x - p.x, -(I.z - p.z)) * 180 / Math.PI) + 360) % 360), dist = Math.round(Math.hypot(I.x - p.x, I.z - p.z));
  openNote(`<h2>${esc(tierTxt)}</h2><img alt="Treasure map of ${esc(I.name)}" src="${c.toDataURL()}"><p>${sp.under ? 'Beneath the water off the reef’s outer edge — you’ll need to dive.' : sp.cave ? 'Deep inside the sea cave. Bring a shovel — and a light heart.' : `Dig ${esc(clue || 'where the X lies')}.`}</p><p class="muted">${esc(I.name)} lies ${dist} m away, bearing ${bearing}°. Equip a shovel and hold the mouse button to dig.</p>`);
}

/* ================= LOOT TABLES ================= */
function lootRoll(kind, obj) {
  const w = obj.getWorldPosition(new THREE.Vector3()); const ox = w.x + org.x, oz = w.z + org.y;
  const r = Math.random; const gold = Math.round({ camp: 120, crate: 80, wreck: 450 }[kind] * (0.5 + r() * 1.5));
  oCreate({ k: 'gold', x: ox + rand(-0.8, 0.8), z: oz + rand(-0.8, 0.8), y: w.y, v: gold });
  const pool = { camp: ['rum', 'hardtack', 'shot', 'coins', 'map', 'dynamite'], crate: ['wood', 'rope', 'cloth', 'powder', 'plank', 'metal', 'hardtack', 'rum'], wreck: ['gem', 'jewel', 'map', 'map', 'ball', 'bomb', 'coins', 'idol'] }[kind];
  const n = kind === 'wreck' ? 3 : 2;
  for (let i = 0; i < n; i++) { const k = pool[(r() * pool.length) | 0]; const cnt = ['wood', 'rope', 'cloth', 'powder', 'plank', 'metal', 'shot', 'ball'].includes(k) ? 5 + ((r() * 15) | 0) : 1; oCreate({ k: 'item', it: k, n: cnt, d: k === 'map' ? { s: randomSpot(kind === 'wreck' ? 1 : 0) } : undefined, x: ox + rand(-1, 1), z: oz + rand(-1, 1), y: w.y }); }
  sfx.creak(0.2, null, 0.8); say({ camp: 'You rummage through the dead man’s things.', crate: 'You pry the lid off.', wreck: 'The chest’s hinges give way. Silver glints in the silt.' }[kind], 2);
}

/* ================= MY CREW ================= */
const ownCrew = [];
function spawnOwnCrew() {
  ownCrew.forEach(c => ship.remove(c.av.root)); ownCrew.length = 0;
  const n = Math.min(OWN.crewN || 0, 8); if (!OWN.has || OWN.row) return;
  for (let i = 0; i < n; i++) { const av = makeAvatar({ coat: ['#5a3a2a', '#2f3e4a', '#4a2a2a'][i % 3], hat: i % 2 }); const spot = [[2.6, -5.5], [-2.6, -5.5], [2.6, -2.5], [-2.6, -2.5], [0.8, -8.5], [-0.8, 4.5], [2.6, 1], [-2.6, 1]][i]; av.root.position.set(spot[0], DECK, spot[1]); av.root.rotation.y = spot[0] > 0 ? -Math.PI / 2 : Math.PI / 2; ship.add(av.root); ownCrew.push({ av, t: rand(0, 9), hp: 60, home: spot }); }
}
function updateOwnCrew(dt, t) {
  const boarders = [...PEERS.values()].filter(P => P.pp === 'p:' + NET.id && P.alive !== 0);
  for (const c of ownCrew) {
    c.t += dt; c.cd = Math.max(0, (c.cd || 0) - dt);
    let tgt = null;
    if (boarders.length) { let bd = 1e9; for (const P of boarders) { const d = Math.hypot(P.lx - c.av.root.position.x, P.lz - c.av.root.position.z); if (d < bd) { bd = d; tgt = P; } } }
    if (tgt) { const p = c.av.root.position, dx = tgt.lx - p.x, dz = tgt.lz - p.z, d = Math.hypot(dx, dz); if (d > 1.5) { p.x += dx / d * 2.3 * dt; p.z += dz / d * 2.3 * dt; c.av.root.rotation.y = Math.atan2(-dx, -dz); } else if (c.cd <= 0) { c.cd = 1.4; c.sw = 1; netSend({ t: 'phit', to: tgt.id, dmg: 10, k: 'crew' }); }
      setAvatarWeapon(c.av, 'cutlass'); }
    else { const p = c.av.root.position; p.x += (c.home[0] - p.x) * dt; p.z += (c.home[1] - p.z) * dt; setAvatarWeapon(c.av, ''); }
    c.sw = Math.max(0, (c.sw || 0) - dt * 2.5);
    animAvatar(c.av, { spd: tgt ? 2 : 0, t: c.t, swing: c.sw, idle: !tgt });
  }
}
