/* Seagulls: "Seagull" by Dayvable (sketchfab.com/Dayvable), CC-BY-4.0.
   The rig's wingbeat loop (24 frames) and glide pose were baked to a small bone table; all gulls are one
   instanced mesh skinned on the GPU, each with its own wingbeat phase and a smooth blend into the glide.
   Shading adds soft feather barbs, a sea-bounce fill under the wings and warm light glowing through the
   feathers when backlit, so the model reads with depth without getting noisy. */
const GULL=(()=>{
const M=GULLDATA.meta,raw=Uint8Array.from(atob(GULLDATA.bin),c=>c.charCodeAt(0)).buffer,nv=M.nv,ni=M.ni,nj=M.nj,nf=M.nf,FL=nf-1;
let o=0;const take=(bytes)=>{const b=raw.slice(o,o+bytes);o+=bytes;return b};
const Pq=new Uint16Array(take(nv*6)),Nq=new Int8Array(take(nv*4)),UVq=new Uint16Array(take(nv*4)),Jq=new Uint8Array(take(nv*4)),Wq=new Uint8Array(take(nv*4)),Iq=new Uint16Array(take(ni*2)),BT=new Float32Array(take(nf*nj*3*16));
const pos=new Float32Array(nv*3);for(let i=0;i<nv;i++)for(let k=0;k<3;k++)pos[i*3+k]=M.pm[k]+Pq[i*3+k]*M.ps[k];
const g=new THREE.BufferGeometry;
g.setAttribute("position",new THREE.BufferAttribute(pos,3));
g.setAttribute("normal",new THREE.BufferAttribute(new Float32Array(Array.from({length:nv*3},(_,i)=>Nq[Math.floor(i/3)*4+i%3]/127)),3));
g.setAttribute("uv",new THREE.BufferAttribute(new Float32Array(Array.from(UVq,v=>v/65535)),2));
g.setAttribute("aJ",new THREE.BufferAttribute(new Float32Array(Jq),4));
g.setAttribute("aWt",new THREE.BufferAttribute(new Float32Array(Array.from(Wq,v=>v/255)),4));
g.setIndex(new THREE.BufferAttribute(Iq,1));
const N=Tt,anim=new Float32Array(N*2);g.setAttribute("aAnim",new THREE.InstancedBufferAttribute(anim,2).setUsage(THREE.DynamicDrawUsage));
const bt=new THREE.DataTexture(BT,nj*3,nf,THREE.RGBAFormat,THREE.FloatType);bt.magFilter=bt.minFilter=THREE.NearestFilter;bt.needsUpdate=true;
const img=new Image,tex=new THREE.Texture(img);img.onload=()=>{tex.needsUpdate=true};img.src=GULLDATA.tex;
tex.anisotropy=Math.min(4,m);tex.flipY=false;
const U={uBones:{value:bt},uBS:{value:new THREE.Vector2(nj*3,nf)},uFL:{value:FL},uMap:{value:tex},uSunDir:gt.uniforms.uSunDir,uSunI:gt.uniforms.uSunI,uSunCol:{value:T},uSunK:{value:2}};
const mat=new THREE.ShaderMaterial({uniforms:U,side:THREE.DoubleSide,
  vertexShader:b+`uniform sampler2D uBones;uniform vec2 uBS;uniform float uFL;attribute vec4 aJ,aWt;attribute vec2 aAnim;
  varying vec3 vN,vW,vL,vAmb,vSea,vHz;varying vec2 vUv;varying float vFog;
  mat4 bone(float j,float f){float v=(f+0.5)/uBS.y,du=1.0/uBS.x,u0=(j*3.0+0.5)*du;
    vec4 r0=texture2D(uBones,vec2(u0,v)),r1=texture2D(uBones,vec2(u0+du,v)),r2=texture2D(uBones,vec2(u0+2.0*du,v));
    return mat4(vec4(r0.x,r1.x,r2.x,0.0),vec4(r0.y,r1.y,r2.y,0.0),vec4(r0.z,r1.z,r2.z,0.0),vec4(r0.w,r1.w,r2.w,1.0));}
  mat4 pose(float j,float f0,float f1,float a,float gb){mat4 fl=bone(j,f0)*(1.0-a)+bone(j,f1)*a;return fl*(1.0-gb)+bone(j,uFL)*gb;}
  void main(){float fr=mod(aAnim.x,uFL),f0=floor(fr),f1=mod(f0+1.0,uFL),a=fr-f0,gb=aAnim.y;
    float ws=aWt.x+aWt.y+aWt.z+aWt.w;
    mat4 S=(pose(aJ.x,f0,f1,a,gb)*aWt.x+pose(aJ.y,f0,f1,a,gb)*aWt.y+pose(aJ.z,f0,f1,a,gb)*aWt.z+pose(aJ.w,f0,f1,a,gb)*aWt.w)/max(ws,1e-4);
    vec4 lp=S*vec4(position,1.0);vL=lp.xyz;
    vec4 w=modelMatrix*instanceMatrix*lp;vW=w.xyz;
    vN=normalize(mat3(modelMatrix)*mat3(instanceMatrix)*mat3(S)*normal);vUv=uv;
    vAmb=skyBase(vec3(0.0,1.0,0.0));vSea=vec3(0.03,0.1,0.12)*(0.3+0.7*uSunI);
    vec3 Vv=cameraPosition-w.xyz;float dv=length(Vv);vHz=skyBase(normalize(vec3(-Vv.x,0.0,-Vv.z)));
    float wf=1.0-exp(-dv*0.00045);vFog=clamp(wf*wf*1.25,0.0,1.0);
    gl_Position=projectionMatrix*viewMatrix*w;}`,
  fragmentShader:`uniform sampler2D uMap;uniform vec3 uSunDir,uSunCol;uniform float uSunI,uSunK;
  varying vec3 vN,vW,vL,vAmb,vSea,vHz;varying vec2 vUv;varying float vFog;
  void main(){
    vec3 V=normalize(cameraPosition-vW);vec3 N=normalize(vN);if(dot(N,V)<0.0)N=-N;
    vec3 base=pow(texture2D(uMap,vUv).rgb,vec3(2.2));
    float d=length(cameraPosition-vW),fd=1.0-smoothstep(6.0,45.0,d);
    /* soft feather barbs running along the chord of the wing, plus faint feather-row bands across it */
    float barb=sin(vL.x*95.0+sin(vL.z*21.0)*1.6)*0.5+0.5;
    float rows=smoothstep(0.55,1.0,sin(vL.z*34.0+vL.x*6.0)*0.5+0.5);
    float wing=smoothstep(0.12,0.3,abs(vL.x));
    base*=1.0-fd*wing*(0.06*barb+0.08*rows);
    base*=1.0-0.18*smoothstep(0.25,0.9,abs(vL.x))*smoothstep(0.0,-0.35,vL.z);   /* trailing edge a touch deeper */
    float ndl=dot(N,uSunDir),dif=max(ndl,0.0)*0.85+max(ndl+0.35,0.0)/1.35*0.15;
    vec3 sun=uSunCol*uSunK;
    float up=N.y*0.5+0.5;
    vec3 amb=mix(vSea*1.6,vAmb*0.75,up);                                         /* sea bounce lights the undersides */
    float thru=pow(max(dot(-V,uSunDir),0.0),3.0)*(1.0-abs(dot(N,V)))*wing;       /* low sun glowing through the feathers */
    float rim=pow(1.0-max(dot(N,V),0.0),3.0)*0.35;
    vec3 col=base*(sun*dif+amb+sun*thru*0.6)+sun*rim*0.12*base+sun*pow(max(dot(reflect(-uSunDir,N),V),0.0),18.0)*0.04;
    col=mix(col,vHz,vFog);
    gl_FragColor=vec4(col,1.0);`+S+"}"});
const mesh=new THREE.InstancedMesh(g,mat,N);mesh.frustumCulled=false;y.add(mesh);
const st=Array.from({length:N},()=>({ph:Math.random()*FL,gb:1}));
function inst(i,Mx,s,dt){mesh.setMatrixAt(i,Mx);const q=st[i];
  const want=s.flap?0:1;q.gb+=(want-q.gb)*Math.min(1,dt*2.6);
  if(q.gb<.98||s.flap)q.ph=(q.ph+dt*FL*(s.flap?.95:.55))%FL;
  anim[i*2]=q.ph;anim[i*2+1]=q.gb}
function done(){mesh.instanceMatrix.needsUpdate=true;g.attributes.aAnim.needsUpdate=true;U.uSunK.value=.35+Kt.intensity*.42}
return{inst,done,mesh};
})();
