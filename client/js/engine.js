// The Gilded Wake — engine: renderer, sky, sea, the ship model, effects and sound.

'use strict';
const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const rand=(a,b)=>a+Math.random()*(b-a);
const TAU=Math.PI*2;

if(!window.THREE){ $('#loading').textContent='The 3D library could not load. Please check your connection and reload.'; throw new Error('no three'); }

/* ================= SETTINGS ================= */
const STORE='gildedWake.v1';
const PRE={
  low:{px:1.0,shadows:0,water:110,clouds:2,lights:2,aa:false},
  medium:{px:1.25,shadows:1024,water:180,clouds:3,lights:4,aa:true},
  high:{px:1.75,shadows:2048,water:260,clouds:4,lights:6,aa:true},
  ultra:{px:2.0,shadows:4096,water:340,clouds:5,lights:6,aa:true}};
const ORDER=['low','medium','high','ultra'];
const coarse=matchMedia('(pointer:coarse)').matches;
if(coarse) document.body.classList.add('touch');
function guess(){const c=navigator.hardwareConcurrency||4,m=navigator.deviceMemory||4;if(coarse||c<=2||m<=2)return 'low';if(c<=4)return 'medium';return 'high';}
let S={preset:'auto',resolved:guess(),custom:{},scale:100,adaptive:true,volume:80,sens:100,invert:false,bob:true,motion:75,fov:72,sun:7,drift:true,fps:false};
try{const s=JSON.parse(localStorage.getItem(STORE)||'null');if(s)Object.assign(S,s);}catch(e){}
const G=()=>Object.assign({},PRE[S.resolved],S.custom);
const save=()=>{try{localStorage.setItem(STORE,JSON.stringify(S));}catch(e){}};

/* ================= RENDERER ================= */
const canvas=$('#c');
let renderer;
try{ renderer=new THREE.WebGLRenderer({canvas,antialias:G().aa,powerPreference:'high-performance'}); }
catch(e){ $('#loading').textContent='WebGL is not available in this browser, so the sea cannot be drawn.'; throw e; }
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.0;
renderer.shadowMap.autoUpdate=false;
const ANISO=Math.min(8,renderer.capabilities.getMaxAnisotropy());
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(S.fov,innerWidth/innerHeight,0.08,14000);
scene.add(camera);
let dynScale=1;
function applySize(){
  const pr=Math.min(devicePixelRatio||1,G().px)*(S.scale/100)*dynScale;
  renderer.setPixelRatio(Math.max(0.35,pr));
  renderer.setSize(innerWidth,innerHeight,false);
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
}
addEventListener('resize',applySize);

/* ================= SUN ================= */
const sunDir=new THREE.Vector3();
let SUN_AZ=0.35;
const U_NIGHT={value:0},U_FOG={value:0},U_MOON={value:new THREE.Vector3(0,1,0)},U_CLOUD={value:0};
let sunElev=S.sun;
const sunCol=new THREE.Color(), sunI={v:1};
function updateSun(){
  const e=THREE.MathUtils.degToRad(sunElev);
  sunDir.set(Math.sin(SUN_AZ)*Math.cos(e),Math.sin(e),-Math.cos(SUN_AZ)*Math.cos(e));
  const w=clamp(sunElev/13,0,1);
  sunCol.setRGB(1.0,lerp(0.47,0.8,w),lerp(0.2,0.58,w));
  sunI.v=0.35+0.65*sstep(-1,10,sunElev);
}
updateSun();

/* ================= SHARED GLSL ================= */
const SKY_GLSL=`
uniform vec3 uSunDir; uniform float uSunI; uniform float uNight,uFogW; uniform vec3 uMoonDir;
vec3 skyBase(vec3 d){
  float sunE=clamp(uSunDir.y*5.0+0.25,0.0,1.0);
  float h=max(d.y,0.0);
  vec2 dh=normalize(d.xz+vec2(1e-5)); vec2 sh=normalize(uSunDir.xz);
  float azf=dot(dh,sh)*0.5+0.5; float az2=azf*azf;
  vec3 zen=mix(vec3(0.03,0.045,0.13),vec3(0.09,0.15,0.36),sunE);
  vec3 horSun=mix(vec3(1.25,0.4,0.1),vec3(1.25,0.6,0.22),sunE);
  vec3 horAway=mix(vec3(0.36,0.2,0.32),vec3(0.5,0.34,0.42),sunE);
  vec3 hor=mix(horAway,horSun,az2);
  vec3 mid=mix(vec3(0.24,0.17,0.34),vec3(0.62,0.34,0.3),az2);
  vec3 col=mix(hor,mid,smoothstep(0.0,0.18,h));
  col=mix(col,zen,smoothstep(0.06,0.6,h));
  col+=vec3(1.0,0.35,0.08)*pow(1.0-h,12.0)*az2*0.45;
  float g=max(dot(d,uSunDir),0.0);
  col+=vec3(1.0,0.45,0.15)*pow(g,5.0)*0.4;
  col+=vec3(1.0,0.62,0.3)*pow(g,40.0)*0.7;
  col+=vec3(1.0,0.8,0.55)*pow(g,500.0)*1.6;
  col*=0.55+0.45*uSunI;
  float mh=max(dot(d,uMoonDir),0.0);
  vec3 nz=mix(vec3(0.04,0.05,0.085),vec3(0.006,0.01,0.03),smoothstep(0.0,0.5,h));
  nz+=vec3(0.25,0.3,0.42)*pow(mh,30.0)*0.3;
  col=mix(col,nz,uNight);
  vec3 fc=mix(vec3(0.6,0.56,0.58),vec3(0.045,0.05,0.07),uNight)*(0.55+0.45*uSunI+0.3*uNight);
  col=mix(col,fc,uFogW*(1.0-smoothstep(0.0,0.45,h))*0.94);
  if(d.y<0.0) col=mix(col,vec3(0.025,0.045,0.065)*(1.0-0.7*uNight),smoothstep(0.0,-0.12,d.y));
  return col;
}`;
const NOISE_GLSL=`
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);
 return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){float s=0.0,a=0.5;for(int i=0;i<CLOUD_OCT;i++){s+=a*vnoise(p);p=p*2.03+vec2(1.7,9.2);a*=0.5;}return s;}`;
const TAIL=`
#include <tonemapping_fragment>
#include <encodings_fragment>`;

/* ================= SKY ================= */
const skyU={uNight:U_NIGHT,uFogW:U_FOG,uMoonDir:U_MOON,uCloud:U_CLOUD,uSunDir:{value:sunDir},uSunI:{value:1},uTime:{value:0},uDisk:{value:1},uSunCol:{value:sunCol}};
const skyMat=new THREE.ShaderMaterial({
  uniforms:skyU,side:THREE.BackSide,depthWrite:false,defines:{CLOUD_OCT:G().clouds},
  vertexShader:`varying vec3 vDir;void main(){vDir=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_Position=p.xyww;}`,
  fragmentShader:SKY_GLSL+NOISE_GLSL+`
  uniform float uTime,uDisk,uCloud; uniform vec3 uSunCol; varying vec3 vDir;
  void main(){
    vec3 d=normalize(vDir);
    vec3 col=skyBase(d);
    float cosA=dot(d,uSunDir);
    float g=max(cosA,0.0);
    float cov=0.0;
    if(d.y>-0.02){
      float hy=max(d.y,0.0);
      vec2 cp=d.xz/(hy+0.085)*0.5+uTime*vec2(0.0045,0.0018);
      float n=fbm(cp*vec2(0.9,2.2));
      float n2=fbm(cp*0.33+3.1);
      cov=smoothstep(0.5-uCloud*0.32,0.82-uCloud*0.22,n*0.62+n2*0.55);
      cov*=smoothstep(0.0,0.045,hy)*(1.0-0.65*smoothstep(0.3,0.85,hy));
      vec3 lit=mix(vec3(0.3,0.16,0.24),vec3(1.25,0.48,0.2),pow(g,3.0));
      lit=mix(lit,vec3(1.7,0.95,0.55),pow(g,24.0));
      vec3 ccol=lit*(0.6+0.5*(1.0-n))+vec3(1.0,0.6,0.3)*(1.0-cov)*pow(g,10.0)*1.4;
      ccol*=0.55+0.45*uSunI;ccol=mix(ccol,vec3(0.05,0.06,0.09),uNight);ccol=mix(ccol,vec3(0.35,0.35,0.38)*(1.0-0.8*uNight),uCloud*0.7);
      col=mix(col,ccol,cov*0.92);
    }
    float disk=smoothstep(0.99972,0.99986,cosA)*smoothstep(-0.004,0.004,d.y)*(1.0-uNight)*(1.0-uFogW*0.8);
    if(uNight>0.01&&d.y>0.0){vec3 q=floor(d*380.0);float hs=fract(sin(dot(q,vec3(12.9898,78.233,37.719)))*43758.5453);
      float stt=smoothstep(0.9965,1.0,hs)*(0.6+0.4*sin(uTime*3.0+hs*80.0));
      col+=vec3(0.9,0.92,1.0)*stt*uNight*(1.0-cov)*(1.0-uFogW)*smoothstep(0.0,0.15,d.y)*1.8;
      float md=smoothstep(0.99955,0.99975,dot(d,uMoonDir));col+=vec3(0.95,0.95,1.0)*md*3.0*uNight*(1.0-cov*0.8)*(1.0-uFogW*0.7);}
    col+=uSunCol*disk*16.0*uDisk*(1.0-cov*0.85);
    gl_FragColor=vec4(col,1.0);
    `+TAIL+`
  }`});
const sky=new THREE.Mesh(new THREE.SphereGeometry(1000,32,16),skyMat);
sky.frustumCulled=false;sky.renderOrder=-10;scene.add(sky);

/* env map for lighting (PMREM of the sky, no sun disk) */
const pmrem=new THREE.PMREMGenerator(renderer);
const envScene=new THREE.Scene();
envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10,32,16),skyMat));
let envRT=null,envElev=-99;
function updateEnv(){
  skyU.uDisk.value=0;
  const rt=pmrem.fromScene(envScene,0.03,0.1,100);
  skyU.uDisk.value=1;
  if(envRT)envRT.dispose();envRT=rt;scene.environment=rt.texture;envElev=sunElev;
}

/* ================= TEXTURES ================= */
function cnv(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return [c,c.getContext('2d')];}
function mkTex(c,rep=true,srgb=true){const t=new THREE.CanvasTexture(c);if(srgb)t.encoding=THREE.sRGBEncoding;if(rep)t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=ANISO;return t;}
function woodCanvas(o){
  const N=512,[c,g]=cnv(N,N);
  g.fillStyle=o.base;g.fillRect(0,0,N,N);
  const pw=N/o.planks;
  for(let i=0;i<o.planks;i++){
    const x=i*pw;
    g.fillStyle=`hsla(${o.hue+rand(-4,4)},${o.sat}%,${o.light+rand(-7,7)}%,0.6)`;g.fillRect(x,0,pw,N);
    for(let k=0;k<22;k++){
      g.strokeStyle=`rgba(${o.grain},${rand(0.05,0.2)})`;g.lineWidth=rand(0.5,1.8);g.beginPath();
      let gx=x+rand(2,pw-2);g.moveTo(gx,0);for(let y=0;y<=N;y+=24){gx+=rand(-1.1,1.1);gx=clamp(gx,x+1,x+pw-1);g.lineTo(gx,y);}g.stroke();
    }
    if(Math.random()<0.5){g.fillStyle='rgba(30,15,6,0.35)';g.beginPath();g.ellipse(x+rand(6,pw-6),rand(0,N),rand(2,4),rand(5,9),0,0,TAU);g.fill();}
    const j0=rand(0,N);
    for(let j=0;j<o.joints;j++){
      const yy=(j0+j*N/o.joints+i*37)%N;
      g.fillStyle='rgba(12,6,2,0.75)';g.fillRect(x,yy,pw,2);
      g.fillStyle='rgba(15,9,5,0.85)';g.beginPath();g.arc(x+pw*0.28,yy+7,1.7,0,TAU);g.arc(x+pw*0.72,yy+7,1.7,0,TAU);g.arc(x+pw*0.28,yy-5,1.7,0,TAU);g.arc(x+pw*0.72,yy-5,1.7,0,TAU);g.fill();
    }
    g.fillStyle='rgba(8,4,1,0.9)';g.fillRect(x,0,2.2,N);
  }
  for(let k=0;k<70;k++){
    const x=rand(0,N),y=rand(0,N),r=rand(14,70);
    const gr=g.createRadialGradient(x,y,0,x,y,r);
    const dark=Math.random()<0.55;
    gr.addColorStop(0,dark?'rgba(20,10,4,0.16)':'rgba(255,235,200,0.08)');gr.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=gr;g.fillRect(x-r,y-r,r*2,r*2);
  }
  return c;
}
function rot90(src){const [c,g]=cnv(src.height,src.width);g.translate(c.width,0);g.rotate(Math.PI/2);g.drawImage(src,0,0);return c;}
const deckC=woodCanvas({base:'#8a6847',planks:8,hue:30,sat:30,light:40,grain:'50,28,12',joints:2});
const darkC=woodCanvas({base:'#3e2617',planks:6,hue:22,sat:35,light:17,grain:'15,7,2',joints:1});
const medC=woodCanvas({base:'#6e4a2e',planks:6,hue:26,sat:38,light:30,grain:'35,18,6',joints:1});
const hullC=rot90(woodCanvas({base:'#3a2416',planks:10,hue:22,sat:32,light:18,grain:'12,6,2',joints:3}));
const deckTex=mkTex(deckC),darkTex=mkTex(darkC),medTex=mkTex(medC),hullTex=mkTex(hullC);

