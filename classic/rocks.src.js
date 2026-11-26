const RKS=(()=>{
"use strict";
/* Procedural sea-rock formations: spires, twin peaks, haystacks, arches, craggy massifs, stack clusters.
   Shapes are signed-distance fields built in a background worker and meshed with surface nets,
   so they can overhang and have arches. Collision, cannon hits and spawns use the same fields. */
const TAU=Math.PI*2,CELL=3400,JIT=520,VIEW=5300,SURF_D=1900,SAFE0=1500;
const LOW=u().water<150,RES=LOW?40:56,NV=LOW?6:10;
const clamp=(x,a,b)=>x<a?a:x>b?b:x;
function h32(a,b,c){let h=Math.imul(a|0,0x27d4eb2d)^Math.imul(b|0,0x165667b1)^Math.imul(c|0,0x9e3779b1);h=Math.imul(h^(h>>>15),0x85ebca6b);h=Math.imul(h^(h>>>13),0xc2b2ae35);return(h^(h>>>16))>>>0}
function rng(seed){let q=seed>>>0;return()=>{q=q+0x6D2B79F5|0;let t=Math.imul(q^q>>>15,1|q);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

/* ================= worker: build one formation ================= */
function WGEN(){
const clamp=(x,a,b)=>x<a?a:x>b?b:x;
function rng(seed){let q=seed>>>0;return()=>{q=q+0x6D2B79F5|0;let t=Math.imul(q^q>>>15,1|q);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function N3(seed){const P=new Float32Array(4096),r=rng(seed);for(let i=0;i<4096;i++)P[i]=r();
  const hv=(x,y,z)=>P[((Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(z,1274126177))^seed)>>>0&4095];
  const n=(x,y,z)=>{const xi=Math.floor(x),yi=Math.floor(y),zi=Math.floor(z),fx=x-xi,fy=y-yi,fz=z-zi,
    ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy),uz=fz*fz*(3-2*fz),
    a=hv(xi,yi,zi),b=hv(xi+1,yi,zi),c=hv(xi,yi+1,zi),d=hv(xi+1,yi+1,zi),e=hv(xi,yi,zi+1),f=hv(xi+1,yi,zi+1),g=hv(xi,yi+1,zi+1),h=hv(xi+1,yi+1,zi+1),
    x1=a+(b-a)*ux,x2=c+(d-c)*ux,x3=e+(f-e)*ux,x4=g+(h-g)*ux,y1=x1+(x2-x1)*uy,y2=x3+(x4-x3)*uy;return y1+(y2-y1)*uz};
  const fbm=(x,y,z,o)=>{let s=0,a=.5,t=0;for(let i=0;i<o;i++){s+=a*n(x,y,z);t+=a;x=x*2.03+17.1;y=y*2.03+3.7;z=z*2.03+9.2;a*=.5}return s/t};
  const rid=(x,y,z,o)=>{let s=0,a=.5,t=0;for(let i=0;i<o;i++){const v=1-Math.abs(n(x,y,z)*2-1);s+=a*v*v;t+=a;x=x*2.1+5.3;y=y*2.1+1.1;z=z*2.1+7.7;a*=.5}return s/t};
  return{n,fbm,rid}}
const smin=(a,b,k)=>{const h=clamp(.5+.5*(b-a)/k,0,1);return b+(a-b)*h-k*h*(1-h)};
const TYPES=["spire","massif","arch","twin","haystack","cluster","slab","spire","arch","massif"];
function shape(id,seed){
  const R=rng(seed),N=N3(seed*31+5),type=TYPES[id%TYPES.length],parts=[];
  const rr=(a,b)=>a+R()*(b-a);
  let veg=0;
  const cone=(x,z,r,h,lean)=>parts.push({x,z,r,h,lx:Math.cos(lean[0])*lean[1],lz:Math.sin(lean[0])*lean[1],p:rr(.55,1.1)});
  let arch=null,slab=null,hay=null;
  if(type==="spire")cone(0,0,rr(.55,.8),rr(1.25,1.75),[rr(0,6.3),rr(0,.18)]);
  else if(type==="twin"){const a=rr(0,6.3);cone(Math.cos(a)*.38,Math.sin(a)*.38,rr(.45,.6),rr(1.2,1.65),[a,rr(0,.12)]);cone(-Math.cos(a)*.42,-Math.sin(a)*.42,rr(.38,.55),rr(.75,1.1),[a+3,rr(0,.15)]);veg=1}
  else if(type==="massif"){const n=4+Math.floor(R()*4);for(let i=0;i<n;i++){const a=R()*6.3,d=i?rr(.2,.62):0;cone(Math.cos(a)*d,Math.sin(a)*d,rr(.28,.55),i?rr(.35,1.05):rr(.95,1.45),[R()*6.3,rr(0,.12)])}veg=1}
  else if(type==="cluster"){const n=3+Math.floor(R()*3);for(let i=0;i<n;i++){const a=i*6.283/n+rr(-.4,.4),d=i?rr(.45,.78):rr(0,.2);cone(Math.cos(a)*d,Math.sin(a)*d,rr(.16,.3),rr(.45,1.35),[R()*6.3,rr(0,.15)])}}
  else if(type==="haystack")hay={a:rr(.6,.85),b:rr(.45,.7),h:rr(.85,1.25),ro:rr(0,6.3)};
  else if(type==="arch"){arch={L:rr(.85,1.05),T:rr(.2,.32),H:rr(.62,.95),hx:rr(-.15,.15),hr:rr(.26,.38),hh:rr(.38,.58),ro:rr(0,6.3)};
    const ca=Math.cos(arch.ro),sa=Math.sin(arch.ro);cone(ca*arch.L*.85,sa*arch.L*.85,rr(.3,.45),arch.H*rr(1.1,1.5),[0,.05])}
  else if(type==="slab"){slab={a:rr(.65,.95),b:rr(.45,.7),h:rr(.55,.9),tx:rr(-.35,.35),tz:rr(-.25,.25),ro:rr(0,6.3)};veg=1}
  const fl=rr(5,8),cr=rr(.045,.075),bed=rr(4,9),bedT=rr(-.35,.35);
  function base(x,y,z){let d=1e9;
    for(const c of parts){const t=clamp(y/c.h,0,1),r=c.r*Math.pow(1-t,c.p)+.03*(1-t);
      const dx=x-c.x-c.lx*y,dz=z-c.z-c.lz*y;d=smin(d,Math.max((Math.hypot(dx,dz)-r)*.75,y-c.h),.14)}
    if(hay){const cs=Math.cos(hay.ro),sn=Math.sin(hay.ro),u=x*cs+z*sn,v=-x*sn+z*cs,yy=y+.15;
      d=Math.min(d,(Math.hypot(u/hay.a,yy/hay.h,v/hay.b)-1)*Math.min(hay.a,hay.b)*.9)}
    if(slab){const cs=Math.cos(slab.ro),sn=Math.sin(slab.ro),u=x*cs+z*sn,v=-x*sn+z*cs,top=slab.h*(1+slab.tx*u+slab.tz*v);
      const e=Math.hypot(Math.max(Math.abs(u)-slab.a,0),Math.max(Math.abs(v)-slab.b,0))+Math.min(Math.max(Math.abs(u)-slab.a,Math.abs(v)-slab.b),0);
      d=Math.min(d,Math.max(e-.08,y-top))}
    if(arch){const cs=Math.cos(arch.ro),sn=Math.sin(arch.ro),u=x*cs+z*sn,v=-x*sn+z*cs;
      const top=arch.H*(1-.25*(u/arch.L)**2),qx=Math.abs(u)-arch.L,qz=Math.abs(v)-arch.T;
      let e=Math.hypot(Math.max(qx,0),Math.max(qz,0))+Math.min(Math.max(qx,qz),0);e=Math.max(e-.05,y-top);
      const tun=(Math.hypot((u-arch.hx)/arch.hr,(y+.05)/arch.hh)-1)*Math.min(arch.hr,arch.hh);
      d=Math.min(d,Math.max(e,-tun))}
    return Math.max(d,Math.hypot(x,z)-1.18,y-1.85)}
  function sdf(x,y,z){const b0=base(x,y,z);if(b0>.3)return b0;
    const wx=x+.09*(N.fbm(x*1.7,y*1.7,z*1.7,2)-.5),wz=z+.09*(N.fbm(x*1.7+31,y*1.7,z*1.7+11,2)-.5);
    let d=base(wx,y,wz);
    const flute=N.n(wx*fl,y*.9,wz*fl)-.5;
    const strata=N.n(wx*1.5,(y+bedT*wx)*bed,wz*1.5)-.5;
    const crag=N.fbm(wx*4.5,y*4.5,wz*4.5,4)-.5,rid=N.rid(wx*3,y*2.2,wz*3,3);
    const hi=clamp(y/1.2,0,1);
    d+=flute*.11+strata*.045+crag*cr*2+(.5-rid)*.05*(.4+hi);
    return Math.max(d,Math.hypot(x,z)-1.2)}
  return{type,sdf,veg,N}}
function build(id,seed,res){
  const S=shape(id,seed),B=1.3,Y0=-.18,Y1=1.92,h=2*B/(res-1),nx=res,nz=res,ny=Math.ceil((Y1-Y0)/h)+1;
  const V=new Float32Array(nx*ny*nz),I=(i,j,k)=>(k*ny+j)*nx+i;
  for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){let v=S.sdf(-B+i*h,Y0+j*h,-B+k*h);
    if(i===0||k===0||i===nx-1||k===nz-1||j===ny-1)v=Math.max(v,.02);V[I(i,j,k)]=v}
  const samp=(x,y,z)=>{let fx=(x+B)/h,fy=(y-Y0)/h,fz=(z+B)/h;fx=clamp(fx,0,nx-1.001);fy=clamp(fy,0,ny-1.001);fz=clamp(fz,0,nz-1.001);
    const i=fx|0,j=fy|0,k=fz|0,u=fx-i,v=fy-j,w=fz-k,a=I(i,j,k),dx=1,dy=nx,dz=nx*ny;
    const c00=V[a]+(V[a+dx]-V[a])*u,c10=V[a+dy]+(V[a+dy+dx]-V[a+dy])*u,c01=V[a+dz]+(V[a+dz+dx]-V[a+dz])*u,c11=V[a+dz+dy]+(V[a+dz+dy+dx]-V[a+dz+dy])*u;
    const c0=c00+(c10-c00)*v,c1=c01+(c11-c01)*v;return c0+(c1-c0)*w};
  function nets(st){const ax=Math.floor((nx-1)/st)+1,ay=Math.floor((ny-1)/st)+1,az=Math.floor((nz-1)/st)+1,G=(i,j,k)=>V[I(i*st,j*st,k*st)];
    const cid=new Int32Array(ax*ay*az).fill(-1),C=(i,j,k)=>(k*ay+j)*ax+i,P=[];
    const E=[[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]],O=[[0,0,0],[1,0,0],[0,1,0],[1,1,0],[0,0,1],[1,0,1],[0,1,1],[1,1,1]],cv=new Float32Array(8);
    for(let k=0;k<az-1;k++)for(let j=0;j<ay-1;j++)for(let i=0;i<ax-1;i++){let m=0;
      for(let c=0;c<8;c++){cv[c]=G(i+O[c][0],j+O[c][1],k+O[c][2]);if(cv[c]<0)m|=1<<c}
      if(m===0||m===255)continue;let sx=0,sy=0,sz=0,n=0;
      for(const[a,b]of E){if((cv[a]<0)===(cv[b]<0))continue;const t=cv[a]/(cv[a]-cv[b]);
        sx+=O[a][0]+(O[b][0]-O[a][0])*t;sy+=O[a][1]+(O[b][1]-O[a][1])*t;sz+=O[a][2]+(O[b][2]-O[a][2])*t;n++}
      cid[C(i,j,k)]=P.length/3;P.push(-B+(i+sx/n)*st*h,Y0+(j+sy/n)*st*h,-B+(k+sz/n)*st*h)}
    const idx=[];
    const quad=(a,b,c,d,dirx,diry,dirz)=>{if(a<0||b<0||c<0||d<0)return;
      const ux=P[c*3]-P[a*3],uy=P[c*3+1]-P[a*3+1],uz=P[c*3+2]-P[a*3+2],vx=P[d*3]-P[b*3],vy=P[d*3+1]-P[b*3+1],vz=P[d*3+2]-P[b*3+2];
      const qx=uy*vz-uz*vy,qy=uz*vx-ux*vz,qz=ux*vy-uy*vx;
      if(qx*dirx+qy*diry+qz*dirz>=0)idx.push(a,b,c,a,c,d);else idx.push(a,c,b,a,d,c)};
    for(let k=0;k<az;k++)for(let j=0;j<ay;j++)for(let i=0;i<ax;i++){const g=G(i,j,k),s0=g<0?1:-1;
      if(i<ax-1&&j>0&&k>0&&j<ay-1&&k<az-1&&(G(i+1,j,k)<0)!==(g<0))quad(cid[C(i,j-1,k-1)],cid[C(i,j,k-1)],cid[C(i,j,k)],cid[C(i,j-1,k)],s0,0,0);
      if(j<ay-1&&i>0&&k>0&&i<ax-1&&k<az-1&&(G(i,j+1,k)<0)!==(g<0))quad(cid[C(i-1,j,k-1)],cid[C(i,j,k-1)],cid[C(i,j,k)],cid[C(i-1,j,k)],0,s0,0);
      if(k<az-1&&i>0&&j>0&&i<ax-1&&j<ay-1&&(G(i,j,k+1)<0)!==(g<0))quad(cid[C(i-1,j-1,k)],cid[C(i,j-1,k)],cid[C(i,j,k)],cid[C(i-1,j,k)],0,0,s0)}
    const nv=P.length/3,pos=new Float32Array(P),nrm=new Float32Array(nv*3),at=new Float32Array(nv*2),e=h*.6;
    for(let v=0;v<nv;v++){const x=pos[v*3],y=pos[v*3+1],z=pos[v*3+2];
      let gx=samp(x+e,y,z)-samp(x-e,y,z),gy=samp(x,y+e,z)-samp(x,y-e,z),gz=samp(x,y,z+e)-samp(x,y,z-e);const l=Math.hypot(gx,gy,gz)||1;gx/=l;gy/=l;gz/=l;
      nrm[v*3]=gx;nrm[v*3+1]=gy;nrm[v*3+2]=gz;
      let occ=0;for(let s=1;s<=5;s++){const dd=s*.045;occ+=Math.max(0,dd-samp(x+gx*dd,y+gy*dd,z+gz*dd))/Math.pow(2,s)}
      let sky=0;for(let s=1;s<=3;s++){const dd=s*.16;sky+=Math.max(0,dd-samp(x+gx*dd*.5,y+dd,z+gz*dd*.5))/s}
      at[v*2]=clamp(1-occ*7-sky*.9,0,1);at[v*2+1]=S.N.fbm(x*9+5,y*9,z*9+5,2)}
    const ix=nv>65000?new Uint32Array(idx):new Uint16Array(idx);
    return{pos,nrm,at,idx:ix}}
  const hi=nets(1),lo=nets(2),xlo=nets(4);
  /* water-level footprints: signed 2D distance for several clearance heights (tall arches can be sailed through) */
  const FN=64,LV=[.04,.09,.16,.28,9],lev=[],fs=2*B/(FN-1);let foot=0;
  for(const yl of LV){const M=new Uint8Array(FN*FN);
    for(let k=0;k<FN;k++)for(let i=0;i<FN;i++){const x=-B+i*fs,z=-B+k*fs;let mn=1e9;for(let y=-.02;y<=Math.min(yl,1.9);y+=h*.5)mn=Math.min(mn,samp(x,y,z));if(mn<0){M[k*FN+i]=1;if(yl>5)foot=Math.max(foot,Math.hypot(x,z))}}
    const bd=[];for(let k=0;k<FN;k++)for(let i=0;i<FN;i++){const m=M[k*FN+i];if((i>0&&M[k*FN+i-1]!==m)||(i<FN-1&&M[k*FN+i+1]!==m)||(k>0&&M[(k-1)*FN+i]!==m)||(k<FN-1&&M[(k+1)*FN+i]!==m))bd.push(i,k)}
    const F=new Float32Array(FN*FN);
    for(let k=0;k<FN;k++)for(let i=0;i<FN;i++){let mn=1e9;for(let b=0;b<bd.length;b+=2){const dx=bd[b]-i,dz=bd[b+1]-k,q=dx*dx+dz*dz;if(q<mn)mn=q}
      const d=(bd.length?Math.sqrt(mn):FN)*fs;F[k*FN+i]=M[k*FN+i]?-d:d}
    lev.push(F)}
  const foam=new Uint8Array(FN*FN*4),F0=lev[0];for(let q=0;q<FN*FN;q++){foam[q*4]=clamp((F0[q]+.05)/.45,0,1)*255;foam[q*4+3]=255}
  /* waterline spots for breaking-wave spray */
  const wl=[];const P=hi.pos,Nn=hi.nrm;for(let v=0;v<P.length/3;v++)if(Math.abs(P[v*3+1])<h*.7&&Math.abs(Nn[v*3+1])<.6)wl.push(v);
  const WL=new Float32Array(Math.min(120,wl.length)*4);for(let q=0;q<WL.length/4;q++){const v=wl[Math.floor(q*wl.length/(WL.length/4))],l=Math.hypot(Nn[v*3],Nn[v*3+2])||1;
    WL[q*4]=P[v*3];WL[q*4+1]=P[v*3+2];WL[q*4+2]=Nn[v*3]/l;WL[q*4+3]=Nn[v*3+2]/l}
  return{id,type:S.type,veg:S.veg,B,Y0,h,nx,ny,nz,V,hi,lo,xlo,FN,LV,lev,foam,foot,WL}}
self.onmessage=e=>{const{list,res}=e.data;for(const[id,seed]of list){const r=build(id,seed,res);
  const tr=[r.V.buffer,r.foam.buffer,r.WL.buffer,...r.lev.map(a=>a.buffer)];for(const m of[r.hi,r.lo,r.xlo])tr.push(m.pos.buffer,m.nrm.buffer,m.at.buffer,m.idx.buffer);
  self.postMessage(r,tr)}};
}

/* ================= main thread ================= */
const VAR=new Array(NV).fill(null);let ready=0;
const UNI={uSunDir:gt.uniforms.uSunDir,uSunI:gt.uniforms.uSunI,uSunCol:{value:T},uSunK:{value:2},uTime:ft.uTime,uDet:{value:null},uView:{value:VIEW},uOffset:ft.uOffset,uW:ft.uW,uAmp:ft.uAmp};
function detTex(){const Sz=128,d=new Uint8Array(Sz*Sz*4),r=rng(77),L=[];
  for(let c=0;c<3;c++){const P=new Float32Array(1024);for(let i=0;i<1024;i++)P[i]=r();L.push(P)}
  const tn=(P,x,y,p)=>{const xi=Math.floor(x),yi=Math.floor(y),fx=x-xi,fy=y-yi,ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy),
    mm=(a,b)=>P[(((a%p)+p)%p*31+((b%p)+p)%p*17)&1023],a=mm(xi,yi),b=mm(xi+1,yi),c=mm(xi,yi+1),e=mm(xi+1,yi+1);return a+(b-a)*ux+(c-a)*uy+(a-b-c+e)*ux*uy};
  for(let yy=0;yy<Sz;yy++)for(let x=0;x<Sz;x++){const k=(yy*Sz+x)*4;
    for(let c=0;c<3;c++){let s=0,a=.5,t=0;for(let o=0,p=4;o<5;o++,p*=2){let q=tn(L[c],x/Sz*p,yy/Sz*p,p);if(c===2)q=1-Math.abs(q*2-1);s+=a*q;t+=a;a*=.5}
      d[k+c]=clamp((s/t-.5)*2.6+.5,0,1)*255}d[k+3]=255}
  const t=new THREE.DataTexture(d,Sz,Sz,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=Math.min(4,m);t.needsUpdate=true;return t}
UNI.uDet.value=detTex();
const VFOG=`
  vec3 Vv=cameraPosition-w.xyz;float dv=length(Vv);Vv/=dv;
  vHz=skyBase(normalize(vec3(-Vv.x,0.0,-Vv.z)));
  float wf=1.0-exp(-dv*0.00045);wf=clamp(wf*wf*1.25,0.0,1.0);
  vFog=pow(wf,1.0+max(w.y,0.0)/700.0);
  vFog=max(vFog,smoothstep(uView*0.8,uView,dv));`;
const rockMat=new THREE.ShaderMaterial({uniforms:UNI,defines:LOW?{}:{BUMP:1},
  vertexShader:b+`uniform float uView;attribute vec2 aT;varying vec3 vW,vN,vL,vHz,vAmb,vIC;varying vec2 vT;varying float vFog;
  void main(){vec4 w=modelMatrix*instanceMatrix*vec4(position,1.0);mat3 im=mat3(instanceMatrix);
    vN=normalize(mat3(modelMatrix)*(im*normal));vL=im*position;vW=w.xyz;vT=aT;
    #ifdef USE_INSTANCING_COLOR
    vIC=instanceColor;
    #else
    vIC=vec3(0.0);
    #endif
    vAmb=skyBase(normalize(vec3(vN.x*0.6,max(vN.y,0.0)+0.35,vN.z*0.6)));
    ${VFOG}
    gl_Position=projectionMatrix*viewMatrix*w;}`,
  fragmentShader:`uniform vec3 uSunDir;uniform float uSunI;
  uniform vec3 uSunCol;uniform float uSunK,uTime;uniform sampler2D uDet;varying vec3 vW,vN,vL,vHz,vAmb,vIC;varying vec2 vT;varying float vFog;
  void main(){
    vec3 V=cameraPosition-vW;float d=length(V);V/=d;
    vec3 N=normalize(vN);vec3 an=abs(N);float side=1.0-an.y;
    float fd=1.0-smoothstep(300.0,2200.0,d);
    float wx=an.x*an.x/(an.x*an.x+an.z*an.z+1e-4);
    vec2 sd=vec2(vIC.z*7.0,vIC.z*3.0);
    /* side projections blended by normal; noise stretched up the face gives columns, its iso-lines give fractures */
    vec2 ux=vec2(vL.z*0.03,vL.y*0.0025)+sd,uz=vec2(vL.x*0.03,vL.y*0.0025)+sd;
    vec2 jx=vec2(vL.z*0.006,vL.y*0.035)+sd.yx,jz=vec2(vL.x*0.006,vL.y*0.035)+sd.yx;
    float fcol=mix(texture2D(uDet,uz).r,texture2D(uDet,ux).r,wx);
    float fj=mix(texture2D(uDet,jz).g,texture2D(uDet,jx).g,wx);
    float fine=mix(0.5,mix(texture2D(uDet,vec2(vL.x*0.11,vL.y*0.05)+sd).g,texture2D(uDet,vec2(vL.z*0.11,vL.y*0.05)+sd).g,wx),1.0-smoothstep(80.0,450.0,d));
    float top=texture2D(uDet,vL.xz*0.03+sd).g;
    float crack=1.0-smoothstep(0.0,0.045+0.05*(1.0-fd),abs(fcol-0.5));
    float joint=(1.0-smoothstep(0.0,0.035,abs(fj-0.5)))*0.7;
#ifdef BUMP
    float e=0.01;
    float f1=mix(texture2D(uDet,uz+vec2(e,0.0)).r,texture2D(uDet,ux+vec2(e,0.0)).r,wx);
    float j1=mix(texture2D(uDet,jz+vec2(0.0,e)).g,texture2D(uDet,jx+vec2(0.0,e)).g,wx);
    vec3 Tg=normalize(vec3(-N.z,0.0,N.x)+1e-4);
    N=normalize(N+(Tg*(fcol-f1)*7.0+vec3(0.0,1.0,0.0)*(fj-j1)*3.0+N*(fine-0.5)*0.0)*side*fd);
#endif
    float ao=vT.x;
    /* palettes: dark basalt (most), grey limestone, weathered brown-grey */
    float pal=vIC.x;
    vec3 c0=vec3(0.05,0.048,0.046),c1=vec3(0.15,0.142,0.13);
    if(pal>0.35){c0=vec3(0.13,0.128,0.12);c1=vec3(0.34,0.33,0.31);}
    if(pal>0.8){c0=vec3(0.075,0.062,0.05);c1=vec3(0.2,0.17,0.135);}
    float tone=clamp(fcol*0.55+fine*0.3+vT.y*0.35-0.1,0.0,1.0);
    vec3 col=mix(c0,c1,tone);
    col*=1.0-0.75*max(crack*side,joint*side);                         /* fractures and bedding joints */
    col*=0.85+0.3*fine;
    float lich=smoothstep(0.66,0.86,texture2D(uDet,vL.xz*0.025+vL.y*0.012+sd).g)*smoothstep(0.2,0.8,N.y+0.3)*smoothstep(6.0,20.0,vW.y);
    col=mix(col,vec3(0.24,0.16,0.07),lich*0.35);
    float salt=smoothstep(0.7,0.9,fj)*smoothstep(0.55,0.8,fcol)*smoothstep(8.0,30.0,vW.y);
    col=mix(col,c1*1.6+0.05,salt*0.3);
    /* sparse moss and scrub only where soil can collect */
    float veg=vIC.y*smoothstep(0.55,0.85,N.y+(top-0.5)*0.5)*smoothstep(0.42,0.62,top+ao*0.25)*smoothstep(6.0,22.0,vW.y);
    vec3 vc=mix(vec3(0.03,0.055,0.02),vec3(0.1,0.12,0.04),texture2D(uDet,vL.xz*0.11).r);
    vc=mix(vc,vec3(0.13,0.1,0.05),smoothstep(0.55,0.8,top)*0.5);
    col=mix(col,vc,veg);
    /* wet dark base and barnacle band */
    float wet=1.0-smoothstep(0.0,5.0,vW.y-0.6*sin(uTime*0.9+vL.x*0.03));
    col*=1.0-wet*0.55;col=mix(col,vec3(0.02,0.022,0.02),(1.0-smoothstep(-0.5,1.6,vW.y))*0.6);
    /* light */
    float ndl=dot(N,uSunDir),dif=max(ndl,0.0);
    vec3 sun=uSunCol*uSunK;
    float sh=mix(0.35,1.0,ao);
    col=col*(sun*dif*sh+vAmb*0.55*ao+vec3(0.012,0.015,0.022));
    col+=sun*wet*0.05*pow(max(dot(reflect(-uSunDir,N),V),0.0),30.0);
    /* white water clinging to the rock */
    float wl=vW.y-0.7*sin(uTime*1.15+(vL.x+vL.z)*0.045)-0.3*sin(uTime*2.3+vL.x*0.11);
    float foam=(1.0-smoothstep(0.0,1.2+1.5*side,wl))*step(-1.2,wl)*smoothstep(0.3,0.7,fine+0.25)*(1.0-smoothstep(900.0,2400.0,d));
    col=mix(col,vec3(0.8,0.82,0.85)*(0.16+0.5*uSunI)+sun*0.1*dif,foam*0.85);
    col=mix(col,vHz,vFog);
    gl_FragColor=vec4(col,1.0);`+S+"}"});
function foamMat(tex){return new THREE.ShaderMaterial({uniforms:Object.assign({uField:{value:tex}},UNI),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,
  vertexShader:b+`uniform float uTime,uAmp,uView;uniform vec2 uOffset;uniform vec4 uW[5];varying float vFog,vD,vS;varying vec3 vHz;varying vec2 vL,vUV;
  void main(){vec4 w=modelMatrix*instanceMatrix*vec4(position,1.0);vec2 q=w.xz+uOffset;float dist=length(w.xz),hy=0.0;
    for(int i=0;i<5;i++){vec4 W=uW[i];float L=W.w;float fade=1.0-smoothstep(L*6.0,L*16.0,dist);float s=W.z*uAmp*fade;float k=6.28318/L;float c=sqrt(9.8/k);
      hy+=s/k*sin(k*(dot(normalize(W.xy),q)-c*uTime));}
    w.y+=hy+0.3;mat3 im=mat3(instanceMatrix);vS=length(im[0]);vL=(im*position).xz;vUV=position.xz/2.6+0.5;
    ${VFOG}
    vD=dv;gl_Position=projectionMatrix*viewMatrix*w;}`,
  fragmentShader:`uniform vec3 uSunCol;uniform float uSunK,uTime,uSunI;uniform sampler2D uDet,uField;varying float vFog,vD,vS;varying vec3 vHz;varying vec2 vL,vUV;
  void main(){float dn=texture2D(uField,vUV).r*0.45-0.05;float dm=dn*vS;if(dm<-25.0)discard;
    float n1=texture2D(uDet,vL*0.035+vec2(uTime*0.012,0.0)).r,n2=texture2D(uDet,vL*0.012-vec2(0.0,uTime*0.007)).g;
    float reach=10.0+vS*0.085;
    float band=smoothstep(0.4,1.0,sin(dm*0.32-uTime*1.5+n2*6.0)*0.5+0.5);
    float a=exp(-max(dm,0.0)/reach)*(0.3+0.7*band)*smoothstep(0.2,0.7,n1*0.75+n2*0.45+exp(-max(dm,0.0)/4.0)*0.5);
    a=max(a,(1.0-smoothstep(0.0,4.0+vS*0.015,dm))*0.95);
    vec3 col=vec3(0.84,0.86,0.88)*(0.2+0.55*uSunI)+uSunCol*uSunK*0.08;
    col=mix(col,vHz,vFog);
    a*=1.0-smoothstep(SURF_D*0.75,SURF_D,vD);
    gl_FragColor=vec4(col,clamp(a,0.0,1.0)*0.88);`.replace(/SURF_D/g,SURF_D.toFixed(1))+S+"}"})}

const B={hi:[],lo:[],xlo:[],fm:[]};
function batch(g,mat,cap,col){const im=new THREE.InstancedMesh(g,mat,cap);im.frustumCulled=false;im.count=0;im.visible=false;im.matrixAutoUpdate=false;
  if(col)im.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(cap*3),3);y.add(im);return im}
function geo(q){const g=new THREE.BufferGeometry;g.setAttribute("position",new THREE.BufferAttribute(q.pos,3));g.setAttribute("normal",new THREE.BufferAttribute(q.nrm,3));
  g.setAttribute("aT",new THREE.BufferAttribute(q.at,2));g.setIndex(new THREE.BufferAttribute(q.idx,1));g.boundingSphere=new THREE.Sphere(new THREE.Vector3,3);return g}
const FPLANE=(()=>{const g=new THREE.PlaneGeometry(2.6,2.6,18,18);g.rotateX(-Math.PI/2);return g})();
function accept(r){const vi=r.id;
  const tex=new THREE.DataTexture(r.foam,r.FN,r.FN,THREE.RGBAFormat);tex.magFilter=tex.minFilter=THREE.LinearFilter;tex.needsUpdate=true;
  VAR[vi]=r;B.hi[vi]=batch(geo(r.hi),rockMat,12,1);B.lo[vi]=batch(geo(r.lo),rockMat,40,1);B.xlo[vi]=batch(geo(r.xlo),rockMat,120,1);
  const f=batch(FPLANE,foamMat(tex),24,0);f.renderOrder=2;B.fm[vi]=f;ready++}
const LIST=[];for(let i=0;i<NV;i++)LIST.push([i,7001+i*7919]);
try{const src="("+WGEN.toString()+")()",wk=new Worker(URL.createObjectURL(new Blob([src],{type:"application/javascript"})));
  wk.onmessage=e=>accept(e.data);wk.postMessage({list:LIST,res:RES})}
catch(err){/* no workers: build on the main thread a little at a time */
  const sc={};(new Function("self",WGEN.toString().replace(/^function WGEN\(\)\{/,"").replace(/\}$/,"")))(sc);let q=0;
  const step=()=>{if(q>=LIST.length)return;sc.postMessage=r=>accept(r);sc.onmessage({data:{list:[LIST[q++]],res:RES}});setTimeout(step,30)};setTimeout(step,30)}

/* ---------- field lookups ---------- */
function fieldAt(r,l,x,z){const FN=r.FN,Bb=r.B,fs=2*Bb/(FN-1);let fx=(x+Bb)/fs,fz=(z+Bb)/fs;
  if(fx<0||fz<0||fx>FN-1.001||fz>FN-1.001)return null;const i=fx|0,k=fz|0,uu=fx-i,w=fz-k,F=r.lev[l],q=k*FN+i;
  return (F[q]*(1-uu)+F[q+1]*uu)*(1-w)+(F[q+FN]*(1-uu)+F[q+FN+1]*uu)*w}
function sdf3(r,x,yy,z){const h=r.h;let fx=(x+r.B)/h,fy=(yy-r.Y0)/h,fz=(z+r.B)/h;if(fx<0||fy<0||fz<0||fx>r.nx-1.001||fy>r.ny-1.001||fz>r.nz-1.001)return 1;
  const i=fx|0,j=fy|0,k=fz|0,uu=fx-i,vv=fy-j,w=fz-k,nx=r.nx,ny=r.ny,V=r.V,q=(k*ny+j)*nx+i,dy=nx,dz=nx*ny;
  const c00=V[q]+(V[q+1]-V[q])*uu,c10=V[q+dy]+(V[q+dy+1]-V[q+dy])*uu,c01=V[q+dz]+(V[q+dz+1]-V[q+dz])*uu,c11=V[q+dz+dy]+(V[q+dz+dy+1]-V[q+dz+dy])*uu;
  const c0=c00+(c10-c00)*vv,c1=c01+(c11-c01)*vv;return c0+(c1-c0)*w}

/* ---------- deterministic infinite world ---------- */
const cache=new Map();
function mkObj(R,x,z,s,small){const vi=Math.floor(R()*NV),pr=R();
  return{vi,x,z,s,rot:R()*TAU,cs:0,sn:0,small,pal:pr<.5?R()*.3:pr<.78?.4+R()*.3:.85+R()*.1,veg:small?R()*.25:R()<.4?0:.3+R()*.7,seed:R(),nt:0,lv:4}}
function fin(o){o.cs=Math.cos(o.rot);o.sn=Math.sin(o.rot);const L=[.04,.09,.16,.28];o.lv=4;for(let i=0;i<4;i++)if(L[i]*o.s>=34){o.lv=i;break}return o}
function cell(cx,cz){const key=cx*73856093^cz*19349663;let c=cache.get(key);if(c&&c.cx===cx&&c.cz===cz)return c;
  const R=rng(h32(cx,cz,0x5eed1));c={cx,cz,list:[]};
  const ox=(cx+.5)*CELL,oz=(cz+.5)*CELL,x=ox+(R()*2-1)*JIT,z=oz+(R()*2-1)*JIT,roll=R();
  if(roll<.6){const s=R()<.3?240+R()*170:110+R()*170;
    if(Math.hypot(x,z)>SAFE0+s*1.2){c.list.push(fin(mkObj(R,x,z,s,0)));
      const ns=Math.floor(R()*R()*8);for(let k=0;k<ns;k++){const ang=R()*TAU,ss=14+R()*R()*85,d=s*1.15+ss*1.2+20+R()*240;
        c.list.push(fin(mkObj(R,x+Math.cos(ang)*d,z+Math.sin(ang)*d,ss,1)))}}}
  else if(roll<.85&&Math.hypot(x,z)>1000){const n=1+Math.floor(R()*4);for(let k=0;k<n;k++){const ang=R()*TAU,d=k?60+R()*220:0,ss=k?18+R()*60:40+R()*110;
      c.list.push(fin(mkObj(R,x+Math.cos(ang)*d,z+Math.sin(ang)*d,ss,k>0)))}}
  cache.set(key,c);if(cache.size>600)cache.clear();return c}
function near(x,z,fn){const cx=Math.floor(x/CELL),cz=Math.floor(z/CELL);
  for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(const o of cell(cx+i,cz+j).list)if(fn(o))return true;return false}
function local(o,x,z){const dx=x-o.x,dz=z-o.z;return[(dx*o.cs+dz*o.sn)/o.s,(-dx*o.sn+dz*o.cs)/o.s]}
/* metres from x,z to the rock at sea level (negative = inside). lv = how high a ship's rig reaches (arches) */
function clearance(o,x,z,lv){const dx=x-o.x,dz=z-o.z,dd=Math.hypot(dx,dz);if(dd>o.s*1.4+400)return 1e9;const r=VAR[o.vi];if(!r)return 1e9;
  const[lx,lz]=local(o,x,z),f=fieldAt(r,lv==null?o.lv:lv,lx,lz);if(f==null)return(Math.hypot(lx,lz)-r.foot)*o.s;return f*o.s}
function pushDir(o,x,z){const r=VAR[o.vi],[lx,lz]=local(o,x,z),e=.03;
  const p=fieldAt(r,o.lv,lx+e,lz),q=fieldAt(r,o.lv,lx-e,lz),c=fieldAt(r,o.lv,lx,lz+e),d=fieldAt(r,o.lv,lx,lz-e);
  let gx=(p!=null&&q!=null)?p-q:lx,gz=(c!=null&&d!=null)?c-d:lz;const l=Math.hypot(gx,gz)||1;gx/=l;gz/=l;
  return[gx*o.cs-gz*o.sn,gx*o.sn+gz*o.cs]}

/* ---------- per-frame: pick LODs, fill instance batches, throw spray ---------- */
const M4=new THREE.Matrix4,Q=new THREE.Quaternion,PV=new THREE.Vector3,SV=new THREE.Vector3,YA=new THREE.Vector3(0,1,0),FR=new THREE.Frustum,PM=new THREE.Matrix4,SP=new THREE.Sphere;
function put(im,o,x,z){if(!im||im.count>=im.instanceMatrix.count)return;Q.setFromAxisAngle(YA,-o.rot);M4.compose(PV.set(x,0,z),Q,SV.set(o.s,o.s,o.s));
  if(im.instanceColor)im.instanceColor.setXYZ(im.count,o.pal,o.veg*(VAR[o.vi].veg?1:.35),o.seed);im.setMatrixAt(im.count++,M4)}
const RR=Math.ceil(VIEW/CELL)+1;let stats={rocks:0,hi:0,ready:0,spray:0,parts:0},sprayT=0,lastT=0;
function spray(o,x,z,dd){const r=VAR[o.vi];stats.spray++;stats.parts=Yt.length;if(!r.WL.length||Yt.length>560)return;
  const q=Math.floor(Math.random()*r.WL.length/4)*4,lx=r.WL[q]*o.s,lz=r.WL[q+1]*o.s,nx=r.WL[q+2],nz=r.WL[q+3];
  const wx=lx*o.cs-lz*o.sn,wz=lx*o.sn+lz*o.cs,wnx=nx*o.cs-nz*o.sn,wnz=nx*o.sn+nz*o.cs,px=x+wx+wnx*1.5,pz=z+wz+wnz*1.5,k=clamp(o.s/100,.7,2)*(dd>350?1.7:1);
  const py=waveH(px,pz,kn),far=dd>350;
  const tx=-wnz,tz=wnx,big=a(.7,1.3);for(let i=0;i<(far?14:28);i++){const sp=a(-8,8)*k;emit({x:px+tx*sp,y:py+.3,z:pz+tz*sp,vx:wnx*a(1,5)+tx*a(-2.5,2.5),vy:a(9,22)*Math.sqrt(k)*big,vz:wnz*a(1,5)+tz*a(-2.5,2.5),max:a(1.8,3.4),s0:a(2,4)*k,s1:a(7,13)*k,a0:.95,kind:0,g:-9.8,drag:.4,sea:!0})}
  for(let i=0;i<7;i++)emit({x:px+tx*a(-7,7)*k,y:py+a(4,16)*k*big,z:pz+tz*a(-7,7)*k,vx:wnx*a(.8,2.5)+a(-.6,.6),vy:a(.5,1.8),vz:wnz*a(.8,2.5)+a(-.6,.6),max:a(3,5.5),s0:5*k,s1:a(14,24)*k,a0:.3,kind:0,g:.05,drag:.8,sea:!0})}
function update(){
  PM.multiplyMatrices(v.projectionMatrix,v.matrixWorldInverse);FR.setFromProjectionMatrix(PM);
  for(const k in B)for(const im of B[k])if(im)im.count=0;
  stats.rocks=stats.hi=0;stats.ready=ready;
  const dt=clamp(zn-lastT,0,.1);lastT=zn;sprayT-=dt;
  if(ready){const cx=Math.floor(wt.x/CELL),cz=Math.floor(wt.y/CELL);
  for(let i=-RR;i<=RR;i++)for(let j=-RR;j<=RR;j++)for(const o of cell(cx+i,cz+j).list){if(!VAR[o.vi])continue;
    const x=o.x-wt.x,z=o.z-wt.y,dd=Math.hypot(x,z),de=Math.max(1,dd-o.s*1.2),ratio=o.s/de;
    if(de>VIEW||ratio<.02)continue;
    if(dd<o.s*1.4+700){o.nt-=dt;if(o.nt<=0){o.nt=a(.35,1.4)*(o.small?1.6:1);if(sprayT<=0){spray(o,x,z,dd);sprayT=.07}}}
    if(!FR.intersectsSphere(SP.set(PV.set(x,o.s*.6,z),o.s*1.5)))continue;
    stats.rocks++;
    if(ratio>.32){put(B.hi[o.vi],o,x,z);stats.hi++}else if(ratio>.085)put(B.lo[o.vi],o,x,z);else put(B.xlo[o.vi],o,x,z);
    if(dd-o.s*1.3<SURF_D&&ratio>.04)put(B.fm[o.vi],o,x,z)}}
  for(const k in B)for(const im of B[k])if(im){im.visible=im.count>0;if(im.count){im.instanceMatrix.needsUpdate=true;if(im.instanceColor)im.instanceColor.needsUpdate=true}}
  UNI.uSunK.value=.35+Kt.intensity*.42;
}
/* ---------- ship vs rock ---------- */
let cd=0,warnT=0;const PTS=[[13.5,0],[7,3.6],[7,-3.6],[0,4.2],[0,-4.2],[-7,3.8],[-7,-3.8],[-13,0]];
function collide(dt){cd-=dt;warnT-=dt;if(!ready||(!Qn.spawned&&Qn.on))return;
  const fx=-Math.sin(Mn),fz=-Math.cos(Mn);let hit=false,hitPt=null,best=0;
  for(let it=0;it<3;it++){let moved=false;
    for(const[al,sd]of PTS){const px=wt.x+fx*al-fz*sd,pz=wt.y+fz*al+fx*sd;
      near(px,pz,o=>{const c=clearance(o,px,pz);if(c<1.2){const pen=1.2-c,[nx,nz]=pushDir(o,px,pz);
        wt.x+=nx*pen;wt.y+=nz*pen;moved=true;hit=true;const into=-(fx*nx+fz*nz);if(into*Rn>best){best=into*Rn;hitPt=[al,sd]}}return false})}
    if(!moved)break}
  if(hit){Rn*=1-.92*clamp(best/Math.max(Rn,1e-3),0,1);bn*=.5;
    if(best>1.4&&cd<=0&&"play"===dn&&!vn){cd=1.1;const dmg=Math.round(2+best*4);
      const lp=new THREE.Vector3(hitPt[1],.8,-hitPt[0]);takeDamage(dmg,lp,null);
      const wp=pe.localToWorld(lp.clone());splash(wp,1);Eo=Math.max(Eo,1.3);
      if(warnT<=0){warnT=9;say(best>3?"Rocks! She's holed against the cliffs — bear away!":"The hull grinds on the rocks. Bear away, captain.",3)}}}
}
/* ---------- cannonballs strike the rock ---------- */
function ball(p){if(!ready)return false;const wx=p.x+wt.x,wz=p.z+wt.y;let hit=false;
  near(wx,wz,o=>{const r=VAR[o.vi];if(!r)return false;const dx=wx-o.x,dz=wz-o.z;if(dx*dx+dz*dz>(o.s*1.3)**2||p.y>o.s*1.95)return false;
    const[lx,lz]=local(o,wx,wz);if(sdf3(r,lx,p.y/o.s,lz)<0){hit=true;return true}return false});
  if(hit){for(let k=0;k<16;k++)emit({x:p.x,y:p.y,z:p.z,vx:a(-4,4),vy:a(1,7),vz:a(-4,4),max:a(.8,1.6),s0:a(.1,.25),s1:.08,a0:1,kind:3,g:-9.8,drag:.3,sea:!0});
    for(let k=0;k<12;k++)emit({x:p.x,y:p.y,z:p.z,vx:a(-2,2),vy:a(.5,2.5),vz:a(-2,2),max:a(2.5,4.5),s0:1,s1:a(4,7),a0:.55,kind:1,g:.15,drag:.9,sea:!0});
    en.hit(Jn(p),.7)}
  return hit}
/* ---------- keep spawns and targets out of the rocks ---------- */
function inRock(x,z,mg){return near(x,z,o=>clearance(o,x,z,4)<mg*(o.small?.5:1))}
function safe(e){let x=e.x,z=e.z,h=e.h;
  for(let it=0;it<10;it++){let push=null;
    near(x,z,o=>{const need=o.s<90?80:170,c=clearance(o,x,z,4);if(c<need){push=[o,need-c];return true}return false});
    if(!push)break;const[o,amt]=push;let dx=x-o.x,dz=z-o.z;if(Math.hypot(dx,dz)<1){dx=-o.x||1;dz=-o.z}const l=Math.hypot(dx,dz),nx=dx/l,nz=dz/l;
    x+=nx*(amt+15);z+=nz*(amt+15);if(-Math.sin(h)*nx+-Math.cos(h)*nz<.3)h=Math.atan2(-nx,-nz)+(Math.random()-.5)*.6}
  if(inRock(x,z,60)){const x0=x,z0=z;for(let k=1;k<200;k++){const ang=k*2.39996,rad=40*Math.sqrt(k);x=x0+Math.cos(ang)*rad;z=z0+Math.sin(ang)*rad;if(!inRock(x,z,120))break}}
  for(let k=0;k<12&&inRock(x-Math.sin(h)*160,z-Math.cos(h)*160,40);k++)h+=TAU/12;
  return{x,z,h}}
return{VAR,update,collide,ball,safe,inRock,beacon:()=>null,stats:()=>stats,cell,clearance,near,sdf3,local,CELL,ready:()=>ready};
})();
