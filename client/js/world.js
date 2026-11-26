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
  // coastline: broad harmonics plus warped noise, so bays, spits and headlands differ in size
  const wn = fbm2(x * 0.0065 + I.s1 * 3, z * 0.0065 + I.s2 * 3);
  const edge = 1 + 0.17 * Math.sin(3 * a + I.s1) + 0.09 * Math.sin(5 * a + I.s2) + 0.045 * Math.sin(9 * a + I.s3) + (wn - 0.5) * 0.42;
  const t = 1 - r / edge;
  // cliffs: some stretches of coast rise straight from the water instead of a beach
  const cliffK = I.kind === 'jungle' || I.kind === 'mystery' ? 1 : I.kind === 'cove' ? 0.8 : I.kind === 'port' ? 0.45 : 0.25;
  const cliff = sstep(0.6, 0.7, vn2(a * 1.7 + I.s3 * 2, I.i * 3.7)) * cliffK;
  if (t < 0) { const shelf = -1.6 + t * lerp(55, 120, cliff) + (vn2(x * 0.05, z * 0.05) - 0.5) * 2.2 * sstep(-0.12, 0, t); return Math.max(shelf, -40); }
  // beach rising to a low berm, then the land behind it
  const beach = lerp(3.3, 1.0, cliff) * sstep(0, 0.09, t) + 0.5 * sstep(0.05, 0.11, t) * (1 - cliff);
  const inland = sstep(0.06, 1, t);
  const ridge = 1 - Math.abs(fbm2(x * 0.0075 + 11, z * 0.0075 + 7) * 2 - 1);
  let h = -1.6 + beach
    + I.peak * Math.pow(inland, 1.45) * (0.75 + 0.5 * fbm2(x * 0.004 + I.s1, z * 0.004))
    + ridge * ridge * I.peak * 0.32 * sstep(0.15, 0.6, t)
    + (fbm2(x * 0.018, z * 0.018) - 0.45) * I.rough * sstep(0.08, 0.45, t)
    + (vn2(x * 0.11, z * 0.11) - 0.5) * 0.7 * sstep(0.08, 0.2, t)
    + cliff * sstep(0.0, 0.035, t) * lerp(6, 14, vn2(a * 4, I.i)) ;
  if (I.kind === 'mystery') h += sstep(0.55, 0.62, t) * 8;          // a flat-topped mesa at the heart of Skull Key
  if (I.tR) { const d = Math.hypot(x - I.tx, z - I.tz); const w = sstep(I.tR, I.tR * 0.55, d); h = lerp(h, Math.max(2.4, Math.min(h, 3.2)), w); }
  return Math.max(h, -40);
}
function nearIsle(x, z) { let best = null, bd = 1e9; for (const I of ISLES) { const d = Math.hypot(x - I.x, z - I.z) - I.R * 1.5; if (d < bd) { bd = d; best = I; } } return bd < 0 ? best : null; }
function terrainH(x, z) { const I = nearIsle(x, z); return I ? isleRaw(I, x, z) : -40; }

