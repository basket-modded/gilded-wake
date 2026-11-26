// The Gilded Wake — art: procedural textures, unified horizon fog, characters, weapons and tools.
// Everything here is modelled from real shapes (lathes, extruded profiles, lofted sections) rather than boxes.

/* ================= TEXTURES ================= */
// tileable value noise for painting canvases
function tnoise(period, seed) {
  const H = (x, z) => { x = ((x % period) + period) % period; z = ((z % period) + period) % period; const s = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453; return s - Math.floor(s); };
  return (x, z) => { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
    return lerp(lerp(H(ix, iz), H(ix + 1, iz), ux), lerp(H(ix, iz + 1), H(ix + 1, iz + 1), ux), uz); };
}
function tfbm(n, x, z, oct = 4) { let s = 0, a = 0.5, f = 1, t = 0; for (let i = 0; i < oct; i++) { s += a * n(x * f, z * f); t += a; a *= 0.5; f *= 2; } return s / t; }
function paint(w, h, fn, alpha) {
  const [c, g] = cnv(w, h); const img = g.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = (y * w + x) * 4; const r = fn(x, y); d[o] = r[0]; d[o + 1] = r[1]; d[o + 2] = r[2]; d[o + 3] = alpha ? r[3] : 255; }
  g.putImageData(img, 0, 0); return [c, g];
}
const linTex = (c, rep = true) => { const t = new THREE.CanvasTexture(c); if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = ANISO; return t; };
const srgbTex = (c, rep = true) => { const t = linTex(c, rep); t.encoding = THREE.sRGBEncoding; return t; };
const ART = {};
{
  const N1 = tnoise(16, 1), N2 = tnoise(64, 2), N3 = tnoise(32, 3), N4 = tnoise(8, 4);
  // sand: warm grains, faint wind ripples
  ART.sand = paint(256, 256, (x, y) => { const u = x / 256, v = y / 256; const b = tfbm(N2, u * 64, v * 64, 3), gr = Math.random(); const rip = Math.sin((v * 22 + tfbm(N1, u * 16, v * 16, 2) * 3) * TAU) * 0.5 + 0.5;
    const k = 0.86 + b * 0.16 + (gr - 0.5) * 0.12 + rip * 0.04; return [228 * k, 205 * k, 158 * k]; })[0];
  // grass: tufty greens with dry patches
  ART.grass = paint(256, 256, (x, y) => { const u = x / 256, v = y / 256; const b = tfbm(N3, u * 32, v * 32, 4), dry = tfbm(N1, u * 16 + 3, v * 16, 3), gr = Math.random();
    const blade = Math.pow(Math.random(), 3) * 0.35; const k = 0.72 + b * 0.45 + blade - gr * 0.12;
    return [lerp(58, 118, dry * dry) * k, lerp(104, 112, dry) * k, lerp(38, 52, dry) * k]; })[0];
  // rock: layered, cracked
  ART.rock = paint(256, 256, (x, y) => { const u = x / 256, v = y / 256; const b = tfbm(N2, u * 64, v * 64, 5); const strata = Math.sin((v * 9 + b * 2.2) * TAU) * 0.5 + 0.5; const crack = Math.abs(tfbm(N3, u * 32, v * 32, 3) - 0.5) < 0.02 ? 0.55 : 1;
    const k = (0.55 + b * 0.55 + strata * 0.12) * crack * (0.92 + Math.random() * 0.12); return [128 * k, 120 * k, 108 * k]; })[0];
  ART.dirt = paint(256, 256, (x, y) => { const u = x / 256, v = y / 256; const b = tfbm(N3, u * 32, v * 32, 4); const peb = Math.random() < 0.012 ? 1.35 : 1; const k = (0.7 + b * 0.5) * peb * (0.9 + Math.random() * 0.15); return [118 * k, 92 * k, 64 * k]; })[0];
  ART.wetrock = null;
}
const TEX = {
  sand: linTex(ART.sand), grass: linTex(ART.grass), rock: linTex(ART.rock), dirt: linTex(ART.dirt),
};
// textures for models (sRGB)
function canvasTex(w, h, draw, rep = true) { const [c, g] = cnv(w, h); draw(g, w, h); return srgbTex(c, rep); }
TEX.fabric = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.04})`; g.fillRect(0, y, w, 1); } for (let x = 0; x < w; x += 2) { g.fillStyle = `rgba(255,255,255,${0.04 + Math.random() * 0.04})`; g.fillRect(x, 0, 1, h); } for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(60,40,20,${Math.random() * 0.06})`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 4 + Math.random() * 14, 0, TAU); g.fill(); } });
TEX.leather = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#d0d0d0'; g.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 1); } for (let i = 0; i < 12; i++) { g.strokeStyle = 'rgba(0,0,0,0.12)'; g.beginPath(); g.moveTo(Math.random() * w, Math.random() * h); g.lineTo(Math.random() * w, Math.random() * h); g.stroke(); } });
TEX.wood = canvasTex(64, 256, (g, w, h) => { g.fillStyle = '#c9c9c9'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 1) { g.fillStyle = `rgba(40,20,0,${0.05 + 0.08 * Math.abs(Math.sin(x * 0.7 + Math.sin(x * 0.13) * 3))})`; g.fillRect(x, 0, 1, h); } for (let i = 0; i < 5; i++) { const y = Math.random() * h, x = Math.random() * w; g.fillStyle = 'rgba(30,15,0,0.25)'; g.beginPath(); g.ellipse(x, y, 2, 6, 0, 0, TAU); g.fill(); } });
TEX.bark = canvasTex(128, 256, (g, w, h) => { const grd = g.createLinearGradient(0, 0, w, 0); grd.addColorStop(0, '#5a4630'); grd.addColorStop(0.5, '#7b6446'); grd.addColorStop(1, '#5a4630'); g.fillStyle = grd; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 9 + Math.random() * 5) { g.fillStyle = 'rgba(30,20,10,0.55)'; g.fillRect(0, y, w, 2 + Math.random() * 2); g.fillStyle = 'rgba(160,130,90,0.25)'; g.fillRect(0, y + 3, w, 1); for (let x = 0; x < w; x += 6) { g.fillStyle = `rgba(20,10,0,${Math.random() * 0.25})`; g.fillRect(x, y - 3, 3, 4); } } });
TEX.trunk = canvasTex(128, 256, (g, w, h) => { g.fillStyle = '#5d4b3a'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 3) { g.fillStyle = `rgba(${20 + Math.random() * 40},${15 + Math.random() * 30},10,${0.3 + Math.random() * 0.3})`; g.fillRect(x, 0, 2, h); } for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(80,90,50,0.18)'; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 6 + Math.random() * 10, 0, TAU); g.fill(); } });
// palm frond leaf: a rib with angled leaflets, alpha-cut
TEX.frond = canvasTex(512, 128, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  for (let x = 12; x < w - 4; x += 7) { const t = x / w, L = (Math.sin(t * Math.PI) * 0.9 + 0.1) * (h * 0.48);
    for (const s of [-1, 1]) { const gr = g.createLinearGradient(x, h / 2, x + L * 0.5, h / 2 + s * L); gr.addColorStop(0, '#3d6a26'); gr.addColorStop(1, t > 0.85 ? '#7a8a3a' : '#5d8f33'); g.strokeStyle = gr; g.lineWidth = 4.2 * (1 - t * 0.5); g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, h / 2); g.quadraticCurveTo(x + L * 0.28, h / 2 + s * L * 0.55, x + L * 0.55, h / 2 + s * L * 0.98); g.stroke(); } }
  g.strokeStyle = '#8a7a42'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
}, false);
// broadleaf cluster
TEX.leaves = canvasTex(256, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  for (let i = 0; i < 120; i++) { const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * 104, x = w / 2 + Math.cos(a) * r, y = h / 2 + Math.sin(a) * r * 0.9, s = 10 + Math.random() * 16, ang = Math.random() * TAU;
    const c = [40 + Math.random() * 40, 85 + Math.random() * 50, 25 + Math.random() * 25]; g.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
    g.save(); g.translate(x, y); g.rotate(ang); g.beginPath(); g.moveTo(0, -s); g.quadraticCurveTo(s * 0.6, 0, 0, s); g.quadraticCurveTo(-s * 0.6, 0, 0, -s); g.fill(); g.strokeStyle = 'rgba(20,40,10,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -s); g.lineTo(0, s); g.stroke(); g.restore(); }
}, false);
TEX.tuft = canvasTex(128, 128, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  for (let i = 0; i < 46; i++) { const x0 = w / 2 + (Math.random() - 0.5) * w * 0.7, lean = (Math.random() - 0.5) * 50, top = h * (0.05 + Math.random() * 0.45);
    const c = [80 + Math.random() * 60, 135 + Math.random() * 50, 45 + Math.random() * 30]; g.strokeStyle = `rgb(${c[0]},${c[1]},${c[2]})`; g.lineWidth = 2 + Math.random() * 1.5;
    g.beginPath(); g.moveTo(x0, h); g.quadraticCurveTo(x0 + lean * 0.3, (h + top) / 2, x0 + lean, top); g.stroke(); }
}, false);
TEX.fern = canvasTex(256, 64, (g, w, h) => {
  g.clearRect(0, 0, w, h); g.strokeStyle = '#3a5f24'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
  for (let x = 6; x < w - 4; x += 5) { const t = x / w, L = Math.sin(t * Math.PI) * h * 0.45 + 2; g.strokeStyle = `rgb(${50 + t * 30},${100 + t * 30},40)`; g.lineWidth = 3; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(x, h / 2); g.lineTo(x + 6, h / 2 + s * L); g.stroke(); } }
}, false);
TEX.plaster = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#e2d6bd'; g.fillRect(0, 0, w, h); for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '90,70,40'},${Math.random() * 0.07})`; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
  for (let i = 0; i < 10; i++) { const x = Math.random() * w; const gr = g.createLinearGradient(0, h * 0.5, 0, h); gr.addColorStop(0, 'rgba(90,70,40,0)'); gr.addColorStop(1, 'rgba(90,70,40,0.18)'); g.fillStyle = gr; g.fillRect(x, h * 0.5, 10 + Math.random() * 30, h * 0.5); } });
