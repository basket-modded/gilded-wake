// The Gilded Wake — UI, input, networking, other players, the main loop and boot.
if (S.timeMode == null) S.timeMode = 'cycle';
if (S.weather == null) S.weather = 'on';

/* ================= UI ================= */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let subT = 0;
function say(t, d = 4) { const e = $('#sub'); e.textContent = t; e.classList.add('on'); subT = d; }
function feed(text, color) { const f = $('#feed'); const d = document.createElement('div'); d.textContent = text; if (color) d.style.borderLeftColor = color; f.prepend(d); while (f.children.length > 6) f.lastChild.remove(); setTimeout(() => d.classList.add('out'), 7000); setTimeout(() => d.remove(), 8200); }
let noteOpen = false;
function openNote(html) { $('#paper').innerHTML = html + '<span class="close">Press E, Esc or click to set it down</span>'; $('#note').classList.add('on'); noteOpen = true; if (document.pointerLockElement) document.exitPointerLock(); }
function closeNote() { $('#note').classList.remove('on'); noteOpen = false; if (state === 'play' && !coarse && !dragLook) requestLock(); }
$('#note').addEventListener('click', () => closeNote());
const promptEl = $('#prompt'), crossEl = $('#cross');
{ const tp = $('#ctape'); const lab = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' }; let h = ''; for (let k = -2; k < 3; k++) for (let d = 0; d < 360; d += 15) h += `<span>${lab[d] || '·'}</span>`; tp.innerHTML = h; }
function banner(t, sub) { $('#banner h3').textContent = t; $('#banner p').textContent = sub || ''; $('#banner').classList.add('on'); }
function hideBanner() { $('#banner').classList.remove('on'); }
function flashEl(id) { const d = $(id); if (!d) return; d.classList.remove('on'); void d.offsetWidth; d.classList.add('on'); }
const NAMES = ['Captain Wren', 'Salt Annie', 'Old Marlowe', 'Cap’n Brine', 'Mad Moll', 'Black Tom', 'Red Ned', 'Gull Kate', 'Quiet Jem', 'Iron Bess'];
if (!ME.name) { try { ME.name = localStorage.getItem('gw.name') || ''; } catch (e) {} }
if (!ME.name) ME.name = NAMES[(Math.random() * NAMES.length) | 0];
$('#name').value = ME.name;

/* ================= STATE ================= */
let state = 'title', introT = 0;
const CAM = { yaw: 0.55, pitch: 0.3, dist: 40, hs: 0 };
let zoomHeld = false, clock = 0, seaT = (Date.now() / 1000) % 1800, frame = 0, shake = 0;
const keys = {};
let hovered = null, menuOpen = false, dragLook = false, locked = false, everLocked = false, lockAt = 0, chatOpen = false;
let blendT = 1; const blendFrom = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
const MODES = ['helm', 'walk', 'swim', 'spy', 'cannon', 'nest', 'row'];
document.body.classList.add('captain');

function setMode(m) {
  if (m === 'captain') m = 'helm';
  if (m === PL.mode) return;
  if (m === 'helm' && (!OWN.has || PL.plat !== OWN || OWN.sk)) return;
  blendFrom.p.copy(camera.position); blendFrom.q.copy(camera.quaternion); blendT = 0;
  if (PL.mode === 'spy') { spyMesh.visible = true; $('#spy').classList.remove('on'); }
  if (m === 'walk' && PL.mode === 'helm') { if (OWN.row) PL.l.set(0, -0.05, 1.2); else PL.l.set(0, QD, 12.35); PL.eyeY = PL.l.y; PL.yaw = 0; PL.pitch = -0.05; PL.vx = PL.vz = 0; }
  if (m === 'helm') { sfx.creak(0.14, helm.grp, 0.5); if (OWN.row) PL.l.set(0, -0.05, 1.2); else PL.l.set(0, QD, 12.35); PL.eyeY = PL.l.y; CAM.hs = heading; }
  PL.mode = m;
  document.body.classList.toggle('captain', m === 'helm');
  $('#compass').classList.toggle('on', m === 'helm' || m === 'nest');
  if (m === 'walk' && !OWN.row) say('You step away from the wheel. Press F to take the helm again.', 2.5);
}
function enterSpy() { PL.mode = 'spy'; spyMesh.visible = false; $('#spy').classList.add('on'); sfx.spy(); }
function exitSpy() { PL.mode = 'walk'; spyMesh.visible = true; $('#spy').classList.remove('on'); sfx.spy(); }
function setSail(l, quiet) {
  if (OWN.row) return;
  l = clamp(l, 0, 2); if (l === sailLvl) return; sailLvl = l;
  if (!quiet) { sfx.sails(); say(['Sails furled. She slows to a drift.', 'Half sail.', 'Full sail — she leans into the wind.'][l], 2.2); }
}
function leaveCannon() { const G = PL.gunEnt && PL.gunEnt.guns[PL.gun]; PL.mode = 'walk'; if (G) { PL.l.set(G.x - G.sg * 1.6, DECK, G.z); PL.eyeY = DECK; PL.yaw = G.sg > 0 ? -Math.PI / 2 : Math.PI / 2; PL.pitch = 0; } }
function interact() {
  if (noteOpen) { closeNote(); return; }
  if (uiOpen()) { closeUI(); return; }
  if (PL.mode === 'spy') { exitSpy(); return; }
  if (PL.mode === 'helm') { setMode('walk'); return; }
  if (PL.mode === 'cannon') { leaveCannon(); return; }
  if (PL.mode === 'nest') { leaveNest(); return; }
  if (PL.sit) { PL.sit = 0; return; }
  if (hovered) { if (hovered.hold) { holdT = 0.001; return; } hovered.act(); flashEl('#cross'); }
}
let holdT = 0;

/* deck walking collision (my ship, with door states) */
function floorAt(x, z, cy) {
  if (z >= QZ) return cy < 3.6 ? DECK : QD;
  const ax = Math.abs(x); if (ax >= 2.35 && z >= 3.0) return DECK + (z - 3.0) / 3.0 * (QD - DECK);
  return DECK;
}
function blocked(x, z, y) {
  const layer = y < 3.6 ? 'low' : 'high';
  if (z < -13.4 || z > 13.25) return true;
  if (Math.abs(x) > hw(z) * (z > QZ && layer === 'high' ? 0.95 : 0.962) - 0.38) return true;
  const r = 0.3;
  for (const c of COLL) {
    if (c.layer !== 'all' && c.layer !== layer) continue;
    if (c.on && !c.on()) continue;
    if (c.t === 'c') { const dx = x - c.x, dz = z - c.z; if (dx * dx + dz * dz < (c.r + r) * (c.r + r)) return true; }
    else if (x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r) return true;
  }
  return false;
}

/* ================= INPUT ================= */
const fpMode = () => ['walk', 'swim', 'row', 'nest'].includes(PL.mode);
addEventListener('keydown', e => {
  if (chatOpen) { if (e.code === 'Enter') { e.preventDefault(); sendChat(); } else if (e.code === 'Escape') closeChat(); return; }
  if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT')) { if (e.code === 'Enter' && document.activeElement === $('#name')) $('#board').click(); if (e.code === 'Escape') document.activeElement.blur(); return; }
  if (e.code === 'Tab') { e.preventDefault(); $('#roster').classList.add('big'); }
  if (e.repeat) return;
  keys[e.code] = true;
  if (state !== 'play') { if (e.code === 'Escape' && uiOpen()) closeUI(); return; }
  if (e.code === 'Escape') { if (noteOpen) { closeNote(); return; } if (uiOpen()) { closeUI(); return; } if (menuOpen) closeMenu(false); else if (!locked) openMenu(); return; }
  if (menuOpen) return;
  if (e.code === 'KeyT' || e.code === 'Enter') { e.preventDefault(); openChat(); return; }
  if (e.code === 'KeyH') document.body.classList.toggle('nohud');
  if (e.code === 'KeyI') { if (uiKind === 'inv') closeUI(); else if (!uiOpen()) openInventory(); return; }
  if (uiOpen() || noteOpen) { if (e.code === 'KeyE') interact(); return; }
  if (!PL.alive) return;
  const num = /^Digit([1-8])$/.exec(e.code);
  if (e.code === 'KeyF') { if (PL.mode === 'helm') setMode('walk'); else if (PL.plat === OWN && OWN.has && !OWN.sk) { if (PL.mode === 'spy') exitSpy(); if (PL.mode === 'cannon') leaveCannon(); if (PL.mode === 'nest') leaveNest(); setMode('helm'); } return; }
  if (PL.mode === 'helm' || PL.mode === 'cannon') {
    if (num && +num[1] <= 4) { curAmmo = ['ball', 'chain', 'grape', 'bomb'][+num[1] - 1]; say(`${ITEMS[curAmmo].n} loaded · ${invCount(curAmmo)} in the hold`, 1.6); return; }
  }
  if (PL.mode === 'helm') {
    if (OWN.sk) return;
    if (!OWN.row) {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') setSail(sailLvl + 1);
      if (e.code === 'KeyS' || e.code === 'ArrowDown') setSail(sailLvl - 1);
      if (e.code === 'Space') { e.preventDefault(); fireBroadside(aimSide()); }
      if (e.code === 'KeyQ') fireBroadside(-1);
      if (e.code === 'KeyE') fireBroadside(1);
      if (e.code === 'KeyR') toggleAnchor();
      if (e.code === 'KeyG') { if (GRAP.on) { cutGrapple(); say('You cut the grappling lines.', 1.6); } else throwGrapple(); }
      if (e.code === 'KeyB') { lowerJollyBoat(); }
    } else if (e.code === 'KeyE') setMode('walk');
    return;
  }
  if (PL.mode === 'cannon') { if (e.code === 'KeyE') leaveCannon(); if (e.code === 'Space') { e.preventDefault(); cannonFire(); } return; }
  if (num) { PL.slot = +num[1] - 1; PL.cast = null; invDirty = 1; return; }
  if (e.code === 'KeyE') interact();
  if (e.code === 'KeyG' && hovered && hovered.alt) hovered.alt();
  if (e.code === 'KeyR' && curItem() === 'hammer') buildRot = (buildRot + 1) % 4;
  if (e.code === 'KeyU' && curItem() === 'hammer') upgradePiece();
  if (e.code === 'KeyB' && PL.plat === OWN) lowerJollyBoat();
  if (e.code === 'KeyZ') emote('sit');
  if (e.code === 'KeyV') emote('wave');
  if (e.code === 'KeyN') emote('dance');
  if (e.code === 'KeyQ') { const s = ME.inv[PL.slot]; if (s && fpMode()) { ME.inv[PL.slot] = null; const p = playerOcean(); oCreate({ k: 'item', it: s.k, n: s.n, d: s.d, x: p.x - Math.sin(PL.yaw + platYawW()), z: p.z - Math.cos(PL.yaw + platYawW()), y: PL.plat ? undefined : PL.mode === 'swim' ? undefined : p.y - 0.9, float: PL.mode === 'swim' ? 1 : 0, ship: PL.plat && PL.plat !== JBENT ? (PL.plat === OWN ? 'p:' + NET.id : PL.plat.id) : undefined, lx: PL.l.x, lz: PL.l.z - 0.8 }); invChanged(); say(`Dropped ${ITEMS[s.k].n.toLowerCase()}.`, 1); } }
});
addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'Tab') $('#roster').classList.remove('big'); if (e.code === 'KeyE') holdT = 0; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; lmbHeld = rmbHeld = false; });
let mDown = false, mMoved = 0;
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('mousedown', e => {
  if (state !== 'play' || menuOpen || coarse || uiOpen() || noteOpen) return;
  if (!locked && !dragLook) { requestLock(); return; }
  if (e.button === 2) { zoomHeld = true; rmbHeld = true; if (curItem() === 'hammer' && fpMode()) demolish(); return; }
  if (e.button === 0) { mDown = true; mMoved = 0; if (locked && performance.now() - lockAt > 350) pressPrimary(); }
});
function pressPrimary() {
  if (PL.mode === 'helm') { fireBroadside(aimSide()); return; }
  if (PL.mode === 'cannon') { cannonFire(); return; }
  if (PL.mode === 'spy') { exitSpy(); return; }
  if (hovered && !ITEMS[curItem()] && !PL.carry) { interact(); return; }
  lmbHeld = true; lmbPress = true;
}
addEventListener('mouseup', e => {
  if (e.button === 2) { zoomHeld = false; rmbHeld = false; return; }
  if (dragLook && mDown && mMoved < 5 && state === 'play' && !menuOpen && !uiOpen()) { pressPrimary(); setTimeout(() => { lmbHeld = false; }, 120); }
  lmbHeld = false; mDown = false;
});
addEventListener('mousemove', e => { if (state !== 'play' || menuOpen || coarse || uiOpen() || noteOpen) return; if (locked || (dragLook && (mDown || zoomHeld))) { mMoved += Math.abs(e.movementX) + Math.abs(e.movementY); look(e.movementX, e.movementY); } });
canvas.addEventListener('wheel', e => {
  if (state !== 'play') return; e.preventDefault();
  if (PL.mode === 'helm') { CAM.dist = clamp(CAM.dist * (1 + e.deltaY * 0.0012), 14, 90); return; }
  if (curItem() === 'hammer') { buildIdx = (buildIdx + (e.deltaY > 0 ? 1 : BUILD_LIST.length - 1)) % BUILD_LIST.length; return; }
  if (fpMode()) { PL.slot = (PL.slot + (e.deltaY > 0 ? 1 : 7)) % 8; PL.cast = null; invDirty = 1; }
}, { passive: false });
function look(dx, dy) {
  const k = 0.0022 * (S.sens / 100) * (PL.mode === 'spy' || zoomHeld ? 0.3 : 1); const inv = S.invert ? -1 : 1;
  if (PL.mode === 'helm') { CAM.yaw -= dx * k; CAM.pitch = clamp(CAM.pitch + dy * k * inv, -0.14, 1.25); return; }
  if (PL.mode === 'cannon') { PL.aimYaw = clamp(PL.aimYaw - dx * k * 0.6, -0.5, 0.5); PL.aimEl = clamp(PL.aimEl - dy * k * inv * 0.5, -0.05, 0.32); return; }
  PL.yaw -= dx * k; PL.pitch = clamp(PL.pitch - dy * k * inv, -1.45, 1.45);
}
function requestLock() { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => { if (!everLocked) dragLook = true; }); } catch (e) { dragLook = true; } }
document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas; if (locked) { everLocked = true; lockAt = performance.now(); } if (!locked && state === 'play' && !menuOpen && !dragLook && !chatOpen && !uiOpen() && !noteOpen) openMenu(); });
document.addEventListener('pointerlockerror', () => { if (!everLocked) dragLook = true; });
/* chat */
function openChat() { if (!NET.on) { say('Chat needs the online sea — you are sailing solo.', 2.5); return; } chatOpen = true; $('#chat').classList.add('on'); const i = $('#chatin'); i.value = ''; setTimeout(() => i.focus(), 0); }
function closeChat() { chatOpen = false; $('#chat').classList.remove('on'); $('#chatin').blur(); }
function sendChat() { const t = $('#chatin').value.trim().slice(0, 100); if (t) netSend({ t: 'chat', text: t }); closeChat(); }
/* touch */
const stick = { id: null, x: 0, y: 0, cx: 0, cy: 0, ly: 0 }; const lookT = { id: null, x: 0, y: 0, moved: 0 };
if (coarse) {
  const st = $('#stick'), kn = $('#knob');
  st.addEventListener('touchstart', e => { const t = e.changedTouches[0]; stick.id = t.identifier; const r = st.getBoundingClientRect(); stick.cx = r.left + r.width / 2; stick.cy = r.top + r.height / 2; e.preventDefault(); }, { passive: false });
  addEventListener('touchmove', e => { for (const t of e.changedTouches) { if (t.identifier === stick.id) { let dx = t.clientX - stick.cx, dy = t.clientY - stick.cy; const l = Math.hypot(dx, dy); if (l > 50) { dx *= 50 / l; dy *= 50 / l; } stick.x = dx / 50; stick.y = dy / 50; kn.style.transform = `translate(${dx}px,${dy}px)`;
      if (PL.mode === 'helm') { if (stick.y < -0.75 && stick.ly >= -0.75) setSail(sailLvl + 1); if (stick.y > 0.75 && stick.ly <= 0.75) setSail(sailLvl - 1); } stick.ly = stick.y; }
    else if (t.identifier === lookT.id) { const dx = t.clientX - lookT.x, dy = t.clientY - lookT.y; lookT.x = t.clientX; lookT.y = t.clientY; lookT.moved += Math.abs(dx) + Math.abs(dy); look(dx * 1.6, dy * 1.6); } } if (state === 'play' && !uiOpen()) e.preventDefault(); }, { passive: false });
  const end = e => { for (const t of e.changedTouches) { if (t.identifier === stick.id) { stick.id = null; stick.x = stick.y = stick.ly = 0; kn.style.transform = ''; } if (t.identifier === lookT.id) { if (lookT.moved < 8 && state === 'play' && !menuOpen && PL.mode !== 'helm') interact(); lookT.id = null; } } };
  addEventListener('touchend', end); addEventListener('touchcancel', end);
  canvas.addEventListener('touchstart', e => { const t = e.changedTouches[0]; if (lookT.id === null) { lookT.id = t.identifier; lookT.x = t.clientX; lookT.y = t.clientY; lookT.moved = 0; } }, { passive: true });
  $('#tUse').addEventListener('click', () => interact()); $('#tMenu').addEventListener('click', () => openMenu());
  $('#tFire').addEventListener('click', () => { if (PL.mode === 'helm') fireBroadside(aimSide()); else pressPrimary(), setTimeout(() => { lmbHeld = false; }, 300); });
  $('#tMode').addEventListener('click', () => { if (PL.mode === 'helm') setMode('walk'); else if (PL.plat === OWN) setMode('helm'); });
  $('#tChat').addEventListener('click', () => openChat());
  $('#tInv').addEventListener('click', () => uiKind === 'inv' ? closeUI() : openInventory());
  $('#tJump').addEventListener('touchstart', () => { keys.Space = true; }); $('#tJump').addEventListener('touchend', () => { keys.Space = false; });
}