function sailCanvas(){
  const N=256,[c,g]=cnv(N,N);
  g.fillStyle='#e9dcc0';g.fillRect(0,0,N,N);
  for(let i=0;i<2400;i++){g.fillStyle=`rgba(${Math.random()<0.5?'120,95,60':'255,250,235'},${rand(0.03,0.09)})`;g.fillRect(rand(0,N),rand(0,N),rand(1,3),rand(1,3));}
  for(let x=0;x<N;x+=28){g.fillStyle='rgba(110,88,55,0.35)';g.fillRect(x,0,1.5,N);g.fillStyle='rgba(110,88,55,0.18)';for(let y=0;y<N;y+=5)g.fillRect(x+3,y,1,2);}
  for(const yy of [0.3,0.55]){g.fillStyle='rgba(100,80,50,0.35)';g.fillRect(0,yy*N,N,2);g.fillStyle='rgba(80,60,35,0.6)';for(let x=8;x<N;x+=16)g.fillRect(x,yy*N-3,1.5,8);}
  for(let k=0;k<4;k++){const x=rand(20,200),y=rand(20,200),w=rand(18,40),h=rand(16,34);g.fillStyle=`rgba(${rand(190,225)|0},${rand(170,200)|0},${rand(130,160)|0},0.65)`;g.fillRect(x,y,w,h);g.strokeStyle='rgba(90,70,40,0.5)';g.setLineDash([2,3]);g.strokeRect(x+2,y+2,w-4,h-4);g.setLineDash([]);}
  for(let k=0;k<14;k++){const x=rand(0,N),y=rand(N*0.55,N),r=rand(10,40);const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(120,90,50,0.18)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(x-r,y-r,r*2,r*2);}
  g.strokeStyle='rgba(90,70,45,0.6)';g.lineWidth=4;g.strokeRect(0,0,N,N);
  return c;
}
const sailTex=mkTex(sailCanvas(),false);
function flagCanvas(){
  const [c,g]=cnv(256,160);
  g.fillStyle='#141012';g.fillRect(0,0,256,160);
  for(let i=0;i<900;i++){g.fillStyle=`rgba(255,255,255,${rand(0.01,0.04)})`;g.fillRect(rand(0,256),rand(0,160),2,2);}
  g.fillStyle='#e9e2d0';g.strokeStyle='#e9e2d0';g.lineCap='round';
  g.lineWidth=11;g.beginPath();g.moveTo(80,118);g.lineTo(176,150);g.moveTo(176,118);g.lineTo(80,150);g.stroke();
  for(const [x,y] of [[76,113],[84,122],[180,113],[172,122],[76,154],[84,146],[180,154],[172,146]]){g.beginPath();g.arc(x,y,7,0,TAU);g.fill();}
  g.beginPath();g.arc(128,66,34,0,TAU);g.fill();g.fillRect(108,82,40,26);
  g.fillStyle='#141012';g.beginPath();g.ellipse(114,66,9,11,0,0,TAU);g.ellipse(142,66,9,11,0,0,TAU);g.fill();
  g.beginPath();g.moveTo(128,78);g.lineTo(123,89);g.lineTo(133,89);g.fill();
  for(let x=113;x<146;x+=8)g.fillRect(x,96,2.5,12);
  g.globalCompositeOperation='destination-out';
  g.beginPath();g.moveTo(256,0);for(let y=0;y<=160;y+=10)g.lineTo(256-rand(4,26)-(y>90?18:0),y);g.lineTo(256,160);g.fill();
  g.beginPath();g.arc(214,40,6,0,TAU);g.arc(60,30,3,0,TAU);g.fill();
  return c;
}
const flagTex=mkTex(flagCanvas(),false);
function crateCanvas(){
  const N=256,[c,g]=cnv(N,N);g.drawImage(rot90(medC),0,0,N,N);
  g.fillStyle='rgba(30,16,6,0.55)';g.fillRect(0,0,N,26);g.fillRect(0,N-26,N,26);g.fillRect(0,0,26,N);g.fillRect(N-26,0,26,N);
  g.save();g.translate(N/2,N/2);g.rotate(Math.PI/4);g.fillRect(-N*0.7,-12,N*1.4,24);g.restore();
  g.fillStyle='rgba(60,35,15,0.6)';g.strokeStyle='rgba(10,5,2,0.8)';g.lineWidth=2;g.strokeRect(13,13,N-26,N-26);
  return c;
}
const crateTex=mkTex(crateCanvas(),false);
function gratingCanvas(){const [c,g]=cnv(128,128);g.drawImage(darkC,0,0,128,128);g.fillStyle='#070402';for(let y=6;y<128;y+=16)for(let x=6;x<128;x+=16)g.fillRect(x,y,10,10);return c;}
const gratingTex=mkTex(gratingCanvas());
function glowCanvas(){const [c,g]=cnv(64,64);const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(0.25,'rgba(255,255,255,0.45)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);return c;}
const glowTex=mkTex(glowCanvas(),false);
function mapCanvas(){
  const W=640,H=420,[c,g]=cnv(W,H);
  const bg=g.createRadialGradient(W/2,H/2,40,W/2,H/2,W*0.62);bg.addColorStop(0,'#ead7ad');bg.addColorStop(1,'#bf9b62');g.fillStyle=bg;g.fillRect(0,0,W,H);
  for(let i=0;i<1600;i++){g.fillStyle=`rgba(90,60,20,${rand(0.02,0.07)})`;g.fillRect(rand(0,W),rand(0,H),rand(1,3),rand(1,3));}
  g.strokeStyle='rgba(60,40,20,0.18)';g.lineWidth=1;for(let x=0;x<W;x+=64){g.beginPath();g.moveTo(x,0);g.lineTo(x,H);g.stroke();}for(let y=0;y<H;y+=64){g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke();}
  function isle(cx,cy,r,lab){
    g.beginPath();const n=40,ph=rand(0,9);
    for(let i=0;i<=n;i++){const a=i/n*TAU;const rr=r*(1+0.25*Math.sin(a*3+ph)+0.12*Math.sin(a*7+ph*2)+rand(-0.05,0.05));const x=cx+Math.cos(a)*rr,y=cy+Math.sin(a)*rr*0.7;i?g.lineTo(x,y):g.moveTo(x,y);}
    g.closePath();g.fillStyle='rgba(120,130,80,0.35)';g.fill();g.strokeStyle='#3b2814';g.lineWidth=2;g.stroke();
    g.strokeStyle='rgba(59,40,20,0.35)';g.lineWidth=1;g.save();g.translate(cx,cy);g.scale(1.18,1.18);g.translate(-cx,-cy);g.stroke();g.restore();
    if(lab){g.fillStyle='#3b2814';g.font='italic 20px "IM Fell English", Georgia, serif';g.fillText(lab,cx-r*0.6,cy+r+18);}
  }
  isle(140,120,42,'Saint Brannoc');isle(250,300,22,'');isle(560,330,70,'Home');isle(470,90,18,'');
  g.setLineDash([6,7]);g.strokeStyle='#5a2a16';g.lineWidth=2;g.beginPath();g.moveTo(170,150);g.bezierCurveTo(260,220,380,170,505,300);g.stroke();g.setLineDash([]);
  g.strokeStyle='#8a1c10';g.lineWidth=4;const x=372,y=196;g.beginPath();g.moveTo(x-8,y-8);g.lineTo(x+8,y+8);g.moveTo(x+8,y-8);g.lineTo(x-8,y+8);g.stroke();
  g.save();g.translate(70,340);g.strokeStyle='#3b2814';g.fillStyle='#3b2814';g.lineWidth=1.5;
  for(let i=0;i<8;i++){g.rotate(Math.PI/4);g.beginPath();g.moveTo(0,0);g.lineTo(i%2?22:40,0);g.stroke();}
  g.font='16px Georgia, serif';g.fillText('N',-5,-44);g.restore();
  g.font='italic 26px "IM Fell English", Georgia, serif';g.fillStyle='#3b2814';g.fillText('The Saltwren’s reckoning',300,46);
  return c;
}

/* water normal & foam (tileable) */
function waterNormalTex(){
  const N=256,[c,g]=cnv(N,N);const img=g.createImageData(N,N);
  const comps=[];for(let i=0;i<16;i++){let kx=Math.round(rand(-10,10)),ky=Math.round(rand(-10,10));if(!kx&&!ky)kx=4;comps.push([kx,ky,1/Math.pow(Math.hypot(kx,ky),1.1),rand(0,TAU)]);}
  const dx=new Float32Array(N*N),dy=new Float32Array(N*N);let mx=0;
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){let a=0,b=0;for(const [kx,ky,am,ph] of comps){const p=TAU*(kx*x+ky*y)/N+ph;const cs=Math.cos(p)*am;a+=cs*kx;b+=cs*ky;}const i=y*N+x;dx[i]=a;dy[i]=b;mx=Math.max(mx,Math.abs(a),Math.abs(b));}
  for(let i=0;i<N*N;i++){const nx=-dx[i]/mx*1.1,ny=-dy[i]/mx*1.1,l=Math.hypot(nx,ny,1);img.data[i*4]=(nx/l*0.5+0.5)*255;img.data[i*4+1]=(ny/l*0.5+0.5)*255;img.data[i*4+2]=(1/l*0.5+0.5)*255;img.data[i*4+3]=255;}
  g.putImageData(img,0,0);const t=mkTex(c,true,false);return t;
}
function foamTex(){
  const N=128,[c,g]=cnv(N,N);const img=g.createImageData(N,N);
  const comps=[];for(let i=0;i<12;i++){let kx=Math.round(rand(-8,8)),ky=Math.round(rand(-8,8));if(!kx&&!ky)ky=3;comps.push([kx,ky,rand(0,TAU)]);}
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){let v=0;for(const [kx,ky,ph] of comps)v+=Math.cos(TAU*(kx*x+ky*y)/N+ph);v=Math.abs(v)/5;v=clamp(1-v,0,1);v=v*v;const i=(y*N+x)*4;img.data[i]=img.data[i+1]=img.data[i+2]=v*255;img.data[i+3]=255;}
  g.putImageData(img,0,0);return mkTex(c,true,false);
}

/* ================= MATERIALS ================= */
function tx(t,rx=1,ry=1){const c=t.clone();c.needsUpdate=true;c.repeat.set(rx,ry);return c;}
const MAT={
  deck:new THREE.MeshStandardMaterial({map:tx(deckTex),roughness:0.82,metalness:0,envMapIntensity:0.45}),
  dark:new THREE.MeshStandardMaterial({map:tx(darkTex),roughness:0.75,envMapIntensity:0.45}),
  med:new THREE.MeshStandardMaterial({map:tx(medTex),roughness:0.78,envMapIntensity:0.45}),
  hull:new THREE.MeshStandardMaterial({map:hullTex,vertexColors:true,roughness:0.7,side:THREE.DoubleSide,envMapIntensity:0.5}),
  crate:new THREE.MeshStandardMaterial({map:crateTex,roughness:0.85,envMapIntensity:0.45}),
  grating:new THREE.MeshStandardMaterial({map:tx(gratingTex,1.5,1.5),roughness:0.85}),
  rope:new THREE.MeshStandardMaterial({color:0x3b2a1c,roughness:1,envMapIntensity:0.5}),
  iron:new THREE.MeshStandardMaterial({color:0x18181a,roughness:0.55,metalness:0.55,envMapIntensity:0.45}),
  brass:new THREE.MeshStandardMaterial({color:0xc4913f,roughness:0.3,metalness:0.9}),
  gold:new THREE.MeshStandardMaterial({color:0xb98a35,roughness:0.42,metalness:0.8}),
  red:new THREE.MeshStandardMaterial({color:0x5a1410,roughness:0.7}),
  leather:new THREE.MeshStandardMaterial({color:0x3b1d10,roughness:0.65}),
  paper:new THREE.MeshStandardMaterial({color:0xe3d3ad,roughness:0.95}),
  bottle:new THREE.MeshStandardMaterial({color:0x1d3a22,roughness:0.15,metalness:0.1}),
  candle:new THREE.MeshStandardMaterial({color:0xe9dfc8,roughness:0.6,emissive:0x3a2008}),
  sail:new THREE.MeshStandardMaterial({map:sailTex,roughness:0.95,side:THREE.DoubleSide,emissive:0xffffff,emissiveMap:sailTex,emissiveIntensity:0,envMapIntensity:0.9}),
  flag:new THREE.MeshStandardMaterial({map:flagTex,roughness:0.9,side:THREE.DoubleSide,alphaTest:0.5}),
  window:new THREE.MeshBasicMaterial({color:0xffb75e}),
  windowIn:new THREE.MeshBasicMaterial({color:0xb86a3a}),
  glass:new THREE.MeshBasicMaterial({color:0xffc070}),
};
MAT.sail.shadowSide=THREE.DoubleSide;
const proxyMat=new THREE.MeshBasicMaterial({visible:false});

