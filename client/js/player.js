// The Gilded Wake — the player: walk anywhere (any ship, docks, islands), swim and dive,
// first-person weapons (cutlass block/parry, pistols, muskets, blunderbusses), manning cannons,
// climbing to the crow's nest, digging, fishing, carrying chests, drinking and emotes.
const PL = { mode: 'helm', plat: OWN, l: new THREE.Vector3(0, QD, 12.35), o: new THREE.Vector2(), y: 0, vx: 0, vz: 0, vy: 0, yaw: 0, pitch: -0.05, hp: 100, alive: true, breath: 1, drunk: 0, eyeY: QD, bob: 0, bobAmt: 0, stepPh: 0,
  slot: 0, swing: 0, swingCd: 0, blocking: 0, blockT: 0, reload: 0, ads: 0, dig: 0, carry: null, sit: 0, emote: '', emoteT: 0, gun: -1, aimYaw: 0, aimEl: 0.1, nestT: 0, smokeT: 0, regenT: 0, lastHit: null, deadT: 0, cast: null, underwater: 0, onGround: 1, jump: 0 };
const EYE = 1.66;
const tmpW = new THREE.Vector3(), tmpL = new THREE.Vector3(), tmpQ2 = new THREE.Quaternion();
function platScale(p) { return p ? (p === JBENT || (p.v && p.v.row) || (p === OWN && OWN.row) ? 1 : (p.scale || 1)) : 1; }
function platBody(p) { return p === OWN ? ship : p.body; }
function platYaw(p) { return p === OWN ? heading : p === JBENT ? JB.h : p.h; }
function isRowPlat(p) { return p === JBENT || (p === OWN && OWN.row) || (p.v && p.v.row); }
function playerWorld(out = new THREE.Vector3()) {
  if (PL.plat) { out.copy(PL.l); out.y += 0.9 / platScale(PL.plat); return platBody(PL.plat).localToWorld(out); }
  return out.set(PL.o.x - org.x, PL.y + 0.9, PL.o.y - org.y);
}
function playerOcean() { const w = playerWorld(tmpW); return { x: w.x + org.x, z: w.z + org.y, y: w.y }; }
function deckFloor(p, x, z, y) { if (isRowPlat(p)) return 0.32; return floorAt(x, z, y); }
function deckBlocked(p, x, z, y) {
  if (isRowPlat(p)) return Math.abs(x) > 0.7 || Math.abs(z) > 2.3;
  if (p === OWN) return blocked(x, z, y);
  // other ships: same layout, without my door states
  const layer = y < 3.6 ? 'low' : 'high';
  if (z < -13.4 || z > 13.25 || Math.abs(x) > hw(z) * (z > QZ && layer === 'high' ? 0.95 : 0.962) - 0.38) return true;
  for (const c of COLL) { if (c.on || (c.layer !== 'all' && c.layer !== layer)) continue; if (c.t === 'c') { const dx = x - c.x, dz = z - c.z; if (dx * dx + dz * dz < (c.r + 0.3) ** 2) return true; } else if (x > c.x0 - 0.3 && x < c.x1 + 0.3 && z > c.z0 - 0.3 && z < c.z1 + 0.3) return true; }
  return false;
}
function shipsNear(x, z, r) { const out = []; if (OWN.has && !OWN.sk && Math.hypot(shipO.x - x, shipO.y - z) < r) out.push(OWN); for (const e of ENTS.values()) if (!e.sk && e.root.visible && Math.hypot(e.o.x - x, e.o.y - z) < r) out.push(e); if (JB.on && Math.hypot(JB.o.x - x, JB.o.y - z) < r) out.push(JBENT); return out; }
// try to land on any ship deck at a world point
function landOnShip(w, vy) {
  const ox = w.x + org.x, oz = w.z + org.y;
  for (const e of shipsNear(ox, oz, 45)) {
    const b = platBody(e); b.updateMatrixWorld(); tmpL.copy(w); b.worldToLocal(tmpL);
    const row = isRowPlat(e);
    const inside = row ? Math.abs(tmpL.x) < 0.8 && Math.abs(tmpL.z) < 2.4 : (tmpL.z > -13.6 && tmpL.z < 13.4 && Math.abs(tmpL.x) < hw(tmpL.z) * 0.96);
    if (!inside) continue;
    const f = deckFloor(e, tmpL.x, tmpL.z, tmpL.y);
    if (tmpL.y >= f - 0.4 && tmpL.y < f + 2.5 && vy <= 0.5) { PL.plat = e; PL.l.set(tmpL.x, f, tmpL.z); PL.eyeY = f; PL.yaw = PL.yaw - platYaw(e) + (PL.wyaw || 0); PL.wyaw = 0; PL.mode = 'walk'; return true; }
  }
  return false;
}
function leaveShip(vx, vz, vy) {
  const w = playerWorld(tmpW); const wy = platYaw(PL.plat);
  PL.o.set(w.x + org.x, w.z + org.y); PL.y = w.y - 0.9; PL.vx = vx; PL.vz = vz; PL.vy = vy; PL.yaw = PL.yaw + wy; PL.plat = null; PL.mode = 'walk';
}

