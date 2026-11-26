/* Ship wakes: each ship lays a ribbon of points on the sea as it sails. Two strips are built from it:
   a churned-foam core that widens and breaks up as it ages, and faint feathered side waves (the Kelvin wedge).
   Vertices are moved by the same waves as the sea, so the wake rides the swell and stays where it was laid. */
const WAKE=(()=>{
const MAXP=150,SP=2.4,MAXS=340,MAXAGE=75;
const U={uTime:ft.uTime,uAmp:ft.uAmp,uOffset:ft.uOffset,uW:ft.uW,uFoam:ft.uFoam,uSunDir:ft.uSunDir,uSunI:ft.uSunI,uSunColor:ft.uSunColor};
const mat=new THREE.ShaderMaterial({uniforms:U,transparent:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-4,
  vertexShader:`uniform float uTime,uAmp;uniform vec2 uOffset;uniform vec4 uW[5];
  attribute vec4 aD;varying vec4 vD;varying vec2 vQ;varying vec3 vWorld;
  void main(){vec3 p=position;float dist=length(p.xz);vec2 q=p.xz+uOffset;vec3 disp=vec3(0.0);
    for(int i=0;i<5;i++){vec4 w=uW[i];float L=w.w;float fade=1.0-smoothstep(L*6.0,L*16.0,dist);float s=w.z*uAmp*fade;
      float k=6.28318/L;float c=sqrt(9.8/k);vec2 d=normalize(w.xy);float f=k*(dot(d,q)-c*uTime);float a=s/k;
      disp+=vec3(d.x*a*cos(f),a*sin(f),d.y*a*cos(f));}
    p+=disp;p.y+=0.12;vD=aD;vQ=q;vec4 wp=modelMatrix*vec4(p,1.0);vWorld=wp.xyz;gl_Position=projectionMatrix*viewMatrix*wp;}`,
  fragmentShader:b+`uniform sampler2D uFoam;uniform float uTime;uniform vec3 uSunColor;varying vec4 vD;varying vec2 vQ;varying vec3 vWorld;
  void main(){
    float u=vD.x,s=vD.y,I=vD.z,kind=vD.w;float au=abs(u);
    float fA=texture2D(uFoam,vQ*0.09).r,fB=texture2D(uFoam,vQ*0.21+vec2(uTime*0.018,0.0)).r,fC=texture2D(uFoam,vQ*0.04-vec2(0.0,uTime*0.006)).r;
    vec3 foamCol=vec3(0.92,0.9,0.86)*(0.28+0.72*uSunI)+uSunColor*0.05;
    vec3 col;float a;
    if(kind<0.5){
      /* churned core: dense white near the stern, tearing into patches and streaks as it spreads */
      float br=smoothstep(0.0,190.0,s);
      float prof=smoothstep(1.0,0.2+0.25*br,au);
      float n=fA*0.55+fB*0.45+fC*0.5-0.25;
      float foam=prof*smoothstep(0.18+0.42*br,0.5+0.4*br,n+(1.0-au)*(0.45-0.25*br));
      float churn=smoothstep(1.0,0.05,au)*(1.0-0.7*br);
      vec3 churnCol=vec3(0.1,0.36,0.36)*(0.22+0.6*uSunI);
      col=mix(churnCol,foamCol,clamp(foam*1.3,0.0,1.0));
      a=max(foam*0.95,churn*0.32)*I*smoothstep(0.0,5.0,s);
    }else{
      /* side waves: short feathered crests along each arm of the wedge, not a solid line */
      float band=smoothstep(0.5,0.9,au)*(1.0-smoothstep(0.93,1.0,au));
      float crest=smoothstep(0.62,1.0,sin(s*0.38-au*9.0+fC*3.0)*0.5+0.5);
      float n=fA*0.5+fB*0.5;
      a=band*crest*smoothstep(0.3,0.75,n+0.15)*0.42*I*(1.0-smoothstep(70.0,230.0,s))*smoothstep(4.0,18.0,s);
      col=foamCol*0.92;
    }
    vec3 V=cameraPosition-vWorld;float dist=length(V);V/=dist;
    vec3 hz=skyBase(normalize(vec3(-V.x,0.0,-V.z)));float fog=1.0-exp(-dist*0.00045);
    col=mix(col,hz,clamp(fog*fog*1.25,0.0,1.0));
    gl_FragColor=vec4(col,clamp(a,0.0,1.0));`+S+"}"});
function ribbon(){const nv=MAXP*4,g=new THREE.BufferGeometry;
  g.setAttribute("position",new THREE.BufferAttribute(new Float32Array(nv*3),3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute("aD",new THREE.BufferAttribute(new Float32Array(nv*4),4).setUsage(THREE.DynamicDrawUsage));
  const idx=[];for(const off of[0,2])for(let i=0;i<MAXP-1;i++){const a=i*4+off,c=(i+1)*4+off;idx.push(a,c,a+1,a+1,c,c+1)}
  g.setIndex(idx);g.setDrawRange(0,0);
  const m=new THREE.Mesh(g,mat);m.frustumCulled=false;m.renderOrder=1;y.add(m);const R={m,g,pts:[],fr:0};ALL.push(R);return R}
const ALL=[];let FR=0;
const me=ribbon(),pool=[];
function lay(R,x,z,h,spd,now){const fx=-Math.sin(h),fz=-Math.cos(h),sx=x-fx*11.5,sz=z-fz*11.5,P=R.pts;
  if(P.length&&Math.hypot(P[0].x-sx,P[0].z-sz)>60)P.length=0;
  if(!P.length||Math.hypot(P[0].x-sx,P[0].z-sz)>=SP)P.unshift({x:sx,z:sz,t:now,i:spd});
  while(P.length>MAXP-1||(P.length&&now-P[P.length-1].t>MAXAGE))P.pop();
  /* point list: live stern first, then the laid points */
  const L=[{x:sx,z:sz,t:now,i:spd}];for(const p of P)if(Math.hypot(p.x-L[L.length-1].x,p.z-L[L.length-1].z)>.3)L.push(p);
  const n=L.length,pos=R.g.attributes.position.array,ad=R.g.attributes.aD.array;
  if(n<2){R.g.setDrawRange(0,0);return}
  let s=0;const S=new Float32Array(n),TX=new Float32Array(n),TZ=new Float32Array(n),K=new Float32Array(n);
  for(let i=0;i<n;i++){if(i)s+=Math.hypot(L[i].x-L[i-1].x,L[i].z-L[i-1].z);S[i]=s;
    const a=L[Math.max(0,i-2)],c=L[Math.min(n-1,i+2)];let tx=a.x-c.x,tz=a.z-c.z;const l=Math.hypot(tx,tz)||1;TX[i]=tx/l;TZ[i]=tz/l}
  if(n>=2){TX[0]=fx;TZ[0]=fz}
  /* signed curvature, smoothed: the inner side of a turn is narrowed so the strips never fold over */
  for(let i=1;i<n-1;i++){const ds=Math.max(.5,S[i+1]-S[i-1]);K[i]=(TX[i-1]*TZ[i+1]-TZ[i-1]*TX[i+1])/ds}
  for(let i=1;i<n-1;i++)K[i]=(K[i-1]+K[i]*2+K[i+1])/4;
  let cnt=0;
  for(let i=0;i<n&&S[i]<=MAXS;i++){const p=L[i],age=now-p.t,nx=-TZ[i],nz=TX[i],k=K[i];
    const fade=Math.exp(-age/38)*(1-Math.min(1,S[i]/MAXS))*p.i*(i===n-1?0:1);
    const wc=Math.min(18,2.6+S[i]*.055+age*.22),ww=Math.min(62,4.5+S[i]*.34);
    const lim=Math.abs(k)>1e-4?.85/Math.abs(k):1e9;
    const side=(w,sg)=>Math.min(w,(k*sg>0)?lim:1e9); /* sg=+1 is the +n side */
    const wcl=side(wc,1),wcr=side(wc,-1),wwl=side(ww,1),wwr=side(ww,-1);
    const ox=p.x-wt.x,oz=p.z-wt.y,b=i*4;
    const V=(j,w,sg,u,kind)=>{const o=(b+j)*3;pos[o]=ox+nx*w*sg;pos[o+1]=0;pos[o+2]=oz+nz*w*sg;const q=(b+j)*4;ad[q]=u;ad[q+1]=S[i];ad[q+2]=fade;ad[q+3]=kind};
    V(0,wcl,1,1,0);V(1,wcr,-1,-1,0);V(2,wwl,1,1,1);V(3,wwr,-1,-1,1);cnt=i+1}
  R.g.attributes.position.needsUpdate=true;R.g.attributes.aD.needsUpdate=true;
  const tris=Math.max(0,cnt-1)*6;R.g.setDrawRange(0,tris*2);
  R.m.visible=cnt>1;R.cnt=cnt}
/* the index buffer holds all core quads then all wedge quads; draw both halves by building index per frame count */
function fixIndex(R){const cnt=R.cnt||0;if(cnt<2){R.g.setDrawRange(0,0);return}
  const want=cnt;if(R.lastCnt===want)return;R.lastCnt=want;
  const idx=R.g.index.array;let k=0;for(const off of[0,2])for(let i=0;i<want-1;i++){const a=i*4+off,c=(i+1)*4+off;idx[k++]=a;idx[k++]=c;idx[k++]=a+1;idx[k++]=a+1;idx[k++]=c;idx[k++]=c+1}
  R.g.index.needsUpdate=true;R.g.setDrawRange(0,k)}
function update(){const now=performance.now()/1e3;FR++;me.fr=FR;
  lay(me,wt.x,wt.y,Mn,vn?0:Math.min(1,Math.max(0,Rn/6)),now);fixIndex(me);
  let used=0;
  for(const c of Kn.values()){if(!c.root.visible||c.dist>1600){if(c.wake){c.wake.m.visible=false;c.wake.pts.length=0}continue}
    if(!c.wake){c.wake=pool.pop()||ribbon()}
    lay(c.wake,c.root.position.x+wt.x,c.root.position.z+wt.y,c.h,c.sk?0:Math.min(1,Math.max(0,(c.sp||0)/6)),now);fixIndex(c.wake);c.wake.fr=FR;used++}
  for(const R of ALL)if(R.fr!==FR){R.m.visible=false;R.pts.length=0}
}
return{update,me};
})();