TEX.tiles = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#7d3524'; g.fillRect(0, 0, w, h); const rows = 8, cols = 8;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const x = c * w / cols + (r % 2) * w / cols / 2, y = r * h / rows; const k = 0.8 + Math.random() * 0.35; const gr = g.createLinearGradient(x, y, x, y + h / rows); gr.addColorStop(0, `rgb(${170 * k},${80 * k},${50 * k})`); gr.addColorStop(1, `rgb(${110 * k},${48 * k},${30 * k})`);
    g.fillStyle = gr; g.beginPath(); g.ellipse(x + w / cols / 2, y + h / rows * 0.55, w / cols * 0.48, h / rows * 0.62, 0, 0, Math.PI); g.fill(); g.fillRect(x + 1, y, w / cols - 2, h / rows * 0.55); } });
TEX.stone = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#5c5650'; g.fillRect(0, 0, w, h); let y = 0;
  while (y < h) { const rh = 22 + Math.random() * 18; let x = -Math.random() * 30; while (x < w) { const rw = 30 + Math.random() * 40, k = 0.75 + Math.random() * 0.4; g.fillStyle = `rgb(${150 * k},${142 * k},${128 * k})`; g.beginPath(); g.roundRect ? g.roundRect(x + 2, y + 2, rw - 4, rh - 4, 5) : g.rect(x + 2, y + 2, rw - 4, rh - 4); g.fill();
      for (let i = 0; i < 20; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`; g.fillRect(x + Math.random() * rw, y + Math.random() * rh, 3, 2); } x += rw; } y += rh; } });
TEX.timber = canvasTex(256, 256, (g, w, h) => { for (let x = 0; x < w; x += 32) { const k = 0.8 + Math.random() * 0.3; g.fillStyle = `rgb(${120 * k},${84 * k},${52 * k})`; g.fillRect(x, 0, 32, h); g.fillStyle = 'rgba(25,14,6,0.8)'; g.fillRect(x, 0, 2, h);
  for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(40,20,5,${Math.random() * 0.2})`; g.fillRect(x + 3 + Math.random() * 26, Math.random() * h, 1, 20 + Math.random() * 40); } g.fillStyle = 'rgba(20,12,6,0.6)'; g.beginPath(); g.arc(x + 16, 20 + Math.random() * 10, 2, 0, TAU); g.arc(x + 16, h - 24, 2, 0, TAU); g.fill(); } });
TEX.canvasStripe = (a, b) => canvasTex(128, 64, (g, w, h) => { for (let x = 0; x < w; x += 16) { g.fillStyle = (x / 16) % 2 ? a : b; g.fillRect(x, 0, 16, h); } for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } });

/* ================= UNIFIED HORIZON FOG ================= */
// Every lit material fades into the same sky colour the sea and terrain use, so nothing pops against the haze.
const U_UNDER = { value: 0 };
const FOG_U = { uSunDir: { value: sunDir }, uSunI: sunI, uNight: U_NIGHT, uFogW: U_FOG, uMoonDir: U_MOON };
function patchFog(sh) {
  if (sh.__fog || !sh.fragmentShader.includes('#include <fog_fragment>') || !sh.fragmentShader.includes('vViewPosition')) return;
  sh.__fog = 1;
  Object.assign(sh.uniforms, { uSunDir: FOG_U.uSunDir, uSunI: { get value() { return sunI.v; } }, uNight: U_NIGHT, uFogW: U_FOG, uMoonDir: U_MOON, uUnder: U_UNDER });
  sh.fragmentShader = sh.fragmentShader.replace('void main() {', SKY_GLSL + '\nuniform float uUnder;\nvoid main() {').replace('#include <fog_fragment>',
    `if (uUnder > 0.5) { float uf = 1.0 - exp(-length(vViewPosition) * 0.075); gl_FragColor.rgb = mix(gl_FragColor.rgb * vec3(0.55, 0.85, 0.85), vec3(0.02, 0.12, 0.14) * (0.3 + 0.7 * uSunI), clamp(uf, 0.0, 0.98)); } else { vec3 fdir = (vec4(-vViewPosition, 0.0) * viewMatrix).xyz; float fd = length(fdir); fdir /= max(fd, 1e-4);
       float ff = 1.0 - exp(-fd * (0.00028 + uFogW * 0.006));
       vec3 fc = skyBase(normalize(vec3(fdir.x, 0.03, fdir.z)));
       gl_FragColor.rgb = mix(gl_FragColor.rgb, fc, clamp(ff * 1.15, 0.0, 0.96)); }`);
}
THREE.Material.prototype.onBeforeCompile = function (sh) { patchFog(sh); };

/* ================= WIND (foliage sway) ================= */
const WIND = { value: 0 };
function swayMaterial(mat, amp = 0.15, stiff = 1) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uWind = WIND;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;').replace('#include <begin_vertex>',
      `#include <begin_vertex>
       { vec3 ip = vec3(0.0);
         #ifdef USE_INSTANCING
         ip = instanceMatrix[3].xyz;
         #endif
         float h = max(position.y, 0.0) * ${(1 / stiff).toFixed(3)};
         float ph = uWind * 1.3 + (ip.x + ip.z) * 0.15 + position.x * 0.4;
         transformed.x += sin(ph) * ${amp.toFixed(3)} * h * h * 0.1 + sin(ph * 2.7 + position.z) * 0.03 * h;
         transformed.z += cos(ph * 0.8) * ${(amp * 0.7).toFixed(3)} * h * h * 0.1; }`);
    // keep foliage solid at a distance: boost alpha as the texture minifies
    if (mat.alphaTest > 0 && mat.map) sh.fragmentShader = sh.fragmentShader.replace('#include <alphatest_fragment>', `
      { vec2 dx = dFdx(vUv * 256.0), dy = dFdy(vUv * 256.0); float lod = max(0.0, 0.5 * log2(max(dot(dx, dx), dot(dy, dy))));
        diffuseColor.a *= 1.0 + lod * 0.32; }
      if (diffuseColor.a < ALPHATEST) discard;`);
    patchFog(sh);
  };
  return mat;
}

/* ================= GEOMETRY HELPERS ================= */
// lathe from [radius, y] pairs, with optional elliptical scale
function lathe(pts, seg = 12, sx = 1, sz = 1, phi0 = 0, phiLen = TAU) { const g = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(Math.max(0.0005, p[0]), p[1])), seg, phi0, phiLen); if (sx !== 1 || sz !== 1) g.scale(sx, 1, sz); g.computeVertexNormals(); return g; }
// rounded limb: tapered capsule from y=0 down to y=-len (pivot at the top)
function limb(r0, r1, len, seg = 10, sx = 1, sz = 1) { const P = []; const n = 4;
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI / 2; P.push([r0 * Math.sin(a), r0 * Math.cos(a)]); }
  for (let i = 1; i <= 6; i++) { const t = i / 6; P.push([lerp(r0, r1, t) * (1 + Math.sin(t * Math.PI) * 0.06), -len * t]); }
  for (let i = 1; i <= n; i++) { const a = (i / n) * Math.PI / 2; P.push([r1 * Math.cos(a), -len - r1 * Math.sin(a)]); }
  return lathe(P.reverse(), seg, sx, sz); }
// 2D outline extruded with a thin bevel; outline points [x,y], extruded along Z then turned so width runs along Z
function profile(pts, depth, bevel = 0.002, curveSeg = 1) {
  const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 2, curveSegments: curveSeg });
  g.translate(0, 0, -depth / 2); return g;
}
function bladeGeo(pts, depth) { const g = profile(pts, depth, depth * 0.45); g.rotateY(-Math.PI / 2); return g; } // outline x→Z (edge), y→Y (length)
function torusArc(R, r, arc, seg = 16) { return new THREE.TorusGeometry(R, r, 6, seg, arc); }
function tubeG(points, r, seg = 20, rs = 6) { return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), seg, r, rs, false); }
function stdMat(o) { return new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.8, envMapIntensity: 0.5 }, o)); }

/* ================= CHARACTERS ================= */
const CM = {
  steel: stdMat({ color: 0xb9bdc2, metalness: 0.92, roughness: 0.24, envMapIntensity: 1.1 }),
  dsteel: stdMat({ color: 0x55585e, metalness: 0.85, roughness: 0.35, envMapIntensity: 0.9 }),
  brass: stdMat({ color: 0xc9973f, metalness: 0.9, roughness: 0.3, envMapIntensity: 1 }),
  wood: stdMat({ map: TEX.wood, color: 0x8a5a34, roughness: 0.6 }),
  dwood: stdMat({ map: TEX.wood, color: 0x4a2d18, roughness: 0.55 }),
  ash: stdMat({ map: TEX.wood, color: 0xb88c5c, roughness: 0.7 }),
  leather: stdMat({ map: TEX.leather, color: 0x4a2a16, roughness: 0.75 }),
  bleather: stdMat({ map: TEX.leather, color: 0x1e1713, roughness: 0.6 }),
  cork: stdMat({ color: 0xa8875a, roughness: 1 }),
  glass: stdMat({ color: 0x2d4a33, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.85, envMapIntensity: 1.4 }),
  amberGlass: stdMat({ color: 0x5a2e10, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.88, envMapIntensity: 1.4 }),
  lens: stdMat({ color: 0x9fc3d8, roughness: 0.05, metalness: 0.4, envMapIntensity: 2 }),
  paper: stdMat({ color: 0xd9c49a, roughness: 0.95 }),
  red: stdMat({ color: 0x9a2a1c, roughness: 0.7 }),
  rope: stdMat({ color: 0x8a7350, roughness: 1 }),
  eye: stdMat({ color: 0x18120e, roughness: 0.2, envMapIntensity: 1.2 }),
  white: stdMat({ color: 0xece4d6, roughness: 0.6 }),
  ghost: new THREE.MeshStandardMaterial({ color: 0x7dffc8, emissive: 0x2aa87a, emissiveIntensity: 0.6, transparent: true, opacity: 0.5, depthWrite: false, roughness: 1 }),
};
const SKIN = ['#e3b694', '#c99272', '#a8724f', '#7d5038', '#5b3826'];
const HAIR = ['#1c1410', '#3a2514', '#6b4424', '#9a6b3a', '#c8c0b0', '#5a1f12'];
const matCache = new Map();
function clothMat(color, kind = 'fabric') { const k = color + kind; if (!matCache.has(k)) matCache.set(k, stdMat({ map: kind === 'leather' ? TEX.leather : TEX.fabric, color, roughness: kind === 'leather' ? 0.7 : 0.92, envMapIntensity: 0.35 })); return matCache.get(k); }
function skinMat(c) { const k = 'skin' + c; if (!matCache.has(k)) matCache.set(k, stdMat({ color: c, roughness: 0.62, envMapIntensity: 0.4 })); return matCache.get(k); }