/* ================= GEOMETRY HELPERS ================= */
function box(w,h,d){const g=new THREE.BoxGeometry(w,h,d);const uv=g.attributes.uv;const dims=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];for(let f=0;f<6;f++)for(let k=0;k<4;k++){const i=f*4+k;uv.setXY(i,uv.getX(i)*dims[f][0]*0.5,uv.getY(i)*dims[f][1]*0.5);}return g;}
function cyl(rt,rb,h,seg=10){const g=new THREE.CylinderGeometry(rt,rb,h,seg,1);const uv=g.attributes.uv;const c=Math.max(rt,rb)*TAU*0.5;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*c,uv.getY(i)*h*0.5);return g;}
const _m=new THREE.Matrix4(),_q=new THREE.Quaternion(),_e=new THREE.Euler(),_v=new THREE.Vector3(),_s=new THREE.Vector3();
function xf(geo,x=0,y=0,z=0,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1){const g=geo.clone();_m.compose(_v.set(x,y,z),_q.setFromEuler(_e.set(rx,ry,rz)),_s.set(sx,sy,sz));g.applyMatrix4(_m);return g;}
function merge(list){
  let vc=0,ic=0;const hasC=list.some(g=>g.attributes.color);
  for(const g of list){vc+=g.attributes.position.count;ic+=g.index?g.index.count:g.attributes.position.count;}
  const pos=new Float32Array(vc*3),nor=new Float32Array(vc*3),uv=new Float32Array(vc*2),col=hasC?new Float32Array(vc*3):null;
  const idx=vc>65535?new Uint32Array(ic):new Uint16Array(ic);
  let vo=0,io=0;
  for(const g of list){
    const n=g.attributes.position.count;
    if(!g.attributes.normal)g.computeVertexNormals();
    pos.set(g.attributes.position.array,vo*3);nor.set(g.attributes.normal.array,vo*3);
    if(g.attributes.uv)uv.set(g.attributes.uv.array,vo*2);
    if(col){if(g.attributes.color)col.set(g.attributes.color.array,vo*3);else col.fill(1,vo*3,(vo+n)*3);}
    if(g.index){const a=g.index.array;for(let i=0;i<a.length;i++)idx[io+i]=a[i]+vo;io+=a.length;}else{for(let i=0;i<n;i++)idx[io+i]=vo+i;io+=n;}
    vo+=n;
  }
  const m=new THREE.BufferGeometry();
  m.setAttribute('position',new THREE.BufferAttribute(pos,3));m.setAttribute('normal',new THREE.BufferAttribute(nor,3));m.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  if(col)m.setAttribute('color',new THREE.BufferAttribute(col,3));
  m.setIndex(new THREE.BufferAttribute(idx,1));m.computeBoundingSphere();return m;
}
function meshOf(list,mat,cast=true,recv=true){const m=new THREE.Mesh(merge(list),mat);m.castShadow=cast;m.receiveShadow=recv;return m;}
const B={};const put=(k,g)=>(B[k]||(B[k]=[])).push(g);

/* ================= SHIP SHAPE ================= */
const L0=-15,L1=14,LEN=29,DECK=2.4,QD=4.6,QZ=6.0;
function hw(z){const t=clamp((z-L0)/LEN,0,1);if(t<0.5)return 4.0*Math.pow(Math.sin(t/0.5*Math.PI/2),0.55);const k=(t-0.5)/0.5;return 4.0*(1-0.22*k*k);}
function topY(z){const t=(z-L0)/LEN;return 3.3+1.1*sstep(0.22,0,t)+2.3*sstep(0.58,0.72,t);}
function keelY(z){const t=(z-L0)/LEN;return -2.2+1.6*sstep(0.12,0,t);}
const PORTS=[-5.5,-2.5,1.0],PORT_W=0.31;
const ROWS=[0,0.00909,0.0909,0.15,0.21,0.28,0.35,0.43,0.52,0.61,0.7,0.79,0.87,0.94,1];
function secPt(z,s){const top=topY(z),k=keelY(z),y=top-(top-k)*s,w=hw(z);const x=s<0.3?w*(1-0.06*(1-s/0.3)):w*Math.pow(Math.max(0,Math.cos((s-0.3)/0.7*Math.PI/2)),0.55);return [x,y];}
function buildHull(){
  let zs=[];for(let i=0;i<=64;i++)zs.push(L0+LEN*i/64);
  for(const p of PORTS)zs.push(p-PORT_W,p+PORT_W);
  zs.sort((a,b)=>a-b);zs=zs.filter((z,i)=>i===0||z-zs[i-1]>0.04);
  const pos=[],col=[],uv=[],idx=[];const NR=ROWS.length;
  for(const sg of [1,-1]){
    const base=pos.length/3;
    for(const z of zs)for(let j=0;j<NR;j++){
      const [x,y]=secPt(z,ROWS[j]);pos.push(sg*x,y,z);uv.push(z*0.5,y*0.5);
      const top=topY(z);let c=[1,1,1];
      const band=2.1+(top-3.3)*0.35;
      if(Math.abs(y-band)<0.1)c=[2.1,1.45,0.55];
      else if(y>top-0.12)c=[1.5,1.05,0.5];
      else if(y<0.3&&y>0.15)c=[0.25,0.22,0.2];
      else if(y<=0.15)c=[0.62,0.6,0.5];
      if(z>QZ+1&&y>top-0.9&&y<top-0.2&&Math.abs(y-band)>=0.1)c=[0.55,0.18,0.12];
      col.push(...c);
    }
    for(let i=0;i<zs.length-1;i++)for(let j=0;j<NR-1;j++){
      const zm=(zs[i]+zs[i+1])/2;
      if(j===1&&PORTS.some(p=>Math.abs(zm-p)<PORT_W))continue;
      const a=base+i*NR+j,b=base+(i+1)*NR+j,c=a+1,d=b+1;
      if(sg>0)idx.push(a,b,c,b,d,c);else idx.push(a,c,b,b,c,d);
    }
  }
  // transom
  const tb=pos.length/3,z=L1;pos.push(0,(topY(z)+keelY(z))/2,z);uv.push(0,0);col.push(0.8,0.75,0.7);
  const ring=[];for(let j=0;j<NR;j++)ring.push(secPt(z,ROWS[j]));
  const pts=[];for(let j=0;j<NR;j++)pts.push([ring[j][0],ring[j][1]]);for(let j=NR-2;j>=0;j--)pts.push([-ring[j][0],ring[j][1]]);
  for(const [x,y] of pts){pos.push(x,y,z);uv.push(x*0.5,y*0.5);col.push(0.8,0.75,0.7);}
  for(let i=0;i<pts.length-1;i++)idx.push(tb,tb+1+i,tb+2+i);
  idx.push(tb,tb+pts.length,tb+1);
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx);g.computeVertexNormals();return g;
}
function deckSlab(z0,z1,y,inset,thick){
  const sh=new THREE.Shape();const N=40;
  for(let i=0;i<=N;i++){const z=z0+(z1-z0)*i/N;const x=hw(z)*inset;i?sh.lineTo(x,-z):sh.moveTo(x,-z);}
  for(let i=N;i>=0;i--){const z=z0+(z1-z0)*i/N;sh.lineTo(-hw(z)*inset,-z);}
  const g=new THREE.ExtrudeGeometry(sh,{depth:thick,bevelEnabled:false});
  g.rotateX(-Math.PI/2);g.translate(0,y-thick,0);
  const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*0.5,uv.getY(i)*0.5);
  return g;
}

/* ================= SHIP ================= */
const shipYaw=new THREE.Group();scene.add(shipYaw);
const ship=new THREE.Group();shipYaw.add(ship);
const hull=new THREE.Mesh(buildHull(),MAT.hull);hull.castShadow=true;hull.receiveShadow=true;ship.add(hull);
put('deck',deckSlab(-13.9,13.7,DECK,0.962,0.3));
put('deck',deckSlab(QZ,13.75,QD,0.948,0.14));

// gunwale cap rails
for(const sg of [1,-1]){
  const pts=[];for(let i=0;i<=60;i++){const z=-14.2+27.9*i/60;const [x]=secPt(z,0);pts.push(new THREE.Vector3(sg*x*0.985,topY(z)+0.03,z));}
  put('dark',new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),80,0.075,5,false));
  // port lids
}
// quarterdeck front wall with door opening & windows
const qhw=hw(QZ)*0.95;
put('wall',xf(box(qhw-0.6,QD-DECK,0.12),-(0.6+(qhw-0.6)/2),(QD+DECK)/2,QZ));
put('wall',xf(box(qhw-0.6,QD-DECK,0.12),(0.6+(qhw-0.6)/2),(QD+DECK)/2,QZ));
put('wall',xf(box(1.2,0.2,0.12),0,QD-0.1,QZ));
for(const sx of [-1.65,1.65]){put('window',xf(new THREE.PlaneGeometry(0.62,0.5),sx,3.65,QZ-0.065,0,Math.PI,0));put('dark',xf(box(0.74,0.08,0.06),sx,3.36,QZ-0.08));put('dark',xf(box(0.74,0.08,0.06),sx,3.94,QZ-0.08));put('dark',xf(box(0.05,0.56,0.04),sx,3.65,QZ-0.09));
  put('windowIn',xf(new THREE.PlaneGeometry(0.62,0.5),sx,3.65,QZ+0.065));put('dark',xf(box(0.05,0.56,0.04),sx,3.65,QZ+0.085));put('dark',xf(box(0.66,0.04,0.04),sx,3.65,QZ+0.085));}
put('gold',xf(box(qhw*2,0.08,0.06),0,QD-0.04,QZ-0.07));
// quarterdeck front rail
for(let x=-2.25;x<=2.26;x+=0.28)put('dark',xf(cyl(0.035,0.045,0.82,6),x,QD+0.41,QZ+0.05));
put('dark',xf(box(4.62,0.08,0.14),0,QD+0.86,QZ+0.05));
// stairs
for(const sg of [1,-1]){
  for(let i=0;i<8;i++){const z=3.0+i*0.375+0.19,y=DECK+(i+1)*0.275;put('deck',xf(box(1.25,0.07,0.4),sg*2.975,y-0.035,z));put('dark',xf(box(0.06,y-DECK,0.4),sg*2.32,(y+DECK)/2,z));}
  const rl=Math.hypot(3,2.2);put('dark',xf(box(0.08,0.08,rl),sg*2.3,DECK+1.15+0.85,4.5,-Math.atan2(2.2,3),0,0));
  for(const z of [3.1,4.5,5.9])put('dark',xf(cyl(0.035,0.035,0.9,6),sg*2.3,DECK+(z-3)/3*2.2+0.45,z));
}
// stern windows (outside) & gallery
for(const x of [-1.6,0,1.6]){put('window',xf(new THREE.PlaneGeometry(0.85,0.95),x,3.6,L1+0.02));put('gold',xf(box(1.0,0.08,0.08),x,3.08,L1+0.05));put('gold',xf(box(1.0,0.08,0.08),x,4.12,L1+0.05));put('windowIn',xf(new THREE.PlaneGeometry(0.85,0.95),x,3.6,L1-0.03,0,Math.PI,0));}
put('gold',xf(box(5.2,0.12,0.12),0,4.45,L1+0.06));put('gold',xf(box(5.6,0.1,0.1),0,2.6,L1+0.06));
put('dark',xf(box(6.0,0.9,0.12),0,5.05,L1+0.02));
// hatch grating, capstan
put('grating',xf(box(1.5,0.16,1.9),0,DECK+0.08,-3.0));put('dark',xf(box(1.66,0.18,2.06),0,DECK+0.04,-3.0));
put('med',xf(cyl(0.42,0.5,0.85,12),0,DECK+0.43,-5.4));put('dark',xf(cyl(0.55,0.55,0.12,12),0,DECK+0.9,-5.4));
for(let i=0;i<6;i++){const a=i/6*TAU;put('med',xf(box(1.5,0.07,0.08),Math.cos(a)*0.6,DECK+0.98,-5.4+Math.sin(a)*0.6,0,-a,0));}
// bowsprit
const bsA=Math.atan2(3.0,8);
put('dark',xf(cyl(0.16,0.24,9.5,10),0,4.6,-17.8,-Math.PI/2+bsA,0,0));
put('gold',xf(new THREE.TorusGeometry(0.3,0.06,6,14),0,4.15,-14.6,0,0,0));
// masts, yards, tops
const MASTS=[{z:-8,h:21,yards:[[10.4,11],[16.2,8.4],[20.4,5.6]]},{z:-0.5,h:25,yards:[[11.9,13],[19.2,9.6],[24.1,6.2]]},{z:9,h:18,yards:[[11.8,8.6],[16.6,5.8]]}];
for(const m of MASTS){
  put('dark',xf(cyl(0.18,0.34,m.h,12),0,DECK+m.h/2,m.z));
  put('dark',xf(cyl(1.15,1.0,0.14,14),0,m.yards[0][0]+1.1,m.z));
  put('iron',xf(cyl(0.37,0.37,0.12,12),0,DECK+0.9,m.z));
  for(const [y,len] of m.yards){put('dark',xf(cyl(0.08,0.13,len,8),0,y,m.z,0,0,Math.PI/2));}
  put('dark',xf(cyl(0.12,0.18,0.25,8),0,DECK+m.h+0.1,m.z));
}
// fife rail (sail control) around main mast
put('med',xf(box(1.8,0.1,0.14),0,DECK+0.75,0.35));put('med',xf(box(1.8,0.1,0.14),0,DECK+0.75,-1.35));put('med',xf(box(0.14,0.1,1.84),0.9,DECK+0.75,-0.5));put('med',xf(box(0.14,0.1,1.84),-0.9,DECK+0.75,-0.5));
for(const [x,z] of [[0.9,0.35],[-0.9,0.35],[0.9,-1.35],[-0.9,-1.35]])put('med',xf(cyl(0.06,0.07,0.75,6),x,DECK+0.37,z));
for(let i=0;i<7;i++){put('med',xf(cyl(0.022,0.03,0.32,5),-0.75+i*0.25,DECK+0.82,0.35));put('med',xf(cyl(0.022,0.03,0.32,5),-0.75+i*0.25,DECK+0.82,-1.35));}
// rope coils
const coil=new THREE.TorusGeometry(0.28,0.045,5,16);
for(const [x,y,z] of [[0.55,DECK+0.05,0.75],[-0.55,DECK+0.05,0.75],[2.6,DECK+0.05,-11.3],[-2.2,QD+0.05,12.8],[-0.4,DECK+0.05,-12.2]])for(let k=0;k<3;k++)put('rope',xf(coil,x,y+k*0.07,z,Math.PI/2,0,0,1-k*0.15,1-k*0.15,1));
// crates
const crateG=new THREE.BoxGeometry(0.85,0.75,0.85);
for(const [x,y,z,r] of [[-2.05,DECK+0.375,-9.5,0.1],[-2.0,DECK+1.125,-9.45,-0.2],[-1.25,DECK+0.375,-10.1,0.35],[2.65,QD+0.375,12.6,0.05],[-1.9,DECK+0.375,-7.0,0.2]])put('crate',xf(crateG,x,y,z,0,r,0));
// cabin furniture
put('med',xf(box(1.7,0.08,1.05),-1.45,DECK+0.78,9.7));
for(const [dx,dz] of [[-0.75,-0.45],[0.75,-0.45],[-0.75,0.45],[0.75,0.45]])put('med',xf(cyl(0.05,0.05,0.78,6),-1.45+dx,DECK+0.39,9.7+dz));
put('med',xf(box(0.5,0.06,0.5),-1.45,DECK+0.46,10.75));put('med',xf(box(0.5,0.55,0.06),-1.45,DECK+0.75,11.0));
for(const [dx,dz] of [[-0.2,-0.2],[0.2,-0.2],[-0.2,0.2],[0.2,0.2]])put('med',xf(cyl(0.03,0.03,0.46,5),-1.45+dx,DECK+0.23,10.75+dz));
put('med',xf(box(0.3,0.04,1.8),-hw(10)*0.9+0.2,DECK+1.5,10.2));
for(let i=0;i<6;i++){put('bottle',xf(cyl(0.035,0.05,0.22,8),-hw(10)*0.9+0.2,DECK+1.63,9.5+i*0.27));put('bottle',xf(cyl(0.015,0.02,0.08,6),-hw(10)*0.9+0.2,DECK+1.78,9.5+i*0.27));}
put('red',xf(box(1.9,0.35,0.9),2.4,DECK+0.25,9.3));put('paper',xf(box(1.8,0.12,0.8),2.4,DECK+0.47,9.3));
put('candle',xf(cyl(0.035,0.04,0.16,8),-1.0,DECK+0.9,9.45));put('brass',xf(cyl(0.07,0.07,0.02,10),-1.0,DECK+0.83,9.45));
put('leather',xf(box(0.32,0.06,0.24),-1.75,DECK+0.85,9.45,0,0.3,0));put('paper',xf(box(0.3,0.03,0.22),-1.75,DECK+0.89,9.45,0,0.3,0));
put('brass',xf(cyl(0.05,0.05,0.4,8),-1.2,DECK+0.86,10.0,0,0.8,Math.PI/2));