/* ---- terrain: textured, shadowed, with wet sand and the same horizon fog as the sea ---- */
const TIME = { value: 0 };
const terrainMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0, envMapIntensity: 0.35 });
terrainMat.onBeforeCompile = sh => {
  Object.assign(sh.uniforms, { tSand: { value: TEX.sand }, tGrass: { value: TEX.grass }, tRock: { value: TEX.rock }, tDirt: { value: TEX.dirt }, uTime: TIME });
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 splat;varying vec4 vSplat;varying vec3 vTW;varying vec3 vTN;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSplat=splat;vTW=(modelMatrix*vec4(transformed,1.0)).xyz;vTN=normalize(mat3(modelMatrix)*objectNormal);');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
    uniform sampler2D tSand,tGrass,tRock,tDirt;uniform float uTime;varying vec4 vSplat;varying vec3 vTW;varying vec3 vTN;
    vec3 lin(vec3 c){return c*c;}
    float wetK;`)
    .replace('#include <map_fragment>', `
    vec3 tn=normalize(vTN); vec2 twp=vTW.xz;
    float tm1=texture2D(tDirt,twp*0.0031).r, tm2=texture2D(tGrass,twp*0.0047+0.3).g;
    vec3 sand=lin(texture2D(tSand,twp*0.21).rgb)*mix(0.86,1.1,texture2D(tSand,twp*0.017).r);
    vec3 grass=lin(texture2D(tGrass,twp*0.13).rgb)*mix(0.7,1.25,tm2)*mix(vec3(1.0),vec3(1.12,1.0,0.75),smoothstep(0.45,0.7,tm1));
    vec3 dirt=lin(texture2D(tDirt,twp*0.17).rgb);
    vec3 bw=pow(abs(tn),vec3(5.0)); bw/=dot(bw,vec3(1.0));
    vec3 rock=lin(texture2D(tRock,vTW.zy*0.07).rgb*bw.x+texture2D(tRock,twp*0.07).rgb*bw.y+texture2D(tRock,vTW.xy*0.07).rgb*bw.z);
    vec4 sp=vSplat;
    float slope=1.0-tn.y; sp.z=max(sp.z,smoothstep(0.3,0.45,slope));
    float tn1=texture2D(tGrass,twp*0.05).r;
    sp.y*=smoothstep(0.15,0.55,tn1+sp.y*0.6);
    float tot=sp.x+sp.y+sp.z+sp.w+1e-4;
    vec3 col=(sand*sp.x+grass*sp.y+rock*sp.z+dirt*sp.w)/tot;
    float y=vTW.y+(tn1-0.5)*0.4;
    wetK=smoothstep(1.1,0.25,y)*(sp.x/tot)+smoothstep(0.4,-0.2,y);
    col*=mix(1.0,0.58,clamp(wetK,0.0,1.0));
    col=mix(col,vec3(0.03,0.1,0.11),clamp(-vTW.y/7.0,0.0,0.8));
    diffuseColor.rgb*=col*1.25;`)
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,0.28,clamp(wetK,0.0,1.0)*0.85);');
  patchFog(sh);
};
function terrainGeo(I, N) {
  const span = I.R * 1.55;
  const g = new THREE.PlaneGeometry(span * 2, span * 2, N, N); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let k = 0; k < p.count; k++) { const x = p.getX(k) + I.x, z = p.getZ(k) + I.z; p.setY(k, isleRaw(I, x, z)); }
  g.computeVertexNormals();
  const nn = g.attributes.normal, sp = new Float32Array(p.count * 4);
  for (let k = 0; k < p.count; k++) {
    const h = p.getY(k), ny = nn.getY(k), x = p.getX(k) + I.x, z = p.getZ(k) + I.z, v = vn2(x * 0.03, z * 0.03), v2 = vn2(x * 0.11 + 4, z * 0.11);
    const beachTop = 2.4 + v * 1.2;
    let sand = sstep(beachTop + 0.8, beachTop - 0.2, h), rock = sstep(0.82, 0.7, ny) + sstep(I.peak * 0.85 + 4, I.peak + 8, h) * 0.8, dirt = 0, grass = 1 - sand;
    if (I.kind === 'mystery') { dirt = grass * (0.5 + v * 0.5); grass *= 0.45; rock += sstep(0.88, 0.8, ny); }
    if (I.kind === 'reef') { sand = Math.max(sand, 0.7); grass *= 0.3; }
    dirt += grass * sstep(0.62, 0.78, v2) * 0.8;
    if (I.tR) { const d = Math.hypot(x - I.tx, z - I.tz); const town = sstep(I.tR * 1.05, I.tR * 0.6, d) * sstep(1.6, 2.3, h); sand *= 1 - town; grass = lerp(grass, 0.55 + v2 * 0.4, town); dirt = lerp(dirt, 0.45 + (1 - v2) * 0.5, town); }
    if (h < -0.5) { sand = 1; grass = 0; dirt = 0; rock *= 0.5; }
    sp[k * 4] = sand; sp[k * 4 + 1] = Math.max(0, grass); sp[k * 4 + 2] = Math.min(1, rock); sp[k * 4 + 3] = dirt;
  }
  g.setAttribute('splat', new THREE.BufferAttribute(sp, 4)); return g;
}
for (const I of ISLES) {
  const span = I.R * 1.55, N = clamp(Math.round(span * 2 / 4.2), 60, 320), Nl = clamp(Math.round(span * 2 / 14), 24, 110);
  const lod = new THREE.LOD(); lod.position.set(I.x, 0, I.z);
  const hi = new THREE.Mesh(terrainGeo(I, N), terrainMat); hi.receiveShadow = true; const lo = new THREE.Mesh(terrainGeo(I, Nl), terrainMat); lo.receiveShadow = true;
  lod.addLevel(hi, 0); lod.addLevel(lo, Math.max(650, I.R * 2.2)); WORLD.add(lod); I.mesh = hi;
}
/* ---- the coast map: a top-down depth image the sea uses for shallows and surf ---- */
{
  let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const I of ISLES) { x0 = Math.min(x0, I.x - I.R * 1.6); z0 = Math.min(z0, I.z - I.R * 1.6); x1 = Math.max(x1, I.x + I.R * 1.6); z1 = Math.max(z1, I.z + I.R * 1.6); }
  const S = 1024, sx = (x1 - x0) / S, sz = (z1 - z0) / S; const data = new Uint8Array(S * S * 4);
  for (let i = 0; i < S * S; i++) data[i * 4 + 3] = 255;
  for (const I of ISLES) { const i0 = Math.max(0, Math.floor((I.x - I.R * 1.6 - x0) / sx)), i1 = Math.min(S - 1, Math.ceil((I.x + I.R * 1.6 - x0) / sx)), j0 = Math.max(0, Math.floor((I.z - I.R * 1.6 - z0) / sz)), j1 = Math.min(S - 1, Math.ceil((I.z + I.R * 1.6 - z0) / sz));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const h = isleRaw(I, x0 + (i + 0.5) * sx, z0 + (j + 0.5) * sz); const o = (j * S + i) * 4; const v = Math.round(clamp((h + 40) / 48, 0, 1) * 255); if (v > data[o]) data[o] = v; } }
  const tex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat); tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  waterU.uCoast.value = tex; waterU.uCoastR.value.set(x0, z0, x1 - x0, z1 - z0);
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

/* ---- vegetation (instanced per island, so whole islands are culled off-screen) ---- */
const VEG_Q = { low: 0.4, medium: 0.7, high: 1, ultra: 1.2 }[S.resolved] || 0.8;
// a strip that arches out and droops, textured as a leaf; u runs along the rib
function leafStrip(len, width, droop, seg = 8, fold = 0.18) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= seg; i++) { const t = i / seg, x = t * len, y = Math.sin(t * Math.PI * 0.55) * droop * 0.45 - t * t * droop, w = width * (0.25 + Math.sin(Math.min(1, t * 1.15) * Math.PI) * 0.75) * (1 - t * 0.35);
    pos.push(x, y - w * fold, -w / 2, x, y, 0, x, y - w * fold, w / 2); uv.push(t, 0, t, 0.5, t, 1); }
  for (let i = 0; i < seg; i++) { const a = i * 3; idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function palmGeo(H, bend, nFr, seed) {
  const r = srng(seed);
  // trunk: tapered, ringed, bending toward the light, with a flared foot
  const P = []; for (let i = 0; i <= 14; i++) { const t = i / 14; P.push([0.24 * (1 - t * 0.42) + 0.16 * Math.pow(1 - t, 6) + (i % 2) * 0.008, t * H]); }
  const tr = lathe(P.map(p => [p[0], p[1]]), 9); const p = tr.attributes.position, uv = tr.attributes.uv;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), t = y / H; p.setX(i, p.getX(i) + bend * t * t * H * 0.18); uv.setXY(i, uv.getX(i) * 2, y / 1.1); }
  tr.computeVertexNormals();
  const top = new THREE.Vector3(bend * H * 0.18, H, 0);
  const F = [];
  for (let k = 0; k < nFr; k++) { const a = k / nFr * TAU + r() * 0.3, len = 3.2 + r() * 1.3, up = 0.25 + r() * 0.45, g = leafStrip(len, 0.95 + r() * 0.3, 1.6 + r() * 1.2, 9, 0.22);
    g.rotateZ(up); g.rotateY(-a); g.translate(top.x, top.y - 0.1, top.z); F.push(g); }
  for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + 0.4, g = leafStrip(1.6, 0.5, -0.2, 5, 0.2); g.rotateZ(1.15); g.rotateY(-a); g.translate(top.x, top.y, top.z); F.push(g); }
  const nuts = []; for (let k = 0; k < 4 + (r() * 3 | 0); k++) { const a = r() * TAU; const s = new THREE.SphereGeometry(0.13, 6, 4); s.scale(1, 1.15, 1); s.translate(top.x + Math.cos(a) * 0.2, top.y - 0.32 - r() * 0.15, top.z + Math.sin(a) * 0.2); nuts.push(s); }
  return { trunk: tr, fronds: merge(F), nuts: merge(nuts) };
}
function broadleafGeo(seed) {
  const r = srng(seed), H = 7 + r() * 4;
  const P = [[0.75, 0], [0.5, 0.35], [0.34, 1.2], [0.28, H * 0.55], [0.18, H * 0.85], [0.08, H]]; const tr = lathe(P, 9);
  const p = tr.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); const a = Math.atan2(p.getZ(i), p.getX(i)); const k = y < 1 ? 1 + 0.35 * Math.max(0, Math.sin(a * 4)) * (1 - y) : 1; p.setX(i, p.getX(i) * k + Math.sin(y * 0.4) * 0.3); p.setZ(i, p.getZ(i) * k); }
  tr.computeVertexNormals();
  const br = [], cards = [];
  for (let b = 0; b < 4; b++) { const a = b / 4 * TAU + r(), y0 = H * (0.55 + r() * 0.25), L = 2.2 + r() * 1.5; const end = [Math.cos(a) * L, y0 + 1.2 + r(), Math.sin(a) * L];
    br.push(tubeG([[0, y0, 0], [end[0] * 0.5, y0 + 0.9, end[2] * 0.5], end], 0.12, 6, 5));
    for (let c = 0; c < 6; c++) { const g = new THREE.PlaneGeometry(3 + r() * 1.5, 3 + r() * 1.5); g.rotateX(-Math.PI / 2 + (r() - 0.5) * 1.4); g.rotateY(r() * TAU); g.translate(end[0] + (r() - 0.5) * 2.4, end[1] + (r() - 0.3) * 1.6, end[2] + (r() - 0.5) * 2.4); cards.push(g); } }
  for (let c = 0; c < 6; c++) { const g = new THREE.PlaneGeometry(3.5, 3.5); g.rotateX(-Math.PI / 2 + (r() - 0.5) * 0.9); g.rotateY(r() * TAU); g.translate((r() - 0.5) * 2, H + 0.6 + r() * 1.2, (r() - 0.5) * 2); cards.push(g); }
  return { trunk: merge([tr, ...br]), leaves: merge(cards) };
}
function clusterGeo(n, rad, size, seed, yScale = 0.8) { const r = srng(seed), L = []; for (let i = 0; i < n; i++) { const g = new THREE.PlaneGeometry(size * (0.8 + r() * 0.4), size * (0.8 + r() * 0.4)); g.rotateX((r() - 0.5) * 2.4); g.rotateY(r() * TAU); const a = r() * TAU, d = Math.sqrt(r()) * rad; g.translate(Math.cos(a) * d, size * 0.4 + r() * rad * yScale, Math.sin(a) * d); L.push(g); } return merge(L); }
function fernGeo(seed) { const r = srng(seed), L = []; for (let k = 0; k < 8; k++) { const g = leafStrip(0.9 + r() * 0.5, 0.32, 0.5, 4, 0.1); g.rotateZ(0.5 + r() * 0.5); g.rotateY(-(k / 9 * TAU + r() * 0.4)); L.push(g); } return merge(L); }
function tuftGeo() { const L = []; for (let k = 0; k < 3; k++) { const g = new THREE.PlaneGeometry(1.2, 0.7); g.translate(0, 0.27, 0); g.rotateY(k / 3 * Math.PI); L.push(g); } return merge(L); }
function rockGeo(seed, detail = 3) { const r = srng(seed); const g = new THREE.IcosahedronGeometry(1, detail); const p = g.attributes.position; const o = [r() * 9, r() * 9, r() * 9];
  for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)); const n = vn2(v.x * 1.6 + o[0], v.z * 1.6 + v.y * 1.3 + o[1]) * 0.55 + vn2(v.x * 4 + o[2], v.y * 4 + v.z * 4) * 0.18;
    v.multiplyScalar(0.75 + n); v.y = v.y > 0 ? v.y * 0.85 : v.y * 0.6; p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g; }
function driftGeo(seed) { const r = srng(seed); const g = tubeG([[-1.6, 0.12, 0], [-0.5, 0.16, 0.15 + r() * 0.2], [0.6, 0.14, -0.1], [1.7, 0.1, 0.1]], 0.14, 12, 6); const br = tubeG([[0.6, 0.14, -0.1], [0.9, 0.25, -0.6], [1.1, 0.3, -0.9]], 0.06, 6, 5); return merge([g, br]); }
const vegMats = {
  trunk: stdMat({ map: TEX.bark, roughness: 0.95 }),
  frond: swayMaterial(stdMat({ map: TEX.frond, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75, envMapIntensity: 0.3 }), 0.25, 3),
  nut: stdMat({ color: 0x5a4020, roughness: 0.7 }),
  btrunk: stdMat({ map: TEX.trunk, roughness: 1 }),
  leaves: swayMaterial(stdMat({ map: TEX.leaves, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8, envMapIntensity: 0.3 }), 0.12, 6),
  bush: swayMaterial(stdMat({ map: TEX.leaves, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85, color: 0xc8d8a8, envMapIntensity: 0.3 }), 0.25, 1.2),
  fern: swayMaterial(stdMat({ map: TEX.fern, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.85, envMapIntensity: 0.3 }), 0.3, 0.8),
  tuft: swayMaterial(stdMat({ map: TEX.tuft, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9, envMapIntensity: 0.25 }), 0.6, 0.4),
  rock: stdMat({ map: srgbTex(ART.rock), roughness: 0.95, color: 0xb8b0a4, envMapIntensity: 0.35 }),
  mossRock: stdMat({ map: srgbTex(ART.rock), roughness: 0.95, color: 0x9aa88a, envMapIntensity: 0.35 }),
  drift: stdMat({ map: TEX.wood, color: 0xb8ab98, roughness: 0.95 }),
  flower: swayMaterial(stdMat({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }), 0.3, 0.5),
};
const VEGG = {
  palms: [palmGeo(8.5, 1.1, 12, 1), palmGeo(10.5, 1.8, 13, 2), palmGeo(7, 0.5, 11, 3)],
  trees: [broadleafGeo(5), broadleafGeo(6)],
  bush: [clusterGeo(12, 0.9, 1.4, 7), clusterGeo(9, 0.6, 1.1, 8)],
  fern: fernGeo(9), tuft: tuftGeo(), rocks: [rockGeo(11, 2), rockGeo(12, 2), rockGeo(13, 2)], drift: driftGeo(14),
  flower: (() => { const L = [], C = [[0.9, 0.2, 0.25], [0.95, 0.75, 0.2], [0.9, 0.9, 0.85], [0.7, 0.3, 0.75]]; const col = []; for (let k = 0; k < 6; k++) { const g = new THREE.CircleGeometry(0.07, 5); g.rotateX(-Math.PI / 2 + 0.3); g.translate((k % 3 - 1) * 0.12, 0.25 + (k % 2) * 0.08, (k / 3 | 0) * 0.14 - 0.07); L.push(g); const c = C[k % 4]; for (let i = 0; i < g.attributes.position.count; i++) col.push(...c); } const m = merge(L); m.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return m; })(),
};
const vegPos = { palm: [], bush: [], rock: [] };      // kept for landmarks and older callers
const _vm4 = new THREE.Matrix4(), _vq4 = new THREE.Quaternion(), _ve4 = new THREE.Euler(), _vs4 = new THREE.Vector3(), _vp4 = new THREE.Vector3();
// vegetation is split into map cells, each culled by the camera frustum and by a per-kind draw distance
const VEGCHUNKS = [];
function islandBatch(I, geo, mat, list, shadow, maxD = 2500, cell = 300) {
  if (!list.length) return null;
  const cells = new Map(); for (const q of list) { const k = Math.floor(q[0] / cell) + ',' + Math.floor(q[2] / cell); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(q); }
  for (const L of cells.values()) {
    const g = new THREE.BufferGeometry(); for (const k in geo.attributes) g.setAttribute(k, geo.attributes[k]); g.setIndex(geo.index);
    let cx = 0, cz = 0, cy = 0; for (const q of L) { cx += q[0]; cz += q[2]; cy += q[1]; } cx /= L.length; cz /= L.length; cy /= L.length; let rad = 0; for (const q of L) rad = Math.max(rad, Math.hypot(q[0] - cx, q[2] - cz)); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx, cy, cz), rad + 15);
    const im = new THREE.InstancedMesh(g, mat, L.length);
    L.forEach((q, i) => { _vm4.compose(_vp4.set(q[0], q[1], q[2]), _vq4.setFromEuler(_ve4.set(q[4] || 0, q[3], q[5] || 0)), _vs4.set(q[6], q[7] || q[6], q[8] || q[6])); im.setMatrixAt(i, _vm4); });
    im.castShadow = !!shadow; im.receiveShadow = true; WORLD.add(im); VEGCHUNKS.push({ im, x: cx, z: cz, r: rad, maxD });
  }
}
let vegCullT = 0;
function cullWorld(dt) {
  vegCullT -= dt; if (vegCullT > 0) return; vegCullT = 0.25;
  const px = camera.position.x + org.x, pz = camera.position.z + org.y;
  for (const c of VEGCHUNKS) c.im.visible = Math.hypot(c.x - px, c.z - pz) - c.r < c.maxD;
  for (const t of TOWNG) t.g.visible = Math.hypot(t.x - px, t.z - pz) - (t.r || 0) < (t.far ? (t.r ? 700 : 2200) : 260);
  for (const W of WRECKS) W.g.visible = Math.hypot(W.x - px, W.z - pz) < 900;
  for (const k of keepers) k.av.root.visible = Math.hypot(k.x - px, k.z - pz) < 160;
  for (const f of FIRES) f.g.visible = Math.hypot(f.x - px, f.z - pz) < 600;
}
for (const I of ISLES) {
  const r = srng(5000 + I.i * 31);
  const jungle = I.kind === 'jungle', myst = I.kind === 'mystery';
  const pick = (minH, maxH, avoidTown, maxSlope = 0.35) => { for (let t = 0; t < 30; t++) { const a = r() * TAU, d = Math.sqrt(r()) * I.R * 1.2, x = I.x + Math.cos(a) * d, z = I.z + Math.sin(a) * d, h = isleRaw(I, x, z);
    if (h > minH && h < maxH && (!avoidTown || !I.tR || Math.hypot(x - I.tx, z - I.tz) > I.tR * 0.85)) { const sl = Math.abs(isleRaw(I, x + 1, z) - h) + Math.abs(isleRaw(I, x, z + 1) - h); if (sl < maxSlope * 2) return [x, h, z]; } } return null; };
  const near = (x, z, n, sp) => { const a = r() * TAU, d = r() * sp; return [x + Math.cos(a) * d, z + Math.sin(a) * d]; };
  const P = [[], [], []], T = [[], []], B = [[], []], Fe = [], Tu = [], R = [[], [], []], Dr = [], Fl = [];
  // palms in groves behind the beaches
  const nGroves = Math.round(I.R * (jungle ? 0.12 : myst ? 0.04 : 0.15));
  for (let gI = 0; gI < nGroves; gI++) { const c = pick(1.2, jungle ? 18 : 12, true, 0.5); if (!c) continue; const n = 3 + (r() * 6 | 0);
    for (let k = 0; k < n; k++) { const [x, z] = near(c[0], c[2], 0, 14); const h = isleRaw(I, x, z); if (h < 1.0 || h > 22) continue; const v = (r() * 2) | 0, s = 0.7 + r() * 0.55; P[v].push([x, h - 0.15, z, r() * TAU, 0, 0, s]); TREES.push({ x, z, r: 0.35 * s }); vegPos.palm.push([x, h, z, 0, s]); } }
  if (jungle || I.kind === 'cove') for (let k = 0; k < I.R * (jungle ? 1.5 : 0.25) * VEG_Q; k++) { const p = pick(4, I.peak + 30, true, 0.8); if (!p) continue; const s = 0.85 + r() * 0.6; T[k % 2].push([p[0], p[1] - 0.3, p[2], r() * TAU, 0, 0, s]); TREES.push({ x: p[0], z: p[2], r: 0.6 * s }); }
  for (let k = 0; k < I.R * (jungle ? 1.6 : 0.7) * VEG_Q; k++) { const p = pick(2.2, I.peak + 20, true, 0.8); if (!p) continue; B[k % 2].push([p[0], p[1] - 0.2, p[2], r() * TAU, 0, 0, 0.7 + r() * 1.1]); vegPos.bush.push([...p, 0, 1]); }
  for (let k = 0; k < I.R * (jungle ? 1.4 : 0.35) * VEG_Q; k++) { const p = pick(3, I.peak + 20, true, 0.8); if (p) Fe.push([p[0], p[1] - 0.05, p[2], r() * TAU, 0, 0, 0.9 + r() * 0.8]); }
  if (!myst || true) for (let k = 0; k < I.R * (myst ? 4 : 16) * VEG_Q; k++) { const p = pick(2.8, I.peak + 15, false, 0.6); if (p) { Tu.push([p[0], p[1] - 0.05, p[2], r() * TAU, 0, 0, 0.7 + r() * 0.9, 0.6 + r() * 0.9]); if (r() < 0.12) Fl.push([p[0] + 0.3, p[1] - 0.05, p[2], r() * TAU, 0, 0, 1 + r()]); } }
  const nRock = Math.round(I.R * (myst ? 0.4 : 0.18)) + 4;
  for (let k = 0; k < nRock; k++) { const p = pick(-4, I.peak + 30, true, 2.5); if (!p) continue; const s = 0.6 + Math.pow(r(), 2) * (myst ? 7 : 3.5); const v = k % 3; R[v].push([p[0], p[1] - s * 0.25, p[2], r() * TAU, (r() - 0.5) * 0.4, (r() - 0.5) * 0.4, s, s * (0.6 + r() * 0.4), s * (0.8 + r() * 0.4)]); vegPos.rock.push([...p, 0, s]); if (s > 1.2) TREES.push({ x: p[0], z: p[2], r: s * 0.85 }); }
  // tide-line: boulders at the waterline and driftwood on the sand
  for (let k = 0; k < I.R * 0.12; k++) { const p = pick(-1.2, 1.4, true, 3); if (!p) continue; const s = 0.4 + r() * 1.4; R[k % 3].push([p[0], p[1] - s * 0.3, p[2], r() * TAU, 0, 0, s, s * 0.7, s]); }
  for (let k = 0; k < I.R * 0.06; k++) { const p = pick(0.6, 2.6, true, 1); if (p) Dr.push([p[0], p[1] - 0.05, p[2], r() * TAU, 0, (r() - 0.5) * 0.1, 0.7 + r() * 0.6]); }
  I.landmarks = vegPos.rock.slice(-nRock).filter(v => v[4] > 2).map(v => ({ x: v[0], z: v[2], n: 'the great rock' }));
  P.forEach((L, v) => { islandBatch(I, VEGG.palms[v].trunk, vegMats.trunk, L, true, 1500, 900); islandBatch(I, VEGG.palms[v].fronds, vegMats.frond, L, true, 1500, 900); islandBatch(I, VEGG.palms[v].nuts, vegMats.nut, L, false, 300, 200); });
  T.forEach((L, v) => { islandBatch(I, VEGG.trees[v].trunk, vegMats.btrunk, L, true, 1500, 900); islandBatch(I, VEGG.trees[v].leaves, vegMats.leaves, L, true, 1500, 900); });
  B.forEach((L, v) => islandBatch(I, VEGG.bush[v], vegMats.bush, L, false, 380, 200));
  islandBatch(I, VEGG.fern, vegMats.fern, Fe, false, 200, 96); islandBatch(I, VEGG.tuft, vegMats.tuft, Tu, false, 130, 64); islandBatch(I, VEGG.flower, vegMats.flower, Fl, false, 100, 64);
  R.forEach((L, v) => islandBatch(I, VEGG.rocks[v], jungle ? vegMats.mossRock : vegMats.rock, L, true, 700, 700));
  islandBatch(I, VEGG.drift, vegMats.drift, Dr, false, 300, 160);
}

/* ---- buildings, docks, NPC keepers ---- */
const WPROX = [];  // interactable proxies in the world
function wProxy(parent, w, h, d, x, y, z, def) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), proxyMat); m.position.set(x, y, z); m.userData.inter = def; parent.add(m); WPROX.push(m); def.proxy = m; return def; }
const signMat = t => { const [c, g] = cnv(512, 160); const gr = g.createLinearGradient(0, 0, 0, 160); gr.addColorStop(0, '#4a3020'); gr.addColorStop(1, '#2e1c10'); g.fillStyle = gr; g.fillRect(0, 0, 512, 160);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`; g.fillRect(0, Math.random() * 160, 512, 1 + Math.random() * 2); }
  g.strokeStyle = '#c9a25a'; g.lineWidth = 6; g.strokeRect(10, 10, 492, 140); g.fillStyle = '#f2dfb4'; g.shadowColor = '#000'; g.shadowBlur = 6; g.font = 'italic 58px "IM Fell English", Georgia, serif'; g.textAlign = 'center'; g.fillText(t, 256, 100);
  return stdMat({ map: mkTex(c, false), roughness: 0.75 }); };