/* ---- view model (first-person hands and weapon) ---- */
const VM = new THREE.Group(); camera.add(VM);
let vmKey = '', vmMesh = null;
const vmArm = new THREE.Mesh(box(0.1, 0.1, 0.5), coatMat('#7a2e1f')); vmArm.position.set(0.2, -0.24, -0.1); VM.add(vmArm);
function setViewModel(k) {
  if (k === vmKey) return; vmKey = k; if (vmMesh) VM.remove(vmMesh); vmMesh = k ? weaponMesh(k) : null;
  if (vmMesh) { vmMesh.scale.setScalar(0.5); VM.add(vmMesh); vmMesh.traverse(o => { if (o.material) { o.renderOrder = 30; } }); }
  PL.drawT = 0.3;
}
function updateViewModel(dt, t) {
  const fp = ['walk', 'swim', 'nest', 'row'].includes(PL.mode) && PL.alive && !menuOpen;
  VM.visible = fp && !PL.carry; if (!VM.visible) return;
  const it = ITEMS[curItem()] || {}; const isGun = it.cat === 'gun';
  PL.drawT = Math.max(0, (PL.drawT || 0) - dt);
  const bob = Math.sin(PL.bob * 2) * 0.012 * PL.bobAmt, sw = Math.cos(PL.bob) * 0.01 * PL.bobAmt;
  let x = 0.26 + sw, y = -0.3 + bob - PL.drawT * 1.2, z = -0.5, rx = 0, ry = 0, rz = 0;
  if (isGun) { rx = 0; if (PL.ads && it.ads) { x = 0.0; y = -0.11; z = -0.42; } else if (PL.ads) { x = 0.12; y = -0.2; } if (PL.reload > 0) { rx = -0.9 * Math.sin(Math.min(1, PL.reload / (it.rel || 1)) * Math.PI); y -= 0.1; } rx += (PL.kick || 0); }
  else if (it.cat === 'melee') { rx = -0.3; rz = -0.3; if (PL.swing > 0) { const s = 1 - PL.swing; rx = -1.5 + s * 2.4; ry = 0.9 - s * 1.8 * (PL.swingDir || 1); z = -0.55; } if (PL.blocking) { rx = 0.1; rz = -1.35; x = 0.08; y = -0.18; } }
  else if (curItem() === 'shovel') { rx = -0.5; if (PL.dig > 0) { rx = -0.5 - Math.abs(Math.sin(t * 6)) * 0.8; y -= 0.1; } }
  else if (curItem() === 'rod') { rx = -0.9 - (PL.cast && PL.cast.bite ? 0.2 * Math.sin(t * 30) : 0); }
  else { rx = -0.2; }
  PL.kick = Math.max(0, (PL.kick || 0) - dt * 2);
  vmMesh && (vmMesh.position.set(x, y, z), vmMesh.rotation.set(rx, ry, rz));
  vmArm.position.set(x + 0.02, y - 0.05, z + 0.22); vmArm.rotation.set(rx * 0.5, ry, 0);
}

/* ---- inventory helpers ---- */
function curItem() { const s = ME.inv[PL.slot]; return s ? s.k : ''; }
function invCount(k) { let n = 0; for (const s of ME.inv) if (s && s.k === k) n += s.n; return n; }
function invAdd(k, n = 1, d) {
  if (k === 'gold') { ME.gold += n; return true; }
  if (k !== 'map') for (const s of ME.inv) if (s && s.k === k) { s.n += n; invChanged(); return true; }
  const i = ME.inv.findIndex(s => !s); if (i < 0) { ME.inv.push({ k, n, d }); } else ME.inv[i] = { k, n, d };
  invChanged(); return true;
}
function invTake(k, n = 1) {
  if (invCount(k) < n) return false;
  for (let i = ME.inv.length - 1; i >= 0 && n > 0; i--) { const s = ME.inv[i]; if (s && s.k === k) { const t = Math.min(n, s.n); s.n -= t; n -= t; if (s.n <= 0) ME.inv[i] = null; } }
  invChanged(); return true;
}
function invWeight() { let w = ME.gold * 0.002; for (const s of ME.inv) if (s) w += (ITEMS[s.k] ? ITEMS[s.k].w || 0.1 : 0.1) * s.n; return w; }
let invDirty = 0; function invChanged() { invDirty = 1; saveProfileSoon(); }

/* ---- health ---- */
function hurtPlayer(dmg, by, kind, fromLocal) {
  if (!PL.alive || dmg <= 0) return;
  // blocking with a blade soaks most melee from the front; a fresh block parries
  if (PL.blocking && (kind === 'melee' || kind === 'crew')) {
    if (clock - PL.blockT < 0.28) { sfx.clash(camera); flashEl('#cross'); say('Parried!', 0.8); if (by && !by.startsWith('n:')) netSend({ t: 'parry', to: by }); return; }
    dmg *= 0.2; sfx.clash(camera);
  }
  PL.hp -= dmg; PL.regenT = 6; PL.lastHit = by; flashEl('#dmg'); shake = Math.max(shake, 0.4);
  if (PL.hp <= 0) playerDies(by);
}
function playerDies(by) {
  PL.alive = false; PL.hp = 0; PL.deadT = 0; PL.emote = '';
  const p = playerOcean();
  // drop what you carry: gold, treasure, half your ammunition
  const loot = { k: 'sack', x: p.x, z: p.z, y: p.y - 0.9, v: Math.round(ME.gold), items: [], owner: NET.id, name: ME.name };
  ME.gold = 0;
  ME.inv.forEach((s, i) => { if (!s) return; const it = ITEMS[s.k]; if (!it) return; if (['treasure', 'map', 'fish', 'food', 'drink', 'throw'].includes(it.cat)) { loot.items.push([s.k, s.n, s.d]); ME.inv[i] = null; } else if (['ammo', 'cannon'].includes(it.cat) && s.n > 1) { const h = Math.floor(s.n / 2); loot.items.push([s.k, h]); s.n -= h; } });
  if (loot.v > 0 || loot.items.length) netSend({ t: 'oc', o: loot });
  if (PL.carry) { dropCarry(); }
  invChanged();
  const who = by && (PEERS.get(by) || {}).name || (by && by.startsWith('n:') ? (ENTS.get(by) || {}).name : '');
  banner('You have fallen', who ? `Cut down by ${who}. Your purse lies where you fell.` : 'Your purse lies where you fell.');
  netSend({ t: 'pdie', by });
  if (by && PEERS.has(by)) feed(`${who} defeated you`, (PEERS.get(by) || {}).color);
}
function respawnPlayer() {
  PL.alive = true; PL.hp = 100; PL.breath = 1; PL.drunk = 0; hideBanner();
  const bed = typeof myBed === 'function' ? myBed() : null;
  if (OWN.has && !OWN.sk) { PL.plat = OWN; PL.l.set(0, DECK, 3); PL.eyeY = DECK; PL.mode = OWN.row ? 'helm' : 'walk'; }
  else if (bed) { PL.plat = null; PL.o.set(bed.x, bed.z); PL.y = groundAt(bed.x, bed.z, 99); PL.mode = 'walk'; }
  else { const I = ISLES[0]; const d = I.dockEnd || { x: I.tx, z: I.tz }; PL.plat = null; PL.o.set(d.x, d.z); PL.y = groundAt(d.x, d.z, 99); PL.mode = 'walk'; }
  say('You wake with a sore head and an empty purse.', 3);
}

