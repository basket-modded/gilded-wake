// The Gilded Wake — world: islands with real terrain, vegetation, settlements, wrecks,
// buried treasure spots, wildlife, and the shared day/night + weather cycle.
const WORLD = new THREE.Group(); scene.add(WORLD);           // everything fixed to the ocean lives here (ocean coords)
function srng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function h2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vn2(x, z) { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  return lerp(lerp(h2(ix, iz), h2(ix + 1, iz), ux), lerp(h2(ix, iz + 1), h2(ix + 1, iz + 1), ux), uz); }
function fbm2(x, z) { return vn2(x, z) * 0.55 + vn2(x * 2.1 + 5.2, z * 2.1 + 1.3) * 0.3 + vn2(x * 4.3 + 9.1, z * 4.3 + 7.7) * 0.15; }

const ISLES = [
  { name: 'Port Saltwren', x: 60, z: -560, R: 270, peak: 26, kind: 'port', shops: ['tavern', 'armory', 'chandler', 'trader'], yard: 1 },
  { name: 'Gull’s Rest', x: -500, z: -150, R: 95, peak: 9, kind: 'wild' },
  { name: 'Saint Brannoc', x: -950, z: -1150, R: 430, peak: 75, kind: 'jungle' },
  { name: 'Skull Key', x: 1350, z: -700, R: 170, peak: 42, kind: 'mystery' },
  { name: 'Smuggler’s Cove', x: 950, z: 640, R: 210, peak: 30, kind: 'cove', shops: ['fence', 'tavern'] },
  { name: 'Twin Palms', x: 360, z: 400, R: 48, peak: 4, kind: 'wild' },
  { name: 'Wrecker’s Reef', x: -720, z: 700, R: 140, peak: 8, kind: 'reef' },
  { name: 'Haven', x: -1650, z: 220, R: 310, peak: 48, kind: 'port', shops: ['tavern', 'chandler', 'trader', 'armory'], yard: 1 },
  { name: 'Lonely Isle', x: 2250, z: 950, R: 75, peak: 12, kind: 'wild' },
  { name: 'Emerald Jungle', x: 100, z: 2300, R: 520, peak: 95, kind: 'jungle' },
];
ISLES.forEach((I, i) => {
  I.i = i; I.r = srng(1000 + i * 77); I.s1 = I.r() * 9; I.s2 = I.r() * 9; I.s3 = I.r() * 9;
  I.rough = I.kind === 'jungle' ? 14 : I.kind === 'reef' ? 2 : 7;
  const a = Math.atan2(-I.z, -I.x) + (I.r() - 0.5) * 0.6;           // town faces the open sea toward the centre
  I.ta = a; I.tx = I.x + Math.cos(a) * I.R * 0.62; I.tz = I.z + Math.sin(a) * I.R * 0.62; I.tR = I.kind === 'port' || I.kind === 'cove' ? 70 : 0;
});
function isleRaw(I, x, z) {
  const dx = x - I.x, dz = z - I.z, r = Math.hypot(dx, dz) / I.R;
  if (r > 1.6) return -40;
  const a = Math.atan2(dz, dx);
  const edge = 1 + 0.2 * Math.sin(3 * a + I.s1) + 0.11 * Math.sin(5 * a + I.s2) + 0.05 * Math.sin(9 * a + I.s3);
  const t = 1 - r / edge;
  let h;
  if (t < 0) h = -1.5 + t * 70;
  else h = -1.5 + 3.6 * sstep(0, 0.16, t) + I.peak * Math.pow(sstep(0.1, 1, t), 1.5) + (fbm2(x * 0.018, z * 0.018) - 0.45) * I.rough * sstep(0.08, 0.45, t);
  if (I.tR) { const d = Math.hypot(x - I.tx, z - I.tz); const w = sstep(I.tR, I.tR * 0.55, d); h = lerp(h, Math.max(2.4, Math.min(h, 3.2)), w); }
  return Math.max(h, -40);
}
function nearIsle(x, z) { let best = null, bd = 1e9; for (const I of ISLES) { const d = Math.hypot(x - I.x, z - I.z) - I.R * 1.5; if (d < bd) { bd = d; best = I; } } return bd < 0 ? best : null; }
function terrainH(x, z) { const I = nearIsle(x, z); return I ? isleRaw(I, x, z) : -40; }