/* ================= MENU / SETTINGS UI ================= */
function chips(el, withAuto) {
  el.querySelectorAll('.chip').forEach(c => c.remove());
  const opts = (withAuto ? ['auto'] : []).concat(ORDER);
  for (const o of opts) { const b = document.createElement('button'); b.className = 'chip'; b.textContent = o === 'auto' ? 'Auto' : o[0].toUpperCase() + o.slice(1);
    b.setAttribute('aria-pressed', String(S.preset === o || (o !== 'auto' && S.preset !== 'auto' && S.resolved === o && !Object.keys(S.custom).length)));
    b.addEventListener('click', () => { S.preset = o; if (o !== 'auto') S.resolved = o; else S.resolved = guess(); S.custom = {}; save(); applyGraphics(); syncUI(); }); el.appendChild(b); }
}
const F = [['scale', '%'], ['volume', '%'], ['sens', '%'], ['fov', '°'], ['sun', '°'], ['motion', '%']];
function syncUI() {
  chips($('#qchips'), true); chips($('#mchips'), true);
  const g = G();
  for (const [k, u] of F) { const el = $('#s_' + k); el.value = k === 'sun' ? sunElev : S[k]; $('#o_' + k).textContent = (k === 'sun' ? (+sunElev).toFixed(1) : S[k]) + u; }
  $('#s_adaptive').checked = S.adaptive; $('#s_shadows').value = g.shadows; $('#s_water').value = g.water; $('#s_lights').value = g.lights; $('#s_clouds').value = g.clouds; $('#s_aa').checked = g.aa;
  $('#s_fps').checked = S.fps; $('#s_drift').checked = S.drift; $('#s_bob').checked = S.bob; $('#s_invert').checked = S.invert;
  $('#s_time').value = S.timeMode; $('#s_weather').checked = S.weather !== 'off';
  $('#s_sun').disabled = S.timeMode !== 'sunset';
}
for (const [k] of F) $('#s_' + k).addEventListener('input', e => { const v = +e.target.value; if (k === 'sun') { sunElev = v; S.sun = v; } else S[k] = v;
  if (k === 'scale') applySize(); if (k === 'volume') sfx.setVol(v / 100); if (k === 'fov') { camera.fov = v; camera.updateProjectionMatrix(); } save(); syncUI(); });
for (const k of ['shadows', 'water', 'lights', 'clouds']) $('#s_' + k).addEventListener('change', e => { S.custom[k] = +e.target.value; S.preset = 'custom'; save(); applyGraphics(); syncUI(); });
$('#s_aa').addEventListener('change', e => { S.custom.aa = e.target.checked; save(); });
for (const k of ['adaptive', 'fps', 'drift', 'bob', 'invert']) $('#s_' + k).addEventListener('change', e => { S[k] = e.target.checked; if (k === 'adaptive' && !S[k]) { dynScale = 1; applySize(); } save(); applyGraphics(); });
$('#s_time').addEventListener('change', e => { S.timeMode = e.target.value; if (S.timeMode === 'sunset') sunElev = S.sun || 7; save(); syncUI(); });
$('#s_weather').addEventListener('change', e => { S.weather = e.target.checked ? 'on' : 'off'; save(); });
function openMenu() { menuOpen = true; $('#menu').classList.add('on'); syncUI(); if (document.pointerLockElement) document.exitPointerLock(); }
function closeMenu(lock = true) { menuOpen = false; $('#menu').classList.remove('on'); if (lock && !coarse && !dragLook) requestLock(); }
$('#resume').addEventListener('click', () => closeMenu(true));
$('#mfleet').addEventListener('click', () => { closeMenu(false); if (PL.plat === OWN || nearestPortD() < 120) openShipyard(); else say('The shipwright is in port. Sail to Port Saltwren or Haven.', 3); });
function nearestPortD() { const p = playerOcean(), I = nearestPort(); return I ? Math.hypot(I.dockEnd.x - p.x, I.dockEnd.z - p.z) : 1e9; }