/* ---- movement ---- */
function moveInput() {
  let f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0), s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  if (coarse) { f -= stick.y; s += stick.x; }
  const l = Math.hypot(f, s); if (l > 1) { f /= l; s /= l; }
  if (PL.drunk > 0.2) { s += Math.sin(clock * 1.3) * PL.drunk * 0.5; }
  return [f, s];
}
function updatePlayer(dt) {
  if (!PL.alive) { PL.deadT += dt; if (PL.deadT > 6) respawnPlayer(); return; }
  if (PL.hp < 100) { PL.regenT -= dt; if (PL.regenT <= 0) PL.hp = Math.min(100, PL.hp + dt * 2); }
  PL.drunk = Math.max(0, PL.drunk - dt * 0.008);
  if (PL.drunk > 1.05 && !PL.passed) { PL.passed = 1; banner('…', 'You pass out. The stars spin.'); setTimeout(() => { hideBanner(); PL.drunk = 0.6; PL.passed = 0; }, 4000); }
  if (PL.drunk > 0.3 && Math.random() < dt * 0.15 * PL.drunk) sfx.hic();
  if (['helm', 'cannon', 'nest', 'spy'].includes(PL.mode) || menuOpen || chatOpen || PL.passed || uiOpen()) { PL.bobAmt *= 0.9; if (PL.mode === 'nest') nestUpdate(dt); return; }
  if (PL.mode === 'row') { updateActions(dt); return; }
  const [f, s] = moveInput();
  const heavy = invWeight() > 60 ? 0.65 : 1;
  const run = (keys.ShiftLeft || keys.ShiftRight) && !PL.carry ? 1.75 : 1;
  const spd = 2.4 * run * heavy * (PL.carry ? 0.6 : 1) * (PL.blocking ? 0.5 : 1) * (PL.dig > 0 || PL.sit ? 0 : 1);
  const fx = -Math.sin(PL.yaw), fz = -Math.cos(PL.yaw), rx = Math.cos(PL.yaw), rz = -Math.sin(PL.yaw);
  if (PL.plat) {
    const sc = platScale(PL.plat);
    const wx = (fx * f + rx * s) * spd / sc, wz = (fz * f + rz * s) * spd / sc;
    const a = Math.min(1, dt * ((f || s) ? 8 : 10)); PL.vx += (wx - PL.vx) * a; PL.vz += (wz - PL.vz) * a;
    if (PL.plat === OWN) PL.vx += -body.r * 0.25 * dt;
    const L = PL.l, nx = L.x + PL.vx * dt, nz = L.z + PL.vz * dt;
    const can = (x, z) => { const fl = deckFloor(PL.plat, x, z, L.y); return fl - L.y <= 0.45 && !deckBlocked(PL.plat, x, z, Math.max(L.y, fl)); };
    let edge = false;
    if (can(nx, L.z)) L.x = nx; else { PL.vx *= 0.2; edge = Math.abs(nx) > 2; }
    if (can(L.x, nz)) L.z = nz; else { PL.vz *= 0.2; }
    const fl = deckFloor(PL.plat, L.x, L.z, L.y);
    if (fl >= L.y) { L.y = fl; PL.vy = 0; } else { PL.vy -= 9.8 * dt; L.y = Math.max(fl, L.y + PL.vy * dt); if (L.y === fl) PL.vy = 0; }
    // jumping: over the rail goes overboard (or onto a ship alongside)
    if (keys.Space && !PL.jumpHeld) {
      PL.jumpHeld = 1;
      if (edge || Math.abs(L.x) > hw(L.z) * 0.8 - 0.6 || isRowPlat(PL.plat)) {
        const side = Math.sign(L.x) || 1, dir = new THREE.Vector3(side, 0, 0).applyQuaternion(platBody(PL.plat).getWorldQuaternion(tmpQ2));
        L.x = side * (isRowPlat(PL.plat) ? 1.1 : hw(L.z) + 0.3); L.y += 1.0;
        leaveShip(dir.x * 3.5, dir.z * 3.5, 3.5); sfx.whoosh(camera); return;
      } else if (PL.vy === 0) PL.vy = 3.6;
    }
    if (!keys.Space) PL.jumpHeld = 0;
  } else {
    // free in the world: walking on land, on platforms or swimming
    const w = waveH(PL.o.x - org.x, PL.o.y - org.y, seaT);
    const g = groundAt(PL.o.x, PL.o.y, PL.y);
    const deep = g < w - 1.25 && PL.y < w - 0.3 + 0.6;
    const swimming = deep && PL.y <= w - 0.6;
    PL.mode = swimming ? 'swim' : 'walk';
    const sp2 = swimming ? 2.1 * heavy * run * 0.75 : spd;
    const wx = (fx * f + rx * s) * sp2, wz = (fz * f + rz * s) * sp2;
    const a = Math.min(1, dt * ((f || s) ? (swimming ? 3 : 8) : (swimming ? 2 : 10))); PL.vx += (wx - PL.vx) * a; PL.vz += (wz - PL.vz) * a;
    const nx = PL.o.x + PL.vx * dt, nz = PL.o.y + PL.vz * dt;
    const stepOk = (x, z) => { const gg = groundAt(x, z, PL.y); return (gg - PL.y <= 0.55 || swimming && gg < w - 0.9) && !blockedWorld(x, z, PL.y, 0.3); };
    if (stepOk(nx, PL.o.y)) PL.o.x = nx; else PL.vx *= 0.2;
    if (stepOk(PL.o.x, nz)) PL.o.y = nz; else PL.vz *= 0.2;
    const g2 = groundAt(PL.o.x, PL.o.y, PL.y);
    if (swimming) {
      const dive = keys.KeyC || keys.ControlLeft;
      const tgt = dive ? Math.max(g2 + 0.3, PL.y - 3) : w - 1.45;
      PL.vy += ((keys.Space ? 2.2 : 0) + (tgt - PL.y) * (dive ? 0.8 : 3) - PL.vy * 2.2) * dt;
      PL.y += PL.vy * dt; PL.y = Math.max(PL.y, g2 + 0.2);
      if ((f || s) && Math.random() < dt * 1.5 && PL.y > w - 2) sfx.stroke();
      if (keys.Space && PL.y > w - 1.9 && !PL.jumpHeld) { PL.jumpHeld = 1; }
    } else {
      PL.vy -= 9.8 * dt; PL.y += PL.vy * dt;
      if (PL.y <= g2) { if (PL.vy < -9) hurtPlayer((-PL.vy - 9) * 6, null, 'fall'); PL.y = g2; PL.vy = 0; if (keys.Space && !PL.jumpHeld) { PL.vy = 4.2; PL.jumpHeld = 1; } }
      if (PL.vy < 0) { const wp = new THREE.Vector3(PL.o.x - org.x, PL.y, PL.o.y - org.y); if (landOnShip(wp, PL.vy)) return; }
    }
    if (!keys.Space) PL.jumpHeld = 0;
    // breath
    const eyeW = PL.y + EYE;
    PL.underwater = eyeW < w - 0.1 ? 1 : 0;
    if (PL.underwater) { PL.breath = Math.max(0, PL.breath - dt / 35); if (PL.breath <= 0) hurtPlayer(12 * dt, null, 'drown'); }
    else PL.breath = Math.min(1, PL.breath + dt / 4);
  }
  const sp = Math.hypot(PL.vx, PL.vz) * (PL.plat ? platScale(PL.plat) : 1);
  PL.bobAmt += ((sp > 0.3 && PL.mode !== 'swim' ? 1 : 0) - PL.bobAmt) * Math.min(1, dt * 6); PL.bob += sp * dt * 2.4;
  const ph = Math.floor(PL.bob / Math.PI); if (ph !== PL.stepPh) { PL.stepPh = ph; if (sp > 0.6 && PL.mode === 'walk') sfx.step(); }
  if (PL.plat) PL.eyeY += (PL.l.y - PL.eyeY) * Math.min(1, dt * 12);
  updateActions(dt);
}
function onDeckOf() { return PL.plat && PL.plat !== JBENT ? PL.plat : null; }