const BLD = {
  wall: stdMat({ map: TEX.plaster, roughness: 0.95 }), roof: stdMat({ map: TEX.tiles, roughness: 0.85 }), stone: stdMat({ map: TEX.stone, color: 0xa89f92, roughness: 0.95 }),
  beam: stdMat({ map: TEX.wood, color: 0x4a3020, roughness: 0.85 }), plank: stdMat({ map: TEX.timber, roughness: 0.85 }), wood: MAT.dark,
  win: new THREE.MeshStandardMaterial({ color: 0x2a2018, emissive: 0xffa850, emissiveIntensity: 0.1, roughness: 0.3 }), iron: stdMat({ color: 0x2a2826, metalness: 0.7, roughness: 0.5 }),
};
function uvBox(w, h, d, s = 1) { const g = box(w, h, d); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * s, uv.getY(i) * s); return g; }
const keepers = [];
const TOWNG = [];
let CUR_ROOT = null; const worldParent = () => CUR_ROOT || WORLD;
// collapse a finished town piece into one mesh per material (interaction proxies and people stay separate)
const _inv = new THREE.Matrix4(), _rel = new THREE.Matrix4();
function flattenGroup(g) {
  g.updateMatrixWorld(true); _inv.copy(g.matrixWorld).invert();
  const byMat = new Map(), remove = [];
  const walk = o => { if (o.userData.keep) return; for (const c of [...o.children]) {
    if (c.isMesh && !c.isInstancedMesh && c.material !== proxyMat && !Array.isArray(c.material) && !c.userData.keep) {
      _rel.multiplyMatrices(_inv, c.matrixWorld); const geo = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone(); geo.applyMatrix4(_rel);
      for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) geo.deleteAttribute(k);
      if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
      const key = c.material; if (!byMat.has(key)) byMat.set(key, { list: [], cast: false }); const e = byMat.get(key); e.list.push(geo); e.cast = e.cast || c.castShadow; remove.push(c); }
    walk(c); } };
  walk(g);
  for (const c of remove) { for (const ch of [...c.children]) c.parent.attach(ch); c.parent.remove(c); }
  for (const [mat, e] of byMat) { const m = new THREE.Mesh(merge(e.list), mat); m.castShadow = e.cast; m.receiveShadow = true; g.add(m); }
}
function townPiece(I, lx, lz, la, fn, far) { const g = new THREE.Group(); const c = Math.cos(I.ta), s = Math.sin(I.ta);
  // local frame: +x = toward sea (out along ta), +z = along the shore
  const x = I.tx + lx * c - lz * s, z = I.tz + lx * s + lz * c; g.position.set(x, 0, z); g.rotation.y = -I.ta + (la || 0); if (!I.townRoot) { I.townRoot = new THREE.Group(); WORLD.add(I.townRoot); } I.townRoot.add(g); fn(g, x, z, -I.ta + (la || 0)); return g; }