/* ---------- rigging ---------- */
const ropeLines=[];
function tube(a,b,r=0.028,sag=0){const mid=a.clone().lerp(b,0.5);mid.y-=sag;const c=new THREE.QuadraticBezierCurve3(a,mid,b);put('rope',new THREE.TubeGeometry(c,sag?8:1,r,4,false));}
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
for(const m of MASTS){
  const topS=m.yards[0][0]+1.0;
  for(const sg of [1,-1]){
    const ends=[];
    for(let k=0;k<4;k++){const z=m.z+0.4+k*0.6;const [x]=secPt(z,0);const a=V(sg*0.3,topS,m.z),b=V(sg*x*0.97,topY(z)+0.05,z);tube(a,b,0.03);ends.push([a,b]);put('rope',xf(box(0.07,0.5,0.07),sg*x*1.0,topY(z)-0.2,z));}
    for(let y=0.06;y<0.95;y+=0.042){const p0=ends[0][1].clone().lerp(ends[0][0],y),p1=ends[3][1].clone().lerp(ends[3][0],y);ropeLines.push(p0,p1);}
    const t2=m.yards[1][0]+0.6;tube(V(sg*0.15,t2,m.z),V(sg*1.0,topS+0.1,m.z),0.02);
  }
}
tube(V(0,DECK+25,-0.5),V(0,DECK+10,-8),0.035,0.4);
tube(V(0,DECK+21,-8),V(0,6.8,-22.0),0.035,0.6);
tube(V(0,DECK+13,-8),V(0,5.6,-19.0),0.03,0.4);
tube(V(0,DECK+18,9),V(0,DECK+12.5,-0.5),0.03,0.3);
for(const sg of [1,-1]){tube(V(sg*0.2,DECK+24,-0.5),V(sg*hw(6)*0.95,topY(6)+0.05,6),0.025,0.2);tube(V(sg*0.2,DECK+17.5,9),V(sg*hw(13)*0.92,topY(13)+0.05,13),0.025,0.15);}
for(const m of MASTS)for(const [y,len] of m.yards)for(const sg of [1,-1]){const a=V(sg*len/2,y,m.z);const b=V(sg*hw(m.z+6)*0.9,topY(m.z+6)+0.1,Math.min(m.z+6,13));ropeLines.push(a,b);ropeLines.push(V(sg*len/2,y,m.z),V(0,y+1.6,m.z));}
const ratGeo=new THREE.BufferGeometry().setFromPoints(ropeLines);
const ratLines=new THREE.LineSegments(ratGeo,new THREE.LineBasicMaterial({color:0x2a1d12}));ship.add(ratLines);

/* ---------- bake static ---------- */
const STATIC={};
for(const k in B){const m=meshOf(B[k],MAT[k]||MAT.dark,!/window|wallIn/.test(k),true);ship.add(m);STATIC[k]=m;}
STATIC.window.castShadow=false;STATIC.windowIn&&(STATIC.windowIn.castShadow=false);

/* ================= SAILS ================= */
const sails=[];
function makeSail(mz,yTop,yBot,wTop,wBot,depth,parentRot){
  const sx=10,sy=8;const g=new THREE.PlaneGeometry(1,1,sx,sy);
  const base=g.attributes.position.array.slice();
  const mesh=new THREE.Mesh(g,MAT.sail);mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.userData.sailIdx=sails.length;
  const grp=new THREE.Group();grp.position.set(0,0,mz+0.16);grp.rotation.y=parentRot;grp.add(mesh);ship.add(grp);
  sails.push({mesh,base,yTop,yBot,wTop,wBot,depth,ph:rand(0,9)});
}
for(const m of MASTS){
  for(let i=0;i<m.yards.length;i++){
    const [y,len]=m.yards[i];const below=i===0?(m.z>5?QD+2.0:DECK+3.2):m.yards[i-1][0]+0.35;
    const wb=i===0?len*0.98:m.yards[i-1][1]*0.92;
    makeSail(m.z,y-0.1,below,len*0.94,wb,i===0?1.5:1.15,0.12);
  }
}
const jibs=[];
function makeJib(a,b,c){
  const rows=7;const pos=[],uv=[],idx=[];
  for(let r=0;r<=rows;r++)for(let k=0;k<=r;k++){const u=r/rows,v=r?k/r:0;pos.push(0,0,0);uv.push(v,1-u);}
  let i0=0;for(let r=0;r<rows;r++){const n=r+1;const i1=i0+n;for(let k=0;k<n;k++){idx.push(i0+k,i1+k,i1+k+1);if(k<n-1)idx.push(i0+k,i1+k+1,i0+k+1);}i0=i1;}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);
  const mesh=new THREE.Mesh(g,MAT.sail);mesh.castShadow=true;mesh.frustumCulled=false;mesh.userData.jibIdx=jibs.length;ship.add(mesh);jibs.push({mesh,a,b,c,rows,ph:rand(0,9)});
}
makeJib(V(0,DECK+20.2,-8.3),V(0,6.6,-21.5),V(0,DECK+3.6,-12.6));
makeJib(V(0,DECK+15.5,-8.3),V(0,5.5,-18.7),V(0,DECK+2.7,-11.0));
/* flag */
const flagGeo=new THREE.PlaneGeometry(2.2,1.4,12,6);const flagBase=flagGeo.attributes.position.array.slice();
const flag=new THREE.Mesh(flagGeo,MAT.flag);flag.castShadow=true;flag.position.set(0,DECK+18.9,9);flag.rotation.y=Math.PI/2;flag.frustumCulled=false;flag.userData.flag=1;ship.add(flag);
/* pennant in the captain's colour */
const penGeo=new THREE.PlaneGeometry(5,0.55,14,1);penGeo.translate(2.5,0,0);{const p=penGeo.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,p.getY(i)*(1-p.getX(i)/5.4));}
const penBase=penGeo.attributes.position.array.slice();
const penMat=new THREE.MeshStandardMaterial({color:0xe8b45f,side:THREE.DoubleSide,roughness:0.8,emissive:0xe8b45f,emissiveIntensity:0.25});
const pennant=new THREE.Mesh(penGeo,penMat);pennant.position.set(0,DECK+25.6,-0.5);pennant.rotation.y=Math.PI/2;pennant.frustumCulled=false;pennant.userData.pennant=1;ship.add(pennant);
put2(xfMesh(cyl(0.025,0.025,1.8,5),MAT.dark,0,DECK+18.5,9));
function xfMesh(g,mat,x,y,z){const m=new THREE.Mesh(g,mat);m.position.set(x,y,z);m.castShadow=true;return m;}
function put2(m){ship.add(m);return m;}

/* hanging loose ropes (animated) */
const loose=[];const LOOSE_N=12;
for(const [x,y,z,len] of [[4.5,11.8,-0.35,6.0],[-3.6,10.3,-7.85,5.2],[2.6,16.5,9.05,7.5],[-5.4,11.8,-0.35,4.6],[3.2,19.1,-0.35,6.5]])loose.push({x,y,z,len,ph:rand(0,9),sw:0,sv:0});
const looseArr=new Float32Array(loose.length*LOOSE_N*2*3);
const looseGeo=new THREE.BufferGeometry();looseGeo.setAttribute('position',new THREE.BufferAttribute(looseArr,3));
const looseLines=new THREE.LineSegments(looseGeo,new THREE.LineBasicMaterial({color:0x3a2a1c}));looseLines.frustumCulled=false;ship.add(looseLines);

/* ================= INTERACTIVES ================= */
const proxies=[],blockers=[STATIC.wall];
function addProxy(parent,w,h,d,x,y,z,def){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),proxyMat);m.position.set(x,y,z);m.userData.inter=def;parent.add(m);proxies.push(m);def.proxy=m;return def;}
const COLL=[];
const circ=(x,z,r,layer='all')=>COLL.push({t:'c',x,z,r,layer});
const boxC=(x0,x1,z0,z1,layer='all',on=null)=>COLL.push({t:'b',x0,x1,z0,z1,layer,on});
for(const m of MASTS)circ(0,m.z,0.42);
boxC(-1.0,1.0,-1.45,0.45,'all');           // fife rail
circ(0,-5.4,0.62);                           // capstan
boxC(-2.5,-1.6,-9.95,-9.05);circ(-1.25,-10.1,0.5); // crates bow
boxC(2.2,3.1,12.15,13.05,'high');           // crate by spyglass
circ(-1.9,-7.0,0.55);
boxC(-2.3,-0.6,9.15,10.25,'low');           // table
circ(-1.45,10.75,0.32,'low');
boxC(1.4,3.4,8.8,9.8,'low');                // bunk
boxC(-qhw,-0.6,5.9,6.12,'low');boxC(0.6,qhw,5.9,6.12,'low');
for(const sg of [1,-1])boxC(sg>0?2.24:-2.36,sg>0?2.36:-2.24,3.0,6.0,'all');
boxC(-2.3,2.3,5.98,6.14,'high');
circ(0,-11.4,0.5);                           // bell frame
circ(0,10.05,0.32,'high');

/* --- lanterns --- */
const lanterns=[];
const lanIron=(()=>{const L=[];L.push(xf(box(0.24,0.04,0.24),0,-0.16,0));L.push(xf(new THREE.ConeGeometry(0.19,0.16,4),0,0.21,0,0,Math.PI/4,0));
  for(const [x,z] of [[-0.1,-0.1],[0.1,-0.1],[-0.1,0.1],[0.1,0.1]])L.push(xf(box(0.02,0.34,0.02),x,0.02,z));
  L.push(xf(new THREE.TorusGeometry(0.05,0.012,4,10),0,0.33,0));L.push(xf(box(0.24,0.03,0.24),0,0.14,0));return merge(L);})();
const lanGlass=new THREE.BoxGeometry(0.17,0.27,0.17);
const LANTERN_SPOTS=[
  {name:'mast',x:0,y:DECK+2.9,z:-1.05,swing:true},{name:'cabin',x:0.9,y:QD-0.18,z:8.2,swing:true},
  {name:'doorL',x:-1.0,y:QD-0.25,z:QZ-0.2,swing:true},{name:'doorR',x:1.0,y:QD-0.25,z:QZ-0.2,swing:true},
  {name:'stern',x:0,y:QD+2.1,z:13.55,swing:false,scale:1.9},{name:'fore',x:0,y:DECK+2.6,z:-8.55,swing:true}];