/* ---- terrain meshes ---- */
const terrainMat = new THREE.ShaderMaterial({
  uniforms: { uSunDir: { value: sunDir }, uSunI: { value: 1 }, uNight: U_NIGHT, uFogW: U_FOG, uMoonDir: U_MOON, uSunCol: { value: sunCol }, uLightI: { value: 1 } },
  vertexShader: `attribute vec3 color;varying vec3 vC,vW,vN;void main(){vC=color;vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*w;}`,
  fragmentShader: SKY_GLSL + `uniform vec3 uSunCol;uniform float uLightI;varying vec3 vC,vW,vN;void main(){
    vec3 n=normalize(vN);vec3 V=cameraPosition-vW;float d=length(V);V/=d;
    float sl=max(dot(n,uSunDir),0.0)*uLightI*(1.0-uNight);float ml=max(dot(n,uMoonDir),0.0)*0.35*uNight;
    vec3 amb=mix(vec3(0.32,0.3,0.38),vec3(0.05,0.06,0.1),uNight)*(0.6+0.4*n.y);
    vec3 col=vC*(amb+uSunCol*sl*0.9+vec3(0.55,0.6,0.8)*ml);
    if(vW.y<0.0)col=mix(col,vec3(0.02,0.08,0.1)*(1.0-0.7*uNight),clamp(-vW.y/9.0,0.0,0.85));
    vec3 hz=skyBase(normalize(vec3(-V.x,0.03,-V.z)));
    float fog=1.0-exp(-d*(0.00028+uFogW*0.006));
    gl_FragColor=vec4(mix(col,hz,clamp(fog*1.15,0.0,0.96)),1.0);` + TAIL + `}`
});
for (const I of ISLES) {
  const span = I.R * 1.55, N = clamp(Math.round(span * 2 / 6.5), 40, 150);
  const g = new THREE.PlaneGeometry(span * 2, span * 2, N, N); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  for (let k = 0; k < p.count; k++) { const x = p.getX(k) + I.x, z = p.getZ(k) + I.z; p.setY(k, isleRaw(I, x, z)); }
  g.computeVertexNormals();
  const nn = g.attributes.normal;
  for (let k = 0; k < p.count; k++) {
    const h = p.getY(k), ny = nn.getY(k), x = p.getX(k) + I.x, z = p.getZ(k) + I.z, v = vn2(x * 0.05, z * 0.05);
    let c;
    if (h < -0.4) c = [lerp(0.62, 0.18, clamp(-h / 20, 0, 1)), lerp(0.54, 0.3, clamp(-h / 20, 0, 1)), lerp(0.4, 0.3, clamp(-h / 20, 0, 1))];
    else if (h < 2.3) c = [0.88 - v * 0.06, 0.78 - v * 0.06, 0.56 - v * 0.05];
    else if (ny < 0.72 || h > I.peak * 0.78 + 6) c = [0.44 + v * 0.08, 0.41 + v * 0.06, 0.38 + v * 0.05];
    else if (I.kind === 'mystery') c = [0.3 + v * 0.1, 0.33 + v * 0.06, 0.22];
    else c = [0.2 + v * 0.12, 0.38 + v * 0.14, 0.14 + v * 0.05];
    if (h > 2.3 && h < 3.6) { const m = (h - 2.3) / 1.3; c = c.map((q, j) => lerp([0.8, 0.72, 0.5][j], q, m)); }
    col[k * 3] = c[0]; col[k * 3 + 1] = c[1]; col[k * 3 + 2] = c[2];
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, terrainMat); m.position.set(I.x, 0, I.z); WORLD.add(m); I.mesh = m;
}

/* ---- colliders and walkable platforms (ocean coords) ---- */
const TREES = [];       // {x,z,r}
const OBB = [];         // blocking boxes {x,z,a,hx,hz,y0,y1}
const PLATS = [];       // walkable tops {x,z,a,hx,hz,top}
function inOBB(b, x, z, pad = 0) { const c = Math.cos(-b.a), s = Math.sin(-b.a), dx = x - b.x, dz = z - b.z, lx = dx * c - dz * s, lz = dx * s + dz * c; return Math.abs(lx) < b.hx + pad && Math.abs(lz) < b.hz + pad; }
function groundAt(x, z, y = 999) {
  let h = terrainH(x, z);
  for (const p of PLATS) if (p.top <= y + 0.65 && p.top > h && inOBB(p, x, z)) h = p.top;
  if (typeof basePieceFloor === 'function') h = Math.max(h, basePieceFloor(x, z, y));
  return h;
}
function blockedWorld(x, z, y, r = 0.3) {
  for (const t of TREES) { const dx = x - t.x, dz = z - t.z; if (dx * dx + dz * dz < (t.r + r) * (t.r + r) && Math.abs(dx) < 3) return true; }
  for (const b of OBB) if (y + 1.5 > b.y0 && y < b.y1 && inOBB(b, x, z, r)) return true;
  if (typeof basePieceBlock === 'function' && basePieceBlock(x, z, y, r)) return true;
  return false;
}