/* ================= NETWORK ================= */
const MP_HOST = 'gilded-wake.sickagent.workers.dev';
const canOnline = location.host === MP_HOST || /^(localhost|127\.0\.0\.1)$/.test(location.hostname) || /\.workers\.dev$/.test(location.hostname);
const NET = { ws: null, on: false, id: null, off: 0, color: '#e8b45f', sendT: 0, tries: 0, pingT: 0, isHost: true };
const PEERS = new Map();
let locSeq = 1;
function setStatus(s) {
  const n = PEERS.size;
  const txt = s === 'online' ? (n ? `Online · ${n} other captain${n > 1 ? 's' : ''} at sea` : 'Online · waiting for other captains') : s === 'connecting' ? 'Connecting to the open sea…' : s === 'reconnecting' ? 'Connection lost — reconnecting…' : '';
  $('#net').textContent = txt; $('#netT').textContent = txt;
}
function connect() {
  if (!canOnline) { $('#netT').innerHTML = `Sailing solo here. <a href="https://${MP_HOST}/" target="_blank" rel="noopener">Sail online with friends ↗</a>`; $('#net').textContent = 'Solo voyage'; return; }
  const room = (new URLSearchParams(location.search).get('room') || 'open-sea');
  const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws?room=' + encodeURIComponent(room) + '&name=' + encodeURIComponent(ME.name);
  let ws; try { ws = new WebSocket(url); } catch (e) { setStatus('reconnecting'); return; }
  NET.ws = ws; setStatus('connecting');
  ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (_) { return; } try { onNet(m); } catch (err) { console.error('net', m.t, err); } };
  ws.onclose = () => { const was = NET.on; NET.on = false; NET.ws = null; NET.isHost = true; for (const id of [...PEERS.keys()]) removePeer(id); setStatus('reconnecting'); if (was) feed('Lost contact with the other ships…'); setTimeout(connect, Math.min(10000, 1500 * (++NET.tries))); };
}
function netSend(m) {
  if (NET.on && NET.ws && NET.ws.readyState === 1) { NET.ws.send(JSON.stringify(m)); return; }
  if (NET.on) return;
  // sailing solo: the object store lives here instead
  if (m.t === 'oc') { const o = m.o; o.id = o.id || 'l' + (locSeq++).toString(36); if (OBJS.has(o.id)) return; o.at = Date.now(); addObj(o); }
  else if (m.t === 'ou') updObj(m.id, m.p); else if (m.t === 'od') delObj(m.id);
}
const serverNow = () => Date.now() + NET.off;
function resolvePlat(pp) {
  if (!pp) return null;
  if (pp === 'p:' + NET.id) return OWN;
  if (pp === 'j:' + NET.id) return JB.on ? JBENT : null;
  return ENTS.get(pp) || null;
}
function onNet(m) {
  const P = m.id ? PEERS.get(m.id) : null;
  switch (m.t) {
    case 'welcome': {
      NET.on = true; NET.tries = 0; NET.id = m.id; NET.off = m.now - Date.now(); NET.color = m.color; NET.isHost = m.host === m.id;
      for (const id of [...OBJS.keys()]) delObj(id);
      for (const id of [...NPCS.keys()]) removeEnt('n:' + id); NPCS.clear();
      for (const o of m.objs || []) addObj(o);
      for (const p of m.players) addPeer(p);
      netSend({ t: 'name', name: ME.name });
      if (OWN.has) { setOwnShip(OWN.rec); ensureStrongbox(); }
      setStatus('online'); break; }
    case 'join': addPeer(m); if (state !== 'title') feed(`${m.name} has set sail nearby`, m.color); setStatus('online'); break;
    case 'leave': { if (P && state !== 'title') feed(`${P.name} has sailed over the horizon`, P.color); removePeer(m.id); setStatus('online'); break; }
    case 'host': NET.isHost = m.id === NET.id; break;
    case 'name': if (P) { P.name = m.name; if (P.ship) P.ship.name = m.name; } break;
    case 'st': if (P) peerState(P, m); break;
    case 'fire': { if (!P) break; const ent = m.e === 'own' ? P.ship : resolvePlat(m.e); if (ent && ent.root.visible !== false && ent.guns) { fireGunsOf(ent, m.g, m.el, m.am || 'ball', m.id, m.sd, m.ay || 0); } break; }
    case 'xshot': shoot(new THREE.Vector3(m.x - org.x, m.y, m.z - org.y), new THREE.Vector3(m.dx, 0, m.dz), m.el, m.id, m.sd, new THREE.Vector3(), m.am); break;
    case 'hit': {
      if (!OWN.has || OWN.sk) break;
      const l = new THREE.Vector3(m.p[0], m.p[1], m.p[2]); lastHitBy = m.id;
      const w = ship.localToWorld(l.clone()); splinters(w, 30); sfx.hit(WP(w), 1.2);
      if (PL.plat === OWN) { shake = Math.max(shake, 0.9); flashEl('#dmg'); }
      damageOwn(m.dmg, l, { sail: m.sd, fire: (AMMO[m.am] || {}).fire, by: m.id });
      if (P && Math.random() < 0.4 && !OWN.sk) say(`${P.name} is firing on you!`, 2);
      break; }
    case 'phit': hurtPlayer(m.dmg, m.from || m.id, m.k || 'melee'); break;
    case 'parry': say('Parried! Your blade glances off.', 1.2); PL.swingCd = 0.9; sfx.clash(camera); break;
    case 'pdie': if (P) { P.alive = 0; if (m.by === NET.id) { const b = Math.min(5000, P.bounty || 0); if (b) { ME.gold += b; popText('+' + fmtG(b) + ' bounty'); } ME.kills = (ME.kills || 0) + 1; feed(`You defeated ${P.name}${b ? ` and claimed a ${fmtG(b)} bounty` : ''}`, NET.color); } else feed(`${P.name} has fallen`, P.color); } break;
    case 'chit': if (NET.isHost) { const n = NPCS.get(m.n); if (n && n.crew[m.c] && n.crew[m.c].hp > 0) { n.crew[m.c].hp -= m.dmg; if (n.crew[m.c].hp <= 0) crewDown(n, m.c); } } break;
    case 'nhit': if (NET.isHost) { const e = ENTS.get('n:' + m.n); if (e) npcHitLocal(e, m.dmg, m.sd, m.am, m.id); } break;
    case 'npcs': if (!NET.isHost) for (const a of m.l) applyNpc(a); break;
    case 'ndel': NPCS.delete(m.n); removeEnt('n:' + m.n); break;
    case 'nfire': if (!NET.isHost) npcFireLocal(m); break;
    case 'grap': if (P) say(`${P.name} has thrown grappling hooks onto your ship! Repel boarders!`, 3); break;
    case 'boom': onBoom(m); break;
    case 'flare': flareBurst(m, P && P.name, P && P.color); break;
    case 'oa': addObj(m.o); break;
    case 'ou': updObj(m.id, m.p, m.by); break;
    case 'od': delObj(m.id); break;
    case 'ocr': case 'oir': case 'otr': { const f = rq.get(m.rq); if (f) { rq.delete(m.rq); f(m); } break; }
    case 'sunk': {
      const vic = m.id === NET.id ? 'you' : (P || {}).name || 'a ship';
      const byN = m.by === NET.id ? 'You' : m.by ? ((PEERS.get(m.by) || {}).name || 'Someone') : 'The sea';
      if (m.by === NET.id && m.id !== NET.id) { say(`${vic} goes down under your guns.`, 3.5); flashEl('#hitm'); ME.infamy = (ME.infamy || 0) + 1; }
      if (P && m.by && PEERS.get(m.by)) PEERS.get(m.by).score = m.score; if (m.by === NET.id) ME.score = m.score;
      feed(`${byN} sank ${vic}`, m.by === NET.id ? NET.color : (PEERS.get(m.by) || {}).color); break; }
    case 'chat': { const who = m.id === NET.id ? { name: ME.name, color: NET.color } : P; if (!who) break; feed(`${who.name}: ${m.text}`, who.color); if (P) { P.chat = m.text; P.chatT = 6; if (P.ship) { P.ship.chat = m.text; P.ship.chatT = 6; } } sfx.clink(camera); break; }
    case 'bell': { if (P && P.ship && P.ship.root.visible) { const w = P.ship.body.localToWorld(new THREE.Vector3(0, DECK + 2.2, -11.4)); if (w.length() < 900) sfx.bell(WP(w)); } break; }
    case 'pong': { const rtt = Date.now() - m.c; NET.off = lerp(NET.off, m.now + rtt / 2 - Date.now(), 0.5); NET.isHost = m.host === NET.id; break; }
  }
}

/* ================= OTHER PLAYERS ================= */
let PEER_T = null;
function buildPeerTemplate() {
  const sp = ship.position.clone(), sr = ship.rotation.clone(), ss = ship.scale.clone();
  ship.position.set(0, 0, 0); ship.rotation.set(0, 0, 0); ship.scale.set(1, 1, 1); shipYaw.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(ship.matrixWorld).invert();
  const byMat = new Map(), sailsT = [], jibsT = [], muz = [], glows = []; let flagM = null, penM = null;
  const glassSet = new Set(lanterns.map(L => L.gm));
  ship.traverse(o => {
    if (o === ship || !o.visible && o.parent === ship) return;
    let p = o; while (p && p !== ship) { if (p === rowOwn.root) return; p = p.parent; }
    const rel = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    if (o.isMesh) {
      if (o.material === proxyMat) return;
      if (o.userData.sailIdx !== undefined) { sailsT[o.userData.sailIdx] = rel; return; }
      if (o.userData.jibIdx !== undefined) { jibsT[o.userData.jibIdx] = rel; return; }
      if (o.userData.flag) { flagM = rel; return; }
      if (o.userData.pennant) { penM = rel; return; }
      if (o.userData.cannon !== undefined) muz[o.userData.cannon] = new THREE.Vector3(1.1, 0, 0).applyMatrix4(rel);
      const key = glassSet.has(o.material) ? MAT.glass : o.material;
      if (!byMat.has(key)) byMat.set(key, []);
      byMat.get(key).push(o.geometry.clone().applyMatrix4(rel));
    } else if (o.isSprite && o.material.blending === THREE.AdditiveBlending && o !== candle.flame) { glows.push(new THREE.Vector3().setFromMatrixPosition(rel)); }
  });
  ship.position.copy(sp); ship.rotation.copy(sr); ship.scale.copy(ss);
  const parts = []; for (const [mat, list] of byMat) parts.push([mat, merge(list)]);
  PEER_T = { parts, sailsT, jibsT, flagM, penM, muz, glows, glowMat: new THREE.SpriteMaterial({ map: glowTex, color: 0xffa850, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7 }) };
}
function addPeer(info) {
  if (info.id === NET.id) return;
  if (PEERS.has(info.id)) removePeer(info.id);
  const av = makeAvatar({ coat: info.color, style: 'captain', seed: [...String(info.id)].reduce((h, c) => h * 31 + c.charCodeAt(0) >>> 0, 7) }); scene.add(av.root); av.root.visible = false;
  const T = makeTag(av.root, 2.35);
  PEERS.set(info.id, { id: info.id, name: info.name, color: info.color, score: info.score || 0, av, T, ship: null, jb: null, pp: '', lx: 0, ly: 0, lz: 0, wo: new THREE.Vector2(info.x || 0, info.z || 0), oy: 0, yaw: 0, mode: 'helm', wpn: '', alive: 1, act: '', bounty: 0, hp: 100, init: 0, lastAct: '' });
}
function removePeer(id) { const P = PEERS.get(id); if (!P) return; scene.remove(P.av.root); if (P.ship) removeEnt(P.ship.id); if (P.jb) removeEnt(P.jb.id); if (GRAP.ent && (GRAP.ent === P.ship)) cutGrapple(); PEERS.delete(id); }
function peerState(P, m) {
  const now = performance.now();
  P.wo.set(m.x, m.z); P.bounty = m.b || 0;
  const s = m.s;
  if (s) {
    const key = s[10] + ':' + s[11] + ':' + s[12] + ':' + s[13];
    let e = P.ship;
    if (e && (e.key !== key || (e.sk && !s[7]))) { removeEnt(e.id); e = null; }
    if (!e) { e = remoteShip('p:' + P.id, 'peer', s[10], { sail: s[11], hull: s[12], flag: s[13] }, { color: P.color }); e.pid = P.id; e.key = key; P.ship = e; }
    e.name = P.name; e.color = P.color;
    e.snaps.push({ t: now, x: s[0], z: s[1], h: s[2], sp: s[3] }); if (e.snaps.length > 10) e.snaps.shift();
    e.sp = s[3]; e.sl = s[4]; e.hp = s[5]; e.pred = null; e.max = s[6]; if (s[7] && !e.sk) { e.sk = 1; e.sinkT = 0; } e.sail = s[8]; e.fire = s[9];
    if (e.gcount !== s[14]) { e.gcount = s[14]; e.guns = gunLayout(s[14]); }
    e.line2 = P.bounty ? 'Bounty ' + fmtG(P.bounty) : '';
  } else if (P.ship) { removeEnt(P.ship.id); P.ship = null; }
  if (m.j) {
    if (!P.jb) { P.jb = remoteShip('j:' + P.id, 'row', 'rowboat', { hull: 0 }, {}); P.jb.pid = P.id; P.jb.name = ''; }
    P.jb.snaps.push({ t: now, x: m.j[0], z: m.j[1], h: m.j[2], sp: m.j[3] }); if (P.jb.snaps.length > 10) P.jb.snaps.shift(); P.jb.sp = m.j[3];
  } else if (P.jb) { removeEnt(P.jb.id); P.jb = null; }
  const p = m.p;
  if (p) {
    P.pp = p[0]; if (p[0]) { P.lx = p[1]; P.ly = p[2]; P.lz = p[3]; } else { P.ox = p[1]; P.oy = p[2]; P.oz = p[3]; }
    P.yaw = p[4]; P.mode = MODES[p[6]] || 'walk'; P.wpn = p[7] || ''; const alive = p[8] ? 1 : 0; if (alive && !P.alive) P.init = 0; P.alive = alive; P.hp = p[10];
    if (p[9] !== P.lastAct) { P.lastAct = p[9]; P.act = p[9]; P.actT = 0.6; const w = P.av.root.position; if (P.act === 'sh') sfx.gun(WP(w), P.wpn); if (P.act === 'sw') sfx.swing(); }
    P.emote = p[11] || '';
  }
}
const tmpP = new THREE.Vector3();
function updatePeerAvatars(dt, t) {
  for (const P of PEERS.values()) {
    const av = P.av; P.actT = Math.max(0, (P.actT || 0) - dt);
    let yawW = P.yaw, ok = true;
    if (P.pp) { const plat = resolvePlat(P.pp); if (!plat || (plat.root && !plat.root.visible)) ok = false; else { tmpP.set(P.lx, P.ly, P.lz); const b = platBody(plat); b.updateMatrixWorld(); b.localToWorld(tmpP); yawW = platYaw(plat) + P.yaw; } }
    else if (P.ox != null) tmpP.set(P.ox - org.x, P.oy, P.oz - org.y); else ok = false;
    const d = ok ? tmpP.distanceTo(camera.position) : 1e9;
    av.root.visible = ok && d < 350;
    if (!av.root.visible) continue;
    if (!P.init || av.root.position.distanceToSquared(tmpP) > 400) { av.root.position.copy(tmpP); P.init = 1; } else av.root.position.lerp(tmpP, Math.min(1, dt * 14));
    const sp = P.prevP ? P.prevP.distanceTo(tmpP) / Math.max(dt, 1e-3) : 0; P.prevP = (P.prevP || new THREE.Vector3()).copy(tmpP);
    P.spd = lerp(P.spd || 0, P.pp && plat0(P) ? Math.min(sp, 6) : Math.min(sp, 6), Math.min(1, dt * 6));
    av.root.rotation.y = lerpAng2(av.root.rotation.y, yawW, Math.min(1, dt * 10));
    setAvatarWeapon(av, P.mode === 'helm' ? '' : P.wpn);
    const it = ITEMS[P.wpn] || {};
    animAvatar(av, { spd: P.mode === 'helm' ? 0 : P.spd, t: t + P.id.length, sit: P.emote === 'sit' || P.mode === 'row', swim: P.mode === 'swim', helm: P.mode === 'helm', aim: it.cat === 'gun' && P.act === 'sh', swing: P.act === 'sw' ? P.actT / 0.6 : 0, block: 0, dig: P.act === 'dg', wave: P.emote === 'wave', dance: P.emote === 'dance', drunk: P.act === 'dr' ? 1 : 0, dead: !P.alive });
    P.chatT = Math.max(0, (P.chatT || 0) - dt);
    P.T.tag.visible = d < 120 && !(P.mode === 'helm' && P.ship);
    if (P.T.tag.visible) drawTag2(P.T, P.name, P.color, P.alive ? P.hp : 0, P.bounty ? 'Bounty ' + fmtG(P.bounty) : '', P.chatT > 0 ? P.chat : '');
  }
}
function plat0(P) { return true; }