// geometry shared by every character (metres; a man stands ~1.78 m)
const CG = (() => {
  const G = {};
  // breeches: pelvis block made of a lathe, oval
  G.pelvis = lathe([[0.001, -0.1], [0.15, -0.09], [0.175, -0.02], [0.17, 0.06], [0.15, 0.1], [0.001, 0.1]], 14, 1.15, 0.8);
  G.thigh = limb(0.085, 0.062, 0.42, 10, 1, 1.05);
  G.shin = limb(0.06, 0.045, 0.40, 10, 1, 1.05);
  // knee-high boot with a turned-down cuff
  G.boot = merge([lathe([[0.001, -0.42], [0.058, -0.42], [0.062, -0.3], [0.066, -0.12], [0.074, -0.02], [0.088, 0.02], [0.09, 0.07], [0.079, 0.08], [0.07, 0.04], [0.001, 0.04]], 12, 1, 1.1)]);
  G.foot = (() => { const g = lathe([[0.001, -0.13], [0.04, -0.12], [0.05, -0.05], [0.052, 0.05], [0.045, 0.1], [0.025, 0.13], [0.001, 0.135]], 10, 1.05, 0.62); g.rotateX(Math.PI / 2); g.translate(0, -0.035, 0.07); return g; })();
  G.heel = new THREE.BoxGeometry(0.075, 0.035, 0.07); G.heel.translate(0, -0.088, -0.035);
  // torso: shirt / waistcoat body, oval, wider at the chest
  G.torso = lathe([[0.001, -0.02], [0.15, -0.02], [0.155, 0.08], [0.165, 0.2], [0.183, 0.31], [0.186, 0.37], [0.172, 0.43], [0.135, 0.49], [0.075, 0.53], [0.001, 0.54]], 16, 1.12, 0.72);
  // long coat: open at the front (phi gap), skirts to the knee, flaring
  const gap = 0.62;
  G.coatTop = lathe([[0.168, -0.02], [0.17, 0.08], [0.18, 0.2], [0.198, 0.31], [0.2, 0.37], [0.185, 0.43], [0.145, 0.495], [0.08, 0.545]], 18, 1.12, 0.76, Math.PI / 2 + gap / 2, TAU - gap);
  G.coatSkirt = lathe([[0.178, 0.04], [0.19, -0.05], [0.215, -0.2], [0.25, -0.38], [0.285, -0.55]], 18, 1.15, 0.82, Math.PI / 2 + gap * 0.9, TAU - gap * 1.8);
  G.lapel = (() => { const g = profile([[0, 0], [0.07, 0.03], [0.055, 0.22], [0.0, 0.3]], 0.012, 0.003); return g; })();
  G.vest = lathe([[0.158, -0.02], [0.16, 0.08], [0.17, 0.2], [0.186, 0.32], [0.19, 0.38]], 16, 1.13, 0.74);
  G.belt = new THREE.TorusGeometry(0.165, 0.022, 6, 22); G.belt.rotateX(Math.PI / 2); G.belt.scale(1.13, 1, 0.76);
  G.buckle = merge([xf(new THREE.TorusGeometry(0.03, 0.007, 4, 4), 0, 0, 0, 0, 0, Math.PI / 4)]);
  G.sash = (() => { const g = new THREE.TorusGeometry(0.17, 0.045, 6, 22); g.rotateX(Math.PI / 2); g.scale(1.14, 0.9, 0.78); return g; })();
  G.sashTail = tubeG([[0, 0, 0], [0.03, -0.12, 0.02], [0.02, -0.26, 0.03]], 0.03, 8, 5);
  G.baldric = tubeG([[0.17, 0.44, 0.06], [0.05, 0.28, 0.14], [-0.12, 0.05, 0.13], [-0.19, -0.04, 0.02]], 0.022, 16, 4);
  G.button = new THREE.SphereGeometry(0.011, 6, 4);
  G.neck = limb(0.055, 0.06, 0.08, 10);
  G.collar = lathe([[0.07, 0], [0.085, 0.03], [0.075, 0.06]], 12);
  // head: skull + jaw blended into one oval
  G.head = (() => { const g = new THREE.SphereGeometry(0.1, 20, 16); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      x *= 0.92; y *= 1.18; z *= 1.02; if (y < 0) { x *= 1 + y * 1.1; z *= 1 + y * 0.6; if (z > 0) z += -y * 0.12; } if (z > 0.04 && y > -0.02 && y < 0.06) z -= 0.008; p.setXYZ(i, x, y, z); }
    g.computeVertexNormals(); return g; })();
  G.nose = (() => { const g = new THREE.ConeGeometry(0.018, 0.05, 6); g.rotateX(-Math.PI / 2 - 0.5); g.translate(0, -0.005, 0.098); return g; })();
  G.ear = (() => { const g = new THREE.SphereGeometry(0.022, 8, 6); g.scale(0.45, 1, 0.8); return g; })();
  G.eye = new THREE.SphereGeometry(0.011, 8, 6);
  G.brow = new THREE.BoxGeometry(0.035, 0.008, 0.01);
  G.beard = (() => { const g = new THREE.SphereGeometry(0.1, 14, 10, 0, TAU, Math.PI * 0.5, Math.PI * 0.45); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { let x = p.getX(i), y = p.getY(i), z = p.getZ(i); x *= 0.95; z = z * 1.05 + (z > 0 ? 0.01 : 0); y = y * 1.3 - 0.005; p.setXYZ(i, x, y, z); } g.computeVertexNormals(); return g; })();
  G.mustache = tubeG([[-0.04, -0.035, 0.092], [-0.015, -0.025, 0.104], [0.015, -0.025, 0.104], [0.04, -0.035, 0.092]], 0.008, 10, 4);
  // hair: a cap over the crown (stopping above the brow) plus the back and sides down to the nape
  G.hair = (() => { const top = new THREE.SphereGeometry(0.108, 18, 8, 0, TAU, 0, Math.PI * 0.34); const back = new THREE.SphereGeometry(0.109, 18, 8, Math.PI * 0.85, Math.PI * 1.3, Math.PI * 0.3, Math.PI * 0.36);
    const g = merge([top, back]); g.scale(0.96, 1.18, 1.06); g.translate(0, 0.004, -0.004); return g; })();
  G.queue = tubeG([[0, 0.0, -0.1], [0, -0.06, -0.12], [0, -0.16, -0.11]], 0.018, 8, 5);
  // tricorn: a round brim cocked up into three points, with a crown
  G.tricorn = (() => { const brim = new THREE.RingGeometry(0.085, 0.215, 36, 3); brim.rotateX(-Math.PI / 2); const p = brim.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z), a = Math.atan2(z, x); const u = clamp((r - 0.085) / 0.13, 0, 1); const cock = Math.pow(Math.abs(Math.cos(1.5 * (a + Math.PI / 2))), 0.6);
        const lift = u * u * (0.11 - 0.06 * cock); const pull = 1 - u * 0.22 * (1 - cock); p.setXYZ(i, x * pull, lift, z * pull); }
      brim.computeVertexNormals(); const crown = lathe([[0.095, 0], [0.098, 0.05], [0.09, 0.1], [0.06, 0.125], [0.001, 0.13]], 18, 1, 1.08); return { brim, crown }; })();
  G.bicorn = (() => { const s = profile([[-0.24, 0], [-0.12, 0.09], [0, 0.15], [0.12, 0.09], [0.24, 0], [0, 0.02]], 0.12, 0.01, 4); s.rotateY(Math.PI / 2); return s; })();
  G.bandana = (() => { const g = new THREE.SphereGeometry(0.109, 18, 10, 0, TAU, 0, Math.PI * 0.4); g.scale(0.96, 1.15, 1.06); return g; })();
  G.knot = tubeG([[0, 0.02, -0.1], [0.02, -0.05, -0.14], [0.05, -0.13, -0.13]], 0.016, 8, 4);
  G.feather = (() => { const g = profile([[0, 0], [0.025, 0.08], [0.02, 0.22], [0.0, 0.28], [-0.012, 0.2], [-0.01, 0.06]], 0.004, 0.001); return g; })();
  // arms: sleeve, rolled cuff and a hand with fingers and thumb
  G.upper = limb(0.058, 0.048, 0.28, 10, 1, 1.05);
  G.fore = limb(0.047, 0.037, 0.25, 10, 1, 1.05);
  G.cuff = lathe([[0.048, 0.02], [0.062, -0.01], [0.063, -0.05], [0.05, -0.065]], 12);
  // a closed fist around a grip running along +Z at y = -0.06 (where held items attach)
  G.fist = (() => { const L = []; const palm = new THREE.SphereGeometry(0.04, 12, 10); palm.scale(0.95, 1.15, 0.62); palm.translate(-0.006, -0.035, -0.004); L.push(palm);
    for (let i = 0; i < 4; i++) { const z = -0.026 + i * 0.0175, r = 0.022 - Math.abs(i - 1.3) * 0.0012; const f = new THREE.TorusGeometry(r, 0.0098, 6, 10, Math.PI * 1.35); f.rotateZ(-Math.PI * 0.15); f.translate(0, -0.06, z); L.push(f);
      const k = new THREE.SphereGeometry(0.011, 6, 5); k.translate(0.021, -0.045, z); L.push(k); }
    const th = new THREE.TorusGeometry(0.02, 0.011, 6, 8, Math.PI * 0.9); th.rotateY(Math.PI / 2); th.rotateX(0.4); th.translate(-0.022, -0.055, 0.03); L.push(th);
    return merge(L); })();
  G.palm = (() => { const g = new THREE.SphereGeometry(0.045, 10, 8); g.scale(0.85, 1.05, 0.45); g.translate(0, -0.045, 0); return g; })();
  G.fingers = (() => { const L = []; for (let i = 0; i < 4; i++) { const f = limb(0.0105, 0.009, 0.055 - Math.abs(i - 1.5) * 0.006, 6); f.rotateX(0.9); L.push(xf(f, -0.026 + i * 0.017, -0.085, 0.006)); } return merge(L); })();
  G.thumb = (() => { const f = limb(0.012, 0.01, 0.045, 6); f.rotateZ(0.7); f.rotateX(0.6); f.translate(-0.035, -0.035, 0.018); return f; })();
  return G;
})();

