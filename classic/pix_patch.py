import sys
P=sys.argv[1] if len(sys.argv)>1 else '/home/claude/mp/classic2.html'
s=open(P).read()
def one(a,b):
    global s
    assert s.count(a)==1,(s.count(a),a[:100])
    s=s.replace(a,b)

# ---------- 1. pixel grid for every textured surface except the water ----------
PIX=r'''
/* Pixel world: one texture pixel = one pixel of the captain sprite (1.78 m / 35 px).
   Every standard/basic material samples its textures at the centre of a 3D grid cell in the object's own space,
   with the mip footprint of a whole cell, so all surfaces read as flat pixels of exactly the same size. */
const PIXS=1.78/35;
THREE.ShaderChunk.uv_pars_vertex+="\n#ifdef PIXSNAP\nvarying vec3 vPixP;\n#endif\n";
THREE.ShaderChunk.begin_vertex+="\n#ifdef PIXSNAP\nvPixP=position;\n#endif\n";
const PIXFN=`
vec2 pixUV(vec2 uv,vec3 p,out vec2 gx,out vec2 gy){
  vec3 px=dFdx(p),py=dFdy(p);vec2 ux=dFdx(uv),uy=dFdy(uv);gx=ux;gy=uy;
  float a=dot(px,px),b=dot(px,py),e=dot(py,py),det=a*e-b*b;if(det<1e-16)return uv;
  vec3 d=(floor(p/PIXS)+0.5)*PIXS-p;float r1=dot(px,d),r2=dot(py,d);
  gx=ux*max(1.0,PIXS/max(sqrt(a),1e-6));gy=uy*max(1.0,PIXS/max(sqrt(e),1e-6));
  return uv+ux*((e*r1-b*r2)/det)+uy*((a*r2-b*r1)/det);}
vec4 pixTexP(sampler2D t,vec2 uv,vec3 p){vec2 gx,gy;vec2 q=pixUV(uv,p,gx,gy);
#if __VERSION__>=300
  return textureGrad(t,q,gx,gy);
#else
  return texture2D(t,q);
#endif
}`;
THREE.ShaderChunk.uv_pars_fragment+="\n#ifdef PIXSNAP\nvarying vec3 vPixP;\n"+PIXFN+"\n#define pixTex(t,uv) pixTexP(t,uv,vPixP)\n#endif\n";
THREE.ShaderChunk.map_fragment=`#ifdef USE_MAP
#ifdef PIXSNAP
  vec4 texelColor=pixTex(map,vUv);
#else
  vec4 texelColor=texture2D(map,vUv);
#endif
  texelColor=mapTexelToLinear(texelColor);diffuseColor*=texelColor;
#endif`;
THREE.ShaderChunk.emissivemap_fragment=`#ifdef USE_EMISSIVEMAP
#ifdef PIXSNAP
  vec4 emissiveColor=pixTex(emissiveMap,vUv);
#else
  vec4 emissiveColor=texture2D(emissiveMap,vUv);
#endif
  emissiveColor.rgb=emissiveMapTexelToLinear(emissiveColor).rgb;totalEmissiveRadiance*=emissiveColor.rgb;
#endif`;
const PIXDEF="#define PIXSNAP\n#define PIXS "+PIXS.toFixed(7)+"\n";
function PIXHOOK(sh){sh.vertexShader=PIXDEF+sh.vertexShader;sh.fragmentShader=PIXDEF+sh.fragmentShader}
THREE.MeshStandardMaterial.prototype.onBeforeCompile=PIXHOOK;THREE.MeshBasicMaterial.prototype.onBeforeCompile=PIXHOOK;
/* see-through windows: the wall and the hull simply have no surface inside the window openings */
function CUTHOOK(cond){const f=function(sh){PIXHOOK(sh);sh.fragmentShader=sh.fragmentShader.replace("void main() {","void main() {\n if("+cond+")discard;\n")};f.cond=cond;return f}
'''
one("const _={deck:",PIX+"const _={deck:")

