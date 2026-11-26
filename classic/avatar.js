/* Player character: the front and back pixel sprites, one pixel apart, with the gap closed by pixel-sized sides,
   built as a small solid "paper doll" of coloured pixel faces. Walking is a plain Crossy-Road hop, nothing else.
   Stands at the helm while steering; follows the walk position on deck; V toggles third person while walking.
   Other ships see each captain at their helm or wherever they are walking on their own deck. */
const AV=(()=>{
const W=AVSPR.w,H=AVSPR.h,dec=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0)),FP=dec(AVSPR.f),BP=dec(AVSPR.b);
const PX=1.78/H,ZF=PX/2,ZB=-PX/2;
const at=(A,x,y)=>{if(x<0||y<0||x>=W||y>=H)return null;const o=(y*W+x)*4;return A[o+3]>127?[A[o],A[o+1],A[o+2]]:null};
const Fr=(x,y)=>at(FP,x,y),Bk=(x,y)=>at(BP,W-1-x,y),Un=(x,y)=>!!(Fr(x,y)||Bk(x,y));
const geo=(()=>{const pos=[],nor=[],col=[],c3=new THREE.Color;
  const lin=(rgb,k)=>{c3.setRGB(rgb[0]/255,rgb[1]/255,rgb[2]/255).convertSRGBToLinear();return[c3.r*k,c3.g*k,c3.b*k]};
  const quad=(a,b,c,d,n,cl)=>{for(const p of[a,b,c,a,c,d]){pos.push(p[0],p[1],p[2]);nor.push(n[0],n[1],n[2]);col.push(cl[0],cl[1],cl[2])}};
  const X=i=>(i-W/2)*PX,Y=j=>(H-j)*PX;
  for(let j=0;j<H;j++)for(let i=0;i<W;i++){if(!Un(i,j))continue;
    const fc=Fr(i,j)||Bk(i,j),bc=Bk(i,j)||Fr(i,j),x0=X(i),x1=X(i+1),y0=Y(j+1),y1=Y(j);
    quad([x0,y0,ZF],[x1,y0,ZF],[x1,y1,ZF],[x0,y1,ZF],[0,0,1],lin(fc,Fr(i,j)?1:.82));
    quad([x1,y0,ZB],[x0,y0,ZB],[x0,y1,ZB],[x1,y1,ZB],[0,0,-1],lin(bc,Bk(i,j)?1:.82));
    /* sides: front half takes the front pixel's colour, back half the back pixel's */
    const side=(p0,p1,n)=>{quad([p0[0],p0[1],0],[p1[0],p1[1],0],[p1[0],p1[1],ZF],[p0[0],p0[1],ZF],n,lin(fc,.7));quad([p0[0],p0[1],ZB],[p1[0],p1[1],ZB],[p1[0],p1[1],0],[p0[0],p0[1],0],n,lin(bc,.7))};
    if(!Un(i-1,j))side([x0,y1],[x0,y0],[-1,0,0]);
    if(!Un(i+1,j))side([x1,y0],[x1,y1],[1,0,0]);
    if(!Un(i,j-1))side([x1,y1],[x0,y1],[0,1,0]);
    if(!Un(i,j+1))side([x0,y0],[x1,y0],[0,-1,0])}
  const g=new THREE.BufferGeometry;g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));g.setAttribute("normal",new THREE.Float32BufferAttribute(nor,3));g.setAttribute("color",new THREE.Float32BufferAttribute(col,3));
  g.computeBoundingSphere();return g})();