for(const sp of LANTERN_SPOTS){
  const pivot=new THREE.Group();pivot.position.set(sp.x,sp.y,sp.z);ship.add(pivot);
  const body=new THREE.Group();body.position.y=-0.5*(sp.scale||1);if(sp.scale)body.scale.setScalar(sp.scale);pivot.add(body);
  const iron=new THREE.Mesh(lanIron,MAT.iron);iron.castShadow=true;body.add(iron);
  const gm=MAT.glass.clone();const glass=new THREE.Mesh(lanGlass,gm);body.add(glass);
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:0xffa850,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));glow.scale.setScalar(1.1);body.add(glow);
  if(!sp.scale){const chain=new THREE.Mesh(cyl(0.008,0.008,0.17,4),MAT.iron);chain.position.y=0.42;body.add(chain);}
  if(sp.name.startsWith('door'))put2(xfMesh(box(0.05,0.05,0.3),MAT.iron,sp.x,sp.y,sp.z+0.03));
  if(sp.name==='stern'){put2(xfMesh(cyl(0.05,0.06,1.6,6),MAT.dark,0,QD+0.8,13.6));put2(xfMesh(box(0.05,0.05,0.4),MAT.iron,0,QD+1.6,13.6));pivot.position.y=QD+2.15;body.position.y=-0.35;}
  if(sp.name==='cabin'){body.position.y=-0.24;}
  if(sp.name==='mast'){put2(xfMesh(box(0.05,0.05,0.5),MAT.iron,0,sp.y,-0.78));}
  if(sp.name==='fore'){put2(xfMesh(box(0.05,0.05,0.5),MAT.iron,0,sp.y,-8.3));}
  const light=new THREE.PointLight(0xff9a45,0,sp.name==='stern'?14:9,2);light.position.y=0.0;body.add(light);
  const L={...sp,pivot,body,glass,gm,glow,light,on:true,lvl:1,ax:0,az:0,vx:0,vz:0,flick:rand(0,9)};
  lanterns.push(L);
  addProxy(body,0.45,0.7,0.45,0,0,0,{hl:body,lantern:L,label:()=>L.on?'Douse the lantern':'Light the lantern',act:()=>{L.on=!L.on;L.vx+=rand(-1,1)*1.5;L.vz+=1.2;sfx.clink(L.pivot);if(L.on)sfx.whoosh(L.pivot);}});
}

/* --- door --- */
const door={cur:0,tgt:0};
door.pivot=new THREE.Group();door.pivot.position.set(-0.6,DECK,QZ);ship.add(door.pivot);
{const L=[xf(box(1.18,2.0,0.07),0.59,1.0,0)];for(const y of [0.4,1.6])L.push(xf(box(1.18,0.06,0.04),0.59,y,-0.05));
 const d=new THREE.Mesh(merge(L),MAT.med);d.castShadow=true;d.receiveShadow=true;door.pivot.add(d);
 const ir=[xf(new THREE.TorusGeometry(0.06,0.012,5,12),1.02,1.0,-0.07),xf(box(0.3,0.05,0.02),0.15,0.4,-0.05),xf(box(0.3,0.05,0.02),0.15,1.6,-0.05)];
 const im=new THREE.Mesh(merge(ir),MAT.iron);door.pivot.add(im);door.mesh=d;blockers.push(d);}
addProxy(door.pivot,1.2,2.0,0.25,0.6,1.0,0,{hl:door.pivot,label:()=>door.tgt?'Close the cabin door':'Open the cabin door',act:()=>{door.tgt=door.tgt?0:1;sfx.door(V(0,DECK+1,QZ));}});
boxC(-0.6,0.6,5.92,6.12,'low',()=>door.cur<0.45);
boxC(-0.85,-0.5,6.0,7.25,'low',()=>door.cur>0.55);

/* --- helm wheel --- */
const helm={angle:0,vel:0,clickAcc:0};
helm.grp=new THREE.Group();helm.grp.position.set(0,QD+1.22,11.3);ship.add(helm.grp);
{const L=[];L.push(xf(new THREE.TorusGeometry(0.66,0.045,6,28)));L.push(xf(new THREE.TorusGeometry(0.5,0.025,5,24)));
 for(let i=0;i<8;i++){const a=i/8*TAU;L.push(xf(cyl(0.026,0.03,0.88,6),Math.cos(a)*0.5,Math.sin(a)*0.5,0,0,0,a-Math.PI/2));L.push(xf(cyl(0.035,0.025,0.2,6),Math.cos(a)*1.02,Math.sin(a)*1.02,0,0,0,a-Math.PI/2));}
 L.push(xf(cyl(0.13,0.13,0.26,12),0,0,0,Math.PI/2,0,0));
 helm.wheel=new THREE.Mesh(merge(L),MAT.med);helm.wheel.castShadow=true;helm.grp.add(helm.wheel);
 const hub=new THREE.Mesh(cyl(0.08,0.08,0.3,10),MAT.brass);hub.rotation.x=Math.PI/2;helm.wheel.add(hub);
 const knob=new THREE.Mesh(new THREE.SphereGeometry(0.05,8,6),MAT.brass);knob.position.set(0,1.12,0);helm.wheel.add(knob);}
put2(meshOf([xf(box(0.16,1.15,0.2),0,QD+0.58,11.48),xf(box(0.5,0.12,0.4),0,QD+0.06,11.5),xf(box(0.12,0.12,0.5),0,QD+1.22,11.5)],MAT.dark));
addProxy(helm.grp,2.2,2.2,0.5,0,0,0,{hl:helm.grp,label:()=>'Take the helm',sub:'or press F anywhere',act:()=>setMode('captain')});
circ(0,11.45,0.45,'high');
// binnacle
put2(meshOf([xf(box(0.5,0.95,0.5),0,QD+0.48,10.05),xf(cyl(0.3,0.3,0.05,10),0,QD+0.98,10.05)],MAT.med));
const binDome=put2(xfMesh(new THREE.SphereGeometry(0.22,14,8,0,TAU,0,Math.PI/2),MAT.brass,0,QD+1.0,10.05));

/* --- bell --- */
const bell={a:0,v:0,rings:0};
put2(meshOf([xf(box(0.14,2.3,0.14),-0.55,DECK+1.15,-11.4),xf(box(0.14,2.3,0.14),0.55,DECK+1.15,-11.4),xf(box(1.4,0.16,0.18),0,DECK+2.3,-11.4),xf(box(1.3,0.12,0.5),0,DECK+0.06,-11.4)],MAT.dark));
bell.pivot=new THREE.Group();bell.pivot.position.set(0,DECK+2.2,-11.4);ship.add(bell.pivot);
{const prof=[[0.0,-0.02],[0.08,-0.04],[0.12,-0.08],[0.15,-0.2],[0.18,-0.34],[0.25,-0.46],[0.26,-0.49],[0.2,-0.48]].map(([r,y])=>new THREE.Vector2(r,y));
 const bm=new THREE.Mesh(new THREE.LatheGeometry(prof,18),MAT.brass);bm.castShadow=true;bell.pivot.add(bm);
 const cl=new THREE.Mesh(new THREE.SphereGeometry(0.05,8,6),MAT.iron);cl.position.y=-0.42;bell.pivot.add(cl);
 const rope=new THREE.Mesh(cyl(0.015,0.015,0.6,4),MAT.rope);rope.position.y=-0.75;bell.pivot.add(rope);}
addProxy(bell.pivot,0.7,1.1,0.7,0,-0.4,0,{hl:bell.pivot,label:()=>'Ring the ship’s bell',sub:'other ships will hear it',act:()=>{bell.v+=2.6;sfx.bell(bell.pivot);bell.rings++;netSend({t:'bell'});
  if(bell.rings===8)say('Eight bells. The end of the watch — and no one left to relieve you.');else if(bell.rings===1)say('The bell rings out across the empty water.');}});

/* --- cannons --- */
const cannons=[];
const barrelProf=[[0,0],[0.07,0.02],[0.09,0.08],[0.05,0.14],[0.16,0.18],[0.19,0.28],[0.19,0.5],[0.175,0.56],[0.155,1.2],[0.14,1.62],[0.165,1.67],[0.165,1.8],[0.11,1.82],[0.065,1.82],[0.065,1.6]].map(([r,y])=>new THREE.Vector2(r,y));
const barrelG=(()=>{const g=new THREE.LatheGeometry(barrelProf,16);g.rotateZ(-Math.PI/2);g.translate(-0.78,0,0);const t=cyl(0.05,0.05,0.5,6);t.rotateX(Math.PI/2);t.translate(0.0,0,0);return merge([g,t]);})();
const carriageG=(()=>{const L=[];for(const z of [-0.24,0.24])L.push(xf(box(1.1,0.42,0.09),-0.05,0.36,z));L.push(xf(box(1.0,0.1,0.56),-0.05,0.2,0));
  for(const x of [-0.42,0.36])for(const z of [-0.34,0.34])L.push(xf(cyl(0.17,0.17,0.08,10),x,0.17,z,Math.PI/2,0,0));L.push(xf(box(0.3,0.08,0.4),-0.5,0.45,0,0,0,-0.2));return merge(L);})();
for(const sg of [1,-1])for(const z of PORTS){
  const grp=new THREE.Group();const x=sg*(hw(z)*0.962-1.05);grp.position.set(x,DECK,z);grp.rotation.y=sg>0?0:Math.PI;ship.add(grp);
  const slide=new THREE.Group();grp.add(slide);
  const car=new THREE.Mesh(carriageG,MAT.med);car.castShadow=true;car.receiveShadow=true;slide.add(car);
  const bar=new THREE.Mesh(barrelG,MAT.iron);bar.position.set(0,0.62,0);bar.rotation.z=0.03;bar.castShadow=true;slide.add(bar);
  const C={grp,slide,bar,sg,z,x,recoil:0,ready:0,idx:cannons.length};bar.userData.cannon=C.idx;slide.userData.cslide=C.idx;
  cannons.push(C);
  addProxy(slide,2.0,0.9,0.9,0.1,0.45,0,{hl:slide,label:()=>'Man the cannon',sub:()=>'aim it yourself · '+(sg>0?'starboard':'port'),act:()=>manCannon(OWN,C.idx)});
  circ(x-sg*0.35,z,0.5);circ(x+sg*0.35,z,0.45);
}

/* --- barrels --- */
const barrels=[];
const barrelWoodG=(()=>{const p=[];for(let i=0;i<=10;i++){const t=i/10;p.push(new THREE.Vector2(0.29+0.07*(1-(2*t-1)**2),t*0.95-0.475));}
  const g=new THREE.LatheGeometry(p,16);const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*1.0,uv.getY(i)*0.5);
  return merge([g,xf(new THREE.CircleGeometry(0.29,16),0,0.475,0,-Math.PI/2,0,0),xf(new THREE.CircleGeometry(0.29,16),0,-0.475,0,Math.PI/2,0,0)]);})();
const hoopG=(()=>{const L=[];for(const y of [-0.38,-0.15,0.15,0.38]){const r=0.29+0.07*(1-(2*((y+0.475)/0.95)-1)**2)+0.006;L.push(xf(new THREE.TorusGeometry(r,0.014,4,18),0,y,0,Math.PI/2,0,0));}return merge(L);})();
const BARREL_LINES=['Something heavy sloshes inside.','Hollow. Whatever it held is long gone.','Salt pork, by the smell of it.','Rum. The captain’s mark is burned into the lid.','Fresh water — the last of it.','Lamp oil. Enough for a few more nights.','Gunpowder, sealed with wax. Better not knock too hard.'];
for(const [x,z,y0,lyingRot] of [[1.95,-10.0,DECK,0],[2.15,-9.15,DECK,0],[1.35,-9.6,DECK,0],[1.75,QZ-0.55,DECK,0],[-1.75,QZ-0.55,DECK,0],[-2.25,-1.8,DECK,0],[2.3,10.2,QD,0],[-2.3,12.4,DECK,0]]){
  const g=new THREE.Group();g.position.set(x,y0+0.475,z);g.rotation.y=rand(0,TAU);ship.add(g);
  const w=new THREE.Mesh(barrelWoodG,MAT.med);w.castShadow=true;w.receiveShadow=true;g.add(w);
  const h=new THREE.Mesh(hoopG,MAT.iron);g.add(h);
  const Bo={g,wx:0,wz:0,vx:0,vz:0,line:BARREL_LINES[barrels.length%BARREL_LINES.length]};barrels.push(Bo);
  addProxy(g,0.7,1.0,0.7,0,0,0,{hl:g,label:()=>'Knock on the barrel',act:()=>{Bo.vx+=rand(-1,1)*0.9;Bo.vz+=rand(0.6,1)*(Math.random()<0.5?-1:1);sfx.knock(g);say(Bo.line,3.5);}});
  circ(x,z,0.4,y0>3?(x>2.2&&z<11?'high':'low'):'low');
}

/* --- sails control (fife rail) --- */
let sailLvl=2,sailF=1;const SAIL_T=[0,0.55,1];
addProxy(ship,2.2,1.0,0.5,0,DECK+0.75,0.4,{label:()=>sailLvl>0?'Haul up the sails':'Set full sail',sub:'or W / S at the helm',act:()=>{setSail(sailLvl>0?0:2);}});

/* --- spyglass --- */
const spyMesh=new THREE.Group();spyMesh.position.set(2.65,QD+0.8,12.6);spyMesh.rotation.y=0.3;ship.add(spyMesh);
for(const [r,l,x] of [[0.045,0.36,-0.2],[0.038,0.3,0.1],[0.031,0.25,0.33]]){const m=new THREE.Mesh(cyl(r,r,l,10),MAT.brass);m.rotation.z=Math.PI/2;m.position.x=x;m.castShadow=true;spyMesh.add(m);}
addProxy(spyMesh,0.95,0.3,0.3,0.05,0,0,{hl:spyMesh,label:()=>'Look through the spyglass',act:()=>enterSpy()});