MAT=r'''
_.wall=_.dark.clone();_.wall.onBeforeCompile=CUTHOOK("abs(vPixP.z-6.0)<0.1&&abs(abs(vPixP.x)-1.65)<0.31&&abs(vPixP.y-3.65)<0.25");
_.hull.onBeforeCompile=CUTHOOK("vPixP.z>13.85&&vPixP.y>3.125&&vPixP.y<4.075&&(abs(vPixP.x+1.6)<0.425||abs(vPixP.x)<0.425||abs(vPixP.x-1.6)<0.425)");
_.window=new THREE.MeshStandardMaterial({color:12376540,transparent:!0,opacity:.14,roughness:.04,metalness:.25,envMapIntensity:1.2,depthWrite:!1,side:THREE.DoubleSide});
'''
one("_.sail.shadowSide=THREE.DoubleSide;","_.sail.shadowSide=THREE.DoubleSide;"+MAT)

# ---------- 2. real windows: openings, deep frames, 1-pixel glass ----------
one('te("window",xf(new THREE.PlaneGeometry(.62,.5),wa,3.65,ie-.065,0,Math.PI,0)),',
    'te("window",xf(box(.62,.5,PIXS),wa,3.65,ie)),te("dark",xf(box(.04,.58,.15),wa-.33,3.65,ie)),te("dark",xf(box(.04,.58,.15),wa+.33,3.65,ie)),te("dark",xf(box(.7,.04,.15),wa,3.38,ie)),te("dark",xf(box(.7,.04,.15),wa,3.92,ie)),')
one('te("windowIn",xf(new THREE.PlaneGeometry(.62,.5),wa,3.65,ie+.065)),','')
one('te("window",xf(new THREE.PlaneGeometry(.85,.95),Sa,3.6,oe+.02)),',
    'te("window",xf(box(.85,.95,PIXS),Sa,3.6,oe)),te("dark",xf(box(.04,.95,.07),Sa,3.6,oe)),te("dark",xf(box(.85,.04,.07),Sa,3.6,oe)),')
one('te("windowIn",xf(new THREE.PlaneGeometry(.85,.95),Sa,3.6,oe-.03,0,Math.PI,0));',
    'te("dark",xf(box(.05,1.03,.2),Sa-.45,3.6,oe-.03)),te("dark",xf(box(.05,1.03,.2),Sa+.45,3.6,oe-.03)),te("dark",xf(box(.95,.05,.2),Sa,3.1,oe-.03)),te("dark",xf(box(.95,.05,.2),Sa,4.1,oe-.03));')

# ---------- 3. clutter that does nothing ----------
one('te("grating",xf(box(1.5,.16,1.9),0,se+.08,-3)),te("dark",xf(box(1.66,.18,2.06),0,se+.04,-3)),te("med",xf(cyl(.42,.5,.85,12),0,se+.43,-5.4)),te("dark",xf(cyl(.55,.55,.12,12),0,se+.9,-5.4));for(let Ha=0;Ha<6;Ha++){const ka=Ha/6*s;te("med",xf(box(1.5,.07,.08),.6*Math.cos(ka),se+.98,.6*Math.sin(ka)-5.4,0,-ka,0))}','')
one('for(const[Ia,La,Ba]of[[.55,se+.05,.75],[-.55,se+.05,.75],[2.6,se+.05,-11.3],[-2.2,re+.05,12.8],[-.4,se+.05,-12.2]])for(let qa=0;qa<3;qa++)te("rope",xf(ve,Ia,La+.07*qa,Ba,Math.PI/2,0,0,1-.15*qa,1-.15*qa,1));','')
one('for(const[Da,Fa,Wa,Oa]of[[-2.05,se+.375,-9.5,.1],[-2,se+1.125,-9.45,-.2],[-1.25,se+.375,-10.1,.35],[2.65,re+.375,12.6,.05],[-1.9,se+.375,-7,.2]])te("crate",xf(we,Da,Fa,Wa,0,Oa,0));','')
one('te("med",xf(box(.5,.06,.5),-1.45,se+.46,10.75)),te("med",xf(box(.5,.55,.06),-1.45,se+.75,11));for(const[Ya,$a]of[[-.2,-.2],[.2,-.2],[-.2,.2],[.2,.2]])te("med",xf(cyl(.03,.03,.46,5),-1.45+Ya,se+.23,10.75+$a));','')
one('te("med",xf(box(.3,.04,1.8),.9*-hw(10)+.2,se+1.5,10.2));for(let _a=0;_a<6;_a++)te("bottle",xf(cyl(.035,.05,.22,8),.9*-hw(10)+.2,se+1.63,9.5+.27*_a)),te("bottle",xf(cyl(.015,.02,.08,6),.9*-hw(10)+.2,se+1.78,9.5+.27*_a));','')
one('te("brass",xf(cyl(.05,.05,.4,8),-1.2,se+.86,10,0,.8,Math.PI/2));','')
one('oe+.02)),const me=Math.atan2(3,8);','oe+.02));const me=Math.atan2(3,8);')
one('.3,0)),const ge=[];','.3,0));const ge=[];')
# their invisible collision boxes go too
one('Oe(-1,1,-1.45,.45,"all"),We(0,-5.4,.62),Oe(-2.5,-1.6,-9.95,-9.05),We(-1.25,-10.1,.5),Oe(2.2,3.1,12.15,13.05,"high"),We(-1.9,-7,.55),Oe(-2.3,-.6,9.15,10.25,"low"),We(-1.45,10.75,.32,"low"),Oe(1.4,3.4,8.8,9.8,"low"),',
    'Oe(-1,1,-1.45,.45,"all"),Oe(-2.3,-.6,9.15,10.25,"low"),')

