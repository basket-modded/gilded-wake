/* Voxel ship: every solid part of the ship (hull, decks, rails, masts, yards, ropes, barrels, cannons, lanterns, bell,
   wheel...) is rebuilt as cubes on the captain's pixel grid. Surfaces are sampled into a sparse voxel set in each
   object's own space (so moving parts keep moving), and exposed faces are merged into large quads (greedy meshing),
   which keeps the triangle count low. Textures land exactly one texel per voxel face through the pixel shader.
   Rigging lines become 1-voxel ropes; the loose hanging ropes are re-voxelised as they sway. */
const VOX=(()=>{
const DIRS=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]],h=PIXS,O=8192,Q=16384,key=(x,y,z)=>((x+O)*Q+(y+O))*Q+(z+O);
const dec=k=>{const z=k%Q,t=(k-z)/Q,y=t%Q,x=(t-y)/Q;return[x-O,y-O,z-O]};
const cell=v=>Math.floor(v/h);
let INF=null,NX=0,NY=0,NZ=0,FLIP=!1,THIN=!1;
function pt(M,x,y,z,c){const cx=cell(x),cy=cell(y),cz=cell(z),k=key(cx,cy,cz);M.has(k)||M.set(k,c);
  if(INF){const dx=x-(cx+.5)*h,dy=y-(cy+.5)*h,dz=z-(cz+.5)*h,d=dx*dx+dy*dy+dz*dz,q=INF.get(k);if(!q||d<q[0])INF.set(k,[d,x,y,z,NX,NY,NZ])}}
function tri(M,a,b,c,col){if(INF){const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];NX=uy*vz-uz*vy;NY=uz*vx-ux*vz;NZ=ux*vy-uy*vx;const l=(Math.hypot(NX,NY,NZ)||1)*(FLIP?-1:1);NX/=l;NY/=l;NZ/=l}const l=Math.max(Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]),Math.hypot(c[0]-a[0],c[1]-a[1],c[2]-a[2]),Math.hypot(c[0]-b[0],c[1]-b[1],c[2]-b[2]));
  const n=Math.max(1,Math.ceil(l/(h*.45)));
  for(let i=0;i<=n;i++)for(let j=0;j<=n-i;j++){const u=i/n,v=j/n;pt(M,a[0]+(b[0]-a[0])*u+(c[0]-a[0])*v,a[1]+(b[1]-a[1])*u+(c[1]-a[1])*v,a[2]+(b[2]-a[2])*u+(c[2]-a[2])*v,col)}}
function seg(M,a,b,col){const n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2])/(h*.45)));
  for(let i=0;i<=n;i++){const u=i/n;pt(M,a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u,a[2]+(b[2]-a[2])*u,col)}}
/* make surfaces watertight: cubes that only touch along an edge or a corner get a bridging cube, so no pinholes */
function close(M){const add=[];
  for(const[k,c]of M){const[x,y,z]=dec(k);
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){const n=(dx!==0)+(dy!==0)+(dz!==0);if(n<2)continue;
      if(!M.has(key(x+dx,y+dy,z+dz)))continue;
      const path=n===2?[[dx,dy,dz].map((v,i)=>i===(dx?0:dy?1:2)?v:0)]:[[dx,0,0],[dx,dy,0]];
      const alt=n===2?[[dx,dy,dz].map((v,i)=>i===(dz?2:dy?1:0)?v:0)]:[[0,dy,0],[0,dy,dz]];
      const has=P=>P.every(q=>M.has(key(x+q[0],y+q[1],z+q[2])));if(has(path)||has(alt))continue;
      for(const q of path)add.push(key(x+q[0],y+q[1],z+q[2]),c)}}
  for(let i=0;i<add.length;i+=2)M.has(add[i])||M.set(add[i],add[i+1]);return M}
/* surface of a geometry -> voxels; vertex colours become a small palette */
function fromGeo(g,T,solid){INF=solid?new Map:null;let SV=0;const P=g.attributes.position,C=g.attributes.color,I=g.index,M=new Map,pal=[],pk=new Map;
  const colOf=i=>{if(!C)return 0;const r=C.getX(i),gg=C.getY(i),b=C.getZ(i),k=Math.round(r*40)+","+Math.round(gg*40)+","+Math.round(b*40);let c=pk.get(k);if(c==null){c=pal.length;pal.push([r,gg,b]);pk.set(k,c)}return c};
  const n=I?I.count:P.count,tx=T?T[0]:0,ty=T?T[1]:0,tz=T?T[2]:0,V=i=>[P.getX(i)+tx,P.getY(i)+ty,P.getZ(i)+tz];
  if(INF)for(let t=0;t<n;t+=3){const a=V(I?I.getX(t):t),b=V(I?I.getX(t+1):t+1),c=V(I?I.getX(t+2):t+2);SV+=a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0])}
  FLIP=SV<0;
  for(let t=0;t<n;t+=3){const i0=I?I.getX(t):t,i1=I?I.getX(t+1):t+1,i2=I?I.getX(t+2):t+2;tri(M,V(i0),V(i1),V(i2),colOf(i0))}
  const inf=INF;INF=null;THIN=!1;const S=inf?solidify(M,inf):M,thin=THIN;return{M:inf&&!thin?S:close(S),pal:C?pal:null,thin}}