/* ================= GUNNERY (my broadsides) ================= */
const tA = new THREE.Vector3(), tB = new THREE.Vector3(), tC = new THREE.Vector3();
const shipRight = () => tA.set(Math.cos(heading), 0, -Math.sin(heading));
function aimSide() { camera.getWorldDirection(tB); return tB.dot(shipRight()) >= 0 ? 1 : -1; }
const aimElev = () => clamp(0.05 + (0.62 - CAM.pitch) * 0.32, 0.03, 0.3);
function sideGuns(sg) { return OWN.guns ? OWN.guns.map((g, i) => g.sg === sg ? i : -1).filter(i => i >= 0) : []; }
function sideLoad(sg) { let m = 0; for (const i of sideGuns(sg)) m = Math.max(m, OWN.gready[i] || 0); return 1 - m / RELOAD; }
let warnT = 0;
function fireBroadside(sg) {
  if (OWN.sk || state !== 'play' || !OWN.has) return;
  if (OWN.row) { say('A rowboat carries no guns. Buy a ship from the shipwright.', 2); return; }
  let gis = sideGuns(sg).filter(i => (OWN.gready[i] || 0) <= 0);
  if (!gis.length) { if (clock - warnT > 1) { warnT = clock; say(`${sg > 0 ? 'Starboard' : 'Port'} guns are still reloading…`, 1.4); } return; }
  const have = invCount(curAmmo);
  if (!have) { say(`No ${ITEMS[curAmmo].n.toLowerCase()} aboard. Press 1–4 to switch, or buy more from a chandler.`, 2.5); return; }
  gis = gis.slice(0, have); invTake(curAmmo, gis.length);
  const rl = RELOAD * (1 - Math.min(0.45, (OWN.crewN || 0) * 0.07)) * (1 - 0.12 * ((OWN.rec.up || {}).guns || 0) / 3);
  for (const i of gis) OWN.gready[i] = rl;
  const el = aimElev(), sd = (Math.random() * 100000) | 0;
  netSend({ t: 'fire', e: 'own', g: gis, el: +el.toFixed(3), sd, am: curAmmo });
  fireGunsOf(OWN, gis, el, curAmmo, 'me', sd);
  gis.forEach((gi, k) => { const G = OWN.guns[gi]; if (G.real >= 0 && cannons[G.real]) sfx.fuse(cannons[G.real].bar); setTimeout(() => { shake = Math.max(shake, PL.mode === 'helm' ? 0.25 : 0.6); }, 120 + k * 140); });
}

/* ================= OWN SHIP: SINKING ================= */
function startSink(by) {
  if (!OWN.has || OWN.sk) return;
  OWN.sk = 1; OWN.sinkT = 0; OWN.hp = 0; setSail(0, true); if (GRAP.on) cutGrapple();
  netSend({ t: 'sunk', by: by && !String(by).startsWith('n:') ? by : null });
  if (!NET.on) feed(`The ${by ? 'enemy' : 'sea'} claims your ${SHIP_CLASSES[OWN.cls].n.toLowerCase()}`);
  sfx.sink();
  const rec = OWN.rec; if (rec && rec.cls !== 'rowboat') rec.sunk = 1;
  // the strongbox goes down with her — and its gold floats up for anyone to grab
  const id = myStrongId(), sb = id && OBJS.get(id);
  if (sb) request({ t: 'ot', id }).then(r => { if (r.ok && r.o.gold > 0) { const n = clamp(Math.ceil(r.o.gold / 1500), 1, 5); for (let i = 0; i < n; i++) oCreate({ k: 'gold', x: shipO.x + rand(-10, 10), z: shipO.y + rand(-10, 10), v: Math.round(r.o.gold / n), float: 1 }); } });
  const who = by && ((PEERS.get(by) || {}).name || (ENTS.get(by) || {}).name);
  banner(`Your ${SHIP_CLASSES[OWN.cls].n.toLowerCase()} is going down`, (who ? `Sunk by ${who}. ` : '') + (rec && rec.cls !== 'rowboat' ? 'Her gold floats free. The shipwright can raise her — for a price.' : 'Swim for it!'));
  saveProfileSoon();
}
function updateSinking(dt) {
  if (!OWN.sk) return;
  if (OWN.sinkT > 4 && PL.plat === OWN) {
    if (PL.mode !== 'walk') { if (PL.mode === 'spy') exitSpy(); PL.mode = 'walk'; document.body.classList.remove('captain'); $('#compass').classList.remove('on'); PL.l.set(2.6, DECK, 0); }
    const dir = new THREE.Vector3(1, 0, 0).applyQuaternion(ship.getWorldQuaternion(new THREE.Quaternion())); PL.l.x = hw(0) + 0.5; PL.l.y = DECK; leaveShip(dir.x * 3, dir.z * 3, 2);
  }
  if (OWN.sinkT > 6) hideBanner();
  if (OWN.sinkT > 14) {
    // a rowboat bobs up from the wreckage
    const p = playerOcean(); const row = ME.ships.find(s => s.cls === 'rowboat') || ME.ships[0];
    row.sunk = 0; row.hp = 50; ME.active = row.id; OWN.sk = 0; OWN.sinkT = 0;
    setOwnShip(row); shipO.set(p.x + 3, p.z + 3); heading = rand(0, TAU); ensureStrongbox();
    say('A rowboat bobs up from the wreckage. Row for port and buy another ship.', 4);
    saveProfileSoon();
  }
}