function shadowy(m, cast = true) { m.castShadow = cast; m.receiveShadow = true; return m; }
// a half-timbered house: stone plinth, plaster walls, oak frame, tiled gable roof, shuttered windows, chimney
function building(I, lx, lz, w, d, hgt, label, porch) {
  return townPiece(I, lx, lz, 0, (g, x, z, a) => {
    let y = 99; for (const [ox, oz] of [[0, 0], [w / 2, d / 2], [-w / 2, d / 2], [w / 2, -d / 2], [-w / 2, -d / 2]]) y = Math.min(y, groundAt(x + ox * Math.cos(-a) - oz * Math.sin(-a), z + ox * Math.sin(-a) + oz * Math.cos(-a)));
    const base = y + 0.55;
    g.add(shadowy(new THREE.Mesh(uvBox(w + 0.3, 1.6, d + 0.3, 0.6), BLD.stone))); g.children[g.children.length - 1].position.y = base - 0.8 + 0.0;
    const wall = shadowy(new THREE.Mesh(uvBox(w, hgt, d, 0.35), BLD.wall)); wall.position.y = base + hgt / 2; g.add(wall);
    // timber frame
    const B = [], bt = 0.18;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.push(xf(box(bt, hgt, bt), sx * (w / 2 + 0.02), base + hgt / 2, sz * (d / 2 + 0.02)));
    for (const yy of [base + 0.05, base + hgt * 0.55, base + hgt - 0.05]) { B.push(xf(box(w + 0.1, bt, bt * 0.8), 0, yy, d / 2 + 0.05), xf(box(w + 0.1, bt, bt * 0.8), 0, yy, -d / 2 - 0.05), xf(box(bt * 0.8, bt, d + 0.1), w / 2 + 0.05, yy, 0), xf(box(bt * 0.8, bt, d + 0.1), -w / 2 - 0.05, yy, 0)); }
    for (const sz of [-1, 1]) for (let k = -1; k <= 1; k += 2) { const L = Math.hypot(w / 3, hgt * 0.45); B.push(xf(box(bt * 0.7, L, bt * 0.6), k * w / 4, base + hgt * 0.78, sz * (d / 2 + 0.06), 0, 0, k * Math.atan2(w / 3, hgt * 0.45))); }
    for (let k = -1; k <= 1; k += 2) B.push(xf(box(bt * 0.6, hgt * 0.45, bt * 0.8), w / 2 + 0.06, base + hgt * 0.27, k * d * 0.32));
    g.add(shadowy(meshOf(B, BLD.beam)));
    // gable roof: ridge runs along z (the long side faces the sea)
    const rise = Math.max(1.8, w * 0.38), over = 0.6, half = w / 2 + over, slope = Math.hypot(half, rise);
    for (const sx of [-1, 1]) { const r = shadowy(new THREE.Mesh(uvBox(slope, 0.16, d + over * 2, 0.5), BLD.roof)); r.position.set(sx * half / 2, base + hgt + rise / 2 - 0.05, 0); r.rotation.z = -sx * Math.atan2(rise, half); g.add(r); }
    const gab = new THREE.Shape(); gab.moveTo(-w / 2, 0); gab.lineTo(w / 2, 0); gab.lineTo(0, rise * (w / 2) / half); gab.closePath();
    for (const sz of [-1, 1]) { const gg = new THREE.ShapeGeometry(gab); const m = shadowy(new THREE.Mesh(gg, BLD.wall)); m.position.set(0, base + hgt, sz * d / 2); if (sz < 0) m.rotation.y = Math.PI; g.add(m); }
    const ridge = shadowy(new THREE.Mesh(cyl(0.12, 0.12, d + over * 2, 6), BLD.beam)); ridge.rotation.x = Math.PI / 2; ridge.position.y = base + hgt + rise; g.add(ridge);
    const ch = shadowy(new THREE.Mesh(uvBox(0.9, rise + 1.6, 0.9, 0.6), BLD.stone)); ch.position.set(-w * 0.25, base + hgt + rise * 0.5 + 0.6, -d * 0.3); g.add(ch);
    // door (on the seaward face) and windows with shutters
    const door = new THREE.Group(); door.position.set(w / 2 + 0.04, base, 0); g.add(door);
    door.add(shadowy(meshOf([xf(box(0.14, 2.5, 0.16), 0, 1.25, -0.75), xf(box(0.14, 2.5, 0.16), 0, 1.25, 0.75), xf(box(0.16, 0.2, 1.7), 0, 2.55, 0)], BLD.beam)));
    const dp = new THREE.Mesh(uvBox(0.08, 2.3, 1.36, 1), BLD.plank); dp.position.set(0.02, 1.15, 0); door.add(dp);
    door.add(meshOf([xf(box(0.04, 0.06, 0.9), 0.07, 0.5, 0.15), xf(box(0.04, 0.06, 0.9), 0.07, 1.8, 0.15), xf(new THREE.TorusGeometry(0.06, 0.012, 4, 10), 0.08, 1.15, -0.45, 0, Math.PI / 2, 0)], BLD.iron));
    const winAt = (px, pz, ry) => { const wg = new THREE.Group(); wg.position.set(px, base + hgt * 0.42, pz); wg.rotation.y = ry; g.add(wg);
      wg.add(new THREE.Mesh(box(0.06, 1.0, 0.8), BLD.win)); wg.add(meshOf([xf(box(0.1, 0.1, 1.0), 0.03, 0.55, 0), xf(box(0.14, 0.1, 1.1), 0.05, -0.55, 0), xf(box(0.1, 1.1, 0.08), 0.03, 0, 0), xf(box(0.1, 0.06, 0.9), 0.03, 0, 0)], BLD.beam));
      for (const s2 of [-1, 1]) { const sh = new THREE.Mesh(uvBox(0.05, 1.05, 0.45, 1), BLD.plank); sh.position.set(0.06, 0, s2 * 0.66); sh.rotation.y = s2 * 0.25; wg.add(sh); } };
    for (const pz of [-d * 0.3, d * 0.3]) winAt(w / 2 + 0.03, pz, 0);
    for (const px of [-w * 0.25, w * 0.2]) { winAt(px, d / 2 + 0.03, -Math.PI / 2); winAt(px, -d / 2 - 0.03, Math.PI / 2); }
    if (label) { // a sign hanging from an iron bracket
      const br = meshOf([xf(box(1.5, 0.06, 0.06), w / 2 + 0.75, base + hgt - 0.3, d * 0.42), xf(box(0.06, 0.6, 0.06), w / 2 + 0.05, base + hgt - 0.55, d * 0.42, 0, 0, 0.8)], BLD.iron); g.add(br);
      const sg = new THREE.Group(); sg.position.set(w / 2 + 1.1, base + hgt - 0.35, d * 0.42); g.add(sg); const sb = new THREE.Mesh(box(0.08, 0.8, 2.4), BLD.beam); sb.position.y = -0.48; sg.add(sb);
      for (const sz of [1, -1]) { const p2 = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.72), signMat(label)); p2.position.set(sz * 0.05, -0.48, 0); p2.rotation.y = sz * Math.PI / 2; sg.add(p2); }
      sg.rotation.y = Math.PI / 2; SIGNS.push(sg); }
    if (porch) { const P = [xf(uvBox(2.6, 0.12, d + 0.4, 0.5), w / 2 + 1.3, base - 0.05, 0)]; for (const pz of [-d / 2, d / 2]) P.push(xf(box(0.16, 2.8, 0.16), w / 2 + 2.4, base + 1.4, pz));
      g.add(shadowy(meshOf(P, BLD.beam))); const aw = shadowy(new THREE.Mesh(uvBox(2.9, 0.12, d + 0.6, 0.5), BLD.roof)); aw.position.set(w / 2 + 1.35, base + 2.9, 0); aw.rotation.z = -0.25; g.add(aw);
      for (const pz of [-d / 2 + 0.8, d / 2 - 0.8]) prop(g, 'barrel', w / 2 + 2.0, base, pz); }
    OBB.push({ x, z, a: -a, hx: w / 2 + 0.2, hz: d / 2 + 0.2, y0: y - 1, y1: base + hgt + rise });
    if (porch) PLATS.push({ x: x + Math.cos(-a) * (w / 2 + 1.3), z: z + Math.sin(-a) * (w / 2 + 1.3), a: -a, hx: 1.3, hz: d / 2 + 0.2, top: base + 0.01 });
  }, true);
}
const SIGNS = [];
// small props used around towns and camps
const PROPG = {
  barrel: (() => { const st = lathe([[0.001, 0], [0.27, 0], [0.31, 0.2], [0.33, 0.45], [0.31, 0.7], [0.27, 0.9], [0.001, 0.9]], 14); const h = []; for (const y of [0.1, 0.32, 0.58, 0.8]) { const t = new THREE.TorusGeometry(y < 0.2 || y > 0.7 ? 0.29 : 0.325, 0.012, 4, 18); t.rotateX(Math.PI / 2); t.translate(0, y, 0); h.push(t); } return { st, hoops: merge(h) }; })(),
  crate: uvBox(0.9, 0.8, 0.9, 1), sack: lathe([[0.001, 0], [0.24, 0.02], [0.3, 0.18], [0.27, 0.42], [0.14, 0.58], [0.08, 0.6], [0.12, 0.66], [0.001, 0.68]], 10, 1, 0.85),
  coil: (() => { const L = []; for (let i = 0; i < 5; i++) { const t = new THREE.TorusGeometry(0.28 - i * 0.012, 0.03, 5, 18); t.rotateX(Math.PI / 2); t.translate(0, 0.03 + i * 0.05, 0); L.push(t); } return merge(L); })(),
  bollard: lathe([[0.001, 0], [0.2, 0], [0.18, 0.4], [0.13, 0.5], [0.22, 0.6], [0.2, 0.68], [0.001, 0.7]], 12),
};
function prop(parent, k, x, y, z, ry = Math.random() * TAU, s = 1) { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; g.scale.setScalar(s); parent.add(g);
  if (k === 'barrel') { g.add(shadowy(new THREE.Mesh(PROPG.barrel.st, CM.wood))); g.add(new THREE.Mesh(PROPG.barrel.hoops, BLD.iron)); }
  else if (k === 'crate') { const m = shadowy(new THREE.Mesh(PROPG.crate, MAT.crate)); m.position.y = 0.4; g.add(m); }
  else if (k === 'sack') g.add(shadowy(new THREE.Mesh(PROPG.sack, clothMat('#b59e74'))));
  else if (k === 'coil') g.add(new THREE.Mesh(PROPG.coil, CM.rope));
  else if (k === 'bollard') g.add(shadowy(new THREE.Mesh(PROPG.bollard, BLD.iron)));
  return g; }