function makeAvatar(o = {}) {
  const rs = srng(o.seed != null ? o.seed : (Math.random() * 1e9) | 0);
  const pick = a => a[(rs() * a.length) | 0];
  const ghost = !!o.ghost;
  const skin = ghost ? CM.ghost : skinMat(o.skin || pick(SKIN));
  const coatC = o.coat || '#7a2e1f';
  const style = o.style || (o.hat === 0 ? 'sailor' : o.hat === 2 ? 'navy' : (o.hat ? 'captain' : 'sailor'));
  const coatM = ghost ? CM.ghost : clothMat(coatC);
  const shirtM = ghost ? CM.ghost : clothMat(pick(['#e8dfcc', '#d9ccb0', '#cfc6b4', '#bfa98a']));
  const vestM = ghost ? CM.ghost : clothMat(pick(['#5b2b22', '#2e3b2a', '#3d2f4a', '#6a5a3a', '#262626']));
  const breechM = ghost ? CM.ghost : clothMat(pick(['#3a3028', '#5a4a36', '#2b2a30', '#6e6250', '#e2d8c4']));
  const bootM = ghost ? CM.ghost : CM.bleather;
  const hairM = ghost ? CM.ghost : clothMat(o.hair || pick(HAIR), 'leather');
  const M = (g, m, cast = true) => { const x = new THREE.Mesh(g, m); x.castShadow = cast && !ghost; return x; };

  const root = new THREE.Group(), hip = new THREE.Group(); hip.position.y = 0.95; root.add(hip);
  hip.add(M(CG.pelvis, breechM));
  // legs: hip → knee → ankle
  const mkLeg = sx => { const thigh = new THREE.Group(); thigh.position.set(sx * 0.095, -0.03, 0); hip.add(thigh); thigh.add(M(CG.thigh, breechM));
    const knee = new THREE.Group(); knee.position.y = -0.44; thigh.add(knee); knee.add(M(CG.boot, bootM));
    const foot = new THREE.Group(); foot.position.y = -0.44; knee.add(foot); foot.add(M(CG.foot, bootM)); foot.add(M(CG.heel, bootM)); return { thigh, knee, foot }; };
  const LL = mkLeg(-1), LR = mkLeg(1);
  // spine and chest
  const spine = new THREE.Group(); spine.position.y = 0.06; hip.add(spine);
  const chest = new THREE.Group(); spine.add(chest);
  chest.add(M(CG.torso, style === 'sailor' ? shirtM : vestM));
  if (style !== 'sailor') {
    chest.add(M(CG.coatTop, coatM)); const sk = M(CG.coatSkirt, coatM); chest.add(sk);
    for (const s of [-1, 1]) { const l = M(CG.lapel, coatM); l.position.set(s * 0.06, 0.2, 0.14); l.rotation.set(-0.15, s * 0.25, s * -0.2); l.scale.x = s; chest.add(l); }
    const btnM = style === 'navy' ? CM.brass : CM.brass; for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { const b = M(CG.button, btnM, false); b.position.set(s * 0.085, 0.06 + i * 0.075, 0.138 - i * 0.002); chest.add(b); }
    // shirt front with a cravat showing between the lapels
    const cr = M(new THREE.ConeGeometry(0.035, 0.12, 6), shirtM); cr.position.set(0, 0.44, 0.12); cr.rotation.x = Math.PI + 0.3; chest.add(cr);
  } else {
    const v = M(CG.vest, vestM); chest.add(v);
  }
  const sashOn = style !== 'navy' && rs() < 0.6;
  if (sashOn) { const sm = ghost ? CM.ghost : clothMat(pick(['#8f1f1a', '#2f4f7a', '#c48a2a', '#3e6b45', '#6b3f74'])); chest.add(M(CG.sash, sm)); const t = M(CG.sashTail, sm); t.position.set(0.15, 0, 0.06); chest.add(t); }
  else { chest.add(M(CG.belt, ghost ? CM.ghost : CM.leather)); const bk = M(CG.buckle, CM.brass, false); bk.position.set(0, 0, 0.13); chest.add(bk); }
  if (style !== 'navy' && rs() < 0.7) chest.add(M(CG.baldric, ghost ? CM.ghost : CM.leather));
  // neck and head
  const neck = new THREE.Group(); neck.position.y = 0.53; chest.add(neck); neck.add(M(CG.neck, skin)); const col = M(CG.collar, shirtM); col.position.y = -0.04; neck.add(col);
  const head = new THREE.Group(); head.position.y = 0.17; neck.add(head);
  head.add(M(CG.head, skin)); head.add(M(CG.nose, skin));
  for (const s of [-1, 1]) { const e = M(CG.ear, skin); e.position.set(s * 0.092, 0.005, -0.005); head.add(e);
    const ey = M(CG.eye, ghost ? CM.ghost : CM.eye, false); ey.position.set(s * 0.034, 0.025, 0.088); head.add(ey);
    const br = M(CG.brow, hairM, false); br.position.set(s * 0.035, 0.05, 0.094); br.rotation.z = s * -0.12; head.add(br); }
  const beardRoll = rs();
  if (beardRoll < 0.45) head.add(M(CG.beard, hairM)); else if (beardRoll < 0.7) head.add(M(CG.mustache, hairM));
  const hatKind = o.hatKind || (style === 'navy' ? 'bicorn' : style === 'captain' ? 'tricorn' : pick(['bandana', 'bandana', 'none', 'tricorn']));
  if (hatKind !== 'bandana') { head.add(M(CG.hair, hairM)); if (rs() < 0.6) head.add(M(CG.queue, hairM)); }
  if (hatKind === 'tricorn') { const hat = new THREE.Group(); hat.position.y = 0.085; hat.rotation.x = -0.08; const hm = ghost ? CM.ghost : clothMat('#1b1613', 'leather'); hat.add(M(CG.tricorn.brim, hm)); hat.add(M(CG.tricorn.crown, hm));
        if (style === 'captain') { const f = M(CG.feather, ghost ? CM.ghost : clothMat('#efe8d8')); f.position.set(0.08, 0.06, -0.04); f.rotation.set(-0.5, 0.4, -0.5); hat.add(f); }
    head.add(hat); }
  else if (hatKind === 'bicorn') { const hat = M(CG.bicorn, ghost ? CM.ghost : clothMat('#151515', 'leather')); hat.position.y = 0.09; head.add(hat); const ck = M(new THREE.CircleGeometry(0.025, 10), CM.brass); ck.position.set(0.0, 0.16, 0.065); head.add(ck); }
  else if (hatKind === 'bandana') { const bm = ghost ? CM.ghost : clothMat(pick(['#8f1f1a', '#2f4f7a', '#c48a2a', '#e8dfcc', '#3e6b45'])); head.add(M(CG.bandana, bm)); head.add(M(CG.knot, bm)); }
  // arms: shoulder → elbow → wrist
  const mkArm = sx => { const sh = new THREE.Group(); sh.position.set(sx * 0.198, 0.415, 0); chest.add(sh); sh.add(M(CG.upper, style === 'sailor' ? shirtM : coatM));
    const el = new THREE.Group(); el.position.y = -0.29; sh.add(el); el.add(M(CG.fore, style === 'sailor' ? shirtM : coatM));
    if (style !== 'sailor') { const cf = M(CG.cuff, coatM); cf.position.y = -0.2; el.add(cf); }
    const wr = new THREE.Group(); wr.position.y = -0.265; el.add(wr); const fist = M(CG.fist, skin); fist.scale.x = sx; wr.add(fist);
    const hand = new THREE.Group(); hand.position.set(0, -0.06, 0.012); wr.add(hand); return { sh, el, wr, hand }; };
  const AL = mkArm(-1), AR = mkArm(1);
  const pouch = M(lathe([[0.001, -0.05], [0.05, -0.04], [0.06, 0.01], [0.04, 0.05], [0.012, 0.07], [0.02, 0.08], [0.001, 0.08]], 10), ghost ? CM.ghost : CM.leather); pouch.position.set(0.16, -0.06, 0.08); hip.add(pouch);
  // fewer draw calls: merge each joint's own meshes by material (child joints stay separate so they can still move)
  const joints = []; root.traverse(x => { if (x.isGroup || x === root) joints.push(x); });
  for (const j of joints) { const by = new Map(); for (const c of j.children) if (c.isMesh) { if (!by.has(c.material)) by.set(c.material, []); by.get(c.material).push(c); }
    for (const [mat, list] of by) { if (list.length < 2) continue; const geos = list.map(c => { c.updateMatrix(); const g2 = (c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone()).applyMatrix4(c.matrix); for (const k of Object.keys(g2.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g2.deleteAttribute(k); if (!g2.attributes.uv) g2.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g2.attributes.position.count * 2), 2)); return g2; });
      for (const c of list) j.remove(c); const m = new THREE.Mesh(merge(geos), mat); m.castShadow = !ghost; j.add(m); } }
  root.traverse(x => { if (x.isMesh) x.receiveShadow = false; });
  const av = { root, hip, spine, chest, neck, head, LL, LR, AL, AR, hand: AR.hand, lhand: AL.hand, pouch, ph: rs() * 9, wpn: null, wk: '', pose: {}, style };
  // compatibility handles for older callers
  av.lL = LL.thigh; av.lR = LR.thigh; av.aL = AL.sh; av.aR = AR.sh;
  return av;
}
function setAvatarWeapon(av, k) {
  if (av.wk === k) return; av.wk = k; if (av.wpn) av.hand.remove(av.wpn); av.wpn = k ? weaponMesh(k) : null;
  if (av.wpn) { const it = ITEMS[k] || {}; av.wpn.rotation.set(Math.PI / 2, it.cat === 'gun' ? Math.PI : 0, 0); if (['rum', 'ale', 'bucket', 'keg', 'dynamite', 'flare', 'cigar'].includes(k)) av.wpn.rotation.set(0, 0, 0); av.hand.add(av.wpn); }
}
// pose blending: each call eases joints toward the target pose for this frame
const POSE_KEYS = ['hipY', 'hipX', 'hipZ', 'spX', 'spY', 'spZ', 'hdX', 'hdY', 'tLx', 'tRx', 'tLz', 'tRz', 'kL', 'kR', 'fL', 'fR', 'sLx', 'sRx', 'sLz', 'sRz', 'sLy', 'sRy', 'eL', 'eR', 'wRx', 'wRz', 'rootX'];
function animAvatar(av, s) {
  const t = s.t || 0, sp = s.spd || 0, P = {}; for (const k of POSE_KEYS) P[k] = 0;
  const run = clamp((sp - 2.6) / 2, 0, 1), walk = clamp(sp / 2.2, 0, 1);
  av.ph += (sp * 0.95 + (sp > 0.1 ? 1.2 : 0)) * 0.016 * 2.2;
  const c = av.ph * 2.2, sw = Math.sin(c), cw = Math.cos(c);
  // idle breathing and weight shift
  const br = Math.sin(t * 1.6 + av.ph) * 0.012;
  P.hipY = 0.95 + br * 0.3; P.spX = br; P.sLz = 0.06; P.sRz = -0.06; P.eL = -0.18; P.eR = -0.2; P.sLx = 0.05; P.sRx = 0.05;
  if (sp > 0.1) {
    const st = lerp(0.42, 0.72, run) * walk;
    P.tLx = -sw * st; P.tRx = sw * st;
    P.kL = Math.max(0, cw) * lerp(0.55, 1.25, run) * walk + 0.08; P.kR = Math.max(0, -cw) * lerp(0.55, 1.25, run) * walk + 0.08;
    P.fL = -P.tLx * 0.3; P.fR = -P.tRx * 0.3;
    P.sLx = sw * lerp(0.35, 0.75, run) * walk; P.sRx = -sw * lerp(0.35, 0.75, run) * walk; P.eL = -0.25 - run * 0.9; P.eR = -0.25 - run * 0.9;
    P.hipY = 0.95 - 0.02 * walk - 0.04 * run + Math.abs(cw) * 0.035 * walk; P.spY = sw * 0.12 * walk; P.hipZ = sw * 0.03 * walk; P.spX = 0.04 + run * 0.18;
  }
  if (s.idle && sp < 0.1) { P.hdY = Math.sin(t * 0.35 + av.ph) * 0.45; P.spY = Math.sin(t * 0.21) * 0.08; P.hipZ = Math.sin(t * 0.18) * 0.03; }
  const held = av.wk && ITEMS[av.wk];
  if (held && sp < 3) { P.sRx = Math.min(P.sRx, -0.1); P.eR = -0.75; P.wRx = 0.1; }   // carry the weapon forward, elbow bent
  if (held && ITEMS[av.wk].cat === 'gun' && av.wk !== 'pistol') { P.sLx = -0.55; P.eL = -1.15; P.sLz = -0.35; P.sRx = -0.25; P.eR = -1.1; }
  if (s.helm) { P.sLx = P.sRx = -1.0; P.eL = P.eR = -0.55; P.sLz = 0.25; P.sRz = -0.25; P.spX = 0.08; }
  if (s.aim) { P.sRx = -1.45; P.eR = -0.05; P.sRy = 0.15; if (s.two || (held && ITEMS[av.wk].cat === 'gun' && av.wk !== 'pistol')) { P.sLx = -1.35; P.eL = -0.6; P.sLz = -0.5; P.sLy = 0.4; } P.spY = -0.15; P.hdY = 0.1; }
  if (s.swing > 0) { const k = 1 - s.swing; const wind = k < 0.25 ? k / 0.25 : 1 - (k - 0.25) / 0.75; const strike = k < 0.25 ? 0 : (k - 0.25) / 0.75;
    P.sRx = lerp(-2.4, 0.2, strike) * (k < 0.25 ? wind : 1) + (k < 0.25 ? 0 : 0); P.sRz = lerp(-0.6, 0.2, strike); P.eR = lerp(-1.4, -0.1, strike); P.spY = lerp(0.6, -0.5, strike); P.spX = 0.12; P.wRz = lerp(0.6, -0.4, strike); }
  if (s.block) { P.sRx = -1.25; P.sRz = 0.35; P.eR = -1.3; P.wRz = 1.3; P.spY = -0.2; P.sLx = -0.4; P.eL = -0.9; }
  if (s.dig) { const d = Math.abs(Math.sin(t * 3)); P.sLx = P.sRx = -0.4 - d * 0.8; P.eL = P.eR = -0.6 + d * 0.3; P.spX = 0.45 + d * 0.15; P.kL = P.kR = 0.35; P.tLx = P.tRx = -0.25; P.hipY = 0.88; }
  if (s.wave) { P.sLx = -0.4; P.sLz = -2.5; P.eL = -0.5 + Math.sin(t * 9) * 0.35; P.hdY = 0.15; }
  if (s.dance) { const d = Math.sin(t * 7); P.hipY = 0.93 + Math.abs(d) * 0.06; P.tLx = d > 0 ? -0.9 * d : 0; P.kL = d > 0 ? 1.4 * d : 0; P.tRx = d < 0 ? 0.9 * d : 0; P.kR = d < 0 ? -1.4 * d : 0; P.sLz = -1.0 + Math.sin(t * 3.5) * 0.4; P.sRz = 1.0 + Math.sin(t * 3.5 + 1) * 0.4; P.eL = P.eR = -1.2; P.spY = Math.sin(t * 3.5) * 0.4; P.hdX = 0.1; }
  if (s.drunk) { P.spZ += Math.sin(t * 1.7) * 0.18 * s.drunk; P.hdX += Math.sin(t * 1.1) * 0.15 * s.drunk; P.hipZ += Math.sin(t * 0.9) * 0.06 * s.drunk; }
  if (s.sit) { P.hipY = 0.5; P.tLx = P.tRx = -1.5; P.kL = P.kR = 1.45; P.fL = P.fR = 0.1; P.spX = 0.05; P.sLx = P.sRx = -0.45; P.eL = P.eR = -0.9; P.tLz = 0.08; P.tRz = -0.08; }
  if (s.swim) { P.rootX = -1.25; P.hipY = 0.95; P.tLx = Math.sin(t * 6) * 0.45; P.tRx = -P.tLx; P.kL = 0.3 + Math.max(0, Math.sin(t * 6)) * 0.5; P.kR = 0.3 + Math.max(0, -Math.sin(t * 6)) * 0.5;
    P.sLx = -Math.PI + ((t * 2.4) % TAU); P.sRx = -Math.PI + ((t * 2.4 + Math.PI) % TAU); P.eL = P.eR = -0.25; P.hdX = -0.9; P.spY = Math.sin(t * 2.4) * 0.25; }
  if (s.dead) { P.rootX = -1.52; P.hipY = 0.18; P.sLz = 1.2; P.sRz = -1.1; P.eL = -0.3; P.eR = -0.5; P.kL = 0.4; P.hdY = 0.5; }
  // blend (snappy for attacks, smooth for the rest)
  const Q = av.pose, a = s.swing > 0 || s.block ? 0.55 : s.swim ? 0.2 : 0.3;
  for (const k of POSE_KEYS) { const v = P[k]; Q[k] = Q[k] == null ? v : (k === 'sLx' || k === 'sRx') && s.swim ? v : Q[k] + (v - Q[k]) * a; }
  av.root.rotation.x = Q.rootX; av.hip.position.y = Q.hipY; av.hip.rotation.set(Q.hipX, 0, Q.hipZ);
  av.spine.rotation.set(Q.spX, Q.spY, Q.spZ); av.head.rotation.set(Q.hdX, Q.hdY, 0); av.neck.rotation.x = -Q.spX * 0.5;
  av.LL.thigh.rotation.set(Q.tLx, 0, Q.tLz); av.LR.thigh.rotation.set(Q.tRx, 0, Q.tRz); av.LL.knee.rotation.x = Q.kL; av.LR.knee.rotation.x = Q.kR; av.LL.foot.rotation.x = Q.fL - Q.kL * 0.3; av.LR.foot.rotation.x = Q.fR - Q.kR * 0.3;
  av.AL.sh.rotation.set(Q.sLx, Q.sLy, Q.sLz); av.AR.sh.rotation.set(Q.sRx, Q.sRy, Q.sRz); av.AL.el.rotation.x = Q.eL; av.AR.el.rotation.x = Q.eR; av.AR.wr.rotation.set(Q.wRx, 0, Q.wRz);
}