/* ================= SHIP ANIMATION (my ship) ================= */
let slapCd = 2, creakCd = 3, gullCd = 5, flapCd = 6, lastRollV = 0, sprayCd = 0, bellDingCd = 8, wheelClick = 0, dmgFxT = 0;
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();
function shipSounds(dt, gNow) {
  if (!OWN.has) return;
  const sp01 = clamp(speed / 6, 0, 1), near = PL.plat === OWN || PL.mode === 'helm';
  slapCd -= dt; creakCd -= dt; gullCd -= dt; flapCd -= dt; bellDingCd -= dt; sprayCd -= dt;
  if (slapCd <= 0 && (body.pv < -0.03 || Math.random() < dt * 0.15)) { slapCd = rand(1.6, 4.5); sfx.slap(rand(0.25, 0.5) * (0.5 + 0.5 * sp01) * (near ? 1 : 0.4), rand(-0.7, 0.7)); }
  if (body.pv < -0.035 && sprayCd <= 0 && speed > 1.5 && !OWN.row) { sprayCd = rand(1.2, 3); spray(); }
  if (near && Math.sign(body.rv) !== Math.sign(lastRollV) && creakCd <= 0) { creakCd = rand(1.5, 4); if (Math.random() < 0.7) sfx.creak(rand(0.1, 0.24)); }
  lastRollV = body.rv;
  if (!OWN.row && Math.abs(body.rv) > 0.02 && bellDingCd <= 0 && Math.random() < 0.02) { bellDingCd = rand(14, 30); bell.v += 0.25; sfx.bell(bell.pivot); }
  if (gullCd <= 0) { gullCd = rand(6, 16); const gl = gulls[(Math.random() * BN) | 0]; tmpV2.set(gl.px || 0, gl.py || 20, gl.pz || 0).sub(camera.position); const d = tmpV2.length(); tmpV2.normalize(); tmpV.set(1, 0, 0).applyQuaternion(camera.quaternion); sfx.gull(tmpV2.dot(tmpV) * 0.8, clamp(30 / d, 0.15, 1)); }
  if (flapCd <= 0) { flapCd = rand(5, 14); if (sailF > 0.5 && near) sfx.flap(); }
  sfx.update({ swell: clamp(hcSwell / 1.2, -1, 1), speed: near ? sp01 : 0, gust: gNow * (0.4 + 0.6 * sailF) * (near ? 1 : 0.5) });
  const pct = OWN.hp / OWN.max * 100;
  if (!OWN.row && (pct < 60 || OWN.sk || OWN.fire)) { dmgFxT -= dt; if (dmgFxT <= 0) { dmgFxT = pct < 30 || OWN.sk || OWN.fire ? 0.07 : 0.18; damageFx(ship, OWN.sk || OWN.fire ? 0 : pct); } }
}
function spray() {
  for (const sg of [1, -1]) { const base = ship.localToWorld(tmpV.set(sg * 1.0, 0.3, -13.2)).clone(); const out = tmpV2.set(sg, 0, -0.4).applyQuaternion(shipYaw.quaternion).normalize();
    for (let i = 0; i < 22; i++) emit({ x: base.x + rand(-0.4, 0.4), y: base.y, z: base.z + rand(-0.5, 0.5), vx: out.x * rand(1.5, 4), vy: rand(2.5, 5.5), vz: out.z * rand(1.5, 4), max: rand(0.8, 1.5), s0: rand(0.15, 0.3), s1: rand(0.5, 0.9), a0: rand(0.4, 0.75), kind: 0, g: -9.8, drag: 0.4, sea: true }); }
}
function shapeSail(s, a, f, g, t) {
  const b = s.base, h = (s.yTop - s.yBot), depth = s.depth * (0.75 + 0.35 * g) * f;
  for (let i = 0; i < a.length; i += 3) { const u = b[i] * 2, v = 0.5 - b[i + 1]; const w = lerp(s.wTop, s.wBot, v);
    const yy = s.yTop - v * h * lerp(0.1, 1, f);
    const bil = depth * (1 - u * u * 0.85) * Math.sin(Math.PI * Math.min(1, v * 0.92 + 0.04));
    const fl = 0.04 * Math.sin(t * 3.1 + u * 3 + v * 5 + s.ph) * v * (0.4 + g) + (1 - f) * 0.25 * Math.sin(u * 9 + v * 2) * 0.5;
    a[i] = u * w * 0.5; a[i + 1] = yy + (1 - f) * Math.abs(Math.sin(u * 14)) * 0.08; a[i + 2] = -(bil + fl); }
}
function shapeJib(j, a, f, g, t) {
  let k = 0;
  for (let r = 0; r <= j.rows; r++) for (let c = 0; c <= r; c++) { const u = r / j.rows, v = r ? c / r : 0;
    tmpV.copy(j.a).lerp(j.b, u); tmpV2.copy(j.a).lerp(j.c, u); tmpV.lerp(tmpV2, v);
    const bel = Math.sin(Math.PI * u) * Math.sin(Math.PI * clamp(v * 0.9 + 0.05, 0, 1)) * (0.9 * (0.7 + 0.4 * g)) * f + 0.05 * Math.sin(t * 3 + u * 6 + j.ph);
    a[k++] = tmpV.x + bel; a[k++] = tmpV.y - (1 - f) * u * (tmpV.y - j.c.y) * 0.85; a[k++] = tmpV.z; }
}
function shapeFlag(geo, base, t, g, pen) {
  const a = geo.attributes.position.array;
  for (let i = 0; i < a.length; i += 3) {
    if (pen) { const x = base[i]; const amp = x / 5; a[i] = x; a[i + 1] = base[i + 1] + Math.sin(x * 1.4 - t * 6) * 0.12 * amp; a[i + 2] = Math.sin(x * 1.1 - t * 5.3) * 0.45 * amp * (0.5 + g * 0.6); }
    else { const x = base[i] + 1.1; const amp = x / 2.2; a[i] = base[i] + 1.1 - amp * 0.15 * (0.5 + 0.5 * Math.sin(t * 6)); a[i + 1] = base[i + 1] + Math.sin(x * 3.5 - t * 8) * 0.06 * amp; a[i + 2] = Math.sin(x * 2.8 - t * 7.3 + base[i + 1] * 2) * 0.28 * amp * (0.5 + g * 0.6); }
  }
  geo.attributes.position.needsUpdate = true; geo.computeVertexNormals();
}
const sailN = new THREE.Vector3();
function updateSails(t, g) {
  if (OWN.has && !OWN.row && (PL.plat === OWN || frame % 2 === 0)) {
    for (const s of sails) { const geo = s.mesh.geometry; shapeSail(s, geo.attributes.position.array, sailF, g, t); geo.attributes.position.needsUpdate = true; geo.computeVertexNormals(); }
    for (const j of jibs) { const geo = j.mesh.geometry; shapeJib(j, geo.attributes.position.array, sailF, g, t); geo.attributes.position.needsUpdate = true; geo.computeVertexNormals(); }
    sails.forEach((s, i) => s.mesh.visible = OWN.sail > (i * 9) % 60 + 10 || i % 3 === 2);
    shapeFlag(flag.geometry, flagBase, t, g); shapeFlag(penGeo, penBase, t * 1.2, g, true);
  }
  sailN.set(0, 0, -1).applyQuaternion(shipYaw.quaternion);
  const back = Math.max(0, sailN.dot(tmpV.set(sunDir.x, 0, sunDir.z).normalize()));
  MAT.sail.emissive.copy(sunCol); MAT.sail.emissiveIntensity = 0.06 + 0.5 * back * sunI.v * sstep(-1, 4, sunElev);
}
function updateLoose(t) {
  let k = 0; for (const L of loose) {
    L.sv += (-body.r * 1.4 - L.sw) * 2.2 * 0.016 - L.sv * 0.02; L.sw += L.sv * 0.016 * 3;
    const sw = L.sw + Math.sin(t * 1.3 + L.ph) * 0.08 + Math.sin(t * 2.9 + L.ph) * 0.03; const swz = -body.p * 1.2 + Math.sin(t * 1.1 + L.ph * 2) * 0.06;
    let px = L.x, py = L.y, pz = L.z;
    for (let i = 1; i <= LOOSE_N; i++) { const s = i / LOOSE_N; const nx = L.x + Math.sin(sw * (0.6 + s * 0.6)) * L.len * s + Math.sin(t * 2 + s * 4 + L.ph) * 0.05 * s, ny = L.y - L.len * s * Math.cos(sw * 0.5), nz = L.z + Math.sin(swz) * L.len * s;
      looseArr[k++] = px; looseArr[k++] = py; looseArr[k++] = pz; looseArr[k++] = nx; looseArr[k++] = ny; looseArr[k++] = nz; px = nx; py = ny; pz = nz; }
  }
  looseGeo.attributes.position.needsUpdate = true;
}
function updateProps(dt, t) {
  const nightOn = ENV.night > 0.2 || ENV.fog > 0.4;
  for (const L of lanterns) {
    const s = L.swing ? 1 : 0.3;
    L.vz += ((-body.r * 1.0 - L.az) * 9 - L.vz * 0.9) * dt * s; L.az += L.vz * dt;
    L.vx += ((-body.p * 1.0 - L.ax) * 9 - L.vx * 0.9) * dt * s; L.ax += L.vx * dt;
    L.pivot.rotation.set(L.ax, 0, L.az);
    L.lvl += ((L.on || nightOn ? 1 : 0) - L.lvl) * Math.min(1, dt * 5);
    const fl = 0.88 + 0.08 * Math.sin(t * 13 + L.flick) + 0.05 * Math.sin(t * 23.7 + L.flick * 2) + 0.03 * Math.sin(t * 41 + L.flick);
    const dusk = 1.2 - 0.5 * sstep(2, 12, sunElev);
    L.light.intensity = L.lvl * fl * 1.6 * dusk * (L.name === 'stern' ? 1.4 : 1) * (OWN.row ? 0 : 1);
    L.gm.color.setRGB(1.0 * L.lvl * fl + 0.08, 0.62 * L.lvl * fl + 0.06, 0.28 * L.lvl * fl + 0.05);
    L.glow.material.opacity = L.lvl * fl * 0.75; L.glow.scale.setScalar((L.scale ? 1.6 : 1.0) * (0.9 + 0.15 * fl));
  }
  candle.flame.material.opacity = 0.8 + 0.2 * Math.sin(t * 17) * Math.sin(t * 7.3); candle.flame.scale.set(0.1 + 0.02 * Math.sin(t * 11), 0.2 + 0.03 * Math.sin(t * 9), 1);
  door.cur += (door.tgt - door.cur) * Math.min(1, dt * 2.6); door.pivot.rotation.y = -door.cur * 1.75;
  if (uiKind !== 'strong') chest.tgt = 0;
  chest.cur += (chest.tgt - chest.cur) * Math.min(1, dt * 2.5); chest.lidPivot.rotation.x = chest.cur * 1.9; chest.glow.material.opacity = chest.cur * (0.35 + 0.08 * Math.sin(t * 3));
  bell.v += (-bell.a * 14 - bell.v * 1.4 + (-body.r) * 3) * dt; bell.a += bell.v * dt; bell.pivot.rotation.x = bell.a * 0.4; bell.pivot.rotation.z = -body.r * 0.5;
  for (const b of barrels) { b.vx += (-b.wx * 60 - b.vx * 5) * dt; b.wx += b.vx * dt; b.vz += (-b.wz * 60 - b.vz * 5) * dt; b.wz += b.vz * dt; b.g.rotation.x = b.wx * 0.12; b.g.rotation.z = b.wz * 0.12; }
  const aimS = PL.mode === 'helm' ? aimSide() : 0, el = aimElev();
  if (OWN.gready) for (let i = 0; i < OWN.gready.length; i++) OWN.gready[i] = Math.max(0, OWN.gready[i] - dt);
  for (const C of cannons) { if (C.recoil > 0) C.recoil = Math.max(0, C.recoil - dt * 0.4);
    const r = C.recoil; const k = r > 0.85 ? (1 - r) / 0.15 : r / 0.85; C.slide.position.x = -0.85 * Math.sin(Math.min(1, k) * Math.PI / 2) * (r > 0 ? 1 : 0);
    if (PL.mode === 'cannon' && PL.gunEnt === OWN && OWN.guns[PL.gun] && OWN.guns[PL.gun].real === C.idx) continue;
    const tz = C.sg === aimS ? el * 0.8 : 0.03; C.bar.rotation.z += (tz - C.bar.rotation.z) * Math.min(1, dt * 4); C.grp.rotation.y += ((C.sg > 0 ? 0 : Math.PI) - C.grp.rotation.y) * Math.min(1, dt * 3); }
  const prevA = helm.angle; helm.angle += (rudder * 6.5 + Math.sin(t * 0.6) * 0.04 - helm.angle) * Math.min(1, dt * 5);
  helm.wheel.rotation.z = -helm.angle;
  wheelClick += Math.abs(helm.angle - prevA); if (wheelClick > 0.3 && PL.plat === OWN) { wheelClick = 0; sfx.ratchet(0); }
  binDome.rotation.y = -heading;
}
function updateParticles(dt) {
  let n = 0;
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life += dt; if (p.life >= p.max) { parts.splice(i, 1); continue; }
    p.vy += p.g * dt; const dr = Math.exp(-p.drag * dt); p.vx *= dr; p.vy *= dr; p.vz *= dr; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    p.x -= dOrg.x; p.z -= dOrg.y;
    if (p.kind === 1) { p.x += Math.sin(SUN_AZ) * 0.8 * dt; }
  }
  for (const p of parts) { const t = p.life / p.max; pPos[n * 3] = p.x; pPos[n * 3 + 1] = p.y; pPos[n * 3 + 2] = p.z; pSz[n] = lerp(p.s0, p.s1, Math.sqrt(t)); pA[n] = p.a0 * (1 - t) * (p.kind === 1 ? Math.min(1, p.life * 4) : 1); pK[n] = p.kind; n++; }
  pGeo.setDrawRange(0, n); if (n) { pGeo.attributes.position.needsUpdate = true; pGeo.attributes.size.needsUpdate = true; pGeo.attributes.alpha.needsUpdate = true; pGeo.attributes.kind.needsUpdate = true; }
  if (flashT > 0) { flashT = Math.max(0, flashT - dt * 5); flash.intensity = flashT * flashT * 8; }
}
function updateGulls(dt, t) {
  const c = OWN.has ? shipYaw.localToWorld(tmpV.set(0, 0, -3)) : tmpV.copy(camera.position);
  for (let i = 0; i < BN; i++) { const g = gulls[i]; g.th += g.w * dt; g.ft -= dt; if (g.ft <= 0) { g.flap = g.flap ? 0 : 1; g.ft = g.flap ? rand(0.8, 2.2) : rand(2, 5); }
    g.fa += dt * (g.flap ? 9.5 : 0);
    const x = c.x + g.cx + Math.cos(g.th) * g.r, z = c.z + g.cz + Math.sin(g.th) * g.r, y = g.h + Math.sin(t * 0.4 + g.ph) * 2.5 + body.h;
    g.px = x; g.py = y; g.pz = z;
    const dx = -Math.sin(g.th) * Math.sign(g.w), dz = Math.cos(g.th) * Math.sign(g.w);
    gE.set(0, Math.atan2(dx, dz), -Math.sign(g.w) * 0.32, 'YXZ'); gQ.setFromEuler(gE); gM.compose(gP.set(x, y, z), gQ, gS); gB.setMatrixAt(i, gM);
    const wa = g.flap ? Math.sin(g.fa) * 0.75 : 0.12 + Math.sin(t * 2 + g.ph) * 0.05;
    gW.makeRotationZ(wa); gL.setMatrixAt(i, gM2.copy(gM).multiply(gW)); gW.makeRotationZ(-wa); gR.setMatrixAt(i, gM2.copy(gM).multiply(gW));
  }
  gB.instanceMatrix.needsUpdate = gL.instanceMatrix.needsUpdate = gR.instanceMatrix.needsUpdate = true;
}