function stall(I, lx, lz, shop, label) {
  return townPiece(I, lx, lz, 0, (g, x, z, a) => {
    const y = groundAt(x, z);
    // counter with plank front, corner posts and a sagging striped awning
    g.add(shadowy(meshOf([xf(uvBox(3.4, 1.0, 0.9, 1), 0.3, y + 0.5, 0)], BLD.plank)));
    g.add(shadowy(meshOf([xf(box(3.6, 0.08, 1.1), 0.3, y + 1.04, 0)], BLD.beam)));
    const P = []; for (const px of [-1.5, 1.8]) for (const pz of [-1.3, 1.3]) P.push(xf(cyl(0.07, 0.08, 3.0, 6), pz < 0 ? 0 : 0, 0, 0)); 
    g.add(shadowy(meshOf([xf(cyl(0.07, 0.08, 2.9, 6), 0.9, y + 1.45, -1.6), xf(cyl(0.07, 0.08, 2.9, 6), 0.9, y + 1.45, 1.6), xf(cyl(0.07, 0.08, 3.3, 6), -1.0, y + 1.65, -1.6), xf(cyl(0.07, 0.08, 3.3, 6), -1.0, y + 1.65, 1.6), xf(cyl(0.05, 0.05, 3.3, 6), 0.9, y + 2.9, 0, Math.PI / 2, 0, 0), xf(cyl(0.05, 0.05, 3.3, 6), -1.0, y + 3.3, 0, Math.PI / 2, 0, 0)], BLD.beam)));
    const cols = [['#b33a2a', '#e8dcc0'], ['#2f5f8a', '#e8dcc0'], ['#d9a640', '#7a2a1c'], ['#3e6b45', '#e8dcc0'], ['#4b2b4f', '#d9a640']][keepers.length % 5];
    const aw = new THREE.PlaneGeometry(2.3, 3.4, 8, 8); const ap = aw.attributes.position; for (let i = 0; i < ap.count; i++) { const u = ap.getX(i) / 2.3 + 0.5, v = ap.getY(i) / 3.4 + 0.5; ap.setZ(i, -Math.sin(v * Math.PI) * 0.12 - Math.sin(u * Math.PI) * 0.06); }
    aw.computeVertexNormals(); const am = new THREE.Mesh(aw, stdMat({ map: TEX.canvasStripe(cols[0], cols[1]), side: THREE.DoubleSide, roughness: 0.95 })); am.rotation.set(-Math.PI / 2, 0, Math.PI / 2); am.rotation.y = 0.17; am.position.set(-0.05, y + 3.15, 0); shadowy(am); g.add(am);
    const valance = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.35), am.material); valance.position.set(1.05, y + 2.78, 0); valance.rotation.y = Math.PI / 2; g.add(valance);
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.8), signMat(label)); sg.position.set(1.08, y + 3.35, 0); sg.rotation.y = Math.PI / 2; g.add(sg);
    // wares on the counter, by trade
    const top = y + 1.08, W = new THREE.Group(); g.add(W);
    const put = (k, px, pz, rx = 0, ry = 0, rz = 0) => { const m = weaponMesh(k); if (!m) return; m.position.set(px, top + 0.02, pz); m.rotation.set(rx, ry, rz); W.add(m); };
    if (shop === 'tavern') { for (let i = 0; i < 7; i++) put(i % 3 ? 'rum' : 'ale', 0.2 + (i % 2) * 0.25, -1.2 + i * 0.38, 0, 0, 0); W.children.forEach(m => m.position.y += 0.06); prop(g, 'barrel', -0.6, y, -2.3); prop(g, 'barrel', -0.6, y, 2.3); }
    else if (shop === 'armory') { ['cutlass', 'saber', 'pistol', 'musket', 'dagger', 'axe'].forEach((k, i) => put(k, 0.1 + (i % 2) * 0.3, -1.3 + i * 0.5, 0, 0, Math.PI / 2)); prop(g, 'crate', -0.6, y, 2.4); }
    else if (shop === 'chandler') { prop(g, 'coil', 0.2, top, -1.0, 0, 0.8); prop(g, 'coil', 0.4, top, 0.2, 0, 0.7); put('bucket', 0.2, 1.2); prop(g, 'crate', -0.6, y, -2.4); prop(g, 'crate', -0.6, y + 0.8, -2.4, 0.3, 0.8); prop(g, 'barrel', -0.6, y, 2.4); }
    else if (shop === 'trader') { for (let i = 0; i < 4; i++) prop(g, 'sack', 0.2 + (i % 2) * 0.4, top, -1.2 + i * 0.8, 0, 0.7); prop(g, 'crate', -0.6, y, 2.4); prop(g, 'sack', -0.7, y, -2.3); }
    else if (shop === 'fence') { put('spyglass', 0.3, -0.9, 0, 0, Math.PI / 2); put('flare', 0.3, 0.0); put('dynamite', 0.3, 0.6); put('keg', 0.3, 1.2); prop(g, 'barrel', -0.6, y, 2.4); }
    else if (shop === 'yard') { prop(g, 'coil', 0.3, top, -0.9, 0, 0.8); put('hammer', 0.3, 0.4, 0, 0, Math.PI / 2); for (let i = 0; i < 5; i++) { const pl = new THREE.Mesh(uvBox(4, 0.1, 0.35, 1), BLD.plank); pl.position.set(-0.4, y + 0.06 + i * 0.1, -2.6); g.add(pl); } }
    W.traverse(m => { if (m.isMesh) m.castShadow = true; });
    const k = makeAvatar({ coat: ['#7a2e1f', '#2c3e5c', '#5a4a2a', '#3c5a33', '#4b2b4f'][keepers.length % 5], style: keepers.length % 3 ? 'sailor' : 'captain', seed: 400 + keepers.length * 13 + I.i * 101 }); k.root.position.set(-0.8, y, 0); k.root.rotation.y = Math.PI / 2; k.root.userData.keep = true; g.add(k.root);
    keepers.push({ av: k, t: Math.random() * 9, x, z });
    OBB.push({ x, z, a: -a, hx: 1.8, hz: 1.7, y0: y - 1, y1: y + 3 });
    wProxy(g, 3.4, 2.4, 3.4, 0, y + 1.2, 0, { label: () => label, sub: 'trade', act: () => openShop(shop) });
  });
}
function dock(I) {
  // a pier running out to sea from the town: planks, piles, bracing, bollards and coiled rope
  let len = 30; for (; len < 140; len += 4) { const c = Math.cos(I.ta), s = Math.sin(I.ta); if (terrainH(I.tx + c * (I.tR * 0.5 + len), I.tz + s * (I.tR * 0.5 + len)) < -5) break; }
  len += 26;
  return townPiece(I, I.tR * 0.5 + len / 2 - 6, 0, 0, (g, x, z, a) => {
    const top = 2.0;
    const deck = shadowy(new THREE.Mesh(uvBox(len, 0.22, 5, 0.5), MAT.deck)); deck.position.y = top - 0.11; g.add(deck);
    const piles = [], braces = [], rails = [];
    for (let i = -len / 2; i <= len / 2 + 0.01; i += 4) { for (const sz of [-2.35, 2.35]) { piles.push(xf(cyl(0.2, 0.24, 11, 8), i, top - 4.6, sz)); }
      braces.push(xf(box(0.14, 0.18, 4.6), i, top - 0.35, 0), xf(box(0.12, 5.4, 0.14), i, top - 2.6, 0, 0.0, 0, 0)); }
    for (let i = -len / 2; i < len / 2 - 1; i += 4) for (const sz of [-2.35, 2.35]) braces.push(xf(box(4.6, 0.14, 0.1), i + 2, top - 2.0, sz * 1.04, 0, 0, Math.atan2(2.2, 4) * (i % 8 ? 1 : -1)));
    g.add(shadowy(meshOf(piles, stdMat({ map: TEX.wood, color: 0x4a3a2c, roughness: 0.95 }))));
    g.add(shadowy(meshOf(braces, BLD.beam)));
    for (let i = -len / 2 + 6; i <= len / 2; i += 12) for (const sz of [-2.25, 2.25]) prop(g, 'bollard', i, top, sz, 0);
    prop(g, 'coil', len / 2 - 3, top, 1.6); prop(g, 'coil', -len / 2 + 10, top, -1.5); prop(g, 'crate', len / 2 - 8, top, -1.6, 0.2); prop(g, 'crate', len / 2 - 8.2, top + 0.8, -1.55, 0.5); prop(g, 'barrel', len / 2 - 9.6, top, -1.7); prop(g, 'barrel', -len / 2 + 14, top, 1.7);
    for (let i = -len / 2 + 2; i < len / 2; i += 16) lampOn(g, i, top, 2.3);
    PLATS.push({ x, z, a: -a, hx: len / 2, hz: 2.5, top });
    I.dockEnd = { x: x + Math.cos(I.ta) * len / 2, z: z + Math.sin(I.ta) * len / 2 };
  }, true);
}
const LANTERNG = (() => { const cage = merge([xf(box(0.3, 0.04, 0.3), 0, 0.2, 0), xf(box(0.34, 0.05, 0.34), 0, -0.2, 0), ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => xf(box(0.025, 0.4, 0.025), a * 0.14, 0, b * 0.14)), xf(new THREE.ConeGeometry(0.22, 0.2, 4), 0, 0.32, 0, 0, Math.PI / 4, 0), xf(new THREE.TorusGeometry(0.05, 0.01, 4, 8), 0, 0.46, 0)]);
  const glass = new THREE.BoxGeometry(0.26, 0.36, 0.26); return { cage, glass }; })();