/* ---- vegetation (instanced) ---- */
function palmGeo() {
  const L = [];
  for (let i = 0; i < 6; i++) { const y = i * 1.25; const g = new THREE.CylinderGeometry(0.17 - i * 0.012, 0.2 - i * 0.012, 1.3, 7); g.translate(Math.pow(i / 6, 2) * 1.2, y + 0.6, 0); L.push(g); }
  const trunk = merge(L); trunk.computeVertexNormals();
  const F = [], cols = [];
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * TAU, pos = [];
    for (let j = 0; j <= 6; j++) { const t = j / 6, r = t * 3.4, y = 7.6 + Math.sin(t * Math.PI * 0.8) * 0.9 - t * t * 2.2, w = 0.55 * Math.sin(t * Math.PI) + 0.05;
      const cx = 1.2 + Math.cos(a) * r, cz = Math.sin(a) * r, px = -Math.sin(a) * w, pz = Math.cos(a) * w;
      pos.push([cx + px, y, cz + pz], [cx - px, y - 0.15 * t, cz - pz]); }
    const gp = [], idx = [];
    pos.forEach(v => gp.push(...v));
    for (let j = 0; j < 6; j++) { const b = j * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(gp.length / 3 * 2).fill(0), 2)); g.setIndex(idx); g.computeVertexNormals(); F.push(g);
  }
  return [trunk, merge(F)];
}
const [PALM_T, PALM_F] = palmGeo();
const vegMats = {
  trunk: new THREE.MeshStandardMaterial({ color: 0x6b5236, roughness: 1 }),
  frond: new THREE.MeshStandardMaterial({ color: 0x3f7a2e, roughness: 0.9, side: THREE.DoubleSide }),
  bush: new THREE.MeshStandardMaterial({ color: 0x2f5e24, roughness: 1, flatShading: true }),
  rock: new THREE.MeshStandardMaterial({ color: 0x77716a, roughness: 1, flatShading: true }),
};
const vegPos = { palm: [], bush: [], rock: [] };
for (const I of ISLES) {
  const r = srng(5000 + I.i * 31);
  const nPalm = Math.round(I.R * (I.kind === 'jungle' ? 1.1 : I.kind === 'mystery' ? 0.25 : 0.6)), nBush = Math.round(I.R * (I.kind === 'jungle' ? 1.4 : 0.5)), nRock = Math.round(I.R * 0.15) + 3;
  const pick = (minH, maxH, avoidTown) => { for (let t = 0; t < 30; t++) { const a = r() * TAU, d = Math.sqrt(r()) * I.R * 1.15, x = I.x + Math.cos(a) * d, z = I.z + Math.sin(a) * d, h = isleRaw(I, x, z);
    if (h > minH && h < maxH && (!avoidTown || !I.tR || Math.hypot(x - I.tx, z - I.tz) > I.tR * 0.9)) return [x, h, z]; } return null; };
  for (let k = 0; k < nPalm; k++) { const p = pick(1.6, I.peak * 0.7 + 8, true); if (p) { vegPos.palm.push([...p, r() * TAU, 0.8 + r() * 0.6]); TREES.push({ x: p[0], z: p[2], r: 0.35 }); } }
  for (let k = 0; k < nBush; k++) { const p = pick(2.5, I.peak + 20, true); if (p) vegPos.bush.push([...p, r() * TAU, 0.8 + r() * 1.8]); }
  for (let k = 0; k < nRock; k++) { const p = pick(-3, I.peak + 30, true); if (p) { const s = 0.8 + r() * (I.kind === 'mystery' ? 6 : 3); vegPos.rock.push([...p, r() * TAU, s]); if (s > 1.5) TREES.push({ x: p[0], z: p[2], r: s * 0.8 }); } }
  I.landmarks = vegPos.rock.slice(-nRock).filter(v => v[4] > 2).map(v => ({ x: v[0], z: v[2], n: 'the great rock' }));
}
function instanced(geo, mat, list, f) {
  const im = new THREE.InstancedMesh(geo, mat, list.length); const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), v = new THREE.Vector3();
  list.forEach((p, i) => { f(p, e, s); m.compose(v.set(p[0], p[1], p[2]), q.setFromEuler(e), s); im.setMatrixAt(i, m); });
  im.frustumCulled = false; im.castShadow = false; WORLD.add(im); return im;
}
instanced(PALM_T, vegMats.trunk, vegPos.palm, (p, e, s) => { e.set(0, p[3], 0); s.setScalar(p[4]); });
instanced(PALM_F, vegMats.frond, vegPos.palm, (p, e, s) => { e.set(0, p[3], 0); s.setScalar(p[4]); });
instanced(new THREE.IcosahedronGeometry(1, 0), vegMats.bush, vegPos.bush, (p, e, s) => { e.set(0, p[3], 0); s.set(p[4] * 1.3, p[4] * 0.8, p[4]); });
instanced(new THREE.DodecahedronGeometry(1, 0), vegMats.rock, vegPos.rock, (p, e, s) => { e.set(p[3], p[3] * 2, 0); s.set(p[4], p[4] * 0.7, p[4] * 0.9); });

/* ---- buildings, docks, NPC keepers ---- */
const WPROX = [];  // interactable proxies in the world
function wProxy(parent, w, h, d, x, y, z, def) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), proxyMat); m.position.set(x, y, z); m.userData.inter = def; parent.add(m); WPROX.push(m); def.proxy = m; return def; }
const signMat = t => { const [c, g] = cnv(512, 128); g.fillStyle = '#3b2616'; g.fillRect(0, 0, 512, 128); g.strokeStyle = '#c9a25a'; g.lineWidth = 8; g.strokeRect(6, 6, 500, 116); g.fillStyle = '#f2dfb4'; g.font = 'italic 52px "IM Fell English", Georgia, serif'; g.textAlign = 'center'; g.fillText(t, 256, 84); return new THREE.MeshStandardMaterial({ map: mkTex(c, false), roughness: 0.8 }); };
const BLD = { wall: new THREE.MeshStandardMaterial({ color: 0xd8c7a2, roughness: 0.95 }), roof: new THREE.MeshStandardMaterial({ color: 0x8a3b26, roughness: 0.9 }), wood: MAT.dark, plank: MAT.deck };
const keepers = [];
function townPiece(I, lx, lz, la, fn) { const g = new THREE.Group(); const c = Math.cos(I.ta), s = Math.sin(I.ta);
  // local frame: +x = toward sea (out along ta), +z = along the shore
  const x = I.tx + lx * c - lz * s, z = I.tz + lx * s + lz * c; g.position.set(x, 0, z); g.rotation.y = -I.ta + (la || 0); WORLD.add(g); fn(g, x, z, -I.ta + (la || 0)); return g; }