/* ================= WEAPONS & TOOLS ================= */
// Weapon space: grip at the origin, blade / barrel along +Y, cutting edge toward +Z, flats facing ±X.
const WG = {};
function wcache(k, f) { return WG[k] || (WG[k] = f()); }
const grip = (len, r = 0.016) => { const P = [[0.001, 0], [r * 1.1, 0.004]]; const n = Math.round(len / 0.012); for (let i = 0; i <= n; i++) P.push([r * (1 + 0.12 * Math.sin(i * Math.PI)) * (1 + Math.sin(i / n * Math.PI) * 0.12), 0.006 + i / n * (len - 0.012)]); P.push([r * 1.1, len - 0.004], [0.001, len]); return lathe(P, 8); };
const pommel = r => { const g = new THREE.SphereGeometry(r, 10, 8); g.scale(1, 1.15, 1); return g; };
function W(parts) { const g = new THREE.Group(); for (const [geo, mat, x, y, z, rx, ry, rz] of parts) { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.rotation.set(rx || 0, ry || 0, rz || 0); m.castShadow = true; g.add(m); } return g; }
const BUILD_W = {
  cutlass: () => { const G = wcache('cutlass', () => ({
      blade: bladeGeo([[-0.012, 0], [0.026, 0], [0.03, 0.2], [0.036, 0.42], [0.048, 0.56], [0.05, 0.62], [0.03, 0.665], [0.012, 0.66], [0.0, 0.62], [-0.016, 0.5], [-0.02, 0.3], [-0.016, 0.1]], 0.006),
      shell: (() => { const g = new THREE.SphereGeometry(0.065, 16, 10, 0, TAU, 0, Math.PI * 0.42); g.scale(1, 0.6, 1.25); return g; })(),
      bow: torusArc(0.07, 0.0055, Math.PI * 1.05, 16), grip: grip(0.11, 0.0155), pom: pommel(0.018) }));
    return W([[G.blade, CM.steel, 0, 0.012, 0.004], [G.shell, CM.brass, 0, 0.0, 0.012, Math.PI, 0, 0], [G.bow, CM.brass, 0, -0.06, 0.03, 0, Math.PI / 2, Math.PI / 2 + 0.25], [G.grip, CM.leather, 0, -0.115, 0], [G.pom, CM.brass, 0, -0.12, 0]]); },
  saber: () => { const G = wcache('saber', () => ({
      blade: bladeGeo([[-0.008, 0], [0.018, 0], [0.024, 0.25], [0.03, 0.5], [0.036, 0.7], [0.02, 0.8], [0.004, 0.83], [-0.004, 0.78], [-0.012, 0.55], [-0.012, 0.25]], 0.005),
      guard: (() => { const g = new THREE.CylinderGeometry(0.008, 0.012, 0.13, 6); g.rotateX(Math.PI / 2); return g; })(),
      bow: torusArc(0.068, 0.0045, Math.PI, 18), grip: grip(0.12, 0.014), cap: lathe([[0.001, 0], [0.019, 0.005], [0.016, 0.03], [0.001, 0.035]], 10) }));
    return W([[G.blade, CM.steel, 0, 0.012, 0], [G.guard, CM.brass, 0, 0.004, 0.0], [G.bow, CM.brass, 0, -0.06, 0.05, 0, Math.PI / 2, Math.PI / 2], [G.grip, CM.bleather, 0, -0.12, 0], [G.cap, CM.brass, 0, -0.14, 0]]); },
  rapier: () => { const G = wcache('rapier', () => ({
      blade: (() => { const g = lathe([[0.001, 0], [0.011, 0.01], [0.009, 0.4], [0.006, 0.8], [0.001, 0.98]], 4); g.scale(1, 1, 0.35); g.rotateY(Math.PI / 4); return g; })(),
      quill: (() => { const g = new THREE.CylinderGeometry(0.006, 0.006, 0.24, 6); g.rotateZ(Math.PI / 2); return g; })(),
      cup: (() => { const g = new THREE.SphereGeometry(0.05, 16, 8, 0, TAU, 0, Math.PI / 2); return g; })(),
      ring: new THREE.TorusGeometry(0.045, 0.004, 5, 18), bow: torusArc(0.075, 0.004, Math.PI * 1.1, 18), grip: grip(0.1, 0.012), pom: pommel(0.022) }));
    return W([[G.blade, CM.steel, 0, 0.02, 0], [G.quill, CM.dsteel, 0, 0.012, 0, 0, Math.PI / 2, 0], [G.cup, CM.dsteel, 0, 0.012, 0, Math.PI, 0, 0], [G.ring, CM.dsteel, 0, 0.03, 0.03, 0.6, 0, 0], [G.ring, CM.dsteel, 0, 0.03, -0.03, -0.6, 0, 0], [G.bow, CM.dsteel, 0, -0.055, 0.04, 0, Math.PI / 2, Math.PI / 2 + 0.2], [G.grip, CM.rope, 0, -0.105, 0], [G.pom, CM.dsteel, 0, -0.115, 0]]); },
  dagger: () => { const G = wcache('dagger', () => ({
      blade: bladeGeo([[-0.016, 0], [0.016, 0], [0.02, 0.05], [0.014, 0.17], [0.0, 0.24], [-0.014, 0.17], [-0.02, 0.05]], 0.007),
      guard: (() => { const g = new THREE.CylinderGeometry(0.007, 0.007, 0.085, 6); g.rotateX(Math.PI / 2); return g; })(), grip: grip(0.085, 0.013), pom: pommel(0.016) }));
    return W([[G.blade, CM.steel, 0, 0.008, 0], [G.guard, CM.brass, 0, 0.004, 0], [G.grip, CM.dwood, 0, -0.088, 0], [G.pom, CM.brass, 0, -0.094, 0]]); },
  axe: () => { const G = wcache('axe', () => ({
      haft: lathe([[0.001, -0.18], [0.017, -0.175], [0.016, -0.1], [0.014, 0.2], [0.015, 0.44], [0.016, 0.5], [0.001, 0.51]], 8),
      head: (() => { const g = profile([[-0.03, -0.03], [0.02, -0.025], [0.05, -0.07], [0.115, -0.1], [0.14, -0.04], [0.135, 0.04], [0.11, 0.065], [0.05, 0.035], [0.02, 0.03], [-0.03, 0.03], [-0.09, 0.008], [-0.11, 0.0], [-0.09, -0.008]], 0.018, 0.004); g.rotateY(-Math.PI / 2); return g; })(),
      wrap: lathe([[0.018, 0], [0.019, 0.02], [0.018, 0.04], [0.019, 0.06], [0.018, 0.08]], 8) }));
    return W([[G.haft, CM.ash, 0, 0, 0], [G.head, CM.dsteel, 0, 0.45, 0], [G.wrap, CM.leather, 0, -0.06, 0]]); },
  pistol: () => { const G = wcache('pistol', () => ({
      barrel: lathe([[0.001, 0], [0.016, 0], [0.016, 0.06], [0.013, 0.07], [0.012, 0.25], [0.014, 0.255], [0.014, 0.27], [0.008, 0.27], [0.008, 0.26], [0.001, 0.26]], 8),
      stock: (() => { const g = profile([[-0.02, -0.02], [0.03, 0.0], [0.03, 0.2], [0.018, 0.25], [0.0, 0.25], [-0.004, 0.06], [-0.03, 0.0], [-0.075, -0.07], [-0.1, -0.095], [-0.12, -0.08], [-0.105, -0.05], [-0.06, -0.01]], 0.03, 0.006); g.rotateY(-Math.PI / 2); return g; })(),
      lock: new THREE.BoxGeometry(0.008, 0.035, 0.08), cock: profile([[0, 0], [0.01, 0.0], [0.02, 0.03], [0.035, 0.045], [0.03, 0.055], [0.012, 0.04], [0, 0.02]], 0.006, 0.001),
      guard: torusArc(0.022, 0.003, Math.PI * 1.2, 10), cap: (() => { const g = new THREE.SphereGeometry(0.022, 10, 8); g.scale(0.9, 0.8, 1.2); return g; })(), rod: new THREE.CylinderGeometry(0.004, 0.004, 0.2, 5) }));
    // grip below the origin, barrel forward along +Y
    return W([[G.stock, CM.wood, 0, -0.02, 0.0], [G.barrel, CM.dsteel, 0, 0.0, 0.017], [G.lock, CM.dsteel, 0.017, 0.02, 0.01, 0, 0, 0], [G.cock, CM.dsteel, 0.016, -0.01, 0.03, 0, Math.PI / 2, 0], [G.guard, CM.brass, 0, -0.005, -0.02, 0, Math.PI / 2, Math.PI], [G.cap, CM.brass, 0, -0.105, -0.1], [G.rod, CM.dwood, 0, 0.12, -0.006]]); },
  musket: () => { const G = wcache('musket', () => ({
      barrel: lathe([[0.001, 0], [0.016, 0], [0.015, 0.2], [0.012, 0.9], [0.013, 0.92], [0.013, 0.94], [0.007, 0.94], [0.001, 0.93]], 8),
      stock: (() => { const g = profile([[0.0, 0.62], [0.022, 0.62], [0.024, 0.1], [0.03, 0.0], [0.028, -0.06], [-0.01, -0.1], [-0.05, -0.28], [-0.09, -0.44], [-0.02, -0.46], [-0.0, -0.3], [0.006, -0.12], [-0.012, -0.05], [-0.012, 0.1], [-0.006, 0.62]], 0.036, 0.006); g.rotateY(-Math.PI / 2); return g; })(),
      band: lathe([[0.019, 0], [0.019, 0.012]], 10), lock: new THREE.BoxGeometry(0.009, 0.035, 0.11), cock: profile([[0, 0], [0.01, 0.0], [0.02, 0.03], [0.035, 0.045], [0.03, 0.055], [0.012, 0.04], [0, 0.02]], 0.006, 0.001),
      guard: torusArc(0.03, 0.003, Math.PI * 1.1, 10), plate: new THREE.BoxGeometry(0.04, 0.012, 0.075) }));
    return W([[G.stock, CM.wood, 0, 0, -0.012], [G.barrel, CM.dsteel, 0, 0, 0.012], [G.band, CM.brass, 0, 0.3, 0.012], [G.band, CM.brass, 0, 0.55, 0.012], [G.lock, CM.dsteel, 0.019, 0.02, 0.0], [G.cock, CM.dsteel, 0.019, -0.02, 0.025, 0, Math.PI / 2, 0], [G.guard, CM.brass, 0, -0.03, -0.03, 0, Math.PI / 2, Math.PI], [G.plate, CM.brass, 0, -0.465, -0.06]]); },
  blunder: () => { const G = wcache('blunder', () => ({
      barrel: lathe([[0.001, 0], [0.02, 0], [0.019, 0.08], [0.017, 0.3], [0.022, 0.4], [0.034, 0.46], [0.045, 0.49], [0.046, 0.5], [0.036, 0.5], [0.024, 0.45], [0.001, 0.44]], 12),
      stock: (() => { const g = profile([[0.0, 0.32], [0.024, 0.32], [0.026, 0.08], [0.03, 0.0], [0.028, -0.06], [-0.01, -0.1], [-0.05, -0.24], [-0.085, -0.36], [-0.02, -0.38], [0.0, -0.24], [0.006, -0.1], [-0.012, -0.04], [-0.012, 0.08], [-0.006, 0.32]], 0.04, 0.006); g.rotateY(-Math.PI / 2); return g; })(),
      lock: new THREE.BoxGeometry(0.009, 0.035, 0.1), guard: torusArc(0.03, 0.003, Math.PI * 1.1, 10) }));
    return W([[G.stock, CM.dwood, 0, 0, -0.014], [G.barrel, CM.brass, 0, 0.02, 0.014], [G.lock, CM.dsteel, 0.021, 0.02, 0.0], [G.guard, CM.brass, 0, -0.03, -0.03, 0, Math.PI / 2, Math.PI]]); },
  shovel: () => { const G = wcache('shovel', () => ({
      shaft: lathe([[0.001, -0.12], [0.017, -0.118], [0.016, 0.85], [0.022, 0.87], [0.026, 0.95], [0.001, 0.96]], 8),
      grip: (() => { const g = torusArc(0.055, 0.011, Math.PI, 12); return g; })(), bar: (() => { const g = new THREE.CylinderGeometry(0.013, 0.013, 0.11, 6); g.rotateZ(Math.PI / 2); return g; })(),
      blade: (() => { const g = profile([[-0.11, 0.0], [0.11, 0.0], [0.115, -0.2], [0.07, -0.29], [0.0, -0.33], [-0.07, -0.29], [-0.115, -0.2]], 0.004, 0.002, 3); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + Math.pow(p.getX(i) / 0.11, 2) * 0.03); g.computeVertexNormals(); return g; })() }));
    return W([[G.shaft, CM.ash, 0, 0, 0], [G.grip, CM.ash, 0, -0.12, 0, 0, 0, Math.PI], [G.bar, CM.ash, 0, -0.175, 0], [G.blade, CM.dsteel, 0, 1.0, 0, Math.PI, 0, 0]]); },
  rod: () => { const G = wcache('rod', () => ({
      rod: lathe([[0.001, -0.25], [0.014, -0.24], [0.012, 0.2], [0.007, 0.9], [0.003, 1.65], [0.001, 1.7]], 7), cork: lathe([[0.019, -0.24], [0.02, -0.2], [0.018, 0.02], [0.015, 0.06]], 8),
      reel: (() => { const g = new THREE.CylinderGeometry(0.035, 0.035, 0.025, 14); g.rotateZ(Math.PI / 2); return g; })(), guide: new THREE.TorusGeometry(0.008, 0.0015, 4, 8) }));
    const g = W([[G.rod, CM.dwood, 0, 0, 0], [G.cork, CM.cork, 0, 0, 0], [G.reel, CM.brass, 0, 0.04, -0.04]]);
    for (const y of [0.45, 0.85, 1.2, 1.5]) { const r = new THREE.Mesh(G.guide, CM.brass); r.position.set(0, y, -0.012); r.rotation.y = Math.PI / 2; g.add(r); }
    return g; },
  hammer: () => { const G = wcache('hammer', () => ({
      handle: lathe([[0.001, -0.08], [0.016, -0.075], [0.014, 0.15], [0.012, 0.26], [0.001, 0.27]], 8),
      head: (() => { const g = profile([[-0.07, -0.016], [0.035, -0.016], [0.05, -0.02], [0.05, 0.02], [0.035, 0.016], [-0.02, 0.016], [-0.06, 0.04], [-0.09, 0.03], [-0.065, 0.005]], 0.03, 0.004); g.rotateY(-Math.PI / 2); g.rotateX(Math.PI / 2); return g; })() }));
    return W([[G.handle, CM.ash, 0, 0, 0], [G.head, CM.dsteel, 0, 0.26, 0, -Math.PI / 2, 0, 0]]); },
  spyglass: () => { const G = wcache('spyglass', () => ({
      t1: lathe([[0.03, 0], [0.032, 0.01], [0.03, 0.02], [0.029, 0.2], [0.031, 0.21]], 14), t2: lathe([[0.025, 0], [0.027, 0.01], [0.025, 0.02], [0.024, 0.16]], 14), t3: lathe([[0.02, 0], [0.022, 0.012], [0.02, 0.02], [0.019, 0.12], [0.012, 0.13]], 14),
      wrap: lathe([[0.0305, 0.03], [0.0305, 0.17]], 14), lens: new THREE.CircleGeometry(0.027, 14) }));
    return W([[G.t1, CM.brass, 0, 0, 0], [G.wrap, CM.leather, 0, 0, 0], [G.t2, CM.brass, 0, 0.2, 0], [G.t3, CM.brass, 0, 0.35, 0], [G.lens, CM.lens, 0, -0.001, 0, Math.PI / 2, 0, 0]]); },
  bucket: () => { const G = wcache('bucket', () => ({ body: lathe([[0.001, 0], [0.11, 0], [0.13, 0.22], [0.125, 0.22], [0.105, 0.012], [0.001, 0.012]], 16), hoop: new THREE.TorusGeometry(0.12, 0.005, 4, 20), handle: torusArc(0.13, 0.004, Math.PI, 14), water: new THREE.CircleGeometry(0.12, 16) }));
    return W([[G.body, CM.wood, 0, -0.25, 0], [G.hoop, CM.dsteel, 0, -0.21, 0, Math.PI / 2, 0, 0], [G.hoop, CM.dsteel, 0, -0.07, 0, Math.PI / 2, 0, 0], [G.handle, CM.dsteel, 0, -0.03, 0], [G.water, stdMat({ color: 0x3a6a78, roughness: 0.1, metalness: 0.2 }), 0, -0.05, 0, -Math.PI / 2, 0, 0]]); },
  rum: () => { const G = wcache('rum', () => ({ b: lathe([[0.001, 0], [0.04, 0], [0.042, 0.005], [0.042, 0.13], [0.03, 0.17], [0.013, 0.19], [0.012, 0.24], [0.014, 0.245], [0.001, 0.245]], 14), cork: lathe([[0.011, 0], [0.012, 0.03], [0.001, 0.032]], 8), label: lathe([[0.0425, 0.04], [0.0425, 0.1]], 14, 1, 1, -0.9, 1.8) }));
    return W([[G.b, CM.amberGlass, 0, -0.06, 0], [G.cork, CM.cork, 0, 0.18, 0], [G.label, CM.paper, 0, -0.06, 0]]); },
  ale: () => { const G = wcache('ale', () => ({ m: lathe([[0.001, 0], [0.045, 0], [0.047, 0.01], [0.045, 0.13], [0.048, 0.14], [0.04, 0.14], [0.038, 0.02], [0.001, 0.02]], 14), h: torusArc(0.035, 0.007, Math.PI * 1.2, 10), foam: new THREE.CircleGeometry(0.04, 12) }));
    return W([[G.m, CM.wood, 0, -0.05, 0], [G.h, CM.wood, 0, 0.02, -0.048, 0, Math.PI / 2, -Math.PI / 2 - 0.3], [G.foam, CM.white, 0, 0.085, 0, -Math.PI / 2, 0, 0]]); },
  keg: () => { const G = wcache('keg', () => ({ k: lathe([[0.001, -0.2], [0.15, -0.2], [0.18, -0.1], [0.19, 0], [0.18, 0.1], [0.15, 0.2], [0.001, 0.2]], 14), h: new THREE.TorusGeometry(0.183, 0.008, 4, 20), fuse: tubeG([[0, 0.2, 0], [0.03, 0.26, 0.02], [0.06, 0.28, 0.0]], 0.006, 6, 4) }));
    return W([[G.k, CM.wood, 0, 0, 0], [G.h, CM.dsteel, 0, -0.1, 0, Math.PI / 2, 0, 0], [G.h, CM.dsteel, 0, 0.1, 0, Math.PI / 2, 0, 0], [G.fuse, CM.rope, 0, 0, 0]]); },
  dynamite: () => { const G = wcache('dyn', () => ({ s: new THREE.CylinderGeometry(0.016, 0.016, 0.2, 10), band: new THREE.CylinderGeometry(0.036, 0.036, 0.02, 12), fuse: tubeG([[0, 0.1, 0], [0.01, 0.14, 0.01], [0.03, 0.16, -0.01]], 0.003, 6, 4) }));
    const m = stdMat({ color: 0xa8281c, roughness: 0.75 }); return W([[G.s, m, 0.017, 0, 0], [G.s, m, -0.017, 0, 0], [G.s, m, 0, 0, 0.028], [G.band, CM.rope, 0, 0.05, 0.009], [G.band, CM.rope, 0, -0.05, 0.009], [G.fuse, CM.rope, 0, 0, 0.01]]); },
  flare: () => { const G = wcache('flare', () => ({ t: lathe([[0.001, -0.1], [0.022, -0.1], [0.022, 0.1], [0.026, 0.11], [0.026, 0.14], [0.001, 0.14]], 10) }));
    return W([[G.t, stdMat({ color: 0xd8562a, roughness: 0.7 }), 0, 0, 0]]); },
  cigar: () => W([[lathe([[0.001, 0], [0.008, 0.005], [0.009, 0.1], [0.007, 0.12], [0.001, 0.125]], 8), stdMat({ color: 0x5a3a20, roughness: 0.9 }), 0, 0, 0]]),
};
BUILD_W.blunderbuss = BUILD_W.blunder;
function weaponMesh(k) { const f = BUILD_W[k]; if (!f) return null; const g = f(); g.traverse(m => { if (m.isMesh) m.castShadow = true; }); return g; }