/* ================= INTERACTION ================= */
const HLC = new Map(), hlMats = []; let hlObj = null;
function hlMat(m) { if (!m.isMeshStandardMaterial) return m; let c = HLC.get(m); if (!c) { c = m.clone(); c.emissive = new THREE.Color(0xffa040); c.emissiveIntensity = 0.15; HLC.set(m, c); hlMats.push(c); } return c; }
function setHL(obj) {
  if (obj === hlObj) return;
  if (hlObj) hlObj.traverse(o => { if (o.isMesh && o.userData.origMat) { o.material = o.userData.origMat; delete o.userData.origMat; } });
  hlObj = obj;
  if (obj) obj.traverse(o => { if (o.isMesh && o.material !== proxyMat && !o.userData.origMat) { o.userData.origMat = o.material; o.material = hlMat(o.material); } });
}
const rc = new THREE.Raycaster(); rc.far = 3.3; const center = new THREE.Vector2(0, 0); const camDir = new THREE.Vector3(), pw = new THREE.Vector3();
let nearW = [], nearWT = 0;
function shipExtraInteract() {
  const plat = PL.plat; if (!plat || plat === JBENT || isRowPlat(plat) || PL.mode !== 'walk') return null;
  // the crow's nest — climb the main shrouds
  if (plat === OWN && Math.abs(PL.l.z + 0.5) < 1.8 && Math.abs(PL.l.x) > hw(-0.5) * 0.7 && PL.l.y < 3.6) return { label: () => 'Climb to the crow’s nest', sub: 'a long way up', act: climbNest };
  // guns on someone else's deck
  if (plat !== OWN && plat.guns) { let bi = -1, bd = 1.5; plat.guns.forEach((G, i) => { const d = Math.hypot(PL.l.x - (G.x - G.sg * 1.1), PL.l.z - G.z); if (d < bd && PL.l.y < 3.6) { bd = d; bi = i; } }); if (bi >= 0) { const G = plat.guns[bi]; return { label: () => `Man their ${G.sg > 0 ? 'starboard' : 'port'} gun`, sub: 'turn it on its owners', act: () => { PL.mode = 'cannon'; PL.gun = bi; PL.gunEnt = plat; PL.aimYaw = 0; PL.aimEl = 0.08; } }; } }
  // patch holes on my own ship
  if (plat === OWN && OWN.holes.length && PL.l.y < 3.6) return { label: () => `Patch the hull · ${OWN.holes.length} hole${OWN.holes.length > 1 ? 's' : ''}`, sub: () => `2 planks each · you have ${invCount('plank')}`, act: () => patchHole() };
  return null;
}
function underwaterInteract() {
  if (PL.mode !== 'swim' || !PL.underwater) return null;
  const p = playerOcean(); const sp = SPOTS.find(s => s.under && Math.hypot(s.x - p.x, s.z - p.z) < 5);
  if (!sp) return null;
  if (OBJS.has('dug:' + sp.id) && Date.now() - (OBJS.get('dug:' + sp.id).at || 0) < 1800000) return { label: () => 'An empty, broken chest', act: () => {} };
  return { label: () => 'Pry loose the sunken chest', sub: 'hold your breath', hold: 2.5, act: () => revealTreasure(sp, sp.x, sp.z) };
}
function updateHover(dt) {
  hovered = null;
  const fp = ['walk', 'swim', 'row'].includes(PL.mode);
  if (fp && !noteOpen && !menuOpen && !uiOpen() && PL.alive && !PL.carry) {
    nearWT -= dt; if (nearWT <= 0) { nearWT = 0.25; nearW = WPROX.filter(m => m.getWorldPosition(pw).distanceToSquared(camera.position) < 144); }
    rc.setFromCamera(center, camera);
    const list = (PL.plat === OWN && !OWN.row ? proxies.concat(blockers) : []).concat(nearW);
    const hits = list.length ? rc.intersectObjects(list, false) : [];
    let blockedRay = false;
    for (const h of hits) { if (h.object.userData.inter) hovered = h.object.userData.inter; else blockedRay = true; break; }
    if (!hovered && !blockedRay) {
      camera.getWorldDirection(camDir); let best = 0.13;
      for (const pr of list) { if (!pr.userData.inter) continue; pr.getWorldPosition(pw); pw.sub(camera.position); const d = pw.length(); if (d > 3.0 || d < 0.2) continue; const ang = Math.acos(clamp(pw.dot(camDir) / d, -1, 1)); if (ang < best) { best = ang; hovered = pr.userData.inter; } }
    }
    if (!hovered) hovered = baseInteract() || objInteract() || shipExtraInteract() || underwaterInteract();
  }
  if (hovered && hovered.proxy && !hovered.proxy.parent) hovered = null;
  setHL(hovered && hovered.hl || null);
  // hold-to-use
  if (holdT > 0) { if (!hovered || !hovered.hold || !keys.KeyE) holdT = 0; else { holdT += dt; if (holdT >= hovered.hold) { holdT = 0; hovered.act(); flashEl('#cross'); } } }
  let label = hovered ? hovered.label() : '';
  if (!label && PL.mode === 'nest') label = 'Climb down';
  if (label) {
    const sub = hovered ? (hovered.sub ? (typeof hovered.sub === 'function' ? hovered.sub() : hovered.sub) : '') : 'right-click: spyglass';
    const k = coarse ? '' : '<kbd>E</kbd>'; const prog = holdT > 0 && hovered ? Math.round(holdT / hovered.hold * 100) : -1;
    const key = label + sub + prog;
    if (promptEl.dataset.l !== key) { promptEl.innerHTML = k + esc(label) + (hovered && hovered.hold && prog < 0 ? ' <i>(hold)</i>' : '') + (sub ? `<small>${esc(sub)}</small>` : '') + (prog >= 0 ? `<span class="hold"><u style="width:${prog}%"></u></span>` : '') + (hovered && hovered.alt ? '<small><kbd>G</kbd>carry</small>' : ''); promptEl.dataset.l = key; }
    promptEl.classList.add('on'); crossEl.classList.add('hov');
  } else { promptEl.classList.remove('on'); crossEl.classList.remove('hov'); promptEl.dataset.l = ''; }
  if (coarse) { $('#tUse').style.display = (fp && (hovered || noteOpen)) || PL.mode === 'spy' || PL.mode === 'nest' || PL.mode === 'cannon' ? 'block' : 'none'; $('#tUse').textContent = PL.mode === 'spy' ? 'Lower' : noteOpen ? 'Close' : PL.mode === 'cannon' || PL.mode === 'nest' ? 'Leave' : 'Interact'; }
}