/* ---- first-person pose ---- */
const qa2 = new THREE.Quaternion(), qb2 = new THREE.Quaternion(), qc2 = new THREE.Quaternion(), Yax = new THREE.Vector3(0, 1, 0), Xax = new THREE.Vector3(1, 0, 0), Zax = new THREE.Vector3(0, 0, 1);
function fpPose(pos, quat, t) {
  const bobOn = S.bob ? 1 : 0, by = Math.sin(PL.bob * 2) * 0.035 * PL.bobAmt * bobOn, bx = Math.cos(PL.bob) * 0.02 * PL.bobAmt * bobOn;
  const dr = PL.drunk;
  const yaw = PL.yaw + Math.sin(t * 0.7) * dr * 0.08, pitch = PL.pitch + Math.sin(t * 1.1) * dr * 0.05;
  if (PL.plat) {
    const sc = platScale(PL.plat), b = platBody(PL.plat);
    const eyeH = PL.mode === 'row' ? 1.0 : PL.sit ? 1.05 : EYE;
    pos.set(PL.l.x + Math.cos(PL.yaw) * bx / sc, PL.eyeY + (eyeH + by) / sc, PL.l.z - Math.sin(PL.yaw) * bx / sc); b.localToWorld(pos);
    qa2.setFromAxisAngle(Yax, platYaw(PL.plat)); b.getWorldQuaternion(qb2); qc2.setFromAxisAngle(Yax, platYaw(PL.plat)).invert(); qb2.premultiply(qc2);
    qb2.slerp(new THREE.Quaternion(), 0.3);
    quat.copy(qa2).multiply(qb2);
  } else {
    pos.set(PL.o.x - org.x, PL.y + (PL.mode === 'swim' ? 1.5 : EYE) + by, PL.o.y - org.y);
    quat.identity();
    if (PL.mode === 'swim') { const w = waveH(pos.x, pos.z, seaT); if (pos.y > w - 0.3 && pos.y < w + 0.6) pos.y = Math.max(pos.y, w + 0.18); }
  }
  qc2.setFromAxisAngle(Yax, yaw); quat.multiply(qc2); qc2.setFromAxisAngle(Xax, pitch); quat.multiply(qc2);
  if (dr > 0.05) { qc2.setFromAxisAngle(Zax, Math.sin(t * 0.9) * dr * 0.12); quat.multiply(qc2); }
  if (PL.mode === 'spy') { qc2.setFromAxisAngle(Xax, Math.sin(t * 1.3) * 0.003); quat.multiply(qc2); }
}