# ---------- 4. sails one pixel thick ----------
SLAB=r'''
/* sails and jibs become solid slabs one pixel thick: front and back faces offset along the cloth normal, plus a rim,
   rebuilt from the billowing cloth every time it is reshaped */
const SLAB=(()=>{const H=PIXS/2,cn=THREE.BufferGeometry.prototype.computeVertexNormals;
function attach(mesh){const pg=mesh.geometry,I=pg.index.array,N=pg.attributes.position.count,UV=pg.attributes.uv.array,M=new Map,E=[];
  for(let i=0;i<I.length;i+=3)for(const[a,b]of[[I[i],I[i+1]],[I[i+1],I[i+2]],[I[i+2],I[i]]]){const k=a<b?a*65536+b:b*65536+a,c=M.get(k);c?c.n++:M.set(k,{n:1,a,b})}
  for(const c of M.values())c.n===1&&E.push(c.a,c.b);
  const NV=2*N+E.length*2,g=new THREE.BufferGeometry,pos=new Float32Array(NV*3),nor=new Float32Array(NV*3),uv=new Float32Array(NV*2),ix=[];
  for(let i=0;i<N;i++){uv[i*2]=uv[(N+i)*2]=UV[i*2];uv[i*2+1]=uv[(N+i)*2+1]=UV[i*2+1]}
  for(let i=0;i<I.length;i+=3)ix.push(I[i],I[i+1],I[i+2],N+I[i],N+I[i+2],N+I[i+1]);
  for(let k=0;k<E.length;k+=2){const a=E[k],b=E[k+1],o=2*N+k*2;for(const[j,v]of[[0,a],[1,b],[2,b],[3,a]]){uv[(o+j)*2]=UV[v*2];uv[(o+j)*2+1]=UV[v*2+1]}ix.push(o,o+1,o+2,o,o+2,o+3)}
  g.setAttribute("position",new THREE.BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage));g.setAttribute("normal",new THREE.BufferAttribute(nor,3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute("uv",new THREE.BufferAttribute(uv,2));g.setIndex(ix);g.boundingSphere=new THREE.Sphere(new THREE.Vector3,60);
  const sm=new THREE.Mesh(g,mesh.material);sm.castShadow=mesh.castShadow;sm.receiveShadow=!0;sm.frustumCulled=!1;sm.userData.noKit=1;
  if(mesh.matrixAutoUpdate===!1){sm.matrixAutoUpdate=!1;sm.matrix.copy(mesh.matrix)}else{sm.position.copy(mesh.position);sm.quaternion.copy(mesh.quaternion);sm.scale.copy(mesh.scale)}
  mesh.parent.add(sm);mesh.visible=!1;mesh.userData.slab=sm;
  const S={pg,g,E,N};pg.computeVertexNormals=function(){cn.call(this);sync(S)};pg.computeVertexNormals();return sm}
function sync(S){const P=S.pg.attributes.position.array,Nn=S.pg.attributes.normal.array,pos=S.g.attributes.position.array,nor=S.g.attributes.normal.array,N=S.N,E=S.E;
  let cx=0,cy=0,cz=0;for(let i=0;i<N;i++){cx+=P[i*3];cy+=P[i*3+1];cz+=P[i*3+2]}cx/=N;cy/=N;cz/=N;
  for(let i=0;i<N;i++){const o=i*3,b=(N+i)*3;for(let c=0;c<3;c++){pos[o+c]=P[o+c]+Nn[o+c]*H;pos[b+c]=P[o+c]-Nn[o+c]*H;nor[o+c]=Nn[o+c];nor[b+c]=-Nn[o+c]}}
  for(let k=0;k<E.length;k+=2){const a=E[k]*3,b=E[k+1]*3,o=(2*N+k*2)*3;
    const dx=P[b]-P[a],dy=P[b+1]-P[a+1],dz=P[b+2]-P[a+2],nx=Nn[a]+Nn[b],ny=Nn[a+1]+Nn[b+1],nz=Nn[a+2]+Nn[b+2];
    let ex=dy*nz-dz*ny,ey=dz*nx-dx*nz,ez=dx*ny-dy*nx;const l=Math.hypot(ex,ey,ez)||1;ex/=l;ey/=l;ez/=l;
    if(ex*(P[a]-cx)+ey*(P[a+1]-cy)+ez*(P[a+2]-cz)<0){ex=-ex;ey=-ey;ez=-ez}
    const put=(j,v,sg)=>{const q=o+j*3;pos[q]=P[v]+Nn[v]*H*sg;pos[q+1]=P[v+1]+Nn[v+1]*H*sg;pos[q+2]=P[v+2]+Nn[v+2]*H*sg;nor[q]=ex;nor[q+1]=ey;nor[q+2]=ez};
    put(0,a,1);put(1,b,1);put(2,b,-1);put(3,a,-1)}
  S.g.attributes.position.needsUpdate=S.g.attributes.normal.needsUpdate=!0}
return{attach}})();
'''
one("makeJib(Ee(0,se+20.2,-8.3),Ee(0,6.6,-21.5),Ee(0,se+3.6,-12.6)),makeJib(Ee(0,se+15.5,-8.3),Ee(0,5.5,-18.7),Ee(0,se+2.7,-11));",
    "makeJib(Ee(0,se+20.2,-8.3),Ee(0,6.6,-21.5),Ee(0,se+3.6,-12.6)),makeJib(Ee(0,se+15.5,-8.3),Ee(0,5.5,-18.7),Ee(0,se+2.7,-11));"+SLAB+"for(const q of be)SLAB.attach(q.mesh);for(const q of Re)SLAB.attach(q.mesh);")
