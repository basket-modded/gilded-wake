const RKS=(()=>{
"use strict";
const TAU=Math.PI*2,CELL=3400,JIT=520,VIEW=5300,HI_D=1900,SURF_D=2400,STACK_D=4000,SAFE0=1500;
const LOW=u().water<150;
const clamp=(x,a,b)=>x<a?a:x>b?b:x,sst=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
function h32(a,b,c){let h=Math.imul(a|0,0x27d4eb2d)^Math.imul(b|0,0x165667b1)^Math.imul(c|0,0x9e3779b1);h=Math.imul(h^(h>>>15),0x85ebca6b);h=Math.imul(h^(h>>>13),0xc2b2ae35);return(h^(h>>>16))>>>0}
function rng(seed){let q=seed>>>0;return()=>{q=q+0x6D2B79F5|0;let t=Math.imul(q^q>>>15,1|q);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function mkNoise(seed){const P=new Float32Array(1024),r=rng(seed);for(let i=0;i<1024;i++)P[i]=r();
  const hv=(x,y)=>P[(Math.imul(x,374761393)+Math.imul(y,668265263)^seed)>>>0&1023];
  const n=(x,y)=>{const xi=Math.floor(x),yi=Math.floor(y),fx=x-xi,fy=y-yi,ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy);
    const a=hv(xi,yi),b=hv(xi+1,yi),c=hv(xi,yi+1),d=hv(xi+1,yi+1);return a+(b-a)*ux+(c-a)*uy+(a-b-c+d)*ux*uy};
  const fbm=(x,y,o)=>{let s=0,a=.5,t=0;for(let i=0;i<o;i++){s+=a*n(x,y);t+=a;x=x*2.03+17.1;y=y*2.03+3.7;a*=.5}return s/t};
  const rid=(x,y,o)=>{let s=0,a=.5,t=0,w=1;for(let i=0;i<o;i++){let v=1-Math.abs(n(x,y)*2-1);v*=v;s+=a*v*w;w=clamp(v*1.4,0,1);t+=a;x=x*2.07+9.3;y=y*2.07+1.9;a*=.5}return s/t};
  return{n,fbm,rid}}

/* ---------- shape generator: polar grid, rings in coast-normalised space so cliffs are crisp ---------- */
function shapeFns(seed,kind){
  const R=rng(seed),N=mkNoise(seed*13+7),stack=kind==="stack";
  const H=[];for(let k=1;k<=9;k++)H.push([k,(R()*2-1)*(stack?.07:.21)/Math.pow(k,.8),R()*TAU]);
  const cp=[R()*TAU,R()*TAU,R()*TAU],cb=stack?.7+R()*.2:.16+R()*.26,cAmp=stack?.08:.1+R()*.12,ta=R()*TAU,tAmt=stack?0:R()*.35,mtnW=stack?1:.45+R()*.8;
  const peaks=[];const np=stack?1:1+Math.floor(R()*3);
  for(let i=0;i<np;i++){const a=R()*TAU,d=stack?0:R()*.42;peaks.push([Math.cos(a)*d,Math.sin(a)*d,(i?.55+R()*.35:1)*mtnW,stack?.9:.3+R()*.4])}
  const ridS=stack?3:1.8+R()*1.2,mtnK=stack?.35:.45+R()*.5;
  const coast=t=>{let c=1;for(const[k,a,p]of H)c+=a*Math.sin(k*t+p);c+=(N.fbm(Math.cos(t)*2.2+40,Math.sin(t)*2.2+40,3)-.5)*(stack?.12:.22);return clamp(c,.66,1.34)};
  const cliff=stack?t=>clamp(cb+cAmp*Math.sin(2*t+cp[0])+(N.fbm(Math.cos(t)*3+9,Math.sin(t)*3+9,3)-.5)*.25,.3,.98)
    :t=>{const cn=clamp(.5+.28*Math.sin(2*t+cp[0])+.17*Math.sin(3*t+cp[2])+.12*Math.sin(7*t+cp[1])+(N.fbm(Math.cos(t)*3+9,Math.sin(t)*3+9,4)-.5)*.9,0,1);return .012+cb*2.1*Math.pow(cn,1.7)};
  function height(x,z,t,uu){
    if(uu>=1)return -.012-(uu-1)*1.4;
    const tt=1-uu,ch=cliff(t),w=stack?.03:.0135;
    let m=0;for(const[px,pz,ph,pr]of peaks){const d=Math.hypot(x-px,z-pz)/pr;m+=ph*Math.exp(-d*d*1.25)}
    const rd=N.rid(x*ridS+5,z*ridS+5,5),dt=N.fbm(x*7+2,z*7+2,4);
    m=m*(1-mtnK*.55+mtnK*rd)+.035*dt;
    const t2=tt*tt,tl=1+tAmt*(x*Math.cos(ta)+z*Math.sin(ta)),plat=(ch*(1-t2)+cb*t2)*(1+.3*tt)*tl+.07*(dt-.5)*tt-.12*Math.max(0,.55-rd)*tt*(1-t2);
    const k=.07,hh=clamp(.5+.5*(m-plat)/k,0,1);let hl=m*hh+plat*(1-hh)+k*hh*(1-hh);
    if(stack)hl=plat+.08*dt+.15*Math.max(0,m-.6);
    const e=sst(0,w,tt),ter=1+.06*Math.sin(tt*60+dt*8)*(1-e);
    return hl*e*ter;
  }
  return{coast,height,N};
}
function polar(F,NA,U,norm){
  const NR=U.length,pos=new Float32Array(NA*NR*3),hts=new Float32Array(NA*NR),C=new Float32Array(NA);
  for(let i=0;i<NA;i++){const t=i/NA*TAU,c=F.coast(t);C[i]=c;
    for(let j=0;j<NR;j++){const r=U[j]*c,x=Math.cos(t)*r,z=Math.sin(t)*r;let h=F.height(x,z,t,U[j]);
      hts[j*NA+i]=h;const o=(j*NA+i)*3;pos[o]=x;pos[o+1]=h;pos[o+2]=z}}
  let mx=1e-6;if(norm==null){for(const h of hts)mx=Math.max(mx,h);norm=1/mx}
  for(let k=0;k<hts.length;k++){hts[k]*=norm;pos[k*3+1]*=norm}
  const idx=[];for(let j=0;j<NR-1;j++)for(let i=0;i<NA;i++){const i2=(i+1)%NA,a=j*NA+i,b=j*NA+i2,c=(j+1)*NA+i,d=(j+1)*NA+i2;idx.push(a,b,c,b,d,c)}
  /* orient up */
  {const o0=Math.floor(NR/2)*NA*6,a=idx[o0]*3,b=idx[o0+1]*3,c=idx[o0+2]*3,ux=pos[b]-pos[a],uz=pos[b+2]-pos[a+2],vx=pos[c]-pos[a],vz=pos[c+2]-pos[a+2];
   if(uz*vx-ux*vz<0)for(let k=0;k<idx.length;k+=3){const q=idx[k+1];idx[k+1]=idx[k+2];idx[k+2]=q}}
  /* cavity + tint */
  const at=new Float32Array(NA*NR*2);
  for(let j=0;j<NR;j++)for(let i=0;i<NA;i++){const k=j*NA+i,h=hts[k];
    const nb=(hts[j*NA+(i+1)%NA]+hts[j*NA+(i+NA-1)%NA]+hts[Math.min(NR-1,j+1)*NA+i]+hts[Math.max(0,j-1)*NA+i])*.25;
    const x=pos[k*3],z=pos[k*3+2];at[k*2]=clamp(.5+(nb-h)*9,0,1);at[k*2+1]=F.N.fbm(x*9+31,z*9+31,2)}
  const g=new THREE.BufferGeometry;g.setAttribute("position",new THREE.BufferAttribute(pos,3));g.setAttribute("aT",new THREE.BufferAttribute(at,2));
  g.setIndex(idx);g.computeVertexNormals();g.boundingSphere=new THREE.Sphere(new THREE.Vector3,2);
  return{g,hts,C,NA,U,norm};
}
function surfGeo(C,NA){const p=[],f=[],idx=[],W=[-.006,.03,.075];
  for(let i=0;i<NA;i++){const t=i/NA*TAU;for(let j=0;j<3;j++){const r=C[i]+W[j];p.push(Math.cos(t)*r,0,Math.sin(t)*r);f.push(j/2)}}
  for(let i=0;i<NA;i++){const i2=(i+1)%NA;for(let j=0;j<2;j++){const a=i*3+j,b=i2*3+j;idx.push(a,b,a+1,b,b+1,a+1)}}
  const g=new THREE.BufferGeometry;g.setAttribute("position",new THREE.Float32BufferAttribute(p,3));g.setAttribute("aF",new THREE.Float32BufferAttribute(f,1));g.setIndex(idx);return g}

const UHI=LOW?[0,.07,.14,.21,.28,.35,.42,.49,.56,.62,.68,.73,.78,.82,.86,.895,.925,.95,.968,.98,.99,.996,1,1.02,1.08]
  :[0,.04,.08,.12,.16,.2,.24,.28,.32,.36,.4,.44,.48,.52,.56,.6,.64,.68,.72,.755,.79,.82,.85,.875,.9,.92,.938,.953,.966,.977,.986,.993,.998,1,1.012,1.04,1.1];
const ULO=[0,.2,.4,.56,.7,.8,.88,.94,.975,.993,1,1.06];
const NV=6,NS=3,VAR=[],STK=[];
for(let v=0;v<NV;v++){const F=shapeFns(9001+v*7919,"isle"),hi=polar(F,LOW?110:176,UHI),lo=polar(F,48,ULO,hi.norm);
  let mc=0;for(const c of hi.C)mc=Math.max(mc,c);hi.maxC=mc;VAR.push({hi,lo,surf:surfGeo(hi.C,hi.NA),maxC:mc})}
for(let v=0;v<NS;v++){const F=shapeFns(4243+v*104729,"stack"),hi=polar(F,20,[0,.3,.55,.75,.88,.95,.985,1,1.08]);
  let mc=0;for(const c of hi.C)mc=Math.max(mc,c);hi.maxC=mc;STK.push({hi,maxC:mc})}

/* ---------- lookups (shared by collision, cannon fire, spawn) ---------- */
function coastAt(P,t){const f=((t%TAU)+TAU)%TAU/TAU*P.NA,i=Math.floor(f)%P.NA,w=f-Math.floor(f);return P.C[i]*(1-w)+P.C[(i+1)%P.NA]*w}
function hAt(P,t,rr){const f=((t%TAU)+TAU)%TAU/TAU*P.NA,i=Math.floor(f)%P.NA,i2=(i+1)%P.NA,w=f-Math.floor(f);
  const c=P.C[i]*(1-w)+P.C[i2]*w,uu=rr/c,U=P.U,NR=U.length;if(uu>=U[NR-1])return -1;
  let j=0;while(j<NR-2&&U[j+1]<uu)j++;const s=clamp((uu-U[j])/(U[j+1]-U[j]),0,1),H=P.hts,NA=P.NA;
  const a=H[j*NA+i]*(1-w)+H[j*NA+i2]*w,b=H[(j+1)*NA+i]*(1-w)+H[(j+1)*NA+i2]*w;return a+(b-a)*s}

/* ---------- deterministic infinite world: one island max per cell, jitter keeps them apart ---------- */
const cache=new Map();
function mkObj(P,x,z,rot,sh,sv,stack){return{P,x,z,rot,sh,sv,stack,cs:Math.cos(rot),sn:Math.sin(rot),rad:P.maxC*sh}}
function cell(cx,cz){const key=cx*73856093^cz*19349663;let c=cache.get(key);if(c&&c.cx===cx&&c.cz===cz)return c;
  const R=rng(h32(cx,cz,0x5eed));c={cx,cz,isl:null,st:[]};
  const ox=(cx+.5)*CELL,oz=(cz+.5)*CELL;
  if(R()<.64){const vi=Math.floor(R()*NV),V=VAR[vi],sh=260+R()*330;let sv=sh*(.5+R()*.6);if(R()<.25)sv*=1.45;sv=Math.min(sv,720);
    const x=ox+(R()*2-1)*JIT,z=oz+(R()*2-1)*JIT,o=mkObj(V.hi,x,z,R()*TAU,sh,sv,0);o.vi=vi;
    if(Math.hypot(x,z)>SAFE0+o.rad){c.isl=o;
      const ns=Math.floor(R()*R()*9);for(let k=0;k<ns;k++){const a=R()*TAU,lr=a-o.rot,cr=coastAt(V.hi,lr)*sh,d=cr+30+R()*Math.min(190,sh*.35);
        const si=Math.floor(R()*NS),ssh=10+R()*30,ssv=Math.min(sv*.45,ssh*(1.5+R()*2.6));
        const so=mkObj(STK[si].hi,x+Math.cos(a)*d,z+Math.sin(a)*d,R()*TAU,ssh,ssv,1);so.vi=si;c.st.push(so)}}}
  else if(R()<.4){const n=1+Math.floor(R()*3),x0=ox+(R()*2-1)*JIT,z0=oz+(R()*2-1)*JIT;
    if(Math.hypot(x0,z0)>900)for(let k=0;k<n;k++){const a=R()*TAU,d=k?40+R()*70:0,si=Math.floor(R()*NS),ssh=10+R()*22;
      const so=mkObj(STK[si].hi,x0+Math.cos(a)*d,z0+Math.sin(a)*d,R()*TAU,ssh,ssh*(1.5+R()*2),1);so.vi=si;c.st.push(so)}}
  cache.set(key,c);if(cache.size>600)cache.clear();return c}
function near(x,z,fn){const cx=Math.floor(x/CELL),cz=Math.floor(z/CELL);
  for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){const c=cell(cx+i,cz+j);if(c.isl&&fn(c.isl))return true;for(const s of c.st)if(fn(s))return true}return false}
function local(o,x,z){const dx=x-o.x,dz=z-o.z,lx=(dx*o.cs+dz*o.sn)/o.sh,lz=(-dx*o.sn+dz*o.cs)/o.sh;return[Math.atan2(lz,lx),Math.hypot(lx,lz),dx,dz]}
/* metres from x,z to the waterline (negative = inside the rock) */
function clearance(o,x,z){const[t,r,dx,dz]=local(o,x,z);const d=Math.hypot(dx,dz);if(d>o.rad+400)return 1e9;return d-coastAt(o.P,t)*o.sh}
function heightAt(o,x,z){const[t,r]=local(o,x,z);if(r>o.P.maxC*1.1)return -1e9;return hAt(o.P,t,r)*o.sv}

/* ---------- materials ---------- */
function detTex(){const S=128,d=new Uint8Array(S*S*4),N1=mkNoise(77),N2=mkNoise(191);
  const tn=(N,x,y,p)=>{const xi=Math.floor(x),yi=Math.floor(y),fx=x-xi,fy=y-yi,ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy),m=(a,b)=>N.n(((a%p)+p)%p,((b%p)+p)%p);
    const a=m(xi,yi),b=m(xi+1,yi),c=m(xi,yi+1),e=m(xi+1,yi+1);return a+(b-a)*ux+(c-a)*uy+(a-b-c+e)*ux*uy};
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){let r=0,g=0,a=.5,tt=0;for(let o=0,p=4;o<5;o++,p*=2){r+=a*tn(N1,x/S*p,y/S*p,p);g+=a*tn(N2,x/S*p,y/S*p,p);tt+=a;a*=.5}
    const k=(y*S+x)*4;d[k]=clamp((r/tt-.5)*2.4+.5,0,1)*255;d[k+1]=clamp((g/tt-.5)*2.4+.5,0,1)*255;d[k+2]=0;d[k+3]=255}
  const t=new THREE.DataTexture(d,S,S,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=Math.min(4,m);t.needsUpdate=true;return t}
const DT=detTex();
const UNI={uSunDir:gt.uniforms.uSunDir,uSunI:gt.uniforms.uSunI,uSunCol:{value:T},uSunK:{value:2},uTime:ft.uTime,uDet:{value:DT},uView:{value:VIEW},
  uOffset:ft.uOffset,uW:ft.uW,uAmp:ft.uAmp};
/* fog colour, fog amount and sky ambient are evaluated per vertex: far cheaper than per pixel */
const VFOG=`
  vec3 Vv=cameraPosition-w.xyz;float dv=length(Vv);Vv/=dv;
  vHz=skyBase(normalize(vec3(-Vv.x,0.0,-Vv.z)));
  float wf=1.0-exp(-dv*0.00045);wf=clamp(wf*wf*1.25,0.0,1.0);
  vFog=pow(wf,1.0+max(w.y,0.0)/700.0);
  vFog=max(vFog,smoothstep(uView*0.8,uView,dv));`;
const rockMat=new THREE.ShaderMaterial({uniforms:UNI,defines:LOW?{}:{BUMP:1},
  vertexShader:b+`uniform float uView;attribute vec2 aT;varying vec3 vW,vN,vL,vHz,vAmb;varying vec2 vT;varying float vFog;
  void main(){vec4 w=modelMatrix*instanceMatrix*vec4(position,1.0);mat3 im=mat3(instanceMatrix);
    vec3 n=normal/vec3(dot(im[0],im[0]),dot(im[1],im[1]),dot(im[2],im[2]));vN=normalize(mat3(modelMatrix)*(im*n));
    vL=im*position;vW=w.xyz;vT=aT;
    vAmb=skyBase(normalize(vec3(vN.x*0.6,max(vN.y,0.0)+0.35,vN.z*0.6)));
    ${VFOG}
    gl_Position=projectionMatrix*viewMatrix*w;}`,
  fragmentShader:`uniform vec3 uSunDir;uniform float uSunI;
  uniform vec3 uSunCol;uniform float uSunK,uTime;uniform sampler2D uDet;varying vec3 vW,vN,vL,vHz,vAmb;varying vec2 vT;varying float vFog;
  void main(){
    vec3 V=cameraPosition-vW;float d=length(V);V/=d;
    vec3 N=normalize(vN);
    float fd=1.0-smoothstep(400.0,2600.0,d);
    bool sx=abs(N.x)>abs(N.z);
    vec2 pc=sx?vL.zy:vL.xy;
    vec2 ps=pc*vec2(0.012,0.04),pg=pc*vec2(0.03,0.006),pt=vL.xz*0.016;
    float c0=texture2D(uDet,ps).r,g0=texture2D(uDet,pg).g,t0=texture2D(uDet,pt).r;
    float dt2=texture2D(uDet,vL.xz*0.0021+0.37).g;
#ifdef BUMP
    float bk=fd*(1.0-N.y*0.6);
    float cx=texture2D(uDet,ps+vec2(0.006,0.0)).r,cy=texture2D(uDet,ps+vec2(0.0,0.006)).r;
    float tx=texture2D(uDet,pt+vec2(0.006,0.0)).r,tz=texture2D(uDet,pt+vec2(0.0,0.006)).r;
    vec2 gs=vec2(c0-cx,c0-cy)*3.2*bk,gt2=vec2(t0-tx,t0-tz)*2.2*fd;
    N=normalize(N+(sx?vec3(0.0,gs.y,gs.x):vec3(gs.x,gs.y,0.0))*(1.0-abs(N.y))+vec3(gt2.x,0.0,gt2.y)*max(N.y,0.0));
#endif
    float slope=1.0-N.y;
    float dc=mix(0.5,c0,0.3+0.7*fd),dt=mix(0.5,t0,fd);
    float cav=vT.x,tint=vT.y;
    /* dark basalt with strata bands and vertical gullies */
    float strata=sin(vW.y*0.38+dc*3.2+dt2*7.0);
    vec3 rock=mix(vec3(0.045,0.043,0.042),vec3(0.17,0.155,0.14),dc);
    rock*=0.68+0.4*smoothstep(-0.4,0.7,strata);
    rock*=0.75+0.35*g0;
    rock=mix(rock,vec3(0.15,0.105,0.07),smoothstep(0.5,0.85,dt2)*0.4);
    /* lush grass tops, dark scrub and forest in the folds */
    vec3 grass=mix(vec3(0.05,0.13,0.022),vec3(0.13,0.19,0.04),dt);
    vec3 forest=vec3(0.014,0.036,0.016)*(0.75+0.5*dt);
    vec3 veg=mix(grass,forest,smoothstep(0.4,0.66,cav*0.6+dt2*0.7-vW.y/800.0));
    veg=mix(veg,vec3(0.2,0.17,0.08),smoothstep(0.62,0.92,tint)*0.5);
    float ledge=smoothstep(0.6,0.85,strata*0.5+0.5)*smoothstep(0.9,0.6,slope)*0.7;
    float vegA=max(smoothstep(0.46,0.28,slope+(dt-0.5)*0.3),ledge)*smoothstep(2.0,9.0,vW.y);
    vec3 col=mix(rock,veg,vegA);
    /* snow on the high ground */
    float sl=345.0+dt2*110.0;
    float snow=smoothstep(sl-25.0,sl+25.0,vW.y+(dt-0.5)*120.0+(g0-0.5)*60.0)*smoothstep(0.78,0.4,slope+(dt-0.5)*0.3);
    col=mix(col,vec3(0.8,0.84,0.92),snow);
    col*=mix(0.4,1.0,smoothstep(-0.5,6.0,vW.y));
    col*=0.68+0.64*(1.0-cav);
    /* light */
    float ndl=dot(N,uSunDir);
    float dif=max(ndl,0.0),wrap=max((ndl+0.3)/1.3,0.0);
    vec3 sun=uSunCol*uSunK;
    float back=pow(max(dot(-V,uSunDir),0.0),6.0)*vegA*(1.0-slope);
    col=col*(sun*mix(dif,wrap,0.2)+vAmb*0.62+vec3(0.016,0.02,0.03)+sun*back*0.35)+sun*snow*pow(max(dot(reflect(-uSunDir,N),V),0.0),24.0)*0.12;
    /* white water breaking on the rock */
    float wl=vW.y-0.6*sin(uTime*1.15+(vL.x+vL.z)*0.045)-0.25*sin(uTime*2.3+vL.x*0.11);
    float foam=(1.0-smoothstep(0.0,1.4+1.6*slope,wl))*step(-1.0,wl)*smoothstep(0.25,0.7,dt+0.3*slope)*(1.0-smoothstep(900.0,2600.0,d));
    col=mix(col,vec3(0.78,0.8,0.83)*(0.16+0.5*uSunI)+sun*0.1*dif,foam*0.8);
    col=mix(col,vHz,vFog);
    gl_FragColor=vec4(col,1.0);`+S+"}"});
const surfMat=new THREE.ShaderMaterial({uniforms:UNI,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,
  vertexShader:b+`uniform float uTime,uAmp,uView;uniform vec2 uOffset;uniform vec4 uW[5];attribute float aF;varying float vF,vFog,vD;varying vec3 vHz;varying vec2 vL;
  void main(){vec4 w=modelMatrix*instanceMatrix*vec4(position,1.0);vec2 q=w.xz+uOffset;float dist=length(w.xz),hy=0.0;
    for(int i=0;i<5;i++){vec4 W=uW[i];float L=W.w;float fade=1.0-smoothstep(L*6.0,L*16.0,dist);float s=W.z*uAmp*fade;float k=6.28318/L;float c=sqrt(9.8/k);
      hy+=s/k*sin(k*(dot(normalize(W.xy),q)-c*uTime));}
    w.y+=hy+0.3;vF=aF;vL=(mat3(instanceMatrix)*position).xz;
    ${VFOG}
    vD=dv;gl_Position=projectionMatrix*viewMatrix*w;}`,
  fragmentShader:`uniform vec3 uSunCol;uniform float uSunK,uTime,uSunI;uniform sampler2D uDet;varying float vF,vFog,vD;varying vec3 vHz;varying vec2 vL;
  void main(){
    float n1=texture2D(uDet,vL*0.03+vec2(uTime*0.01,0.0)).r,n2=texture2D(uDet,vL*0.011-vec2(0.0,uTime*0.006)).g;
    float band=smoothstep(0.45,1.0,sin(vF*16.0+uTime*1.7+n2*7.0)*0.5+0.5);
    float a=pow(1.0-vF,1.4)*(0.35+0.65*band)*smoothstep(0.25,0.75,n1*0.7+n2*0.5+(1.0-vF)*0.35);
    vec3 col=vec3(0.82,0.84,0.86)*(0.18+0.55*uSunI)+uSunCol*uSunK*0.08;
    col=mix(col,vHz,vFog);
    a*=1.0-smoothstep(SURF_D*0.75,SURF_D,vD);
    gl_FragColor=vec4(col,a*0.85);`.replace(/SURF_D/g,SURF_D.toFixed(1))+S+"}"});

/* ---------- instanced draw batches ---------- */
function batch(g,mat,cap){const im=new THREE.InstancedMesh(g,mat,cap);im.frustumCulled=false;im.count=0;im.visible=false;im.matrixAutoUpdate=false;y.add(im);return im}
const B={hi:VAR.map(V=>batch(V.hi.g,rockMat,6)),lo:VAR.map(V=>batch(V.lo.g,rockMat,48)),sf:VAR.map(V=>batch(V.surf,surfMat,6)),st:STK.map(V=>batch(V.hi.g,rockMat,160))};
for(const m of B.sf)m.renderOrder=2;
const M4=new THREE.Matrix4,Q=new THREE.Quaternion,PV=new THREE.Vector3,SV=new THREE.Vector3,YA=new THREE.Vector3(0,1,0),FR=new THREE.Frustum,PM=new THREE.Matrix4,SP=new THREE.Sphere;
function put(im,o,x,z){Q.setFromAxisAngle(YA,-o.rot);M4.compose(PV.set(x,0,z),Q,SV.set(o.sh,o.sv,o.sh));im.setMatrixAt(im.count++,M4)}
const R=Math.ceil(VIEW/CELL)+1;let nearest=null,stats={isles:0,hi:0,stacks:0};
function update(){
  PM.multiplyMatrices(v.projectionMatrix,v.matrixWorldInverse);FR.setFromProjectionMatrix(PM);
  for(const k in B)for(const im of B[k])im.count=0;
  const cx=Math.floor(wt.x/CELL),cz=Math.floor(wt.y/CELL);let nd=1e9;nearest=null;stats.isles=stats.hi=stats.stacks=0;
  for(let i=-R;i<=R;i++)for(let j=-R;j<=R;j++){const c=cell(cx+i,cz+j);
    const o=c.isl;if(o){const x=o.x-wt.x,z=o.z-wt.y,dd=Math.hypot(x,z),e=dd-o.rad;
      if(e<nd){nd=e;nearest=o}
      if(e<VIEW&&FR.intersectsSphere(SP.set(PV.set(x,o.sv*.4,z),Math.max(o.rad,o.sv)*1.15))){
        stats.isles++;if(e<HI_D){put(B.hi[o.vi],o,x,z);stats.hi++}else put(B.lo[o.vi],o,x,z);
        if(e<SURF_D)put(B.sf[o.vi],o,x,z)}}
    for(const so of c.st){const x=so.x-wt.x,z=so.z-wt.y,dd=Math.hypot(x,z);
      if(dd-so.rad<STACK_D&&FR.intersectsSphere(SP.set(PV.set(x,so.sv*.5,z),Math.max(so.rad,so.sv)))){const im=B.st[so.vi];if(im.count<160){put(im,so,x,z);stats.stacks++}}}}
  for(const k in B)for(const im of B[k]){im.visible=im.count>0;if(im.count)im.instanceMatrix.needsUpdate=true}
  UNI.uSunK.value=.35+Kt.intensity*.42;
}
/* ---------- ship vs rock ---------- */
let cd=0,warnT=0;const PTS=[[13.5,0],[7,3.6],[7,-3.6],[0,4.2],[0,-4.2],[-7,3.8],[-7,-3.8],[-13,0]];
function collide(dt){cd-=dt;warnT-=dt;if(!Qn.spawned&&Qn.on)return;
  const fx=-Math.sin(Mn),fz=-Math.cos(Mn),rx=-fz,rz=fx;let hitN=null,hitPt=null,best=0;
  for(let it=0;it<3;it++){let moved=false;
    for(const[al,sd]of PTS){const px=wt.x+fx*al+rx*sd,pz=wt.y+fz*al+rz*sd;
      near(px,pz,o=>{const c=clearance(o,px,pz);if(c<1.2){const pen=1.2-c,dx=px-o.x,dz=pz-o.z,l=Math.hypot(dx,dz)||1;
        wt.x+=dx/l*pen;wt.y+=dz/l*pen;moved=true;const into=-(fx*dx+fz*dz)/l;if(into*Rn>best){best=into*Rn;hitN=[dx/l,dz/l];hitPt=[al,sd]}}return false})}
    if(!moved)break}
  if(hitN){const into=best/Math.max(Rn,1e-3);Rn*=1-.92*clamp(into,0,1);bn*=.5;
    if(best>1.4&&cd<=0&&"play"===dn&&!vn){cd=1.1;const dmg=Math.round(2+best*4);
      const lp=new THREE.Vector3(hitPt[1],.8,-hitPt[0]);takeDamage(dmg,lp,null);
      const wp=pe.localToWorld(lp.clone());splash(wp,.8);Eo=Math.max(Eo,1.3);
      if(warnT<=0){warnT=9;say(best>3?"Rocks! She's holed against the cliffs — bear away!":"The hull grinds on the rocks. Bear away, captain.",3)}}}
}
/* ---------- cannonballs strike the rock ---------- */
function ball(p){const wx=p.x+wt.x,wz=p.z+wt.y;let hit=false;
  near(wx,wz,o=>{const dx=wx-o.x,dz=wz-o.z;if(dx*dx+dz*dz>(o.rad+10)**2||p.y>o.sv*1.05)return false;
    if(p.y<heightAt(o,wx,wz)+.4){hit=true;return true}return false});
  if(hit){for(let k=0;k<14;k++)emit({x:p.x,y:p.y,z:p.z,vx:a(-4,4),vy:a(1,7),vz:a(-4,4),max:a(.8,1.6),s0:a(.1,.25),s1:.08,a0:1,kind:3,g:-9.8,drag:.3,sea:!0});
    for(let k=0;k<12;k++)emit({x:p.x,y:p.y,z:p.z,vx:a(-2,2),vy:a(.5,2.5),vz:a(-2,2),max:a(2.5,4.5),s0:1,s1:a(4,7),a0:.55,kind:1,g:.15,drag:.9,sea:!0});
    en.hit(Jn(p),.7)}
  return hit}
/* ---------- keep spawns and targets out of the rocks ---------- */
function inRock(x,z,m){return near(x,z,o=>clearance(o,x,z)<m*(o.stack?.45:1))}
function safe(e){let x=e.x,z=e.z,h=e.h;
  for(let it=0;it<8;it++){let push=null;
    near(x,z,o=>{const need=o.stack?70:170,c=clearance(o,x,z);if(c<need){push=[o,need-c];return true}return false});
    if(!push)break;const[o,amt]=push;let dx=x-o.x,dz=z-o.z;if(Math.hypot(dx,dz)<1){dx=-o.x||1;dz=-o.z}const l=Math.hypot(dx,dz);x+=dx/l*(amt+10);z+=dz/l*(amt+10);
    const nx=dx/l,nz=dz/l;if(-Math.sin(h)*nx+-Math.cos(h)*nz<.3)h=Math.atan2(-nx,-nz)+(Math.random()-.5)*.6}
  /* never sail straight into a cliff right after spawning */
  for(let k=0;k<12&&inRock(x-Math.sin(h)*160,z-Math.cos(h)*160,40);k++)h+=TAU/12;
  return{x,z,h}}
function beacon(){if(!nearest)return null;const o=nearest,dx=wt.x-o.x,dz=wt.y-o.z,a0=Math.atan2(dz,dx),[t]=local(o,o.x+Math.cos(a0),o.z+Math.sin(a0));
  const r=coastAt(o.P,t)*.9,hh=Math.max(4,hAt(o.P,t,r)*o.sv)+9,l=r*o.sh;return[o.x+Math.cos(a0)*l-wt.x,hh,o.z+Math.sin(a0)*l-wt.y]}
return{VAR,STK,update,collide,ball,safe,inRock,beacon,stats:()=>stats,cell,clearance,heightAt,near,CELL};
})();