/* ---- actions with the held item ---- */
let lmbHeld = false, rmbHeld = false, lmbPress = false;
function updateActions(dt) {
  const k = curItem(), it = ITEMS[k] || {};
  PL.swingCd = Math.max(0, PL.swingCd - dt); PL.swing = Math.max(0, PL.swing - dt / (it.spd || 0.45));
  if (PL.reload > 0) { PL.reload -= dt; if (PL.reload <= 0) { PL.loaded = k; sfx.clink(camera); } }
  PL.blocking = it.cat === 'melee' && rmbHeld && PL.swing <= 0 ? 1 : 0; if (PL.blocking && !PL.wasBlock) PL.blockT = clock; PL.wasBlock = PL.blocking;
  PL.ads = it.cat === 'gun' && rmbHeld ? 1 : (k === 'spyglass' && rmbHeld ? 2 : 0);
  if (PL.carry) { if (lmbPress) { lmbPress = false; dropCarry(); } return; }
  if (PL.smokeT > 0) { PL.smokeT -= dt; if (Math.random() < dt * 1.5) { const w = playerWorld(tmpW); const d = new THREE.Vector3(); camera.getWorldDirection(d); emit({ x: w.x + d.x * 0.4, y: w.y + 0.75, z: w.z + d.z * 0.4, vx: d.x * 0.6, vy: 0.4, vz: d.z * 0.6, max: 3, s0: 0.15, s1: 1.2, a0: 0.3, kind: 1, g: 0.2, drag: 1 }); } }
  // melee
  if (it.cat === 'melee' && lmbPress && PL.swingCd <= 0 && !PL.blocking) {
    PL.swing = 1; PL.swingCd = it.spd + 0.12; PL.swingDir = -(PL.swingDir || 1); sfx.swing(); netAction('sw');
    setTimeout(() => meleeHit(k), it.spd * 450);
  }
  // guns
  if (it.cat === 'gun' && lmbPress) {
    if (PL.reload > 0) {} else if (PL.loaded !== k) { if (invTake('shot', 1)) { PL.reload = it.rel; sfx.ratchet(0); } else say('Out of shot. A gunsmith sells more.', 1.6); }
    else { fireHandGun(k); PL.loaded = null; setTimeout(() => { if (curItem() === k && invTake('shot', 1)) PL.reload = it.rel; }, 350); }
  }
  // tools and consumables
  if (k === 'shovel') { if (lmbHeld && PL.mode === 'walk' && !PL.plat) { if (PL.dig <= 0) { PL.dig = 0.001; } PL.dig += dt; if (Math.floor(PL.dig * 1.6) !== Math.floor((PL.dig - dt) * 1.6)) { sfx.dig(); const w = playerWorld(tmpW); for (let i = 0; i < 8; i++) emit({ x: w.x + rand(-0.4, 0.4) - Math.sin(PL.yaw), y: w.y - 0.8, z: w.z - Math.cos(PL.yaw) + rand(-0.4, 0.4), vx: rand(-1, 1), vy: rand(2, 4), vz: rand(-1, 1), max: 0.8, s0: 0.15, s1: 0.1, a0: 1, kind: 3, g: -9.8, drag: 0.3 }); } if (PL.dig > 3.2) { PL.dig = 0; finishDig(); } netAction('dg'); } else if (!lmbHeld) PL.dig = 0; else if (lmbPress) say(PL.plat ? 'You can’t dig through a deck.' : 'Find dry land to dig.', 1.5); }
  if (k === 'rod') fishingUpdate(dt);
  if (lmbPress) {
    if (it.cat === 'drink') { invTake(k, 1); PL.drunk += it.drunk; PL.hp = Math.min(100, PL.hp + it.heal); sfx.drink(); say(k === 'rum' ? (PL.drunk > 0.7 ? 'The deck has opinions about which way is up.' : 'Warm all the way down.') : 'A good, honest ale.', 2); netAction('dr'); }
    else if (it.cat === 'food' || it.cat === 'fish') { invTake(k, 1); PL.hp = Math.min(100, PL.hp + it.heal); sfx.drink(); say(`${it.n}: +${it.heal} health`, 1.4); }
    else if (k === 'cigar') { invTake(k, 1); PL.smokeT = 40; say('You light a cigar and watch the smoke drift aft.', 2); }
    else if (it.cat === 'throw') throwItem(k);
    else if (k === 'bucket') { if (OWN.fire && PL.plat === OWN) { OWN.fire = 0; sfx.splash(2); say('You douse the flames.', 1.6); for (let i = 0; i < 30; i++) { const w = playerWorld(tmpW); emit({ x: w.x, y: w.y + 0.5, z: w.z, vx: rand(-2, 2), vy: rand(1, 3), vz: rand(-2, 2), max: 1, s0: 0.2, s1: 0.4, a0: 0.8, kind: 0, g: -9.8, drag: 0.5 }); } } else say('Nothing burning nearby.', 1.2); }
    else if (k === 'map') { const s = ME.inv[PL.slot]; openMap(s && s.d && s.d.s); }
    else if (k === 'hammer') { buildClick(); }
  }
  if (k === 'hammer') buildPreview(dt); else hideBuildPreview();
  lmbPress = false;
}
function meleeHit(k) {
  const it = ITEMS[k]; if (!it || !PL.alive) return;
  const eye = camera.position.clone(), dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  let hit = false;
  for (const t of meleeTargets()) {
    const d = t.p.distanceTo(eye); if (d > it.rng + 0.6) continue;
    const to = t.p.clone().sub(eye).normalize(); if (to.dot(dir) < 0.6) continue;
    t.hit(it.dmg * (PL.drunk > 0.5 ? 1.3 : 1)); hit = true; sfx.thud(WP(t.p), 1.2); splinters(t.p, 4); break;
  }
  if (!hit && typeof meleeBase === 'function' && meleeBase(eye, dir, it)) hit = true;
  if (!hit) {} else shake = Math.max(shake, 0.2);
}
function meleeTargets() {
  const out = [];
  for (const P of PEERS.values()) if (P.alive !== 0 && P.av.root.visible) { const p = P.av.root.getWorldPosition(new THREE.Vector3()); p.y += 1.1; out.push({ p, hit: d => { netSend({ t: 'phit', to: P.id, dmg: Math.round(d), k: 'melee' }); flashEl('#hitm'); } }); }
  for (const e of ENTS.values()) if (e.kind === 'npc' && e.crewAv) e.crewAv.forEach((av, i) => { if (!av.root.visible) return; const p = av.root.getWorldPosition(new THREE.Vector3()); p.y += 1.1; out.push({ p, hit: d => { hitCrew(e, i, d); flashEl('#hitm'); } }); });
  for (const sh of SHARKS) if (sh.hp > 0) { const p = sh.m.position.clone(); out.push({ p, hit: d => { sh.hp -= d; sh.flee = 3; flashEl('#hitm'); if (sh.hp <= 0) killShark(sh); } }); }
  return out;
}
function hitCrew(e, i, d) { const id = e.id.slice(2); if (NET.isHost || !NET.on) { const n = NPCS.get(id); if (n && n.crew[i]) { n.crew[i].hp -= d; if (n.crew[i].hp <= 0) crewDown(n, i); } } else netSend({ t: 'chit', n: id, c: i, dmg: Math.round(d) }); }
function crewDown(n, i) { const e = ENTS.get('n:' + n.id); if (e && e.crewAv[i]) { const w = e.crewAv[i].root.getWorldPosition(new THREE.Vector3()); splinters(w, 6); } if (n.crew.filter(c => c.hp > 0).length === 0) n.surrender = 1; }
function fireHandGun(k) {
  const it = ITEMS[k]; const eye = camera.position.clone(), dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  sfx.gun(camera, k); PL.kick = it.kick * 6; PL.pitch += it.kick * (PL.ads ? 0.4 : 1); netAction('sh');
  const mz = eye.clone().addScaledVector(dir, 0.8); mz.y -= 0.15;
  for (let i = 0; i < 14; i++) emit({ x: mz.x, y: mz.y, z: mz.z, vx: dir.x * rand(1, 5) + rand(-0.5, 0.5), vy: rand(0, 1), vz: dir.z * rand(1, 5) + rand(-0.5, 0.5), max: rand(1.5, 3), s0: 0.2, s1: 1.6, a0: 0.4, kind: 1, g: 0.2, drag: 1.5 });
  for (let i = 0; i < 5; i++) emit({ x: mz.x, y: mz.y, z: mz.z, vx: dir.x * rand(6, 12), vy: rand(-0.5, 0.5), vz: dir.z * rand(6, 12), max: 0.08, s0: 0.25, s1: 0.1, a0: 1, kind: 2, g: 0, drag: 2 });
  const targets = meleeTargets();
  for (let p = 0; p < it.pel; p++) {
    const sp = it.spread * (PL.ads ? 0.4 : 1) * (1 + PL.drunk);
    const d = dir.clone().add(new THREE.Vector3(rand(-sp, sp), rand(-sp, sp), rand(-sp, sp))).normalize();
    let best = null, bt = it.rng;
    for (const t of targets) { const v = t.p.clone().sub(eye); const tt = v.dot(d); if (tt < 0 || tt > bt) continue; const off = v.clone().addScaledVector(d, -tt).length(); if (off < 0.55) { bt = tt; best = t; } }
    if (best) { const fall = 1 - Math.max(0, bt - it.rng * 0.5) / it.rng; best.hit(it.dmg * fall); splinters(best.p, 3); }
    if (typeof shootKegs === 'function') shootKegs(eye, d, it.rng);
  }
}
function throwItem(k) {
  if (!invTake(k, 1)) return;
  const eye = camera.position.clone(), dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  const v = dir.clone().multiplyScalar(k === 'flare' ? 4 : 13).add(new THREE.Vector3(0, k === 'flare' ? 30 : 4, 0));
  const m = new THREE.Mesh(k === 'keg' ? cyl(0.25, 0.28, 0.5, 10) : cyl(0.03, 0.03, 0.25, 6), k === 'keg' ? MAT.med : MAT.red); m.position.copy(eye).addScaledVector(dir, 0.6); scene.add(m);
  THROWN.push({ k, m, v, t: 0 }); sfx.whoosh(camera);
  if (k === 'dynamite') say('Fuse lit — three seconds!', 1.5);
}
const THROWN = [];
function updateThrown(dt) {
  for (let i = THROWN.length - 1; i >= 0; i--) {
    const T = THROWN[i]; T.t += dt; T.v.y -= (T.k === 'flare' ? 3 : 9.8) * dt; T.m.position.addScaledVector(T.v, dt); T.m.position.x -= dOrg.x; T.m.position.z -= dOrg.y; T.m.rotation.x += dt * 6;
    const p = T.m.position, ox = p.x + org.x, oz = p.z + org.y;
    if (T.k === 'dynamite' && Math.random() < 0.7) emit({ x: p.x, y: p.y, z: p.z, vx: rand(-1, 1), vy: rand(0, 2), vz: rand(-1, 1), max: 0.2, s0: 0.3, s1: 0.1, a0: 1, kind: 2, g: 0, drag: 1 });
    if (T.k === 'flare') { emit({ x: p.x, y: p.y, z: p.z, vx: 0, vy: -1, vz: 0, max: 0.6, s0: 1, s1: 0.2, a0: 1, kind: 4, g: 0, drag: 1 }); if (T.t > 2.4) { scene.remove(T.m); THROWN.splice(i, 1); const msg = { t: 'flare', x: ox, z: oz, y: p.y }; netSend(msg); flareBurst(msg, ME.name, NET.color); } continue; }
    const g = Math.max(groundAt(ox, oz, p.y), waveH(p.x, p.z, seaT));
    if (T.k === 'dynamite' && T.t > 3) { scene.remove(T.m); THROWN.splice(i, 1); const msg = { t: 'boom', x: ox, y: p.y, z: oz, r: 7, pw: 1.1 }; netSend(msg); onBoom(msg); continue; }
    if (p.y <= g) {
      if (T.k === 'keg') { scene.remove(T.m); THROWN.splice(i, 1); const o = { k: 'keg', x: ox, z: oz, y: g, float: terrainH(ox, oz) < waveH(p.x, p.z, seaT) - 0.5 ? 1 : 0 }; netSend({ t: 'oc', o });; sfx.splash(5); continue; }
      T.v.set(T.v.x * 0.3, Math.abs(T.v.y) * 0.25, T.v.z * 0.3); p.y = g + 0.05;
    }
  }
}
function onBoom(m) { const w = new THREE.Vector3(m.x - org.x, m.y, m.z - org.y); explosion(w, m.pw || 1); applyBlast(m.x, m.y, m.z, m.r || 8, m.pw || 1, m.id); for (let i = 0; i < 20; i++) emit({ x: w.x, y: Math.max(w.y, 0), z: w.z, vx: rand(-2, 2), vy: rand(6, 16), vz: rand(-2, 2), max: 2, s0: 1, s1: 3, a0: 0.8, kind: 0, g: -9.8, drag: 0.6, sea: true }); }
const FLARES = [];
function flareBurst(m, who, color) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(color || '#ff5030'), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); s.scale.setScalar(30); WORLD.add(s); s.position.set(m.x, Math.max(80, m.y || 80), m.z);
  FLARES.push({ s, t: 12 }); sfx.boom(WP(new THREE.Vector3(m.x - org.x, 80, m.z - org.y)), 0.3);
  if (who) feed(`${who} fired a signal flare`, color);
}
function updateFlares(dt) { for (let i = FLARES.length - 1; i >= 0; i--) { const f = FLARES[i]; f.t -= dt; f.s.position.y -= dt * 3; f.s.material.opacity = Math.min(1, f.t / 3) * (0.8 + 0.2 * Math.sin(clock * 20)); const d = Math.hypot(f.s.position.x - org.x, f.s.position.z - org.y); f.s.scale.setScalar(Math.max(30, d * 0.04)); if (f.t <= 0) { WORLD.remove(f.s); FLARES.splice(i, 1); } } }