const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92,metalness:0,side:THREE.DoubleSide});
function make(){const g=new THREE.Group,m=new THREE.Mesh(geo,mat);m.castShadow=!0,m.userData.noKit=1;g.add(m);g.userData.m=m;return g}
const HELM=new THREE.Vector3(0,re,12.05);
const me=make();me.position.copy(HELM);me.rotation.y=Math.PI;pe.add(me);
let TP=!1,hopK=0;
const hop=(ph,k)=>Math.abs(Math.sin(ph))*.13*k;
const lerpA=(a,b,k)=>a+(((b-a+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI)*k;
function update(dt){
  if(pn==="walk"){hopK=hn.bobAmt;me.position.set(hn.x,hn.y+hop(hn.bob,hopK),hn.z);me.rotation.y=hn.yaw+Math.PI;me.visible=TP&&camD>.9}
  else{me.position.copy(HELM);me.rotation.y=Math.PI;me.visible=pn!=="spy"}
  /* other captains */
  for(const c of Kn.values()){const L=c.snaps;if(!L.length||!c.root.visible||c.dist>700){if(c.av)c.av.visible=!1;continue}
    if(!c.av){c.av=make();c.av.position.copy(HELM);c.av.rotation.y=Math.PI;c.body.add(c.av);c.avPh=0}
    const s=L[L.length-1],walk=s.pm===1;
    const tx=walk?Math.max(-4.5,Math.min(4.5,s.ax||0)):HELM.x,ty=walk?Math.max(0,Math.min(9,s.ay||0)):HELM.y,tz=walk?Math.max(-16,Math.min(15,s.az||0)):HELM.z,ta=walk?(s.ya||0)+Math.PI:Math.PI;
    const k=Math.min(1,dt*10),px=c.av.position.x,pz=c.av.position.z,base=c.av.userData.by==null?ty:c.av.userData.by;
    const nx=px+(tx-px)*k,nz=pz+(tz-pz)*k,mv=Math.hypot(nx-px,nz-pz)/Math.max(dt,1e-3);
    c.avPh+=mv*dt*2.4;c.avK=(c.avK||0)+((mv>.3?1:0)-(c.avK||0))*Math.min(1,dt*6);
    c.av.userData.by=base+(ty-base)*k;c.av.position.set(nx,c.av.userData.by+hop(c.avPh,c.avK),nz);
    c.av.rotation.y=lerpA(c.av.rotation.y,ta,k);c.av.visible=!c.sk||c.sinkT<6}
}
/* third person while walking, Roblox-style: the camera orbits the character's head along the look direction.
   Zoom eases toward the wheel distance; obstacles pull the camera in at once, and it eases back out when clear.
   All easing is frame-rate independent. */
const RC=new THREE.Raycaster,COL=[],DIR=new THREE.Vector3,PIV=new THREE.Vector3,SIDE=new THREE.Vector3;
let zoomT=4.2,zoomC=0,camD=0,lastT=performance.now();
function cols(){if(!COL.length)pe.traverse(o=>{if(o.isMesh&&!o.userData.noKit&&o.material&&o.material.visible!==!1&&!o.material.transparent)COL.push(o)});return COL}
function clearDist(p,d,max){RC.set(p,d);RC.near=0;RC.far=max+.4;let best=max;
  const h=RC.intersectObjects(cols(),!1);if(h.length)best=Math.min(best,h[0].distance-.32);return Math.max(.25,best)}
function tp(e,t){const now=performance.now(),dt=Math.min(.1,(now-lastT)/1e3);lastT=now;
  const on=pn==="walk"&&TP,want=on?zoomT:0;
  zoomC+=(want-zoomC)*(1-Math.exp(-dt*(on?7:12)));
  if(zoomC<.03){zoomC=0;camD=0;return}
  /* pivot at the head, slightly above eye height so the character sits low in frame */
  PIV.copy(e);PIV.y+=.18;
  DIR.set(0,0,1).applyQuaternion(t);
  const free=clearDist(PIV,DIR,zoomC),target=Math.min(zoomC,free);
  camD=target<camD?target:camD+(target-camD)*(1-Math.exp(-dt*5));
  e.copy(PIV).addScaledVector(DIR,camD)}
addEventListener("wheel",ev=>{if(pn!=="walk"||!TP||dn!=="play")return;zoomT=Math.max(1.4,Math.min(9,zoomT*(ev.deltaY>0?1.12:1/1.12)))},{passive:!0});
addEventListener("keydown",ev=>{if(ev.code!=="KeyV"||ev.repeat||(ev.target&&/INPUT|TEXTAREA/.test(ev.target.tagName)))return;
  if(pn==="walk"&&dn==="play"){TP=!TP;say(TP?"Third person. Press V to look through your own eyes again.":"First person.",1.8)}});
return{update,tp,me,get tp3(){return TP},set tp3(v){TP=v}};
})();