function building(I, lx, lz, w, d, hgt, label) {
  return townPiece(I, lx, lz, 0, (g, x, z, a) => {
    const y = groundAt(x, z);
    const L = [xf(box(w, hgt, d), 0, y + hgt / 2, 0)];
    g.add(meshOf(L, BLD.wall, false, false));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w, d) * 0.56, hgt * 0.6, 4), BLD.roof); roof.position.y = y + hgt + hgt * 0.3; roof.rotation.y = Math.PI / 4; roof.scale.set(w / Math.hypot(w, d) * 1.45, 1, d / Math.hypot(w, d) * 1.45); g.add(roof);
    const door = new THREE.Mesh(box(1.4, 2.3, 0.1), MAT.med); door.position.set(w / 2 + 0.06, y + 1.15, 0); door.rotation.y = Math.PI / 2; g.add(door);
    if (label) { const sg = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), signMat(label)); sg.position.set(w / 2 + 0.12, y + hgt - 0.6, 0); sg.rotation.y = Math.PI / 2; g.add(sg); }
    OBB.push({ x, z, a: -a, hx: w / 2, hz: d / 2, y0: y - 1, y1: y + hgt + 2 });
  });
}
function stall(I, lx, lz, shop, label) {
  return townPiece(I, lx, lz, 0, (g, x, z, a) => {
    const y = groundAt(x, z);
    g.add(meshOf([xf(box(3.2, 1.0, 1.0), 0, y + 0.5, 0), xf(box(0.15, 2.8, 0.15), -1.5, y + 1.4, -1.2), xf(box(0.15, 2.8, 0.15), 1.5, y + 1.4, -1.2), xf(box(0.15, 2.8, 0.15), -1.5, y + 1.4, 1.2), xf(box(0.15, 2.8, 0.15), 1.5, y + 1.4, 1.2)], MAT.med, false, false));
    const aw = new THREE.Mesh(box(3.6, 0.1, 3.0), new THREE.MeshStandardMaterial({ color: [0xb33a2a, 0x2f5f8a, 0xd9a640, 0x3e6b45][keepers.length % 4], roughness: 0.9 })); aw.position.set(0, y + 2.85, 0); aw.rotation.z = 0.08; g.add(aw);
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), signMat(label)); sg.position.set(0, y + 3.3, 1.52); g.add(sg);
    const k = makeAvatar({ coat: ['#7a2e1f', '#2c3e5c', '#5a4a2a', '#3c5a33', '#4b2b4f'][keepers.length % 5], hat: keepers.length % 2 }); k.root.position.set(0, y, -0.9); g.add(k.root);
    keepers.push({ av: k, t: Math.random() * 9 });
    OBB.push({ x, z, a: -a, hx: 1.7, hz: 0.8, y0: y - 1, y1: y + 3 });
    wProxy(g, 3.4, 2.4, 2.6, 0, y + 1.2, 0, { label: () => label, sub: 'trade', act: () => openShop(shop) });
  });
}
function dock(I) {
  // a pier running out to sea from the town
  let len = 30; for (; len < 140; len += 4) { const c = Math.cos(I.ta), s = Math.sin(I.ta); if (terrainH(I.tx + c * (I.tR * 0.5 + len), I.tz + s * (I.tR * 0.5 + len)) < -5) break; }
  len += 26;
  return townPiece(I, I.tR * 0.5 + len / 2 - 6, 0, 0, (g, x, z, a) => {
    const top = 2.0;
    const L = [xf(box(len, 0.25, 5), 0, top - 0.12, 0)];
    for (let i = -len / 2; i <= len / 2; i += 4) for (const sz of [-2.3, 2.3]) L.push(xf(cyl(0.18, 0.2, 9, 6), i, top - 4.5, sz));
    g.add(meshOf(L, MAT.deck, false, false));
    PLATS.push({ x, z, a: -a, hx: len / 2, hz: 2.5, top });
    I.dockEnd = { x: x + Math.cos(I.ta) * len / 2, z: z + Math.sin(I.ta) * len / 2 };
  });
}
function lampPost(I, lx, lz) { townPiece(I, lx, lz, 0, (g, x, z) => { const y = groundAt(x, z); g.add(meshOf([xf(cyl(0.07, 0.09, 3.2, 6), 0, y + 1.6, 0)], MAT.iron, false, false));
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffa850, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s.position.set(0, y + 3.3, 0); s.scale.setScalar(2.2); g.add(s); NIGHT_GLOWS.push(s); }); }
const NIGHT_GLOWS = [];
function campfire(x, z, parent = WORLD) {
  const g = new THREE.Group(); const y = groundAt(x, z); g.position.set(x, y, z); parent.add(g);
  const L = []; for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; L.push(xf(cyl(0.08, 0.1, 1.1, 5), Math.cos(a) * 0.25, 0.15, Math.sin(a) * 0.25, 0, -a, Math.PI / 2.6)); }
  for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; L.push(xf(new THREE.DodecahedronGeometry(0.16, 0), Math.cos(a) * 0.65, 0.08, Math.sin(a) * 0.65)); }
  g.add(meshOf(L, MAT.dark, false, false));
  const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff8a30, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); f.position.y = 0.6; f.scale.set(1.2, 1.8, 1); g.add(f);
  FIRES.push({ g, f, x, z, y });
  wProxy(g, 1.8, 1.2, 1.8, 0, 0.5, 0, { label: () => 'Campfire', sub: () => cookable() ? 'cook your fish' : 'warm yourself · sit with Z', act: () => cookAll() });
  return g;
}
const FIRES = [];
function skeleton(x, z, rot) {
  const g = new THREE.Group(); const y = groundAt(x, z); g.position.set(x, y + 0.08, z); g.rotation.y = rot; WORLD.add(g);
  const bone = new THREE.MeshStandardMaterial({ color: 0xe8e0c8, roughness: 0.8 });
  const L = [xf(new THREE.SphereGeometry(0.16, 8, 6), 0, 0.1, -0.85), xf(box(0.36, 0.08, 0.5), 0, 0.05, -0.35)];
  for (let i = 0; i < 5; i++) L.push(xf(box(0.42, 0.03, 0.03), 0, 0.08, -0.55 + i * 0.09));
  for (const sx of [-0.12, 0.12]) { L.push(xf(cyl(0.025, 0.025, 0.85, 4), sx, 0.04, 0.35, Math.PI / 2, 0, 0)); L.push(xf(cyl(0.022, 0.022, 0.6, 4), sx * 3, 0.04, -0.3, Math.PI / 2, 0.5 * Math.sign(sx), 0)); }
  g.add(meshOf(L, bone, false, false));
  const def = { looted: false, label: () => def.looted ? 'Picked-over bones' : 'Search the skeleton', sub: 'someone didn’t make it', act: () => { if (def.looted) return; def.looted = true; lootRoll('camp', g); } };
  wProxy(g, 1, 0.6, 2, 0, 0.3, -0.3, def);
}
function tent(x, z, rot) { const y = groundAt(x, z); const m = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2.2, 4), new THREE.MeshStandardMaterial({ color: 0xbfae8a, roughness: 1, side: THREE.DoubleSide })); m.position.set(x, y + 1.1, z); m.rotation.y = rot; WORLD.add(m); TREES.push({ x, z, r: 1.1 }); }
function crateAt(x, z, label = 'Abandoned supplies') {
  const y = groundAt(x, z); const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.9), MAT.crate); m.position.set(x, y + 0.4, z); m.rotation.y = Math.random() * 3; WORLD.add(m);
  const def = { looted: false, label: () => def.looted ? 'Empty crate' : label, act: () => { if (def.looted) return; def.looted = true; lootRoll('crate', m); setTimeout(() => def.looted = false, 600000); } };
  wProxy(m, 1, 1, 1, 0, 0, 0, def); TREES.push({ x, z, r: 0.6 });
}
const WRECKS = [];
function wreck(x, z, rot, tilt = 0.45, sink = 3) {
  const g = new THREE.Group(); g.position.set(x, -sink, z); g.rotation.set(0.12, rot, tilt); WORLD.add(g);
  WRECKS.push({ g, x, z, rot, tilt, sink });
  const chestP = new THREE.Group(); chestP.position.set(1.6, DECK + 0.4, 9); g.add(chestP);
  const c = new THREE.Mesh(box(1, 0.6, 0.6), MAT.med); chestP.add(c);
  const def = { looted: false, label: () => def.looted ? 'An empty sea chest' : 'Waterlogged sea chest', sub: 'from a ship long lost', act: () => { if (def.looted) return; def.looted = true; lootRoll('wreck', chestP); setTimeout(() => def.looted = false, 900000); } };
  wProxy(chestP, 1.2, 1, 1, 0, 0, 0, def);
}
function buildWreckMeshes() { if (!PEER_T) return; for (const W of WRECKS) for (const [mat, geo] of PEER_T.parts) { if (mat === MAT.sail || mat === MAT.glass) continue; const m = new THREE.Mesh(geo, mat); W.g.add(m); } }

