/* Ship wakes, painted into the sea itself.
   Each ship lays a path on the water as it sails. Every frame the paths are drawn from above into a
   wake map centred on the player (R = froth, G = disturbed water, B = calm interior). The sea shader
   samples that map, so the wake bends its ripples, lightens the aerated water and frays into froth
   exactly on the moving wave surface: nothing floats on top, so nothing can clip through the swell. */
const WAKE=(()=>{
const MAXP=150,SP=2.4,MAXS=340,MAXAGE=75,LOWQ=u().water<150,RES=LOWQ?512:1024,EXT=420;
const RT=new THREE.WebGLRenderTarget(RES,RES,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,format:THREE.RGBAFormat,depthBuffer:false,stencilBuffer:false});
const WS=new THREE.Scene,OC=new THREE.OrthographicCamera(-EXT,EXT,EXT,-EXT,-50,50);OC.position.set(0,20,0);OC.up.set(0,0,-1);OC.lookAt(0,0,0);
const mat=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,transparent:true,side:THREE.DoubleSide,
  blending:THREE.CustomBlending,blendEquation:THREE.AddEquation,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor,
  vertexShader:`attribute vec4 aD;varying vec4 vD;void main(){vD=aD;gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.0);}`,
  fragmentShader:`varying vec4 vD;
  void main(){float u=vD.x,s=vD.y,I=vD.z,au=abs(u);vec3 o=vec3(0.0);
    if(vD.w<0.5){
      /* turbulent wash straight behind the stern */
      float on=smoothstep(22.0,32.0,s),t=max(s-26.0,0.0);
      float f=exp(-pow(au/0.42,2.0))*exp(-t/85.0);
      float g=exp(-pow(au/0.95,2.0))*exp(-t/170.0);
      o=vec3(f*0.95,g*0.75,0.0)*on;
    }else{
      /* bow waves: thin frothy lines along the edges of the wedge, fraying outward as they age */
      float th=0.05+0.1*smoothstep(0.0,220.0,s),dd=au-1.0;
      float line=exp(-pow(dd/(dd<0.0?th*0.6:th*2.2),2.0));
      float f=line*exp(-s/115.0)*(0.65+0.35*exp(-s/20.0));
      float g=exp(-pow(dd/(th*3.5),2.0))*exp(-s/210.0);
      float calm=smoothstep(0.95,0.45,au)*exp(-s/170.0)*0.75;
      o=vec3(f,g,calm);
    }
    gl_FragColor=vec4(o*I,1.0);}`});