/* solid voxels: fill the inside of closed shapes, then keep a surface cube only if its centre is inside the shape,
   so round things come out as clean, even voxel curves; thin parts (hoops, chains, ropes) stay one cube thick */
function solidify(M,inf){let x0=1e9,y0=1e9,z0=1e9,x1=-1e9,y1=-1e9,z1=-1e9;
  for(const k of M.keys()){const[x,y,z]=dec(k);x<x0&&(x0=x);y<y0&&(y0=y);z<z0&&(z0=z);x>x1&&(x1=x);y>y1&&(y1=y);z>z1&&(z1=z)}
  x0--;y0--;z0--;x1++;y1++;z1++;const W=x1-x0+1,H=y1-y0+1,D=z1-z0+1;if(W*H*D>3e6)return M;
  const id=(x,y,z)=>((x-x0)*H+(y-y0))*D+(z-z0),G=new Uint8Array(W*H*D);
  for(const k of M.keys()){const[x,y,z]=dec(k);G[id(x,y,z)]=1}
  const st=[0];G[0]=2;while(st.length){const i=st.pop(),z=i%D,t=(i-z)/D,y=t%H,x=(t-y)/H;
    for(const[a,b,c]of[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){const X=x+a,Y=y+b,Z=z+c;if(X<0||Y<0||Z<0||X>=W||Y>=H||Z>=D)continue;const j=(X*H+Y)*D+Z;if(!G[j]){G[j]=2;st.push(j)}}}
  const R=new Map,c0=M.values().next().value||0;
  for(let i=0;i<G.length;i++)if(!G[i]){const z=i%D,t=(i-z)/D,y=t%H,x=(t-y)/H;R.set(key(x+x0,y+y0,z+z0),c0)}
  const nin=R.size;const out=[];
  for(const[k,c]of M){const q=inf.get(k),[x,y,z]=dec(k);
    if(q&&((x+.5)*h-q[1])*q[4]+((y+.5)*h-q[2])*q[5]+((z+.5)*h-q[3])*q[6]<=0)R.set(k,c);else out.push(k,c)}
  THIN=R.size*4<M.size;if(THIN)R.clear();
  for(let i=0;i<out.length;i+=2){const[x,y,z]=dec(out[i]);let touch=!1;for(const D6 of DIRS)if(R.has(key(x+D6[0],y+D6[1],z+D6[2]))){touch=!0;break}touch||R.set(out[i],out[i+1])}
  return R}
/* exposed faces, merged into the biggest rectangles per plane and colour */
function mesh(M,pal,keep,occ,T,inset=0){const G=new Map,has=occ||(k=>M.has(k)),ox=T?T[0]:0,oy=T?T[1]:0,oz=T?T[2]:0;
  for(const[k,c]of M){const[x,y,z]=dec(k);
    for(let d=0;d<6;d++){const D=DIRS[d];if(has(key(x+D[0],y+D[1],z+D[2])))continue;if(keep&&!keep(d,x,y,z))continue;
      const ax=d>>1,L=ax===0?x:ax===1?y:z,u=ax===0?y:x,v=ax===2?y:z,gk=d+"|"+L+"|"+c;let s=G.get(gk);if(!s){s=new Set;G.set(gk,s)}s.add((u+O)*Q+(v+O))}}
  const pos=[],nor=[],uv=[],col=[];
  for(const[gk,S]of G){const[ds,Ls,cs]=gk.split("|"),d=+ds,L=+Ls,c=+cs,ax=d>>1,sg=d&1?-1:1,pl=(L+(sg>0?1:0))*h-sg*inset,nrm=DIRS[d];
    const cells=[...S].sort((a,b)=>a-b),done=new Set;
    for(const ck of cells){if(done.has(ck))continue;const v0=ck%Q,u0=(ck-v0)/Q;let w=1,hh=1;
      while(S.has((u0+w)*Q+v0)&&!done.has((u0+w)*Q+v0))w++;
      grow:for(;;){for(let i=0;i<w;i++){const q=(u0+i)*Q+v0+hh;if(!S.has(q)||done.has(q))break grow}hh++}
      for(let i=0;i<w;i++)for(let j=0;j<hh;j++)done.add((u0+i)*Q+v0+j);
      const U0=(u0-O)*h,U1=(u0-O+w)*h,V0=(v0-O)*h,V1=(v0-O+hh)*h;
      const P3=(uu,vv)=>ax===0?[pl,uu,vv]:ax===1?[uu,pl,vv]:[uu,vv,pl];
      let q=[P3(U0,V0),P3(U1,V0),P3(U1,V1),P3(U0,V1)];
      const e1=[q[1][0]-q[0][0],q[1][1]-q[0][1],q[1][2]-q[0][2]],e2=[q[3][0]-q[0][0],q[3][1]-q[0][1],q[3][2]-q[0][2]];
      if((e1[1]*e2[2]-e1[2]*e2[1])*nrm[0]+(e1[2]*e2[0]-e1[0]*e2[2])*nrm[1]+(e1[0]*e2[1]-e1[1]*e2[0])*nrm[2]<0)q=[q[0],q[3],q[2],q[1]];
      for(const k of[0,1,2,0,2,3]){const p=q[k];pos.push(p[0]-ox,p[1]-oy,p[2]-oz);nor.push(nrm[0],nrm[1],nrm[2]);
        uv.push(ax===0?p[2]*.5:p[0]*.5,ax===1?p[2]*.5:p[1]*.5);if(pal){const cc=pal[c];col.push(cc[0],cc[1],cc[2])}}}}
  const g=new THREE.BufferGeometry;g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));g.setAttribute("normal",new THREE.Float32BufferAttribute(nor,3));
  g.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));if(pal)g.setAttribute("color",new THREE.Float32BufferAttribute(col,3));
  g.computeBoundingSphere();g.computeBoundingBox();return g}
