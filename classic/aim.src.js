/* Cannon aim: a glowing tracer arc with light pulses flowing toward the target, and a landing zone painted
   into the sea surface (in the water shader), so it rides every wave instead of being covered by them. */
const AIM=(()=>{
const N=No,pos=new Float32Array(N*2*3),tan=new Float32Array(N*2*3),at=new Float32Array(N*2*2),idx=[];
for(let i=0;i<N-1;i++){const a=i*2;idx.push(a,a+2,a+1,a+1,a+2,a+3)}
const g=new THREE.BufferGeometry;g.setAttribute("position",new THREE.BufferAttribute(pos,3));g.setAttribute("aTan",new THREE.BufferAttribute(tan,3));g.setAttribute("aT",new THREE.BufferAttribute(at,2));g.setIndex(idx);
const U={uTime:ft.uTime,uCol:{value:new THREE.Color(1,.74,.4)},uA:{value:1},uLen:{value:100}};
const mat=new THREE.ShaderMaterial({uniforms:U,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
  vertexShader:`attribute vec3 aTan;attribute vec2 aT;varying vec2 vT;
  void main(){vec4 w=modelMatrix*vec4(position,1.0);vec3 V=normalize(cameraPosition-w.xyz);vec3 sd=normalize(cross(normalize(aTan),V));
    float d=length(cameraPosition-w.xyz);w.xyz+=sd*aT.y*(0.14+d*0.0065);vT=aT;gl_Position=projectionMatrix*viewMatrix*w;}`,
  fragmentShader:`uniform float uTime,uA,uLen;uniform vec3 uCol;varying vec2 vT;
  void main(){float e=abs(vT.y),s=vT.x;
    float core=exp(-e*e*9.0),glow=exp(-e*e*2.2)*0.3;
    float ph=fract(s*0.06-uTime*1.1),pulse=smoothstep(0.0,0.12,ph)*smoothstep(0.55,0.15,ph);
    float a=(core*(0.35+0.9*pulse)+glow*(0.6+0.6*pulse))*smoothstep(2.0,10.0,s)*smoothstep(uLen,uLen-6.0,s)*uA;
    gl_FragColor=vec4(uCol*a*1.35,a);`+S+"}"});
const arc=new THREE.Mesh(g,mat);arc.frustumCulled=false;arc.renderOrder=3;arc.visible=false;y.add(arc);
/* soft column of light standing over the impact point, always facing the camera */
const bm=new THREE.ShaderMaterial({uniforms:U,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  vertexShader:`varying vec2 vU;void main(){vU=uv;vec4 c=modelViewMatrix*vec4(0.0,position.y,0.0,1.0);vec4 w=modelMatrix*vec4(0.0,0.0,0.0,1.0);float d=length(cameraPosition-w.xyz);
    c.x+=position.x*(1.0+d*0.012);gl_Position=projectionMatrix*c;}`,
  fragmentShader:`uniform float uTime,uA;uniform vec3 uCol;varying vec2 vU;void main(){float x=abs(vU.x-0.5)*2.0;
    float a=exp(-x*x*7.0)*pow(1.0-vU.y,1.6)*(0.55+0.25*sin(uTime*4.0))*uA;gl_FragColor=vec4(uCol*a*1.6,a);`+S+"}"});
const beam=new THREE.Mesh((()=>{const q=new THREE.PlaneGeometry(1.6,26,1,4);q.translate(0,13,0);return q})(),bm);beam.frustumCulled=false;beam.renderOrder=3;beam.visible=false;y.add(beam);
function show(on){arc.visible=beam.visible=on;if(!on)ft.uAim.value.w=0}
function set(n,land,ready,side){
  if(n<2){arc.visible=false;return}
  let s=0;for(let i=0;i<n;i++){const o=i*3,px=Uo[o],py=Uo[o+1],pz=Uo[o+2];
    if(i)s+=Math.hypot(px-Uo[o-3],py-Uo[o-2],pz-Uo[o-1]);
    const a=Math.max(0,i-1)*3,b=Math.min(n-1,i+1)*3,tx=Uo[b]-Uo[a],ty=Uo[b+1]-Uo[a+1],tz=Uo[b+2]-Uo[a+2];
    for(let k=0;k<2;k++){const v=i*2+k;pos[v*3]=px;pos[v*3+1]=py;pos[v*3+2]=pz;tan[v*3]=tx;tan[v*3+1]=ty;tan[v*3+2]=tz;at[v*2]=s;at[v*2+1]=k?1:-1}}
  g.attributes.position.needsUpdate=g.attributes.aTan.needsUpdate=g.attributes.aT.needsUpdate=true;g.setDrawRange(0,(n-1)*6);
  const load=sideLoad(side),ok=load>=.999;
  U.uLen.value=s;U.uA.value=ok?1:.35;U.uCol.value.setRGB(ok?1:.6,ok?.66:.62,ok?.3:.68);
  /* landing zone: broadside spread is long along the ship and short in range */
  const range=Math.hypot(land.x,land.z),fx=-Math.sin(Mn),fz=-Math.cos(Mn);
  beam.position.set(land.x,waveH(land.x,land.z,kn),land.z);
  ft.uAim.value.set(land.x,land.z,load,1);ft.uAimAx.value.set(fx,fz);ft.uAimR.value.set(12+range*.02,4.5+range*.055)}
return{show,set};
})();