/* ---- digging for treasure ---- */
function finishDig() {
  const p = playerOcean();
  const spot = SPOTS.find(s => !s.under && Math.hypot(s.x - p.x, s.z - p.z) < 3.5);
  if (!spot) { say(['Nothing but sand and a very surprised crab.', 'Just dirt. X must mark another spot.', 'Wet sand and disappointment.'][(Math.random() * 3) | 0], 2); return; }
  if (OBJS.has('dug:' + spot.id) && Date.now() - (OBJS.get('dug:' + spot.id).at || 0) < 1800000) { say('Someone has already dug here — the hole is fresh.', 2.5); return; }
  revealTreasure(spot, p.x - Math.sin(PL.yaw + platYawW()) * 1.5, p.z - Math.cos(PL.yaw + platYawW()) * 1.5);
}
function platYawW() { return PL.plat ? platYaw(PL.plat) : 0; }
function revealTreasure(spot, x, z) {
  if (OBJS.has('dug:' + spot.id)) netSend({ t: 'od', id: 'dug:' + spot.id });
  netSend({ t: 'oc', o: { id: 'dug:' + spot.id, k: 'dug' } });
  const tier = spot.tier;
  const items = [];
  const r = Math.random;
  if (tier >= 1) { items.push(['coins', 1 + ((r() * 3) | 0)]); if (r() < 0.6) items.push(['gem', 1 + ((r() * 2) | 0)]); }
  if (tier >= 2) { items.push(['jewel', 1 + ((r() * 2) | 0)]); if (r() < 0.5) items.push(['idol', 1]); }
  if (tier >= 3) { items.push(['relic', 1], ['idol', 1]); }
  if (r() < 0.35) items.push(['map', 1, { s: randomSpot(tier >= 2 ? 2 : 0) }]);
  const gold = Math.round([0, 900, 2600, 9000][tier] * (0.7 + r() * 0.6));
  const o = { k: 'tchest', x, z, y: groundAt(x, z, 99), v: gold, items, tier };
  netSend({ t: 'oc', o });;
  sfx.coins(camera); sfx.thud(camera, 1.5);
  banner(['', 'A buried chest!', 'A treasure hoard!', 'The legendary hoard!'][tier], tier >= 3 ? 'The skull rock’s secret is yours — if you can carry it home.' : 'Press E to break it open, or G to carry it to your ship.');
  setTimeout(hideBanner, 3500);
  ME.infamy = (ME.infamy || 0) + tier;
  // remove the map you used
  const mi = ME.inv.findIndex(s => s && s.k === 'map' && s.d && s.d.s === spot.id); if (mi >= 0) { ME.inv[mi] = null; invChanged(); }
}