/* ---- dig spots: buried treasure ---- */
const SPOTS = [];
for (const I of ISLES) {
  const r = srng(9000 + I.i * 13); const n = I.kind === 'jungle' ? 7 : I.kind === 'mystery' ? 3 : I.kind === 'port' ? 2 : 4;
  for (let k = 0; k < n; k++) for (let t = 0; t < 40; t++) {
    const a = r() * TAU, d = Math.sqrt(r()) * I.R * 0.9, x = I.x + Math.cos(a) * d, z = I.z + Math.sin(a) * d, h = isleRaw(I, x, z);
    if (h > 2.4 && h < I.peak * 0.8 + 5 && (!I.tR || Math.hypot(x - I.tx, z - I.tz) > I.tR)) { SPOTS.push({ id: I.i + ':' + k, isl: I.i, x, z, tier: I.kind === 'mystery' ? 3 : I.kind === 'jungle' ? 2 : r() < 0.25 ? 2 : 1 }); break; }
  }
}
// an underwater hoard off Wrecker's Reef
SPOTS.push({ id: 'reef:deep', isl: 6, x: ISLES[6].x + ISLES[6].R * 1.12, z: ISLES[6].z, tier: 2, under: true });

/* ---- populate islands ---- */
function populate() {
  for (const I of ISLES) {
    const r = srng(7000 + I.i);
    if (I.tR) {
      dock(I);
      let k = 0; for (const sh of I.shops || []) { stall(I, -6 - (k % 2) * 14, -22 + Math.floor(k / 2) * 0 + k * 12, sh, SHOPS[sh].n.split(' — ')[0]); k++; }
      building(I, -26, -18, 10, 8, 4.5, I.kind === 'cove' ? 'The Black Gull' : 'The Drowned Gull');
      building(I, -30, 14, 8, 7, 4, '');
      if (I.yard) { stall(I, 4, 26, 'yard', 'Shipwright'); }
      for (const [lx, lz] of [[2, -14], [2, 14], [-14, 0], [-40, 0]]) lampPost(I, lx, lz);
      townPiece(I, -14, -8, 0, (g, x, z) => campfire(x, z));
      // tavern tables
      for (let t = 0; t < 3; t++) townPiece(I, -16, -26 + t * 5, 0, (g, x, z) => { const y = groundAt(x, z); g.add(meshOf([xf(box(1.6, 0.08, 1), 0, y + 0.8, 0), xf(cyl(0.08, 0.1, 0.8, 6), 0, y + 0.4, 0), xf(box(1.6, 0.06, 0.35), 0, y + 0.45, -0.9), xf(box(1.6, 0.06, 0.35), 0, y + 0.45, 0.9)], MAT.med, false, false)); SEATS.push({ x, z, y: y + 0.45 }); });
    }
    const camps = I.kind === 'jungle' ? 3 : I.kind === 'port' ? 0 : 1;
    for (let c = 0; c < camps; c++) for (let t = 0; t < 30; t++) {
      const a = r() * TAU, d = Math.sqrt(r()) * I.R * 0.75, x = I.x + Math.cos(a) * d, z = I.z + Math.sin(a) * d, h = isleRaw(I, x, z);
      if (h > 2.4 && h < 20) { campfire(x, z); tent(x + 3, z + 1.5, r() * 3); skeleton(x - 2.5, z + 2, r() * 6); crateAt(x + 1.5, z - 2.5); break; }
    }
    if (I.kind === 'reef' || I.kind === 'wild' && I.R > 80 || I.kind === 'mystery') {
      const a = r() * TAU; wreck(I.x + Math.cos(a) * I.R * 1.02, I.z + Math.sin(a) * I.R * 1.02, r() * 6, 0.35 + r() * 0.3, 2.5 + r() * 1.5);
      if (I.kind === 'reef') { const b = a + 2; wreck(I.x + Math.cos(b) * I.R * 0.98, I.z + Math.sin(b) * I.R * 0.98, r() * 6, -0.5, 2.2); }
    }
    if (I.kind === 'mystery') { // a skull-shaped rock watching the sea
      const sk = new THREE.Mesh(new THREE.SphereGeometry(14, 16, 12), vegMats.rock); const x = I.x - I.R * 0.2, z = I.z; sk.position.set(x, isleRaw(I, x, z) + 9, z); sk.scale.set(1, 0.85, 0.9); WORLD.add(sk);
      for (const ex of [-5, 5]) { const e = new THREE.Mesh(new THREE.SphereGeometry(3.4, 10, 8), new THREE.MeshBasicMaterial({ color: 0x050403 })); e.position.set(x + ex, sk.position.y + 2, z + 11.6); WORLD.add(e); }
      TREES.push({ x, z, r: 14 });
      I.landmarks.unshift({ x, z, n: 'the skull rock' });
    }
    // some driftwood and crates on beaches
    for (let k = 0; k < Math.round(I.R / 60); k++) { const a = r() * TAU, x = I.x + Math.cos(a) * I.R * 0.93, z = I.z + Math.sin(a) * I.R * 0.93; if (terrainH(x, z) > 0.5) crateAt(x, z, 'Washed-up crate'); }
  }
  buildCaves();
}
const SEATS = [];