const lanternGlass = new THREE.MeshStandardMaterial({ color: 0x302010, emissive: 0xffb060, emissiveIntensity: 0.3, roughness: 0.2, transparent: true, opacity: 0.9 });
function lampOn(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  g.add(shadowy(meshOf([xf(cyl(0.06, 0.08, 3.0, 8), 0, 1.5, 0), xf(cyl(0.12, 0.16, 0.3, 8), 0, 0.15, 0), xf(box(0.5, 0.05, 0.05), 0.22, 2.95, 0)], BLD.iron)));
  const L = new THREE.Group(); L.position.set(0.42, 2.55, 0); g.add(L); L.add(new THREE.Mesh(LANTERNG.cage, BLD.iron)); L.add(new THREE.Mesh(LANTERNG.glass, lanternGlass));
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffa850, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s.position.copy(L.position); s.scale.setScalar(2.4); g.add(s); NIGHT_GLOWS.push(s); return g; }
function lampPost(I, lx, lz) { townPiece(I, lx, lz, 0, (g, x, z) => { lampOn(g, 0, groundAt(x, z), 0); TREES.push({ x, z, r: 0.2 }); }); }
const NIGHT_GLOWS = [];
const fireStoneG = rockGeo(77, 1), logG = (() => { const g = lathe([[0.001, -0.55], [0.07, -0.55], [0.08, -0.4], [0.075, 0.4], [0.07, 0.55], [0.001, 0.55]], 7); return g; })();
const charMat = stdMat({ map: TEX.wood, color: 0x2a1c12, roughness: 1, emissive: 0x401000, emissiveIntensity: 0.6 });
function campfire(x, z, parent = worldParent()) {
  const g = new THREE.Group(); const y = groundAt(x, z); g.position.set(x, y, z); parent.add(g);
  const S2 = []; for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; S2.push(xf(fireStoneG, Math.cos(a) * 0.62, 0.05, Math.sin(a) * 0.62, i, i * 2, 0, 0.16 + (i % 3) * 0.03, 0.12, 0.15)); }
  g.add(shadowy(meshOf(S2, vegMats.rock)));
  const L = []; for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; L.push(xf(logG, Math.cos(a) * 0.22, 0.2, Math.sin(a) * 0.22, 0, -a, Math.PI / 2.8)); }
  g.add(shadowy(meshOf(L, charMat)));
  const ash = new THREE.Mesh(new THREE.CircleGeometry(0.5, 12), stdMat({ color: 0x2a2622, roughness: 1 })); ash.rotation.x = -Math.PI / 2; ash.position.y = 0.02; g.add(ash);
  const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff8a30, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); f.position.y = 0.6; f.scale.set(1.2, 1.8, 1); g.add(f);
  const f2 = new THREE.Sprite(f.material.clone()); f2.material.color.set(0xffd070); f2.position.y = 0.45; f2.scale.set(0.6, 1.0, 1); g.add(f2);
  FIRES.push({ g, f, f2, x, z, y });
  wProxy(g, 1.8, 1.2, 1.8, 0, 0.5, 0, { label: () => 'Campfire', sub: () => cookable() ? 'cook your fish' : 'warm yourself · sit with Z', act: () => cookAll() });
  return g;
}
const FIRES = [];
const boneMat = stdMat({ color: 0xe0d6bc, roughness: 0.7 });
const SKELG = (() => {
  const skull = lathe([[0.001, -0.06], [0.05, -0.055], [0.07, -0.02], [0.085, 0.03], [0.08, 0.08], [0.05, 0.11], [0.001, 0.12]], 12, 0.9, 1.05);
  const jaw = (() => { const g = new THREE.TorusGeometry(0.05, 0.012, 5, 10, Math.PI); g.rotateX(Math.PI / 2); g.translate(0, -0.07, 0.03); return g; })();
  const L = [xf(skull, 0, 0.09, -0.92, -1.2, 0, 0.2), xf(jaw, 0, 0.09, -0.92, -1.2, 0, 0.2)];
  for (let i = 0; i < 6; i++) { const r = new THREE.TorusGeometry(0.13 - Math.abs(i - 2) * 0.012, 0.012, 4, 12, Math.PI * 1.15); r.rotateY(Math.PI / 2); r.rotateZ(-Math.PI * 0.07); L.push(xf(r, 0, 0.1, -0.68 + i * 0.07, 0, 0, 0)); }
  for (let i = 0; i < 14; i++) L.push(xf(new THREE.SphereGeometry(0.022, 5, 4), 0, 0.04, -0.78 + i * 0.07));
  L.push(xf(lathe([[0.001, -0.08], [0.12, -0.06], [0.14, 0.02], [0.08, 0.06], [0.001, 0.06]], 10, 1, 0.6), 0, 0.06, 0.25, Math.PI / 2, 0, 0));
  for (const sx of [-1, 1]) { L.push(xf(limb(0.022, 0.018, 0.42, 6), sx * 0.09, 0.05, 0.3, -Math.PI / 2 + 0.1, 0, sx * 0.15)); L.push(xf(limb(0.02, 0.016, 0.4, 6), sx * 0.15, 0.04, 0.72, -Math.PI / 2 - 0.1, 0, sx * 0.05));
    L.push(xf(limb(0.018, 0.015, 0.3, 6), sx * 0.2, 0.05, -0.6, -Math.PI / 2 + 0.3, 0, sx * 0.9)); L.push(xf(limb(0.015, 0.013, 0.26, 6), sx * 0.42, 0.04, -0.42, -Math.PI / 2 + 0.2, 0, sx * 1.4)); }
  return merge(L); })();