let PEU=null,done=0,rig=null,stats={meshes:0,tris:0,ms:0};const LIST=[];
/* faces nobody can ever see: hull deep under the sea, the inside of the hull below the main deck, the underside of the main deck */
const HULLK=(d,x,y,z)=>(y+1)*h>-.45&&!(y*h<se-.03&&((d===0&&x*h<-.3)||(d===1&&x*h>.3)||d===2&&y*h<se-.35)),DECKK=(d,x,y,z)=>!(d===3&&y*h<se-.1);
function run(){if(done)return;done=1;const t0=performance.now(),cache=new Map,groups=new Map;
  pe.updateMatrixWorld(!0);
  pe.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||o.isSkinnedMesh)return;const m=o.material;
    if(!m||Array.isArray(m)||m.visible===!1||o.userData.noKit||o.userData.sailIdx!=null||o.userData.jibIdx!=null||o.userData.pennant||m===_.flag||m===_.sail)return;
    if(!o.geometry.attributes.position||o.geometry.attributes.position.count<3)return;
    /* parts with only a translation inside the same parent share one voxel space */
    const e=o.matrix.elements,pure=Math.abs(e[0]-1)+Math.abs(e[5]-1)+Math.abs(e[10]-1)+Math.abs(e[1])+Math.abs(e[2])+Math.abs(e[4])+Math.abs(e[6])+Math.abs(e[8])+Math.abs(e[9])<1e-5;
    const gk=pure?o.parent.uuid:o.uuid;let G=groups.get(gk);if(!G){G=[];groups.set(gk,G)}G.push([o,pure?[e[12],e[13],e[14]]:null])});
  for(const G of groups.values()){
    /* big parts first, small detail last: where parts share a cell the smaller, more detailed part wins it
       (iron hoops on a barrel, brackets on a wall). See-through parts only fill cells nobody else owns. */
    const vol=o=>{const g=o.geometry;g.boundingBox||g.computeBoundingBox();const z=g.boundingBox.getSize(new THREE.Vector3);return Math.max(z.x,.01)*Math.max(z.y,.01)*Math.max(z.z,.01)};
    G.sort((p,q)=>(!!p[0].material.transparent)-(!!q[0].material.transparent)||vol(q[0])-vol(p[0]));
    const sig=G.map(([o,T])=>o.geometry.uuid+(T?T.map(v=>v.toFixed(3)).join(","):"")).join("|");let out=cache.get(sig);
    if(!out){const U=new Map,maps=[];
      const SOL=!(G[0][0].parent===pe&&G[0][1]);
      G.forEach(([o,T],i)=>{const r=fromGeo(o.geometry,T,SOL),tr=!!o.material.transparent;maps.push(r);if(tr)return;
        if(r.thin&&U.size){for(const k of[...r.M.keys()]){if(U.has(k))continue;const[x,y,z]=dec(k);let adj=!1;for(let a=-2;a<=2&&!adj;a++)for(let b=-2;b<=2&&!adj;b++)for(let c=-2;c<=2;c++)if(U.has(key(x+a,y+b,z+c))){adj=!0;break}adj&&r.M.delete(k)}}
        for(const k of r.M.keys())U.set(k,i)});
      const parts=G.map(([o,T],i)=>{const{M,pal}=maps[i],own=new Map,tr=!!o.material.transparent;
        for(const[k,c]of M)if(tr?!U.has(k):U.get(k)===i)own.set(k,c);
        return[own,pal,tr,o===he?HULLK:o===Me.deck?DECKK:null,T]});
      if(G[0][0].parent===pe&&G[0][1])PEU=U;
      const ins=G[0][0].parent===pe&&G[0][1]?0:.004+(G[0][0].id%7)*.0025;
      out=parts.map(([own,pal,tr,keep,T])=>mesh(own,pal,keep,tr?(k=>U.has(k)||own.has(k)):(k=>U.has(k)),T,ins));cache.set(sig,out)}
    G.forEach(([o],i)=>{LIST.push([o,o.geometry,out[i]]);o.geometry=out[i];stats.meshes++})}
  /* standing rigging: shrouds, stays and ratlines become ropes one voxel thick */
  const M=new Map,R=Te.geometry.attributes.position;for(let i=0;i<R.count;i+=2)seg(M,[R.getX(i),R.getY(i),R.getZ(i)],[R.getX(i+1),R.getY(i+1),R.getZ(i+1)],0);
  close(M);if(PEU)for(const k of[...M.keys()])PEU.has(k)&&M.delete(k);rig=mesh(M,null,null,k=>M.has(k)||!!(PEU&&PEU.has(k)),null,.002);const rm=new THREE.Mesh(rig,_.rope);rm.castShadow=!0;pe.add(rm);Te.visible=!1;Te.userData.noKit=1;
  Be.visible=!1;pe.add(loose.m);
  for(const c of cache.values())for(const g of c)stats.tris+=g.attributes.position.count/3;stats.tris+=rig.attributes.position.count/3;stats.ms=Math.round(performance.now()-t0)}