/* ================= CREATURES ================= */
// vertex-coloured geometry helper
function colorize(g, f) { const p = g.attributes.position, c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const col = f(p.getX(i), p.getY(i), p.getZ(i)); c[i * 3] = col[0]; c[i * 3 + 1] = col[1]; c[i * 3 + 2] = col[2]; } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; }
// shark: head toward -z, ~3.2 m long; countershaded grey over white
const SHARK_GEO = (() => {
  const N = 28, M = 16, pos = [], idx = [];
  const prof = t => { // t 0 = snout, 1 = tail stock
    const w = t < 0.12 ? Math.sqrt(t / 0.12) * 0.36 : t < 0.45 ? 0.36 + (t - 0.12) * 0.12 : 0.4 * Math.pow(1 - (t - 0.45) / 0.55, 1.4) + 0.045;
    const h = t < 0.12 ? Math.sqrt(t / 0.12) * 0.4 : t < 0.45 ? 0.4 + (t - 0.12) * 0.1 : 0.43 * Math.pow(1 - (t - 0.45) / 0.55, 1.3) + 0.06;
    const cy = t < 0.15 ? -0.06 * (1 - t / 0.15) : 0; return { w, h, cy }; };
  for (let i = 0; i <= N; i++) { const t = i / N, z = -1.55 + t * 2.75, P = prof(t);
    for (let j = 0; j <= M; j++) { const a = j / M * TAU; const sx = Math.cos(a), sy = Math.sin(a); const flat = sy < 0 ? 0.82 : 1; pos.push(sx * P.w, P.cy + sy * P.h * flat, z); } }
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) { const a = i * (M + 1) + j, b = a + M + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const body = new THREE.BufferGeometry(); body.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); body.setIndex(idx); body.computeVertexNormals();
  const fin = (pts, th) => { const g = profile(pts, th, th * 0.4, 3); return g; };
  const L = [body];
  // first dorsal: tall, swept back with a curved trailing edge
  L.push(xf(fin([[0, 0], [0.5, 0], [0.36, 0.08], [0.48, 0.55], [0.3, 0.6], [0.05, 0.18]], 0.035), 0, 0.33, -0.25, 0, -Math.PI / 2, 0));
  L.push(xf(fin([[0, 0], [0.16, 0], [0.13, 0.12], [0.06, 0.14]], 0.02), 0, 0.2, 0.62, 0, -Math.PI / 2, 0));     // second dorsal
  L.push(xf(fin([[0, 0], [0.14, 0], [0.12, -0.11], [0.05, -0.12]], 0.02), 0, -0.17, 0.66, 0, -Math.PI / 2, 0)); // anal
  for (const s of [-1, 1]) {
    L.push(xf(fin([[0, 0], [0.38, 0.02], [0.62, -0.08], [0.5, -0.06], [0.06, -0.12]], 0.03), s * 0.3, -0.15, -0.55, Math.PI / 2 + 0.25, 0, -s * 0.35 + (s < 0 ? Math.PI : 0)));   // pectorals
    L.push(xf(fin([[0, 0], [0.18, 0], [0.2, -0.08], [0.05, -0.07]], 0.02), s * 0.14, -0.22, 0.35, Math.PI / 2 + 0.4, 0, -s * 0.5 + (s < 0 ? Math.PI : 0)));                      // pelvics
  }
  // heterocercal tail: long upper lobe, short lower
  L.push(xf(fin([[0, 0], [0.12, 0.0], [0.62, 0.62], [0.52, 0.66], [0.06, 0.12], [0.3, -0.36], [0.22, -0.38], [0.0, -0.06]], 0.03), 0, 0.0, 1.17, 0, -Math.PI / 2, 0));
  const g = merge(L);
  colorize(g, (x, y, z) => { const top = sstep(-0.12, 0.08, y); const gill = z > -0.95 && z < -0.65 && Math.abs(Math.sin((z + 0.95) * 55)) < 0.25 && Math.abs(x) > 0.25 && y > -0.12 && y < 0.18 ? 0.55 : 1;
    const c = [lerp(0.8, 0.2, top), lerp(0.81, 0.24, top), lerp(0.79, 0.29, top)]; return c.map(v => v * gill); });
  return g;
})();
const SHARK_EYE = (() => { const L = []; for (const s of [-1, 1]) L.push(xf(new THREE.SphereGeometry(0.03, 8, 6), s * 0.21, 0.07, -1.22)); return merge(L); })();
function sharkMaterial() {
  const m = stdMat({ vertexColors: true, roughness: 0.62, envMapIntensity: 0.5 }); m.userData.swim = { value: 0 }; m.userData.amp = { value: 1 };
  m.onBeforeCompile = sh => { sh.uniforms.uSwim = m.userData.swim; sh.uniforms.uAmp = m.userData.amp;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uSwim,uAmp;').replace('#include <begin_vertex>', `#include <begin_vertex>
      { float k = clamp((position.z + 0.9) / 2.5, 0.0, 1.0); float b = sin(uSwim - position.z * 2.2) * 0.22 * k * k * uAmp; transformed.x += b; }`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
      { float k = clamp((position.z + 0.9) / 2.5, 0.0, 1.0); float d = cos(uSwim - position.z * 2.2) * -2.2 * 0.22 * k * k * uAmp; objectNormal = normalize(objectNormal + vec3(0.0, 0.0, -d * objectNormal.x)); }`);
    patchFog(sh); };
  return m;
}
// crab: ridged carapace, eye stalks, claws and eight legs; legs scuttle through a vertex shader
const CRAB_GEO = (() => {
  const L = [];
  const shell = new THREE.SphereGeometry(0.13, 16, 10); const p = shell.attributes.position; for (let i = 0; i < p.count; i++) { let x = p.getX(i), y = p.getY(i), z = p.getZ(i); y *= y > 0 ? 0.42 : 0.25; x *= 1.35; z *= 1.0; if (z < 0) z *= 0.9; y += Math.max(0, 0.02 - Math.abs(Math.sin(x * 30)) * 0.004); p.setXYZ(i, x, y + 0.07, z); } shell.computeVertexNormals(); L.push(shell);
  for (const s of [-1, 1]) {
    L.push(xf(cyl(0.008, 0.008, 0.05, 5), s * 0.04, 0.12, -0.11), xf(new THREE.SphereGeometry(0.014, 6, 5), s * 0.04, 0.15, -0.11));
    // claw: upper arm, forearm, a fat pincer with a moving finger
    L.push(tubeG([[s * 0.12, 0.06, -0.08], [s * 0.2, 0.08, -0.15], [s * 0.17, 0.07, -0.24]], 0.02, 6, 5));
    const pin = new THREE.SphereGeometry(0.045, 10, 8); pin.scale(0.75, 0.55, 1.25); L.push(xf(pin, s * 0.15, 0.07, -0.28));
    L.push(xf(new THREE.ConeGeometry(0.018, 0.07, 6), s * 0.135, 0.07, -0.35, -Math.PI / 2, 0, 0), xf(new THREE.ConeGeometry(0.012, 0.06, 6), s * 0.168, 0.07, -0.34, -Math.PI / 2 - 0.2, 0, 0));
    for (let i = 0; i < 4; i++) { const z = -0.06 + i * 0.055, sp = 0.1 + i * 0.02; L.push(tubeG([[s * 0.15, 0.06, z], [s * 0.25, 0.12, z + (i - 1.5) * 0.02], [s * (0.33 + i * 0.01), 0.0, z + (i - 1.5) * 0.05]], 0.011, 6, 4)); }
  }
  const g = merge(L);
  colorize(g, (x, y, z) => { const top = sstep(0.05, 0.1, y); const leg = Math.abs(x) > 0.16 ? 1 : 0; return [lerp(0.9, 0.78, top) * (leg ? 0.95 : 1), lerp(0.62, 0.22, top) * (leg ? 1.1 : 1), lerp(0.45, 0.12, top)]; });
  return g;
})();
function crabMaterial() { const m = stdMat({ vertexColors: true, roughness: 0.5, envMapIntensity: 0.6 });
  m.onBeforeCompile = sh => { sh.uniforms.uT = TIME_ART; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT;attribute float aMove;').replace('#include <begin_vertex>', `#include <begin_vertex>
      { float legs = smoothstep(0.17, 0.22, abs(position.x)); float ph = position.z * 40.0 + sign(position.x) * 1.6; transformed.y += legs * max(0.0, sin(uT * 22.0 + ph)) * 0.03 * aMove; transformed.z += legs * cos(uT * 22.0 + ph) * 0.015 * aMove; }`); patchFog(sh); };
  return m; }
const TIME_ART = { value: 0 };
// parrot (scarlet macaw): body, hooked beak, long tail; wings are separate so they can flap
const PARROT = (() => {
  const body = lathe([[0.001, -0.18], [0.04, -0.14], [0.07, -0.04], [0.075, 0.04], [0.06, 0.11], [0.001, 0.13]], 10); body.rotateX(Math.PI / 2);
  const head = new THREE.SphereGeometry(0.055, 10, 8); head.translate(0, 0.03, -0.17);
  const beak = (() => { const g = tubeG([[0, 0.04, -0.215], [0, 0.03, -0.25], [0, 0.0, -0.255], [0, -0.025, -0.235]], 0.018, 6, 6); return g; })();
  const tail = []; for (let i = -1; i <= 1; i++) tail.push(xf(profile([[-0.02, 0], [0.02, 0], [0.012, 0.32], [-0.012, 0.32]], 0.006, 0.002), i * 0.018, -0.01, 0.12, Math.PI / 2 - 0.12, 0, i * 0.08));
  const g = merge([body, head, beak, ...tail]);
  colorize(g, (x, y, z) => z < -0.21 ? [0.92, 0.9, 0.82] : z > 0.2 ? [0.15, 0.35, 0.8] : (z < -0.19 && y > 0.04 ? [0.95, 0.95, 0.9] : [0.82, 0.1, 0.08]));
  const wing = s => { const w = profile([[0, -0.06], [0.08, -0.07], [0.22, -0.02], [0.3, 0.05], [0.24, 0.08], [0.12, 0.08], [0, 0.06]], 0.008, 0.003); w.rotateX(Math.PI / 2); if (s < 0) w.scale(-1, 1, 1);
    colorize(w, (x) => { const a = Math.abs(x); return a < 0.08 ? [0.82, 0.1, 0.08] : a < 0.15 ? [0.95, 0.75, 0.1] : [0.15, 0.35, 0.85]; }); return w; };
  return { body: g, wL: wing(-1), wR: wing(1) };
})();
// gull: body with head, yellow beak and tail; grey wings with black tips (forward is +z)
{
  const body = lathe([[0.001, -0.3], [0.05, -0.26], [0.09, -0.12], [0.1, 0.02], [0.08, 0.14], [0.001, 0.2]], 10, 1, 0.9); body.rotateX(Math.PI / 2);
  const head = new THREE.SphereGeometry(0.065, 10, 8); head.translate(0, 0.05, 0.22);
  const beak = new THREE.ConeGeometry(0.018, 0.09, 6); beak.rotateX(Math.PI / 2); beak.translate(0, 0.04, 0.32);
  const tail = profile([[-0.07, 0], [0.07, 0], [0.05, 0.14], [-0.05, 0.14]], 0.006, 0.002); tail.rotateX(-Math.PI / 2); tail.translate(0, 0, -0.42);
  const g = merge([body, head, beak, tail]); colorize(g, (x, y, z) => z > 0.27 ? [0.95, 0.75, 0.2] : y > 0.06 && z < 0 ? [0.72, 0.74, 0.76] : [0.95, 0.95, 0.93]);
  const wing = s => { const w = profile([[0, -0.1], [0.3, -0.06], [0.6, 0.02], [0.92, 0.1], [0.75, 0.13], [0.4, 0.12], [0, 0.12]], 0.01, 0.003); w.rotateX(Math.PI / 2); if (s < 0) w.scale(-1, 1, 1);
    colorize(w, (x) => Math.abs(x) > 0.72 ? [0.1, 0.1, 0.1] : [0.68, 0.7, 0.73]); return w; };
  gB.geometry = g; gL.geometry = wing(-1); gR.geometry = wing(1); gullMat.vertexColors = true; gullMat.color.set(0xffffff); gullMat.needsUpdate = true;
}