function skeleton(x, z, rot) {
  const g = new THREE.Group(); const y = groundAt(x, z); g.position.set(x, y + 0.02, z); g.rotation.y = rot; worldParent().add(g);
  g.add(shadowy(new THREE.Mesh(SKELG, boneMat)));
  const hat = new THREE.Group(); hat.position.set(0.3, 0.06, -1.15); hat.rotation.set(0.2, 0.4, 0.3); hat.add(new THREE.Mesh(CG.tricorn.brim, clothMat('#2a221c', 'leather'))); hat.add(new THREE.Mesh(CG.tricorn.crown, clothMat('#2a221c', 'leather'))); g.add(hat);
  const sw = weaponMesh('cutlass'); sw.position.set(-0.45, 0.03, -0.2); sw.rotation.set(Math.PI / 2, 0, 0.6); g.add(sw);
  const def = { looted: false, label: () => def.looted ? 'Picked-over bones' : 'Search the skeleton', sub: 'someone didn’t make it', act: () => { if (def.looted) return; def.looted = true; lootRoll('camp', g); } };
  wProxy(g, 1, 0.6, 2, 0, 0.3, -0.3, def);
}
let TENT_M = null;
function tent(x, z, rot) {
  const g = new THREE.Group(); const y = groundAt(x, z); g.position.set(x, y, z); g.rotation.y = rot; worldParent().add(g);
  const cm = TENT_M || (TENT_M = stdMat({ map: TEX.fabric, color: 0xcbb994, roughness: 1, side: THREE.DoubleSide }));
  for (const s2 of [-1, 1]) { const p = new THREE.PlaneGeometry(2.6, 1.95, 6, 4); const pa = p.attributes.position; for (let i = 0; i < pa.count; i++) pa.setZ(i, -Math.sin((pa.getY(i) / 1.95 + 0.5) * Math.PI) * 0.06); p.computeVertexNormals(); const m = shadowy(new THREE.Mesh(p, cm)); m.rotation.set(0, Math.PI / 2, 0); m.rotateX(s2 * 0.82); m.position.set(0, 0.8, s2 * 0.7); g.add(m); }
  g.add(shadowy(meshOf([xf(cyl(0.035, 0.035, 1.8, 6), 1.3, 0.9, 0), xf(cyl(0.035, 0.035, 1.8, 6), -1.3, 0.9, 0), xf(cyl(0.03, 0.03, 2.8, 6), 0, 1.75, 0, 0, 0, Math.PI / 2)], BLD.beam)));
  const guy = []; for (const sx of [-1, 1]) for (const sz of [-1, 1]) guy.push(new THREE.Vector3(sx * 1.3, 1.75, 0), new THREE.Vector3(sx * 2.1, 0, sz * 1.6));
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(guy), new THREE.LineBasicMaterial({ color: 0x6b5a40 })));
  prop(g, 'sack', 1.6, 0, 1.1); TREES.push({ x, z, r: 1.3 });
}
function crateAt(x, z, label = 'Abandoned supplies') {
  const y = groundAt(x, z); const m = shadowy(new THREE.Mesh(box(0.9, 0.8, 0.9), MAT.crate)); m.position.set(x, y + 0.38, z); m.rotation.set((Math.random() - 0.5) * 0.08, Math.random() * 3, (Math.random() - 0.5) * 0.08); worldParent().add(m);
  const def = { looted: false, label: () => def.looted ? 'Empty crate' : label, act: () => { if (def.looted) return; def.looted = true; lootRoll('crate', def.proxy || m); setTimeout(() => def.looted = false, 600000); } };
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
const wreckMats = new Map();
function wreckMat(m) { if (!wreckMats.has(m)) { const c = m.clone(); if (c.color) c.color.multiply(new THREE.Color(0.55, 0.6, 0.5)); c.roughness = 1; c.envMapIntensity = 0.3; wreckMats.set(m, c); } return wreckMats.get(m); }
function buildWreckMeshes() { if (!PEER_T) return; for (const W of WRECKS) { for (const [mat, geo] of PEER_T.parts) { if (mat === MAT.sail || mat === MAT.glass || mat === MAT.window) continue; const m = new THREE.Mesh(geo, wreckMat(mat)); m.castShadow = m.receiveShadow = true; W.g.add(m); }
  // torn canvas hanging from a yard and kelp at the waterline
  const rag = new THREE.PlaneGeometry(4, 5, 4, 5); const rp = rag.attributes.position; for (let i = 0; i < rp.count; i++) rp.setZ(i, Math.sin(rp.getY(i) * 1.3 + rp.getX(i)) * 0.4); rag.computeVertexNormals();
  const rm = new THREE.Mesh(rag, swayMaterial(stdMat({ map: sailTex, color: 0x8a8070, side: THREE.DoubleSide, roughness: 1, alphaTest: 0.1 }), 0.6, 2)); rm.position.set(1.5, DECK + 14, -0.5); W.g.add(rm); } }

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
      building(I, -27, -18, 10, 9, 4.2, I.kind === 'cove' ? 'The Black Gull' : 'The Drowned Gull', true);
      building(I, -30, 14, 8, 7, 3.8, '');
      building(I, -46, -4, 9, 7, 3.6, '');
      building(I, -44, 26, 7, 6, 3.4, '');
      building(I, 14, -34, 12, 8, 4.4, 'Warehouse');
      building(I, -8, 46, 8, 7, 3.6, '');
      building(I, -26, 44, 7, 6, 3.4, '');
      townDressing(I, r);
      if (I.yard) { stall(I, 4, 26, 'yard', 'Shipwright'); }
      for (const [lx, lz] of [[2, -14], [2, 14], [-14, 0], [-40, 0]]) lampPost(I, lx, lz);
      townPiece(I, -14, -8, 0, (g, x, z) => campfire(x, z));
      // tavern tables
      for (let t = 0; t < 3; t++) townPiece(I, -16, -26 + t * 5, 0, (g, x, z) => { const y = groundAt(x, z); tavernTable(g, y); SEATS.push({ x, z, y: y + 0.45 }); });
    }
    CUR_ROOT = new THREE.Group(); WORLD.add(CUR_ROOT); const campRoot = CUR_ROOT;
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
      const x = I.x - I.R * 0.2, z = I.z; skullRock(x, isleRaw(I, x, z), z, Math.atan2(I.z - z, I.x - x) + Math.PI);
      TREES.push({ x, z, r: 22 });
      I.landmarks.unshift({ x, z, n: 'the skull rock' });
    }
    // some driftwood and crates on beaches
    for (let k = 0; k < Math.round(I.R / 60); k++) { const a = r() * TAU, x = I.x + Math.cos(a) * I.R * 0.93, z = I.z + Math.sin(a) * I.R * 0.93; if (terrainH(x, z) > 0.5) crateAt(x, z, 'Washed-up crate'); }
    CUR_ROOT = null; flattenGroup(campRoot); TOWNG.push({ g: campRoot, x: I.x, z: I.z, far: true, r: I.R });
  }
  for (const I of ISLES) if (I.townRoot) { flattenGroup(I.townRoot); TOWNG.push({ g: I.townRoot, x: I.tx, z: I.tz, far: true }); }
  buildCaves();
}
const SEATS = [];

/* ---- wildlife: crabs and parrots ---- */
const CRABN = 70;
const crabGeoI = new THREE.BufferGeometry(); for (const k in CRAB_GEO.attributes) crabGeoI.setAttribute(k, CRAB_GEO.attributes[k]); crabGeoI.setIndex(CRAB_GEO.index);
const crabMove = new THREE.InstancedBufferAttribute(new Float32Array(CRABN), 1); crabGeoI.setAttribute('aMove', crabMove);
const crabs = new THREE.InstancedMesh(crabGeoI, crabMaterial(), CRABN); crabs.frustumCulled = false; crabs.castShadow = true; WORLD.add(crabs);
const crabState = [];
{ const r = srng(42); for (let i = 0; i < CRABN; i++) { const I = ISLES[i % ISLES.length]; for (let t = 0; t < 30; t++) { const a = r() * TAU, x = I.x + Math.cos(a) * I.R * 0.97, z = I.z + Math.sin(a) * I.R * 0.97, h = isleRaw(I, x, z); if (h > 0.3 && h < 2.4) { crabState.push({ x, z, a: r() * TAU, t: r() * 5, I }); break; } } if (crabState.length <= i) crabState.push({ x: I.x, z: I.z, a: 0, t: 0, I, dead: 1 }); } }
const parrotMat = stdMat({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide });
const PARN = 14;
const parB = new THREE.InstancedMesh(PARROT.body, parrotMat, PARN), parL = new THREE.InstancedMesh(PARROT.wL, parrotMat, PARN), parR = new THREE.InstancedMesh(PARROT.wR, parrotMat, PARN);
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
    _e4.set(0, -c.a + Math.PI, 0); _m4.compose(_v4.set(c.x, terrainH(c.x, c.z) + 0.0, c.z), _q4.setFromEuler(_e4), _s4.setScalar(c.dead ? 0 : 1.15)); crabs.setMatrixAt(i, _m4); crabMove.array[i] = c.mv ? 1 : 0;
  }
  crabs.instanceMatrix.needsUpdate = true; crabMove.needsUpdate = true; TIME_ART.value = t;
  for (let i = 0; i < PARN; i++) {
    const p = parrots[i]; p.th += p.w * dt; const x = p.I.tx + Math.cos(p.th) * p.r, z = p.I.tz + Math.sin(p.th) * p.r, y = p.h + Math.sin(t + i) * 2 + terrainH(p.I.tx, p.I.tz);
    const dx = -Math.sin(p.th) * Math.sign(p.w), dz = Math.cos(p.th) * Math.sign(p.w);
    _e4.set(0, Math.atan2(dx, dz), -Math.sign(p.w) * 0.4, 'YXZ'); _m4.compose(_v4.set(x, y, z), _q4.setFromEuler(_e4.set(0, Math.atan2(dx, dz) + Math.PI, -Math.sign(p.w) * 0.35, 'YXZ')), _s4.setScalar(1.6)); parB.setMatrixAt(i, _m4);
    const wa = Math.sin(t * 11 + i) * 0.75 + 0.1; _m5.makeRotationZ(wa); parL.setMatrixAt(i, _m4.clone().multiply(_m5)); _m5.makeRotationZ(-wa); parR.setMatrixAt(i, _m4.clone().multiply(_m5));
  }
  parB.instanceMatrix.needsUpdate = parL.instanceMatrix.needsUpdate = parR.instanceMatrix.needsUpdate = true;
  for (const k of keepers) { if (!k.av.root.parent || !k.av.root.parent.visible) continue; k.t += dt; animAvatar(k.av, { spd: 0, t: k.t, idle: 1 }); }
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
  BLD.win.emissiveIntensity = 0.12 + ENV.night * 1.8 + ENV.fog * 0.4; lanternGlass.emissiveIntensity = 0.3 + ENV.night * 2.2;
  envT -= dt;
}
let ghostFog = 0;

/* ---- sea caves: hollow rock domes with a narrow mouth, loot inside and a buried cache ---- */
const CAVES = [];
const caveMat = stdMat({ map: srgbTex(ART.rock), color: 0x9a9084, roughness: 0.95, side: THREE.DoubleSide });
const caveFloorMat = stdMat({ map: TEX.dirt, color: 0x8a7a66, roughness: 1 });
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
    const dome = new THREE.Mesh(geo, caveMat); dome.castShadow = dome.receiveShadow = true; dome.scale.set(1, 0.85, 1);
    // SphereGeometry's gap sits at phi = TAU - gap..TAU, i.e. around +x rotated; turn it to face the mouth
    dome.rotation.y = Math.PI + gap / 2 - mouth; g.add(dome);
    // rough outcrop: big boulders heaped over the dome so it reads as part of the hill
    const BR = []; for (let k = 0; k < 16; k++) { const b2 = k / 16 * TAU; 
      const wx = Math.cos(b2) * (R + 0.8), wz = Math.sin(b2) * (R + 0.8); const ang = Math.atan2(wz, wx); const dm = Math.cos(ang - mouth); if (dm > 0.82) continue; const sc = 2.2 + r() * 2.6;
      BR.push(xf(VEGG.rocks[k % 3], wx, sc * 0.3 + r() * 2, wz, r() * 3, r() * 6, r() * 3, sc, sc * 0.8, sc)); }
    for (let k = 0; k < 4; k++) BR.push(xf(VEGG.rocks[k % 3], (r() - 0.5) * 6, R * 0.75 + r() * 1.5, (r() - 0.5) * 6, r(), r() * 6, r(), 3.5 + r() * 2, 2 + r(), 3.5 + r() * 2));
    for (const sd of [-1, 1]) { const ma = mouth + sd * gap * 0.62; BR.push(xf(VEGG.rocks[1], Math.cos(ma) * R, 2.6, Math.sin(ma) * R, 0.3, r() * 6, 0, 1.8, 3.2, 1.8)); }
    const outcrop = shadowy(meshOf(BR, caveMat)); g.add(outcrop);
    for (let k = 0; k < 9; k++) { const st = new THREE.Mesh(new THREE.ConeGeometry(0.25 + r() * 0.3, 1.2 + r() * 1.6, 6), caveMat); const a2 = r() * TAU, d2 = r() * R * 0.6; st.position.set(Math.cos(a2) * d2, R * 0.8 - 0.8 - r(), Math.sin(a2) * d2); st.rotation.x = Math.PI; g.add(st); }
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
    flattenGroup(g); TOWNG.push({ g, x: best.x, z: best.z, far: true, r: 1 });
    CAVES.push({ I, x: best.x, z: best.z, y, R });
  }
}