/* ---- wildlife: crabs and parrots ---- */
const CRABN = 70;
const crabGeo = (() => { const L = [xf(new THREE.SphereGeometry(0.16, 6, 4), 0, 0.08, 0, 0, 0, 0, 1.4, 0.5, 1)]; for (const s of [-1, 1]) { L.push(xf(box(0.05, 0.05, 0.22), s * 0.2, 0.05, 0.08, 0, s * 0.5, 0)); for (let i = 0; i < 3; i++) L.push(xf(box(0.18, 0.025, 0.025), s * 0.2, 0.03, -0.08 + i * 0.07)); } return merge(L); })();
const crabs = new THREE.InstancedMesh(crabGeo, new THREE.MeshStandardMaterial({ color: 0xc2452a, roughness: 0.6 }), CRABN); crabs.frustumCulled = false; WORLD.add(crabs);
const crabState = [];
{ const r = srng(42); for (let i = 0; i < CRABN; i++) { const I = ISLES[i % ISLES.length]; for (let t = 0; t < 30; t++) { const a = r() * TAU, x = I.x + Math.cos(a) * I.R * 0.97, z = I.z + Math.sin(a) * I.R * 0.97, h = isleRaw(I, x, z); if (h > 0.3 && h < 2.4) { crabState.push({ x, z, a: r() * TAU, t: r() * 5, I }); break; } } if (crabState.length <= i) crabState.push({ x: I.x, z: I.z, a: 0, t: 0, I, dead: 1 }); } }
const parrotMat = new THREE.MeshStandardMaterial({ color: 0xd8342a, roughness: 0.6, side: THREE.DoubleSide });
const PARN = 12;
const parB = new THREE.InstancedMesh(gBody, parrotMat, PARN), parL = new THREE.InstancedMesh(wingG(-0.6), parrotMat, PARN), parR = new THREE.InstancedMesh(wingG(0.6), parrotMat, PARN);
for (const m of [parB, parL, parR]) { m.frustumCulled = false; WORLD.add(m); }
const parrots = []; for (let i = 0; i < PARN; i++) { const I = ISLES.filter(I => I.tR)[i % 3] || ISLES[0]; parrots.push({ I, th: Math.random() * TAU, r: 20 + Math.random() * 40, h: 12 + Math.random() * 10, w: (0.3 + Math.random() * 0.3) * (i % 2 ? 1 : -1) }); }
const _m4 = new THREE.Matrix4(), _m5 = new THREE.Matrix4(), _q4 = new THREE.Quaternion(), _e4 = new THREE.Euler(), _v4 = new THREE.Vector3(), _s4 = new THREE.Vector3(1, 1, 1);
function updateWildlife(dt, t) {
  for (let i = 0; i < CRABN; i++) {
    const c = crabState[i];
    if (!c.dead && Math.hypot(c.x - org.x, c.z - org.y) < 300) {
      c.t -= dt; if (c.t < 0) { c.t = 0.5 + Math.random() * 3; c.a += (Math.random() - 0.5) * 2.5; c.mv = Math.random() < 0.6; }
      if (c.mv) { const nx = c.x + Math.cos(c.a) * dt * 0.9, nz = c.z + Math.sin(c.a) * dt * 0.9, h = terrainH(nx, nz); if (h > 0.2 && h < 3) { c.x = nx; c.z = nz; } else c.a += 2; }
      if (PL.mode !== 'helm' && Math.hypot(c.x - PL.o.x, c.z - PL.o.y) < 2.5) { c.a = Math.atan2(c.z - PL.o.y, c.x - PL.o.x); c.mv = true; c.t = 1; }
    }
    _e4.set(0, -c.a + Math.PI / 2, 0); _m4.compose(_v4.set(c.x, terrainH(c.x, c.z) + 0.02, c.z), _q4.setFromEuler(_e4), _s4.set(c.dead ? 0 : 1, 1, 1)); crabs.setMatrixAt(i, _m4);
  }
  crabs.instanceMatrix.needsUpdate = true;
  for (let i = 0; i < PARN; i++) {
    const p = parrots[i]; p.th += p.w * dt; const x = p.I.tx + Math.cos(p.th) * p.r, z = p.I.tz + Math.sin(p.th) * p.r, y = p.h + Math.sin(t + i) * 2 + terrainH(p.I.tx, p.I.tz);
    const dx = -Math.sin(p.th) * Math.sign(p.w), dz = Math.cos(p.th) * Math.sign(p.w);
    _e4.set(0, Math.atan2(dx, dz), -Math.sign(p.w) * 0.4, 'YXZ'); _m4.compose(_v4.set(x, y, z), _q4.setFromEuler(_e4), _s4.set(0.7, 0.7, 0.7)); parB.setMatrixAt(i, _m4);
    const wa = Math.sin(t * 14 + i) * 0.8; _m5.makeRotationZ(wa); parL.setMatrixAt(i, _m4.clone().multiply(_m5)); _m5.makeRotationZ(-wa); parR.setMatrixAt(i, _m4.clone().multiply(_m5));
  }
  parB.instanceMatrix.needsUpdate = parL.instanceMatrix.needsUpdate = parR.instanceMatrix.needsUpdate = true;
  for (const k of keepers) { k.t += dt; animAvatar(k.av, { spd: 0, t: k.t, idle: 1 }); }
  for (const f of FIRES) { const fl = 0.85 + 0.15 * Math.sin(t * 13 + f.x) * Math.sin(t * 7.1 + f.z); f.f.scale.set(1.2 * fl, 1.8 * fl, 1); if (Math.random() < dt * 4 && Math.hypot(f.x - org.x, f.z - org.y) < 200) emit({ x: f.x - org.x, y: f.y + 0.8, z: f.z - org.y, vx: rand(-0.2, 0.2), vy: rand(1, 2), vz: rand(-0.2, 0.2), max: rand(2, 4), s0: 0.4, s1: 2, a0: 0.25, kind: 1, g: 0.2, drag: 0.5, sea: true }); }
}

