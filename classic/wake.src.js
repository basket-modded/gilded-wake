/* Ship wakes, the way water actually behaves.
   As a ship sails it leaves small patches of disturbed water behind it: from both sides of the bow and from the stern.
   Each patch stays where it was made. Bow patches drift outward at the Kelvin angle (sideways at ~0.35 x ship speed),
   which is what draws the two spreading arms of a wake; stern patches spread and fade into a churned lane.
   Nothing is ever recomputed relative to the ship, so turning curves the wake naturally and it can never swing or snap.
   Patches are splatted from above into a wake map locked to a world grid (R = froth, G = disturbed water, B = calm),
   and the sea shader reads that map, so the wake lives in the water surface and rides every wave. */
const WAKE=(()=>{
const LOWQ=u().water<150,RES=LOWQ?512:1024,EXT=420,TS=2*EXT/RES,CAP=LOWQ?1100:1700,T0=performance.now();
const RT=new THREE.WebGLRenderTarget(RES,RES,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,format:THREE.RGBAFormat,depthBuffer:false,stencilBuffer:false});
const WS=new THREE.Scene,OC=new THREE.OrthographicCamera(-1,1,1,-1,-1,1);
const UNI={uNow:{value:0},uC:{value:new THREE.Vector2},uE:{value:EXT},uTS:{value:TS}};
const mat=new THREE.ShaderMaterial({uniforms:UNI,depthTest:false,depthWrite:false,transparent:true,
  blending:THREE.CustomBlending,blendEquation:THREE.MaxEquation,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor,
  vertexShader:`uniform float uNow,uE,uTS;uniform vec2 uC;attribute vec4 aP;attribute vec4 aB;varying vec4 vC;
  void main(){float age=uNow-aB.x,kind=aB.y,I=aB.z;
    float life=kind<0.5?34.0:(kind<1.5?30.0:26.0);
    if(age<0.0||age>life||I<=0.0){gl_Position=vec4(2.0,2.0,2.0,1.0);gl_PointSize=0.0;vC=vec4(0.0);return;}
    vec2 w=aP.xy+aP.zw*(kind<0.5?age:9.0*(1.0-exp(-age/9.0)));
    gl_Position=vec4((w.x-uC.x)/uE,-(w.y-uC.y)/uE,0.0,1.0);
    float fade=exp(-age/(kind<0.5?16.0:(kind<1.5?10.0:10.0)))*smoothstep(life,life*0.6,age)*I;
    float size;
    if(kind<0.5){size=2.6+age*0.4;vC=vec4(fade,0.9*fade,0.0,fade);}
    else if(kind<1.5){size=3.2+age*0.7;vC=vec4(0.8*fade*exp(-age/5.0),0.8*fade,0.0,fade);}
    else{size=aB.w+age*0.5;vC=vec4(0.0,0.0,0.7*fade,fade);}
    gl_PointSize=clamp(size/uTS,1.0,96.0);}`,
  fragmentShader:`varying vec4 vC;void main(){vec2 p=gl_PointCoord-0.5;float d=dot(p,p)*4.0;if(d>1.0)discard;float k=(1.0-d)*(1.0-d);gl_FragColor=vec4(vC.rgb*k,1.0);}`});
const ALL=[];
function emitter(){const g=new THREE.BufferGeometry,P=new Float32Array(CAP*4),Bv=new Float32Array(CAP*4);
  g.setAttribute("position",new THREE.BufferAttribute(new Float32Array(CAP*3),3));
  g.setAttribute("aP",new THREE.BufferAttribute(P,4).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute("aB",new THREE.BufferAttribute(Bv,4).setUsage(THREE.DynamicDrawUsage));
  const pts=new THREE.Points(g,mat);pts.frustumCulled=false;WS.add(pts);
  const E={g,P,Bv,head:0,dirty:false,last:null,accA:0,accW:0,accC:0,owner:null};ALL.push(E);return E}
function push(E,x,z,vx,vz,kind,I,extra){const i=E.head;E.head=(i+1)%CAP;const o=i*4;
  E.P[o]=x;E.P[o+1]=z;E.P[o+2]=vx;E.P[o+3]=vz;E.Bv[o]=UNI.uNow.value;E.Bv[o+1]=kind;E.Bv[o+2]=I;E.Bv[o+3]=extra||0;E.dirty=true}
const rnd=(a,b)=>a+Math.random()*(b-a);
/* sail from the last pose to this one, laying patches evenly along the way so speed or frame rate never leave gaps */
function sail(E,x,z,h,U,spdK){
  if(E.last&&Math.hypot(x-E.last.x,z-E.last.z)>80)E.last=null;
  if(!E.last){E.last={x,z,h};return}
  const L=E.last,dx=x-L.x,dz=z-L.z,dist=Math.hypot(dx,dz);E.last={x,z,h};
  if(spdK<.04||dist<1e-4)return;
  let dh=h-L.h;dh=((dh+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;
  const at=t=>{const hh=L.h+dh*t,fx=-Math.sin(hh),fz=-Math.cos(hh);return{x:L.x+dx*t,z:L.z+dz*t,fx,fz,rx:-fz,rz:fx}};
  const cl=t=>Math.min(1,Math.max(0,t));
  /* bow-wave crests, both sides */
  E.accA+=dist;
  while(E.accA>=.75){E.accA-=.75;const p=at(cl(1-E.accA/dist));
    for(const sg of[1,-1]){const bx=p.x+p.fx*12.5+p.rx*sg*1.6,bz=p.z+p.fz*12.5+p.rz*sg*1.6,lat=.36*U*rnd(.92,1.08);
      push(E,bx+rnd(-.25,.25),bz+rnd(-.25,.25),p.rx*sg*lat-p.fx*U*.02,p.rz*sg*lat-p.fz*U*.02,0,spdK*rnd(.85,1))}}
  /* stern wash */
  E.accW+=dist;
  while(E.accW>=1.1){E.accW-=1.1;const p=at(cl(1-E.accW/dist)),o=rnd(-1.4,1.4),sp=rnd(-.12,.12)*U;
    push(E,p.x-p.fx*12+p.rx*o,p.z-p.fz*12+p.rz*o,p.rx*sp,p.rz*sp,1,spdK*rnd(.75,1))}
  /* calm water between the arms */
  E.accC+=dist;
  while(E.accC>=3.2){E.accC-=3.2;const p=at(cl(1-E.accC/dist));push(E,p.x,p.z,0,0,2,spdK,8)}
}
function upload(E){if(!E.dirty)return;E.g.attributes.aP.needsUpdate=true;E.g.attributes.aB.needsUpdate=true;E.dirty=false}
const me=emitter(),CC=new THREE.Color;
function update(){UNI.uNow.value=(performance.now()-T0)/1e3;
  sail(me,wt.x,wt.y,Mn,Math.max(0,Rn),vn?0:Math.min(1,Math.max(0,Rn/6)));upload(me);
  const live=new Set(Kn.values());
  for(const E of ALL)if(E.owner&&!live.has(E.owner))E.owner=null;
  for(const c of live){if(!c.root.visible||c.dist>EXT+300)continue;
    if(!c.wake||c.wake.owner!==c){c.wake=ALL.find(E=>E!==me&&!E.owner)||emitter();c.wake.owner=c;c.wake.last=null}
    const U=Math.max(0,c.sp||0);sail(c.wake,c.root.position.x+wt.x,c.root.position.z+wt.y,c.h,U,c.sk?0:Math.min(1,U/6));upload(c.wake)}
  /* paint the map, locked to a fixed world grid so texels never slide across the sea */
  const cxw=Math.round(wt.x/TS)*TS,czw=Math.round(wt.y/TS)*TS;UNI.uC.value.set(cxw,czw);ft.uWakeC.value.set(cxw-wt.x,czw-wt.y);
  f.getClearColor(CC);const ca=f.getClearAlpha(),prev=f.getRenderTarget();
  f.setRenderTarget(RT);f.setClearColor(0,0);f.clear(true,false,false);f.render(WS,OC);f.setRenderTarget(prev);f.setClearColor(CC,ca);
}
return{update,me,tex:RT.texture,rt:RT,EXT,RES};
})();
ft.uWake.value=WAKE.tex;