/* ---- fishing ---- */
const bobber = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshStandardMaterial({ color: 0xd8342a })); bobber.visible = false; WORLD.add(bobber);
const lineGeo = new THREE.BufferGeometry(); const fishLine = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.6 })); fishLine.frustumCulled = false; scene.add(fishLine); fishLine.visible = false;
const FISH = [['f_sardine', 40], ['f_mackerel', 28], ['f_snapper', 16], ['f_tuna', 9], ['f_sword', 5], ['f_gold', 1.2]];
function fishingUpdate(dt) {
  const C = PL.cast;
  if (!C) { bobber.visible = fishLine.visible = false;
    if (lmbPress) {
      const eye = camera.position.clone(), dir = new THREE.Vector3(); camera.getWorldDirection(dir); dir.y = 0; dir.normalize();
      const tx = eye.x + dir.x * 14, tz = eye.z + dir.z * 14;
      if (terrainH(tx + org.x, tz + org.y) > -1) { say('Cast over open water.', 1.4); return; }
      PL.cast = { x: tx + org.x, z: tz + org.y, t: rand(3, 10), bite: 0, k: 0 }; sfx.whoosh(camera); setTimeout(() => sfx.splash(14), 500);
    }
    return; }
  bobber.visible = fishLine.visible = true;
  const w = waveH(C.x - org.x, C.z - org.y, seaT);
  C.t -= dt;
  if (C.t <= 0 && !C.bite) { C.bite = 1.2; sfx.splash(8); say('A bite!', 0.8); for (let i = 0; i < 10; i++) emit({ x: C.x - org.x, y: w, z: C.z - org.y, vx: rand(-1, 1), vy: rand(1, 3), vz: rand(-1, 1), max: 0.6, s0: 0.15, s1: 0.3, a0: 0.8, kind: 0, g: -9.8, drag: 0.5, sea: true }); }
  if (C.bite) { C.bite -= dt; if (C.bite <= 0) { C.bite = 0; C.t = rand(4, 10); say('It got away.', 1); } }
  bobber.position.set(C.x, w - (C.bite ? 0.25 + Math.sin(clock * 30) * 0.08 : 0), C.z);
  const tip = camera.position.clone().add(new THREE.Vector3(0.3, -0.1, -0.8).applyQuaternion(camera.quaternion));
  lineGeo.setFromPoints([tip, new THREE.Vector3(C.x - org.x, bobber.position.y, C.z - org.y)]);
  if (lmbPress) {
    if (C.bite) {
      let tot = 0; const night = ENV.night > 0.5; FISH.forEach(f => tot += f[1] * (f[0] === 'f_gold' && night ? 3 : 1));
      let r = Math.random() * tot, pick = 'f_sardine'; for (const f of FISH) { r -= f[1] * (f[0] === 'f_gold' && night ? 3 : 1); if (r <= 0) { pick = f[0]; break; } }
      invAdd(pick, 1); sfx.splash(4); say(`You land a ${ITEMS[pick].n.toLowerCase()}!`, 2); netAction('fi');
    } else say('You reel in an empty hook.', 1);
    PL.cast = null;
  }
  if (Math.hypot(C.x - org.x - camera.position.x, C.z - org.y - camera.position.z) > 30) PL.cast = null;
}
function cookable() { return ME.inv.some(s => s && ITEMS[s.k] && ITEMS[s.k].cook); }
function cookAll() {
  let n = 0; ME.inv.forEach((s, i) => { if (s && ITEMS[s.k] && ITEMS[s.k].cook) { const c = ITEMS[s.k].cook; n += s.n; const cnt = s.n; ME.inv[i] = null; invAdd(c, cnt); } });
  if (n) { say(`You cook ${n} fish over the coals. It smells wonderful.`, 2.5); sfx.whoosh(camera); invChanged(); }
  else { PL.sit = 1; netAction('si'); say('You sit by the fire a while.', 2); }
}