/* --- cabin: chest, log, chart --- */
const chest={cur:0,tgt:0};
chest.grp=new THREE.Group();chest.grp.position.set(1.6,DECK,12.65);chest.grp.rotation.y=Math.PI;ship.add(chest.grp);
{const base=new THREE.Mesh(merge([xf(box(0.95,0.5,0.55),0,0.25,0)]),MAT.med);base.castShadow=true;chest.grp.add(base);
 const ib=new THREE.Mesh(merge([xf(box(0.97,0.05,0.57),0,0.12,0),xf(box(0.97,0.05,0.57),0,0.42,0),xf(box(0.1,0.12,0.03),0,0.44,-0.29)]),MAT.iron);chest.grp.add(ib);
 chest.lidPivot=new THREE.Group();chest.lidPivot.position.set(0,0.5,0.275);chest.grp.add(chest.lidPivot);
 const lg=new THREE.CylinderGeometry(0.275,0.275,0.95,12,1,false,0,Math.PI);lg.rotateZ(Math.PI/2);lg.translate(0,0,-0.275);
 const lid=new THREE.Mesh(lg,MAT.med);lid.castShadow=true;chest.lidPivot.add(lid);
 const gold=new THREE.Mesh(new THREE.SphereGeometry(0.4,14,8),new THREE.MeshStandardMaterial({color:0xd9a441,metalness:1,roughness:0.28,emissive:0x2a1500}));gold.scale.set(1.08,0.28,0.6);gold.position.y=0.44;chest.grp.add(gold);
 chest.glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:0xffc060,blending:THREE.AdditiveBlending,transparent:true,opacity:0,depthWrite:false}));chest.glow.position.y=0.6;chest.glow.scale.setScalar(1.3);chest.grp.add(chest.glow);}
addProxy(chest.grp,1.0,0.8,0.6,0,0.35,0,{hl:chest.grp,label:()=>'Ship’s strongbox',sub:()=>fmtG(strongGold(OWN))+' gold inside',act:()=>{chest.tgt=1;sfx.creak(0.25,chest.grp,1.4);openStrongbox(OWN);}});
circ(1.6,12.65,0.55,'low');
const mapImg=mapCanvas();const mapTex=mkTex(mapImg,false);
put2(xfMesh(new THREE.PlaneGeometry(0.9,0.6),new THREE.MeshStandardMaterial({map:mapTex,roughness:0.95}),-1.35,DECK+0.825,9.85)).rotation.set(-Math.PI/2,0,0.08);
addProxy(ship,0.95,0.2,0.65,-1.35,DECK+0.86,9.85,{label:()=>'Study the chart',act:()=>{sfx.paper(V(-1.35,DECK+1,9.85));
  openNote(`<h2>The chart</h2><img alt="A hand-drawn sea chart" src="${mapImg.toDataURL()}"><p>A pencilled line runs from Saint Brannoc toward a coast marked only <em>Home</em>. Halfway along, someone has scratched an X and written the date three times over.</p>`);}});
addProxy(ship,0.4,0.2,0.35,-1.75,DECK+0.88,9.45,{label:()=>'Read the captain’s log',act:()=>{sfx.paper(V(-1.75,DECK+1,9.45));
  openNote(`<h2>Captain’s log — the Saltwren</h2><p><em>The forty-first day.</em></p><p>Wind fair from the south-west, the sea gentle as a sleeping dog. The men took both longboats at first light, bound for Saint Brannoc and its sweet water. They have not come back.</p><p>I keep her lanterns lit each dusk, so they may find us.</p><p>I find I do not mind the quiet. The gulls keep me company, and the old girl talks enough for the both of us — every board of her has an opinion.</p><p>If you are reading this, the helm is yours now. Keep the sun fine on the bow and she will carry you home.</p><p style="text-align:right">— E. Marlowe, Master</p>`);}});
const candle={flame:new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:0xffb050,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false}))};
candle.flame.position.set(-1.0,DECK+1.02,9.45);candle.flame.scale.set(0.12,0.2,1);ship.add(candle.flame);

/* ================= WATER ================= */
const WAVES=[[1,0.3,0.12,60],[0.6,1,0.12,31],[-0.4,1,0.11,18],[1,-0.7,0.09,11],[-0.8,-0.3,0.07,6.5]];
const waterU={uTime:{value:0},uOffset:{value:new THREE.Vector2()},uW:{value:WAVES.map(w=>new THREE.Vector4(w[0],w[1],w[2],w[3]))},uAmp:{value:1},
  uSunDir:{value:sunDir},uSunI:{value:1},uSunColor:{value:new THREE.Color()},uNorm:{value:waterNormalTex()},uFoam:{value:foamTex()},uHeading:{value:0},uSpeed:{value:1},uDetail:{value:1},uShips:{value:Array.from({length:8},()=>new THREE.Vector4())},uShipS:{value:new Array(8).fill(1)},uShipN:{value:1},uNight:U_NIGHT,uFogW:U_FOG,uMoonDir:U_MOON};
const waterMat=new THREE.ShaderMaterial({uniforms:waterU,
  vertexShader:`uniform float uTime,uAmp;uniform vec2 uOffset;uniform vec4 uW[5];
  varying vec3 vWorld,vN;varying float vH;
  void main(){vec3 p=position;float dist=length(p.xz);vec2 q=p.xz+uOffset;
    vec3 disp=vec3(0.0),tg=vec3(1.0,0.0,0.0),bn=vec3(0.0,0.0,1.0);
    for(int i=0;i<5;i++){vec4 w=uW[i];float L=w.w;float fade=1.0-smoothstep(L*6.0,L*16.0,dist);float s=w.z*uAmp*fade;
      float k=6.28318/L;float c=sqrt(9.8/k);vec2 d=normalize(w.xy);float f=k*(dot(d,q)-c*uTime);float a=s/k;float sf=sin(f),cf=cos(f);
      disp+=vec3(d.x*a*cf,a*sf,d.y*a*cf);tg+=vec3(-d.x*d.x*s*sf,d.x*s*cf,-d.x*d.y*s*sf);bn+=vec3(-d.x*d.y*s*sf,d.y*s*cf,-d.y*d.y*s*sf);}
    p+=disp;vH=disp.y;vN=normalize(cross(bn,tg));vec4 wp=modelMatrix*vec4(p,1.0);vWorld=wp.xyz;gl_Position=projectionMatrix*viewMatrix*wp;}`,
  fragmentShader:SKY_GLSL+`
  uniform sampler2D uNorm,uFoam;uniform float uTime,uHeading,uSpeed,uDetail;uniform vec4 uShips[8];uniform float uShipS[8];uniform int uShipN;uniform vec2 uOffset;uniform vec3 uSunColor;
  varying vec3 vWorld,vN;varying float vH;
  void main(){
    vec3 V=cameraPosition-vWorld;float dist=length(V);V/=dist;
    vec2 wp=vWorld.xz+uOffset;
    float df=uDetail*(1.0-smoothstep(50.0,1500.0,dist));
    vec2 a=texture2D(uNorm,wp*0.045+vec2(uTime*0.013,uTime*0.009)).xy*2.0-1.0;
    vec2 b=texture2D(uNorm,wp*0.115+vec2(-uTime*0.021,uTime*0.016)).xy*2.0-1.0;
    vec2 c=texture2D(uNorm,wp*0.0075+vec2(uTime*0.004,-uTime*0.003)).xy*2.0-1.0;
    vec3 n=normalize(normalize(vN)+vec3(a.x+b.x*0.6,0.0,a.y+b.y*0.6)*0.3*df+vec3(c.x,0.0,c.y)*0.16);
    float ndv=max(dot(n,V),0.0);
    vec3 R=reflect(-V,n);R.y=abs(R.y);
    vec3 refl=skyBase(R);
    float fres=0.02+0.98*pow(1.0-ndv,5.0);
    vec3 deep=vec3(0.008,0.03,0.05)*(0.45+0.55*uSunI);
    vec3 toSun=normalize(vec3(uSunDir.x,0.15,uSunDir.z));
    vec3 scatter=vec3(0.05,0.2,0.18)*clamp(vH*0.6+0.35,0.0,1.2)*uSunI*(0.25+1.2*pow(max(dot(-V,toSun),0.0),4.0));
    vec3 col=mix(deep+scatter,refl,fres);
    vec3 H=normalize(uSunDir+V);float nh=max(dot(n,H),0.0);
    col+=uSunColor*(pow(nh,700.0)*45.0+pow(nh,90.0)*0.7)*smoothstep(-0.02,0.02,uSunDir.y)*(1.0-uFogW*0.7);
    col+=vec3(0.6,0.65,0.8)*pow(max(dot(n,normalize(uMoonDir+V)),0.0),300.0)*4.0*uNight*(1.0-uFogW);
    float fA=texture2D(uFoam,wp*0.09).r,fB=texture2D(uFoam,wp*0.23+vec2(uTime*0.02,0.0)).r;
    float crest=smoothstep(1.25,2.0,vH+fA*0.7)*0.3;
    float wake=0.0;
    for(int i=0;i<8;i++){
      if(i>=uShipN)break;
      vec4 S=uShips[i];vec2 r=vWorld.xz-S.xy;
      if(dot(r,r)>360000.0)continue;
      float ch=cos(S.z),sh=sin(S.z),sp=S.w;
      vec2 lw=vec2(ch*r.x-sh*r.y,sh*r.x+ch*r.y)/uShipS[i];
      float e=length(vec2(lw.x/4.25,(lw.y+0.5)/14.9));
      wake+=smoothstep(1.3,1.0,e)*(0.35+0.65*sp);
      float tz=lw.y-11.0;
      if(tz>0.0){float wdt=2.6+tz*0.075;wake+=smoothstep(wdt,wdt*0.15,abs(lw.x))*exp(-tz/120.0)*sp;}
      float bz=lw.y+15.0;
      if(bz>0.0){wake+=smoothstep(1.8,0.0,abs(abs(lw.x)-bz*0.36-1.2))*exp(-bz/95.0)*sp*0.8;}
    }
    wake=clamp(wake,0.0,1.0);
    float foam=clamp(crest+wake*smoothstep(0.2,0.75,fA*0.6+fB*0.6),0.0,1.0)*(1.0-smoothstep(250.0,1000.0,dist));
    vec3 foamCol=vec3(0.92,0.86,0.8)*(0.3+0.7*uSunI)*(0.65+0.35*normalize(uSunColor+0.001));
    foamCol+=uSunColor*0.08*max(dot(n,uSunDir),0.0);
    col=mix(col,foamCol,foam*0.85);
    vec3 hz=skyBase(normalize(vec3(-V.x,0.0,-V.z)));
    float fog=1.0-exp(-dist*(0.00045+uFogW*0.005));
    col=mix(col,hz,clamp(fog*fog*1.25+uFogW*fog,0.0,1.0));
    gl_FragColor=vec4(col,1.0);
    `+TAIL+`}`});
function waterGeo(N){
  const pos=new Float32Array((N+1)*(N+1)*3);const idx=[];
  const map=u=>Math.sign(u)*(130*Math.abs(u)+6200*Math.pow(Math.abs(u),3));
  let k=0;for(let j=0;j<=N;j++)for(let i=0;i<=N;i++){pos[k++]=map(i/N*2-1);pos[k++]=0;pos[k++]=map(j/N*2-1);}
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const a=j*(N+1)+i,b=a+1,c=a+N+1,d=c+1;idx.push(a,c,b,b,c,d);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setIndex(idx);g.boundingSphere=new THREE.Sphere(new THREE.Vector3(),9000);return g;
}
let waterN=G().water;
const water=new THREE.Mesh(waterGeo(waterN),waterMat);water.frustumCulled=false;scene.add(water);
const seaOff=new THREE.Vector2();
function waveH(x,z,t){let h=0;const qx=x+seaOff.x,qz=z+seaOff.y;for(const w of WAVES){const L=w[3],k=TAU/L,c=Math.sqrt(9.8/k),dl=Math.hypot(w[0],w[1]),f=k*((w[0]/dl)*qx+(w[1]/dl)*qz-c*t);h+=w[2]*waterU.uAmp.value/k*Math.sin(f);}return h;}

/* ================= GULLS ================= */
const BN=7;
const gullMat=new THREE.MeshStandardMaterial({color:0xd8d3c8,roughness:0.8,side:THREE.DoubleSide});
const gBody=new THREE.SphereGeometry(0.16,8,5);gBody.scale(0.8,0.7,2.6);
function wingG(s){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,-0.18,0,0,0.2,s*0.6,0.04,0.0, 0,0,0.2,s*0.6,0.04,0.12,s*0.6,0.04,0.0, s*0.6,0.04,0.0,s*0.6,0.04,0.12,s*1.15,-0.03,0.25],3));g.computeVertexNormals();return g;}
const gB=new THREE.InstancedMesh(gBody,gullMat,BN),gL=new THREE.InstancedMesh(wingG(-1),gullMat,BN),gR=new THREE.InstancedMesh(wingG(1),gullMat,BN);
for(const m of [gB,gL,gR]){m.frustumCulled=false;scene.add(m);}
const gulls=[];for(let i=0;i<BN;i++)gulls.push({th:rand(0,TAU),r:rand(18,55),h:rand(16,34),w:rand(0.08,0.2)*(Math.random()<0.3?-1:1),ph:rand(0,9),flap:1,ft:rand(1,4),fa:0,cx:rand(-8,8),cz:rand(-12,6)});
const gM2=new THREE.Matrix4(),gM=new THREE.Matrix4(),gW=new THREE.Matrix4(),gQ=new THREE.Quaternion(),gP=new THREE.Vector3(),gS=new THREE.Vector3(1,1,1),gE=new THREE.Euler();