/* loose hanging rope ends: voxel cubes rebuilt from the swaying line every frame */
const loose=(()=>{const CAP=3000,g=new THREE.BufferGeometry,pos=new Float32Array(CAP*36*3),nor=new Float32Array(CAP*36*3),uv=new Float32Array(CAP*36*2);
  g.setAttribute("position",new THREE.BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage));g.setAttribute("normal",new THREE.BufferAttribute(nor,3).setUsage(THREE.DynamicDrawUsage));g.setAttribute("uv",new THREE.BufferAttribute(uv,2));
  g.boundingSphere=new THREE.Sphere(new THREE.Vector3,40);const m=new THREE.Mesh(g,_.rope);m.frustumCulled=!1;m.castShadow=!0;m.userData.noKit=1;
  const F=[[[1,0,0],[[1,0,0],[1,1,0],[1,1,1],[1,0,1]]],[[-1,0,0],[[0,0,0],[0,0,1],[0,1,1],[0,1,0]]],[[0,1,0],[[0,1,0],[0,1,1],[1,1,1],[1,1,0]]],[[0,-1,0],[[0,0,0],[1,0,0],[1,0,1],[0,0,1]]],[[0,0,1],[[0,0,1],[1,0,1],[1,1,1],[0,1,1]]],[[0,0,-1],[[0,0,0],[0,1,0],[1,1,0],[1,0,0]]]];
  let fr=0;
  function update(){if(!done||(++fr&1))return;const A=Be.geometry.attributes.position,M=new Map;
    for(let i=0;i+1<A.count;i+=2)seg(M,[A.getX(i),A.getY(i),A.getZ(i)],[A.getX(i+1),A.getY(i+1),A.getZ(i+1)],0);
    close(M);let v=0;for(const k of M.keys()){if(v>=CAP*36-36)break;const[x,y,z]=dec(k);
      for(let d=0;d<6;d++){const D=F[d][0];if(M.has(key(x+D[0],y+D[1],z+D[2])))continue;const c=F[d][1];
        for(const j of[0,1,2,0,2,3]){const p=c[j];pos[v*3]=(x+p[0])*h+(p[0]?-.005:.005);pos[v*3+1]=(y+p[1])*h+(p[1]?-.005:.005);pos[v*3+2]=(z+p[2])*h+(p[2]?-.005:.005);nor[v*3]=D[0];nor[v*3+1]=D[1];nor[v*3+2]=D[2];v++}}}
    g.setDrawRange(0,v);g.attributes.position.needsUpdate=g.attributes.normal.needsUpdate=!0}
  return{m,update}})();
function swap(v){for(const[o,g0,g1]of LIST)o.geometry=v?g1:g0}
return{dec,key,run,swap,frame:()=>loose.update(),get rig(){return rig},stats};
})();