/* ---- tavern furniture, the skull rock and the bustle of a port town ---- */
function tavernTable(g, y) {
  g.add(shadowy(meshOf([xf(uvBox(1.8, 0.08, 0.9, 1), 0, y + 0.78, 0), xf(box(0.08, 0.75, 0.6), -0.7, y + 0.38, 0, 0, 0, 0.12), xf(box(0.08, 0.75, 0.6), 0.7, y + 0.38, 0, 0, 0, -0.12), xf(box(1.4, 0.06, 0.08), 0, y + 0.3, 0)], BLD.plank)));
  for (const sz of [-0.85, 0.85]) g.add(shadowy(meshOf([xf(uvBox(1.8, 0.07, 0.32, 1), 0, y + 0.45, sz), xf(box(0.07, 0.43, 0.25), -0.75, y + 0.22, sz), xf(box(0.07, 0.43, 0.25), 0.75, y + 0.22, sz)], BLD.plank)));
  const m1 = weaponMesh('ale'); m1.position.set(-0.4, y + 0.87, 0.15); g.add(m1); const m2 = weaponMesh('ale'); m2.position.set(0.3, y + 0.87, -0.2); m2.rotation.y = 2; g.add(m2); const b = weaponMesh('rum'); b.position.set(0.05, y + 0.88, 0.2); g.add(b);
  const cd = new THREE.Mesh(cyl(0.03, 0.03, 0.12, 8), MAT.candle); cd.position.set(0, y + 0.88, -0.05); g.add(cd); const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffb060, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); fl.position.set(0, y + 0.99, -0.05); fl.scale.setScalar(0.35); g.add(fl); NIGHT_GLOWS.push(fl);
}
function skullRock(x, y, z, face) {
  const g = new THREE.SphereGeometry(14, 48, 32); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { let vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i); const nx = vx / 14, ny = vy / 14, nz = vz / 14;
    // cranium, cheekbones, a tapering jaw; deep sockets and a nose cavity on the +z face
    let r = 1; if (ny < -0.1) { r *= 1 + ny * 0.35; } if (nz > 0 && ny < 0.1) r *= 1 - Math.max(0, -ny - 0.2) * 0.3;
    const sock = (cx, cy) => { const d = Math.hypot(nx - cx, ny - cy); return nz > 0.5 ? Math.max(0, 0.28 - d) * 1.4 : 0; };
    r -= sock(-0.36, 0.08) + sock(0.36, 0.08); r -= nz > 0.6 ? Math.max(0, 0.16 - Math.hypot(nx * 1.6, (ny + 0.3) * 1.0)) * 1.4 : 0;
    if (nz > 0.5 && ny < -0.48 && ny > -0.68) r -= (Math.abs(Math.sin(nx * 22)) < 0.35 ? 0.06 : 0);
    r += (vn2(vx * 0.35 + 3, vy * 0.35 + vz * 0.3) - 0.5) * 0.12;
    p.setXYZ(i, vx * r, vy * r * 0.9, vz * r * 0.95); }
  g.computeVertexNormals();
  const m = shadowy(new THREE.Mesh(g, stdMat({ map: srgbTex(ART.rock), color: 0xcfc4b0, roughness: 0.95 }))); m.scale.setScalar(1.7); m.position.set(x, y + 14, z); m.rotation.y = Math.PI / 2 - face; WORLD.add(m);
  const dark = new THREE.MeshBasicMaterial({ color: 0x0a0806 });
  for (const ex of [-0.36, 0.36]) { const e = new THREE.Mesh(new THREE.SphereGeometry(3, 12, 10), dark); e.position.set(ex * 14 * 0.95, 0.08 * 14 * 0.9, 14 * 0.62); m.add(e); }
}
function townDressing(I, r) {
  // crates, barrels and sacks heaped by doors and along the waterfront; fences, a well, nets drying, palms for shade
  const piles = [[-20, -10], [-22, 8], [-36, 20], [-38, -14], [-8, 30], [-10, -32], [-52, 10], [-50, -20]];
  for (const [lx, lz] of piles) townPiece(I, lx, lz, r() * 6, (g, x, z) => { const y = groundAt(x, z); const n = 2 + (r() * 4 | 0);
    for (let i = 0; i < n; i++) prop(g, ['barrel', 'crate', 'sack', 'barrel'][(r() * 4) | 0], (r() - 0.5) * 2.2, y, (r() - 0.5) * 2.2, r() * 6, 0.9 + r() * 0.2); TREES.push({ x, z, r: 1.2 }); });
  townPiece(I, -18, 22, 0, (g, x, z) => { const y = groundAt(x, z); g.add(shadowy(new THREE.Mesh(lathe([[0.95, 0], [1.0, 0.1], [1.0, 0.85], [0.85, 0.9], [0.85, 0.2], [0.001, 0.2]], 18), BLD.stone))); g.children[0].position.y = y;
    g.add(shadowy(meshOf([xf(box(0.12, 2.2, 0.12), 0, y + 1.1, -0.9), xf(box(0.12, 2.2, 0.12), 0, y + 1.1, 0.9), xf(cyl(0.06, 0.06, 1.9, 6), 0, y + 2.05, 0, Math.PI / 2, 0, 0)], BLD.beam)));
    const rf = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.9, 4), BLD.roof); rf.position.y = y + 2.6; rf.rotation.y = Math.PI / 4; g.add(shadowy(rf)); const bk = weaponMesh('bucket'); bk.position.set(0, y + 1.6, 0); g.add(bk); TREES.push({ x, z, r: 1.1 }); });
  // fences along the edge of the yard
  for (let k = 0; k < 6; k++) townPiece(I, -58 + k * 0, -30 + k * 5.4, 0, (g, x, z) => { const y = groundAt(x, z); g.add(shadowy(meshOf([xf(box(0.12, 1.1, 0.12), 0, y + 0.55, 0), xf(box(0.06, 0.1, 5.4), 0, y + 0.85, 2.7), xf(box(0.06, 0.1, 5.4), 0, y + 0.45, 2.7)], BLD.beam))); });
  // nets drying on frames by the beach
  townPiece(I, 18, -26, 0.3, (g, x, z) => { const y = groundAt(x, z); g.add(shadowy(meshOf([xf(box(0.1, 2.2, 0.1), 0, y + 1.1, -1.6), xf(box(0.1, 2.2, 0.1), 0, y + 1.1, 1.6), xf(cyl(0.04, 0.04, 3.3, 5), 0, y + 2.1, 0, Math.PI / 2, 0, 0)], BLD.beam)));
    const [c, gg] = cnv(128, 128); gg.strokeStyle = '#5a4a36'; gg.lineWidth = 2; for (let i = 0; i < 128; i += 10) { gg.beginPath(); gg.moveTo(i, 0); gg.lineTo(i, 128); gg.stroke(); gg.beginPath(); gg.moveTo(0, i); gg.lineTo(128, i); gg.stroke(); }
    const net = new THREE.PlaneGeometry(3.2, 1.9, 8, 6); const np = net.attributes.position; for (let i = 0; i < np.count; i++) np.setZ(i, Math.sin((np.getX(i) / 3.2 + 0.5) * Math.PI) * 0.25); net.computeVertexNormals();
    const nm = new THREE.Mesh(net, swayMaterial(stdMat({ map: srgbTex(c), alphaTest: 0.3, transparent: false, side: THREE.DoubleSide, roughness: 1 }), 0.4, 2)); nm.material.map.repeat.set(3, 2); nm.material.map.wrapS = nm.material.map.wrapT = THREE.RepeatWrapping; nm.position.set(0, y + 1.15, 0); nm.rotation.y = Math.PI / 2; g.add(nm); TREES.push({ x, z, r: 1.6 }); });
  // shade palms along the waterfront and in the square
  for (const [lx, lz] of [[24, -8], [26, 12], [20, 30], [-4, -14], [-6, 20], [30, -18], [-36, 0]]) townPiece(I, lx, lz, r() * 6, (g, x, z) => { const y = groundAt(x, z); const v = (r() * 3) | 0, sc = 0.8 + r() * 0.3;
    const tr = new THREE.Mesh(VEGG.palms[v].trunk, vegMats.trunk), fr = new THREE.Mesh(VEGG.palms[v].fronds, vegMats.frond), nu = new THREE.Mesh(VEGG.palms[v].nuts, vegMats.nut);
    for (const m of [tr, fr, nu]) { m.position.y = y - 0.1; m.scale.setScalar(sc); m.castShadow = true; g.add(m); } TREES.push({ x, z, r: 0.35 }); });
  // a handcart and a few shade palms in the square
  townPiece(I, -12, 14, 0.6, (g, x, z) => { const y = groundAt(x, z); g.add(shadowy(meshOf([xf(uvBox(1.4, 0.08, 2.2, 1), 0, y + 0.75, 0), xf(box(0.06, 0.4, 2.2), 0.7, y + 0.95, 0), xf(box(0.06, 0.4, 2.2), -0.7, y + 0.95, 0), xf(cyl(0.04, 0.04, 1.6, 5), 0.5, y + 0.85, 1.9, Math.PI / 2 - 0.3, 0, 0), xf(cyl(0.04, 0.04, 1.6, 5), -0.5, y + 0.85, 1.9, Math.PI / 2 - 0.3, 0, 0)], BLD.plank)));
    for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 6, 14), BLD.beam); w.position.set(sx * 0.82, y + 0.45, -0.3); w.rotation.y = Math.PI / 2; g.add(shadowy(w)); }
    prop(g, 'sack', 0.2, y + 0.8, -0.4); prop(g, 'sack', -0.3, y + 0.8, 0.4); TREES.push({ x, z, r: 1.3 }); });
}