/* ================= PARTICLES ================= */
const PMAX=700;const pPos=new Float32Array(PMAX*3),pSz=new Float32Array(PMAX),pA=new Float32Array(PMAX),pK=new Float32Array(PMAX);
const pGeo=new THREE.BufferGeometry();pGeo.setAttribute('position',new THREE.BufferAttribute(pPos,3));pGeo.setAttribute('size',new THREE.BufferAttribute(pSz,1));pGeo.setAttribute('alpha',new THREE.BufferAttribute(pA,1));pGeo.setAttribute('kind',new THREE.BufferAttribute(pK,1));
const pU={uScale:{value:500},uSun:{value:new THREE.Color()},uAmb:{value:new THREE.Color()}};
const pMat=new THREE.ShaderMaterial({uniforms:pU,transparent:true,depthWrite:false,
  vertexShader:`attribute float size,alpha,kind;uniform float uScale;varying float vA,vK;void main(){vA=alpha;vK=kind;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=min(size*uScale/-mv.z,600.0);gl_Position=projectionMatrix*mv;}`,
  fragmentShader:`uniform vec3 uSun,uAmb;varying float vA,vK;void main(){vec2 p=gl_PointCoord-0.5;float d=length(p)*2.0;if(d>1.0)discard;
    float a=smoothstep(1.0,0.15,d)*vA;vec3 c;
    if(vK<0.5)c=vec3(0.95,0.92,0.88)*(uAmb+uSun*0.6);else if(vK<1.5)c=mix(vec3(0.42,0.38,0.36),vec3(0.75,0.62,0.52),0.5-p.y)*(uAmb*1.2+uSun*0.5);else if(vK<2.5){c=vec3(1.0,0.75,0.35)*3.0;}else if(vK<3.5){c=vec3(0.32,0.2,0.11)*(uAmb*1.4+uSun*0.9);a=step(d,0.85)*vA;}else{c=vec3(1.0,0.45,0.12)*2.6;}
    gl_FragColor=vec4(c,a);`+TAIL+`}`});
const pts=new THREE.Points(pGeo,pMat);pts.frustumCulled=false;pts.renderOrder=5;scene.add(pts);
const parts=[];
function emit(o){if(parts.length>=PMAX)return;parts.push(Object.assign({life:0,max:1,s0:0.3,s1:0.6,a0:0.8,kind:0,g:-9.8,drag:0.5,sea:false},o));}

const flash=new THREE.PointLight(0xffb060,0,22,2);scene.add(flash);let flashT=0;

/* ================= LIGHTS ================= */
const sun=new THREE.DirectionalLight(0xffffff,2.5);
sun.shadow.camera.left=-26;sun.shadow.camera.right=26;sun.shadow.camera.top=26;sun.shadow.camera.bottom=-26;sun.shadow.camera.near=1;sun.shadow.camera.far=170;
sun.shadow.bias=-0.0004;sun.shadow.normalBias=0.035;
scene.add(sun,sun.target);
const hemi=new THREE.HemisphereLight(0x8a86b8,0x2a1a12,0.25);scene.add(hemi);

/* ================= GRAPHICS APPLY ================= */
let appliedShadows=-1,appliedLights=-1;
function applyGraphics(){
  const g=G();
  applySize();
  if(g.shadows!==appliedShadows){
    const on=g.shadows>0;renderer.shadowMap.enabled=on;sun.castShadow=on;
    renderer.shadowMap.type=g.shadows>1024?THREE.PCFSoftShadowMap:THREE.PCFShadowMap;
    if(on){sun.shadow.mapSize.set(g.shadows,g.shadows);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}}
    scene.traverse(o=>{if(o.material)[].concat(o.material).forEach(m=>m.needsUpdate=true);});
    appliedShadows=g.shadows;
  }
  if(g.water!==waterN){water.geometry.dispose();water.geometry=waterGeo(g.water);waterN=g.water;}
  if(skyMat.defines.CLOUD_OCT!==g.clouds){skyMat.defines.CLOUD_OCT=g.clouds;skyMat.needsUpdate=true;}
  if(g.lights!==appliedLights){const order=['mast','cabin','doorL','stern','doorR','fore'];lanterns.forEach(L=>{L.light.visible=order.indexOf(L.name)<g.lights;});flash.visible=g.lights>2;appliedLights=g.lights;}
  waterU.uDetail.value=S.resolved==='low'&&!S.custom.water?0.8:1;
  camera.fov=S.fov;camera.updateProjectionMatrix();
  $('#fps').style.display=S.fps?'block':'none';
}