/* ---- carrying chests ---- */
function dropCarry() {
  const c = PL.carry; if (!c) return; PL.carry = null;
  const p = playerOcean(); const o = Object.assign({}, c, { x: p.x - Math.sin(PL.yaw + platYawW()) * 1.2, z: p.z - Math.cos(PL.yaw + platYawW()) * 1.2, y: p.y - 0.9 });
  delete o.id; if (PL.plat) { o.ship = PL.plat === OWN ? 'p:' + NET.id : PL.plat.id; o.lx = PL.l.x; o.lz = PL.l.z - 1; }
  netSend({ t: 'oc', o });;
  carryMesh.visible = false;
}
const carryMesh = new THREE.Mesh(box(0.9, 0.55, 0.55), MAT.med); carryMesh.visible = false; camera.add(carryMesh); carryMesh.position.set(0, -0.55, -0.75);

/* ---- crow's nest ---- */
function climbNest() {
  if (!OWN.has || OWN.row) return;
  PL.mode = 'nest'; PL.nestT = 0; PL.nestFrom = PL.l.clone(); PL.plat = OWN; sfx.creak(0.3, null, 2);
  say('You climb the ratlines to the main top. Right-click for the spyglass. E to climb down.', 3);
}
const NEST_Y = 11.9 + 1.25;
function nestUpdate(dt) {
  PL.nestT = Math.min(1, PL.nestT + dt / 2.6);
  const e = PL.nestT < 1 ? (1 - Math.cos(PL.nestT * Math.PI)) / 2 : 1;
  PL.l.set(lerp(PL.nestFrom.x, 0.6, e), lerp(PL.nestFrom.y, NEST_Y, e), lerp(PL.nestFrom.z, 0.2, e)); PL.eyeY = PL.l.y;
  if (PL.nestT < 1 && Math.random() < dt * 3) sfx.creak(0.06, null, 0.3);
}
function leaveNest() { PL.mode = 'walk'; PL.l.set(1.2, DECK, 0.9); PL.eyeY = DECK; }

/* ---- manning a cannon ---- */
function manCannon(ent, cidx) {
  // cidx is a real cannon index on the Saltwren model; find its gun slot
  const gi = (ent === OWN ? OWN.guns : ent.guns || []).findIndex(g => g.real === cidx);
  if (gi < 0) { say('That gun isn’t mounted on this ship.', 1.5); return; }
  PL.mode = 'cannon'; PL.gun = gi; PL.gunEnt = ent; PL.aimYaw = 0; PL.aimEl = 0.08;
  say('Mouse to aim · click to fire · 1–4 ammunition · E to step away', 3);
}
function cannonPose(pos, quat) {
  const ent = PL.gunEnt, G = ent.guns[PL.gun], b = platBody(ent);
  const back = 2.2, sg = G.sg;
  pos.set(G.x - sg * back, G.y + 1.25, G.z); b.localToWorld(pos);
  const yaw = platYaw(ent) + (sg > 0 ? -Math.PI / 2 : Math.PI / 2) + PL.aimYaw;
  qa2.setFromAxisAngle(Yax, yaw); qc2.setFromAxisAngle(Xax, PL.aimEl * 0.8 - 0.05); quat.copy(qa2).multiply(qc2);
  const C = cannons[G.real]; if (ent === OWN && C) { C.bar.rotation.z = PL.aimEl; C.grp.rotation.y = (sg > 0 ? 0 : Math.PI) + PL.aimYaw * (sg > 0 ? 1 : 1); }
}
function cannonFire() {
  const ent = PL.gunEnt, gi = PL.gun; const rd = ent === OWN ? OWN.gready : (ent.gready = ent.gready || []);
  if ((rd[gi] || 0) > 0) { say('Still swabbing and loading…', 0.8); return; }
  if (!invTake(curAmmo, 1)) { say(`No ${ITEMS[curAmmo].n.toLowerCase()} left. Buy more from a chandler.`, 2); return; }
  rd[gi] = RELOAD * (1 - Math.min(0.45, (OWN.crewN || 0) * 0.07));
  const sd = (Math.random() * 1e5) | 0;
  fireGunsOf(ent, [gi], PL.aimEl, curAmmo, 'me', sd, PL.aimYaw);
  netSend({ t: 'fire', e: ent === OWN ? 'own' : ent.id, g: [gi], el: +PL.aimEl.toFixed(3), sd, am: curAmmo, ay: +PL.aimYaw.toFixed(3) });
}

/* ---- emotes ---- */
function emote(k) {
  if (k === 'sit') { PL.sit = PL.sit ? 0 : 1; if (PL.sit && !PL.plat) { const p = playerOcean(); const s = SEATS.find(s => Math.hypot(s.x - p.x, s.z - p.z) < 2.5); if (s) { PL.o.set(s.x, s.z); PL.y = s.y - 0.45; } } }
  else { PL.emote = PL.emote === k ? '' : k; PL.emoteT = 6; }
  netAction(k);
}
let netActT = 0, netActK = '';
function netAction(k) { netActK = k; netActT = 0.6; }