const ALL=[];let FR=0;
function ribbon(){const nv=MAXP*4,g=new THREE.BufferGeometry;
  g.setAttribute("position",new THREE.BufferAttribute(new Float32Array(nv*3),3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute("aD",new THREE.BufferAttribute(new Float32Array(nv*4),4).setUsage(THREE.DynamicDrawUsage));
  g.setIndex(new THREE.BufferAttribute(new Uint16Array((MAXP-1)*12),1));g.setDrawRange(0,0);
  const m=new THREE.Mesh(g,mat);m.frustumCulled=false;WS.add(m);const R={m,g,pts:[],fr:0,cnt:0};ALL.push(R);return R}
const me=ribbon();
function lay(R,x,z,h,spd,now){const fx=-Math.sin(h),fz=-Math.cos(h),sx=x-fx*11.5,sz=z-fz*11.5,P=R.pts;
  if(P.length&&Math.hypot(P[0].x-sx,P[0].z-sz)>60)P.length=0;
  if(!P.length||Math.hypot(P[0].x-sx,P[0].z-sz)>=SP)P.unshift({x:sx,z:sz,t:now,i:spd});else P[0].i=Math.max(P[0].i*.98,spd);
  while(P.length>MAXP-2||(P.length&&now-P[P.length-1].t>MAXAGE))P.pop();
  /* bow, live stern, then the laid points */
  const L=[{x:x+fx*15,z:z+fz*15,t:now,i:spd},{x:sx,z:sz,t:now,i:spd}];
  for(const p of P)if(Math.hypot(p.x-L[L.length-1].x,p.z-L[L.length-1].z)>.4)L.push(p);
  const n=L.length,pos=R.g.attributes.position.array,ad=R.g.attributes.aD.array;
  let s=0;const S=new Float32Array(n),TX=new Float32Array(n),TZ=new Float32Array(n),K=new Float32Array(n);
  for(let i=0;i<n;i++){if(i)s+=Math.hypot(L[i].x-L[i-1].x,L[i].z-L[i-1].z);S[i]=s;
    if(i<2){TX[i]=fx;TZ[i]=fz;continue}
    const a=L[Math.max(1,i-2)],c=L[Math.min(n-1,i+2)];let tx=a.x-c.x,tz=a.z-c.z;const l=Math.hypot(tx,tz)||1;TX[i]=tx/l;TZ[i]=tz/l}
  for(let i=1;i<n-1;i++){const ds=Math.max(.5,S[i+1]-S[i-1]);K[i]=(TX[i-1]*TZ[i+1]-TZ[i-1]*TX[i+1])/ds}
  for(let i=1;i<n-1;i++)K[i]=(K[i-1]+K[i]*2+K[i+1])/4;
  let cnt=0;
  for(let i=0;i<n&&S[i]<=MAXS;i++){const p=L[i],age=now-p.t,nx=-TZ[i],nz=TX[i],k=K[i];
    const fade=Math.exp(-age/40)*(1-Math.min(1,S[i]/MAXS))*p.i*(i===n-1?0:1);
    const wc=Math.min(14,3+Math.max(0,S[i]-26)*.035+age*.16),ww=Math.min(70,1.2+S[i]*.29);
    const lim=Math.abs(k)>1e-4?.85/Math.abs(k):1e9,side=(w,sg)=>Math.min(w,(k*sg>0)?lim:1e9);
    const ox=p.x-wt.x,oz=p.z-wt.y,b4=i*4;
    /* u is measured against the nominal half-width, so a squeezed inner side still reads its true distance */
    const V=(j,w,sg,kind,nom)=>{const o=(b4+j)*3;pos[o]=ox+nx*w*sg;pos[o+1]=0;pos[o+2]=oz+nz*w*sg;const q=(b4+j)*4;ad[q]=sg*w/nom;ad[q+1]=S[i];ad[q+2]=fade;ad[q+3]=kind};
    V(0,side(wc,1),1,0,wc);V(1,side(wc,-1),-1,0,wc);V(2,side(ww*1.3,1),1,1,ww);V(3,side(ww*1.3,-1),-1,1,ww);cnt=i+1}
  R.g.attributes.position.needsUpdate=true;R.g.attributes.aD.needsUpdate=true;
  const idx=R.g.index.array;let q=0;
  for(const off of[0,2])for(let i=0;i<cnt-1;i++){if(off===0&&S[i+1]<20)continue;const a=i*4+off,c=(i+1)*4+off;idx[q++]=a;idx[q++]=c;idx[q++]=a+1;idx[q++]=a+1;idx[q++]=c;idx[q++]=c+1}
  R.g.index.needsUpdate=true;R.g.setDrawRange(0,q);R.m.visible=q>0;R.cnt=cnt}
const CC=new THREE.Color;
function update(){const now=performance.now()/1e3;FR++;me.fr=FR;
  lay(me,wt.x,wt.y,Mn,vn?0:Math.min(1,Math.max(0,Rn/6)),now);
  for(const c of Kn.values()){if(!c.root.visible||c.dist>EXT+350){if(c.wake){c.wake.m.visible=false;c.wake.pts.length=0}continue}
    if(!c.wake){c.wake=ALL.find(R=>R!==me&&!R.owner)||ribbon();c.wake.owner=c}
    c.wake.fr=FR;lay(c.wake,c.root.position.x+wt.x,c.root.position.z+wt.y,c.h,c.sk?0:Math.min(1,Math.max(0,(c.sp||0)/6)),now)}
  for(const R of ALL)if(R.fr!==FR){R.m.visible=false;R.pts.length=0;if(R.owner){R.owner.wake=null;R.owner=null}}
  /* paint the wake map */
  f.getClearColor(CC);const ca=f.getClearAlpha(),prev=f.getRenderTarget();
  f.setRenderTarget(RT);f.setClearColor(0,0);f.clear(true,false,false);f.render(WS,OC);f.setRenderTarget(prev);f.setClearColor(CC,ca);
}
return{update,me,tex:RT.texture,EXT,RES};
})();
ft.uWake.value=WAKE.tex;