/* ---- day/night + weather (shared: derived from server time) ---- */
const ENV = { day: 0.7, night: 0, fog: 0, rain: 0, storm: 0, wind: 0.6, amp: 1, w: 'clear', light: 0, nextBolt: 5 };
const WEATHER = [['clear', 0, 0, 0, 0.9], ['clear', 0, 0, 0, 0.9], ['breezy', 0, 0.1, 0, 1.15], ['fog', 0.75, 0, 0, 0.8], ['rain', 0.25, 0.75, 0, 1.25], ['storm', 0.35, 1, 1, 1.75], ['clear', 0, 0, 0, 0.9], ['haze', 0.35, 0, 0, 0.9]];
function weatherAt(slot) { const h = h2(slot * 1.37, 7.1); return WEATHER[Math.floor(h * WEATHER.length) % WEATHER.length]; }
const rainN = 1400;
const rainGeo = (() => { const p = new Float32Array(rainN * 6); for (let i = 0; i < rainN; i++) { const x = rand(-30, 30), y = rand(0, 40), z = rand(-30, 30); p.set([x, y, z, x + 0.05, y - 0.9, z], i * 6); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); return g; })();
const rainMat = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uA: { value: 0 }, uC: { value: new THREE.Vector3() } }, transparent: true, depthWrite: false,
  vertexShader: `uniform float uT;uniform vec3 uC;varying float vA;void main(){vec3 p=position;p.y=mod(p.y-uT*24.0,40.0)-14.0;p.xz+=uC.xz;p.y+=uC.y;p.x+=uT*0.0;vA=1.0;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.0);}`,
  fragmentShader: `uniform float uA;void main(){gl_FragColor=vec4(0.75,0.8,0.85,0.35*uA);}` });
const rain = new THREE.LineSegments(rainGeo, rainMat); rain.frustumCulled = false; scene.add(rain);
const moonDir = new THREE.Vector3();
let envT = 0;
function updateEnvironment(dt) {
  const now = serverNow() / 1000;
  if (S.timeMode === 'sunset') { ENV.day = 0.735 - (7 - sunElev) * 0.0004; }
  else ENV.day = ((now / 1440) + 0.68) % 1;                       // a full day every 24 minutes
  const ph = (ENV.day - 0.25) * TAU;
  if (S.timeMode !== 'sunset') sunElev = Math.sin(ph) * 62;
  SUN_AZ = 0.35 + (ENV.day - 0.75) * 2.2;
  updateSun();
  moonDir.set(-sunDir.x, Math.max(0.25, -sunDir.y), -sunDir.z).normalize(); U_MOON.value.copy(moonDir);
  ENV.night = sstep(1, -8, sunElev); U_NIGHT.value = ENV.night;
  // weather blends between six-minute slots
  const slot = Math.floor(now / 360), f = sstep(0, 70, now - slot * 360), a = weatherAt(slot - 1), b = weatherAt(slot);
  const W = S.weather === 'off' ? WEATHER[0] : null;
  ENV.fog = W ? 0 : lerp(a[1], b[1], f); ENV.rain = W ? 0 : lerp(a[2], b[2], f); ENV.storm = W ? 0 : lerp(a[3], b[3], f); ENV.amp = W ? 1 : lerp(a[4], b[4], f) * (S.motion > 0 ? 1 : 0.5);
  if (ghostFog > 0) ENV.fog = Math.max(ENV.fog, ghostFog);
  ENV.w = W ? 'clear' : (f > 0.5 ? b : a)[0];
  U_FOG.value = ENV.fog; U_CLOUD.value = Math.max(ENV.rain, ENV.storm * 1.2, ENV.fog * 0.4);
  waterU.uAmp.value = lerp(waterU.uAmp.value, ENV.amp, Math.min(1, dt * 0.2));
  // lightning
  if (ENV.storm > 0.5) { ENV.nextBolt -= dt; if (ENV.nextBolt < 0) { ENV.nextBolt = rand(4, 13); ENV.light = 1; sfx.thunder(rand(0.4, 2.5)); } }
  ENV.light = Math.max(0, ENV.light - dt * 3.5);
  rainMat.uniforms.uT.value += dt; rainMat.uniforms.uA.value = ENV.rain; rainMat.uniforms.uC.value.copy(camera.position); rain.visible = ENV.rain > 0.02;
  sfx.setRain && sfx.setRain(ENV.rain);
  for (const s of NIGHT_GLOWS) s.material.opacity = 0.25 + ENV.night * 0.75;
  envT -= dt;
}
let ghostFog = 0;