/* ================= CAMERA ================= */
const lookM = new THREE.Matrix4(), Y = new THREE.Vector3(0, 1, 0);
function captainPose(pos, quat, dt) {
  CAM.hs = lerpAng2(CAM.hs, heading, Math.min(1, dt * 2.5));
  const s = OWN.row ? 0.3 : OWN.scale, sk = OWN.sk ? OWN.sinkT : 0;
  const tg = shipYaw.localToWorld(tC.set(0, (6 + body.h * 0.5) * s - sk * sk * 0.05, 1));
  const a = CAM.hs + CAM.yaw, cp = Math.cos(CAM.pitch), d = CAM.dist * (OWN.row ? 0.4 : s);
  pos.set(tg.x + Math.sin(a) * cp * d, tg.y + Math.sin(CAM.pitch) * d, tg.z + Math.cos(a) * cp * d);
  const wy = waveH(pos.x, pos.z, seaT) + 1.6; if (pos.y < wy) pos.y = wy;
  lookM.lookAt(pos, tg, Y); quat.setFromRotationMatrix(lookM);
}
function titlePose(pos, quat, t) {
  const I = ISLES[0], c = tmpV.set(I.dockEnd.x - org.x, 5, I.dockEnd.z - org.y);
  const a = -0.75 + t * 0.02; const r = 70;
  pos.set(c.x + Math.sin(a) * r, 18 + Math.sin(t * 0.13) * 2, c.z + Math.cos(a) * r);
  lookM.lookAt(pos, tmpV2.set(c.x, 6, c.z), Y); quat.setFromRotationMatrix(lookM);
}
/* aim arc */
const ARC_N = 60; const arcPos = new Float32Array(ARC_N * 3); const arcGeo = new THREE.BufferGeometry(); arcGeo.setAttribute('position', new THREE.BufferAttribute(arcPos, 3));
const arcMat = new THREE.PointsMaterial({ color: 0xffd28a, size: 1.3, transparent: true, opacity: 0.85, depthWrite: false });
const arc = new THREE.Points(arcGeo, arcMat); arc.frustumCulled = false; scene.add(arc);
const ring = new THREE.Mesh(new THREE.RingGeometry(3.4, 4.6, 40), new THREE.MeshBasicMaterial({ color: 0xffd28a, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; scene.add(ring);
function updateArc() {
  const manned = PL.mode === 'cannon';
  const show = (PL.mode === 'helm' && OWN.has && !OWN.row || manned) && state === 'play' && !OWN.sk && !menuOpen; arc.visible = ring.visible = show; if (!show) return;
  let p, v, ready;
  const A = AMMO[curAmmo] || AMMO.ball, mv = MV * A.rng;
  if (manned) { const ent = PL.gunEnt, G = ent.guns[PL.gun]; p = gunWorld(ent, PL.gun).clone(); const out = shipRightOf(platYaw(ent)).multiplyScalar(G.sg).applyAxisAngle(Y, PL.aimYaw); v = new THREE.Vector3(out.x * Math.cos(PL.aimEl) * mv, Math.sin(PL.aimEl) * mv, out.z * Math.cos(PL.aimEl) * mv); const rd = ent === OWN ? OWN.gready : (ent.gready || []); ready = !(rd[PL.gun] > 0); }
  else { const sg = aimSide(), el = aimElev(); const gs = sideGuns(sg); if (!gs.length) { arc.visible = ring.visible = false; return; } ready = sideLoad(sg) >= 1; p = gunWorld(OWN, gs[Math.min(1, gs.length - 1)]).clone(); const out = shipRight().clone().multiplyScalar(sg); v = new THREE.Vector3(out.x * Math.cos(el) * mv, Math.sin(el) * mv, out.z * Math.cos(el) * mv); }
  let n = 0; const dt = 0.09;
  for (; n < ARC_N; n++) { arcPos[n * 3] = p.x; arcPos[n * 3 + 1] = p.y; arcPos[n * 3 + 2] = p.z; v.y -= 9.8 * dt; p.addScaledVector(v, dt); if (p.y < 0.2) break; }
  arcGeo.setDrawRange(0, n); arcGeo.attributes.position.needsUpdate = true;
  ring.position.set(p.x, waveH(p.x, p.z, seaT) + 0.3, p.z); const dist = p.distanceTo(camera.position); ring.scale.setScalar(1 + dist / 200);
  arcMat.opacity = ready ? 0.85 : 0.25; ring.material.opacity = ready ? 0.7 : 0.2; arcMat.color.set(ready ? 0xffd28a : 0xb0a090);
}

/* ================= HUD ================= */
let hudT = 0, rosterT = 0;
const hb = $('#hotbar');
function drawHotbar() {
  invDirty = 0;
  hb.innerHTML = ME.inv.slice(0, 8).map((s, i) => `<div class="hs ${i === PL.slot ? 'on' : ''}"><em>${i + 1}</em>${s ? `<span class="ic">${ICON[(ITEMS[s.k] || {}).cat] || '·'}</span><span class="nm">${esc((ITEMS[s.k] || { n: s.k }).n)}</span>${s.n > 1 ? `<i>${s.n}</i>` : ''}` : ''}</div>`).join('');
}
let lastSlot = -1, lastGold = -1;
function updateHUD(dt) {
  if (invDirty || PL.slot !== lastSlot) { lastSlot = PL.slot; drawHotbar(); const k = curItem(); setViewModel(ITEMS[k] && ['melee', 'gun', 'tool'].includes(ITEMS[k].cat) ? k : ''); }
  hudT -= dt; if (hudT > 0) return; hudT = 0.08;
  const helmM = PL.mode === 'helm';
  document.body.classList.toggle('fp', ['walk', 'swim', 'row', 'nest'].includes(PL.mode)); document.body.classList.toggle('cannon', PL.mode === 'cannon');
  if (helmM && OWN.has) {
    $('#spd').textContent = (Math.abs(speed) * 1.944).toFixed(1);
    document.querySelectorAll('#pips i').forEach((e, i) => e.classList.toggle('on', i < sailLvl));
    $('#rudK').style.left = `${50 + rudder * 42}%`;
    const as = aimSide();
    for (const [sg, id] of [[-1, '#rlP'], [1, '#rlS']]) { const l = sideLoad(sg); const el = $(id); el.style.width = `${l * 100}%`; el.parentElement.parentElement.classList.toggle('ready', l >= 1); el.parentElement.parentElement.classList.toggle('aim', as === sg); }
    $('#range').textContent = `~${Math.round(rangeFor(aimElev()))} m`;
    $('#ammo').textContent = `${ITEMS[curAmmo].n} · ${invCount(curAmmo)}`;
    document.body.classList.toggle('rowboat', !!OWN.row);
  }
  if (PL.mode === 'cannon') $('#ammo2').textContent = `${ITEMS[curAmmo].n} · ${invCount(curAmmo)} · 1–4 to switch · E to leave`;
  // ship status
  const hull = $('#hull'); hull.style.display = OWN.has ? 'flex' : 'none';
  if (OWN.has) { const pct = OWN.hp / OWN.max * 100; $('#hpB').style.width = `${pct}%`; $('#hpB').style.background = pct > 55 ? '#7fd18b' : pct > 25 ? '#f0c05a' : '#e8655f'; $('#hpV').textContent = Math.round(OWN.hp) + '/' + OWN.max;
    const w = []; if (OWN.fire) w.push('🔥 Fire aboard'); if (OWN.flood > 0.05) w.push(`Flooding ${Math.round(OWN.flood * 100)}%`); if (OWN.holes.length) w.push(`${OWN.holes.length} hole${OWN.holes.length > 1 ? 's' : ''}`); if (OWN.sail < 60) w.push(`Sails ${Math.round(OWN.sail)}%`); if (OWN.anchored) w.push('⚓ Anchored'); if (GRAP.on) w.push('Grappled');
    $('#warn').textContent = w.join(' · '); }
  // me
  $('#phB').style.width = `${PL.hp}%`; $('#phV').textContent = Math.round(PL.hp);
  if (Math.round(ME.gold) !== lastGold) { lastGold = Math.round(ME.gold); $('#gold').textContent = fmtG(lastGold); }
  $('#breath').style.display = PL.breath < 0.99 ? 'flex' : 'none'; $('#brB').style.width = `${PL.breath * 100}%`;
  $('#under').style.opacity = PL.underwater ? 1 : 0;
  const blur = PL.drunk > 0.35 ? Math.round((PL.drunk - 0.35) * 6) : 0; if (blur !== canvas._blur) { canvas._blur = blur; canvas.style.filter = blur ? `blur(${blur * 0.6}px) saturate(${1 + blur * 0.08})` : ''; }
  rosterT -= 0.08; if (rosterT <= 0) { rosterT = 0.5; drawRoster(); }
}
const rangeFor = el => { const mv = MV * (AMMO[curAmmo] || AMMO.ball).rng; const vx = Math.cos(el) * mv, vy = Math.sin(el) * mv, h = 3; return vx * (vy + Math.sqrt(vy * vy + 2 * 9.8 * h)) / 9.8; };
function drawRoster() {
  const rows = [{ name: ME.name + ' (you)', color: NET.color, score: ME.score || 0, hp: PL.hp, b: ME.bounty }];
  for (const p of PEERS.values()) rows.push({ name: p.name, color: p.color, score: p.score || 0, hp: p.alive ? p.hp : 0, b: p.bounty, d: Math.hypot(p.wo.x - playerOcean().x, p.wo.y - playerOcean().z) });
  $('#roster').innerHTML = (NET.on || PEERS.size ? '' : '<div class="rh">Solo voyage</div>') + rows.map(r => `<div class="rr"><i style="background:${esc(r.color)}"></i><span>${esc(r.name)}</span><b>${r.score} sunk${r.b ? ' · ' + fmtG(r.b) + ' bounty' : ''}</b><em><u style="width:${clamp(r.hp, 0, 100)}%"></u></em>${r.d != null ? `<small>${Math.round(r.d)} m</small>` : ''}</div>`).join('');
}
/* lookout markers from the crow's nest and the spyglass */
const marks = $('#marks'), markEls = new Map();
function updateMarks() {
  const show = (PL.mode === 'nest' || PL.mode === 'spy') && state === 'play';
  marks.style.display = show ? 'block' : 'none'; if (!show) return;
  const seen = new Set(), W = innerWidth, H = innerHeight;
  const add = (key, wx, wy, wz, text, color) => {
    tmpV.set(wx, wy, wz).project(camera); if (tmpV.z > 1 || Math.abs(tmpV.x) > 1.1 || Math.abs(tmpV.y) > 1.1) return;
    let el = markEls.get(key); if (!el) { el = document.createElement('div'); el.className = 'mk'; marks.appendChild(el); markEls.set(key, el); }
    seen.add(key); if (el._t !== text) { el._t = text; el.textContent = text; } el.style.borderColor = color || 'var(--brass)';
    el.style.transform = `translate(${(tmpV.x * 0.5 + 0.5) * W}px,${(-tmpV.y * 0.5 + 0.5) * H}px)`;
  };
  for (const e of ENTS.values()) if (e.root.visible && !e.sk && e.dist > 30 && e.dist < 3500 && e.kind !== 'row') add(e.id, e.root.position.x, 30 * (e.scale || 1), e.root.position.z, `${e.name || 'Ship'} · ${Math.round(e.dist)} m`, e.color);
  const p = playerOcean();
  for (const I of ISLES) { const d = Math.hypot(I.x - p.x, I.z - p.z); if (d < 4000 && d > I.R) add('i' + I.i, I.x - org.x, I.peak + 10, I.z - org.y, `${I.name} · ${Math.round(d)} m`, '#cfc0a0'); }
  for (const [k, el] of markEls) if (!seen.has(k)) { el.remove(); markEls.delete(k); }
}

/* ================= HOST EVENTS ================= */
let evT = 120;
function hostEvents(dt) {
  if (NET.on ? !NET.isHost : canOnline && NET.tries < 2) return;
  evT -= dt; if (evT > 0) return; evT = rand(180, 320);
  const pl = allPlayerShips(); if (!pl.length) return; const p = pl[(Math.random() * pl.length) | 0];
  const a = rand(0, TAU), r = rand(60, 140), x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
  if (terrainH(x, z) > -3) return;
  const roll = Math.random();
  if (roll < 0.45) { oCreate({ k: 'item', it: 'map', n: 1, d: { s: randomSpot(Math.random() < 0.3 ? 2 : 0) }, x, z, float: 1 }); netSend({ t: 'chat', text: '🍾 A bottle bobs in the swell — there’s paper inside.' }); }
  else if (roll < 0.8) { for (let i = 0; i < 4; i++) oCreate({ k: 'item', it: 'cargo', n: 1, x: x + rand(-8, 8), z: z + rand(-8, 8), float: 1 }); oCreate({ k: 'gold', x, z, v: Math.round(rand(300, 900)), float: 1 }); netSend({ t: 'chat', text: '📦 Flotsam from a lost merchantman drifts nearby.' }); }
  else { for (let i = 0; i < 3; i++) oCreate({ k: 'keg', x: x + rand(-15, 15), z: z + rand(-15, 15), float: 1 }); netSend({ t: 'chat', text: '⚠ Loose powder kegs adrift — mind your bow.' }); }
  if (!NET.on) feed('Something drifts on the swell nearby…');
}
/* tavern music: a little hornpipe when you're near the tables */
let musT = 0, musI = 0; const TUNE = [0, 4, 7, 12, 7, 4, 5, 9, 12, 9, 5, 2, 7, 11, 14, 11, 7, 4, 0, -5];
function updateMusic(dt) {
  musT -= dt; if (musT > 0 || !SEATS.length || !sfx.note) return; musT = 0.22;
  const p = playerOcean(); let d = 1e9; for (const s of SEATS) d = Math.min(d, Math.hypot(s.x - p.x, s.z - p.z));
  if (d > 40) return;
  const v = clamp(1 - d / 40, 0, 1) * 0.25; const n = TUNE[musI++ % TUNE.length]; sfx.note(293.66 * Math.pow(2, n / 12), v, 0.2, 0);
  if (musI % 2 === 0) sfx.note(146.83 * Math.pow(2, TUNE[(musI >> 2) % 4 * 5 % TUNE.length] / 12), v * 0.6, 0.4, 0);
}

/* ================= VOYAGE START ================= */
function beginVoyage() {
  if (state !== 'yard') return;
  if (!activeShip()) ME.active = ME.ships.find(s => !s.sunk).id;
  const I = ISLES[0]; PL.plat = null; PL.o.set(I.dockEnd.x, I.dockEnd.z);
  swapShip();
  // fan ships out along the harbour so captains spawn near each other without colliding
  const a = I.ta, slot = NET.id ? [...NET.id].reduce((h, c) => h * 31 + c.charCodeAt(0) >>> 0, 7) % 5 : 0;
  shipO.x += Math.cos(a) * 36 * slot; shipO.y += Math.sin(a) * 36 * slot;
  for (let k = 0; k < 10; k++) { let clash = false; for (const e of ENTS.values()) if (e.kind === 'peer' && Math.hypot(e.o.x - shipO.x, e.o.y - shipO.y) < 32) clash = true; if (!clash) break; shipO.x += Math.cos(a) * 36; shipO.y += Math.sin(a) * 36; }
  PL.plat = OWN; PL.l.set(0, QD, 12.35); PL.eyeY = QD; PL.mode = 'walk'; PL.alive = true;
  setMode('helm');
  fromPos.copy(camera.position); fromQuat.copy(camera.quaternion);
  state = 'intro'; introT = 0;
  if (!coarse) requestLock();
  setTimeout(() => sfx.bell(bell.pivot), 600);
  if (ME.firstRun) { ME.firstRun = 0; setTimeout(() => openNote(`<h2>Articles of the Gilded Wake</h2><p>You start with <b>${fmtG(START.gold)} gold</b>, real and heavy in your purse. Spend it on ships, guns and crew — but whatever you carry is dropped where you fall, and a sunk ship takes her strongbox down with her.</p><p>There is a treasure map in your pack (slot 16 — press <kbd>I</kbd>). Find the island, equip a shovel, and dig where the X lies.</p><p><b>At the helm:</b> A/D steer · W/S sails · click or Space fires the side you look at · Q/E port/starboard · 1–4 ammunition · R anchor · G grapple · B lower the jolly boat · F to walk.</p><p><b>On foot:</b> WASD · Shift run · Space jump (over the rail to swim) · C dive · 1–8 hotbar · click to use · right-click to block or aim · E interact · G carry · I inventory · Z sit · V wave · N dance.</p>`), 4200); }
  saveProfileSoon();
}

/* ================= LOOP ================= */
const camPos = new THREE.Vector3(), camQuat = new THREE.Quaternion(), fromPos = new THREE.Vector3(), fromQuat = new THREE.Quaternion();
let last = performance.now(), fpsAcc = 0, fpsN = 0, fpsShow = 0, ftEMA = 16.7, adaptT = 0, autoCheck = null, saveTick = 20, bountyT = 0;
const focusV = new THREE.Vector2();
function computeFocus() {
  if (window.__cam) { focusV.set(__cam.x, __cam.z); return; }
  if (state === 'title' || state === 'yard') { const I = ISLES[0]; focusV.set(I.dockEnd.x, I.dockEnd.z); return; }
  if ((PL.mode === 'helm' || PL.mode === 'cannon' && PL.gunEnt === OWN) && OWN.has) { focusV.copy(shipO); return; }
  const p = playerOcean(); focusV.set(p.x, p.z);
}
function tick(now) {
  requestAnimationFrame(tick);
  let dt = (now - last) / 1000; last = now; if (dt > 0.1) dt = 0.1; if (dt <= 0) return;
  clock += dt; frame++;
  seaT = NET.on ? (serverNow() / 1000) % 1800 : (seaT + dt) % 1800;
  // floating origin: the world shifts under the player so precision never degrades
  computeFocus(); lastOrg.copy(org); org.copy(focusV); dOrg.subVectors(org, lastOrg); if (dOrg.length() > 200) dOrg.set(0, 0);
  WORLD.position.set(-org.x, 0, -org.y);
  if (S.timeMode === 'sunset' && S.drift && state !== 'title') sunElev = Math.max(1.2, sunElev - dt * 0.006);
  updateEnvironment(dt); TIME.value = clock; WIND.value = clock;
  if (Math.abs(sunElev - envElev) > 0.6) updateEnv();
  const si = sunI.v, lightning = ENV.light || 0;
  sun.color.copy(sunCol); sun.intensity = (0.7 + 3.3 * sstep(-0.5, 9, sunElev)) * (1 - ENV.fog * 0.5 - ENV.storm * 0.4) + lightning * 5;
  hemi.intensity = 0.32 + 0.22 * si + ENV.night * 0.1 + lightning * 0.6; hemi.color.setRGB(0.58 + 0.2 * si, 0.56 + 0.18 * si, 0.72); hemi.groundColor.setRGB(0.22, 0.18, 0.12);
  skyU.uSunI.value = si; skyU.uTime.value = clock; waterU.uSunI.value = si; terrainMat.uniforms && terrainMat.uniforms.uSunI && (terrainMat.uniforms.uSunI.value = si);
  waterU.uSunColor.value.copy(sunCol).multiplyScalar(0.6 + 0.6 * si);
  renderer.toneMappingExposure = (0.92 + 0.2 * (1 - sstep(2, 10, sunElev))) * (1 + ENV.night * 0.35);
  // my ship
  const steering = PL.mode === 'helm' && state === 'play' && !OWN.sk && !chatOpen && !menuOpen && !uiOpen();
  const steer = steering ? clamp((keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + (coarse ? stick.x : 0), -1, 1) : 0;
  rowIn = steering && OWN.row ? (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 0.5 : 0) - (coarse ? stick.y : 0) : 0;
  const g = updateOwnShip(dt, steer);
  if (state !== 'title' && state !== 'yard') { updateOwnDamage(dt); shipContacts(dt); updateSinking(dt); }
  updateAnchorVisual(); updateJollyBoat(dt);
  if (OWN.has && state === 'play' && PL.plat !== OWN && !OWN.row && sailLvl > 0 && !OWN.sk) { setSail(0, true); say('With no hand at the helm, your ship spills her wind and drifts.', 3); }
  hostNpcs(dt); hostEvents(dt);
  updateRemoteShips(dt, clock, g);
  waterU.uTime.value = seaT; waterU.uOffset.value.copy(org); waterU.uHeading.value = heading; waterU.uSpeed.value = clamp(speed / 6, 0, 1);
  updateSails(clock, g); updateLoose(clock); updateProps(dt, clock); updateGulls(dt, clock); updateWildlife(dt, clock);
  shipSounds(dt, g);
  scene.updateMatrixWorld();
  updatePeerAvatars(dt, clock); updateNpcCrewVisuals(dt, clock); updateOwnCrew(dt, clock);
  if (basesDirty) rebuildBases();
  cullWorld(dt); updateObjects(dt, clock); updateSharks(dt, clock); updateThrown(dt); updateFlares(dt); updateDebris(dt);
  updateBalls(dt); updateParticles(dt);
  // ghost ships bring their own fog
  let gf = 0; for (const e of ENTS.values()) if (e.type === 'ghost' && !e.sk) gf = Math.max(gf, sstep(1400, 350, e.dist) * 0.85); ghostFog = gf;
  // camera
  if (state === 'title' || state === 'yard') titlePose(camPos, camQuat, clock);
  else {
    if (state === 'play') updatePlayer(dt);
    if (PL.mode === 'helm' && OWN.has) captainPose(camPos, camQuat, dt);
    else if (PL.mode === 'cannon' && PL.gunEnt) cannonPose(camPos, camQuat);
    else fpPose(camPos, camQuat, clock);
    if (state === 'intro') { introT += dt / 3.4; const e = introT < 1 ? (introT < 0.5 ? 4 * introT ** 3 : 1 - Math.pow(-2 * introT + 2, 3) / 2) : 1; camPos.lerpVectors(fromPos, camPos, e); camQuat.copy(fromQuat.clone().slerp(camQuat, e));
      if (introT >= 1) { state = 'play'; $('#hint').classList.add('on'); setTimeout(() => $('#hint').classList.remove('on'), 14000);
        setTimeout(() => say(`You command the ${SHIP_CLASSES[OWN.cls].n.toLowerCase()}. ${NET.on ? 'Other captains share these waters.' : 'Merchantmen, navy frigates and worse share these waters.'}`, 5), 1200); autoCheck = { t: 0, f: 0, acc: 0 }; } }
    else if (blendT < 1) { blendT = Math.min(1, blendT + dt / 0.9); const e = 1 - Math.pow(1 - blendT, 3); camPos.lerpVectors(blendFrom.p, camPos, e); camQuat.copy(blendFrom.q.clone().slerp(camQuat, e)); }
  }
  camera.position.copy(camPos); camera.quaternion.copy(camQuat);
  if (window.__cam) { const C = __cam; camera.position.set(C.x - org.x, C.y, C.z - org.y); camera.lookAt(C.tx - org.x, C.ty, C.tz - org.y); if (C.fov && camera.fov !== C.fov) { camera.fov = C.fov; camera.updateProjectionMatrix(); } }
  if (shake > 0) { shake = Math.max(0, shake - dt * 1.6); camera.position.x += rand(-1, 1) * shake * 0.05; camera.position.y += rand(-1, 1) * shake * 0.05; }
  const fovT = PL.mode === 'spy' && state === 'play' ? 13 : PL.ads === 2 ? 16 : PL.ads === 1 ? S.fov * 0.8 : zoomHeld && PL.mode === 'helm' ? 28 : S.fov;
  if (Math.abs(camera.fov - fovT) > 0.05) { camera.fov += (fovT - camera.fov) * Math.min(1, dt * 6); camera.updateProjectionMatrix(); }
  camera.updateMatrixWorld();
  { const uw = camera.position.y < waveH(camera.position.x, camera.position.z, seaT) - 0.04 ? 1 : 0; U_UNDER.value = uw; waterU.uUnder.value = uw; }
  updateViewModel(dt, clock);
  sky.position.copy(camera.position);
  const c = (PL.mode === 'helm' && OWN.has) ? ship.localToWorld(tmpV.set(0, 7, 0)) : tmpV.copy(camera.position);
  sun.target.position.copy(c); sun.position.copy(ENV.night > 0.5 ? moonDir : sunDir).multiplyScalar(90).add(c); sun.target.updateMatrixWorld();
  pU.uSun.value.copy(sunCol).multiplyScalar(sun.intensity * 0.25); pU.uAmb.value.setRGB(0.35, 0.3, 0.36).multiplyScalar(0.6 + 0.4 * si);
  pU.uScale.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  for (const m of hlMats) m.emissiveIntensity = 0.1 + 0.08 * Math.sin(clock * 6);
  if (state === 'play') { updateHover(dt); updateArc(); updateHUD(dt); updateMarks(); updateMusic(dt); }
  if (subT > 0) { subT -= dt; if (subT <= 0) $('#sub').classList.remove('on'); }
  if (PL.mode === 'helm' || PL.mode === 'nest') { const hh = PL.mode === 'helm' ? heading : PL.yaw + heading; const hd = ((-hh * 180 / Math.PI) % 360 + 360) % 360; $('#ctape').style.transform = `translateX(${-(hd / 15 + 24) * 40 + ($('#compass').clientWidth / 2) - 20}px)`; }
  // save, bounty
  if (saveT > 0) { saveT -= dt; if (saveT <= 0) saveProfileNow(); }
  saveTick -= dt; if (saveTick <= 0) { saveTick = 20; if (state === 'play') saveProfileNow(); }
  bountyT -= dt; if (bountyT <= 0) { bountyT = 1; ME.bounty = Math.round((ME.infamy || 0) * 150); }
  // network send
  NET.sendT -= dt; if (NET.on && NET.sendT <= 0 && state !== 'title') { NET.sendT = 1 / 12; sendState(); }
  netActT -= dt;
  NET.pingT -= dt; if (NET.on && NET.pingT <= 0) { NET.pingT = 8; netSend({ t: 'ping', c: Date.now() }); }
  if (renderer.shadowMap.enabled) renderer.shadowMap.needsUpdate = true;
  renderer.render(scene, camera);
  if (VM.visible || carryMesh.visible) { syncViewModelScene(); renderer.autoClear = false; renderer.clearDepth(); renderer.render(VMS, camera); renderer.autoClear = true; }
  const ft = dt * 1000; ftEMA += (ft - ftEMA) * 0.05; fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.5) { fpsShow = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; if (S.fps) $('#fps').innerHTML = `${fpsShow.toFixed(0)} fps<br>${(renderer.getPixelRatio()).toFixed(2)}× · ${S.resolved}<br>${renderer.info.render.calls} draws`; $('#fps').style.display = S.fps ? 'block' : 'none'; }
  if (S.adaptive && state !== 'title') { adaptT += dt; if (adaptT > 1.2) { adaptT = 0; if (ftEMA > 19 && dynScale > 0.55) { dynScale = Math.max(0.55, dynScale - 0.08); applySize(); } else if (ftEMA < 14.5 && dynScale < 1) { dynScale = Math.min(1, dynScale + 0.05); applySize(); } } }
  if (autoCheck && S.preset === 'auto') { autoCheck.t += dt; autoCheck.acc += dt; autoCheck.f++; if (autoCheck.t > 5) { const fps = autoCheck.f / autoCheck.acc; const i = ORDER.indexOf(S.resolved);
    if (fps < 45 && i > 0) { S.resolved = ORDER[i - 1]; save(); applyGraphics(); say(`Graphics eased to ${S.resolved} to keep things smooth. Change it any time with Esc.`, 4); autoCheck = { t: 0, f: 0, acc: 0 }; } else autoCheck = null; } }
  if (frame === 2) $('#loading').classList.add('gone');
}
function sendState() {
  const p = playerOcean();
  const L = OWN.rec && OWN.rec.look || {};
  const s = OWN.has && !(OWN.sk && OWN.sinkT > 13) ? [+shipO.x.toFixed(2), +shipO.y.toFixed(2), +heading.toFixed(4), +speed.toFixed(2), +sailF.toFixed(2), Math.round(OWN.hp), OWN.max, OWN.sk ? 1 : 0, Math.round(OWN.sail), OWN.fire ? 1 : 0, OWN.cls, L.sail || 0, L.hull || 0, L.flag || 0, OWN.st ? OWN.st.guns : 0] : 0;
  let pl;
  const pp = PL.plat === OWN ? 'p:' + NET.id : PL.plat === JBENT ? 'j:' + NET.id : PL.plat ? PL.plat.id : '';
  const it = curItem(), wpn = ITEMS[it] && ['melee', 'gun', 'tool'].includes(ITEMS[it].cat) ? it : '';
  if (pp) pl = [pp, +PL.l.x.toFixed(2), +(PL.mode === 'helm' && !OWN.row ? QD : PL.l.y).toFixed(2), +PL.l.z.toFixed(2), +PL.yaw.toFixed(3), 0, MODES.indexOf(PL.mode), wpn, PL.alive ? 1 : 0, netActT > 0 ? netActK : '', Math.round(PL.hp), PL.sit ? 'sit' : PL.emote];
  else pl = ['', +PL.o.x.toFixed(2), +PL.y.toFixed(2), +PL.o.y.toFixed(2), +PL.yaw.toFixed(3), 0, MODES.indexOf(PL.mode), wpn, PL.alive ? 1 : 0, netActT > 0 ? netActK : '', Math.round(PL.hp), PL.sit ? 'sit' : PL.emote];
  netSend({ t: 'st', x: +p.x.toFixed(1), z: +p.z.toFixed(1), s, j: JB.on ? [+JB.o.x.toFixed(2), +JB.o.y.toFixed(2), +JB.h.toFixed(3), +JB.sp.toFixed(2)] : 0, p: pl, b: ME.bounty || 0 });
}

/* ================= BOOT ================= */
$('#board').addEventListener('click', () => {
  const nm = $('#name').value.replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 18); if (nm) { ME.name = nm; try { localStorage.setItem('gw.name', nm); } catch (e) {} }
  netSend({ t: 'name', name: ME.name });
  sfx.init(); if (sfx.ctx && sfx.ctx.resume) sfx.ctx.resume();
  document.body.classList.add('playing'); $('#name').blur();
  state = 'yard'; openShipyard(true);
});
addEventListener('beforeunload', () => { if (state === 'play') saveProfileNow(); });
applyGraphics(); syncUI(); updateEnv();
buildPeerTemplate();
populate(); buildWreckMeshes();
ME.ships.forEach(s => { if (s.cls !== 'rowboat' && !SHIP_CLASSES[s.cls]) s.cls = 'sloop'; });
PL.plat = null; { const I = ISLES[0]; PL.o.set(I.dockEnd.x, I.dockEnd.z); PL.y = groundAt(I.dockEnd.x, I.dockEnd.z, 99); org.set(I.dockEnd.x, I.dockEnd.z); lastOrg.copy(org); }
drawHotbar();
connect();
requestAnimationFrame(t => { last = t; tick(t); });
window.__gw = { get state() { return state; }, PL, OWN, ME, S, NET, PEERS, ENTS, NPCS, OBJS, setMode, setSail, fireBroadside, invAdd, get heading() { return heading; }, set heading(v) { heading = v; }, shipO, CAM, renderer, beginVoyage, openShipyard, closeUI, damageOwn, startSink, hurtPlayer, lowerJollyBoat, climbNest, manCannon, throwGrapple, toggleAnchor, playerOcean, ISLES, SPOTS, keys, sendState };