one("Kn.set(e.id,m),e.st&&pushSnap(m,e.st)","Kn.set(e.id,m),m.sails.concat(m.jibs).forEach(q=>SLAB.attach(q)),e.st&&pushSnap(m,e.st)")

# ---------- 5. gulls and rocks on the same pixel grid ----------
one("vec3 base=pow(texture2D(uMap,vUv).rgb,vec3(2.2));","vec2 gx,gy;vec2 puv=pixUV(vUv,vL,gx,gy);vec3 base=pow(textureGrad(uMap,puv,gx,gy).rgb,vec3(2.2));")
one("fragmentShader:`uniform sampler2D uMap;uniform vec3 uSunDir,uSunCol;uniform float uSunI,uSunK;","fragmentShader:`#define PIXS ${PIXS.toFixed(7)}\n${PIXFN}\nuniform sampler2D uMap;uniform vec3 uSunDir,uSunCol;uniform float uSunI,uSunK;")
a=s.index("const rockMat=new THREE.ShaderMaterial");b=s.index("function foamMat(",a);R=s[a:b]
f=R.index("fragmentShader:`")
head,frag=R[:f],R[f:]
anchor="vec3 N=normalize(vN);vec3 an=abs(N);float side=1.0-an.y;"
assert frag.count(anchor)==1
frag=frag.replace("vL.","vLp.").replace(anchor,anchor+"vec3 vLp=vL;{vec3 fw=fwidth(vL);if(max(fw.x,max(fw.y,fw.z))<PIXS*0.7)vLp=(floor(vL/PIXS)+0.5)*PIXS;}")
frag=frag.replace("fragmentShader:`","fragmentShader:`#define PIXS ${PIXS.toFixed(7)}\n",1)
s=s[:a]+head+frag+s[b:]
open(P,'w').write(s)
print('pix ok')