/* ================= AUDIO ================= */
const sfx=(()=>{
  let ctx=null,master,dry,verb,noise,brown;const A={};
  function init(){
    if(ctx)return;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    ctx=new AC();master=ctx.createGain();master.gain.value=S.volume/100;
    const comp=ctx.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=3;master.connect(comp);comp.connect(ctx.destination);
    dry=ctx.createGain();dry.connect(master);
    verb=ctx.createConvolver();const len=ctx.sampleRate*2.6,ir=ctx.createBuffer(2,len,ctx.sampleRate);
    for(let c=0;c<2;c++){const d=ir.getChannelData(c);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3.2);}
    verb.buffer=ir;const vg=ctx.createGain();vg.gain.value=0.55;verb.connect(vg);vg.connect(master);
    const nl=ctx.sampleRate*4;noise=ctx.createBuffer(1,nl,ctx.sampleRate);brown=ctx.createBuffer(2,nl,ctx.sampleRate);
    const nd=noise.getChannelData(0);for(let i=0;i<nl;i++)nd[i]=Math.random()*2-1;
    for(let c=0;c<2;c++){const bd=brown.getChannelData(c);let l=0;for(let i=0;i<nl;i++){l=(l+0.02*(Math.random()*2-1))/1.02;bd[i]=l*3.5;}}
    // ocean beds (stereo)
    A.ocean=[];for(let k=0;k<2;k++){const s=ctx.createBufferSource();s.buffer=brown;s.loop=true;s.loopStart=k*1.3;const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=420+k*260;const g=ctx.createGain();g.gain.value=0;const p=ctx.createStereoPanner();p.pan.value=k?0.6:-0.6;s.connect(f);f.connect(g);g.connect(p);p.connect(dry);s.start(0,k*1.7);A.ocean.push({g,f});}
    // surf hiss
    {const s=ctx.createBufferSource();s.buffer=noise;s.loop=true;const f=ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=1800;f.Q.value=0.5;const g=ctx.createGain();g.gain.value=0;s.connect(f);f.connect(g);g.connect(dry);s.start();A.hiss={g};}
    // wind
    {const s=ctx.createBufferSource();s.buffer=noise;s.loop=true;const f=ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=500;f.Q.value=0.8;const g=ctx.createGain();g.gain.value=0;s.connect(f);f.connect(g);g.connect(dry);g.connect(verb);s.start(0,1);A.wind={g,f};
     const s2=ctx.createBufferSource();s2.buffer=noise;s2.loop=true;const f2=ctx.createBiquadFilter();f2.type='bandpass';f2.frequency.value=1250;f2.Q.value=18;const g2=ctx.createGain();g2.gain.value=0;s2.connect(f2);f2.connect(g2);g2.connect(dry);s2.start(0,2);A.whistle={g:g2,f:f2};}
  }
  const now=()=>ctx.currentTime;
  function out(node,pan=0,send=0.25,gain=1){const g=ctx.createGain();g.gain.value=gain;const p=ctx.createStereoPanner();p.pan.value=clamp(pan,-1,1);node.connect(g);g.connect(p);p.connect(dry);if(send){const s=ctx.createGain();s.gain.value=send;p.connect(s);s.connect(verb);}return g;}
  function noiseSrc(){const s=ctx.createBufferSource();s.buffer=noise;s.start(0,Math.random()*3);return s;}
  function env(g,t,a,peak,d){g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+a);g.gain.exponentialRampToValueAtTime(0.0001,t+a+d);}
  const _w=new THREE.Vector3(),_r=new THREE.Vector3(),_rt=new THREE.Vector3();
  function spat(obj){ // obj: Object3D or local Vector3
    if(obj.isVector3)_w.copy(obj),ship.localToWorld(_w);else obj.getWorldPosition(_w);
    _r.subVectors(_w,camera.position);const d=_r.length();_r.normalize();_rt.set(1,0,0).applyQuaternion(camera.quaternion);
    return {pan:_r.dot(_rt)*0.85,gain:1/(1+d*0.12),d};
  }
  const S_={
    init,get ctx(){return ctx;},
    setVol(v){if(master)master.gain.setTargetAtTime(v,now(),0.05);},
    update(o){if(!ctx)return;const t=now();
      A.ocean.forEach((x,i)=>{x.g.gain.setTargetAtTime(0.32+0.2*o.swell*(i?1:-1)+0.08*o.speed,t,0.3);});
      A.hiss.g.gain.setTargetAtTime(0.012+0.035*o.speed+0.02*Math.max(0,o.swell),t,0.3);
      A.wind.g.gain.setTargetAtTime(0.05+0.07*o.gust,t,0.4);A.wind.f.frequency.setTargetAtTime(380+520*o.gust,t,0.5);
      A.whistle.g.gain.setTargetAtTime(Math.max(0,o.gust-0.55)*0.035,t,0.6);A.whistle.f.frequency.setTargetAtTime(1100+400*o.gust,t,0.8);},
    creak(vol=0.22,where=null,len=0){if(!ctx)return;const sp=where?spat(where):{pan:rand(-0.8,0.8),gain:1};const t=now()+0.01,dur=len||rand(0.45,1.2);
      const o=ctx.createOscillator();o.type='sawtooth';const f0=rand(22,55);o.frequency.setValueAtTime(f0,t);o.frequency.linearRampToValueAtTime(f0*rand(0.55,1.6),t+dur);
      const b1=ctx.createBiquadFilter();b1.type='bandpass';b1.frequency.value=rand(450,1100);b1.Q.value=7;const b2=ctx.createBiquadFilter();b2.type='bandpass';b2.frequency.value=rand(1500,2600);b2.Q.value=9;
      const g=ctx.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+0.07);g.gain.setValueAtTime(vol*0.8,t+dur*0.7);g.gain.linearRampToValueAtTime(0,t+dur);
      o.connect(b1);o.connect(b2);b1.connect(g);b2.connect(g);out(g,sp.pan,0.3,sp.gain);o.start(t);o.stop(t+dur+0.05);},
    slap(vol=0.5,pan=0){if(!ctx)return;const t=now();const s=noiseSrc();const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(1400,t);f.frequency.exponentialRampToValueAtTime(220,t+0.6);const g=ctx.createGain();env(g,t,0.03,vol,0.7);s.connect(f);f.connect(g);out(g,pan,0.35);s.stop(t+1);
      const o=ctx.createOscillator();o.frequency.setValueAtTime(80,t);o.frequency.exponentialRampToValueAtTime(40,t+0.25);const g2=ctx.createGain();env(g2,t,0.01,vol*0.6,0.3);o.connect(g2);out(g2,pan,0.1);o.start(t);o.stop(t+0.4);},
    gull(pan=0,gain=0.5){if(!ctx)return;let t=now()+0.02;const n=(rand(1,4))|0;
      for(let i=0;i<n;i++){const o=ctx.createOscillator();o.type='triangle';const f0=rand(1700,2300);o.frequency.setValueAtTime(f0*0.8,t);o.frequency.linearRampToValueAtTime(f0,t+0.04);o.frequency.exponentialRampToValueAtTime(f0*0.55,t+0.26);
        const vb=ctx.createOscillator();vb.frequency.value=32;const vg=ctx.createGain();vg.gain.value=60;vb.connect(vg);vg.connect(o.frequency);
        const f=ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=1900;f.Q.value=1.4;const g=ctx.createGain();env(g,t,0.03,0.07*gain,0.25);o.connect(f);f.connect(g);out(g,pan,0.8);o.start(t);vb.start(t);o.stop(t+0.35);vb.stop(t+0.35);t+=rand(0.28,0.42);}},
    cannon(where){if(!ctx)return;const sp=spat(where);const t=now();
      const s=noiseSrc();const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(3000,t);f.frequency.exponentialRampToValueAtTime(140,t+1.6);const g=ctx.createGain();env(g,t,0.005,1.3,2.2);s.connect(f);f.connect(g);out(g,sp.pan,0.9);s.stop(t+2.6);
      const o=ctx.createOscillator();o.frequency.setValueAtTime(70,t);o.frequency.exponentialRampToValueAtTime(26,t+0.9);const g2=ctx.createGain();env(g2,t,0.005,1.6,1.1);o.connect(g2);out(g2,sp.pan,0.4);o.start(t);o.stop(t+1.3);
      const t2=t+1.7;const s2=noiseSrc();const f2=ctx.createBiquadFilter();f2.type='lowpass';f2.frequency.value=320;const g3=ctx.createGain();env(g3,t2,0.15,0.22,2.5);s2.connect(f2);f2.connect(g3);out(g3,-sp.pan,1.0);s2.stop(t2+3);},
    fuse(where){if(!ctx)return;const sp=spat(where);const t=now();const s=noiseSrc();const f=ctx.createBiquadFilter();f.type='highpass';f.frequency.value=4000;const g=ctx.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(0.12*sp.gain*3,t+0.05);g.gain.linearRampToValueAtTime(0.0001,t+0.55);s.connect(f);f.connect(g);out(g,sp.pan,0.1);s.stop(t+0.6);},
    splash(dist){if(!ctx)return;const t=now()+dist/340;const s=noiseSrc();const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=900;const g=ctx.createGain();env(g,t,0.02,0.25,1.3);s.connect(f);f.connect(g);out(g,rand(-0.3,0.3),0.9);s.stop(t+1.6);},
    bell(where){if(!ctx)return;const sp=spat(where);const t=now();const f0=612;
      [[1,0.5,4.5],[2.0,0.25,3.2],[2.76,0.2,2.4],[5.4,0.09,1.4],[8.9,0.05,0.8],[1.5,0.06,2]].forEach(([m,a,d])=>{const o=ctx.createOscillator();o.frequency.value=f0*m;const g=ctx.createGain();env(g,t,0.004,a*0.6,d);o.connect(g);out(g,sp.pan,0.7,Math.max(0.35,sp.gain*1.5));o.start(t);o.stop(t+d+0.1);});},
    door(where){S_.creak(0.3,where,1.1);if(!ctx)return;const sp=spat(where);const t=now()+0.9;const o=ctx.createOscillator();o.frequency.setValueAtTime(90,t);o.frequency.exponentialRampToValueAtTime(45,t+0.15);const g=ctx.createGain();env(g,t,0.005,0.25,0.18);o.connect(g);out(g,sp.pan,0.4,sp.gain*2);o.start(t);o.stop(t+0.3);},
    knock(where){if(!ctx)return;const sp=spat(where);for(let k=0;k<2;k++){const t=now()+k*0.17;const o=ctx.createOscillator();o.frequency.setValueAtTime(190,t);o.frequency.exponentialRampToValueAtTime(120,t+0.12);const g=ctx.createGain();env(g,t,0.003,0.45,0.22);o.connect(g);out(g,sp.pan,0.4,Math.max(0.5,sp.gain*2));o.start(t);o.stop(t+0.3);
      const s=noiseSrc();const f=ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=700;f.Q.value=3;const g2=ctx.createGain();env(g2,t,0.002,0.3,0.06);s.connect(f);f.connect(g2);out(g2,sp.pan,0.2);s.stop(t+0.1);}},
    clink(where){if(!ctx)return;const sp=spat(where);const t=now();[2400,3720,5100].forEach((f,i)=>{const o=ctx.createOscillator();o.frequency.value=f;const g=ctx.createGain();env(g,t,0.002,0.06/(i+1),0.35);o.connect(g);out(g,sp.pan,0.3);o.start(t);o.stop(t+0.4);});},
    whoosh(where){if(!ctx)return;const sp=spat(where);const t=now();const s=noiseSrc();const f=ctx.createBiquadFilter();f.type='bandpass';f.Q.value=1.2;f.frequency.setValueAtTime(250,t);f.frequency.exponentialRampToValueAtTime(1300,t+0.35);const g=ctx.createGain();env(g,t,0.12,0.12,0.3);s.connect(f);f.connect(g);out(g,sp.pan,0.2);s.stop(t+0.6);},
    coins(where){if(!ctx)return;const sp=spat(where);for(let i=0;i<14;i++){const t=now()+0.5+Math.pow(Math.random(),1.6)*0.9;const o=ctx.createOscillator();o.frequency.value=rand(2600,6400);const g=ctx.createGain();env(g,t,0.001,rand(0.02,0.06),rand(0.08,0.25));o.connect(g);out(g,sp.pan,0.4);o.start(t);o.stop(t+0.3);}},
    paper(where){if(!ctx)return;const t=now();const s=noiseSrc();const f=ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=3200;f.Q.value=0.7;const g=ctx.createGain();g.gain.setValueAtTime(0,t);for(let k=0;k<6;k++)g.gain.linearRampToValueAtTime(Math.random()*0.08,t+k*0.05);g.gain.linearRampToValueAtTime(0,t+0.35);s.connect(f);f.connect(g);out(g,0,0.15);s.stop(t+0.4);},
    step(){if(!ctx)return;const t=now();const o=ctx.createOscillator();o.frequency.setValueAtTime(rand(95,125),t);o.frequency.exponentialRampToValueAtTime(60,t+0.08);const g=ctx.createGain();env(g,t,0.004,0.11,0.1);o.connect(g);out(g,rand(-0.1,0.1),0.15);o.start(t);o.stop(t+0.15);
      const s=noiseSrc();const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=600;const g2=ctx.createGain();env(g2,t,0.003,0.06,0.07);s.connect(f);f.connect(g2);out(g2,0,0.1);s.stop(t+0.12);
      if(Math.random()<0.12)S_.creak(0.07,null,0.35);},
    ratchet(pan=0){if(!ctx)return;const t=now();const s=noiseSrc();const f=ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=2200;f.Q.value=4;const g=ctx.createGain();env(g,t,0.001,0.14,0.03);s.connect(f);f.connect(g);out(g,pan,0.15);s.stop(t+0.06);},
    hit(where,big=1){if(!ctx)return;const sp=spat(where);const t=now();
      const s=noiseSrc();const f=ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=900;f.Q.value=0.8;const g=ctx.createGain();env(g,t,0.003,0.9*big,0.5);s.connect(f);f.connect(g);out(g,sp.pan,0.5,Math.max(0.3,sp.gain*2.5));s.stop(t+0.7);
      const o=ctx.createOscillator();o.frequency.setValueAtTime(120,t);o.frequency.exponentialRampToValueAtTime(40,t+0.3);const g2=ctx.createGain();env(g2,t,0.003,0.8*big,0.35);o.connect(g2);out(g2,sp.pan,0.3,Math.max(0.3,sp.gain*2.5));o.start(t);o.stop(t+0.5);
      for(let k=0;k<5;k++){const tt=t+0.03+Math.random()*0.25;const o2=ctx.createOscillator();o2.type='square';o2.frequency.value=rand(300,900);const gg=ctx.createGain();env(gg,tt,0.001,0.03*big,0.05);o2.connect(gg);out(gg,sp.pan,0.2,sp.gain*2);o2.start(tt);o2.stop(tt+0.08);}},
    whiz(pan=0){if(!ctx)return;const t=now();const s=noiseSrc();const f=ctx.createBiquadFilter();f.type='bandpass';f.Q.value=3;f.frequency.setValueAtTime(2400,t);f.frequency.exponentialRampToValueAtTime(700,t+0.5);const g=ctx.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(0.25,t+0.25);g.gain.linearRampToValueAtTime(0.0001,t+0.55);s.connect(f);f.connect(g);out(g,pan,0.3);s.stop(t+0.6);},
    sink(){if(!ctx)return;for(let k=0;k<7;k++)setTimeout(()=>S_.creak(rand(0.25,0.45),null,rand(0.8,1.8)),k*650);const t=now();const s=noiseSrc();const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=380;const g=ctx.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.6,t+1.5);g.gain.linearRampToValueAtTime(0,t+6);s.connect(f);f.connect(g);out(g,0,0.8);s.stop(t+6.2);},
    gun(where,kind){if(!ctx)return;const sp=spat(where);const t=now();const big=kind==='musket'?1.2:kind==='blunder'?1.4:0.9;
      const s=noiseSrc();const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(5000,t);f.frequency.exponentialRampToValueAtTime(300,t+0.4);const g=ctx.createGain();env(g,t,0.002,0.9*big,0.5);s.connect(f);f.connect(g);out(g,sp.pan,0.6,Math.max(0.25,sp.gain*2.5));s.stop(t+0.8);
      const o=ctx.createOscillator();o.frequency.setValueAtTime(140,t);o.frequency.exponentialRampToValueAtTime(45,t+0.18);const g2=ctx.createGain();env(g2,t,0.002,0.6*big,0.2);o.connect(g2);out(g2,sp.pan,0.3,Math.max(0.25,sp.gain*2.5));o.start(t);o.stop(t+0.3);},
    swing(){if(!ctx)return;const t=now();const s=noiseSrc();const f=ctx.createBiquadFilter();f.type='bandpass';f.Q.value=2;f.frequency.setValueAtTime(700,t);f.frequency.exponentialRampToValueAtTime(2200,t+0.18);const g=ctx.createGain();env(g,t,0.04,0.14,0.12);s.connect(f);f.connect(g);out(g,0,0.1);s.stop(t+0.3);},
    clash(where){if(!ctx)return;const sp=spat(where);const t=now();[1830,2770,4100,5600].forEach((fr,i)=>{const o=ctx.createOscillator();o.type='triangle';o.frequency.value=fr*rand(0.97,1.03);const g=ctx.createGain();env(g,t,0.001,0.12/(i+1),0.45);o.connect(g);out(g,sp.pan,0.4,Math.max(0.4,sp.gain*2));o.start(t);o.stop(t+0.5);});},
    thud(where,v=1){if(!ctx)return;const sp=spat(where);const t=now();const o=ctx.createOscillator();o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(60,t+0.12);const g=ctx.createGain();env(g,t,0.002,0.35*v,0.15);o.connect(g);out(g,sp.pan,0.2,Math.max(0.4,sp.gain*2));o.start(t);o.stop(t+0.2);const s=noiseSrc();const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=1500;const g2=ctx.createGain();env(g2,t,0.002,0.2*v,0.08);s.connect(f);f.connect(g2);out(g2,sp.pan,0.2);s.stop(t+0.12);},
    boom(where,big=1){if(!ctx)return;const sp=spat(where);const t=now();const s=noiseSrc();const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(2500,t);f.frequency.exponentialRampToValueAtTime(90,t+2.5);const g=ctx.createGain();env(g,t,0.004,1.4*big,3);s.connect(f);f.connect(g);out(g,sp.pan,1,Math.max(0.3,sp.gain*3));s.stop(t+3.2);const o=ctx.createOscillator();o.frequency.setValueAtTime(55,t);o.frequency.exponentialRampToValueAtTime(20,t+1.4);const g2=ctx.createGain();env(g2,t,0.004,1.8*big,1.6);o.connect(g2);out(g2,sp.pan,0.5,Math.max(0.3,sp.gain*3));o.start(t);o.stop(t+1.8);},
    thunder(delay=1){if(!ctx)return;const t=now()+delay;const s=noiseSrc();const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=260;const g=ctx.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.9,t+0.08);for(let k=1;k<6;k++)g.gain.linearRampToValueAtTime(rand(0.2,0.8),t+k*0.35);g.gain.linearRampToValueAtTime(0,t+3.6);s.connect(f);f.connect(g);out(g,rand(-0.5,0.5),1);s.stop(t+3.8);},
    dig(){if(!ctx)return;const t=now();const s=noiseSrc();const f=ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=600;f.Q.value=1;const g=ctx.createGain();env(g,t,0.02,0.25,0.25);s.connect(f);f.connect(g);out(g,0,0.1);s.stop(t+0.35);},
    coin(n=1){if(!ctx)return;for(let i=0;i<Math.min(n,6);i++){const t=now()+i*0.05;const o=ctx.createOscillator();o.frequency.value=rand(3200,5200);const g=ctx.createGain();env(g,t,0.001,0.05,0.15);o.connect(g);out(g,rand(-0.3,0.3),0.3);o.start(t);o.stop(t+0.2);}},
    stroke(){if(!ctx)return;const t=now();const s=noiseSrc();const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=900;const g=ctx.createGain();env(g,t,0.05,0.18,0.35);s.connect(f);f.connect(g);out(g,rand(-0.2,0.2),0.3);s.stop(t+0.5);},
    drink(){if(!ctx)return;for(let i=0;i<4;i++){const t=now()+i*0.18;const o=ctx.createOscillator();o.frequency.setValueAtTime(220,t);o.frequency.exponentialRampToValueAtTime(140,t+0.12);const g=ctx.createGain();env(g,t,0.01,0.12,0.1);o.connect(g);out(g,0,0.1);o.start(t);o.stop(t+0.16);}},
    hic(){if(!ctx)return;const t=now();const o=ctx.createOscillator();o.type='triangle';o.frequency.setValueAtTime(380,t);o.frequency.exponentialRampToValueAtTime(700,t+0.06);const g=ctx.createGain();env(g,t,0.005,0.15,0.08);o.connect(g);out(g,0,0.1);o.start(t);o.stop(t+0.12);},
    bite(where){if(!ctx)return;S_.thud(where,1.3);S_.slap(0.5,0);},
    music:null,
    note(f,vol=0.05,dur=0.6,pan=0){if(!ctx)return;const t=now();const o=ctx.createOscillator();o.type='triangle';o.frequency.value=f;const o2=ctx.createOscillator();o2.type='sine';o2.frequency.value=f*2.01;const g=ctx.createGain();env(g,t,0.01,vol,dur);const g2=ctx.createGain();g2.gain.value=0.3;o.connect(g);o2.connect(g2);g2.connect(g);out(g,pan,0.5);o.start(t);o2.start(t);o.stop(t+dur+0.1);o2.stop(t+dur+0.1);},
    rain:null,
    setRain(v){if(!ctx)return;if(!S_.rain){const s=ctx.createBufferSource();s.buffer=noise;s.loop=true;const f=ctx.createBiquadFilter();f.type='highpass';f.frequency.value=1200;const g=ctx.createGain();g.gain.value=0;s.connect(f);f.connect(g);g.connect(dry);s.start();S_.rain=g;}S_.rain.gain.setTargetAtTime(v*0.12,now(),0.8);},
    sails(){if(!ctx)return;const t=now();const s=noiseSrc();const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=900;const am=ctx.createGain();am.gain.value=0;const lfo=ctx.createOscillator();lfo.frequency.value=11;const lg=ctx.createGain();lg.gain.value=0.18;lfo.connect(lg);lg.connect(am.gain);
      const g=ctx.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.9,t+0.4);g.gain.linearRampToValueAtTime(0,t+2.8);s.connect(f);f.connect(am);am.connect(g);out(g,0,0.6);lfo.start(t);s.stop(t+3);lfo.stop(t+3);
      for(let k=0;k<3;k++)setTimeout(()=>S_.creak(0.18,null,0.8),k*700);},
    flap(){if(!ctx)return;const t=now();const s=noiseSrc();const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=700;const g=ctx.createGain();g.gain.setValueAtTime(0,t);for(let k=0;k<5;k++){g.gain.linearRampToValueAtTime(0.12*sailF,t+k*0.09+0.02);g.gain.linearRampToValueAtTime(0.01,t+k*0.09+0.08);}s.connect(f);f.connect(g);out(g,rand(-0.3,0.3),0.4);s.stop(t+0.6);},
    spy(){if(!ctx)return;const t=now();const s=noiseSrc();const f=ctx.createBiquadFilter();f.type='bandpass';f.Q.value=6;f.frequency.setValueAtTime(1800,t);f.frequency.linearRampToValueAtTime(3600,t+0.3);const g=ctx.createGain();env(g,t,0.05,0.07,0.3);s.connect(f);f.connect(g);out(g,0,0.1);s.stop(t+0.4);S_.clink(camera);},
  };
  return S_;
})();