/* ---- sea caves: hollow rock domes with a narrow mouth, loot inside and a buried cache ---- */
const CAVES = [];
const caveMat = new THREE.MeshStandardMaterial({ color: 0x2e2a26, roughness: 1, flatShading: true, side: THREE.DoubleSide });
const caveFloorMat = new THREE.MeshStandardMaterial({ color: 0x3e3528, roughness: 1 });
function buildCaves() {
  for (const I of ISLES) {
    if (!['jungle', 'mystery', 'cove', 'wild'].includes(I.kind) || I.R < 90) continue;
    const r = srng(4100 + I.i);
    let best = null;
    for (let t = 0; t < 120; t++) {
      const a = r() * TAU, d = I.R * (0.35 + r() * 0.3), x = I.x + Math.cos(a) * d, z = I.z + Math.sin(a) * d;
      if (I.tR && Math.hypot(x - I.tx, z - I.tz) < I.tR + 30) continue;
      let mx = -99, mn = 99; for (let k = 0; k < 10; k++) { const b = k / 10 * TAU; const h = terrainH(x + Math.cos(b) * 8, z + Math.sin(b) * 8); mx = Math.max(mx, h); mn = Math.min(mn, h); }
      const h0 = terrainH(x, z); if (mn < 1.5) continue;
      const score = mx - mn; if (!best || score < best.score) best = { x, z, a, score, top: Math.min(mn, h0) };
    }
    if (!best) continue;
    const R = 8.5, mouth = best.a, y = Math.max(best.top, terrainH(best.x + Math.cos(mouth) * R, best.z + Math.sin(mouth) * R)) + 0.05; // the mouth faces the sea
    const g = new THREE.Group(); g.position.set(best.x, y, best.z); WORLD.add(g);
    const gap = 0.75, geo = new THREE.SphereGeometry(R, 22, 10, 0, TAU - gap, 0, Math.PI / 2);
    const pa = geo.attributes.position; for (let i = 0; i < pa.count; i++) { const vx = pa.getX(i), vy = pa.getY(i), vz = pa.getZ(i); const n = 1 + (vn2(vx * 0.4 + I.i * 7, vz * 0.4 + vy * 0.3) - 0.5) * 0.35; pa.setXYZ(i, vx * n, vy * n * 0.85, vz * n); }
    geo.computeVertexNormals();
    const dome = new THREE.Mesh(geo, caveMat); dome.castShadow = dome.receiveShadow = true;
    // SphereGeometry's gap sits at phi = TAU - gap..TAU, i.e. around +x rotated; turn it to face the mouth
    dome.rotation.y = Math.PI + gap / 2 - mouth; g.add(dome);
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.6, R + 1.5, 8, 24), caveFloorMat); floor.position.y = -4; floor.receiveShadow = true; g.add(floor);
    PLATS.push({ x: best.x, z: best.z, a: 0, hx: R * 0.75, hz: R * 0.75, top: y });
    // walls: a ring of colliders with a gap at the mouth
    const mx = Math.cos(mouth), mz = Math.sin(mouth);
    for (let k = 0; k < 40; k++) { const b = k / 40 * TAU, cx = Math.cos(b), cz = Math.sin(b); if (cx * mx + cz * mz > Math.cos(gap * 0.75)) continue; TREES.push({ x: best.x + cx * (R - 0.4), z: best.z + cz * (R - 0.4), r: 0.9 }); }
    // the dark inside, and what was left there
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff9a40, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.5 })); glow.scale.setScalar(5); glow.position.set(-mx * 4, 1.2, -mz * 4); g.add(glow); NIGHT_GLOWS.push(glow);
    const ix = best.x - mx * 4, iz = best.z - mz * 4;
    campfire(ix + mz * 2, iz - mx * 2);
    skeleton(ix - mz * 3, iz + mx * 3, r() * 6);
    crateAt(ix - mx * 2 + mz, iz - mz * 2 - mx, 'A smuggler’s stash');
    SPOTS.push({ id: 'cave:' + I.i, isl: I.i, x: best.x - mx * 5.5 - mz * 1.5, z: best.z - mz * 5.5 + mx * 1.5, tier: I.kind === 'mystery' ? 3 : 2, cave: 1 });
    (I.landmarks = I.landmarks || []).push({ x: best.x + mx * R, z: best.z + mz * R, n: 'the cave mouth' });
    CAVES.push({ I, x: best.x, z: best.z, y, R });
  }
}
